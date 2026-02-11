import { z } from 'zod/v4'

export const TokenRecommendationSchema = z.object({
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

export const RecommendationResponseSchema = z.object({
  recommendations: z.array(TokenRecommendationSchema).max(10),
  marketSummary: z.string(),
})

export type TokenRecommendation = z.infer<typeof TokenRecommendationSchema>
export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>
