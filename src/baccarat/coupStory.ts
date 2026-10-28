import { SUIT_GLYPH } from '../components/suits'
import { BACCARAT_BETS, DRAGON_MARGIN_PAYS, PAIR_PAYS, TIE_PAYS } from '../engine/baccarat/rules'
import { bankerDrawsAgainst, cardPoints, handTotal, isNatural } from '../engine/baccarat/tableau'
import type { BaccaratBetKind, BaccaratResolution, Coup, CoupCard, Side, Winner } from '../engine/baccarat/types'
import { cents } from '../engine/edge'
import type { Rank } from '../engine/types'
import { money } from '../lib/format'

/**
 * "What happened last coup", in sentences.
 *
 * Nobody decides anything in baccarat once the cards are out, which is exactly
 * why a coup can feel like magic to a new player: a third card arrives for one
 * side and not the other, and chips move. This says why each card was drawn
 * or not, by the tableau, and why each bet was paid, pushed or taken — then
 * adds up what went down, what came back to the rack and what that left.
 */
export type CoupOutcome = 'won' | 'lost' | 'push'

export interface CoupItem {
  kind: BaccaratBetKind
  label: string
  outcome: CoupOutcome
  stake: number
  /** Profit after commission on a win, minus the stake on a loss, zero on a push. */
  net: number
  /** What went back to the rack: stake and winnings, the stake on a push, nothing on a loss. */
  returned: number
  why: string
  /** Where the chips went, when that is not obvious from the outcome. */
  fate?: string
}

export interface CoupStory {
  seq: number
  winner: Winner
  playerTotal: number
  bankerTotal: number
  natural: boolean
  /** The coup as the banner calls it: "Banker 7 over 5". */
  headline: string
  /** The coup card by card: the opening totals, then each draw or stand and the rule behind it. */
  steps: string[]
  /** Every bet on the felt, winners first. */
  items: CoupItem[]
  /** Everything that went down. */
  staked: number
  /** Stakes that won or pushed, back to the rack. */
  stakesBack: number
  /** Profit on the winners, after commission. */
  winnings: number
  /** Stakes plus winnings: everything that went back to the rack. */
  returned: number
  /** The 5% the house kept from a Banker win. */
  commission: number
  net: number
}

const ORDER: Record<CoupOutcome, number> = { won: 0, lost: 1, push: 2 }

const NAME: Record<Side, string> = { player: 'Player', banker: 'Banker' }

/** "7♠", "K♣". */
export function cardText(card: Pick<CoupCard, 'rank' | 'suit'>): string {
  return `${card.rank}${SUIT_GLYPH[card.suit]}`
}

/** "a 7♠", "an 8♥", "an A♣". */
function a(card: Pick<CoupCard, 'rank' | 'suit'>): string {
  return `${card.rank === 'A' || card.rank === '8' ? 'an' : 'a'} ${cardText(card)}`
}

/** "an 8", "a 5" — for a bare point value. */
function aValue(value: number): string {
  return `${value === 8 ? 'an' : 'a'} ${value}`
}

const PLURAL: Partial<Record<Rank, string>> = { A: 'aces', K: 'kings', Q: 'queens', J: 'jacks' }

function plural(rank: Rank): string {
  return PLURAL[rank] ?? `${rank}s`
}

/** "a 4♣ makes 9", "a K♣, which counts 0, makes 5". */
function took(card: CoupCard, total: number): string {
  const points = cardPoints(card.rank)
  return String(points) === card.rank ? `${a(card)} makes ${total}` : `${a(card)}, which counts ${points}, makes ${total}`
}

/**
 * The first two cards, with the arithmetic shown wherever it is not obvious:
 * a total past nine keeps only its last digit, and a ten or face card counts
 * nothing.
 */
