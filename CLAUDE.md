# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RobinLens is an AI-powered DeFi token analysis and trading frontend for RobinPump (a bonding curve token launchpad on Base). Pure client-side React app with no backend — data comes from Goldsky Subgraph (GraphQL), OpenAI API, IPFS (Pinata), and direct Base mainnet RPC calls via ethers.js.

## Commands

All commands run from `frontend/`:

```bash
pnpm dev        # Vite dev server at http://localhost:5173
pnpm build      # tsc -b && vite build → frontend/dist/
pnpm lint       # eslint .
pnpm preview    # preview production build locally
```

Testing (vitest + happy-dom + @testing-library/react):
```bash
pnpm vitest                    # watch mode
pnpm vitest run                # single run
pnpm vitest run src/lib/format # run specific file
```

## Architecture

```
frontend/src/
├── pages/          3 route pages (TokenFeed, TokenDetail, Leaderboard)
├── components/     UI components (AnalysisCard, TradePanel, PriceChart, etc.)
├── hooks/          Data fetching & state (useCurves, useCurveDetail, useWallet, useTrade, useEthPrice)
├── lib/            Pure logic & API clients (no React imports)
```

**Data flow pattern:** Page → custom hook (polling via setInterval) → lib function (GraphQL/RPC call) → component props.

**State management:** React Context for wallet only (`WalletContext` in `useWallet.ts`). Everything else is local component state. No global store library.

**Routes** (defined in `App.tsx`):
- `/` — TokenFeed (token grid with filters/sorting)
- `/token/:id` — TokenDetail (analysis + chart + trading)
- `/leaderboard` — Top traders

### External Data Sources

| Source | Module | Purpose |
|--------|--------|---------|
| Goldsky Subgraph | `lib/goldsky.ts` | Token list, trades, positions, leaderboard (GraphQL) |
| OpenAI GPT-4o | `lib/analyzer.ts` | AI token scoring → validated by `lib/analysisSchema.ts` (Zod) |
| Pinata IPFS | `lib/metadata.ts` | Token name, description, image from URI |
| Base RPC | `lib/contracts.ts` | Price quotes, buy/sell execution via bonding curve contract |

Goldsky endpoint: `https://api.goldsky.com/api/public/project_cmjjrebt3mxpt01rm9yi04vqq/subgraphs/pump-charts/v2/gn`

### Key Design Decisions

- **OpenAI client runs in browser** (`dangerouslyAllowBrowser: true` in `analyzer.ts`). API key is exposed client-side via `VITE_OPENAI_API_KEY`.
- **Bonding curve ABI is reverse-engineered** (in `contracts.ts`), not from a verified source.
- **Polling intervals:** 10s for token list (`useCurves`), 5s for detail page (`useCurveDetail`).
- **Caching:** localStorage for wallet state & analysis results; in-memory Map for IPFS metadata.
- **Analysis fallback:** `lib/demoAnalysis.ts` provides hardcoded demo data when API key is missing.

## Styling

Tailwind CSS v4 with `@theme` variables in `index.css` (no `tailwind.config.js`). Dark theme only.

Custom tokens: `bg-primary/secondary/tertiary/card/hover`, `text-primary/secondary/muted`, `border/border-light`, semantic colors (`green`, `red`, `blue`, `yellow`).

Fonts: Space Grotesk (display), Inter (body), Fira Code (mono) — loaded via Google Fonts in `index.html`.

## Environment

```bash
cp frontend/.env.example frontend/.env
```

Variables (all prefixed `VITE_` for Vite client-side exposure):
- `VITE_OPENAI_API_KEY` — OpenAI key (optional; falls back to demo analysis)
- `VITE_OPENAI_BASE_URL` — defaults to `https://api.openai.com/v1`
- `VITE_OPENAI_MODEL` — defaults to `gpt-4o`

## Deployment

Vercel. SPA rewrite rule in `vercel.json`: all paths → `/index.html`.
