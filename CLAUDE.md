# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RobinLens is an AI-powered DeFi token analysis and trading frontend for RobinPump (a bonding curve token launchpad on Base). Pure client-side React app with no backend -- data comes from Goldsky Subgraph (GraphQL), OpenAI API, IPFS (Pinata), and direct Base RPC calls via ethers.js.

## Commands

All commands run from `frontend/`:

```bash
pnpm dev        # Vite dev server at http://localhost:5173
pnpm build      # tsc -b && vite build -> frontend/dist/
pnpm lint       # eslint .
pnpm preview    # preview production build locally
```

Testing (vitest + happy-dom + @testing-library/react):
```bash
pnpm vitest                    # watch mode
pnpm vitest run                # single run
pnpm vitest run src/lib/format # run specific file
```

Smart contracts (Foundry, from `smartcontract/`):
```bash
forge build
forge test -vvv
```

## Architecture

```
frontend/src/
├── pages/          4 route pages (TokenFeed, TokenDetail, Leaderboard, Recommendations)
├── components/     UI components (AnalysisCard, TradePanel, PriceChart, FloatingChatWidget, etc.)
├── hooks/          Data fetching & state (useCurves, useCurveDetail, useWallet, useTrade, useRecommendations, etc.)
├── lib/            Pure logic & API clients (React context split between sectionContext.ts and SectionContextProvider.tsx)

smartcontract/src/
├── RobinLensRouter.sol    Trade router with slippage + batch buy
├── MockBondingCurve.sol   Testnet bonding curve
├── StartupToken.sol       ERC20 for testing
├── interfaces/            IRobinPumpCurve.sol
```

**Data flow pattern:** Page -> custom hook (polling via setInterval or one-shot) -> lib function (GraphQL/RPC call) -> component props.

**State management:** React Context for wallet only (`WalletContext` in `useWallet.ts`). Everything else is local component state. No global store library.

**Routes** (defined in `App.tsx`):
- `/` -- TokenFeed (token grid with filters/sorting)
- `/token/:id` -- TokenDetail (analysis + chart + trading)
- `/leaderboard` -- Top traders
- `/recommendations` -- AI batch recommendations with configurable data sources

### External Data Sources

| Source | Module | Purpose |
|--------|--------|---------|
| Goldsky Subgraph | `lib/goldsky.ts` | Token list, trades, positions, leaderboard (GraphQL) |
| OpenAI GPT-4o | `lib/analyzer.ts` | Single-token AI scoring, validated by `lib/analysisSchema.ts` (Zod) |
| OpenAI GPT-4o | `lib/recommender.ts` | Batch top-10 recommendations, validated by `lib/recommendationSchema.ts` (Zod) |
| OpenAI GPT-4o | `lib/supportAssistant.ts` | Floating chat widget (context-aware support agent) |
| Pinata IPFS | `lib/metadata.ts` | Token name, description, image from URI |
| Base RPC | `lib/contracts.ts` | Price quotes, buy/sell execution via bonding curve or RobinLensRouter |

### CORS Proxy Pattern

Both Goldsky and OpenAI calls go through `/api/subgraph` and `/api/openai` paths. In dev, Vite proxies these (see `vite.config.ts`). In production, Vercel rewrites handle the same paths (see `frontend/vercel.json`). The OpenAI proxy routes through `newapi.deepwisdom.ai`, not directly to OpenAI.

### Key Design Decisions

- **OpenAI client runs in browser** (`dangerouslyAllowBrowser: true`). API key exposed client-side via `VITE_OPENAI_API_KEY`. Both `analyzer.ts` and `recommender.ts` point `baseURL` at `/api/openai` to hit the proxy.
- **Bonding curve ABI is reverse-engineered** (in `contracts.ts`), not from a verified source.
- **RobinLensRouter** (`contracts.ts`): When `VITE_ROUTER_ADDRESS` is set, trades route through the router contract (adds slippage protection and batch buy). Otherwise falls back to direct curve calls.
- **Chain switching:** `lib/chains.ts` exports `ACTIVE_CHAIN` based on `VITE_CHAIN` env var. Set to `sepolia` for testnet.
- **Polling intervals:** 10s for token list (`useCurves`), 5s for detail page (`useCurveDetail`). Recommendations use one-shot trigger (not polling) with 60s cooldown.
- **Caching:** localStorage for wallet state, analysis results (15min TTL), recommendation results (15min TTL), and toggle state. In-memory Map for IPFS metadata.
- **Analysis fallback:** `lib/demoAnalysis.ts` and `lib/demoRecommendation.ts` provide hardcoded demo data when API key is missing.
- **Zod v4:** Schemas use `import { z } from 'zod/v4'` (not `zod`). Follow this import path for new schemas.
- **Recommendations pre-filter:** `recommender.ts` computes a composite score across all tokens, takes top 20, then sends a single GPT-4o call returning top 10.

## Styling

Tailwind CSS v4 with `@theme` variables in `index.css` (no `tailwind.config.js`). Dark theme only.

Custom tokens: `bg-primary/secondary/tertiary/card/hover`, `text-primary/secondary/muted`, `border/border-light`, semantic colors (`green`, `red`, `blue`, `yellow`).

Fonts: Space Grotesk (display), Inter (body), Fira Code (mono) -- loaded via Google Fonts in `index.html`.

## Environment

```bash
cp frontend/.env.example frontend/.env
```

Variables (all prefixed `VITE_` for Vite client-side exposure):
- `VITE_OPENAI_API_KEY` -- OpenAI key (optional; falls back to demo analysis)
- `VITE_OPENAI_MODEL` -- defaults to `gpt-4o`
- `VITE_CHAIN` -- `sepolia` for Base Sepolia testnet, omit for mainnet
- `VITE_ROUTER_ADDRESS` -- RobinLensRouter contract address (direct curve calls when unset)
- `VITE_COINGECKO_API_KEY` -- optional key for market data source in recommendations
- `VITE_COINGECKO_BASE_URL` -- optional CoinGecko endpoint override
- `VITE_COINGECKO_PROXY` -- optional production proxy for market data requests
- `VITE_NEWS_API_KEY` -- optional key for news data source in recommendations
- `VITE_NEWS_API_PROXY` -- optional production proxy for news data requests

## Deployment

Vercel. `frontend/vercel.json` has rewrites: `/api/subgraph` -> Goldsky, `/api/openai/*` -> deepwisdom.ai, and SPA fallback `(.*)` -> `/index.html`.
