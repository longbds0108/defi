import { encodeAbiParameters, formatUnits, parseUnits, toHex, concat, type Address, type Hex } from 'viem';
import { auctionParametersAbi } from './abi';

// CCA prices are Q96 fixed-point ratios of raw currency units per raw token unit.
const Q96 = 2n ** 96n;
export const MPS_TOTAL = 10_000_000; // 100% of supply in milli-basis-points

/** Q96 price → human "currency per 1 token". */
export function q96ToPrice(q96: bigint, tokenDecimals: number, currencyDecimals: number) {
  const scaled = (q96 * 10n ** BigInt(tokenDecimals) * 10n ** 18n) / (Q96 * 10n ** BigInt(currencyDecimals));
  return Number(formatUnits(scaled, 18));
}

/** Human "currency per 1 token" → Q96 price. */
export function priceToQ96(price: string, tokenDecimals: number, currencyDecimals: number) {
  const p = parseUnits(price, 18);
  return (p * Q96 * 10n ** BigInt(currencyDecimals)) / (10n ** BigInt(tokenDecimals) * 10n ** 18n);
}

/** Snap a bid price onto the auction's tick grid, strictly above `above`. */
export function snapToTick(q96: bigint, floor: bigint, spacing: bigint, above: bigint) {
  let k = q96 <= floor ? 1n : (q96 - floor + spacing - 1n) / spacing;
  let price = floor + k * spacing;
  while (price <= above) {
    k += 1n;
    price = floor + k * spacing;
  }
  return price;
}

/**
 * Uniform release schedule over `blocks` blocks. Each step packs
 * (mps: uint24 | blockDelta: uint40) into 8 bytes and the steps must sum to
 * exactly 1e7 mps. The remainder is spread one mps per block over the first
 * blocks instead of being dumped into the last block, which matters on fast
 * chains where an auction spans hundreds of thousands of blocks.
 */
export function uniformSteps(blocks: number): Hex {
  if (blocks < 1 || blocks > MPS_TOTAL) throw new Error('Auction length must be between 1 and 10,000,000 blocks.');
  const pack = (mps: number, delta: number) => toHex(BigInt(mps) | (BigInt(delta) << 24n), { size: 8 });
  const per = Math.floor(MPS_TOTAL / blocks);
  const remainder = MPS_TOTAL - per * blocks; // < blocks
  if (remainder === 0) return pack(per, blocks);
  return concat([pack(per + 1, remainder), pack(per, blocks - remainder)]);
}

export interface AuctionConfig {
  currency: Address;
  tokensRecipient: Address;
  fundsRecipient: Address;
  startBlock: bigint;
  endBlock: bigint;
  claimBlock: bigint;
  tickSpacing: bigint;
  validationHook: Address;
  floorPrice: bigint;
  requiredCurrencyRaised: bigint;
  auctionStepsData: Hex;
}

export const encodeAuctionConfig = (config: AuctionConfig) => encodeAbiParameters(auctionParametersAbi, [config]);

/** Floor price and 1% tick spacing, with floor an exact multiple of the spacing. */
export function floorAndSpacing(floorQ96: bigint) {
  const spacing = floorQ96 / 100n > 0n ? floorQ96 / 100n : 1n;
  return { floorPrice: spacing * 100n, tickSpacing: spacing };
}
