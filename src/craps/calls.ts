import type { Roll, RollLogEntry } from '../engine/craps/types'

/**
 * The stickman's patter.
 *
 * Every roll at a real table is called out loud, in a vocabulary as old as the
 * game — "yo-leven", "seven out, line away", "hard eight". The words matter:
 * "easy six" and "hard six" are different bets, and a player learns which is
 * which by hearing it called every time the dice land.
 */
export interface Call {
  /** The headline, as printed. */
  title: string
  /** The line under it. */
  sub: string
  /** What the stickman actually says. */
  spoken: string
  tone: 'win' | 'lose' | 'neutral' | 'big'
}

const WORD: Record<number, string> = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
}

function pick<T>(options: T[], salt: number): T {
  return options[Math.abs(salt) % options.length]
}

export function stickmanCall(roll: Roll, entry: RollLogEntry | undefined, salt: number): Call {
  const { total, a, b } = roll
  const pair = a === b
  const note = entry?.note
  const w = WORD[total]

  switch (note) {
    case 'natural':
      return total === 7
        ? { title: 'Seven — winner', sub: 'Front line winner · pay the line', spoken: pick(['Seven, winner! Pay the line.', 'Seven! Front line winner.'], salt), tone: 'win' }
        : { title: 'Yo-leven', sub: 'Winner on the come-out', spoken: pick(['Yo-leven! Winner!', 'Yo! Eleven, pay the line.'], salt), tone: 'win' }
    case 'craps':
      if (total === 2) return { title: 'Craps — aces', sub: 'Line away · two craps', spoken: 'Aces! Two craps, line away.', tone: 'lose' }
      if (total === 3) return { title: 'Craps — ace-deuce', sub: 'Line away · three craps', spoken: 'Ace deuce, three craps. Line away.', tone: 'lose' }
      return { title: 'Craps — boxcars', sub: "Line away · the don'ts push", spoken: 'Twelve craps, boxcars! Line away.', tone: 'lose' }
    case 'pointSet':
      return {
        title: `The point is ${total}`,
        sub: pair && total !== 2 && total !== 12 ? `${capital(w)} the hard way — mark the ${total}` : `Mark the ${total}`,
        spoken: pick([`The point is ${w}. Mark it.`, `${capital(w)}, the point is ${w}.`, `Mark the ${w}, the point is ${w}.`], salt),
        tone: 'neutral',
      }
    case 'pointMade':
      return {
        title: pair ? `Hard ${total} — winner` : `${total} — winner`,
        sub: 'The point is made · pay the line',
        spoken: pair ? `${capital(w)} the hard way! Winner, pay the line!` : pick([`${capital(w)}, winner! Pay the line.`, `Winner winner! ${capital(w)} the point.`], salt),
        tone: 'big',
      }
    case 'sevenOut':
      return { title: 'Seven out', sub: "Line away · pay the don'ts", spoken: pick(['Seven out! Line away.', "Seven out. Pay the don'ts, take the line."], salt), tone: 'lose' }
  }

  // A number rolled with the point on: the numbers call themselves.
  switch (total) {
    case 2:
      return { title: 'Aces', sub: 'Two craps', spoken: 'Aces, two craps.', tone: 'neutral' }
    case 3:
      return { title: 'Ace-deuce', sub: 'Three craps', spoken: 'Ace deuce, three.', tone: 'neutral' }
    case 11:
      return { title: 'Yo-leven', sub: 'Eleven, a field number', spoken: 'Yo-leven!', tone: 'neutral' }
    case 12:
      return { title: 'Boxcars', sub: 'Twelve craps · the field pays triple', spoken: 'Twelve! Boxcars.', tone: 'neutral' }
    case 5:
      return { title: 'Five', sub: 'No field five', spoken: 'Five, no field five.', tone: 'neutral' }
    case 9:
      return { title: 'Nine', sub: 'Centre field nine', spoken: 'Nine, centre field nine.', tone: 'neutral' }
    default:
      return pair
        ? { title: `Hard ${total}`, sub: `${capital(w)} the hard way`, spoken: `${capital(w)} the hard way!`, tone: 'neutral' }
        : { title: `Easy ${total}`, sub: `${capital(w)}, came easy`, spoken: pick([`Easy ${w}.`, `${capital(w)}, easy ${w}.`], salt), tone: 'neutral' }
  }
}

function capital(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
