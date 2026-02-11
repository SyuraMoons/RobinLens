import { Link } from 'react-router-dom'
import type { TokenRecommendation } from '../lib/recommendationSchema'
import { ScoreBadge } from './ScoreBadge'

function actionStyle(action: TokenRecommendation['suggestedAction']): { color: string; label: string } {
  switch (action) {
    case 'strong_buy': return { color: 'text-green', label: 'Strong Buy' }
    case 'buy': return { color: 'text-green', label: 'Buy' }
    case 'hold': return { color: 'text-yellow', label: 'Hold' }
    case 'avoid': return { color: 'text-red', label: 'Avoid' }
  }
}

function riskStyle(level: TokenRecommendation['riskLevel']): { bg: string; text: string } {
  switch (level) {
    case 'low': return { bg: 'bg-green/10 border-green/30', text: 'text-green' }
    case 'medium': return { bg: 'bg-yellow/10 border-yellow/30', text: 'text-yellow' }
    case 'high': return { bg: 'bg-orange/10 border-orange/30', text: 'text-orange' }
    case 'critical': return { bg: 'bg-red/10 border-red/30', text: 'text-red' }
  }
}

const SOURCE_LABELS: Record<string, string> = {
  on_chain: 'On-Chain',
  technical: 'Technical',
}

interface RecommendationCardProps {
  recommendation: TokenRecommendation
  rank: number
}

export function RecommendationCard({ recommendation, rank }: RecommendationCardProps) {
  const action = actionStyle(recommendation.suggestedAction)
  const risk = riskStyle(recommendation.riskLevel)
  const isDemo = recommendation.curveId.startsWith('demo-')

  const content = (
    <div className="rounded-xl border border-border bg-bg-card p-4 transition-all hover:border-border-light hover:bg-bg-hover">
      {/* Header: rank + name + score */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg-tertiary font-mono text-xs font-bold text-text-muted">
            {rank}
          </span>
          <div>
            <h3 className="font-display text-sm font-semibold text-text-primary">
              {recommendation.name}
            </h3>
            <p className="font-mono text-xs text-text-muted">${recommendation.symbol}</p>
          </div>
        </div>
        <ScoreBadge score={recommendation.robinScore} size="lg" />
      </div>

      {/* Explanation */}
      <p className="mt-3 text-xs leading-relaxed text-text-secondary">
        {recommendation.explanation}
      </p>

      {/* Source tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {recommendation.contributingSources.map((source) => (
          <span
            key={source}
            className="rounded bg-bg-tertiary px-2 py-0.5 text-[10px] font-medium text-text-secondary"
          >
            {SOURCE_LABELS[source] ?? source}
          </span>
        ))}
      </div>

      {/* Reasoning sections */}
      {recommendation.reasoning.onChain && (
        <div className="mt-3">
          <p className="text-[10px] font-medium text-text-muted">On-Chain</p>
          <p className="mt-0.5 text-xs text-text-secondary">{recommendation.reasoning.onChain}</p>
        </div>
      )}
      {recommendation.reasoning.technical && (
        <div className="mt-2">
          <p className="text-[10px] font-medium text-text-muted">Technical</p>
          <p className="mt-0.5 text-xs text-text-secondary">{recommendation.reasoning.technical}</p>
        </div>
      )}

      {/* Action + Risk footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className={`text-sm font-semibold ${action.color}`}>
          {action.label}
        </span>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${risk.bg} ${risk.text}`}>
          Risk: {recommendation.riskLevel}
        </span>
      </div>
    </div>
  )

  if (isDemo) return content

  return (
    <Link to={`/token/${recommendation.curveId}`} className="block no-underline">
      {content}
    </Link>
  )
}
