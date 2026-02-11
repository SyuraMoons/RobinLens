import OpenAI from 'openai'
import { RecommendationResponseSchema, type RecommendationResponse } from './recommendationSchema'
import { fetchCurves, fetchTrades, fetchPositions, type Curve, type Trade, type Position } from './goldsky'
import { calculateMetrics, type OnChainMetrics } from './metrics'
import { calculateTechnicalMetrics, type TechnicalMetrics } from './technicalMetrics'

export type DataSource = 'on_chain' | 'technical'

export interface RecommendationConfig {
  enabledSources: DataSource[]
}

interface TokenData {
  curve: Curve
  onChainMetrics: OnChainMetrics
  technicalMetrics: TechnicalMetrics
  trades: Trade[]
  positions: Position[]
}

// --- Pre-filter scoring ---

function preFilterScore(metrics: OnChainMetrics): number {
  const values = [
    metrics.tradeCount,
    metrics.holderCount,
    metrics.volumeMomentum,
    1 - metrics.top10Concentration,
  ]

  // Each dimension gets equal weight, simple average of normalized rank scores
  // Actual normalization happens across the full list
  return values.reduce((sum, v) => sum + v, 0)
}

// --- Prompt construction ---

function buildSystemPrompt(enabledSources: DataSource[]): string {
  const sourceDescriptions: string[] = []

  if (enabledSources.includes('on_chain')) {
    sourceDescriptions.push('on-chain metrics (holder distribution, trade volume, bonding curve progress, creator behavior)')
  }
  if (enabledSources.includes('technical')) {
    sourceDescriptions.push('technical indicators (price momentum, trade velocity, trend direction)')
  }

  return `You are a skeptical DeFi analyst ranking RobinPump bonding curve tokens on Base. Your job is to identify the best current opportunities from a batch of tokens, using ${sourceDescriptions.join(' and ')}.

Scoring calibration:
- 0-20: Obvious scam or dead token
- 21-40: Low quality, poor metrics
- 41-60: Average, some positive signals but nothing compelling
- 61-80: Above average, multiple strong signals, worth watching
- 81-100: Exceptional -- only if metrics are genuinely outstanding across dimensions

Be skeptical by default. Most bonding curve tokens are low quality. Your output must be valid JSON matching the exact schema requested.

For each recommended token, explain:
1. WHY you ranked it (specific data points, not generic statements)
2. Which data sources contributed most to your assessment
3. A clear suggested action and risk level

Risk levels:
- low: Strong metrics, no red flags
- medium: Mixed signals, some concerns
- high: Significant risks but potential upside
- critical: Major red flags, proceed with extreme caution

Respond with a JSON object containing:
- "recommendations": array of up to 10 tokens, ranked by robinScore descending
- "marketSummary": one paragraph summarizing the overall state of tokens you analyzed

Each recommendation must have:
- "curveId": the token's curve ID
- "name": token name
- "symbol": token symbol
- "robinScore": 0-100
- "explanation": 2-3 sentences on why this token stands out
- "contributingSources": array of source keys that were most relevant (${enabledSources.map((s) => `"${s}"`).join(', ')})
- "suggestedAction": "strong_buy" | "buy" | "hold" | "avoid"
- "riskLevel": "low" | "medium" | "high" | "critical"
- "reasoning": object with optional keys "onChain" and "technical", each a brief analysis from that perspective`
}