function opening(side: Side, cards: CoupCard[]): string {
  const [x, y] = cards
  const px = cardPoints(x.rank)
  const py = cardPoints(y.rank)
  const head = `${NAME[side]} ${cardText(x)} ${cardText(y)}: ${(px + py) % 10}`
  if (px + py >= 10) return `${head} (${px} + ${py} is ${px + py}, and only the last digit counts).`
  if (px === 0 || py === 0) return `${head} (tens and face cards count 0).`
  return `${head}.`
}

/** Which Player third cards a Banker total draws against, as the chart would say it. */
function drawsAgainst(total: number): string {
  const values = bankerDrawsAgainst(total)
  if (values.length === 9) {
    const missing = Array.from({ length: 10 }, (_, v) => v).find((v) => !values.includes(v))!
    return `unless the Player’s third card is ${aValue(missing)}`
  }
  const lo = values[0]
  const hi = values[values.length - 1]
  return `only when the Player’s third card is ${lo}${hi === lo + 1 ? ' or ' : ' to '}${hi}`
}

function steps(coup: Coup): string[] {
  const p2 = handTotal(coup.player.slice(0, 2).map((c) => c.rank))
  const b2 = handTotal(coup.banker.slice(0, 2).map((c) => c.rank))
  const out = [opening('player', coup.player), opening('banker', coup.banker)]

  if (coup.natural) {
    if (isNatural(p2) && isNatural(b2)) out.push('Both hands are naturals, so neither side draws.')
    else out.push(`${isNatural(p2) ? `The Player’s ${p2}` : `The Banker’s ${b2}`} is a natural, so neither side draws.`)
    return out
  }

  const third = coup.player[2]
  out.push(third ? `Player draws on ${p2} (0 to 5 draws): ${took(third, coup.playerTotal)}.` : `Player stands on ${p2} (6 or 7 stands).`)

  const drawn = coup.banker[2]
  const banker = drawn ? `draws: ${took(drawn, coup.bankerTotal)}` : 'stands'
  if (!third) {
    out.push(`Player stood, so the Banker plays by the same rule and ${drawn ? `draws on ${b2}: ${took(drawn, coup.bankerTotal)}` : `stands on ${b2}`}.`)
  } else if (b2 <= 2) {
    out.push(`Banker draws on ${b2} (0 to 2 always draws): ${took(drawn!, coup.bankerTotal)}.`)
  } else if (b2 === 7) {
    out.push('Banker stands on 7 (7 always stands).')
  } else {
    out.push(`A Banker ${b2} draws ${drawsAgainst(b2)}. It counted ${cardPoints(third.rank)}, so the Banker ${banker}.`)
  }
  return out
}

/** The coup as the banner calls it: "Banker 7 over 5", "Tie · 6". */
export function coupTitle(coup: Coup): string {
  const p = coup.playerTotal
  const b = coup.bankerTotal
  return coup.winner === 'tie' ? `Tie · ${p}` : coup.winner === 'banker' ? `Banker ${b} over ${p}` : `Player ${p} over ${b}`
}

/** "The Banker’s 7 beat the Player’s 5." */
function beat(coup: Coup): string {
  const [w, l] = coup.winner === 'banker' ? (['banker', 'player'] as const) : (['player', 'banker'] as const)
  const total = (side: Side) => (side === 'player' ? coup.playerTotal : coup.bankerTotal)
  return `The ${NAME[w]}’s ${total(w)} beat the ${NAME[l]}’s ${total(l)}`
}

