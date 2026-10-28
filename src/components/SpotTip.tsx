import { AnimatePresence, motion } from 'motion/react'
import { useRef } from 'react'
import { play } from '../audio'
import { EDGE_LABEL, edgeBand } from '../engine/edge'
import { forFinger, useTip, type TipContent } from './tip'
import { useTipPlacement } from './tipPlace'

/**
 * The card that follows the pointer over a layout: what the spot is, what it
 * pays, what wins and loses it, and what the house keeps.
 *
 * The craps felt has its own, because a craps box means different bets
 * depending on the point and the mode. Everywhere else a spot is just a bet,
 * so one tooltip serves every table: a spot reports its id on hover, and the
 * table says what that id means as the game stands now.
 */

export function SpotTip({ describe }: { describe(id: string): TipContent | null }) {
  const id = useTip((s) => s.id)
  const x = useTip((s) => s.x)
  const y = useTip((s) => s.y)
  const pinned = useTip((s) => s.pinned)
  const takeDown = useTip((s) => s.takeDown)
  const ref = useRef<HTMLDivElement>(null)
  const tip = id ? describe(id) : null
  const translate = useTipPlacement(ref, x, y, id, pinned)

  const band = tip?.edge === undefined ? 'fair' : edgeBand(tip.edge)

  return (
    <AnimatePresence>
      {tip && (
        <motion.div
          ref={ref}
          key="tip"
          className={`spot-tip spot-tip--${band}${tip.reason ? ' is-blocked' : ''}${pinned ? ' is-pinned' : ''}`}
          data-pinned-tip={pinned || undefined}
          style={{ left: x, top: y, translate }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ duration: 0.14 }}
        >
          <div className="spot-tip__head">
            <strong>{tip.title}</strong>
            <span>{tip.pays}</span>
          </div>
          {(tip.wins || tip.loses) && (
            <div className="spot-tip__rows">
              {tip.wins && (
                <div>
                  <em className="tone-win">Wins</em>
                  <span>{tip.wins}</span>
                </div>
              )}
              {tip.loses && (
                <div>
                  <em className="tone-lose">Loses</em>
                  <span>{tip.loses}</span>
                </div>
              )}
            </div>
          )}
          {tip.edge !== undefined && (
            <div className="spot-tip__edge">
              <span className={`edge-pill edge-pill--${band}`}>{tip.edge < 0 ? 'Advantage' : EDGE_LABEL[band]}</span>
              {edgeWords(tip.edge)}
              {tip.edgeNote && <span className="spot-tip__note">{tip.edgeNote}</span>}
            </div>
          )}
          {tip.shoeEdge !== undefined && (
            <div className="spot-tip__shoe">
              <span>{tip.shoeNote ?? 'This shoe'}</span>
              <strong className={tip.shoeEdge < 0 ? 'tone-win' : undefined}>{edgeWords(tip.shoeEdge)}</strong>
            </div>
          )}
          {tip.reason ? (
            <div className="spot-tip__reason">{tip.reason}</div>
          ) : (
            tip.hint && <div className="spot-tip__hint">{pinned ? forFinger(tip.hint) : tip.hint}</div>
          )}
          {pinned && takeDown && <TakeDownButton id={id!} takeDown={takeDown} />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** An edge in words: what the house keeps, or what you do once the cards have turned. */
function edgeWords(edge: number): string {
  if (edge === 0) return 'no house edge'
  return edge < 0 ? `${(-edge * 100).toFixed(2)}% in your favour` : `${(edge * 100).toFixed(2)}% house edge`
}

/** On a card held open by a finger, the finger's right-click. */
function TakeDownButton({ id, takeDown }: { id: string; takeDown(): void }) {
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm spot-tip__take"
      onClick={() => {
        play('click')
        takeDown()
        useTip.getState().hide(id)
      }}
    >
      Take down
    </button>
  )
}
