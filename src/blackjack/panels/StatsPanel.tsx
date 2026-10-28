import { SUIT_GLYPH, isRed } from '../../components/suits'
import { DEFAULT_RULE_PRESET, RULE_PRESETS } from '../../engine/rules'
import { ACTION_LABELS } from '../../engine/strategy'
import { money, percent, relativeTime, signedMoney } from '../../lib/format'
import { derivedStats, type RecordedCard } from '../../store/profile'
import { useGameStore } from '../../store/gameStore'

export function Stat({
  label,
  value,
  tone,
  hint,
  big = false,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
  hint?: string
  big?: boolean
}) {
  return (
    <div className={`stat${big ? ' stat--big' : ''}`} title={hint}>
      <span className="stat__label">{label}</span>
      <span className={`stat__value num${tone ? ` is-${tone}` : ''}`}>{value}</span>
    </div>
  )
}

export function StatsPanel() {
  const profile = useGameStore((s) => s.profile)
  const { stats } = profile
  const derived = derivedStats(stats)
  const houseEdge = (RULE_PRESETS[profile.settings.rulePreset] ?? RULE_PRESETS[DEFAULT_RULE_PRESET]).houseEdge

  if (stats.roundsPlayed === 0) {
    return <p className="drawer__empty">Play a hand and the numbers start here.</p>
  }

  return (
    <div className="stats">
      <div className="stats__hero">
        <Stat big label="Net result" value={signedMoney(stats.netResult)} tone={stats.netResult >= 0 ? 'good' : 'bad'} />
        <Stat
          big
          label="Strategy accuracy"
          value={percent(derived.strategyAccuracy)}
          tone={derived.strategyAccuracy > 0.97 ? 'good' : derived.strategyAccuracy < 0.9 ? 'bad' : undefined}
          hint={`${stats.strategyCorrect.toLocaleString()} of ${stats.strategyTotal.toLocaleString()} decisions matched the book`}
        />
      </div>
      <div className="stats__grid">
        <Stat label="Rounds" value={stats.roundsPlayed.toLocaleString()} />
        <Stat label="Hands" value={stats.handsPlayed.toLocaleString()} />
        <Stat label="Win rate" value={percent(derived.winRate)} hint="Decided hands only — pushes excluded" />
        <Stat
          label="Edge per $ wagered"
          value={percent(derived.edge, 2)}
          tone={derived.edge >= 0 ? 'good' : 'bad'}
          hint="Net result as a share of everything wagered, doubles, splits and insurance included. House edges are quoted per initial bet, so with perfect play this settles about an eighth lower than the table's house edge."
        />
        <Stat
          label="House edge here"
          value={percent(-houseEdge, 2)}
          hint="This table's edge against perfect basic strategy, per initial bet. Luck moves your result by about 1.15 bets ÷ √hands either way, so it takes tens of thousands of hands to see it."
        />
        <Stat label="Wagered" value={money(stats.totalWagered)} />
        <Stat label="Average bet" value={money(derived.avgBet)} />
        <Stat label="Blackjacks" value={`${stats.blackjacks} · ${percent(derived.blackjackRate)}`} />
        <Stat label="Busts" value={stats.busts.toLocaleString()} />
        <Stat label="Biggest win" value={signedMoney(stats.biggestWin)} tone="good" />
        <Stat label="Biggest loss" value={signedMoney(stats.biggestLoss)} tone="bad" />
        <Stat label="Best streak" value={`${stats.bestStreak}`} />
        <Stat label="Peak bankroll" value={money(profile.peakBankroll)} />
      </div>

      {profile.runs.length > 0 && (
        <div className="stats__runs">
          <h3 className="form-section__title">Past runs</h3>
          <ul className="runs">
            {profile.runs.slice(0, 6).map((run) => (
              <li key={run.id}>
                <span>{new Date(run.endedAt).toLocaleDateString()}</span>
                <strong className="num">{money(run.peakBankroll)} peak</strong>
                <span>{run.roundsPlayed} rounds</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="form-section__title">Recent hands</h3>
      <History />
    </div>
  )
}

function CardChip({ card }: { card: RecordedCard }) {
  return (
    <span className={`card-chip${isRed(card.suit) ? ' is-red' : ''}`}>
      {card.rank}
      {SUIT_GLYPH[card.suit]}
    </span>
  )
}

const OUTCOME_WORD: Record<string, string> = {
  blackjack: 'Blackjack',
  win: 'Win',
  push: 'Push',
  lose: 'Lose',
  bust: 'Bust',
  surrender: 'Surrender',
  dealerBlackjack: 'Dealer BJ',
}

function History() {
  const history = useGameStore((s) => s.profile.history)
  if (history.length === 0) return <p className="drawer__empty">No hands yet.</p>
  return (
    <ul className="history">
      {history.slice(0, 80).map((record) => (
        <li key={record.id} className="history__row">
          <div className="history__head">
            <span className="history__time">{relativeTime(record.timestamp)}</span>
            <span className={`history__net num ${record.net > 0 ? 'tone-win' : record.net < 0 ? 'tone-lose' : ''}`}>
              {record.net === 0 ? 'Push' : signedMoney(record.net)}
            </span>
          </div>
          <div className="history__line">
            <span className="history__who">Dealer</span>
            {record.dealer.map((card, i) => (
              <CardChip key={i} card={card} />
            ))}
          </div>
          {record.hands.map((hand, i) => (
            <div className="history__line" key={i}>
              <span className="history__who">
                {record.hands.length > 1 ? `Box ${i + 1}` : 'You'}
                {hand.doubled ? ' ×2' : ''}
              </span>
              {hand.cards.map((card, j) => (
                <CardChip key={j} card={card} />
              ))}
              <span className={`history__outcome is-${hand.outcome}`}>{OUTCOME_WORD[hand.outcome] ?? hand.outcome}</span>
            </div>
          ))}
          {record.mistakes.length > 0 && (
            <ul className="history__mistakes">
              {record.mistakes.map((m, i) => (
                <li key={i}>
                  {m.playerTotal} vs {m.dealerUpcard}: played <em>{ACTION_LABELS[m.played]}</em>, the book says{' '}
                  <strong>{ACTION_LABELS[m.correct]}</strong>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
