# RobinLens

> AI-Powered DeFi Token Analysis and Trading Platform for RobinPump on Base

![EasyA Consensus Hong Kong 2026](https://img.shields.io/badge/EasyA%20Consensus-Hong%20Kong%202026-blue)
![DeFi Track](https://img.shields.io/badge/Track-DeFi-green)
![Base Network](https://img.shields.io/badge/Network-Base-0052FF)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636)

---

## What is RobinLens?

RobinLens brings AI-driven signal detection to the RobinPump bonding curve ecosystem on Base. It scores tokens across idea quality, on-chain health, and curve position so traders can act on data rather than hype.

**Core capabilities:**

- **Token Feed** -- Live discovery of all RobinPump tokens with sorting, filtering, and search
- **AI Scoring** -- GPT-4o evaluates each token on a 0-100 RobinScore with risk flags and a one-line verdict
- **Batch Recommendations** -- AI ranks the top 10 tokens from configurable data sources (on-chain + technical)
- **Trading** -- Buy and sell directly through smart contract routing with slippage protection
- **Analytics** -- Price charts, trade history, holder distribution, and trader leaderboard

---

## Architecture

```
Browser-only (no backend)
=========================

  Goldsky Subgraph -----> React Frontend <----- OpenAI GPT-4o
       (GraphQL)          (TypeScript)           (AI Analysis)
                               |
                               v
                     MetaMask + Base RPC
                               |
                               v
                     Smart Contracts (Base)
                     - RobinLensRouter
                     - Bonding Curves
```

All logic runs client-side. Data comes from four sources:

| Source | Purpose |
|--------|---------|
| Goldsky Subgraph | Token list, trades, positions, leaderboard (GraphQL) |
| OpenAI GPT-4o | Token scoring and batch recommendations |
| Pinata IPFS | Token metadata (name, description, image) |
| Base RPC | Price quotes, trade execution via bonding curve contracts |

---

## Smart Contracts

### RobinLensRouter

Trade router with slippage protection, deadline validation, and batch trading for AI recommendations.

| Function | Description |
|----------|-------------|
| `buyToken(curve, minTokensOut, deadline)` | Buy tokens with slippage protection |
| `sellToken(curve, token, amount, minEthOut, deadline)` | Sell tokens back to curve |
| `multiBuy(curves[], ethAmounts[], minTokensOut[], deadline)` | Batch buy from AI recommendations |
| `quoteBuy(curve, ethAmount)` | Get buy price quote |
| `isTradingActive(curve)` | Check if trading is open |

### Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| RobinLensRouter | [`0xde8daf9599366b2ef8ae245bf574808844aa5f8a`](https://sepolia.basescan.org/address/0xde8daf9599366b2ef8ae245bf574808844aa5f8a) |
| MockBondingCurve (EHACK) | [`0xa394976a7eff56209c8299df651aad770cfdbc00`](https://sepolia.basescan.org/address/0xa394976a7eff56209c8299df651aad770cfdbc00) |
| MockBondingCurve (ROBIN) | [`0x80db4a46bee029464aa1fca083985d1c5178afd6`](https://sepolia.basescan.org/address/0x80db4a46bee029464aa1fca083985d1c5178afd6) |
| StartupToken (EHACK) | [`0xc3e886f59c544775d2cb0b465e7d3351c462239c`](https://sepolia.basescan.org/address/0xc3e886f59c544775d2cb0b465e7d3351c462239c) |
| StartupToken (ROBIN) | [`0x06f4401cf289bfc29de59fc1b624096dc69ff25b`](https://sepolia.basescan.org/address/0x06f4401cf289bfc29de59fc1b624096dc69ff25b) |

---

## Pages

### Token Feed (`/`)

Live grid of all RobinPump tokens. Sort by volume, recency, price, or trade count. Filter by active or graduated status. Real-time ETH price ticker.

### Token Detail (`/token/:id`)

Deep dive into a single token:
- Price chart (Lightweight Charts)
- Trade feed with BaseScan links
- Bonding curve progress (4.2 ETH graduation threshold)
- Buy/sell panel with slippage control
- AI analysis card (RobinScore, risk flags, verdict)
- Top 10 holder distribution

### AI Recommendations (`/recommendations`)

Batch analysis of the top tokens. Toggle data sources (on-chain metrics, technical indicators), click Analyze, and get a ranked list of 10 recommendations with scores, reasoning, and suggested actions.

### Leaderboard (`/leaderboard`)

Top 50 traders ranked by realized PnL across all positions.

---

## Tech Stack

### Frontend

| Package | Version |
|---------|---------|
| React | 19.2.0 |
| TypeScript | 5.9.3 |
| Vite | 7.3.1 |
| ethers.js | 6.16.0 |
| OpenAI SDK | 6.19.0 |
| Tailwind CSS | 4.1.18 |
| Lightweight Charts | 5.1.0 |
| Zod | 4.3.6 |
| React Router DOM | 7.13.0 |

### Smart Contracts

| Tool | Version |
|------|---------|
| Solidity | 0.8.24 |
| Foundry | Latest |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- MetaMask browser extension

### Setup

```bash
git clone https://github.com/SyuraMoons/RobinLens.git
cd RobinLens/frontend
cp .env.example .env
```

Edit `.env`:

```bash
# Optional: OpenAI key for AI analysis (falls back to demo data without it)
VITE_OPENAI_API_KEY=your-key-here

# Chain: "sepolia" for testnet, omit for mainnet
VITE_CHAIN=sepolia

# Router address (trades go through router when set)
VITE_ROUTER_ADDRESS=0xde8daf9599366b2ef8ae245bf574808844aa5f8a
```

### Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173

### Build

```bash
pnpm build    # TypeScript check + Vite production build
pnpm preview  # Preview production build locally
```

### Test

```bash
pnpm vitest        # Watch mode
pnpm vitest run    # Single run
```

### Smart Contract Tests

```bash
cd smartcontract
forge test -vvv
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_OPENAI_API_KEY` | (none) | OpenAI API key. Falls back to demo analysis if unset |
| `VITE_OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI endpoint |
| `VITE_OPENAI_MODEL` | `gpt-4o` | Model for analysis |
| `VITE_CHAIN` | `mainnet` | `sepolia` for Base Sepolia testnet |
| `VITE_ROUTER_ADDRESS` | (none) | RobinLensRouter address. Direct curve calls when unset |

---

## Deployment

Deployed on Vercel with SPA rewrite (`vercel.json`). All routes serve `index.html`.

```bash
pnpm build  # Output: frontend/dist/
```

---

## Project Structure

```
frontend/src/
  pages/           TokenFeed, TokenDetail, Leaderboard, Recommendations
  components/      13 UI components (TradePanel, AnalysisCard, PriceChart, ...)
  hooks/           7 custom hooks (useCurves, useTrade, useWallet, ...)
  lib/             14 modules (goldsky, analyzer, recommender, contracts, ...)

smartcontract/src/
  RobinLensRouter.sol       Trade router with batch buy
  MockBondingCurve.sol      Testnet bonding curve
  StartupToken.sol          ERC20 token for testing
  interfaces/
    IRobinPumpCurve.sol     Bonding curve interface
```

---

## Team

Built at EasyA Consensus Hong Kong 2026 by Team PI (SyuraMoons).

---

## License

MIT
