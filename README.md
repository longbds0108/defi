# Lumora — DeFi landing

Landing page for a stablecoin yield & credit protocol. Layout inspired by Synthra, visual system and motion from the Shiny protocol (via the `defi-dapp-builder` skill).

## Run

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in frontend/dist
```

## Stack

Vite · React 19 · TypeScript · framer-motion · GSAP ScrollTrigger · Lenis

## Where to change things

- Brand name, links, protocol parameters, FAQ: `frontend/src/config/site.ts`
- Sections: `frontend/src/components/sections/`
- Design tokens: `frontend/src/index.css`; component styles: `frontend/src/App.css`
- Text scramble tuning (`speed`, `REROLL_MS`, `WINDOW`): `frontend/src/components/TextScramble.tsx`

Numbers shown on the page are testnet defaults, not live market data. "Launch app" shows a notice until an app route is wired in `App.tsx`.

Deploy on Vercel with root directory `frontend` (SPA rewrite in `frontend/vercel.json`).
