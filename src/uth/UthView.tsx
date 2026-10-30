import { useEffect } from 'react'
import { CAMERA, PLANE, STAGE } from '../blackjack/geometry'
import { BetPicker } from '../components/BetPicker'
import { chipForKey } from '../components/chips'
import { Drawer } from '../components/Drawer'
import { IconBook, IconSettings, IconStats } from '../components/icons'
import { SpotTip } from '../components/SpotTip'
import { Stage } from '../components/Stage'
import { TableBanner, type Headline } from '../components/TableBanner'
import { TopBar, TopBarButton } from '../components/TopBar'
import { CATEGORY_LABEL } from '../engine/uth/poker'
import { TRIPS_TABLES } from '../engine/uth/rules'
import type { UthDecision } from '../engine/uth/types'
import { COMPACT_RESERVE, COMPACT_TOPBAR, TOPBAR, useCompact } from '../lib/compact'
import { money, signedMoney } from '../lib/format'
import { useSessionNet } from '../lib/session'
import { selectCanChooseUthBankroll, selectUthHasRun, useUthStore, uthAtRisk } from '../store/uthStore'
import { useUthUi } from '../store/tableUi'
import { spotKind, tipFor, uthDenominations } from './betInfo'
import { UthDock } from './Dock'
import { UthFelt } from './Felt'
import { UthReferencePanel } from './panels/ReferencePanel'
import { UthSettingsPanel } from './panels/SettingsPanel'
import { UthStatsPanel } from './panels/StatsPanel'
import { Rail } from './Rail'
import { BetLayer, CardLayer, HandLabels, Shuffler, SpotLayer } from './Table'

/** Sideways on a phone: the dealer's cards down to your circles, the pay tables to the shuffler (see Stage's `fill`). */
const PHONE_FILL = { left: 300, top: 228, right: 1310, bottom: 750 }

/**
 * The Ultimate Texas Hold'em table: the D table again, a shuffler where the
 * shoe was, the dealer's two cards and the board across the felt, and your
 * four circles along the rail — with the coach calling each decision.
 */
export default function UthView() {
  const compact = useCompact()
  const game = useUthStore((s) => s.game)
  const ready = useUthStore((s) => s.ready)
  const bankroll = useUthStore((s) => s.profile.bankroll)
  const run = useUthStore((s) => s.profile.runStartedAt)
  const showEdges = useUthStore((s) => s.profile.settings.showEdges)
  const panel = useUthUi((s) => s.panel)
  const toggle = useUthUi((s) => s.togglePanel)
  const close = useUthUi((s) => s.closePanel)
  const atRisk = uthAtRisk(game)
  const session = useSessionNet('uth', bankroll + atRisk, ready, run)
  const canChangeRack = useUthStore(selectCanChooseUthBankroll)
  const hasRun = useUthStore(selectUthHasRun)
  const resetRack = useUthStore((s) => s.resetRack)

  useUthKeys()

  return (
    <div className="tv tv--uth" onContextMenu={(event) => event.preventDefault()}>
      <TopBar
        game="Ultimate Texas Hold'em"
        bankroll={bankroll}
        rack={{ onFelt: atRisk, canChange: canChangeRack, hasRun, reset: resetRack }}
        session={session}
        cents
        extra={atRisk > 0 ? <span className="bankroll__risk">{money(atRisk)} on the felt</span> : undefined}
        placard={
          <>
            <strong>
              Ante {money(game.limits.minAnte)} – {money(game.limits.maxAnte)}
            </strong>
            <span className="placard__sep" />
            One deck, every hand
            <span className="placard__sep" />
            Dealer opens with a pair
            <span className="placard__sep" />
            Trips {TRIPS_TABLES[game.tripsTable].name}
          </>
        }
      >
        <TopBarButton label="The book" shortcut="?" active={panel === 'reference'} onClick={() => toggle('reference')}>
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
        <Stage width={STAGE.w} height={STAGE.h} safeBottom={750} reserve={compact ? COMPACT_RESERVE : 134}
          reserveTop={compact ? COMPACT_TOPBAR : TOPBAR}
          fill={compact ? PHONE_FILL : undefined}
          zoom={{ focus: '[data-spot]', playing: game.phase !== 'betting' && game.phase !== 'showdown', betting: game.phase === 'betting' }}
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
              <UthFelt tripsTable={game.tripsTable} />
              <Shuffler />
              <SpotLayer />
              <BetLayer />
              <CardLayer />
              <HandLabels />
            </div>
          </div>
        </Stage>
      </div>

      <UthBanner />
      <Rail />
      <UthDock />
      <SpotTip describe={(id) => tipFor(game, spotKind(id), showEdges)} />
      <BetPicker />

      <Drawer open={panel === 'reference'} title="Playing it by the book" eyebrow="The book" wide onClose={close}>
        <UthReferencePanel />
      </Drawer>
      <Drawer open={panel === 'stats'} title="Statistics" eyebrow="Ultimate Texas Hold'em" onClose={close}>
        <UthStatsPanel />
      </Drawer>
      <Drawer open={panel === 'settings'} title="Settings" eyebrow="Ultimate Texas Hold'em" onClose={close}>
        <UthSettingsPanel />
      </Drawer>
    </div>
  )
}

