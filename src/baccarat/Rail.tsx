import { AnimatePresence, motion } from 'motion/react'
import { play } from '../audio'
import { EdgePill } from '../components/EdgePill'
import { IconChevron } from '../components/icons'
import { tipHandlers } from '../components/tip'
import { bestBet } from '../engine/baccarat/odds'
import { BACCARAT_BETS, BACCARAT_ORDER } from '../engine/baccarat/rules'
import type { ScoreEntry } from '../engine/baccarat/types'
import { edgeBand } from '../engine/edge'
import { money, percent } from '../lib/format'
import { baccaratAtRisk, useBaccaratStore, useLiveOdds } from '../store/baccaratStore'
import { useBaccaratUi } from '../store/tableUi'
import { potentialWin } from './betInfo'
import { LastCoup } from './LastCoup'

/**
 * The rail: every bet on the layout with what it costs right now, your chips
 * on each, and the shoe as the scoreboard tells it.
 *
 * Baccarat has seven bets and no decisions, so the price list *is* the bet
 * list — the one thing worth knowing about each wager is what the house keeps,
 * and it is on every row.
 */
export function Rail() {
  const open = useBaccaratUi((s) => s.railOpen)
  const toggle = useBaccaratUi((s) => s.toggleRail)
  const game = useBaccaratStore((s) => s.game)
  const atRisk = baccaratAtRisk(game)
  const count = Object.values(game.bets).filter((v) => (v ?? 0) > 0).length

  return (
    <AnimatePresence initial={false} mode="wait">
      {open ? (
        <motion.aside
          key="open"
          className="rail"
          aria-label="Bets and the shoe"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        >
          <header className="rail__head">
            <div>
              <span className="eyebrow">Your bets</span>
              <strong className="rail__count">{game.phase === 'settled' ? 'Last coup' : count === 0 ? 'Nothing down' : `${count} on the felt`}</strong>
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

          <LastCoup />

          <div className="rail__list">
            <PriceList />
          </div>
          <ShoeBox />
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

function PriceList() {
  const game = useBaccaratStore((s) => s.game)
  const showEdges = useBaccaratStore((s) => s.profile.settings.showEdges)
  const placeAt = useBaccaratStore((s) => s.placeAt)
  const takeDown = useBaccaratStore((s) => s.takeDown)
  const live = useLiveOdds()
  const best = bestBet(live.edges)
  const settled = game.phase === 'settled'

  return (
    <div className="ba-prices">
      {BACCARAT_ORDER.map((kind) => {
        const spec = BACCARAT_BETS[kind]
        const amount = game.bets[kind] ?? 0
        const edge = live.edges[kind]
        const r = settled ? game.resolutions.find((x) => x.kind === kind) : undefined
        const win = potentialWin(kind, amount)
        return (
          <motion.article
            key={kind}
            layout
            className={`bet-row bet-row--${edgeBand(edge)} ba-price${amount > 0 ? ' has-bet' : ''}${r ? ` is-${r.effect}` : ''}`}
            onClick={() => placeAt(kind)}
            onContextMenu={(event) => {
              event.preventDefault()
              takeDown(kind)
            }}
            {...tipHandlers(`rail:${kind}`, game.phase !== 'dealt', game.phase === 'betting' && amount > 0 ? () => takeDown(kind) : undefined)}
          >
            <div className="bet-row__top">
              <span className="bet-row__name">
                {spec.title}
                {kind === best && <span className="ba-best">Best bet</span>}
              </span>
              {amount > 0 && <span className="bet-row__amount num">{money(amount)}</span>}
            </div>
            <div className="bet-row__foot">
              <span className="bet-row__pays">
                {spec.pays}
                {amount > 0 && !r && (
                  <>
                    {' · '}
                    {win.upTo ? 'up to ' : ''}
                    <strong>{money(win.amount, true)}</strong>
                  </>
                )}
                {r && (
                  <>
                    {' · '}
                    <strong className={r.effect === 'win' ? 'tone-win' : r.effect === 'lose' ? 'tone-lose' : 'tone-push'}>
                      {r.effect === 'win' ? `+${money(r.net, true)}` : r.effect === 'lose' ? `−${money(r.stake)}` : 'push'}
                    </strong>
                  </>
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

const BEAD_ROWS = 6
const BEAD_COLUMNS = 14

/** The shoe, as the tote board beside a baccarat table tells it. */
function ShoeBox() {
  const game = useBaccaratStore((s) => s.game)
  const live = useLiveOdds()
  const scores = game.scores
  const tally = { player: 0, banker: 0, tie: 0 }
  for (const s of scores) tally[s.winner]++
  // Columns fill top to bottom; once the plate is full it scrolls left a column at a time.
  const start = Math.max(0, Math.ceil(scores.length / BEAD_ROWS) - BEAD_COLUMNS) * BEAD_ROWS
  const plate = scores.slice(start)

  return (
    <section className="ba-shoe">
      <div className="ba-shoe__head">
        <span className="eyebrow">This shoe</span>
        <span className="ba-shoe__tally" title={`${scores.length} coup${scores.length === 1 ? '' : 's'} this shoe`}>
          <span className="tone-player">P {tally.player}</span>
          <span className="tone-banker">B {tally.banker}</span>
          <span className="tone-tie">T {tally.tie}</span>
        </span>
        <span className="ba-shoe__cards">{live.live ? `${live.cardsLeft} cards left` : 'Fresh-shoe odds'}</span>
      </div>
      <div className="ba-shoe__odds">
        <span className="ba-odd ba-odd--player">
          <em>Player</em> {percent(live.odds.player, 1)}
        </span>
        <span className="ba-odd ba-odd--banker">
          <em>Banker</em> {percent(live.odds.banker, 1)}
        </span>
        <span className="ba-odd ba-odd--tie">
          <em>Tie</em> {percent(live.odds.tie, 1)}
        </span>
      </div>
      <div className="ba-plate" style={{ gridTemplateRows: `repeat(${BEAD_ROWS}, 1fr)` }} aria-label="Bead plate">
        {Array.from({ length: BEAD_ROWS * BEAD_COLUMNS }, (_, i) => {
          const s: ScoreEntry | undefined = plate[i]
          return <Bead key={i} entry={s} />
        })}
      </div>
    </section>
  )
}

function Bead({ entry }: { entry?: ScoreEntry }) {
  if (!entry) return <span className="ba-bead is-empty" />
  const total = entry.winner === 'banker' ? entry.bankerTotal : entry.playerTotal
  return (
    <span
      className={`ba-bead ba-bead--${entry.winner}${entry.natural ? ' is-natural' : ''}`}
      title={`${entry.winner === 'tie' ? 'Tie' : entry.winner === 'banker' ? 'Banker' : 'Player'} · ${entry.playerTotal}–${entry.bankerTotal}${entry.natural ? ' · natural' : ''}${entry.playerPair ? ' · Player pair' : ''}${entry.bankerPair ? ' · Banker pair' : ''}`}
    >
      {total}
      {entry.playerPair && <i className="ba-bead__pp" />}
      {entry.bankerPair && <i className="ba-bead__bp" />}
    </span>
  )
}
