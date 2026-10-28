import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { play } from '../audio'

/** The dealer's reason for refusing whatever was just attempted, over the dock for a few seconds. */
export function DealerNotice({ notice, onDismiss }: { notice: string | null; onDismiss(): void }) {
  useEffect(() => {
    if (!notice) return
    play('notice')
    const timer = setTimeout(onDismiss, 3200)
    return () => clearTimeout(timer)
  }, [notice, onDismiss])

  return (
    <AnimatePresence>
      {notice && (
        <motion.button
          key={notice}
          type="button"
          className="dealer-notice"
          onClick={onDismiss}
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6 }}
        >
          <span className="eyebrow">Dealer</span>
          {notice}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
