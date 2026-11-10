import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { play } from '../audio'
import { IconClose, IconRefresh } from '../components/icons'
import { totalAtRisk } from '../engine/craps/craps'
import { applyUpdate, useUpdate } from '../lib/updates'
import { baccaratAtRisk, selectCanChooseBaccaratBankroll, useBaccaratStore } from '../store/baccaratStore'
import { selectCanChooseCrapsBankroll, useCrapsStore } from '../store/crapsStore'
import { selectCanChooseBankroll, useGameStore } from '../store/gameStore'
import { rouletteAtRisk, selectCanChooseRouletteBankroll, useRouletteStore } from '../store/rouletteStore'
import { selectCanChooseUthBankroll, uthAtRisk, useUthStore } from '../store/uthStore'
import { paigowAtRisk, selectCanChoosePaiGowBankroll, usePaiGowStore } from '../store/paigowStore'

/**
 * "A new version is ready", over the lobby once a newer deploy has downloaded.
 *
 * Updating reloads the page. Each felt is saved and would come back, but a new
 * build need not read an old build's felt (see tableSnapshot.ts), so it waits
 * until every table is between hands with nothing down: a craps bet left
 * standing or a hand walked away from keeps it hidden until the chips are back
 * in the rack. Dismissed, it stays away until the lobby is next opened.
 */
export function UpdatePill() {
  const ready = useUpdate((s) => s.ready)
  const applying = useUpdate((s) => s.applying)
  const [dismissed, setDismissed] = useState(false)

  const bjIdle = useGameStore(selectCanChooseBankroll)
  const crapsIdle = useCrapsStore((s) => selectCanChooseCrapsBankroll(s) && totalAtRisk(s.game) === 0)
  const baIdle = useBaccaratStore((s) => selectCanChooseBaccaratBankroll(s) && baccaratAtRisk(s.game) === 0)
  const roIdle = useRouletteStore((s) => selectCanChooseRouletteBankroll(s) && rouletteAtRisk(s.game) === 0)
  const uthIdle = useUthStore((s) => selectCanChooseUthBankroll(s) && uthAtRisk(s.game) === 0)
  const pgIdle = usePaiGowStore((s) => selectCanChoosePaiGowBankroll(s) && paigowAtRisk(s.game) === 0)
  const idle = bjIdle && crapsIdle && baIdle && roIdle && uthIdle && pgIdle

  const show = ready && !dismissed && (idle || applying)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="update-pill"
          role="status"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="update-pill__text">
            <span className="eyebrow">New version</span>
            <span className="update-pill__line">Ready when you are</span>
          </span>
          <button
            type="button"
            className="btn btn--gold btn--sm update-pill__go"
            disabled={applying}
            onClick={() => {
              play('click')
              applyUpdate()
            }}
          >
            <IconRefresh width={16} height={16} className={applying ? 'is-spinning' : undefined} />
            {applying ? 'Updating' : 'Update'}
          </button>
          {!applying && (
            <button
              type="button"
              className="update-pill__later"
              aria-label="Not now"
              title="Not now — it will update the next time Aria opens"
              onClick={() => {
                play('click')
                setDismissed(true)
              }}
            >
              <IconClose width={16} height={16} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
