import { Drawer } from '../components/Drawer'
import { IconBook, IconSettings, IconStats } from '../components/icons'
import { Stage } from '../components/Stage'
import { TopBar, TopBarButton } from '../components/TopBar'
import { COMPACT_RESERVE, COMPACT_TOPBAR, useCompact } from '../lib/compact'
import { money } from '../lib/format'
import { useSessionNet } from '../lib/session'
import { usePrefs } from '../prefs/prefsStore'
import {
  CARD_FLIGHT,
  DEAL_INTERVAL,
  selectBankrollHasRun,
  selectCanChooseBankroll,
  selectCanShuffle,
  useGameStore,
} from '../store/gameStore'
import { useUiStore } from '../store/uiStore'
import { ActionTip } from './ActionTip'
import { ActiveHandGlow, Badges } from './Badges'
import { ResultBanner } from './Banner'
import { BetLayer } from './Bets'
import { CardLayer } from './Cards'
import { Dock } from './Dock'
import { CAMERA, PLANE, STAGE } from './geometry'
import { useBlackjackKeys } from './hooks'
import { CoachChallenge, CountHud, ShuffleConfirm, ShuffleNotice } from './Overlays'
import { SettingsPanel } from './panels/SettingsPanel'
import { StatsPanel } from './panels/StatsPanel'
import { StrategyPanel } from './panels/StrategyPanel'
import { payoutWords } from './rulesText'
import { BlackjackTable, DiscardRack, Shoe } from './Table'

/**
 * Sideways on a phone, the part of the table that has to be seen: from the
 * dealer's cards down to the betting circle, from the discard rack to the
 * shoe. The table is drawn as large as that allows (see Stage's `fill`), the
 * dealer's tray and the top of the shoe going under the top bar.
 */
const PHONE_FILL = { left: 318, top: 240, right: 1315, bottom: 772 }

/**
 * The blackjack table.
 *
 * A fixed composition — the felt tilted away as a seated player sees it —
 * scaled to fit the window, with the rack and decisions docked below it and
 * the reference panels sliding in over the right-hand side.
 */
export default function BlackjackView() {
  const compact = useCompact()
  const game = useGameStore((s) => s.game)
  const ready = useGameStore((s) => s.ready)
  const bankroll = useGameStore((s) => s.profile.bankroll)
  const settings = useGameStore((s) => s.profile.settings)
  const table = useGameStore((s) => s.table())
  const panel = useUiStore((s) => s.panel)
  const toggle = useUiStore((s) => s.togglePanel)
  const close = useUiStore((s) => s.closePanel)
  const askShuffle = useUiStore((s) => s.askShuffle)
  const canShuffle = useGameStore(selectCanShuffle)
  const back = usePrefs((s) => s.cardBack)
  const run = useGameStore((s) => s.profile.runStartedAt)
  const session = useSessionNet('blackjack', bankroll, ready, run)
  const canChangeRack = useGameStore(selectCanChooseBankroll)
  const hasRun = useGameStore(selectBankrollHasRun)
  const resetRack = useGameStore((s) => s.resetRack)

  useBlackjackKeys()

  const { rules } = game
  const interval = DEAL_INTERVAL[settings.dealSpeed] / 1000
  const flight = CARD_FLIGHT[settings.dealSpeed] * 1.15
  const discarded = game.shoe.pos / Math.max(1, game.shoe.cutIndex)

  return (
    <div className="bj">
      <TopBar
        game="Blackjack"
        bankroll={bankroll}
        session={session}
        rack={{ onFelt: 0, canChange: canChangeRack, hasRun, reset: resetRack }}
        placard={
          <>
            <strong>
              {money(table.minBet)} – {money(table.maxBet)}
            </strong>
            <span className="placard__sep" />
            {rules.decks} {rules.decks === 1 ? 'deck' : 'decks'}
            <span className="placard__sep" />
            Pays {payoutWords(rules.blackjackPayout)}
            <span className="placard__sep" />
            {rules.dealerHitsSoft17 ? 'Hits soft 17' : 'Stands on 17'}
            {rules.surrender !== 'none' && (
              <>
                <span className="placard__sep" />
                Surrender
              </>
            )}
          </>
        }
      >
        <TopBarButton label="Basic strategy" shortcut="?" active={panel === 'chart'} onClick={() => toggle('chart')}>
          <IconBook />
        </TopBarButton>
        <TopBarButton label="Statistics" active={panel === 'stats'} onClick={() => toggle('stats')}>
          <IconStats />
        </TopBarButton>
        <TopBarButton label="Settings" active={panel === 'settings'} onClick={() => toggle('settings')}>
          <IconSettings />
        </TopBarButton>
      </TopBar>

      <div className="bj__stage">
        {/* The betting circle and its chips must always clear the dock. */}
        <Stage
          width={STAGE.w}
          height={STAGE.h}
          safeBottom={772}
          reserve={compact ? COMPACT_RESERVE : 134}
          reserveTop={compact ? COMPACT_TOPBAR : 0}
          fill={compact ? PHONE_FILL : undefined}
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
              <BlackjackTable rules={rules} />
              <DiscardRack fraction={discarded} back={back} />
              <Shoe back={back} onShuffle={canShuffle ? askShuffle : undefined} />
              <ActiveHandGlow round={game.round} />
              <BetLayer game={game} />
              <CardLayer round={game.round} dealerPeek={rules.dealerPeek} interval={interval} flight={flight} back={back} />
              <Badges round={game.round} showTotals={settings.showTotals} />
            </div>
          </div>
        </Stage>
      </div>

      <ResultBanner />
      <ShuffleNotice />
      <ShuffleConfirm />
      <CountHud />
      <CoachChallenge />
      <Dock />
      <ActionTip />

      <Drawer open={panel === 'chart'} title="Basic strategy" eyebrow="The book" wide onClose={close}>
        <StrategyPanel />
      </Drawer>
      <Drawer open={panel === 'stats'} title="Statistics" eyebrow="Blackjack" onClose={close}>
        <StatsPanel />
      </Drawer>
      <Drawer open={panel === 'settings'} title="Settings" eyebrow="Blackjack" onClose={close}>
        <SettingsPanel />
      </Drawer>
    </div>
  )
}
