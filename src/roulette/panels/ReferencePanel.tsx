import { EdgeBar, EdgePill } from '../../components/EdgePill'
import { houseEdge, payText, winProbability, type RouletteBetKind } from '../../engine/roulette/bets'
import { ROULETTE_LIMITS, WHEEL_NAME, WHEEL_ROOM } from '../../engine/roulette/rules'
import { DOUBLE_ZERO, type WheelType } from '../../engine/roulette/wheel'
import { money, percent } from '../../lib/format'
import { useRouletteStore } from '../../store/rouletteStore'

interface Row {
  kind: RouletteBetKind
  title: string
  covers: string
  where: string
  numbers: { double: number[]; single: number[] }
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

const ROWS: Row[] = [
  { kind: 'straight', title: 'Straight up', covers: '1 number', where: 'In the middle of a number', numbers: { double: [17], single: [17] } },
  { kind: 'split', title: 'Split', covers: '2 numbers', where: 'On the line between two numbers', numbers: { double: [17, 20], single: [17, 20] } },
  { kind: 'street', title: 'Street', covers: '3 numbers', where: 'On the outside line of a column of three', numbers: { double: [16, 17, 18], single: [16, 17, 18] } },
  { kind: 'trio', title: 'Trio', covers: '3, with a zero', where: 'Where a zero meets two numbers', numbers: { double: [0, 1, 2], single: [0, 1, 2] } },
  { kind: 'corner', title: 'Corner', covers: '4 numbers', where: 'Where four numbers meet', numbers: { double: [16, 17, 19, 20], single: [16, 17, 19, 20] } },
  { kind: 'basket', title: 'Top Line · First Four', covers: '0-00-1-2-3 · 0-1-2-3', where: 'On the corner where the zeros meet the 1 and the outside line', numbers: { double: [0, 1, 2, 3, DOUBLE_ZERO], single: [0, 1, 2, 3] } },
  { kind: 'sixLine', title: 'Six Line', covers: '6 numbers', where: 'On the outside line, between two streets', numbers: { double: range(1, 6), single: range(1, 6) } },
  { kind: 'column', title: 'Column', covers: '12 numbers', where: 'The 2 to 1 box at the end of a row', numbers: { double: range(1, 12), single: range(1, 12) } },
  { kind: 'dozen', title: 'Dozen', covers: '12 numbers', where: '1st, 2nd or 3rd 12', numbers: { double: range(1, 12), single: range(1, 12) } },
  { kind: 'red', title: 'Red · Black · Odd · Even · 1–18 · 19–36', covers: '18 numbers', where: 'The even-money boxes nearest you', numbers: { double: range(1, 18), single: range(1, 18) } },
]

/**
 * Roulette's book. There is nothing to play well — every bet on a wheel is
 * priced off the same zeros — so the book is the price list, the one bet that
 * breaks it, and the reason the wheel you sit at matters more than any bet
 * you make on it.
 */
export function RouletteReferencePanel() {
  const wheel = useRouletteStore((s) => s.game.wheel)
  const showEdges = useRouletteStore((s) => s.profile.settings.showEdges)
  const other: WheelType = wheel === 'double' ? 'single' : 'double'

  return (
    <div className="reference">
      <section className="reference__primer">
        <h3 className="form-section__title">How a spin works</h3>
        <ol>
          <li>
            <strong>Bet on the layout.</strong> A chip in a number, on a line between numbers, or in an outside box. Inside bets must reach the table minimum between them; each outside bet must reach it on its own.
          </li>
          <li>
            <strong>No more bets.</strong> The dealer spins the head one way and sends the ball round the other. Once it drops, the layout is closed.
          </li>
          <li>
            <strong>The dolly.</strong> The dealer marks the winning number, rakes every losing bet, and pays the winners — a bet keeps its stake and is paid its odds on top.
          </li>
          <li>
            <strong>The zeros.</strong> Green is not red, black, odd, even, low or high. In Las Vegas a zero takes every even-money bet whole — there is no <em>en prison</em> and no <em>la partage</em>.
          </li>
        </ol>
      </section>

      <section className="reference__group">
        <h3 className="form-section__title">Which wheel</h3>
        <div className="ro-wheels">
          {(['double', 'single'] as const).map((w) => (
            <div key={w} className={`ro-wheel-card${w === wheel ? ' is-current' : ''}`}>
              <strong>{WHEEL_NAME[w]}</strong>
              <span className="reference__note">
                {WHEEL_ROOM[w]} · {money(ROULETTE_LIMITS[w].tableMin)} minimum · {w === 'double' ? '38 pockets' : '37 pockets'}
              </span>
              {showEdges && <EdgePill edge={houseEdge({ kind: 'straight', numbers: [1] }, w)} />}
            </div>
          ))}
        </div>
        <p className="reference__note">
          Every bet pays as though the wheel had 36 numbers. The house edge is simply the zeros’ share of the wheel: 2 in 38 on the double-zero head, 1 in 37 on the single. Changing wheels roughly halves what the
          game costs — nothing you do on the layout comes close. Switch in Settings.
        </p>
      </section>

      <section className="reference__group">
        <h3 className="form-section__title">Every bet, priced</h3>
        <p className="reference__note">
          The first figure is this wheel ({WHEEL_NAME[wheel].toLowerCase()}); the pill after it is the same bet on the {WHEEL_NAME[other].toLowerCase()} wheel.
        </p>
        <div className="reference__rows">
          {ROWS.map((row) => {
            const def = { kind: row.kind, numbers: row.numbers[wheel] }
            const edge = houseEdge(def, wheel)
            const otherEdge = houseEdge({ kind: row.kind, numbers: row.numbers[other] }, other)
            return (
              <div key={row.kind} className={`reference__row${row.kind === 'basket' && wheel === 'double' ? ' is-warning' : ''}`}>
                <div className="reference__main">
                  <strong>{row.title}</strong>
                  <span className="reference__pays">{payText(def)}</span>
                </div>
                <div className="reference__detail">
                  <span>
                    <em className="tone-win">Covers</em> {row.kind === 'basket' ? (wheel === 'double' ? '0-00-1-2-3' : '0-1-2-3') : row.covers} · wins {percent(winProbability(def, wheel), 1)}
                  </span>
                  <span>
                    <em>Where</em> {row.where}
                  </span>
                </div>
                {showEdges && (
                  <div className="reference__edge">
                    <EdgePill edge={edge} />
                    <EdgeBar edge={edge} worst={0.1} />
                    <span className="reference__live">
                      {other === 'single' ? 'single 0' : 'double 0'} <EdgePill edge={otherEdge} label={false} />
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <p className="chart__foot">
        Every figure is exact: the chance of the bet’s numbers coming up, times what it pays, against the stake. Aria deals double-zero roulette on the main floor and keeps single-zero wheels in the high-limit
        room; the limits here are typical of the Strip, and each table posts its own.
      </p>
    </div>
  )
}
