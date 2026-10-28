import { AnimatePresence, motion } from 'motion/react'
import { useRef } from 'react'
import { play } from '../audio'
import { forFinger } from '../components/tip'
import { useTipPlacement } from '../components/tipPlace'
import * as craps from '../engine/craps/craps'
import { useCrapsStore } from '../store/crapsStore'
import { BAND_LABEL, describeBet, edgeText, loseCondition, oddsLimitText, winCondition } from './betInfo'
import { resolveSpot, stakeHint, useHover } from './interaction'

/**
 * The card that follows the pointer over the felt: what the box under it is,
 * what it pays, what wins and loses it, and what the house keeps. Everything
 * is read from the same catalogue the settler pays from.
 */
export function SpotTooltip() {
  const spot = useHover((s) => s.spot)
  const x = useHover((s) => s.x)
  const y = useHover((s) => s.y)
  const pinned = useHover((s) => s.pinned)
  const takeDown = useHover((s) => s.takeDown)
  const game = useCrapsStore((s) => s.game)
  const mode = useCrapsStore((s) => s.numberMode)
  const showEdges = useCrapsStore((s) => s.profile.settings.showEdges)
  const ref = useRef<HTMLDivElement>(null)
  const translate = useTipPlacement(ref, x, y, spot, pinned)

  const resolved = spot ? resolveSpot(spot, game, mode) : null
  const info = resolved ? describeBet(resolved.kind, resolved.number, game.point) : null
  const check = resolved ? craps.canPlace(game, resolved.kind, resolved.number) : null
  const oddsRule = resolved ? oddsLimitText(game, resolved.kind, resolved.number) : null

  return (
    <AnimatePresence>
      {spot && resolved && info && check && (
        <motion.div
          ref={ref}
          key="tip"
          className={`spot-tip spot-tip--${info.band}${check.ok ? '' : ' is-blocked'}${pinned ? ' is-pinned' : ''}`}
          data-pinned-tip={pinned || undefined}
          style={{ left: x, top: y, translate }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ duration: 0.14 }}
        >
          <div className="spot-tip__head">
            <strong>{info.title}</strong>
            <span>{info.payout}</span>
          </div>
          <div className="spot-tip__rows">
            <div>
              <em className="tone-win">Wins</em>
              <span>{winCondition(resolved.kind, resolved.number, game.point)}</span>
            </div>
            <div>
              <em className="tone-lose">Loses</em>
              <span>{loseCondition(resolved.kind, resolved.number, game.point)}</span>
            </div>
          </div>
          {showEdges && (
            <div className="spot-tip__edge">
              <span className={`edge-pill edge-pill--${info.band}`}>{BAND_LABEL[info.band]}</span>
              {edgeText(info.edge)}
            </div>
          )}
          {check.ok ? (
            <>
              <div className="spot-tip__hint">
                {pinned ? forFinger(stakeHint(game, resolved.kind, resolved.number)) : stakeHint(game, resolved.kind, resolved.number)}
              </div>
              {oddsRule && <div className="spot-tip__limit">{oddsRule}</div>}
              {spot.numberBox && <div className="spot-tip__mode">Box numbers: {mode === 'odds' ? 'odds on your come bet' : `${mode} bet`}</div>}
            </>
          ) : (
            <div className="spot-tip__reason">{check.reason}</div>
          )}
          {pinned && takeDown && (
            <button
              type="button"
              className="btn btn--ghost btn--sm spot-tip__take"
              onClick={() => {
                play('click')
                takeDown()
                useHover.getState().set(null)
              }}
            >
              Take down
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
