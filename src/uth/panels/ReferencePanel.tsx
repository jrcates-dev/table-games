import { EdgeBar, EdgePill } from '../../components/EdgePill'
import { CATEGORY_LABEL, type Category } from '../../engine/uth/poker'
import { BLIND_PAYS, TRIPS_TABLES, tripsEdge, UTH_ELEMENT_OF_RISK, UTH_HOUSE_EDGE, UTH_SIMPLE_STRATEGY_EDGE, type TripsTableId } from '../../engine/uth/rules'
import { preflopChart } from '../../engine/uth/strategy'
import { percent } from '../../lib/format'
import { useUthStore } from '../../store/uthStore'

const CHART = preflopChart()
const ORDER: Category[] = ['royal', 'straightFlush', 'quads', 'fullHouse', 'flush', 'straight', 'trips']
const pays = (n: number) => (n === 1.5 ? '3 to 2' : `${n} to 1`)

/**
 * The book for Ultimate Texas Hold'em: how a hand runs, the three decisions
 * and the rule for each, and every bet priced — the game itself, and Trips
 * under each of the pay tables you will find on the Strip.
 */
export function UthReferencePanel() {
  const showEdges = useUthStore((s) => s.profile.settings.showEdges)
  const tripsTable = useUthStore((s) => s.game.tripsTable)

  return (
    <div className="reference">
      <section className="reference__primer">
        <h3 className="form-section__title">How a hand works</h3>
        <ol>
          <li>
            <strong>Ante and Blind.</strong> Equal bets, both required. Trips is optional and is paid on your hand alone.
          </li>
          <li>
            <strong>Before the flop</strong> you see your two cards: check, or bet 4x or 3x the Ante on Play.
          </li>
          <li>
            <strong>On the flop</strong>, if you checked: check again, or bet 2x.
          </li>
          <li>
            <strong>On the river</strong>, if you checked twice: bet 1x, or fold the Ante and Blind. One Play bet a hand — once it is down, you are done deciding.
          </li>
          <li>
            <strong>Showdown.</strong> Best five of seven. Play pays even money if you win. The Ante pays only if the dealer opens with a pair or better, and pushes if not. The Blind pays on a straight or better
            and pushes on any lesser win.
          </li>
        </ol>
      </section>

      <section className="reference__group">
        <h3 className="form-section__title">Before the flop: raise 4x or check</h3>
        <p className="reference__note">
          Never 3x: a hand worth raising is worth raising the most. (Short of 4x in the rack, the coach says when 3x is still worth it.) Suited hands above the diagonal, offsuit below.
        </p>
        <div className="uth-chart" role="table" aria-label="Pre-flop raising chart">
          {CHART.map((row, i) => (
            <div key={i} className="uth-chart__row" role="row">
              {row.map((cell) => (
                <span key={cell.label} role="cell" className={`uth-chart__cell is-${cell.decision === 'bet4' ? 'raise' : 'check'}`} title={`${cell.label}: ${cell.decision === 'bet4' ? 'raise 4x' : 'check'}`}>
                  {cell.label}
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="chart__foot">Gold raises 4x; the rest check. Any ace, any pair but deuces, K2s+, K5o+, Q6s+, Q8o+, J8s+, JTo.</p>
      </section>

      <section className="reference__group">
        <h3 className="form-section__title">On the flop: bet 2x or check</h3>
        <ul className="uth-rules">
          <li>Two pair or better that uses your cards — but deuces with a pair on the board check</li>
          <li>Any pocket pair but deuces</li>
          <li>A hidden pair — one of your cards pairs the board</li>
          <li>Four to a flush with a ten or better of that suit in your hand</li>
        </ul>
        <p className="reference__note">
          Anything else checks. This is the Wizard of Odds’ simple rule, and it gives up less than a tenth of a percent against perfect play. The coach goes one better: it works out every turn, river and dealer
          hand the flop leaves — just over a million — and makes the exact call. That agrees with the rule on 98 flops in 100.
        </p>
      </section>

      <section className="reference__group">
        <h3 className="form-section__title">On the river: bet 1x or fold</h3>
        <p className="reference__note">
          Count the cards you cannot see that would beat you if the dealer held one — the dealer’s outs. Bet with fewer than 21, fold with 21 or more. The Wizard also bets any hidden pair; counted exactly, the outs
          alone do a touch better, so the book leaves that out. The coach goes one better and scores all 990 hands the dealer could hold, so its call on the river is exact.
        </p>
      </section>

      <section className="reference__group">
        <h3 className="form-section__title">Every bet, priced</h3>
        <div className="reference__rows">
          <div className="reference__row">
            <div className="reference__main">
              <strong>Ante + Blind + Play</strong>
              <span className="reference__pays">the game</span>
            </div>
            <p className="reference__blurb">
              Played perfectly — the way the coach plays — the house keeps {percent(UTH_HOUSE_EDGE, 3)} of the Ante: {percent(UTH_ELEMENT_OF_RISK, 2)} of all the money you put in play, about what a good blackjack
              game costs. Played by the simple rules above, {percent(UTH_SIMPLE_STRATEGY_EDGE, 2)} of the Ante.
            </p>
            {showEdges && (
              <div className="reference__edge">
                <EdgePill edge={UTH_HOUSE_EDGE} />
                <EdgeBar edge={UTH_HOUSE_EDGE} worst={0.1} />
              </div>
            )}
          </div>
          <div className="reference__row">
            <div className="reference__main">
              <strong>Blind</strong>
              <span className="reference__pays">straight or better</span>
            </div>
            <table className="ba-paytable">
              <tbody>
                {ORDER.filter((c) => BLIND_PAYS[c] !== undefined).map((c) => (
                  <tr key={c}>
                    <th>{CATEGORY_LABEL[c]}</th>
                    <td>{pays(BLIND_PAYS[c]!)}</td>
                  </tr>
                ))}
                <tr>
                  <th>Any other win</th>
                  <td>Push</td>
                </tr>
              </tbody>
            </table>
          </div>
          {(Object.keys(TRIPS_TABLES) as TripsTableId[]).map((id) => {
            const table = TRIPS_TABLES[id]
            const edge = tripsEdge(table)
            return (
              <div key={id} className={`reference__row${id === tripsTable ? ' is-current' : ''}`}>
                <div className="reference__main">
                  <strong>Trips · {table.name}</strong>
                  <span className="reference__pays">{id === tripsTable ? 'this table' : 'elsewhere'}</span>
                </div>
                <table className="ba-paytable">
                  <tbody>
                    {ORDER.map((c) => (
                      <tr key={c}>
                        <th>{CATEGORY_LABEL[c]}</th>
                        <td>{pays(table.pays[c]!)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {showEdges && (
                  <div className="reference__edge">
                    <EdgePill edge={edge} />
                    <EdgeBar edge={edge} worst={0.1} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <p className="chart__foot">
        One deck, shuffled for every hand. The game’s edge is the Wizard of Odds’ combinatorial figure, and our own count of every board, starting hand and dealer hand agrees with it; the same count prices the
        simple rules. The Trips edges are exact, counted over all 133,784,560 seven-card hands. Aria does not publish its Trips pay
        table — the first is the one most often posted on the Strip. Change it in Settings.
      </p>
    </div>
  )
}
