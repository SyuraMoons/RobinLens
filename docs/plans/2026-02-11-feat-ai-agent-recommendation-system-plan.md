---
title: "feat: AI Agent Configurable Recommendation System"
type: feat
date: 2026-02-11
---

# AI Agent Configurable Recommendation System

## Overview

Add a `/recommendations` page where users toggle data sources (On-Chain / Technical), click "Analyze", and the system pre-filters the Top 20 tokens and sends them to GPT-4o in a single call. Returns Top 10 recommendations, each with a score, reasoning, contributing data sources, and risk level.

## Problem Statement

Currently RobinLens only supports single-token analysis (user navigates to `/token/:id` and manually triggers AI analysis). There is no way to get a batch overview of "which tokens are worth watching right now" without clicking through each one individually. The platform lacks batch screening and comparative recommendation capabilities.

## Proposed Solution

### Data Source Architecture

```
User Toggle Switches
  |-- On-Chain (Goldsky subgraph) <- existing
  |     Holder distribution, volume, curve progress, creator activity
  |-- Technical (computed from existing price/trade data) <- new computation
        Price momentum, trade velocity, buy/sell ratio, trend direction

         | enabled sources
         v

  Client-side pre-filter Top 20 (sorted by on-chain metric composite score)
         |
         v

  AI Agent Orchestrator
  (dynamically assembles prompt, includes only enabled data sources)
         |
         v

  GPT-4o (single call, response_format: json_object)
         | Zod validation
         v

  Top 10 Recommendation List
  - RobinScore (0-100)
  - Recommendation reasoning
  - Which data sources were used
  - Suggested action + risk level
```

### MVP Scope

**Included:**
- On-Chain data source (reuses existing Goldsky queries + metrics computation)
- Technical data source (computes momentum/trend from existing trade data)
- New `/recommendations` page + route + navbar entry
- Data source toggle panel
- AI Orchestrator (dynamic prompt + Zod validation)
- Result caching (localStorage, 15-minute expiry)
- 60-second cooldown to prevent abuse

**Excluded (future iterations):**
- News data source (requires Vercel serverless proxy to solve CORS + CryptoPanic has poor coverage for small-cap tokens)
- Social data source (requires Twitter/Farcaster API)
- User-customizable weights/preferences

## Technical Approach

### New Files

#### `frontend/src/lib/recommendationSchema.ts`

Zod v4 schema defining the AI recommendation output format:

```typescript
// Single recommendation
const TokenRecommendationSchema = z.object({
  curveId: z.string(),
  name: z.string(),
  symbol: z.string(),
  robinScore: z.number().min(0).max(100),
  explanation: z.string(),
  contributingSources: z.array(z.enum(['on_chain', 'technical'])),
  suggestedAction: z.enum(['strong_buy', 'buy', 'hold', 'avoid']),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.object({
    onChain: z.string().optional(),
    technical: z.string().optional(),
  }),
})

// Full recommendation response
const RecommendationResponseSchema = z.object({
  recommendations: z.array(TokenRecommendationSchema).max(10),
  marketSummary: z.string(),
  analysisTimestamp: z.string(),
})
```

#### `frontend/src/lib/recommender.ts`

AI Orchestrator core logic, following the three-phase pattern from `analyzer.ts`:

1. **Data collection**: Based on enabled sources, fetch token list + trade data from Goldsky, compute metrics
2. **Client-side pre-filter**: Sort by composite score (trade count + holder count + momentum), take Top 20
3. **Prompt assembly**: Dynamically build system prompt and user prompt based on enabled sources
4. **LLM call**: Single GPT-4o call, `temperature: 0.3`, `response_format: json_object`
5. **Zod validation**: `RecommendationResponseSchema.parse()` validates AI output

Key function signature:
```typescript
type DataSource = 'on_chain' | 'technical'

interface RecommendationConfig {
  enabledSources: DataSource[]
}

export async function getRecommendations(
  config: RecommendationConfig
): Promise<RecommendationResponse>
```

Dynamic prompt adaptation logic:
- On-Chain only enabled: prompt focuses on holder distribution, trade activity, curve progress analysis
- Technical only enabled: prompt focuses on price momentum, trend direction, buy/sell ratio
- Both enabled: prompt covers comprehensive analysis, AI explains each dimension's contribution in reasoning

#### `frontend/src/lib/technicalMetrics.ts`

Computes technical indicators from existing trade data:

```typescript
interface TechnicalMetrics {
  priceChange1h: number      // Price change percentage over last 1 hour
  priceChange24h: number     // Price change percentage over last 24 hours
  tradeVelocity: number      // Last 1h trade count / average hourly trade count
  buySellRatio: number       // Reuses existing calculation from metrics.ts
  volumeMomentum: number     // Reuses existing calculation from metrics.ts
  trendDirection: 'up' | 'down' | 'flat'  // Price trend based on last N trades
}
```

Note: No traditional support/resistance analysis. Most RobinPump tokens have too short a history (hours to days) for meaningful technical analysis. MVP only includes simple momentum and trend indicators.

#### `frontend/src/hooks/useRecommendations.ts`

Follows the Leaderboard's one-shot loading pattern (no polling), since recommendations are user-triggered:

```typescript
interface UseRecommendationsReturn {
  recommendations: RecommendationResponse | null
  loading: boolean
  error: string | null
  analyze: (config: RecommendationConfig) => Promise<void>
  cachedAt: number | null  // Cache timestamp
}
```

- On page load, checks localStorage cache (key: `robinlens:recommendations`)
- Cache valid for 15 minutes, shows "Analysis from X min ago" indicator
- `analyze()` function triggers the full pipeline, with 60-second cooldown

#### `frontend/src/pages/Recommendations.tsx`

Page layout:

```
+---------------------------------------------+
| Navbar (+ "Recommendations" nav item)        |
+---------------------------------------------+
| Data Source Configuration Panel              |
| +----------+ +----------+                    |
| | On-Chain | |Technical |                    |
| |  [ON]    | |  [ON]    |                    |
| +----------+ +----------+                    |
|                                              |
| [Analyze] button                             |
| (at least one source required, 60s cooldown) |
+---------------------------------------------+
| Loading state (multi-step progress)          |
| "Fetching on-chain data..."                  |
| "Computing technical metrics..."             |
| "Running AI analysis..."                     |
+---------------------------------------------+
| Market Summary (marketSummary)               |
+---------------------------------------------+
| Top 10 Recommendation Card Grid              |
| +--------------+ +--------------+            |
| | #1 TokenName | | #2 TokenName |            |
| | Score: 78    | | Score: 72    |            |
| | [On-Chain]   | | [On-Chain]   |            |
| | [Technical]  | | [Technical]  |            |
| | Reasoning... | | Reasoning... |            |
| | Action: Buy  | | Action: Hold |            |
| | Risk: Medium | | Risk: High   |            |
| +--------------+ +--------------+            |
| ...                                          |
+---------------------------------------------+
| Not financial advice                         |
+---------------------------------------------+
```

#### `frontend/src/components/RecommendationCard.tsx`

Single recommendation display card:
- Rank number + token name/symbol
- RobinScore badge (reuses `ScoreBadge` component)
- Data source tags (shows which sources contributed to this recommendation)
- Recommendation reasoning text
- suggestedAction badge (strong_buy/buy/hold/avoid)
- riskLevel indicator
- Click navigates to `/token/:id`

#### `frontend/src/components/SourceToggle.tsx`

Data source toggle component:
- Toggle switch on/off state
- Source name + short description
- Disabled state styling (when source is unavailable)

### Modified Files

| File | Changes |
|------|---------|
| `App.tsx` | Add `<Route path="/recommendations" element={<Recommendations />} />` |
| `components/Navbar.tsx` | Add entry to NAV_ITEMS array: `{ path: '/recommendations', label: 'Recommendations' }` |
| `.env.example` | No changes needed (MVP does not use CryptoPanic) |

### Pre-filter Scoring Formula

Client-side pre-filter Top 20 composite score (no AI needed, pure numerical sort):

```
preFilterScore =
  normalize(tradeCount) * 0.3 +
  normalize(holderCount) * 0.25 +
  normalize(volumeMomentum) * 0.25 +
  normalize(1 - top10Concentration) * 0.2
```

Where `normalize()` is min-max normalization to [0, 1]. Excludes graduated tokens (already left the curve).

## Acceptance Criteria

### Functional

- [ ] `/recommendations` page is accessible, navbar has entry point
- [ ] Page has On-Chain and Technical toggle switches, both enabled by default
- [ ] Analyze button disabled when all sources are off, shows "enable at least one" hint
- [ ] Clicking Analyze shows multi-step loading progress
- [ ] Returns Top 10 recommendation list, each with score, reasoning, source tags, action, risk level
- [ ] Recommendation cards are clickable, navigating to `/token/:id`
- [ ] When only On-Chain is enabled, prompt and results only involve on-chain data
- [ ] When only Technical is enabled, prompt and results only involve technical indicators
- [ ] Results cached for 15 minutes, restored on page refresh/navigation
- [ ] 60-second cooldown prevents consecutive calls
- [ ] Shows demo/fallback data when OpenAI API key is missing
- [ ] "Not financial advice" disclaimer at page bottom

### Non-Functional

- [ ] Total analysis time < 30 seconds per run
- [ ] AI output validated by Zod schema
- [ ] Single OpenAI call cost < $0.50
- [ ] Mobile responsive layout works correctly
- [ ] All error states have user-friendly messages

## Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| GPT-4o returns invalid JSON | Analysis failure | Zod validation + user-friendly error message + retry button |
| OpenAI call timeout | User waits too long | Set 30s timeout, show retry prompt on timeout |
| Pre-filter Top 20 quality insufficient | Good tokens missed | Scoring formula is adjustable, weights can be tuned later |
| Scores inconsistent with single-token analysis | User confusion | UI explains recommendation score is comparative ranking, different focus from single-token analysis |
| API key exposed client-side | Known architectural debt | Pre-existing issue, not introduced by this feature |

## Future Considerations

- **News data source**: Add Vercel serverless function to proxy CryptoPanic API, solving CORS
- **Social data source**: Integrate Twitter/Farcaster API
- **User-customizable weights**: Let users adjust how much each data source influences scoring
- **Auto-refresh**: Optional periodic re-analysis (every 5 minutes)
- **Push notifications**: Notify users when high-score tokens appear

## References

### Internal

- AI analysis flow: `frontend/src/lib/analyzer.ts` (prompt construction, OpenAI call, Zod validation)
- Zod schema pattern: `frontend/src/lib/analysisSchema.ts` (sub-schema composition, enum, range constraints)
- Metrics computation: `frontend/src/lib/metrics.ts` (on-chain metrics calculation, `OnChainMetrics` interface)
- Goldsky client: `frontend/src/lib/goldsky.ts` (GraphQL queries, retry logic, type definitions)
- Page pattern: `frontend/src/pages/Leaderboard.tsx` (one-shot loading, data processing)
- Routing: `frontend/src/App.tsx` (React Router v7 route definitions)
- Navigation: `frontend/src/components/Navbar.tsx` (NAV_ITEMS array)

### External

- [CryptoPanic API](https://cryptopanic.com/developers/api/) (future News data source)
- [OpenAI JSON Mode](https://platform.openai.com/docs/guides/structured-outputs) (response_format: json_object)
