# AGENTS.md — Lumora DeFi (landing + dapp)

Instructions for any AI coding agent (Claude, Codex, Cursor, Copilot, Gemini…) working in this repo.
Read this whole file before changing code. When a request conflicts with a rule here, stop and ask the owner.

## 1. What this is

- **Lumora**: marketing landing page + DeFi web app, one Vite project in `frontend/`.
- Landing at `/`; app at `/app/*` locally, or at the root of `app.<domain>` in production (detected by hostname in `src/Root.tsx`).
- App sections follow the owner's sitemap and must keep this structure:
  - **Trade**: Swap · Bridge · Buy · Sell
  - **Explore**: Tokens · Transactions
  - **Launches**
  - **Pool**: Create position · Launch auction
  - **Portfolio**: Overview · Tokens · Activity
  - **Connect**: Google (Privy) or wallet. The connect gate is **off** for now (`REQUIRE_CONNECT = false` in `src/dapp/DappApp.tsx`).
- Networks (all testnets): Ethereum Sepolia, Base Sepolia, Unichain Sepolia, Arc Testnet, Robinhood Chain Testnet.

## 2. Commands (run inside `frontend/`)

```bash
npm install
npm run dev        # http://localhost:5173 (landing) and /app (dapp)
npx tsc -b         # type-check — must pass
npm run lint       # oxlint — must have 0 errors (existing warnings are known)
npm run build      # must pass
```

Environment (`frontend/.env.local`, never committed; see `.env.example`):

| Variable | Where it is read | Purpose |
|---|---|---|
| `UNISWAP_API_KEY` | **server only** (Vite proxy, `api/uniswap.ts`) | Uniswap Trading + LP API |
| `VITE_PRIVY_APP_ID` | client | Google sign-in + Privy wallet modal |
| `VITE_APP_URL`, `VITE_SITE_URL` | client | production landing ↔ app links |

## 3. Repo map

```
frontend/
  api/uniswap.ts            Vercel Edge proxy → server/uniswapProxy.ts
  server/uniswapProxy.ts    shared proxy: allowlist + x-api-key (dev + prod)
  vite.config.ts            dev middleware for /api/uniswap
  vercel.json               /api/uniswap rewrite + SPA fallback
  public/tokens, public/chains   official logos (see §6)
  src/
    Root.tsx                landing vs app routing, shared route curtain
    Landing.tsx, App.css, components/, config/site.ts   ← landing only
    index.css               design tokens + styles shared by landing and app
    dapp/
      DappApp.tsx           providers + routes (AuthProvider → ChainProvider → ToastProvider)
      chains.ts             SINGLE SOURCE for networks, tokens, feature flags, Launchpad addresses
      auth/AuthProvider.tsx Privy when VITE_PRIVY_APP_ID is set, else wagmi injected wallet
      state/chain.tsx       selected chain, ensureChain(), wrong-network detection
      state/activity.ts     local log of transactions sent from the app
      uniswap/api.ts        typed client for /api/uniswap (Trading + LP API)
      cca/                  Continuous Clearing Auction ABI, Q96 math, discovery hooks
      hooks/useFlow.ts      multi-step tx runner (simulate → send → wait → record)
      hooks/useBalances.ts  on-chain balances (native + ERC-20 multicall)
      lib/tx.ts             API tx validation, typed-data conversion, error text
      lib/lpMath.ts         v3/v4 price ↔ sqrtPriceX96 ↔ ticks
      lib/format.ts         all number/time formatting
      components/ui.tsx     UI kit (TokenMark, Modal, TokenPicker, charts, toasts…)
      components/chainUi.tsx ChainSelect, ChainDot, FlowSteps, SourceBadge…
      data/demo.ts          demo data — ONLY for screens without a real source
      pages/…               one folder per sitemap section
      dapp.css              app styles
```

## 4. Where each feature's data comes from

