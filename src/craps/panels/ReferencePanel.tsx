import { payoutText, spec } from '../../engine/craps/bets'
import type { BetKind } from '../../engine/craps/types'
import { useCrapsStore } from '../../store/crapsStore'
import { BAND_LABEL, describeBet, loseCondition, totalsText, winCondition } from '../betInfo'

/**
 * The craps equivalent of the blackjack book.
 *
 * Blackjack's card tells you what to *do*; craps has no correct play, only
 * correct prices. So this is a price list — every wager the Aria layout takes,
 * what it pays, what it needs and what it costs you, sorted best to worst
 * within each part of the table. Every number is pulled from the catalogue the
 * settler pays from, so the card cannot drift from the game.
 */
interface Row {
  kind: BetKind
  number?: number
  label?: string
}

const GROUPS: Array<{ title: string; note: string; rows: Row[] }> = [
  {
    title: 'The line',
    note: 'Where every round starts, and the cheapest real estate on the table.',
    rows: [{ kind: 'dontPass' }, { kind: 'dontCome' }, { kind: 'passLine' }, { kind: 'come' }],
  },
  {
    title: 'Odds',
    note: 'Taken behind a bet you already have and paid at true odds — the only wager in the building with no house edge. Aria allows 3-4-5x, enough to drag a pass line bet from 1.41% down to about 0.37%.',
    rows: [
      { kind: 'passOdds', number: 6, label: 'Odds on the 6 or 8' },
      { kind: 'passOdds', number: 5, label: 'Odds on the 5 or 9' },
      { kind: 'passOdds', number: 4, label: 'Odds on the 4 or 10' },
      { kind: 'dontPassOdds', number: 6, label: "Don't odds on the 6 or 8" },
      { kind: 'dontPassOdds', number: 5, label: "Don't odds on the 5 or 9" },
      { kind: 'dontPassOdds', number: 4, label: "Don't odds on the 4 or 10" },
    ],
  },
  {
    title: 'The box numbers',
    note: 'Bet a number directly. Buying the 4 or 10 beats placing it; buying the 6 or 8 is three times worse.',
    rows: [
      { kind: 'place', number: 6, label: 'Place the 6 or 8' },
      { kind: 'lay', number: 4, label: 'Lay the 4 or 10' },
      { kind: 'lay', number: 5, label: 'Lay the 5 or 9' },
      { kind: 'lay', number: 6, label: 'Lay the 6 or 8' },
      { kind: 'place', number: 5, label: 'Place the 5 or 9' },
      { kind: 'buy', number: 4, label: 'Buy the 4 or 10' },
      { kind: 'buy', number: 6, label: 'Buy the 6 or 8' },
      { kind: 'place', number: 4, label: 'Place the 4 or 10' },
    ],
  },
  {
    title: 'The field',
    note: 'Seven numbers out of eleven — which looks generous until you notice the four it misses are the four that come up most. Aria pays triple on the 12, which keeps it under 3%.',
    rows: [{ kind: 'field' }],
  },
  {
    title: 'Hardways',
    note: 'The number thrown as a pair. Stays up and can win again; loses to the easy way and to any 7.',
    rows: [
      { kind: 'hard', number: 6, label: 'Hard 6 or 8' },
      { kind: 'hard', number: 4, label: 'Hard 4 or 10' },
    ],
  },
  {
    title: 'The centre',
    note: 'One-roll bets, called out to the stickman. Every one is expensive; the Any Seven is the worst bet on any table in Nevada.',
    rows: [{ kind: 'anyCraps' }, { kind: 'ce' }, { kind: 'three' }, { kind: 'eleven' }, { kind: 'horn' }, { kind: 'two' }, { kind: 'twelve' }, { kind: 'world' }, { kind: 'any7' }],
  },
  {
    title: 'Side bets',
    note: 'Made before a new shooter takes the dice and settled at the seven-out. Enormous payouts, priced accordingly — a lottery ticket, not a strategy.',
    rows: [{ kind: 'small' }, { kind: 'tall' }, { kind: 'fire' }, { kind: 'all' }],
  },
]

