import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { play } from '../audio'
import { EdgePill } from '../components/EdgePill'
import { IconChevron } from '../components/icons'
import { tipHandlers } from '../components/tip'
import { betTitle, houseEdge, isInside, kindName, payFor, payText, type RouletteBetKind } from '../engine/roulette/bets'
import { edgeBand } from '../engine/edge'
import * as rl from '../engine/roulette/roulette'
import type { RouletteBet } from '../engine/roulette/types'
import { pocketColor, pocketCount, pocketLabel, type WheelType } from '../engine/roulette/wheel'
import { money, signedMoney } from '../lib/format'
import { rouletteAtRisk, useRouletteStore } from '../store/rouletteStore'
import { useRouletteUi } from '../store/tableUi'

/**
 * The rail: every bet on the layout with what it pays and what it costs, what
 * the layout as a whole is worth, and the numbers the wheel has been throwing.
 *
 * Roulette's one lesson is that every bet on a wheel costs the same — so when
 * nothing is down the rail shows exactly that, and the single bet that breaks
 * the rule.
 */
export function Rail() {
  const open = useRouletteUi((s) => s.railOpen)
  const toggle = useRouletteUi((s) => s.toggleRail)
  const game = useRouletteStore((s) => s.game)
  const atRisk = rouletteAtRisk(game)
  const count = Object.keys(game.bets).length

  return (
    <AnimatePresence initial={false} mode="wait">
      {open ? (
        <motion.aside
          key="open"
          className="rail"
          aria-label="Bets and the wheel's history"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        >
          <header className="rail__head">
            <div>
              <span className="eyebrow">Your bets</span>
              <strong className="rail__count">{game.phase === 'settled' ? 'Last spin' : count === 0 ? 'Nothing down' : `${count} on the layout`}</strong>
            </div>
            <div className="rail__risk">
              <span className="eyebrow">At risk</span>
              <strong className="num">{money(atRisk)}</strong>
            </div>
            <button
              type="button"
              className="icon-btn rail__fold"
              onClick={() => {
                play('close')
                toggle()
              }}
              aria-label="Fold the rail"
              title="Fold away · B"
            >
              <IconChevron />
            </button>
          </header>

          <div className="rail__list">{count === 0 ? <PriceCard wheel={game.wheel} /> : <BetList />}</div>
          {count > 0 && <Summary />}
          <History />
        </motion.aside>
      ) : (
        <motion.button
          key="closed"
          type="button"
          className="rail-tab"
          onClick={() => {
            play('open')
            toggle()
          }}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          title="Show the bets · B"
        >
          <span className="rail-tab__label">Your bets</span>
          <strong className="num">{money(atRisk)}</strong>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

const KIND_ORDER: RouletteBetKind[] = ['straight', 'split', 'street', 'trio', 'corner', 'basket', 'sixLine', 'column', 'dozen', 'red', 'black', 'odd', 'even', 'low', 'high']

function BetList() {
  const game = useRouletteStore((s) => s.game)
  const showEdges = useRouletteStore((s) => s.profile.settings.showEdges)
  const placeAt = useRouletteStore((s) => s.placeAt)
  const takeDown = useRouletteStore((s) => s.takeDown)
  const settled = game.phase === 'settled'
  const bets = Object.values(game.bets).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.numbers[0] - b.numbers[0])

  return (
    <div className="ba-prices">
      {bets.map((bet) => {
        const edge = houseEdge(bet, game.wheel)
        const r = settled ? game.resolutions.find((x) => x.betId === bet.id) : undefined
        return (
          <motion.article
            key={bet.id}
            layout
            className={`bet-row bet-row--${edgeBand(edge)} ba-price has-bet${r ? ` is-${r.effect}` : ''}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => placeAt(bet.id)}
            onContextMenu={(event) => {
              event.preventDefault()
              takeDown(bet.id)
            }}
            {...tipHandlers(`rail:${bet.id}`, game.phase !== 'spinning', game.phase === 'betting' ? () => takeDown(bet.id) : undefined)}
          >
            <div className="bet-row__top">
              <span className="bet-row__name">{betTitle(bet)}</span>
              <span className="bet-row__amount num">{money(bet.amount)}</span>
            </div>
            <div className="bet-row__foot">
              <span className="bet-row__pays">
                {payText(bet)}
                {' · '}
                {r ? (
                  <strong className={r.effect === 'win' ? 'tone-win' : 'tone-lose'}>{r.effect === 'win' ? `+${money(r.net)}` : `−${money(r.stake)}`}</strong>
                ) : (
                  <strong>{money(bet.amount * payFor(bet))}</strong>
                )}
              </span>
              {showEdges && <EdgePill edge={edge} />}
            </div>
          </motion.article>
        )
      })}
    </div>
  )
}

/** Every kind of bet on this wheel and what it costs — which, bar one, is the same. */
function PriceCard({ wheel }: { wheel: WheelType }) {
  const showEdges = useRouletteStore((s) => s.profile.settings.showEdges)
  const rows: Array<{ kind: RouletteBetKind; numbers: number[]; label: string }> = [
    { kind: 'straight', numbers: [17], label: 'Straight up · 1 number' },
    { kind: 'split', numbers: [17, 20], label: 'Split · 2' },
    { kind: 'street', numbers: [16, 17, 18], label: 'Street · 3' },
    { kind: 'corner', numbers: [16, 17, 19, 20], label: 'Corner · 4' },
    wheel === 'double'
      ? { kind: 'basket', numbers: [0, 1, 2, 3, 37], label: 'Top Line · 0-00-1-2-3' }
      : { kind: 'basket', numbers: [0, 1, 2, 3], label: 'First Four · 0-1-2-3' },
    { kind: 'sixLine', numbers: [1, 2, 3, 4, 5, 6], label: 'Six Line · 6' },
    { kind: 'dozen', numbers: Array.from({ length: 12 }, (_, i) => i + 1), label: 'Dozen or Column · 12' },
    { kind: 'red', numbers: Array.from({ length: 18 }, (_, i) => i + 1), label: 'Red, Black, Odd, Even, Low, High · 18' },
  ]
  return (
    <section className="ro-prices">
      <p className="ro-prices__lead">
        Click any number, line or box to bet the chip in hand.{' '}
        {wheel === 'double' ? 'On a double-zero wheel every bet costs the same — bar one.' : 'On a single-zero wheel every bet costs the same.'}
      </p>
      {rows.map((row) => {
        const edge = houseEdge(row, wheel)
        return (
          <div key={row.label} className={`ro-price${row.kind === 'basket' && wheel === 'double' ? ' is-worst' : ''}`}>
            <span className="ro-price__name">{row.label}</span>
            <span className="ro-price__pays">{payText(row)}</span>
            {showEdges && <EdgePill edge={edge} label={false} />}
          </div>
        )
      })}
      <p className="ro-prices__foot">
        {kindName('basket', wheel === 'double' ? [0, 1, 2, 3, 37] : [0, 1, 2, 3])}: {wheel === 'double' ? 'five numbers paid at 6 to 1 — the worst bet on the layout.' : 'the European wheel’s first four, paid as a corner.'}
      </p>
    </section>
  )
}

/** What the layout as a whole is worth on the next spin. */
function Summary() {
  const game = useRouletteStore((s) => s.game)
  const showEdges = useRouletteStore((s) => s.profile.settings.showEdges)
  if (game.phase === 'settled') return null
  const s = rl.layoutSummary(game)
  const n = pocketCount(game.wheel)
  const inside = Object.values(game.bets).some((b: RouletteBet) => isInside(b.kind))
  return (
    <section className="ro-summary">
      <div className="ro-summary__row">
        <span className="eyebrow">This layout</span>
        {showEdges && <EdgePill edge={s.edge} label={false} />}
      </div>
      <div className="ro-summary__grid">
        <span>
          <strong className="num">
            {s.covered}/{n}
          </strong>
          numbers covered
        </span>
        <span>
          <strong className="num">{s.ahead}</strong>
          come out ahead
        </span>
        <span>
          <strong className={`num ${s.best > 0 ? 'tone-win' : ''}`}>{signedMoney(s.best)}</strong>
          best number
        </span>
        <span>
          <strong className="num tone-lose">{signedMoney(Math.round(s.expected * 100) / 100, true)}</strong>
          average per spin
        </span>
      </div>
      {inside && rl.insideTotal(game) < game.limits.tableMin && <p className="ro-summary__warn">Inside bets need {money(game.limits.tableMin)} between them</p>}
    </section>
  )
}

/** How many numbers the tote board shows before it is opened out. */
const SHORT_RUN = 15
const BOARD_KEY = 'arena:roulette:board'

/**
 * The tote board: the last numbers, newest first, and how the colours have
 * fallen. It opens out into the full marquee — every number this wheel has
 * thrown this session, ten to a row — and stays open for a player who wants it.
 */
function History() {
  const history = useRouletteStore((s) => s.game.history)
  const wheel = useRouletteStore((s) => s.game.wheel)
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(BOARD_KEY) === 'open'
    } catch {
      return false
    }
  })
  const more = history.length > SHORT_RUN
  const board = open && more
  const shown = board ? history : history.slice(0, SHORT_RUN)
  // The tally covers the marquee when it is open, and the last fifty otherwise.
  const last = board ? history : history.slice(0, 50)
  const count = (c: 'red' | 'black' | 'green') => last.filter((p) => pocketColor(p) === c).length

  const toggle = () => {
    play(open ? 'close' : 'open')
    try {
      localStorage.setItem(BOARD_KEY, open ? 'closed' : 'open')
    } catch {
      // Remembering the board is a nicety, never a requirement.
    }
    setOpen(!open)
  }

  return (
    <section className={`ro-history${board ? ' is-open' : ''}`}>
      <div className="ro-history__head">
        <span className="eyebrow">Last numbers</span>
        {last.length > 0 && (
          <span className="ro-history__tally" title={`The last ${last.length} spin${last.length === 1 ? '' : 's'}`}>
            <span className="tone-banker">R {count('red')}</span>
            <span className="ro-history__black">B {count('black')}</span>
            <span className="tone-tie">Z {count('green')}</span>
          </span>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="ro-history__empty">No spins yet on this wheel</p>
      ) : board ? (
        <motion.div className="ro-history__board" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="ro-history__grid">
            {shown.map((p, i) => (
              <span
                key={`${history.length - i}`}
                className={`ro-num ro-num--${pocketColor(p)}${i === 0 ? ' is-latest' : ''}`}
                title={`${pocketLabel(p)} ${pocketColor(p)} · ${i === 0 ? 'the last spin' : `${i + 1} spins ago`}`}
              >
                {pocketLabel(p)}
              </span>
            ))}
          </div>
          <FairWheel spins={shown.length} wheel={wheel} />
        </motion.div>
      ) : (
        <div className="ro-history__numbers">
          {shown.map((p, i) => (
            <span key={`${history.length - i}`} className={`ro-num ro-num--${pocketColor(p)}${i === 0 ? ' is-latest' : ''}`}>
              {pocketLabel(p)}
            </span>
          ))}
        </div>
      )}
      {more && (
        <button
          type="button"
          className="ro-history__more"
          onClick={toggle}
          aria-expanded={board}
          title={board ? `Back to the last ${SHORT_RUN}` : 'Every number this wheel has thrown this session'}
        >
          {board ? `Show the last ${SHORT_RUN}` : `Show all ${history.length}`}
          <IconChevron className="ro-history__chevron" width={12} height={12} />
        </button>
      )}
    </section>
  )
}

/** What a fair wheel throws over the same run: the marquee's numbers are the noise around it. */
function FairWheel({ spins, wheel }: { spins: number; wheel: WheelType }) {
  const n = pocketCount(wheel)
  const expect = (pockets: number) => Math.round((spins * pockets) / n)
  return (
    <p className="ro-history__fair">
      Newest first, ten to a row. Over {spins} spins a fair wheel averages <span className="tone-banker">R {expect(18)}</span> ·{' '}
      <span className="ro-history__black">B {expect(18)}</span> · <span className="tone-tie">Z {expect(n - 36)}</span>
    </p>
  )
}
