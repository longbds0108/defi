import { useQuery } from '@tanstack/react-query';
import { createPublicClient, erc20Abi, fallback, http, type Address } from 'viem';
import { LAUNCHPAD, NATIVE, chainById } from '../chains';
import { auctionCreatedEvent, bidSubmittedEvent, ccaAbi } from './abi';
import { q96ToPrice } from './math';

// Discovers auctions from the CCA factory's AuctionCreated events (recent
// blocks, chunked to respect public RPC log limits) plus auctions this browser
// created or added by address, then reads each auction's state on-chain.

const CHUNK = 9_999n;
const CHUNKS = 5;
const SAVED_KEY = 'lumora.auctions';

export type AuctionStatus = 'upcoming' | 'live' | 'ended';

export interface AuctionView {
  address: Address;
  chainId: number;
  token: Address;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  currency: Address;
  currencySymbol: string;
  currencyDecimals: number;
  totalSupply: bigint;
  startBlock: bigint;
  endBlock: bigint;
  claimBlock: bigint;
  floorPriceQ96: bigint;
  tickSpacingQ96: bigint;
  clearingPriceQ96: bigint;
  currencyRaised: bigint;
  graduated?: boolean;
  status: AuctionStatus;
  /** Seconds until start (upcoming) or end (live). */
  secondsLeft: number;
  progress: number; // 0..1 elapsed
  clearingPrice: number; // human currency per token
  floorPrice: number;
}

export function clientFor(chainId: number) {
  const config = chainById(chainId);
  return createPublicClient({ chain: config.chain, transport: fallback(config.rpcs.map((u) => http(u))) });
}

export function savedAuctions(chainId: number): Address[] {
  try {
    const all = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '{}') as Record<string, Address[]>;
    return all[chainId] ?? [];
  } catch {
    return [];
  }
}

