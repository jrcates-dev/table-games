import { animate, useMotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { money, signedMoney } from '../lib/format'

/**
 * A dollar figure that counts to its new value instead of jumping, and glows
 * green or red for a moment on the way — the rack being counted in front of
 * you rather than a number being overwritten.
 */
export function Money({
  value,
  signed = false,
  className,
  duration = 0.9,
  flash = true,
  cents = false,
}: {
  value: number
  signed?: boolean
  className?: string
  duration?: number
  flash?: boolean
  /** Keep the cents once the count has landed. Counting runs in whole dollars. */
  cents?: boolean
}) {
  const motionValue = useMotionValue(value)
  const [shown, setShown] = useState(value)
  const [tone, setTone] = useState<'up' | 'down' | null>(null)
  const last = useRef(value)

  useEffect(() => {
    const from = last.current
    last.current = value
    if (from === value) return
    if (flash) setTone(value > from ? 'up' : 'down')
    const controls = animate(motionValue, value, {
      duration: Math.min(duration, 0.25 + Math.abs(value - from) / 4000),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(v),
      onComplete: () => {
        setShown(value)
        setTone(null)
      },
    })
    return () => controls.stop()
  }, [value, motionValue, duration, flash])

  return (
    <span className={`money num${tone ? ` money--${tone}` : ''}${className ? ` ${className}` : ''}`}>
      {signed ? signedMoney(shown, cents && shown === value) : money(shown, cents && shown === value)}
    </span>
  )
}
