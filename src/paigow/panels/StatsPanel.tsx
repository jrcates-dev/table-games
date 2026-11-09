import { Stat } from '../../blackjack/panels/StatsPanel'
import { RunList } from '../../components/RunList'
import { isRed, SUIT_GLYPH } from '../../components/suits'
import { FORTUNE_LABEL, FORTUNE_ORDER } from '../../engine/paigow/fortune'
import type { Suit } from '../../engine/types'
import { money, percent, relativeTime, signedMoney } from '../../lib/format'
import { usePaiGowStore, type HandRecord } from '../../store/paigowStore'

export function PaiGowStatsPanel() {
  const profile = usePaiGowStore((s) => s.profile)
  const { stats } = profile
  if (stats.hands === 0) return <p className="drawer__empty">Deal a hand and the numbers start here.</p>
  const edge = stats.totalWagered > 0 ? stats.netResult / stats.totalWagered : 0
  const share = (n: number) => percent(n / stats.hands, 1)
  const book = stats.houseWaySets / stats.hands
  const cost = stats.valued > 0 ? stats.evGivenUp / stats.valued : null

  return (
    <div className="stats">
      <div className="stats__hero">
        <Stat big label="Net result" value={signedMoney(stats.netResult, true)} tone={stats.netResult > 0 ? 'good' : stats.netResult < 0 ? 'bad' : undefined} />
        <Stat big label="House way" value={percent(book, 1)} tone={book >= 0.9 ? 'good' : 'bad'} hint={`${stats.houseWaySets} of ${stats.hands} hands set the way the dealer would`} />
      </div>
      <div className="stats__grid">
        <Stat label="Hands" value={stats.hands.toLocaleString()} />
        <Stat label="Realised edge" value={percent(edge, 2)} tone={edge >= 0 ? 'good' : 'bad'} hint="Net as a share of everything wagered, Fortune included" />
        <Stat label="Won" value={`${stats.wins} · ${share(stats.wins)}`} />
        <Stat label="Pushed" value={`${stats.pushes} · ${share(stats.pushes)}`} />
        <Stat label="Lost" value={`${stats.losses} · ${share(stats.losses)}`} />
        <Stat label="Fouled" value={`${stats.fouls} · ${share(stats.fouls)}`} tone={stats.fouls > 0 ? 'bad' : undefined} />
        <Stat label="Fouls avoided" value={stats.foulsAvoided.toLocaleString()} hint="Hands where a foul was on the felt and you fixed it before setting" />
        <Stat
          label="Off the house way"
          value={cost === null ? '—' : `${cost.toFixed(3)} a hand`}
          tone={cost !== null && cost > 0.01 ? 'bad' : undefined}
          hint="What your sets gave up against the house way's, in bets, on average"
        />
        <Stat label="Commission paid" value={money(stats.commissionPaid, true)} />
        <Stat label="Fortune hits" value={stats.fortuneBets > 0 ? `${stats.fortuneHits} of ${stats.fortuneBets}` : '—'} />
        <Stat label="Best Fortune hand" value={stats.bestFortune >= 0 ? FORTUNE_LABEL[FORTUNE_ORDER[stats.bestFortune]] : '—'} />
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

/** One hand's cards, the low two first and set apart. */
function Cards({ cards, low }: { cards: string[]; low: [number, number] }) {
  const order = [...low, ...cards.map((_, i) => i).filter((i) => !low.includes(i))]
  return (
    <>
      {order.map((i, k) => {
        const text = cards[i]
        if (text === 'JK')
          return (
            <span key={i} className={`card-chip is-joker${k === 2 ? ' pg-gap' : ''}`}>
              JKR
            </span>
          )
        const suit = text.slice(-1) as Suit
        return (
          <span key={i} className={`card-chip${isRed(suit) ? ' is-red' : ''}${k === 2 ? ' pg-gap' : ''}`}>
            {text.slice(0, -1)}
            {SUIT_GLYPH[suit]}
          </span>
        )
      })}
    </>
  )
}

const OUTCOME = { win: 'Won', lose: 'Lost', push: 'Push', foul: 'Foul' }

function HandRow({ entry }: { entry: HandRecord }) {
  return (
    <li className="history__row">
      <div className="history__head">
        <span className="history__time">{relativeTime(entry.timestamp)}</span>
        <span className="history__outcome">
          {OUTCOME[entry.outcome]}
          {entry.fortune ? ` · ${FORTUNE_LABEL[entry.fortune]}` : ''}
        </span>
        <span className={`history__net num ${entry.net > 0 ? 'tone-win' : entry.net < 0 ? 'tone-lose' : 'tone-push'}`}>{entry.net === 0 ? '—' : signedMoney(entry.net, true)}</span>
      </div>
      <div className="history__line">
        <span className="history__who">You</span>
        <Cards cards={entry.player} low={entry.playerLow} />
      </div>
      <div className="history__line">
        <span className="history__who">Dealer</span>
        <Cards cards={entry.dealer} low={entry.dealerLow} />
      </div>
      <div className="pg-names">
        {entry.playerHigh} · {entry.playerLowName} <span>against</span> {entry.dealerHigh} · {entry.dealerLowName}
      </div>
      {!entry.houseWay && entry.outcome !== 'foul' && (
        <div className="history__mistakes">Off the house way{entry.evCost !== null && entry.evCost >= 0.005 ? ` — cost ${entry.evCost.toFixed(2)} a bet` : ''}</div>
      )}
    </li>
  )
}
