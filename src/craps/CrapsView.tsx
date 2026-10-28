import { lazy, Suspense, useEffect, useState } from 'react'
import { BetPicker } from '../components/BetPicker'
import { Drawer } from '../components/Drawer'
import { IconBook, IconSettings, IconStats } from '../components/icons'
import { Stage } from '../components/Stage'
import { TopBar, TopBarButton } from '../components/TopBar'
import * as craps from '../engine/craps/craps'
import { COMPACT_RESERVE, COMPACT_TOPBAR, TOPBAR, useCompact } from '../lib/compact'
import { money } from '../lib/format'
import { useSessionNet } from '../lib/session'
import { selectCanChooseCrapsBankroll, selectCrapsBankrollHasRun, useCrapsStore } from '../store/crapsStore'
import { useCrapsUiStore } from '../store/crapsUiStore'
import { BetLayer, Puck } from './Bets'
import { Callout, RollHistory } from './Callout'
import { CrapsDock } from './Dock'
import { CrapsFelt } from './Felt'
import { useCrapsKeys } from './hooks'
import { CAMERA, PLANE, STAGE } from './layout'
import { ReferencePanel } from './panels/ReferencePanel'
import { CrapsSettingsPanel } from './panels/SettingsPanel'
import { CrapsStatsPanel } from './panels/StatsPanel'
import { Rail } from './Rail'
import { SpotLayer } from './Spots'
import { SpotTooltip } from './Tooltip'

// The dice bring three.js and a physics engine with them; the felt should not
// have to wait for either.
const DiceOverlay = lazy(() => import('./dice/DiceOverlay').then((m) => ({ default: m.DiceOverlay })))

/**
 * Sideways on a phone: your end of the table and the middle, from the line
 * bets up to where the dice come to rest off the far wall, and as far toward
 * the other end as they land (see Stage's `fill`). The mirrored end runs off
 * the edge.
 */
const PHONE_FILL = { left: 59, top: 200, right: 1400, bottom: 776 }

/**
 * True once the table has finished rising into view. The dice bring three.js,
 * a WebGL context and their shaders, a second or more of work on an older
 * phone; started after the entrance, none of it stutters the move.
 */
function useAfterEntrance(ms = 900) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setDone(true), ms)
    return () => window.clearTimeout(id)
  }, [ms])
  return done
}

/**
 * The craps table.
 *
 * The felt is a tilted DOM plane — every box a real, crisp, clickable shape —
 * with the dice thrown over it in WebGL by a camera built to match the CSS
 * perspective exactly. The rail on the right explains every bet on the felt;
 * the dock below holds the rack and the dice.
 */
export default function CrapsView() {
  const compact = useCompact()
  const diceReady = useAfterEntrance()
  const game = useCrapsStore((s) => s.game)
  const ready = useCrapsStore((s) => s.ready)
  const bankroll = useCrapsStore((s) => s.profile.bankroll)
  const table = useCrapsStore((s) => s.table())
  const panel = useCrapsUiStore((s) => s.panel)
  const toggle = useCrapsUiStore((s) => s.togglePanel)
  const close = useCrapsUiStore((s) => s.closePanel)
  const atRisk = craps.totalAtRisk(game)
  const run = useCrapsStore((s) => s.profile.runStartedAt)
  const session = useSessionNet('craps', bankroll + atRisk, ready, run)
  const canChangeRack = useCrapsStore(selectCanChooseCrapsBankroll)
  const hasRun = useCrapsStore(selectCrapsBankrollHasRun)
  const resetRack = useCrapsStore((s) => s.resetRack)

  useCrapsKeys()

  return (
    <div className="cr" onContextMenu={(event) => event.preventDefault()}>
      <div className="cr__stage">
        {/* The pass line is the one bet every player makes; it must never sit under the dock. */}
        <Stage width={STAGE.w} height={STAGE.h} safeBottom={776} reserve={compact ? COMPACT_RESERVE : 150}
          reserveTop={compact ? COMPACT_TOPBAR : TOPBAR}
          fill={compact ? PHONE_FILL : undefined}
          zoom={{ focus: '[data-spot]', playing: game.phase === 'rolling', betting: game.phase === 'betting' }}
        >
          <div className="cr-camera" style={{ perspective: CAMERA.perspective }}>
            <div
              className="cr-plane"
              style={{
                width: PLANE.w,
                height: PLANE.h,
                left: CAMERA.cx - PLANE.w / 2,
                top: CAMERA.cy - PLANE.h / 2,
                transform: `translateZ(${CAMERA.z}px) rotateX(${CAMERA.tilt}deg)`,
              }}
            >
              <CrapsFelt />
              <SpotLayer />
              <Puck />
              <BetLayer />
            </div>
          </div>
          {diceReady && (
            <Suspense fallback={null}>
              <DiceOverlay />
            </Suspense>
          )}
        </Stage>
      </div>

      <TopBar
        game="Craps"
        bankroll={bankroll}
        session={session}
        rack={{ onFelt: atRisk, canChange: canChangeRack, hasRun, reset: resetRack }}
        extra={
          atRisk > 0 ? (
            <span className="bankroll__risk">
              {money(atRisk)} on the felt
            </span>
          ) : undefined
        }
        placard={
          <>
            <strong>
              {money(table.minBet)} – {money(table.maxBet)}
            </strong>
            <span className="placard__sep" />
            3-4-5x odds
            <span className="placard__sep" />
            Field 2 double · 12 triple
            <span className="placard__sep" />
            Fire · All Tall Small
          </>
        }
      >
        <TopBarButton label="Every bet on the table" shortcut="?" active={panel === 'reference'} onClick={() => toggle('reference')}>
          <IconBook />
        </TopBarButton>
        <TopBarButton label="Statistics" active={panel === 'stats'} onClick={() => toggle('stats')}>
          <IconStats />
        </TopBarButton>
        <TopBarButton label="Settings" active={panel === 'settings'} onClick={() => toggle('settings')}>
          <IconSettings />
        </TopBarButton>
      </TopBar>

      <RollHistory />
      <Callout />
      <Rail />
      <CrapsDock />
      <SpotTooltip />
      <BetPicker />

      <Drawer open={panel === 'reference'} title="Every bet, priced" eyebrow="The reference card" wide onClose={close}>
        <ReferencePanel />
      </Drawer>
      <Drawer open={panel === 'stats'} title="Statistics" eyebrow="Craps" onClose={close}>
        <CrapsStatsPanel />
      </Drawer>
      <Drawer open={panel === 'settings'} title="Settings" eyebrow="Craps" onClose={close}>
        <CrapsSettingsPanel />
      </Drawer>
    </div>
  )
}