function buildUserPrompt(
  tokens: TokenData[],
  enabledSources: DataSource[],
): string {
  const tokenBlocks = tokens.map((t, i) => {
    const parts: string[] = [
      `Token #${i + 1}: ${t.curve.name} ($${t.curve.symbol})`,
      `Curve ID: ${t.curve.id}`,
      `Age: ${t.onChainMetrics.ageHours.toFixed(1)} hours`,
      `Graduated: ${t.curve.graduated ? 'Yes' : 'No'}`,
    ]

    if (enabledSources.includes('on_chain')) {
      parts.push(
        `\nOn-chain metrics:`,
        `- Holders: ${t.onChainMetrics.holderCount}`,
        `- Top 10 concentration: ${(t.onChainMetrics.top10Concentration * 100).toFixed(1)}%`,
        `- Buy/sell ratio: ${t.onChainMetrics.buySellRatio.toFixed(2)}`,
        `- Volume momentum: ${t.onChainMetrics.volumeMomentum.toFixed(2)}x`,
        `- Creator sold: ${(t.onChainMetrics.creatorSoldPercent * 100).toFixed(1)}%`,
        `- Curve progress: ${(t.onChainMetrics.bondingCurveProgress * 100).toFixed(1)}%`,
        `- Total trades: ${t.onChainMetrics.tradeCount}`,
      )
    }

    if (enabledSources.includes('technical')) {
      parts.push(
        `\nTechnical indicators:`,
        `- Price change (1h): ${(t.technicalMetrics.priceChange1h * 100).toFixed(2)}%`,
        `- Price change (24h): ${(t.technicalMetrics.priceChange24h * 100).toFixed(2)}%`,
        `- Trade velocity: ${t.technicalMetrics.tradeVelocity.toFixed(2)}x`,
        `- Trend: ${t.technicalMetrics.trendDirection}`,
      )
    }

    return parts.join('\n')
  })

  return `Analyze these ${tokens.length} RobinPump tokens and recommend the top 10 (or fewer if most are low quality). Rank them by overall quality.\n\n${tokenBlocks.join('\n\n---\n\n')}`
}

// --- Data fetching ---

async function fetchAllTokenData(curves: Curve[]): Promise<TokenData[]> {
  // Fetch trades and positions for all curves in parallel, with concurrency control
  const BATCH_SIZE = 5
  const results: TokenData[] = []

  for (let i = 0; i < curves.length; i += BATCH_SIZE) {
    const batch = curves.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (curve) => {
        const [trades, positions] = await Promise.all([
          fetchTrades(curve.id, 100),
          fetchPositions(curve.id, 50),
        ])
        const onChainMetrics = calculateMetrics(curve, trades, positions)
        const technicalMetrics = calculateTechnicalMetrics(trades, onChainMetrics.ageHours)
        return { curve, onChainMetrics, technicalMetrics, trades, positions }
      }),
    )
    results.push(...batchResults)
  }

  return results
}

// --- Main entry point ---

export type AnalysisStep = 'fetching_tokens' | 'computing_metrics' | 'running_ai' | 'done'

export async function getRecommendations(
  config: RecommendationConfig,
  onProgress?: (step: AnalysisStep) => void,
): Promise<RecommendationResponse> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  const baseURL = import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o'

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  if (config.enabledSources.length === 0) {
    throw new Error('At least one data source must be enabled')
  }

  // Step 1: Fetch all active (non-graduated) tokens
  onProgress?.('fetching_tokens')
  const curves = await fetchCurves('totalVolumeEth', 50)
  const activeCurves = curves.filter((c) => !c.graduated)

  // Step 2: Fetch detailed data and compute metrics
  onProgress?.('computing_metrics')
  const allTokenData = await fetchAllTokenData(activeCurves)

  // Step 3: Pre-filter to top 20 by composite score
  const sorted = [...allTokenData].sort(
    (a, b) => preFilterScore(b.onChainMetrics) - preFilterScore(a.onChainMetrics),
  )
  const top20 = sorted.slice(0, 20)

  // Step 4: Build prompt and call GPT-4o
  onProgress?.('running_ai')
  const client = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true })

  const response = await client.chat.completions.create({
    model,
    temperature: 0.3,
    messages: [
      { role: 'system', content: buildSystemPrompt(config.enabledSources) },
      { role: 'user', content: buildUserPrompt(top20, config.enabledSources) },
    ],
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('Empty LLM response')
  }

  onProgress?.('done')
  return RecommendationResponseSchema.parse(JSON.parse(content))
}
