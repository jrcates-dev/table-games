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
import { FORTUNE_LABEL } from '../engine/paigow/fortune'
import { COMPACT_RESERVE, COMPACT_TOPBAR, PORTRAIT_RESERVE, PORTRAIT_TOPBAR, TOPBAR, useCompact, usePortrait } from '../lib/compact'
import { money, signedMoney } from '../lib/format'
import { paigowAtRisk, selectCanChoosePaiGowBankroll, selectPaiGowHasRun, usePaiGowStore } from '../store/paigowStore'
import { usePaiGowUi } from '../store/tableUi'
import { paigowDenominations, spotKind, tipFor } from './betInfo'
import { PaiGowDock } from './Dock'
import { PaiGowFelt } from './Felt'
import { SHUFFLER, UPRIGHT_SHUFFLER } from './geometry'
import { PaiGowReferencePanel } from './panels/ReferencePanel'
import { PaiGowSettingsPanel } from './panels/SettingsPanel'
import { PaiGowStatsPanel } from './panels/StatsPanel'
import { Rail } from './Rail'
import { BetLayer, CardLayer, HandLabels, Shuffler, SpotLayer } from './Table'

/** Sideways on a phone: the dealer's hands down to your circles, box edge to box edge. */
const PHONE_FILL = { left: 326, top: 150, right: 1174, bottom: 770 }

/** Upright on a phone: the same, the shuffler stood behind the tray. */
const UPRIGHT_FILL = { left: 290, top: 20, right: 1210, bottom: 775 }

/**
 * The Pai Gow Poker table: the D table again, a shuffler where the shoe was,
 * the dealer's seven under the tray, and yours dealt across the middle to be
 * set into the low and high boxes in front of you — with the house way and
 * what your set is worth beside the buttons.
 */
export default function PaiGowView() {
  const compact = useCompact()
  const portrait = usePortrait()
  const game = usePaiGowStore((s) => s.game)
  const bankroll = usePaiGowStore((s) => s.profile.bankroll)
  const showEdges = usePaiGowStore((s) => s.profile.settings.showEdges)
  const panel = usePaiGowUi((s) => s.panel)
  const toggle = usePaiGowUi((s) => s.togglePanel)
  const close = usePaiGowUi((s) => s.closePanel)
  const atRisk = paigowAtRisk(game)
  const canChangeRack = usePaiGowStore(selectCanChoosePaiGowBankroll)
  const hasRun = usePaiGowStore(selectPaiGowHasRun)
  const resetRack = usePaiGowStore((s) => s.resetRack)
  const shuffler = portrait ? UPRIGHT_SHUFFLER : SHUFFLER

  usePaiGowKeys()

  return (
    <div className="tv tv--paigow" onContextMenu={(event) => event.preventDefault()}>
      <TopBar
        id="paigow"
        game="Pai Gow Poker"
        bankroll={bankroll}
        rack={{ onFelt: atRisk, canChange: canChangeRack, hasRun, reset: resetRack }}
        cents
        extra={atRisk > 0 ? <span className="bankroll__risk">{money(atRisk)} on the felt</span> : undefined}
        placard={
          <>
            <strong>
              Bet {money(game.limits.minBet)} – {money(game.limits.maxBet)}
            </strong>
            <span className="placard__sep" />
            53 cards, joker wild for aces, straights & flushes
            <span className="placard__sep" />
            {game.rules.commissionFree ? 'No commission · queen-high pushes' : '5% commission'}
            <span className="placard__sep" />
            Fortune Bonus
          </>
        }
      >
        <TopBarButton label="The house way" shortcut="?" active={panel === 'reference'} onClick={() => toggle('reference')}>
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
        <Stage
          width={STAGE.w}
          height={STAGE.h}
          safeBottom={760}
          reserve={portrait ? PORTRAIT_RESERVE : compact ? COMPACT_RESERVE : 134}
          reserveTop={portrait ? PORTRAIT_TOPBAR : compact ? COMPACT_TOPBAR : TOPBAR}
          fill={portrait ? UPRIGHT_FILL : compact ? PHONE_FILL : undefined}
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
              <PaiGowFelt commissionFree={game.rules.commissionFree} />
              <Shuffler at={shuffler} />
              <SpotLayer />
              <BetLayer />
              <CardLayer shuffler={shuffler} />
              <HandLabels />
            </div>
          </div>
        </Stage>
      </div>

      <PaiGowBanner />
      <Rail />
      <PaiGowDock />
      <SpotTip describe={(id) => tipFor(game, spotKind(id), showEdges)} />
      <BetPicker />

      <Drawer open={panel === 'reference'} title="The house way" eyebrow="The book" wide onClose={close}>
        <PaiGowReferencePanel />
      </Drawer>
      <Drawer open={panel === 'stats'} title="Statistics" eyebrow="Pai Gow Poker" onClose={close}>
        <PaiGowStatsPanel />
      </Drawer>
      <Drawer open={panel === 'settings'} title="Settings" eyebrow="Pai Gow Poker" onClose={close}>
        <PaiGowSettingsPanel />
      </Drawer>
    </div>
  )
}

function PaiGowBanner() {
  const game = usePaiGowStore((s) => s.game)
  const lastNet = usePaiGowStore((s) => s.lastNet)
  const result = game.result
  let headline: Headline | null = null
  if (game.phase === 'showdown' && result && lastNet !== null) {
    const fortune = game.resolutions.find((r) => r.kind === 'fortune' && r.effect === 'win')
    const big = lastNet >= Math.max(game.bets.wager * 4, 250)
    const title = fortune
      ? FORTUNE_LABEL[result.fortune!]
      : result.outcome === 'foul'
        ? 'Foul'
        : result.outcome === 'win'
          ? 'Both hands win'
          : result.outcome === 'lose'
            ? 'Dealer wins'
            : 'Push'
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

/**
 * Space deals (or rebets and deals) and, while setting, sets the hand; R
 * rebets, B folds the rail, ? opens the book. While the circles are open, C
 * clears and number keys pick a chip; while setting, 1–7 move a card between
 * the hands, H sets the house way and C starts over.
 */
function usePaiGowKeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      const ui = usePaiGowUi.getState()
      const store = usePaiGowStore.getState()
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
      if (phase === 'setting') {
        if (event.repeat) return
        if (key === ' ' || key === 'enter') {
          event.preventDefault()
          store.confirmSet()
        } else if (key === 'h') store.setHouseWay()
        else if (key === 'c') store.clearLow()
        else if (/^[1-7]$/.test(key)) store.toggleCard(Number(key) - 1)
        return
      }
      if (phase === 'reveal') return
      if (key === ' ' || key === 'enter') {
        event.preventDefault()
        if (!event.repeat) store.deal()
        return
      }
      if (key === 'c') store.clearBets()
      else if (key === 'r') store.rebet()
      else {
        const chip = chipForKey(key, paigowDenominations(store.game), store.game.bankroll)
        if (chip !== null) store.setChip(chip)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
