import { useRef } from 'react'
import { play } from '../audio'
import { pickOrPlace, type Describe } from '../components/pick'
import * as craps from '../engine/craps/craps'
import { startHold } from '../lib/touch'
import { useCrapsStore } from '../store/crapsStore'
import { describeBet } from './betInfo'
import { betsOn, resolveSpot, useHover } from './interaction'
import { PLANE, SPOTS, shapePath, type Spot } from './layout'

/**
 * The click targets: the very same shapes the felt prints, laid over it.
 *
 * Left-click puts the chip in hand on the spot; right-click takes the bet
 * there back down. A finger taps to bet, and holds to read the spot, with the
 * take-down on the card that opens. Chips on the felt carry no handlers of
 * their own — if they did, adding to a bet and taking it down would be the
 * same click landing a few pixels apart.
 */
export function SpotLayer() {
  const game = useCrapsStore((s) => s.game)
  const mode = useCrapsStore((s) => s.numberMode)
  const placeAt = useCrapsStore((s) => s.placeAt)
  const takeDown = useCrapsStore((s) => s.takeDown)
  const setHover = useHover((s) => s.set)
  const move = useHover((s) => s.move)
  const frame = useRef(0)

  const onMove = (event: React.PointerEvent) => {
    if (event.pointerType === 'touch') return
    const { clientX, clientY } = event
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => move(clientX, clientY))
  }

  const click = (spot: Spot) => {
    const { kind, number } = resolveSpot(spot, game, mode)
    placeAt(kind, number)
  }

  const byId = (id: string) => SPOTS.find((spot) => spot.id === id)

  const describe: Describe = (id) => {
    const spot = byId(id)
    if (!spot) return null
    const { kind, number } = resolveSpot(spot, game, mode)
    if (!craps.canPlace(game, kind, number).ok) return null
    const info = describeBet(kind, number, game.point)
    return { title: info.title, pays: info.payout }
  }

  // The bet in a box that a take-down means: the one a click there would add to, else whatever is there.
  const betAt = (spot: Spot) => {
    const { kind, number } = resolveSpot(spot, game, mode)
    const here = betsOn(spot, game)
    return here.find((bet) => bet.id === craps.betId(kind, number)) ?? here[0]
  }

  const takeDownAt = (spot: Spot) => {
    const target = betAt(spot)
    if (target) takeDown(target.id)
  }

  return (
    <svg className="cr-spots" width={PLANE.w} height={PLANE.h} viewBox={`0 0 ${PLANE.w} ${PLANE.h}`}>
      {SPOTS.map((spot) => {
        const { kind, number } = resolveSpot(spot, game, mode)
        const allowed = craps.canPlace(game, kind, number).ok
        return (
          <path
            key={spot.id}
            d={shapePath(spot.shape)}
            className={`cr-spot cr-spot--${spot.tone}${allowed ? '' : ' is-blocked'}`}
            data-spot={spot.id}
            onPointerEnter={(event) => {
              if (event.pointerType === 'touch') return
              setHover(spot, event.clientX, event.clientY)
              if (allowed) play('hover')
            }}
            onPointerMove={onMove}
            onPointerLeave={(event) => {
              if (event.pointerType !== 'touch' && useHover.getState().spot?.id === spot.id) setHover(null)
            }}
            onPointerDown={(event) =>
              startHold(event, (x, y) => {
                const target = betAt(spot)
                const removable = target && game.phase !== 'rolling' && craps.canRemove(target, game.point)
                useHover.getState().pin(spot, x, y, removable ? () => takeDown(target.id) : undefined)
                return () => {
                  if (useHover.getState().spot?.id === spot.id) setHover(null)
                }
              })
            }
            onClick={(event) =>
              pickOrPlace(
                event,
                spot.id,
                (id) => {
                  const chosen = byId(id)
                  if (chosen) click(chosen)
                },
                describe,
              )
            }
            onContextMenu={(event) => {
              event.preventDefault()
              takeDownAt(spot)
            }}
          />
        )
      })}
    </svg>
  )
}
