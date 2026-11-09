import { useBookFocus } from '../../components/bookFocus'
import { EdgeBar, EdgePill } from '../../components/EdgePill'
import { ENVY_MIN, ENVY_PAYS, FORTUNE_COUNTS, FORTUNE_LABEL, FORTUNE_ORDER, FORTUNE_PAYS, FORTUNE_TOTAL } from '../../engine/paigow/fortune'
import { houseWay, HOUSE_WAY } from '../../engine/paigow/houseWay'
import * as pg from '../../engine/paigow/paigow'
import { PAIGOW_EDGE, PAIGOW_EDGE_NO_COMMISSION, PAIGOW_PUSH_RATE } from '../../engine/paigow/rules'
import { percent } from '../../lib/format'
import { usePaiGowStore } from '../../store/paigowStore'
import { FORTUNE_EDGE } from '../betInfo'

/** "1 in 4,700". */
const oneIn = (count: number) => `1 in ${Math.round(FORTUNE_TOTAL / count).toLocaleString()}`

/**
 * The book for Pai Gow Poker: how a hand runs, the house way rule by rule —
 * the dealer's own, and the coach's — with the one covering your hand lit, and
 * every bet priced.
 */
export function PaiGowReferencePanel() {
  const showEdges = usePaiGowStore((s) => s.profile.settings.showEdges)
  const commissionFree = usePaiGowStore((s) => s.game.rules.commissionFree)
  const wheelSecond = usePaiGowStore((s) => s.game.rules.wheelSecond)
  // The rule for the hand in front of you, or for the one just played until the next deal.
  const rule = usePaiGowStore((s) => (s.game.player.length === 7 ? houseWay(pg.playerCodes(s.game), s.game.rules).rule.id : null))
  const focus = useBookFocus(rule)

  return (
    <div className="reference">
      <section className="reference__primer">
        <h3 className="form-section__title">How a hand works</h3>
        <ol>
          <li>
            <strong>Bet</strong>, and Fortune if you like. You play heads-up against the dealer, who always banks.
          </li>
          <li>
            <strong>Seven cards each</strong> from one 53-card deck: the 52 and a joker. The joker plays as an ace, or as any card that completes a straight, flush or straight flush.
          </li>
          <li>
            <strong>Set your hand</strong>: two cards to the low hand, five to the high. The high hand must outrank the low — a set the other way round is a <em>foul</em>, and loses.
          </li>
          <li>
            <strong>The dealer</strong> turns their seven and sets them the house way, below.
          </li>
          <li>
            <strong>Showdown</strong>, high against high and low against low. Win both and the bet pays even money{commissionFree ? '' : ', less 5% commission'}; win one and it pushes; lose both and it
            loses. A tie on either hand — a <em>copy</em> — goes to the dealer.
            {commissionFree && ' At this commission-free table a win pushes instead when the dealer’s high hand is a queen-high pai gow.'}
          </li>
        </ol>
        <p className="reference__note">
          Hands rank as in poker, with five aces above a royal flush. Two cards make a pair or two high cards. The wheel, A-2-3-4-5, is
          {wheelSecond ? ' the second-highest straight, under A-K-Q-J-10 (changeable in Settings).' : ' the lowest straight (changeable in Settings).'}
        </p>
      </section>

      <section className="reference__group">
        <h3 className="form-section__title">
          The house way
          {rule && <span className="reference__here">Your hand is lit</span>}
        </h3>
        <p className="reference__note">
          Every Strip room sets the dealer’s hand by a written house way, and will set yours the same way if you ask. Aria does not publish its own; this is the common Las Vegas one. The dealer reads it top
          to bottom and the first rule that fits decides. The joker counts as an ace for pairs.
        </p>
        <div className="reference__rows">
          {HOUSE_WAY.map((r) => (
            <div key={r.id} ref={r.id === rule ? focus : undefined} className={`reference__row pg-way${r.id === rule ? ' is-live' : ''}`}>
              <div className="reference__main">
                <strong>{r.hand}</strong>
              </div>
              <p className="reference__blurb">{r.way}</p>
            </div>
          ))}
        </div>
        <p className="reference__note">
          The house way is close to the best play, not the best play: the coach also deals your hand against a few thousand dealer hands and says when another set is worth more. Those gaps are usually a
          cent or two a bet.
        </p>
      </section>

      <section className="reference__group">
        <h3 className="form-section__title">Every bet, priced</h3>
        <div className="reference__rows">
          <div className={`reference__row${commissionFree ? '' : ' is-current'}`}>
            <div className="reference__main">
              <strong>Bet · 5% commission</strong>
              <span className="reference__pays">{commissionFree ? 'elsewhere' : 'this table'}</span>
            </div>
            <p className="reference__blurb">
              Both sides setting the house way, the house keeps {percent(PAIGOW_EDGE, 2)} of the bet. {percent(PAIGOW_PUSH_RATE, 0)} of hands push, so it is the slowest game in the building: a good
              blackjack game costs less per bet, but far more bets an hour.
            </p>
            {showEdges && (
              <div className="reference__edge">
                <EdgePill edge={PAIGOW_EDGE} />
                <EdgeBar edge={PAIGOW_EDGE} worst={0.1} />
              </div>
            )}
          </div>
          <div className={`reference__row${commissionFree ? ' is-current' : ''}`}>
            <div className="reference__main">
              <strong>Bet · no commission</strong>
              <span className="reference__pays">{commissionFree ? 'this table' : 'elsewhere'}</span>
            </div>
            <p className="reference__blurb">
              Wins pay even money, but a win over a dealer’s queen-high pai gow pushes: {percent(PAIGOW_EDGE_NO_COMMISSION, 2)}, set the house way.
            </p>
            {showEdges && (
              <div className="reference__edge">
                <EdgePill edge={PAIGOW_EDGE_NO_COMMISSION} />
                <EdgeBar edge={PAIGOW_EDGE_NO_COMMISSION} worst={0.1} />
              </div>
            )}
          </div>
          <div className="reference__row">
            <div className="reference__main">
              <strong>Fortune Bonus</strong>
              <span className="reference__pays">your seven cards</span>
            </div>
            <table className="ba-paytable pg-paytable">
              <tbody>
                {FORTUNE_ORDER.map((hand) => (
                  <tr key={hand}>
                    <th>{FORTUNE_LABEL[hand]}</th>
                    <td>{FORTUNE_PAYS[hand].toLocaleString()} to 1</td>
                    <td className="pg-paytable__odds">{oneIn(FORTUNE_COUNTS[hand])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="reference__blurb">
              Paid however you set the hand, a foul included. Counted over all 154,143,080 seven-card hands the deck holds, the house keeps {percent(FORTUNE_EDGE, 2)} — nearly three times the main bet.
            </p>
            {showEdges && (
              <div className="reference__edge">
                <EdgePill edge={FORTUNE_EDGE} />
                <EdgeBar edge={FORTUNE_EDGE} worst={0.1} />
              </div>
            )}
          </div>
          <div className="reference__row">
            <div className="reference__main">
              <strong>Envy Bonus</strong>
              <span className="reference__pays">with ${ENVY_MIN}+ on Fortune</span>
            </div>
            <table className="ba-paytable">
              <tbody>
                {FORTUNE_ORDER.filter((h) => ENVY_PAYS[h] !== undefined).map((hand) => (
                  <tr key={hand}>
                    <th>{FORTUNE_LABEL[hand]}</th>
                    <td>${ENVY_PAYS[hand]!.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="reference__blurb">
              A flat bonus when another player at the table makes four of a kind or better — never the dealer. Heads-up there is nobody to envy, so it is shown here and never paid.
            </p>
          </div>
        </div>
      </section>

      <p className="chart__foot">
        One deck with a joker, shuffled for every hand. The main-game edges are from 40 million hands dealt by this table’s own engine, both sides setting the house way; the Fortune edge is exact. Fortune is
        the pay table most often posted on the Strip.
      </p>
    </div>
  )
}
