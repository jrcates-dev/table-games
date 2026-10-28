import { money } from '../lib/format'
import type { SeatRun } from '../store/seat'

/** Runs already filed: when each ended, the peak it reached, and how long it lasted. */
export function RunList({ runs, unit }: { runs: SeatRun[]; unit: string }) {
  if (runs.length === 0) return null
  return (
    <div className="stats__runs">
      <h3 className="form-section__title">Past runs</h3>
      <ul className="runs">
        {runs.slice(0, 6).map((run) => (
          <li key={run.id}>
            <span>{new Date(run.endedAt).toLocaleDateString()}</span>
            <strong className="num">{money(run.peakBankroll)} peak</strong>
            <span>
              {run.rounds} {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