| Feature | Real source | Needs API key | Fallback |
|---|---|---|---|
| Swap | Uniswap Trading API: `check_approval` → `quote` → Permit2 sign → `swap` (or `order` for UniswapX) | yes | labelled demo quote |
| Bridge | Trading API cross-chain quote; `BRIDGE` → `swap`, `CHAINED` → `/plan` step loop | yes | labelled demo |
| Create position | LP API: `pool_info` → `check_approval` (+ v4 batch permit) → `lp/create` | yes | labelled demo |
| Launches | CCA contracts on-chain (`AuctionCreated` logs + reads), bid / exit / claim | no | — |
| Launch auction | UERC20/USUPERC20 factory → CCA factory `create` → fund → `onTokensReceived` | no | — |
| Portfolio balances | on-chain, all networks | no | — |
| Activity | `state/activity.ts` (tx sent from this app, per device) | no | — |
| Explore, Buy, Sell, LP positions list | **demo** (`data/demo.ts`) | — | shown with "Demo" badge |

Uniswap API does **not** serve Arc Testnet or Robinhood Chain Testnet (`uniswapApi: false`), so Swap/Bridge/Pool are demo there; CCA works on all five networks.

## 5. Non-negotiable rules

**Secrets**
1. The Uniswap API key never reaches the browser. No `VITE_` prefix, no client `fetch` to `trade-api.gateway.uniswap.org` or `liquidity.api.uniswap.org`. Call `/api/uniswap/...` through `uniswap/api.ts`. A new endpoint must be added to the allowlist in `server/uniswapProxy.ts`.
2. Never commit `.env*` files (except `.env.example`), private keys or API keys.

**Honest data**
3. Never show demo or estimated numbers as real. Use `SourceBadge` / `DemoBadge`, and fall back to demo only when the live source is unavailable (no key, unsupported chain).
4. Do not invent contract addresses. Before adding a token or contract, verify it **on-chain** (ERC-20 `symbol` + `decimals`, `eth_getCode` for contracts) and cite the official source in a comment. If there is no official source (e.g. USDC on Robinhood testnet), leave it out.
5. User-created tokens (Launches) must use `TokenMark` with `plain` so a reused symbol cannot borrow an official logo.

**On-chain actions**
6. Every write goes through `useFlow()`: `flow.contract()` (simulates first) or `flow.tx()` for API-built transactions. Both wait for the receipt and record activity. Show progress with `<FlowSteps>`.
7. Convert Uniswap API transactions with `toSendParams()` (validates, never modifies `data`). Sign permit data with `toTypedData()`. Refresh a quote before executing (quotes older than 30 s are stale).
8. Call `ensureChain(chainId)` before signing. Feature availability comes from `chains.ts` flags (`uniswapApi`, `tokenFactory`, `logRange`), never from hard-coded chain IDs in pages.
9. Amounts are `bigint` in base units (`parseUnits` / `formatUnits`). Floats are only for display. All display formatting uses `lib/format.ts`.