/** Why one bet did what it did, against the coup as dealt. */
function why(r: BaccaratResolution, coup: Coup): string {
  const won = r.effect === 'win'
  switch (r.kind) {
    case 'player':
    case 'banker': {
      if (r.effect === 'push') return `A tie on ${coup.playerTotal}: ${NAME[r.kind]} bets come back, nothing won or lost.`
      if (!won) return `${beat(coup)}.`
      if (r.kind === 'player') return `${beat(coup)}. Pays even money.`
      return `${beat(coup)}. Pays even money less the 5% commission, ${money(commissionOn(r), true)} here.`
    }
    case 'tie':
      return won ? `Both hands finished on ${coup.playerTotal}. Pays ${TIE_PAYS} to 1.` : `${beat(coup)}, so no tie.`
    case 'playerPair':
    case 'bankerPair': {
      const side: Side = r.kind === 'playerPair' ? 'player' : 'banker'
      const [x, y] = coup[side]
      return won
        ? `The ${NAME[side]}’s first two cards were both ${plural(x.rank)}. Pays ${PAIR_PAYS} to 1.`
        : `The ${NAME[side]}’s first two cards were ${cardText(x)} and ${cardText(y)}, not a pair.`
    }
    case 'dragonPlayer':
    case 'dragonBanker': {
      const side: Side = r.kind === 'dragonPlayer' ? 'player' : 'banker'
      const name = NAME[side]
      const margin = Math.abs(coup.playerTotal - coup.bankerTotal)
      if (r.effect === 'push') return 'A tie on naturals: the Dragon Bonus pushes.'
      if (coup.winner === 'tie') return 'A tie without naturals loses the Dragon Bonus. Only a tie on naturals pushes.'
      if (coup.winner !== side) return `${beat(coup)}, and the Dragon Bonus needs the ${name} to win.`
      if (coup.natural) return `The ${name} won with a natural ${side === 'player' ? coup.playerTotal : coup.bankerTotal}. Pays even money.`
      if (!won) return `The ${name} won by only ${margin} without a natural. The Dragon Bonus needs a natural or a win by 4 or more.`
      return `The ${name} won by ${margin} without a natural. A win by ${margin} pays ${DRAGON_MARGIN_PAYS[margin]} to 1.`
    }
  }
}

/** The 5% kept from a Banker win. */
function commissionOn(r: BaccaratResolution): number {
  return r.kind === 'banker' && r.effect === 'win' ? cents(r.stake - r.net) : 0
}

/** Where the chips went, said the way a dealer would. */
function fate(r: BaccaratResolution): string | undefined {
  if (r.effect === 'win') return `Your ${money(r.stake)} comes back with it: ${money(r.stake + r.net, true)} to the rack.`
  if (r.effect === 'push') return `Your ${money(r.stake)} comes back.`
  return undefined
}

const OUTCOME: Record<BaccaratResolution['effect'], CoupOutcome> = { win: 'won', lose: 'lost', push: 'push' }

export function explainCoup(coup: Coup, resolutions: readonly BaccaratResolution[], seq: number): CoupStory {
  const items: CoupItem[] = resolutions.map((r) => ({
    kind: r.kind,
    label: BACCARAT_BETS[r.kind].title,
    outcome: OUTCOME[r.effect],
    stake: r.stake,
    net: r.net,
    returned: r.effect === 'lose' ? 0 : cents(r.stake + r.net),
    why: why(r, coup),
    fate: fate(r),
  }))
  items.sort((x, y) => ORDER[x.outcome] - ORDER[y.outcome] || Math.abs(y.net) - Math.abs(x.net) || y.stake - x.stake)

  const sum = (pick: (r: BaccaratResolution) => number) => cents(resolutions.reduce((total, r) => total + pick(r), 0))
  const stakesBack = sum((r) => (r.effect === 'lose' ? 0 : r.stake))
  const winnings = sum((r) => (r.effect === 'win' ? r.net : 0))

  return {
    seq,
    winner: coup.winner,
    playerTotal: coup.playerTotal,
    bankerTotal: coup.bankerTotal,
    natural: coup.natural,
    headline: coupTitle(coup),
    steps: steps(coup),
    items,
    staked: sum((r) => r.stake),
    stakesBack,
    winnings,
    returned: cents(stakesBack + winnings),
    commission: sum(commissionOn),
    net: sum((r) => r.net),
  }
}
