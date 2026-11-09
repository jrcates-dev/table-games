import { AnimatePresence, motion } from 'motion/react'
import { play } from '../audio'
import { EdgePill } from '../components/EdgePill'
import { IconChevron } from '../components/icons'
import { tipHandlers } from '../components/tip'
import { edgeBand } from '../engine/edge'
import { FORTUNE_ORDER, FORTUNE_PAYS } from '../engine/paigow/fortune'
import type { PaiGowBetKind } from '../engine/paigow/types'
import { money, percent } from '../lib/format'
import { paigowAtRisk, usePaiGowStore } from '../store/paigowStore'
import { usePaiGowUi } from '../store/tableUi'
import { FORTUNE_EDGE, mainEdge } from './betInfo'

/**
 * The rail: your two bets with what each pays and costs, and the coach's
 * scorecard — how often your sets have matched the house way, and what the
 * ones that did not have cost.
 */
export function Rail() {
  const open = usePaiGowUi((s) => s.railOpen)
  const toggle = usePaiGowUi((s) => s.toggleRail)
  const game = usePaiGowStore((s) => s.game)
  const atRisk = paigowAtRisk(game)

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
  const game = usePaiGowStore((s) => s.game)
  const showEdges = usePaiGowStore((s) => s.profile.settings.showEdges)
  const placeAt = usePaiGowStore((s) => s.placeAt)
  const takeDown = usePaiGowStore((s) => s.takeDown)
  const done = game.phase === 'showdown'
  const open = game.phase === 'betting' || game.phase === 'showdown'
  const rows: Array<{ kind: PaiGowBetKind; title: string; pays: string; edge: number }> = [
    { kind: 'wager', title: 'Bet', pays: game.rules.commissionFree ? 'Win both · 1 to 1, no commission' : 'Win both · 1 to 1 less 5%', edge: mainEdge(game.rules) },
    { kind: 'fortune', title: 'Fortune', pays: `Straight ${FORTUNE_PAYS.straight} to 1 up to ${FORTUNE_PAYS[FORTUNE_ORDER[0]].toLocaleString()} to 1`, edge: FORTUNE_EDGE },
  ]
  return (
    <div className="ba-prices">
      {rows.map((row) => {
        const amount = game.bets[row.kind]
        const r = done ? game.resolutions.find((x) => x.kind === row.kind) : undefined
        return (
          <article
            key={row.kind}
            className={`bet-row bet-row--${edgeBand(row.edge)} ba-price${amount > 0 ? ' has-bet' : ''}${r ? ` is-${r.effect}` : ''}`}
            onClick={() => placeAt(row.kind)}
            onContextMenu={(event) => {
              event.preventDefault()
              takeDown(row.kind)
            }}
            {...tipHandlers(`rail:${row.kind}`, open, game.phase === 'betting' && amount > 0 ? () => takeDown(row.kind) : undefined)}
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
              {showEdges && <EdgePill edge={row.edge} label={false} />}
            </div>
          </article>
        )
      })}
      {showEdges && (
        <p className="pg-rail__note">
          Set the house way, the bet costs {percent(mainEdge(game.rules), 2)} — and four hands in ten push, so it costs slowly. Fortune is a separate bet with its own, much higher, price.
        </p>
      )}
    </div>
  )
}

/** Your sets against the house way's, this run and the hand just played. */
function Scorecard() {
  const coach = usePaiGowStore((s) => s.profile.settings.coach)
  const stats = usePaiGowStore((s) => s.profile.stats)
  const last = usePaiGowStore((s) => s.profile.history[0])
  if (!coach) return null
  const share = stats.hands > 0 ? stats.houseWaySets / stats.hands : null
  return (
    <section className="ro-history pg-score">
      <div className="ro-history__head">
        <span className="eyebrow">By the house way</span>
        {share !== null && <span className="ba-shoe__cards">{percent(share, 0)} of your hands</span>}
      </div>
      {!last ? (
        <p className="ro-history__empty">Each hand you set, against the house way, lands here.</p>
      ) : (
        <ul className="pg-score__list">
          <li className={last.houseWay ? 'is-right' : 'is-wrong'}>
            <span>Last hand</span>
            <strong>
              {last.playerHigh} · {last.playerLowName}
            </strong>
            <em>
              {last.outcome === 'foul'
                ? 'foul'
                : last.houseWay
                  ? '✓ house way'
                  : last.evCost !== null && last.evCost >= 0.005
                    ? `cost ${last.evCost.toFixed(2)} a bet`
                    : 'off the house way, at no real cost'}
            </em>
          </li>
          {stats.valued > 0 && (
            <li className="is-total">
              <span>This profile</span>
              <strong>{stats.foulsAvoided} fouls caught</strong>
              <em>gave up {(stats.evGivenUp / stats.valued).toFixed(3)} a bet a hand</em>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
