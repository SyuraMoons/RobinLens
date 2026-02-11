# RobinLens

> AI-Powered Trading Intelligence for RobinPump — See the Signal, Trade in One Click

![EasyA Consensus Hong Kong 2026](https://img.shields.io/badge/EasyA%20Consensus-Hong%20Kong%202026-blue)
![DeFi Track](https://img.shields.io/badge/Track-DeFi-green)
![Base Network](https://img.shields.io/badge/Network-Base-0052FF)

---

## 🎯 Problem

RobinPump is a bonding curve token launchpad on Base with 48+ live tokens, but traders face critical challenges:

- **Zero Filtering** — 50+ tokens with no quality signal
- **No Risk Assessment** — 73% of pump tokens dump within 24h
- **Blind Buying** — Decisions based on memes, not data
- **Slow Execution** — 3+ clicks from discovery to trade = missed entries

**The average retail trader loses 34% of capital in the first 30 days.**

---

## 💡 Solution

RobinLens combines real-time on-chain intelligence with instant execution:

| Step | Action | Time |
|------|--------|------|
| 1. **See** | Browse live token feed with price, volume, holders | 10s |
| 2. **Score** | AI assigns RobinScore (0-100) with risk flags | 2s |
| 3. **Trade** | One-click buy/sell on bonding curve | 3s |

---

## ✨ Key Features

### 🤖 AI-Powered Token Scoring
- **RobinScore 0-100** — Aggregated rating based on:
  - *Idea Quality* — Meme potential, narrative strength
  - *On-Chain Health* — Holder distribution, trading patterns
  - *Curve Position* — Entry timing, graduation probability

### 🚩 Risk Detection System
7-point risk flags: `WHALE_DOMINATED`, `CREATOR_SELLING`, `EARLY_EXIT`, `LOW_LIQUIDITY`, `COPYCAT`, `FAST_LAUNCH`, `STALE_VOLUME`

### ⚡ One-Click Trading
Execute buys/sells directly on the bonding curve with slippage protection and real-time quotes.

### 📊 PnL Tracking
Automatic position tracking with realized and unrealized gains.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite 7 + React 19 + TypeScript 5.9 |
| Styling | Tailwind CSS v4 |
| Charts | lightweight-charts v5 |
| Chain | ethers.js v6 (Base Mainnet) |
| Data | Goldsky Subgraph (GraphQL) |
| AI | OpenAI GPT-4o + Zod v4 |
| Deploy | Vercel |

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/yourname/RobinLens.git
cd RobinLens/frontend

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your VITE_OPENAI_API_KEY (optional)

# Run development server
pnpm dev
# Open http://localhost:5173