function conditionFor(kind: BetKind): string {
  switch (kind) {
    case 'small':
      return `${totalsText([2, 3, 4, 5, 6])} — all of them`
    case 'tall':
      return `${totalsText([8, 9, 10, 11, 12])} — all of them`
    case 'all':
      return 'every number except 7'
    case 'fire':
      return '4, 5 or 6 different points'
    default:
      return '—'
  }
}

export function ReferencePanel() {
  const showEdges = useCrapsStore((s) => s.profile.settings.showEdges)
  const point = useCrapsStore((s) => s.game.point)

  return (
    <div className="reference">
      <section className="reference__primer">
        <h3 className="form-section__title">How a round works</h3>
        <ol>
          <li>
            <strong>The come-out.</strong> The puck is <em>OFF</em>. A 7 or 11 wins the pass line at once; 2, 3 or 12 loses it. Anything else becomes <em>the point</em>.
          </li>
          <li>
            <strong>The point.</strong> The puck flips <em>ON</em> and moves to that number. Now the shooter needs it again before a 7.
          </li>
          <li>
            <strong>Back it with odds.</strong> Once there is a point, click the pass line again — or press Max odds — to take free odds behind your bet. It is the single best habit in craps.
          </li>
          <li>
            <strong>Seven out.</strong> A 7 before the point ends the shoot: the line, come bets, place bets and side bets all lose. A new come-out begins.
          </li>
        </ol>
        <p className="reference__note">
          Place, buy, hardway and come-odds bets are <em>off</em> on a come-out unless you turn them on — so a come-out 7 returns them rather than taking them. Contract bets — the pass line once a point is up, come bets, side bets — cannot come down; that is the trade for the come-out being in your favour.
        </p>
      </section>

      {GROUPS.map((group) => (
        <section key={group.title} className="reference__group">
          <h3 className="form-section__title">{group.title}</h3>
          <p className="reference__note">{group.note}</p>
          <div className="reference__rows">
            {group.rows
              .map((row) => ({ row, info: describeBet(row.kind, row.number, point) }))
              .sort((a, b) => a.info.edge - b.info.edge)
              .map(({ row, info }) => (
                <div key={`${row.kind}-${row.number ?? ''}`} className="reference__row">
                  <div className="reference__main">
                    <strong>{row.label ?? info.title}</strong>
                    <span className="reference__pays">{payoutText(row.kind, row.number)}</span>
                  </div>
                  <div className="reference__detail">
                    <span>
                      <em className="tone-win">Wins</em> {spec(row.kind).newShootOnly ? conditionFor(row.kind) : winCondition(row.kind, row.number, point)}
                    </span>
                    <span>
                      <em className="tone-lose">Loses</em> {loseCondition(row.kind, row.number, point)}
                    </span>
                  </div>
                  {showEdges && (
                    <div className="reference__edge">
                      <span className={`edge-pill edge-pill--${info.band}`}>
                        {info.edge === 0 ? 'No edge' : `${(info.edge * 100).toFixed(2)}%`} · {BAND_LABEL[info.band]}
                      </span>
                      <span className={`edge-bar edge-bar--${info.band}`}>
                        <i style={{ width: `${Math.min(100, (info.edge / 0.21) * 100)}%` }} />
                      </span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}

      <p className="chart__foot">
        Every figure is the house's expected win per dollar of that bet's own stake, so the whole card is comparable. Buy figures count the commission as part of the bet. Lay figures assume the 5% comes out of the win, with a $1 minimum; tables that take it up front instead charge 2.44%, 3.23% and 4.00%. The layout, payouts and 3-4-5x odds follow Aria: the field pays double on the 2 and triple on the 12, and there is no Big 6 or Big 8.
      </p>
    </div>
  )
}
