import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useEffectsLevel } from '../lib/effects'
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
        {shown && <BannerCard key={shown.key} headline={shown} />}
      </AnimatePresence>
    </div>
  )
}

const BANNER_FULL = {
  initial: { opacity: 0, transform: 'translateY(10px) scale(0.7)' },
  animate: { opacity: 1, transform: 'translateY(0px) scale(1)' },
  exit: { opacity: 0, transform: 'translateY(-8px) scale(1.06)' },
  transition: { type: 'spring', stiffness: 360, damping: 22 },
} as const

const BANNER_LIGHT = {
  initial: { opacity: 0, transform: 'translateY(8px) scale(0.96)' },
  animate: { opacity: 1, transform: 'translateY(0px) scale(1)' },
  exit: { opacity: 0, transform: 'translateY(-6px) scale(1)' },
  transition: { duration: 0.2, ease: [0.2, 0.8, 0.3, 1] },
} as const

/**
 * The headline itself, between two gold rules. It pops up on a spring, or
 * with lighter effects makes a short, plain rise and fade.
 */
export function BannerCard({ headline }: { headline: Pick<Headline, 'title' | 'sub' | 'tone'> }) {
  const light = useEffectsLevel() === 'reduced'
  const gold = headline.tone === 'gold'
  return (
    <motion.div className={`banner banner--${headline.tone}`} {...(light ? BANNER_LIGHT : BANNER_FULL)}>
      <span className="banner__rule" />
      <BannerLine className="banner__title" text={headline.title} gold={gold} />
      {headline.sub && <BannerLine className="banner__sub num" text={headline.sub} gold={gold} />}
      <span className="banner__rule" />
    </motion.div>
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
