import type { DataSource } from '../lib/recommender'

const SOURCE_INFO: Record<DataSource, { label: string; description: string }> = {
  on_chain: {
    label: 'On-Chain',
    description: 'Holders, volume, curve progress, creator activity',
  },
  technical: {
    label: 'Technical',
    description: 'Price momentum, trade velocity, trend direction',
  },
}

interface SourceToggleProps {
  source: DataSource
  enabled: boolean
  onToggle: (source: DataSource) => void
  disabled?: boolean
}

export function SourceToggle({ source, enabled, onToggle, disabled }: SourceToggleProps) {
  const info = SOURCE_INFO[source]

  return (
    <button
      onClick={() => onToggle(source)}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
        enabled
          ? 'border-blue/50 bg-blue/10'
          : 'border-border bg-bg-card hover:border-border-light'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <div
        className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${
          enabled ? 'bg-blue' : 'bg-border'
        }`}
      >
        <div
          className={`h-4 w-4 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-3.5' : 'translate-x-0'
          }`}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">{info.label}</p>
        <p className="text-xs text-text-muted">{info.description}</p>
      </div>
    </button>
  )
}