export function saveAuction(chainId: number, address: Address) {
  try {
    const all = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '{}') as Record<string, Address[]>;
    const list = new Set([address, ...(all[chainId] ?? [])]);
    all[chainId] = [...list].slice(0, 50);
    localStorage.setItem(SAVED_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

async function discover(chainId: number): Promise<Address[]> {
  const client = clientFor(chainId);
  const latest = await client.getBlockNumber();
  const found: Address[] = [];
  for (let i = 0; i < CHUNKS; i += 1) {
    const toBlock = latest - BigInt(i) * (CHUNK + 1n);
    const fromBlock = toBlock > CHUNK ? toBlock - CHUNK : 0n;
    try {
      const logs = await client.getLogs({ address: LAUNCHPAD.ccaFactory, event: auctionCreatedEvent, fromBlock, toBlock });
      found.push(...logs.map((l) => l.args.auction!).reverse());
    } catch {
      break; // RPC refused the range; keep what we have
    }
    if (fromBlock === 0n) break;
  }
  return found;
}

async function readTokenMeta(chainId: number, token: Address) {
  if (token === NATIVE) {
    const native = chainById(chainId).chain.nativeCurrency;
    return { symbol: native.symbol, name: native.name, decimals: native.decimals };
  }
  const client = clientFor(chainId);
  const [symbol, name, decimals] = await client.multicall({
    contracts: [
      { address: token, abi: erc20Abi, functionName: 'symbol' },
      { address: token, abi: erc20Abi, functionName: 'name' },
      { address: token, abi: erc20Abi, functionName: 'decimals' },
    ],
  });
  return {
    symbol: (symbol.result as string) ?? '???',
    name: (name.result as string) ?? 'Unknown token',
    decimals: (decimals.result as number) ?? 18,
  };
}

export async function readAuction(chainId: number, address: Address, blockNumber?: bigint): Promise<AuctionView | null> {
  const client = clientFor(chainId);
  const fns = ['token', 'currency', 'totalSupply', 'startBlock', 'endBlock', 'claimBlock', 'floorPrice', 'tickSpacing', 'clearingPrice', 'currencyRaised', 'isGraduated'] as const;
  const results = await client.multicall({ contracts: fns.map((functionName) => ({ address, abi: ccaAbi, functionName })), allowFailure: true });
  const get = <T>(i: number) => results[i].result as T | undefined;
  const token = get<Address>(0);
  const currency = get<Address>(1);
  if (!token || currency === undefined) return null;

  const [tokenMeta, currencyMeta, block] = await Promise.all([
    readTokenMeta(chainId, token),
    readTokenMeta(chainId, currency),
    blockNumber ?? client.getBlockNumber(),
  ]);

  const start = get<bigint>(3) ?? 0n;
  const end = get<bigint>(4) ?? 0n;
  const floor = get<bigint>(6) ?? 0n;
  const clearing = get<bigint>(8) ?? floor;
  const blockTime = chainById(chainId).blockTimeSec;
  const status: AuctionStatus = block < start ? 'upcoming' : block < end ? 'live' : 'ended';
  const span = Number(end - start) || 1;

  return {
    address,
    chainId,
    token,
    tokenSymbol: tokenMeta.symbol,
    tokenName: tokenMeta.name,
    tokenDecimals: tokenMeta.decimals,
    currency,
    currencySymbol: currencyMeta.symbol,
    currencyDecimals: currencyMeta.decimals,
    totalSupply: get<bigint>(2) ?? 0n,
    startBlock: start,
    endBlock: end,
    claimBlock: get<bigint>(5) ?? end,
    floorPriceQ96: floor,
    tickSpacingQ96: get<bigint>(7) ?? 1n,
    clearingPriceQ96: clearing,
    currencyRaised: get<bigint>(9) ?? 0n,
    graduated: get<boolean>(10),
    status,
    secondsLeft: Math.max(0, Number((status === 'upcoming' ? start : end) - block) * blockTime),
    progress: status === 'upcoming' ? 0 : status === 'ended' ? 1 : Number(block - start) / span,
    clearingPrice: q96ToPrice(clearing, tokenMeta.decimals, currencyMeta.decimals),
    floorPrice: q96ToPrice(floor, tokenMeta.decimals, currencyMeta.decimals),
  };
}

export function useAuctions(chainId: number) {
  return useQuery({
    queryKey: ['auctions', chainId],
    queryFn: async () => {
      const discovered = await discover(chainId).catch(() => [] as Address[]);
      const addresses = [...new Set([...savedAuctions(chainId), ...discovered].map((a) => a.toLowerCase() as Address))].slice(0, 30);
      const block = await clientFor(chainId).getBlockNumber();
      const views = await Promise.all(addresses.map((a) => readAuction(chainId, a, block).catch(() => null)));
      return views.filter((v): v is AuctionView => v !== null);
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

/** Bids placed by `owner` on an auction, from BidSubmitted logs. */
export function useMyBids(auction: AuctionView | null, owner?: Address) {
  return useQuery({
    queryKey: ['my-bids', auction?.chainId, auction?.address, owner],
    enabled: Boolean(auction && owner),
    queryFn: async () => {
      const client = clientFor(auction!.chainId);
      const from = auction!.startBlock > 10n ? auction!.startBlock - 10n : 0n;
      const latest = await client.getBlockNumber();
      const logs = [];
      // Scan from the auction start, capped so very long auctions stay cheap.
      let chunks = 0;
      for (let start = from; start <= latest && chunks < 12; start += CHUNK + 1n, chunks += 1) {
        const end = start + CHUNK > latest ? latest : start + CHUNK;
        logs.push(...(await client.getLogs({ address: auction!.address, event: bidSubmittedEvent, args: { owner }, fromBlock: start, toBlock: end })));
        if (logs.length > 50) break;
      }
      const ids = logs.map((l) => l.args.id!);
      const bids = await client.multicall({ contracts: ids.map((id) => ({ address: auction!.address, abi: ccaAbi, functionName: 'bids' as const, args: [id] })), allowFailure: true });
      return ids.map((id, i) => ({ id, bid: bids[i].result as { maxPrice: bigint; amountQ96: bigint; tokensFilled: bigint; exitedBlock: bigint } | undefined }));
    },
    staleTime: 15_000,
  });
}
