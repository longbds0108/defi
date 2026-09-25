// Single source for brand, links and protocol parameters shown on the landing.
// Rename the protocol here; every section reads from this file.

export const BRAND = {
  name: 'Lumora',
  wordmark: 'LUMORA',
  tagline: 'The stablecoin yield and credit layer. One balance that earns and borrows.',
  network: 'Arc Testnet',
} as const;

export const LINKS = {
  docs: '#docs',
  github: 'https://github.com/',
  x: 'https://x.com/',
  discord: 'https://discord.com/',
} as const;

// Testnet defaults mirrored from the protocol spec (bps → %). These are design
// parameters, not live market data, and the UI labels them as such.
export const RISK_PARAMS = {
  maxLtv: 0.75,
  liquidationThreshold: 0.833,
  liquidationBonus: 0.05,
  closeFactor: 0.5,
  borrowAprUsdc: 0.04,
  borrowAprEurc: 0.05,
} as const;

export const REVENUE_SPLIT = [
  { label: 'Stakers', share: 65 },
  { label: 'Treasury', share: 15 },
  { label: 'Insurance', share: 10 },
  { label: 'Credit reserve', share: 10 },
] as const;

export const NAV = [
  { label: 'Markets', href: '#markets' },
  { label: 'Protocol', href: '#protocol' },
  { label: 'Risk', href: '#risk' },
  { label: 'FAQ', href: '#faq' },
] as const;

export const STACK = ['Foundry', 'OpenZeppelin', 'Solidity 0.8.24', 'viem', 'wagmi', 'RainbowKit', 'Vite'] as const;

export const FAQ_ITEMS = [
  {
    q: `What is ${BRAND.name}?`,
    a: `${BRAND.name} is a stablecoin staking and lending protocol on ${BRAND.network}. Stake USDC or EURC, earn vault rewards, and use active positions as collateral`,
  },
  {
    q: 'Can I borrow while my position is staked?',
    a: 'Yes. Eligible staked value supports a loan without closing the position, as long as the resulting Health Factor stays inside the safe range',
  },
  {
    q: 'What happens if my Health Factor drops below 1.00?',
    a: 'Part of the position becomes liquidatable. A liquidator repays some of the debt and receives the matching collateral plus a 5% bonus; the rest of your position and its earned rewards remain yours',
  },
  {
    q: 'Where does the yield come from?',
    a: 'Borrowers pay interest. Realized interest is reserved, then settled permissionlessly and split between stakers, the treasury, the insurance fund and a credit reserve',
  },
  {
    q: 'Is the EUR/USD price a live oracle feed?',
    a: `Not on ${BRAND.network}. The current EUR/USD value is a clearly labelled, owner-updated test feed with staleness and deviation checks, used until production-grade oracle coverage is available`,
  },
] as const;
