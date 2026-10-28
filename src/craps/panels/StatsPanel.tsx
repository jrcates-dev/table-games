import { useState } from 'react'
import { Stat } from '../../blackjack/panels/StatsPanel'
import { money, percent, relativeTime, signedMoney } from '../../lib/format'
import { derivedCrapsStats } from '../../store/crapsProfile'
import { useCrapsStore } from '../../store/crapsStore'

export function CrapsStatsPanel() {
  const profile = useCrapsStore((s) => s.profile)
  const { stats } = profile
  const derived = derivedCrapsStats(stats)

  if (stats.rolls === 0) return <p className="drawer__empty">Throw the dice and the numbers start here.</p>

  return (
    <div className="stats">
      <div className="stats__hero">
        <Stat big label="Net result" value={signedMoney(stats.netResult)} tone={stats.netResult >= 0 ? 'good' : 'bad'} />
        <Stat big label="Longest roll" value={`${stats.longestRoll}`} hint="Most throws held in one shoot — the real craps brag" />
      </div>
      <div className="stats__grid">
        <Stat label="Rolls" value={stats.rolls.toLocaleString()} />
        <Stat label="Shoots" value={stats.shoots.toLocaleString()} />
        <Stat
          label="Realised edge"
          value={percent(derived.edge, 2)}
          tone={derived.edge >= 0 ? 'good' : 'bad'}
          hint="Net as a share of everything wagered. The pass line with full odds trends toward −0.37%; the centre of the table toward −12%."
        />
        <Stat label="Wagered" value={money(stats.totalWagered)} />
        <Stat label="Points made" value={stats.pointsMade.toLocaleString()} />
        <Stat label="Most points" value={String(stats.mostPointsInAShoot)} hint="In a single shoot" />
        <Stat label="Rolls / shoot" value={derived.rollsPerShoot.toFixed(1)} />
        <Stat label="Naturals" value={stats.naturals.toLocaleString()} hint="7 or 11 on a come-out" />
        <Stat label="Craps" value={stats.crapsRolled.toLocaleString()} hint="2, 3 or 12 on a come-out" />
        <Stat label="Best shoot" value={signedMoney(stats.bestShootNet)} tone={stats.bestShootNet > 0 ? 'good' : undefined} />
        <Stat label="Biggest win" value={signedMoney(stats.biggestWin)} tone="good" />
        <Stat label="Biggest loss" value={signedMoney(stats.biggestLoss)} tone="bad" />
        {stats.fireBetsWon > 0 && <Stat label="Fire bets won" value={String(stats.fireBetsWon)} tone="good" />}
        {stats.bonusBetsWon > 0 && <Stat label="ATS won" value={String(stats.bonusBetsWon)} tone="good" />}
        <Stat label="Peak bankroll" value={money(profile.peakBankroll)} />
      </div>
      <h3 className="form-section__title">Recent shoots</h3>
      <ShootHistory />
    </div>
  )
}

const NOTE_TEXT: Record<string, string> = {
  pointSet: 'point set',
  pointMade: 'point made',
  sevenOut: 'seven out',
  natural: 'natural',
  craps: 'craps',
}

function ShootHistory() {
  const history = useCrapsStore((s) => s.profile.history)
  const [open, setOpen] = useState<string | null>(null)
  if (history.length === 0) return <p className="drawer__empty">Shoots land here once the shooter sevens out.</p>

  return (
    <ul className="history">
      {history.slice(0, 40).map((shoot) => {
        const expanded = open === shoot.id
        return (
          <li key={shoot.id} className="history__row">
            <button type="button" className="shoot__head" onClick={() => setOpen(expanded ? null : shoot.id)}>
              <span className="history__time">
                Shoot #{shoot.shootNumber} · {relativeTime(shoot.timestamp)}
              </span>
              <span className="shoot__summary">
                {shoot.rolls.length} roll{shoot.rolls.length === 1 ? '' : 's'}
                {shoot.pointsMade.length > 0 && ` · ${shoot.pointsMade.length} point${shoot.pointsMade.length === 1 ? '' : 's'}`}
              </span>
              <span className={`history__net num ${shoot.net > 0 ? 'tone-win' : shoot.net < 0 ? 'tone-lose' : ''}`}>{signedMoney(shoot.net)}</span>
            </button>
            {expanded && (
              <ol className="shoot__rolls">
                {shoot.rolls.map((entry, i) => (
                  <li key={i} className={entry.note ? `is-${entry.note}` : undefined}>
                    <span className="num">
                      {entry.a}·{entry.b}
                    </span>
                    <strong className="num">{entry.total}</strong>
                    <span>{NOTE_TEXT[entry.note ?? ''] ?? (entry.point ? `point ${entry.point}` : '')}</span>
                    <span className={`num ${entry.net > 0 ? 'tone-win' : entry.net < 0 ? 'tone-lose' : ''}`}>{entry.net === 0 ? '—' : signedMoney(entry.net)}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        )
      })}
    </ul>
  )
}
