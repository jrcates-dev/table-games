import { Stat } from '../../blackjack/panels/StatsPanel'
import { isRed, SUIT_GLYPH } from '../../components/suits'
import { BACCARAT_BETS } from '../../engine/baccarat/rules'
import { money, percent, relativeTime, signedMoney } from '../../lib/format'
import { useBaccaratStore, type CoupRecord } from '../../store/baccaratStore'
import { RunList } from '../../components/RunList'

export function BaccaratStatsPanel() {
  const profile = useBaccaratStore((s) => s.profile)
  const { stats } = profile
  if (stats.coups === 0) return <p className="drawer__empty">Deal a coup and the numbers start here.</p>
  const edge = stats.totalWagered > 0 ? stats.netResult / stats.totalWagered : 0
  const share = (n: number) => percent(n / stats.coups, 1)

  return (
    <div className="stats">
      <div className="stats__hero">
        <Stat big label="Net result" value={signedMoney(stats.netResult, true)} tone={stats.netResult >= 0 ? 'good' : 'bad'} />
        <Stat
          big
          label="Realised edge"
          value={percent(edge, 2)}
          tone={edge >= 0 ? 'good' : 'bad'}
          hint="Net as a share of everything wagered. Banker alone trends toward −1.06%, Player −1.24%, Tie −14.4%."
        />
      </div>
      <div className="stats__grid">
        <Stat label="Coups" value={stats.coups.toLocaleString()} />
        <Stat label="Shoes finished" value={stats.shoes.toLocaleString()} />
        <Stat label="Banker won" value={`${stats.bankerWins} · ${share(stats.bankerWins)}`} hint="45.9% over the long run" />
        <Stat label="Player won" value={`${stats.playerWins} · ${share(stats.playerWins)}`} hint="44.6% over the long run" />
        <Stat label="Ties" value={`${stats.ties} · ${share(stats.ties)}`} hint="9.5% over the long run" />
        <Stat label="Naturals" value={`${stats.naturals} · ${share(stats.naturals)}`} />
        <Stat label="Wagered" value={money(stats.totalWagered)} />
        <Stat label="Commission paid" value={money(stats.commissionPaid, true)} hint="The 5% on every Banker win — the whole reason the Banker is not a winning bet" />
        <Stat label="Side bets won" value={stats.sideBetsWon.toLocaleString()} />
        <Stat label="Biggest win" value={signedMoney(stats.biggestWin, true)} tone="good" />
        <Stat label="Biggest loss" value={signedMoney(stats.biggestLoss, true)} tone="bad" />
        <Stat label="Peak bankroll" value={money(profile.peakBankroll)} />
      </div>
      <RunList runs={profile.runs} unit="coups" />
      <h3 className="form-section__title">Recent coups</h3>
      <ul className="history">
        {profile.history.slice(0, 40).map((entry) => (
          <CoupRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  )
}

function Cards({ cards }: { cards: CoupRecord['player'] }) {
  return (
    <>
      {cards.map((card, i) => (
        <span key={i} className={`card-chip${isRed(card.suit) ? ' is-red' : ''}`}>
          {card.rank}
          {SUIT_GLYPH[card.suit]}
        </span>
      ))}
    </>
  )
}

function CoupRow({ entry }: { entry: CoupRecord }) {
  const bets = Object.entries(entry.bets)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${BACCARAT_BETS[k as keyof typeof BACCARAT_BETS].short} ${money(v ?? 0)}`)
    .join(' · ')
  return (
    <li className="history__row">
      <div className="history__head">
        <span className="history__time">{relativeTime(entry.timestamp)}</span>
        <span className={`history__outcome ba-outcome--${entry.winner}`}>{entry.winner === 'tie' ? 'Tie' : entry.winner === 'banker' ? 'Banker' : 'Player'}</span>
        <span className={`history__net num ${entry.net > 0 ? 'tone-win' : entry.net < 0 ? 'tone-lose' : ''}`}>{entry.net === 0 ? '—' : signedMoney(entry.net, true)}</span>
      </div>
      <div className="history__line">
        <span className="history__who">Player {entry.playerTotal}</span>
        <Cards cards={entry.player} />
        <span className="history__who">Banker {entry.bankerTotal}</span>
        <Cards cards={entry.banker} />
      </div>
      {bets && <div className="history__mistakes">{bets}</div>}
    </li>
  )
}
