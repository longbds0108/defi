// Demo data for the app shell. Nothing here comes from a contract or market
// feed; every screen that renders it shows a "Demo data" badge. Replace these
// exports with real reads (contracts, indexer, price API) when they exist.

export interface Token {
  symbol: string;
  name: string;
  color: string;
  price: number;
  change24h: number; // percent
  volume24h: number;
  tvl: number;
  decimals: number;
}

export const TOKENS: Token[] = [
  { symbol: 'USDC', name: 'USD Coin', color: '#2775CA', price: 1, change24h: 0.01, volume24h: 18_420_000, tvl: 64_300_000, decimals: 6 },
  { symbol: 'EURC', name: 'Euro Coin', color: '#1B4CE0', price: 1.08, change24h: -0.12, volume24h: 6_910_000, tvl: 21_800_000, decimals: 6 },
  { symbol: 'ETH', name: 'Ether', color: '#627EEA', price: 3_412.55, change24h: 2.84, volume24h: 42_100_000, tvl: 88_900_000, decimals: 18 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', color: '#F09242', price: 96_120.4, change24h: 1.37, volume24h: 29_700_000, tvl: 73_200_000, decimals: 8 },
  { symbol: 'LUM', name: 'Lumora', color: '#9B5DE5', price: 0.842, change24h: 7.91, volume24h: 3_240_000, tvl: 9_870_000, decimals: 18 },
  { symbol: 'LINK', name: 'Chainlink', color: '#2A5ADA', price: 18.73, change24h: -1.64, volume24h: 4_050_000, tvl: 12_400_000, decimals: 18 },
  { symbol: 'AAVE', name: 'Aave', color: '#B6509E', price: 214.9, change24h: 3.22, volume24h: 2_880_000, tvl: 8_150_000, decimals: 18 },
  { symbol: 'ARB', name: 'Arbitrum', color: '#28A0F0', price: 0.62, change24h: -4.05, volume24h: 1_930_000, tvl: 5_420_000, decimals: 18 },
];

export const tokenBySymbol = (symbol: string) => TOKENS.find((t) => t.symbol === symbol) ?? TOKENS[0];

export interface Network {
  id: string;
  name: string;
  short: string;
  color: string;
  etaMinutes: number;
  feeUsd: number;
}

export const NETWORKS: Network[] = [
  { id: 'arc', name: 'Arc Testnet', short: 'ARC', color: '#9B5DE5', etaMinutes: 1, feeUsd: 0.02 },
  { id: 'eth', name: 'Ethereum Sepolia', short: 'ETH', color: '#627EEA', etaMinutes: 12, feeUsd: 1.8 },
  { id: 'base', name: 'Base Sepolia', short: 'BASE', color: '#0052FF', etaMinutes: 2, feeUsd: 0.06 },
  { id: 'arb', name: 'Arbitrum Sepolia', short: 'ARB', color: '#28A0F0', etaMinutes: 3, feeUsd: 0.08 },
  { id: 'op', name: 'OP Sepolia', short: 'OP', color: '#FF0420', etaMinutes: 3, feeUsd: 0.07 },
];

// Small deterministic PRNG so charts look the same on every reload.
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hashString = (value: string) => Array.from(value).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Random-walk series that ends at `end` and moved `changePct` over the window. */
export function priceSeries(symbol: string, points = 48, end = tokenBySymbol(symbol).price, changePct = tokenBySymbol(symbol).change24h) {
  const rand = seeded(hashString(symbol));
  const start = end / (1 + changePct / 100);
  const values: number[] = [];
  let noise = 0;
  for (let i = 0; i < points; i += 1) {
    noise = noise * 0.82 + (rand() - 0.5) * 0.012;
    const trend = start + ((end - start) * i) / (points - 1);
    values.push(trend * (1 + noise));
  }
  values[points - 1] = end;
  return values;
}

export type TxType = 'Swap' | 'Add liquidity' | 'Remove liquidity' | 'Bridge' | 'Buy' | 'Sell';

export interface Transaction {
  id: string;
  type: TxType;
  summary: string;
  valueUsd: number;
  account: string;
  minutesAgo: number;
  hash: string;
}

function fakeHex(rand: () => number, length: number) {
  return Array.from({ length }, () => Math.floor(rand() * 16).toString(16)).join('');
}

export const TRANSACTIONS: Transaction[] = (() => {
  const rand = seeded(42);
  const types: TxType[] = ['Swap', 'Swap', 'Swap', 'Add liquidity', 'Remove liquidity', 'Bridge', 'Buy', 'Sell'];
  return Array.from({ length: 36 }, (_, i) => {
    const type = types[Math.floor(rand() * types.length)];
    const a = TOKENS[Math.floor(rand() * TOKENS.length)];
    let b = TOKENS[Math.floor(rand() * TOKENS.length)];
    if (b.symbol === a.symbol) b = TOKENS[(TOKENS.indexOf(a) + 1) % TOKENS.length];
    const valueUsd = Math.round(50 + rand() ** 3 * 180_000);
    const amountA = valueUsd / a.price;
    const amountB = valueUsd / b.price;
    const fmt = (n: number) => (n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n.toLocaleString('en-US', { maximumFractionDigits: 4 }));
    const summary =
      type === 'Swap'
        ? `${fmt(amountA)} ${a.symbol} → ${fmt(amountB)} ${b.symbol}`
        : type === 'Bridge'
          ? `${fmt(amountA)} ${a.symbol} · ${NETWORKS[1 + Math.floor(rand() * 4)].short} → ARC`
          : type === 'Buy'
            ? `$${fmt(valueUsd)} → ${fmt(amountA)} ${a.symbol}`
            : type === 'Sell'
              ? `${fmt(amountA)} ${a.symbol} → $${fmt(valueUsd)}`
              : `${fmt(amountA / 2)} ${a.symbol} + ${fmt(amountB / 2)} ${b.symbol}`;
    return {
      id: `tx-${i}`,
      type,
      summary,
      valueUsd,
      account: `0x${fakeHex(rand, 4)}…${fakeHex(rand, 4)}`,
      minutesAgo: Math.round(i * 3.4 + rand() * 3),
      hash: `0x${fakeHex(rand, 64)}`,
    };
  });
})();

export interface Pool {
  id: string;
  a: string;
  b: string;
  feeBps: number;
  tvl: number;
  volume24h: number;
  apr: number;
}

export const POOLS: Pool[] = [
  { id: 'usdc-eurc-5', a: 'USDC', b: 'EURC', feeBps: 5, tvl: 18_400_000, volume24h: 6_200_000, apr: 6.2 },
  { id: 'eth-usdc-30', a: 'ETH', b: 'USDC', feeBps: 30, tvl: 41_200_000, volume24h: 22_800_000, apr: 18.4 },
  { id: 'wbtc-usdc-30', a: 'WBTC', b: 'USDC', feeBps: 30, tvl: 33_900_000, volume24h: 14_100_000, apr: 12.9 },
  { id: 'lum-usdc-100', a: 'LUM', b: 'USDC', feeBps: 100, tvl: 4_900_000, volume24h: 2_600_000, apr: 42.7 },
  { id: 'eth-wbtc-30', a: 'ETH', b: 'WBTC', feeBps: 30, tvl: 12_700_000, volume24h: 4_300_000, apr: 9.8 },
];

export const FEE_TIERS = [
  { bps: 1, label: '0.01%', hint: 'Very stable pairs' },
  { bps: 5, label: '0.05%', hint: 'Stable pairs' },
  { bps: 30, label: '0.30%', hint: 'Most pairs' },
  { bps: 100, label: '1.00%', hint: 'Exotic pairs' },
];

export type LaunchStatus = 'live' | 'upcoming' | 'ended';

export interface Launch {
  id: string;
  name: string;
  symbol: string;
  color: string;
  tagline: string;
  status: LaunchStatus;
  kind: 'Dutch auction' | 'Fixed price' | 'Batch auction';
  raised: number;
  target: number;
  price: number;
  participants: number;
  hoursLeft: number; // until end (live) or start (upcoming)
}

export const LAUNCHES: Launch[] = [
  { id: 'orbit', name: 'Orbit Finance', symbol: 'ORB', color: '#3F91FF', tagline: 'Intent-based stablecoin routing for payments', status: 'live', kind: 'Dutch auction', raised: 612_400, target: 900_000, price: 0.184, participants: 1_284, hoursLeft: 31 },
  { id: 'halo', name: 'Halo Credit', symbol: 'HALO', color: '#4FD1C5', tagline: 'Undercollateralized credit lines scored on-chain', status: 'live', kind: 'Batch auction', raised: 1_140_000, target: 1_000_000, price: 0.42, participants: 2_906, hoursLeft: 6 },
  { id: 'fern', name: 'Fern Markets', symbol: 'FERN', color: '#8BD17C', tagline: 'Prediction markets settled in USDC', status: 'upcoming', kind: 'Fixed price', raised: 0, target: 500_000, price: 0.05, participants: 0, hoursLeft: 52 },
  { id: 'quartz', name: 'Quartz', symbol: 'QTZ', color: '#E8B54C', tagline: 'Perp DEX with shared stablecoin margin', status: 'upcoming', kind: 'Dutch auction', raised: 0, target: 2_000_000, price: 1.2, participants: 0, hoursLeft: 120 },
  { id: 'nimbus', name: 'Nimbus', symbol: 'NIM', color: '#B57DEE', tagline: 'Gas sponsorship network for consumer apps', status: 'ended', kind: 'Batch auction', raised: 1_750_000, target: 1_500_000, price: 0.31, participants: 4_112, hoursLeft: 0 },
  { id: 'tidal', name: 'Tidal', symbol: 'TIDE', color: '#28A0F0', tagline: 'Liquid staking for Arc validators', status: 'ended', kind: 'Fixed price', raised: 420_000, target: 800_000, price: 0.09, participants: 906, hoursLeft: 0 },
];

/** Demo holdings shown in Portfolio next to the real native balance. */
export const DEMO_HOLDINGS: Array<{ symbol: string; amount: number }> = [
  { symbol: 'USDC', amount: 4_250 },
  { symbol: 'EURC', amount: 1_800 },
  { symbol: 'ETH', amount: 1.42 },
  { symbol: 'LUM', amount: 12_500 },
  { symbol: 'WBTC', amount: 0.035 },
];

export const DEMO_POSITIONS = [
  { pool: 'eth-usdc-30', liquidityUsd: 3_120, feesUsd: 48.2, inRange: true, min: 3_050, max: 3_900 },
  { pool: 'usdc-eurc-5', liquidityUsd: 1_940, feesUsd: 6.1, inRange: true, min: 1.06, max: 1.1 },
];