**Stack**
10. Keep **wagmi v2** (Privy's adapter breaks on v3), viem, react-query, react-router 7, framer-motion. Keep the `@solana/*` packages: Privy's build needs them.
11. No new UI framework (no Tailwind, MUI, shadcn, chakra). Style with plain CSS in `dapp.css` (app), `App.css` (landing) or `index.css` (shared), using the tokens below.
12. Add no dependency without a clear reason stated in the commit message.

## 6. Design system (keep the look consistent)

- Tokens live in `src/index.css`: dark `--color-bg #07060a`, violet accent `--color-accent #9B5DE5`, blue `#3F91FF`, status colours `--color-safe/warning/danger` used **only** for state.
- Fonts: Inter Tight (UI), Fraunces italic for `<em>` accents in headings, JetBrains Mono for numbers, labels and kickers (uppercase, wide letter-spacing).
- App surfaces: glass panels (`.panel`), pill buttons, `.cta` primary button, rounded 16–26 px. The landing pairs the Synthra layout with Shiny effects: text scramble, ASCII glyph fields, sticky rails, route curtain.
- Logos: tokens from the Uniswap default token list (tokens.uniswap.org) and networks from the `Uniswap/interface` repo, **downloaded into `public/`**, never hot-linked. Map them in `TOKEN_LOGOS` (`components/ui.tsx`) and set `logo` in `chains.ts`.
- Responsive breakpoints: 1100 / 900 / 680 px. Test at 1440 px and 390 px wide. No horizontal page scroll.
- Respect `prefers-reduced-motion` for every new animation.
- UI copy is in **English**. Talk to the owner in Vietnamese.

## 7. Recipes

**Add a network**: add an entry to `CHAINS` in `chains.ts` (viem chain, RPCs that allow `eth_getLogs`, `blockTimeSec`, `uniswapApi`, verified tokens, `tokenFactory` if deployed, `logRange` for fast chains, logo in `public/chains`). Verify the CCA factory, Permit2 and token factory with `eth_getCode`. Everything else (wagmi transports, Privy, selector, portfolio) picks it up automatically.

**Add a token**: verify on-chain, add it to that chain's `tokens`, and add a logo to `public/tokens` + `TOKEN_LOGOS` if it is an official asset.

**Add a page**: create it under `pages/<section>/`, register the route in `DappApp.tsx`, add it to `NAV` in `components/AppHeader.tsx` (and to `SubNav` / `TradeLayout` if it is a sub-tab).

**Call a new Uniswap endpoint**: allowlist it in `server/uniswapProxy.ts`, add a typed method in `uniswap/api.ts` that follows the schema at https://trade-api.gateway.uniswap.org/v1/api.json, and map error codes in `friendlyError`.

## 8. Definition of done (every change)

1. `npx tsc -b`, `npm run lint` (0 errors) and `npm run build` all pass.
2. Run the dev server and open every touched page at 1440 px and 390 px wide. Browser console has no errors.
3. Demo vs live labelling is still correct. No secret appears in client code.
4. `README.md` (feature table / networks) is updated if behaviour changed.
5. Small, focused commits with a clear message. Do not rewrite history on `main`.
6. Report honestly what was verified and what was not (e.g. "not tested with a real API key / funded wallet").

## 9. Roadmap (next work, in priority order)

1. Test live flows with a real `UNISWAP_API_KEY` and a funded testnet wallet (Swap, Create position, CCA bid, Launch auction), then fix what breaks.
2. Enable Google sign-in: set `VITE_PRIVY_APP_ID`, test both login paths, then consider `REQUIRE_CONNECT = true`.
3. Real LP positions list (Uniswap Data API or subgraph) in Pool and Portfolio, replacing `DEMO_POSITIONS`.
4. Real Explore data (token prices/volume, recent swaps).
5. CCA: `exitPartiallyFilledBid` with checkpoint hints. Optional pool seeding through `LiquidityLauncher` + LBP strategy.
6. Buy/Sell via a real on-ramp provider (Privy funding, MoonPay, Stripe…).
7. Code-split the Privy bundle (~386 KB gzip) and clear existing lint warnings.
8. Add unit tests for `cca/math.ts`, `lib/lpMath.ts` and `lib/tx.ts`.

## 10. References

- Uniswap docs: https://developers.uniswap.org/docs (LLM index: https://developers.uniswap.org/llms.txt)
- Trading API OpenAPI: https://trade-api.gateway.uniswap.org/v1/api.json · supported chains: https://developers.uniswap.org/docs/trading/swapping-api/supported-chains
- Liquidity Launchpad / CCA: https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/overview · contracts: https://github.com/Uniswap/continuous-clearing-auction (tag v2.1.0)
- Robinhood Chain: https://docs.robinhood.com/chain/connecting
- Design origin: Shiny protocol (skill `defi-dapp-builder`) + https://synthra.org layout.
