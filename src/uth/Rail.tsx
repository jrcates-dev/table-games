import { AnimatePresence, motion } from 'motion/react'
import { play } from '../audio'
import { EdgePill } from '../components/EdgePill'
import { IconChevron } from '../components/icons'
import { tipHandlers } from '../components/tip'
import { edgeBand } from '../engine/edge'
import { TRIPS_TABLES, tripsEdge, UTH_ELEMENT_OF_RISK, UTH_HOUSE_EDGE } from '../engine/uth/rules'
import type { UthBetKind } from '../engine/uth/types'
import { money, percent } from '../lib/format'
import { uthAtRisk, useUthStore } from '../store/uthStore'
import { useUthUi } from '../store/tableUi'
import { DECISION_LABEL } from './betInfo'

/**
 * The rail: your four bets with what each pays and costs, and the coach's
 * scorecard for the hand — every decision you made against the book's.
 */
export function Rail() {
  const open = useUthUi((s) => s.railOpen)
  const toggle = useUthUi((s) => s.toggleRail)
  const game = useUthStore((s) => s.game)
  const atRisk = uthAtRisk(game)

  return (
    <AnimatePresence initial={false} mode="wait">
      {open ? (
        <motion.aside
          key="open"
          className="rail"
          aria-label="Bets and the coach"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        >
          <header className="rail__head">
            <div>
              <span className="eyebrow">Your bets</span>
              <strong className="rail__count">{game.phase === 'showdown' ? 'Last hand' : atRisk === 0 ? 'Nothing down' : game.phase === 'betting' ? 'Ready to deal' : 'In play'}</strong>
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

          <div className="rail__list">
            <BetRows />
          </div>
          <Scorecard />
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

function BetRows() {
  const game = useUthStore((s) => s.game)
  const showEdges = useUthStore((s) => s.profile.settings.showEdges)
  const placeAt = useUthStore((s) => s.placeAt)
  const takeDown = useUthStore((s) => s.takeDown)
  const done = game.phase === 'showdown'
  const table = TRIPS_TABLES[game.tripsTable]
  const rows: Array<{ kind: UthBetKind; title: string; pays: string; edge?: number; note?: string }> = [
    { kind: 'ante', title: 'Ante', pays: '1 to 1 · pushes if the dealer does not open', edge: UTH_HOUSE_EDGE, note: 'the game' },
    { kind: 'blind', title: 'Blind', pays: 'Straight 1 to 1 up to royal 500 to 1' },
    { kind: 'play', title: game.raise > 0 ? `Play · ${game.raise}x` : 'Play', pays: '1 to 1 · 4x, 3x, 2x or 1x the Ante' },
    { kind: 'trips', title: 'Trips', pays: `Trips or better · ${table.name}`, edge: tripsEdge(table) },
  ]
  return (
    <div className="ba-prices">
      {rows.map((row) => {
        const amount = game.bets[row.kind]
        const r = done ? game.resolutions.find((x) => x.kind === row.kind) : undefined
        const clickable = row.kind === 'ante' || row.kind === 'trips'
        const target = row.kind === 'trips' ? 'trips' : 'ante'
        return (
          <article
            key={row.kind}
            className={`bet-row bet-row--${row.edge === undefined ? 'low' : edgeBand(row.edge)} ba-price${amount > 0 ? ' has-bet' : ''}${r ? ` is-${r.effect}` : ''}${clickable ? '' : ' is-static'}`}
            onClick={() => clickable && placeAt(target)}
            onContextMenu={(event) => {
              event.preventDefault()
              if (clickable) takeDown(target)
            }}
            {...tipHandlers(`rail:${row.kind}`, clickable && (game.phase === 'betting' || game.phase === 'showdown'), game.phase === 'betting' && clickable && amount > 0 ? () => takeDown(target) : undefined)}
          >
            <div className="bet-row__top">
              <span className="bet-row__name">{row.title}</span>
              {amount > 0 && <span className="bet-row__amount num">{money(amount)}</span>}
            </div>
            <div className="bet-row__foot">
              <span className="bet-row__pays">
                {r ? (
                  <>
                    {r.note} ·{' '}
                    <strong className={r.effect === 'win' ? 'tone-win' : r.effect === 'lose' ? 'tone-lose' : 'tone-push'}>
                      {r.effect === 'win' ? `+${money(r.net, true)}` : r.effect === 'lose' ? `−${money(r.stake)}` : 'push'}
                    </strong>
                  </>
                ) : (
                  row.pays
                )}
              </span>
              {showEdges && row.edge !== undefined && <EdgePill edge={row.edge} label={false} />}
            </div>
          </article>
        )
      })}
      {showEdges && (
        <p className="uth-rail__note">
          The Ante and Blind together cost {percent(UTH_HOUSE_EDGE, 2)} of the Ante played by the book — {percent(UTH_ELEMENT_OF_RISK, 2)} of everything you put out, since the Play bet is where good play
          wins it back. Trips is a separate bet with its own price.
        </p>
      )}
    </div>
  )
}

const STREET: Record<string, string> = { preflop: 'Before the flop', flop: 'On the flop', river: 'On the river' }

/** The hand so far, decision by decision, against the book. */
function Scorecard() {
  const calls = useUthStore((s) => s.calls)
  const coach = useUthStore((s) => s.profile.settings.coach)
  const stats = useUthStore((s) => s.profile.stats)
  if (!coach) return null
  const share = stats.decisions > 0 ? stats.bookDecisions / stats.decisions : null
  return (
    <section className="ro-history uth-score">
      <div className="ro-history__head">
        <span className="eyebrow">By the book</span>
        {share !== null && <span className="ba-shoe__cards">{percent(share, 0)} of your decisions</span>}
      </div>
      {calls.length === 0 ? (
        <p className="ro-history__empty">Each decision this hand, against the book’s, lands here.</p>
      ) : (
        <ul className="uth-score__list">
          {calls.map((c, i) => {
            const right = c.advice.decision === c.chosen
            return (
              <li key={i} className={right ? 'is-right' : 'is-wrong'}>
                <span>{STREET[c.advice.street]}</span>
                <strong>{DECISION_LABEL[c.chosen]}</strong>
                <em>{right ? '✓ book' : `book: ${c.advice.headline}`}</em>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