function UthBanner() {
  const game = useUthStore((s) => s.game)
  const lastNet = useUthStore((s) => s.lastNet)
  const result = game.result
  let headline: Headline | null = null
  if (game.phase === 'showdown' && result && lastNet !== null) {
    const big = lastNet >= Math.max(game.bets.ante * 8, 250)
    // The full hand names are on the felt; the headline only needs the kind of hand.
    const title =
      result.outcome === 'fold'
        ? 'Folded'
        : result.outcome === 'tie'
          ? 'A tie'
          : result.outcome === 'win'
            ? `${CATEGORY_LABEL[result.playerCategory]} wins`
            : `Dealer’s ${CATEGORY_LABEL[result.dealerCategory].toLowerCase()}`
    headline = {
      key: game.seq,
      title,
      sub: lastNet === 0 ? 'Push' : signedMoney(lastNet, true),
      tone: big ? 'gold' : lastNet > 0 ? 'win' : lastNet === 0 ? 'push' : 'lose',
      fx: big ? 'coins' : lastNet > 0 ? 'sparks' : undefined,
    }
  }
  return <TableBanner headline={headline} />
}

const DECISION_KEYS: Record<string, UthDecision> = { c: 'check', '4': 'bet4', '3': 'bet3', '2': 'bet2', '1': 'bet1', f: 'fold' }

/**
 * Space deals (or rebets and deals), R rebets, B folds the rail, ? opens the
 * book. While the circles are open, C clears and number keys pick a chip;
 * once the cards are out, C checks, 4 3 2 1 bet that many Antes and F folds.
 */
function useUthKeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      const ui = useUthUi.getState()
      const store = useUthStore.getState()
      const { phase } = store.game
      if (key === '?' || key === '/') {
        event.preventDefault()
        ui.togglePanel('reference')
        return
      }
      if (ui.panel && ui.panel !== 'reference') return
      if (key === 'b') {
        ui.toggleRail()
        return
      }
      if (phase === 'preflop' || phase === 'flop' || phase === 'river') {
        const decision = DECISION_KEYS[key]
        if (decision && !event.repeat) store.decide(decision)
        return
      }
      if (key === ' ' || key === 'enter') {
        event.preventDefault()
        if (!event.repeat) store.deal()
        return
      }
      if (key === 'c') store.clearBets()
      else if (key === 'r') store.rebet()
      else {
        const chip = chipForKey(key, uthDenominations(store.game), store.game.bankroll)
        if (chip !== null) store.setChip(chip)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
