import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { burstAt, type FxKind } from './celebrate'

export interface Headline {
  /** Changes once per result, so the same words twice in a row still show. */
  key: string | number
  title: string
  sub?: string
  tone: 'gold' | 'win' | 'push' | 'lose'
  fx?: FxKind
}

/**
 * The call, in lights, for the tables that came after blackjack: a headline
 * over the felt for a couple of seconds once the money has moved. Winning is
 * announced; losing is only noted.
 */
export function TableBanner({ headline }: { headline: Headline | null }) {
  const [shown, setShown] = useState<Headline | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!headline) {
      setShown(null)
      return
    }
    setShown(headline)
    const fire = window.setTimeout(() => {
      if (headline.fx) burstAt(ref.current, headline.fx, headline.fx === 'sparks' ? 50 : 110)
    }, 180)
    const hide = window.setTimeout(() => setShown(null), headline.tone === 'lose' ? 1800 : 2600)
    return () => {
      clearTimeout(fire)
      clearTimeout(hide)
    }
    // The key is the result's identity; the object is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headline?.key])

  return (
    <div className="banner-anchor" ref={ref}>
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.key}
            className={`banner banner--${shown.tone}`}
            initial={{ opacity: 0, scale: 0.7, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.06, y: -8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
          >
            <span className="banner__rule" />
            <span className="banner__title">{shown.title}</span>
            {shown.sub && <span className="banner__sub num">{shown.sub}</span>}
            <span className="banner__rule" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
