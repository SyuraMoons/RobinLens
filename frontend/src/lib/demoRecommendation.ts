import type { RecommendationResponse } from './recommendationSchema'

const CACHE_KEY = 'robinlens:recommendations'
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

interface CachedRecommendation {
  data: RecommendationResponse
  timestamp: number
}

export function getRecommendationCache(): { data: RecommendationResponse; timestamp: number } | null {
  const raw = localStorage.getItem(CACHE_KEY)
  if (!raw) return null

  try {
    const cached: CachedRecommendation = JSON.parse(raw)
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return cached
  } catch {
    localStorage.removeItem(CACHE_KEY)
    return null
  }
}

export function saveRecommendationCache(data: RecommendationResponse): void {
  const cached: CachedRecommendation = { data, timestamp: Date.now() }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
}

export const demoRecommendation: RecommendationResponse = {
  marketSummary:
    'The RobinPump market shows moderate activity with a mix of new launches and established tokens. Most tokens have high concentration risk. A few stand out with healthier holder distributions and sustained trading momentum.',
  recommendations: [
    {
      curveId: 'demo-1',
      name: 'BaseBuilder',
      symbol: 'BBLDR',
      robinScore: 71,
      explanation:
        'Strong holder diversification with 52 unique holders and low top-10 concentration at 48%. Volume momentum is 2.1x average, indicating growing interest. Curve is at 42% progress with steady accumulation.',
      contributingSources: ['on_chain', 'technical'],
      suggestedAction: 'buy',
      riskLevel: 'medium',
      reasoning: {
        onChain: '52 holders, 48% top-10 concentration, creator retained position. Healthy buy/sell ratio of 2.8.',
        technical: 'Price up 12% in the last hour with accelerating trade velocity at 2.1x.',
      },
    },
    {
      curveId: 'demo-2',
      name: 'DeFi Scout',
      symbol: 'SCOUT',
      robinScore: 64,
      explanation:
        'Clear utility concept targeting DeFi portfolio tracking. 38 holders with moderate concentration. Trading activity is consistent though not explosive.',
      contributingSources: ['on_chain'],
      suggestedAction: 'hold',
      riskLevel: 'medium',
      reasoning: {
        onChain: '38 holders, 58% top-10 concentration. Creator has not sold. Curve at 28% progress.',
      },
    },
    {
      curveId: 'demo-3',
      name: 'MemeVault',
      symbol: 'MVLT',
      robinScore: 45,
      explanation:
        'High trading volume but concerning holder concentration at 72%. Buy/sell ratio is dropping, suggesting early buyers are taking profit.',
      contributingSources: ['on_chain', 'technical'],
      suggestedAction: 'avoid',
      riskLevel: 'high',
      reasoning: {
        onChain: '28 holders, 72% top-10 concentration. Creator sold 15% of position.',
        technical: 'Price down 8% in last hour. Trend direction is down with declining velocity.',
      },
    },
  ],
}
