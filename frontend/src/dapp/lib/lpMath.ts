import { NATIVE, type TokenInfo } from '../chains';

// Helpers for Uniswap v3/v4 position maths used by the LP API.
// Prices in the API are raw token1/token0 ratios (no decimal adjustment).

export const FEE_TIERS = [
  { fee: 100, tickSpacing: 1, label: '0.01%', hint: 'Very stable pairs' },
  { fee: 500, tickSpacing: 10, label: '0.05%', hint: 'Stable pairs' },
  { fee: 3000, tickSpacing: 60, label: '0.30%', hint: 'Most pairs' },
  { fee: 10000, tickSpacing: 200, label: '1.00%', hint: 'Exotic pairs' },
] as const;

const Q96 = 2 ** 96;
export const MAX_TICK = 887272;

/** Uniswap orders pool tokens by address; native ETH (0x0) sorts first in v4. */
export function sortTokens(a: TokenInfo, b: TokenInfo): [TokenInfo, TokenInfo] {
  return a.address.toLowerCase() < b.address.toLowerCase() ? [a, b] : [b, a];
}

/** Human price of token0 in token1 units from sqrtRatioX96. */
export function priceFromSqrt(sqrtRatioX96: string, dec0: number, dec1: number) {
  const ratio = Number(sqrtRatioX96) / Q96;
  return ratio * ratio * 10 ** (dec0 - dec1);
}

/** sqrtRatioX96 for a human token1-per-token0 price (initial price of a new pool). */
export function sqrtFromPrice(price: number, dec0: number, dec1: number) {
  const raw = price * 10 ** (dec1 - dec0);
  return BigInt(Math.floor(Math.sqrt(raw) * Q96)).toString();
}

/** Human token1/token0 price → raw decimal string without exponent notation. */
export function rawPriceString(humanPrice: number, dec0: number, dec1: number) {
  const raw = humanPrice * 10 ** (dec1 - dec0);
  if (!Number.isFinite(raw) || raw <= 0) return '0';
  const digits = Math.min(80, Math.max(0, -Math.floor(Math.log10(raw)) + 18));
  return raw.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

export function fullRangeTicks(tickSpacing: number) {
  const max = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
  return { tickLower: -max, tickUpper: max };
}

/** v3 pools cannot hold native ETH; use the chain's wrapped token instead. */
export function forProtocol(token: TokenInfo, protocol: 'V3' | 'V4', tokens: TokenInfo[]) {
  if (protocol === 'V3' && token.address === NATIVE) return tokens.find((t) => t.symbol === 'WETH') ?? token;
  return token;
}
