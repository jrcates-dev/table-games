import { Stat } from '../../blackjack/panels/StatsPanel'
import { RunList } from '../../components/RunList'
import { isRed, SUIT_GLYPH } from '../../components/suits'
import { money, percent, relativeTime, signedMoney } from '../../lib/format'
import { useUthStore, type HandRecord } from '../../store/uthStore'

export function UthStatsPanel() {
  const profile = useUthStore((s) => s.profile)
  const { stats } = profile
  if (stats.hands === 0) return <p className="drawer__empty">Deal a hand and the numbers start here.</p>
  const edge = stats.totalWagered > 0 ? stats.netResult / stats.totalWagered : 0
  const share = (n: number) => percent(n / stats.hands, 1)
  const book = stats.decisions > 0 ? stats.bookDecisions / stats.decisions : 1

  return (
    <div className="stats">
      <div className="stats__hero">
        <Stat big label="Net result" value={signedMoney(stats.netResult, true)} tone={stats.netResult >= 0 ? 'good' : 'bad'} />
        <Stat big label="By the book" value={percent(book, 1)} tone={book >= 0.95 ? 'good' : 'bad'} hint={`${stats.bookDecisions} of ${stats.decisions} decisions matched the coach`} />
      </div>
      <div className="stats__grid">
        <Stat label="Hands" value={stats.hands.toLocaleString()} />
        <Stat label="Realised edge" value={percent(edge, 2)} tone={edge >= 0 ? 'good' : 'bad'} hint="Net as a share of everything wagered, Trips included" />
        <Stat label="Won" value={`${stats.wins} · ${share(stats.wins)}`} />
        <Stat label="Lost" value={`${stats.losses} · ${share(stats.losses)}`} />
        <Stat label="Folded" value={`${stats.folds} · ${share(stats.folds)}`} />
        <Stat label="Ties" value={`${stats.ties} · ${share(stats.ties)}`} />
        <Stat label="Raised before the flop" value={`${stats.raisedPreflop} · ${share(stats.raisedPreflop)}`} />
        <Stat label="Bet the flop" value={`${stats.raisedFlop} · ${share(stats.raisedFlop)}`} />
        <Stat label="Called the river" value={`${stats.raisedRiver} · ${share(stats.raisedRiver)}`} />
        <Stat label="Dealer did not open" value={`${stats.dealerDidNotOpen} · ${share(stats.dealerDidNotOpen)}`} />
        <Stat label="Trips paid" value={stats.tripsWon.toLocaleString()} />
        <Stat label="Best hand" value={stats.bestName || '—'} />
        <Stat label="Wagered" value={money(stats.totalWagered)} />
        <Stat label="Biggest win" value={signedMoney(stats.biggestWin, true)} tone="good" />
        <Stat label="Biggest loss" value={signedMoney(stats.biggestLoss, true)} tone="bad" />
        <Stat label="Peak bankroll" value={money(profile.peakBankroll)} />
      </div>
      <RunList runs={profile.runs} unit="hands" />
      <h3 className="form-section__title">Recent hands</h3>
      <ul className="history">
        {profile.history.slice(0, 40).map((entry) => (
          <HandRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  )
}

function Cards({ cards }: { cards: HandRecord['player'] }) {
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

const OUTCOME = { win: 'Won', lose: 'Lost', tie: 'Tie', fold: 'Folded' }

function HandRow({ entry }: { entry: HandRecord }) {
  return (
    <li className="history__row">
      <div className="history__head">
        <span className="history__time">{relativeTime(entry.timestamp)}</span>
        <span className="history__outcome">
          {OUTCOME[entry.outcome]}
          {entry.raise > 0 ? ` · ${entry.raise}x` : ''}
        </span>
        <span className={`history__net num ${entry.net > 0 ? 'tone-win' : entry.net < 0 ? 'tone-lose' : ''}`}>{entry.net === 0 ? '—' : signedMoney(entry.net, true)}</span>
      </div>
      <div className="history__line">
        <span className="history__who">You</span>
        <Cards cards={entry.player} />
        <span className="history__who">Board</span>
        <Cards cards={entry.board} />
        <span className="history__who">Dealer</span>
        <Cards cards={entry.dealer} />
      </div>
      <div className="history__line">
        <span className="history__who">{entry.playerName}</span>
        <span className="history__who">vs {entry.dealerName}{entry.dealerQualifies ? '' : ' (no open)'}</span>
      </div>
      {entry.mistakes.length > 0 && <div className="history__mistakes">{entry.mistakes.join(' · ')}</div>}
    </li>
  )
}
