import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { burstAt } from '../components/celebrate'
import { BannerCard } from '../components/TableBanner'
import { evaluate } from '../engine/hand'
import { signedMoney } from '../lib/format'
import { isBigWin, useGameStore } from '../store/gameStore'

interface Headline {
  title: string
  sub?: string
  tone: 'gold' | 'win' | 'push' | 'lose'
  fx?: 'sparks' | 'confetti' | 'coins'
}

/**
 * The call, in lights: a headline over the table for a couple of seconds once
 * a round settles. Winning is announced; losing is simply noted — a table that
 * crows at you when you lose is a table you stop sitting at.
 */
export function ResultBanner() {
  const phase = useGameStore((s) => s.game.round.phase)
  const round = useGameStore((s) => s.game.round)
  const lastNet = useGameStore((s) => s.lastNet)
  const minBet = useGameStore((s) => s.table().minBet)
  const [headline, setHeadline] = useState<Headline | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (phase !== 'roundOver' || lastNet === null) {
      setHeadline(null)
      return
    }
    const hands = round.hands
    const net = lastNet
    const big = isBigWin(hands, net, minBet)
    const blackjack = hands.some((h) => h.outcome === 'blackjack')
    const dealerBj = hands.some((h) => h.outcome === 'dealerBlackjack')
    const dealerBust = evaluate(round.dealer).busted
    const allBust = hands.every((h) => h.outcome === 'bust')

    let next: Headline
    if (blackjack) next = { title: 'Blackjack', sub: signedMoney(net), tone: 'gold', fx: 'confetti' }
    else if (big) next = { title: 'Big win', sub: signedMoney(net), tone: 'gold', fx: 'coins' }
    else if (dealerBj) next = { title: 'Dealer blackjack', sub: net === 0 ? 'Push' : signedMoney(net), tone: net === 0 ? 'push' : 'lose' }
    else if (net > 0) next = { title: dealerBust ? 'Dealer busts' : 'You win', sub: signedMoney(net), tone: 'win', fx: 'sparks' }
    else if (net === 0) next = { title: 'Push', sub: 'Your bet stays', tone: 'push' }
    else next = { title: allBust ? 'Bust' : dealerBust ? 'Dealer busts' : 'Dealer wins', sub: signedMoney(net), tone: 'lose' }

    setHeadline(next)
    const fire = window.setTimeout(() => {
      if (next.fx) burstAt(ref.current, next.fx, next.fx === 'sparks' ? 50 : 110)
    }, 180)
    const hide = window.setTimeout(() => setHeadline(null), next.tone === 'lose' ? 1800 : 2600)
    return () => {
      clearTimeout(fire)
      clearTimeout(hide)
    }
  }, [phase, lastNet, round, minBet])

  return (
    <div className="banner-anchor" ref={ref}>
      <AnimatePresence>
        {headline && <BannerCard key={headline.title} headline={headline} />}
      </AnimatePresence>
    </div>
  )
}
