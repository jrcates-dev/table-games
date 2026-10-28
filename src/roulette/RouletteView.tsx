import { useEffect } from 'react'
import { BetPicker } from '../components/BetPicker'
import { chipForKey } from '../components/chips'
import { Drawer } from '../components/Drawer'
import { IconBook, IconSettings, IconStats } from '../components/icons'
import { SpotTip } from '../components/SpotTip'
import { Stage } from '../components/Stage'
import { TableBanner, type Headline } from '../components/TableBanner'
import { TopBar, TopBarButton } from '../components/TopBar'
import { houseEdge } from '../engine/roulette/bets'
import { WHEEL_NAME } from '../engine/roulette/rules'
import { pocketColor, pocketLabel } from '../engine/roulette/wheel'
import { COMPACT_RESERVE, COMPACT_TOPBAR, TOPBAR, useCompact } from '../lib/compact'
import { money, percent, signedMoney } from '../lib/format'
import { useSessionNet } from '../lib/session'
import { rouletteAtRisk, selectCanChooseRouletteBankroll, selectRouletteHasRun, useRouletteStore } from '../store/rouletteStore'
import { useRouletteUi } from '../store/tableUi'
import { rouletteDenominations, spotId, tipFor } from './betInfo'
import { RouletteDock } from './Dock'
import { RouletteFelt } from './Felt'
import { CAMERA, PLANE, STAGE } from './geometry'
import { BetLayer, Dolly, HighlightLayer, SpotLayer } from './Layout'
import { RouletteReferencePanel } from './panels/ReferencePanel'
import { RouletteSettingsPanel } from './panels/SettingsPanel'
import { RouletteStatsPanel } from './panels/StatsPanel'
import { Rail } from './Rail'
import { Wheel } from './Wheel'

/**
 * The roulette table: the wheel set into the felt at the left, the layout
 * running away from it, every bet priced on the rail and under the pointer.
 */
export default function RouletteView() {
  const compact = useCompact()
  const game = useRouletteStore((s) => s.game)
  const ready = useRouletteStore((s) => s.ready)
  const bankroll = useRouletteStore((s) => s.profile.bankroll)
  const run = useRouletteStore((s) => s.profile.runStartedAt)
  const showEdges = useRouletteStore((s) => s.profile.settings.showEdges)
  const panel = useRouletteUi((s) => s.panel)
  const toggle = useRouletteUi((s) => s.togglePanel)
  const close = useRouletteUi((s) => s.closePanel)
  const atRisk = rouletteAtRisk(game)
  const session = useSessionNet('roulette', bankroll + atRisk, ready, run)
  const canChangeRack = useRouletteStore(selectCanChooseRouletteBankroll)
  const hasRun = useRouletteStore(selectRouletteHasRun)
  const resetRack = useRouletteStore((s) => s.resetRack)
  const edge = houseEdge({ kind: 'straight', numbers: [1] }, game.wheel)

  useRouletteKeys()

  return (
    <div className="tv tv--roulette" onContextMenu={(event) => event.preventDefault()}>
      <TopBar
        game="Roulette"
        bankroll={bankroll}
        rack={{ onFelt: atRisk, canChange: canChangeRack, hasRun, reset: resetRack }}
        session={session}
        extra={atRisk > 0 ? <span className="bankroll__risk">{money(atRisk)} on the layout</span> : undefined}
        placard={
          <>
            <strong>
              {money(game.limits.tableMin)} – {money(game.limits.maxOutside)}
            </strong>
            <span className="placard__sep" />
            {WHEEL_NAME[game.wheel]}
            <span className="placard__sep" />
            Straight up {money(game.limits.maxStraight)}
            <span className="placard__sep" />
            Every bet {percent(edge, 2)}
            {game.wheel === 'double' ? ' · Top Line 7.89%' : ''}
          </>
        }
      >
        <TopBarButton label="Every bet, priced" shortcut="?" active={panel === 'reference'} onClick={() => toggle('reference')}>
          <IconBook />
        </TopBarButton>
        <TopBarButton label="Statistics" active={panel === 'stats'} onClick={() => toggle('stats')}>
          <IconStats />
        </TopBarButton>
        <TopBarButton label="Settings" active={panel === 'settings'} onClick={() => toggle('settings')}>
          <IconSettings />
        </TopBarButton>
      </TopBar>

      <div className="tv__stage">
        <Stage width={STAGE.w} height={STAGE.h} safeBottom={650} reserve={compact ? COMPACT_RESERVE : 134}
          reserveTop={compact ? COMPACT_TOPBAR : TOPBAR}
          zoom={{ focus: '[data-spot]', playing: game.phase === 'spinning', betting: game.phase === 'betting' }}
        >
          <div className="bj-camera" style={{ perspective: CAMERA.perspective }}>
            <div
              className="bj-plane"
              style={{
                width: PLANE.w,
                height: PLANE.h,
                left: CAMERA.cx - PLANE.w / 2,
                top: CAMERA.cy - PLANE.h / 2,
                transform: `translateZ(${CAMERA.z}px) rotateX(${CAMERA.tilt}deg)`,
              }}
            >
              <RouletteFelt wheel={game.wheel} />
              <HighlightLayer />
              <Wheel />
              <SpotLayer />
              <BetLayer />
              <Dolly />
            </div>
          </div>
        </Stage>
      </div>

      <RouletteBanner />
      <Rail />
      <RouletteDock />
      <SpotTip describe={(id) => tipFor(game, spotId(id), showEdges)} />
      <BetPicker />

      <Drawer open={panel === 'reference'} title="Every bet, priced" eyebrow="The book" wide onClose={close}>
        <RouletteReferencePanel />
      </Drawer>
      <Drawer open={panel === 'stats'} title="Statistics" eyebrow="Roulette" onClose={close}>
        <RouletteStatsPanel />
      </Drawer>
      <Drawer open={panel === 'settings'} title="Settings" eyebrow="Roulette" onClose={close}>
        <RouletteSettingsPanel />
      </Drawer>
    </div>
  )
}

function RouletteBanner() {
  const game = useRouletteStore((s) => s.game)
  const lastNet = useRouletteStore((s) => s.lastNet)
  let headline: Headline | null = null
  if (game.phase === 'settled' && game.result !== null && lastNet !== null) {
    const big = lastNet >= Math.max(game.limits.tableMin * 20, 500)
    headline = {
      key: game.seq,
      title: `${pocketLabel(game.result)} ${pocketColor(game.result)}`,
      sub: lastNet === 0 ? 'Even' : signedMoney(lastNet),
      tone: big ? 'gold' : lastNet > 0 ? 'win' : lastNet === 0 ? 'push' : 'lose',
      fx: big ? 'coins' : lastNet > 0 ? 'sparks' : undefined,
    }
  }
  return <TableBanner headline={headline} />
}

/** Space spins, C clears, D doubles, R rebets, number keys pick a chip, B folds the rail, ? opens the book. */
function useRouletteKeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      const ui = useRouletteUi.getState()
      const store = useRouletteStore.getState()
      if (key === '?' || key === '/') {
        event.preventDefault()
        ui.togglePanel('reference')
        return
      }
      if (ui.panel && ui.panel !== 'reference') return
      if (key === ' ' || key === 'enter') {
        event.preventDefault()
        if (!event.repeat) store.spin()
        return
      }
      if (key === 'c') store.clearBets()
      else if (key === 'd') store.doubleBets()
      else if (key === 'r') store.rebet()
      else if (key === 'b') ui.toggleRail()
      else {
        const chip = chipForKey(key, rouletteDenominations(store.game), store.game.bankroll)
        if (chip !== null) store.setChip(chip)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
