import { EdgeBar, EdgePill } from '../../components/EdgePill'
import { bankerDraws, tableauSquare, type TableauSquare } from '../../engine/baccarat/tableau'
import { BACCARAT_BETS, BACCARAT_ORDER, DRAGON_MARGIN_PAYS } from '../../engine/baccarat/rules'
import { useBaccaratStore, useLiveOdds } from '../../store/baccaratStore'

/**
 * Baccarat's book. There is nothing to decide once the cards are out, so the
 * book is two things: the tableau the dealer follows, printed as every
 * baccarat pit prints it, and the price of every bet — off the top of a fresh
 * shoe, and from the cards left in this one.
 */
export function BaccaratReferencePanel() {
  const showEdges = useBaccaratStore((s) => s.profile.settings.showEdges)
  const live = useLiveOdds()
  const rows = [...BACCARAT_ORDER].sort((a, b) => BACCARAT_BETS[a].edge - BACCARAT_BETS[b].edge)

  return (
    <div className="reference">
      <section className="reference__primer">
        <h3 className="form-section__title">How A Coup/Hand Works</h3>
        <ol>
          <li>
            <strong>Bet before the deal.</strong> Back the <em>Player</em> hand, the <em>Banker</em> hand, or a <em>Tie</em>. Neither hand is yours or the dealer’s — they are just the two names on the felt.
          </li>
          <li>
            <strong>Two cards each.</strong> Tens and face cards count nothing, aces one, everything else its number. Only the last digit counts: 7 and 8 make 5.
          </li>
          <li>
            <strong>Naturals.</strong> An 8 or 9 on either side’s first two cards ends the coup on the spot.
          </li>
          <li>
            <strong>The tableau.</strong> Otherwise the Player draws on 0–5 and stands on 6–7. The Banker then draws by the chart below, which looks at the Player’s third card. Nobody chooses anything.
          </li>
          <li>
            <strong>The pay.</strong> Player wins at even money; Banker wins at even money less 5%; a tie pays 8 to 1 and returns the Player and Banker bets.
          </li>
        </ol>
      </section>

      <section className="reference__group">
        <h3 className="form-section__title">The Banker’s third card</h3>
        <p className="reference__note">When the Player stands, the Banker draws on 0–5 and stands on 6–7, as in the last column. When the Player draws, the Banker’s total and the Player’s third card decide it:</p>
        <Tableau />
      </section>

      <section className="reference__group">
        <h3 className="form-section__title">Every bet, priced</h3>
        <p className="reference__note">
          The first figure is the house edge off the top of a fresh eight-deck shoe. {live.live ? 'The pill is the same bet priced from the cards still in this shoe — the main bets hardly move, the side bets can.' : 'Turn on live odds in Settings to price each bet from the cards still in the shoe.'}
        </p>
        <div className="reference__rows">
          {rows.map((kind) => {
            const spec = BACCARAT_BETS[kind]
            return (
              <div key={kind} className="reference__row">
                <div className="reference__main">
                  <strong>{spec.title}</strong>
                  <span className="reference__pays">{spec.pays}</span>
                </div>
                <div className="reference__detail">
                  <span>
                    <em className="tone-win">Wins</em> {spec.wins}
                  </span>
                  <span>
                    <em className="tone-lose">Loses</em> {spec.loses}
                  </span>
                </div>
                <p className="reference__blurb">{spec.blurb}</p>
                {showEdges && (
                  <div className="reference__edge">
                    <EdgePill edge={spec.edge} />
                    <EdgeBar edge={spec.edge} worst={0.15} />
                    {live.live && <span className="reference__live">this shoe <EdgePill edge={live.edges[kind]} label={false} /></span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="reference__group">
        <h3 className="form-section__title">Dragon Bonus pays</h3>
        <table className="ba-paytable">
          <tbody>
            <tr>
              <th>Win with a natural</th>
              <td>1 to 1</td>
            </tr>
            <tr>
              <th>Natural tie</th>
              <td>Push</td>
            </tr>
            {Object.entries(DRAGON_MARGIN_PAYS)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([margin, pays]) => (
                <tr key={margin}>
                  <th>Win by {margin}</th>
                  <td>{pays} to 1</td>
                </tr>
              ))}
            <tr>
              <th>Win by 3 or less, or lose</th>
              <td>Loses</td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className="chart__foot">
        Every figure is the house’s expected win per dollar of that bet’s own stake, ties included, worked out by enumerating every way a coup can be dealt from the cards in the shoe. Eight decks, Banker commission 5%, Tie 8 to 1, pairs 11 to 1 — the standard Strip mini-baccarat game. Aria does not publish its side-bet pay tables, so these are the ones most Las Vegas pits post.
      </p>
    </div>
  )
}

/** Across the chart: each Player third card, then `null` for a Player who stood. */
const COLUMNS: Array<number | null> = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, null]

/**
 * The Banker's chart, with the square the last coup was decided on lit the way
 * the blackjack book lights the player's own — once the coup is settled, so the
 * chart never gets ahead of the cards on the felt.
 */
function Tableau() {
  const coup = useBaccaratStore((s) => (s.game.phase === 'settled' ? s.game.coup : null))
  const square = coup ? tableauSquare(coup) : null

  return (
    <div className={`chart${square ? ' is-focused' : ''}`}>
      {coup && <p className="ba-tableau__last">{lastCoup(square)}</p>}
      <table className="chart__table ba-tableau">
        <colgroup>
          <col className="ba-tableau__side-col" />
          <col className="ba-tableau__total-col" />
          {COLUMNS.map((v) => (
            <col key={v ?? 'stood'} className={v === null ? 'ba-tableau__stood-col' : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <td colSpan={2} rowSpan={2} />
            <th scope="colgroup" colSpan={COLUMNS.length - 1} className="ba-tableau__axis ba-tableau__axis--top">
              Player’s third card
            </th>
            <td />
          </tr>
          <tr>
            {COLUMNS.map((v) => (
              <th key={v ?? 'stood'} scope="col" className={!square || square.playerThird === v ? 'is-col' : undefined}>
                {v ?? 'Stood'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((total) => {
            const rowLive = square?.total === total
            return (
              <tr key={total} className={rowLive ? 'is-row' : undefined}>
                {total === 0 && (
                  <th scope="rowgroup" rowSpan={8} className="ba-tableau__axis ba-tableau__axis--side">
                    <span>Banker total</span>
                  </th>
                )}
                <th scope="row">{total}</th>
                {COLUMNS.map((v) => {
                  const draws = bankerDraws(total, v)
                  const isLive = rowLive && square!.playerThird === v
                  return (
                    <td
                      key={v ?? 'stood'}
                      className={`cell cell--${draws ? 'H' : 'S'}${isLive ? ' is-live' : ''}`}
                      title={`Banker ${total}, ${v === null ? 'Player stood' : `Player’s third card ${v}`}: ${draws ? 'draws' : 'stands'}`}
                    >
                      {draws ? 'D' : 'S'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        <caption>
          Down the side: the Banker’s two-card total. Across the top: the Player’s third card, or Stood when the Player
          took none. D draws, S stands. The Banker always stands on 7 and higher. After each coup its square is lit.
        </caption>
      </table>
    </div>
  )
}

function lastCoup(square: TableauSquare | null): string {
  if (!square) return 'Last coup: a natural, so nobody drew and the chart never came into it.'
  const against = square.playerThird === null ? 'the Player stood' : `the Player’s third card counts ${square.playerThird}`
  return `Last coup: Banker ${square.total}, ${against} — the Banker ${square.draws ? 'drew' : 'stood'}.`
}
