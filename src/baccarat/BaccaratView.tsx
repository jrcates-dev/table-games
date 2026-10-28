import { useEffect } from 'react'
import { CAMERA, PLANE, STAGE } from '../blackjack/geometry'
import { DiscardRack, Shoe } from '../blackjack/Table'
import { BetPicker } from '../components/BetPicker'
import { Drawer } from '../components/Drawer'
import { IconBook, IconSettings, IconStats } from '../components/icons'
import { SpotTip } from '../components/SpotTip'
import { Stage } from '../components/Stage'
import { TableBanner, type Headline } from '../components/TableBanner'
import { TopBar, TopBarButton } from '../components/TopBar'
import { BANKER_COMMISSION } from '../engine/baccarat/rules'
import { COMPACT_RESERVE, COMPACT_TOPBAR, TOPBAR, useCompact } from '../lib/compact'
import { money, signedMoney } from '../lib/format'
import { useSessionNet } from '../lib/session'
import { usePrefs } from '../prefs/prefsStore'
import { baccaratAtRisk, selectBaccaratHasRun, selectCanChooseBaccaratBankroll, useBaccaratStore, useLiveOdds } from '../store/baccaratStore'
import { useBaccaratUi } from '../store/tableUi'
import { chipForKey } from '../components/chips'
import { baccaratDenominations, spotKind, tipFor } from './betInfo'
import { coupTitle } from './coupStory'
import { BaccaratDock } from './Dock'
import { BaccaratFelt } from './Felt'
import { BaccaratReferencePanel } from './panels/ReferencePanel'
import { BaccaratSettingsPanel } from './panels/SettingsPanel'
import { BaccaratStatsPanel } from './panels/StatsPanel'
import { Rail } from './Rail'
import { BetLayer, CardLayer, SpotLayer, Totals } from './Table'

/**
 * The mini-baccarat table: the blackjack table's walnut and felt, an eight-deck
 * shoe at the dealer's right, the two hands turned over in their boxes, and an
 * apron of seven bets — each priced, live, on the rail.
 */
export default function BaccaratView() {
  const compact = useCompact()
  const game = useBaccaratStore((s) => s.game)
  const ready = useBaccaratStore((s) => s.ready)
  const bankroll = useBaccaratStore((s) => s.profile.bankroll)
  const run = useBaccaratStore((s) => s.profile.runStartedAt)
  const showEdges = useBaccaratStore((s) => s.profile.settings.showEdges)
  const panel = useBaccaratUi((s) => s.panel)
  const toggle = useBaccaratUi((s) => s.togglePanel)
  const close = useBaccaratUi((s) => s.closePanel)
  const back = usePrefs((s) => s.cardBack)
  const live = useLiveOdds()
  const atRisk = baccaratAtRisk(game)
  const session = useSessionNet('baccarat', bankroll + atRisk, ready, run)
  const canChangeRack = useBaccaratStore(selectCanChooseBaccaratBankroll)
  const hasRun = useBaccaratStore(selectBaccaratHasRun)
  const resetRack = useBaccaratStore((s) => s.resetRack)
  const discarded = game.shoe.pos / Math.max(1, game.shoe.cutIndex)

  useBaccaratKeys()

  return (
    <div className="tv tv--baccarat" onContextMenu={(event) => event.preventDefault()}>
      <TopBar
        game="Baccarat"
        bankroll={bankroll}
        rack={{ onFelt: atRisk, canChange: canChangeRack, hasRun, reset: resetRack }}
        session={session}
        cents
        extra={atRisk > 0 ? <span className="bankroll__risk">{money(atRisk)} on the felt</span> : undefined}
        placard={
          <>
            <strong>
              {money(game.limits.minBet)} – {money(game.limits.maxBet)}
            </strong>
            <span className="placard__sep" />8 decks
            <span className="placard__sep" />
            Banker pays {Math.round(BANKER_COMMISSION * 100)}% commission
            <span className="placard__sep" />
            Tie 8 to 1 · Pairs · Dragon Bonus
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
        <Stage width={STAGE.w} height={STAGE.h} safeBottom={792} reserve={compact ? COMPACT_RESERVE : 134}
          reserveTop={compact ? COMPACT_TOPBAR : TOPBAR}
          zoom={{ focus: '[data-spot]', playing: game.phase === 'dealt', betting: game.phase === 'betting' }}
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
              <BaccaratFelt />
              <DiscardRack fraction={discarded} back={back} />
              <Shoe back={back} />
              <SpotLayer />
              <BetLayer />
              <CardLayer />
              <Totals />
            </div>
          </div>
        </Stage>
      </div>

      <BaccaratBanner />
      <Rail />
      <BaccaratDock />
      <SpotTip describe={(id) => tipFor(game, spotKind(id), live, showEdges)} />
      <BetPicker />

      <Drawer open={panel === 'reference'} title="Every bet, priced" eyebrow="The book" wide onClose={close}>
        <BaccaratReferencePanel />
      </Drawer>
      <Drawer open={panel === 'stats'} title="Statistics" eyebrow="Baccarat" onClose={close}>
        <BaccaratStatsPanel />
      </Drawer>
      <Drawer open={panel === 'settings'} title="Settings" eyebrow="Baccarat" onClose={close}>
        <BaccaratSettingsPanel />
      </Drawer>
    </div>
  )
}

function BaccaratBanner() {
  const game = useBaccaratStore((s) => s.game)
  const lastNet = useBaccaratStore((s) => s.lastNet)
  const coup = game.coup
  let headline: Headline | null = null
  if (game.phase === 'settled' && coup && lastNet !== null) {
    const big = lastNet >= Math.max(game.limits.minBet * 10, 250)
    const title = coupTitle(coup)
    headline = {
      key: game.seq,
      title: coup.natural && coup.winner !== 'tie' ? `${title} · natural` : title,
      sub: lastNet === 0 ? 'Push' : signedMoney(lastNet, true),
      tone: big ? 'gold' : lastNet > 0 ? 'win' : lastNet === 0 ? 'push' : 'lose',
      fx: big ? 'coins' : lastNet > 0 ? 'sparks' : undefined,
    }
  }
  return <TableBanner headline={headline} />
}

/** Space deals, C clears, R rebets, number keys pick a chip, B folds the rail, ? opens the book. */
function useBaccaratKeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      const ui = useBaccaratUi.getState()
      const store = useBaccaratStore.getState()
      if (key === '?' || key === '/') {
        event.preventDefault()
        ui.togglePanel('reference')
        return
      }
      if (ui.panel && ui.panel !== 'reference') return
      if (key === ' ' || key === 'enter') {
        event.preventDefault()
        if (!event.repeat) store.deal()
        return
      }
      if (key === 'c') store.clearBets()
      else if (key === 'r') store.rebet()
      else if (key === 'b') ui.toggleRail()
      else {
        const chip = chipForKey(key, baccaratDenominations(store.game.limits.maxBet), store.game.bankroll)
        if (chip !== null) store.setChip(chip)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
