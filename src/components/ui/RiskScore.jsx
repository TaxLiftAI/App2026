import { riskBarColor, riskColor, formatRiskScore } from '../../lib/utils'

export default function RiskScore({ score, showBar = true }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-semibold tabular-nums ${riskColor(score)}`}>
        {formatRiskScore(score)}
      </span>
      {showBar && (
        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${riskBarColor(score)}`}
            style={{ width: `${score * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}
