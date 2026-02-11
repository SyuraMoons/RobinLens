import { useState, useCallback } from 'react'
import type { DataSource } from '../lib/recommender'
import type { AnalysisStep } from '../lib/recommender'
import { useRecommendations } from '../hooks/useRecommendations'
import { SourceToggle } from '../components/SourceToggle'
import { RecommendationCard } from '../components/RecommendationCard'

const ALL_SOURCES: DataSource[] = ['on_chain', 'technical']

const STEP_LABELS: Record<AnalysisStep, string> = {
  fetching_tokens: 'Fetching token data from on-chain...',
  computing_metrics: 'Computing metrics for all tokens...',
  running_ai: 'Running AI analysis (this may take 10-20s)...',
  done: 'Done',
}

function getSourcesFromStorage(): Set<DataSource> {
  try {
    const raw = localStorage.getItem('robinlens:rec-sources')
    if (raw) return new Set(JSON.parse(raw) as DataSource[])
  } catch { /* ignore */ }
  return new Set(ALL_SOURCES)
}

function saveSourcesStorage(sources: Set<DataSource>): void {
  localStorage.setItem('robinlens:rec-sources', JSON.stringify([...sources]))
}

export function Recommendations() {
  const [enabledSources, setEnabledSources] = useState<Set<DataSource>>(getSourcesFromStorage)
  const {
    recommendations,
    loading,
    error,
    step,
    cachedAt,
    cooldownRemaining,
    analyze,
  } = useRecommendations()

  const handleToggle = useCallback((source: DataSource) => {
    setEnabledSources((prev) => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      saveSourcesStorage(next)
      return next
    })
  }, [])

  const handleAnalyze = useCallback(() => {
    analyze({ enabledSources: [...enabledSources] })
  }, [analyze, enabledSources])

  const canAnalyze = enabledSources.size > 0 && !loading && cooldownRemaining === 0
  const cooldownSeconds = Math.ceil(cooldownRemaining / 1000)

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text-primary">
        AI Recommendations
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        Configure data sources and let AI find the best tokens on RobinPump right now.
      </p>

      {/* Data source toggles */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ALL_SOURCES.map((source) => (
          <SourceToggle
            key={source}
            source={source}
            enabled={enabledSources.has(source)}
            onToggle={handleToggle}
            disabled={loading}
          />
        ))}
      </div>

      {/* Analyze button */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="rounded-lg bg-blue px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>

        {enabledSources.size === 0 && (
          <span className="text-xs text-text-muted">Enable at least one data source</span>
        )}
        {cooldownRemaining > 0 && !loading && (
          <span className="text-xs text-text-muted">
            Available in {cooldownSeconds}s
          </span>
        )}
      </div>

      {/* Loading progress */}
      {loading && step && (
        <div className="mt-6 rounded-xl border border-border bg-bg-card p-6">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 animate-spin text-blue" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" fill="currentColor" className="opacity-75" />
            </svg>
            <span className="text-sm text-text-secondary">{STEP_LABELS[step]}</span>
          </div>

          {/* Step indicators */}
          <div className="mt-4 flex gap-2">
            {(['fetching_tokens', 'computing_metrics', 'running_ai'] as AnalysisStep[]).map((s) => {
              const stepOrder = ['fetching_tokens', 'computing_metrics', 'running_ai']
              const currentIdx = stepOrder.indexOf(step)
              const thisIdx = stepOrder.indexOf(s)
              const isComplete = thisIdx < currentIdx
              const isCurrent = s === step

              return (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    isComplete ? 'bg-green' : isCurrent ? 'bg-blue' : 'bg-border'
                  }`}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-6 rounded-xl border border-red/30 bg-red-dim p-4">
          <p className="text-sm text-red">{error}</p>
        </div>
      )}

      {/* Results */}
      {recommendations && !loading && (
        <div className="mt-6">
          {/* Cache indicator */}
          {cachedAt && (
            <p className="mb-3 text-xs text-text-muted">
              Results from {formatTimeAgo(cachedAt)}
            </p>
          )}

          {/* Market summary */}
          <div className="rounded-xl border border-border bg-bg-card p-4">
            <h3 className="text-xs font-medium text-text-muted">Market Summary</h3>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              {recommendations.marketSummary}
            </p>
          </div>

          {/* Recommendation cards */}
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {recommendations.recommendations.map((rec, i) => (
              <RecommendationCard
                key={rec.curveId}
                recommendation={rec}
                rank={i + 1}
              />
            ))}
          </div>

          {recommendations.recommendations.length === 0 && (
            <div className="mt-4 rounded-xl border border-border bg-bg-card p-8 text-center">
              <p className="text-sm text-text-muted">
                No tokens met the quality threshold. Try again later as new tokens launch.
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <p className="mt-6 text-center text-[10px] text-text-muted">
            Not financial advice. AI analysis is experimental and may contain errors.
            Always do your own research before trading.
          </p>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  return `${Math.floor(seconds / 3600)}h ago`
}
