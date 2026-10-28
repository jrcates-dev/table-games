import { Stat } from '../../blackjack/panels/StatsPanel'
import { RunList } from '../../components/RunList'
import { houseEdge } from '../../engine/roulette/bets'
import { pocketColor, pocketLabel } from '../../engine/roulette/wheel'
import { money, percent, relativeTime, signedMoney } from '../../lib/format'
import { recordTitle, useRouletteStore, type SpinRecord } from '../../store/rouletteStore'

export function RouletteStatsPanel() {
  const profile = useRouletteStore((s) => s.profile)
  const wheel = useRouletteStore((s) => s.game.wheel)
  const { stats } = profile
  if (stats.spins === 0) return <p className="drawer__empty">Spin the wheel and the numbers start here.</p>
  const edge = stats.totalWagered > 0 ? stats.netResult / stats.totalWagered : 0
  const share = (n: number) => percent(n / stats.spins, 1)
  const expected = houseEdge({ kind: 'straight', numbers: [1] }, wheel)

  return (
    <div className="stats">
      <div className="stats__hero">
        <Stat big label="Net result" value={signedMoney(stats.netResult)} tone={stats.netResult >= 0 ? 'good' : 'bad'} />
        <Stat
          big
          label="Realised edge"
          value={percent(edge, 2)}
          tone={edge >= 0 ? 'good' : 'bad'}
          hint={`Net as a share of everything wagered. Over the long run it heads for −${percent(expected, 2)} on this wheel, whatever you bet.`}
        />
      </div>
      <div className="stats__grid">
        <Stat label="Spins" value={stats.spins.toLocaleString()} />
        <Stat label="Spins that paid" value={`${stats.winningSpins} · ${share(stats.winningSpins)}`} />
        <Stat label="Reds" value={`${stats.reds} · ${share(stats.reds)}`} />
        <Stat label="Blacks" value={`${stats.blacks} · ${share(stats.blacks)}`} />
        <Stat label="Zeros" value={`${stats.zeros} · ${share(stats.zeros)}`} hint="1 in 19 on a double-zero wheel, 1 in 37 on a single" />
        <Stat label="Straight-up hits" value={stats.straightUpHits.toLocaleString()} />
        <Stat label="Wagered" value={money(stats.totalWagered)} />
        <Stat label="Biggest win" value={signedMoney(stats.biggestWin)} tone="good" />
        <Stat label="Biggest loss" value={signedMoney(stats.biggestLoss)} tone="bad" />
        <Stat label="Peak bankroll" value={money(profile.peakBankroll)} />
      </div>
      <RunList runs={profile.runs} unit="spins" />
      <h3 className="form-section__title">Recent spins</h3>
      <ul className="history">
        {profile.history.slice(0, 40).map((entry) => (
          <SpinRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  )
}

function SpinRow({ entry }: { entry: SpinRecord }) {
  const bets = entry.bets
    .slice(0, 6)
    .map((b) => `${recordTitle(entry.wheel, b.id)} ${money(b.amount)}`)
    .join(' · ')
  return (
    <li className="history__row">
      <div className="history__head">
        <span className="history__time">{relativeTime(entry.timestamp)}</span>
        <span className={`ro-num ro-num--${pocketColor(entry.result)}`}>{pocketLabel(entry.result)}</span>
        <span className={`history__net num ${entry.net > 0 ? 'tone-win' : entry.net < 0 ? 'tone-lose' : ''}`}>{entry.net === 0 ? '—' : signedMoney(entry.net)}</span>
      </div>
      {bets && (
        <div className="history__mistakes">
          {bets}
          {entry.bets.length > 6 ? ` · +${entry.bets.length - 6} more` : ''}
        </div>
      )}
    </li>
  )
}
