import { z } from 'zod/v4'

const SOURCE_KEYS = ['on_chain', 'technical', 'news', 'market'] as const
const ACTION_KEYS = ['strong_buy', 'buy', 'hold', 'avoid'] as const
const RISK_KEYS = ['low', 'medium', 'high', 'critical'] as const

function normalizeAction(s: unknown): (typeof ACTION_KEYS)[number] {
  const str = String(s ?? '').replace(/\s+/g, '_').toLowerCase()
  return (ACTION_KEYS as readonly string[]).includes(str) ? (str as (typeof ACTION_KEYS)[number]) : 'hold'
}

function normalizeRisk(s: unknown): (typeof RISK_KEYS)[number] {
  const str = String(s ?? '').toLowerCase().trim()
  return (RISK_KEYS as readonly string[]).includes(str) ? (str as (typeof RISK_KEYS)[number]) : 'medium'
}

export const TokenRecommendationSchema = z.object({
  curveId: z.string(),
  name: z.string(),
  symbol: z.string(),
  robinScore: z.number().min(0).max(100),
  explanation: z.string(),
  contributingSources: z.preprocess(
    (arr) => Array.isArray(arr)
      ? arr.filter((s) => (SOURCE_KEYS as readonly string[]).includes(String(s)))
      : [],
    z.array(z.enum(SOURCE_KEYS)),
  ),
  suggestedAction: z.preprocess(normalizeAction, z.enum(ACTION_KEYS)),
  riskLevel: z.preprocess(normalizeRisk, z.enum(RISK_KEYS)),
  reasoning: z.preprocess(
    (val) => (val != null && typeof val === 'object' ? val : {}),
    z.object({
      onChain: z.string().optional(),
      technical: z.string().optional(),
      news: z.string().optional(),
      market: z.string().optional(),
    }),
  ),
})

export const RecommendationResponseSchema = z.object({
  recommendations: z.preprocess(
    (val) => (Array.isArray(val) ? val : []),
    z.array(TokenRecommendationSchema).max(10),
  ),
  marketSummary: z.preprocess((val) => (typeof val === 'string' ? val : ''), z.string()),
})

export type TokenRecommendation = z.infer<typeof TokenRecommendationSchema>
export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>
