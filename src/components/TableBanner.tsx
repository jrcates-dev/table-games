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
            initial={{ opacity: 0, transform: 'translateY(10px) scale(0.7)' }}
            animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
            exit={{ opacity: 0, transform: 'translateY(-8px) scale(1.06)' }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
          >
            <span className="banner__rule" />
            <BannerLine className="banner__title" text={shown.title} gold={shown.tone === 'gold'} />
            {shown.sub && <BannerLine className="banner__sub num" text={shown.sub} gold={shown.tone === 'gold'} />}
            <span className="banner__rule" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * One line of a headline. A gold line is foil with a light running across it:
 * a bright copy of the words in a window that slides over them (the same
 * compositor-only glint as the lobby sign; see .banner__glint).
 */
export function BannerLine({ className, text, gold }: { className: string; text: string; gold: boolean }) {
  if (!gold) return <span className={className}>{text}</span>
  return (
    <span className={`${className} banner__foil`}>
      <span className="banner__foil-text">{text}</span>
      <span className="banner__glint" aria-hidden="true">
        <span>{text}</span>
      </span>
    </span>
  )
}
