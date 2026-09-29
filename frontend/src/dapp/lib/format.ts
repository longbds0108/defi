const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

export function formatUsd(value: number) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1_000_000) return `$${compact.format(value)}`;
  if (Math.abs(value) >= 1_000) return usd0.format(value);
  return usd2.format(value);
}

export function formatPrice(value: number) {
  if (value >= 1_000) return usd2.format(value);
  if (value >= 1) return `$${value.toFixed(value >= 100 ? 2 : 4).replace(/0+$/, '').replace(/\.$/, '')}`;
  return `$${value.toPrecision(4)}`;
}

export function formatAmount(value: number, max = 6) {
  if (!Number.isFinite(value) || value === 0) return '0';
  // Tiny values (e.g. auction prices) keep 3 significant digits instead of rounding to 0.
  if (Math.abs(value) < 10 ** -max) return value.toPrecision(3);
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : max;
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatPct(value: number, signed = true) {
  const text = `${Math.abs(value).toFixed(2)}%`;
  if (!signed) return text;
  return value >= 0 ? `+${text}` : `−${text}`;
}

export function shortAddress(address?: string) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';
}

export function timeAgo(minutes: number) {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatDuration(hours: number) {
  if (hours <= 0) return 'Ended';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days}d ${rest}h` : `${days}d`;
}

/** Keep numeric input text sane: digits and one dot, capped decimals. */
export function sanitizeAmount(raw: string, decimals = 6) {
  const cleaned = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join('').slice(0, decimals)}`;
}
