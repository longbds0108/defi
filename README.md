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
- Data: swap quotes, prices, pools, launches and history are **demo data** (`frontend/src/dapp/data/demo.ts`) and every screen shows a "Demo data" badge. The native USDC balance on Arc Testnet in Portfolio → Tokens is read on-chain. Submitting a flow shows a toast; no transaction is sent until contracts exist.

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
