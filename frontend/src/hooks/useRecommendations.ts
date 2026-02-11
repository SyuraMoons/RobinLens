import { useState, useCallback, useRef } from 'react'
import type { RecommendationResponse } from '../lib/recommendationSchema'
import { getRecommendations, type RecommendationConfig, type AnalysisStep } from '../lib/recommender'
import { getRecommendationCache, saveRecommendationCache, demoRecommendation } from '../lib/demoRecommendation'

const COOLDOWN_MS = 60_000 // 60 seconds

export interface UseRecommendationsReturn {
  recommendations: RecommendationResponse | null
  loading: boolean
  error: string | null
  step: AnalysisStep | null
  cachedAt: number | null
  cooldownRemaining: number
  analyze: (config: RecommendationConfig) => Promise<void>
}

export function useRecommendations(): UseRecommendationsReturn {
  const cached = getRecommendationCache()

  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(
    cached?.data ?? null,
  )
  const [cachedAt, setCachedAt] = useState<number | null>(cached?.timestamp ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<AnalysisStep | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = useCallback(() => {
    setCooldownRemaining(COOLDOWN_MS)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    const startTime = Date.now()
    cooldownRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, COOLDOWN_MS - elapsed)
      setCooldownRemaining(remaining)
      if (remaining === 0 && cooldownRef.current) {
        clearInterval(cooldownRef.current)
        cooldownRef.current = null
      }
    }, 1000)
  }, [])

  const analyze = useCallback(async (config: RecommendationConfig) => {
    setLoading(true)
    setError(null)
    setStep('fetching_tokens')

    try {
      let result: RecommendationResponse

      try {
        result = await getRecommendations(config, setStep)
      } catch {
        // Fallback to demo data when API is unavailable
        result = demoRecommendation
      }

      setRecommendations(result)
      saveRecommendationCache(result)
      setCachedAt(Date.now())
      startCooldown()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
      setStep(null)
    }
  }, [startCooldown])

  return { recommendations, loading, error, step, cachedAt, cooldownRemaining, analyze }
}
