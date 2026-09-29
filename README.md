# Lumora — DeFi landing + app

Landing page and dapp for a stablecoin yield & credit protocol. Layout inspired by Synthra, visual system and motion from the Shiny protocol (via the `defi-dapp-builder` skill).

## Run

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in frontend/dist
```

## App (app.<domain>)

Sitemap: Landing → **Launch app** → Connect (Google via Privy, or wallet) → app

| Section | Pages |
|---|---|
| Trade | Swap · Bridge · Buy · Sell |
| Explore | Tokens · Transactions |
| Launches | Live / upcoming / ended token auctions |
| Pool | Create position · Launch auction |
| Portfolio | Overview · Tokens · Activity |

- Locally the app lives at `http://localhost:5173/app`. In production the same build serves the app when the hostname starts with `app.` — point both `<domain>` and `app.<domain>` at the Vercel project and set `VITE_APP_URL` / `VITE_SITE_URL`.
- Auth: copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_PRIVY_APP_ID` to enable Google sign-in. Without it, "Connect wallet" still works with browser wallets.
- Networks: Ethereum Sepolia, Base Sepolia, Unichain Sepolia and Arc Testnet (switch in the header). Token addresses in `frontend/src/dapp/chains.ts` were verified on-chain.

### Uniswap integration (per developers.uniswap.org)

| Feature | Source | Needs `UNISWAP_API_KEY` |
|---|---|---|
| Swap | Trading API: `check_approval` → `quote` → Permit2 signature → `swap` (or `order` for UniswapX) | yes |
| Bridge | Trading API cross-chain quote; `BRIDGE` → `swap`, `CHAINED` → `plan` step loop | yes |
| Create position | LP API: `pool_info` → `check_approval` (+ v4 batch permit) → `lp/create` | yes |
| Launches | Liquidity Launchpad CCA contracts, read on-chain (`AuctionCreated` logs), bid / exit / claim | no |
| Launch auction | UERC20 token factory (Sepolia, Arc) / USUPERC20 (Base Sepolia) → CCA factory `create` → fund → `onTokensReceived` | no |
| Portfolio | On-chain balances on all four networks; activity = transactions sent from this app | no |

- The API key stays **server-side**: the app calls `/api/uniswap/*`, served by the Vite dev proxy (`vite.config.ts`) locally and by `frontend/api/uniswap.ts` on Vercel. Put `UNISWAP_API_KEY=...` in `frontend/.env.local` (dev) and in the Vercel project env (prod).
- Without a key, or on Arc Testnet (not served by the Uniswap API), Swap/Bridge/Pool fall back to clearly labelled demo quotes.
- Still demo: Buy/Sell (fiat on/off-ramp is not part of Uniswap's APIs), Explore market data, and the liquidity-positions list (needs an indexer).

## Stack

Vite · React 19 · TypeScript · react-router · wagmi v2 + viem · Privy · framer-motion · GSAP ScrollTrigger · Lenis

## Where to change things

- Brand name, links, protocol parameters, FAQ: `frontend/src/config/site.ts`
- Sections: `frontend/src/components/sections/`
- Design tokens: `frontend/src/index.css`; component styles: `frontend/src/App.css`
- Text scramble tuning (`speed`, `REROLL_MS`, `WINDOW`): `frontend/src/components/TextScramble.tsx`

Numbers on the landing are testnet defaults, not live market data.

App code: `frontend/src/dapp/` — `auth/` (Privy or injected wallet), `pages/` (one folder per section), `components/` (header, UI kit, charts), `data/demo.ts`.

Deploy on Vercel with root directory `frontend` (SPA rewrite in `frontend/vercel.json`).
