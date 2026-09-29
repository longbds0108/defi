import { defineChain, type Address, type Chain } from 'viem';
import { baseSepolia, robinhoodTestnet, sepolia, unichainSepolia } from 'viem/chains';

export const NATIVE: Address = '0x0000000000000000000000000000000000000000';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
  contracts: { multicall3: { address: '0xca11bde05977b3631167028862be2a173976ca11' } },
  testnet: true,
});

export interface TokenInfo {
  address: Address; // NATIVE for the gas token
  symbol: string;
  name: string;
  decimals: number;
  color: string;
  /** Rough USD value used only for display estimates when no live quote exists. */
  usdHint: number;
}

export interface ChainConfig {
  chain: Chain;
  key: string;
  short: string;
  color: string;
  /** Network logo from the Uniswap interface repo, served from /public/chains. */
  logo: string;
  /** Public RPCs, first ones tolerate wide eth_getLogs ranges. */
  rpcs: string[];
  blockTimeSec: number;
  /** Uniswap Trading/LP API support (see developers.uniswap.org supported chains). */
  uniswapApi: boolean;
  tokens: TokenInfo[];
  /** eth_getLogs window for auction discovery; defaults to 5 × 10k blocks. */
  logRange?: { chunk: bigint; chunks: number };
  /** Launchpad token factory, when one is deployed on this chain. */
  tokenFactory?: { address: Address; kind: 'uerc20' | 'usuperc20' };
}

const ETH: Omit<TokenInfo, 'address'> = { symbol: 'ETH', name: 'Ether', decimals: 18, color: '#627EEA', usdHint: 3400 };
const WETH: Omit<TokenInfo, 'address'> = { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, color: '#7B8FF0', usdHint: 3400 };
const USDC: Omit<TokenInfo, 'address'> = { symbol: 'USDC', name: 'USD Coin', decimals: 6, color: '#2775CA', usdHint: 1 };
const EURC: Omit<TokenInfo, 'address'> = { symbol: 'EURC', name: 'Euro Coin', decimals: 6, color: '#1B4CE0', usdHint: 1.08 };

// Addresses verified on-chain (symbol + decimals) on each testnet.
export const CHAINS: ChainConfig[] = [
  {
    chain: sepolia,
    key: 'sepolia',
    short: 'SEP',
    color: '#627EEA',
    logo: '/chains/ethereum-logo.png',
    rpcs: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://sepolia.drpc.org'],
    blockTimeSec: 12,
    uniswapApi: true,
    tokens: [
      { ...ETH, address: NATIVE },
      { ...WETH, address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' },
      { ...USDC, address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' },
      { ...EURC, address: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4' },
      { symbol: 'UNI', name: 'Uniswap', decimals: 18, color: '#FF007A', usdHint: 10, address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
      { symbol: 'LINK', name: 'Chainlink', decimals: 18, color: '#2A5ADA', usdHint: 18, address: '0x779877A7B0D9E8603169DdbD7836e478b4624789' },
    ],
    tokenFactory: { address: '0x000000e200088D55C39a11F609E5F667729ad49b', kind: 'uerc20' },
  },
  {
    chain: baseSepolia,
    key: 'base-sepolia',
    short: 'BASE',
    color: '#0052FF',
    logo: '/chains/base-logo.png',
    rpcs: ['https://base-sepolia-rpc.publicnode.com', 'https://sepolia.base.org'],
    blockTimeSec: 2,
    uniswapApi: true,
    tokens: [
      { ...ETH, address: NATIVE },
      { ...WETH, address: '0x4200000000000000000000000000000000000006' },
      { ...USDC, address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' },
      { ...EURC, address: '0x808456652fdb597867f38412077A9182bf77359F' },
    ],
    tokenFactory: { address: '0xeEeeEEE204Afb6BABb1287ffed52cCD6BA0b0fb2', kind: 'usuperc20' },
  },
  {
    chain: unichainSepolia,
    key: 'unichain-sepolia',
    short: 'UNI',
    color: '#F50DB4',
    logo: '/chains/unichain-sepolia-logo.png',
    rpcs: ['https://unichain-sepolia-rpc.publicnode.com', 'https://sepolia.unichain.org'],
    blockTimeSec: 1,
    uniswapApi: true,
    tokens: [
      { ...ETH, address: NATIVE },
      { ...WETH, address: '0x4200000000000000000000000000000000000006' },
      { ...USDC, address: '0x31d0220469e10c4E71834a79b1f276d740d3768F' },
    ],
  },
  {
    chain: arcTestnet,
    key: 'arc-testnet',
    short: 'ARC',
    color: '#9B5DE5',
    logo: '/chains/arc-logo.png',
    rpcs: ['https://rpc.testnet.arc.network', 'https://rpc.blockdaemon.testnet.arc.network', 'https://rpc.quicknode.testnet.arc.network'],
    blockTimeSec: 1,
    // Arc Testnet is not served by the Uniswap API (mainnet Arc is).
    uniswapApi: false,
    tokens: [
      { ...USDC, name: 'USD Coin (gas)', decimals: 18, address: NATIVE },
      { ...USDC, address: '0x3600000000000000000000000000000000000000' },
      { ...EURC, address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' },
    ],
    tokenFactory: { address: '0x000000e200088D55C39a11F609E5F667729ad49b', kind: 'uerc20' },
  },
  {
    chain: robinhoodTestnet,
    key: 'robinhood-testnet',
    short: 'HOOD',
    color: '#CCFF00',
    logo: '/chains/robinhood-logo.png',
    rpcs: ['https://rpc.testnet.chain.robinhood.com'],
    // Arbitrum Orbit L2 (~0.14 s blocks). CCA reads L2 block numbers via ArbSys.
    blockTimeSec: 0.14,
    // The Uniswap API serves Robinhood Chain mainnet (4663), not this testnet.
    uniswapApi: false,
    // Circle has not published USDC for this testnet, so only ETH/WETH are listed.
    tokens: [
      { ...ETH, address: NATIVE },
      { ...WETH, address: '0x33e4191705c386532ba27cBF171Db86919200B94' },
    ],
    // The public RPC accepts wide log ranges; ~10M blocks ≈ 16 days.
    logRange: { chunk: 1_999_999n, chunks: 5 },
    tokenFactory: { address: '0x000000e200088D55C39a11F609E5F667729ad49b', kind: 'uerc20' },
  },
];

export const DEFAULT_CHAIN_ID = sepolia.id;

export const chainById = (id: number) => CHAINS.find((c) => c.chain.id === id) ?? CHAINS[0];

export const explorerTx = (chainId: number, hash: string) => `${chainById(chainId).chain.blockExplorers?.default.url}/tx/${hash}`;
export const explorerAddress = (chainId: number, address: string) =>
  `${chainById(chainId).chain.blockExplorers?.default.url}/address/${address}`;

export const isNative = (address: string) => address.toLowerCase() === NATIVE;

/** Uniswap Launchpad contracts, same address on every testnet above (verified with eth_getCode). */
export const LAUNCHPAD = {
  ccaFactory: '0x000000001F26a0044BaA66024e7b6599c61963F8' as Address,
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
};
