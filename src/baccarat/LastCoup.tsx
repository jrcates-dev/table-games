import { motion } from 'motion/react'
import { useMemo } from 'react'
import { play } from '../audio'
import { IconChevron } from '../components/icons'
import { isRed } from '../components/suits'
import type { CoupCard, Side } from '../engine/baccarat/types'
import { money, signedMoney } from '../lib/format'
import { useBaccaratStore } from '../store/baccaratStore'
import { cardText, explainCoup, type CoupOutcome, type CoupStory } from './coupStory'

const TAG: Record<CoupOutcome, string> = { won: 'Won', lost: 'Lost', push: 'Push' }

/**
 * What happened last coup: both hands card by card, why each third card was
 * or was not drawn, every bet and why it was paid, pushed or taken, and what
 * all of it came to.
 *
 * The banner calls the result and is gone in a moment; this stays until the
 * next coup is turned over, through the next round of betting, so the money
 * can be checked against a reason at the player's own pace. It folds to one
 * line for anyone who no longer needs the reasons. Built on the craps table's
 * last-roll card, so the two read alike.
 */
export function LastCoup() {
  const last = useBaccaratStore((s) => s.lastCoup)
  const dealing = useBaccaratStore((s) => s.game.phase === 'dealt')
  const open = useBaccaratStore((s) => s.profile.settings.showCoupDetail)
  const update = useBaccaratStore((s) => s.updateSettings)
  const story = useMemo(() => (last ? explainCoup(last.coup, last.resolutions, last.seq) : null), [last])
  if (!last || !story) return null

  const tone = story.net > 0 ? 'win' : story.net < 0 ? 'lose' : 'flat'

  return (
    <section className={`last-roll ba-last is-${tone}${open ? ' is-open' : ''}${dealing ? ' is-stale' : ''}`} aria-label="What happened last coup">
      <button
        type="button"
        className="last-roll__head"
        onClick={() => {
          play(open ? 'close' : 'open')
          update({ showCoupDetail: !open })
        }}
        aria-expanded={open}
        title={open ? 'Fold the explanation away' : 'Show how the last coup played out, and what it did to every bet'}
      >
        {/* The coup's bead, as the plate below shows it: the winner's colour and total. */}
        <span className={`ba-bead ba-bead--${story.winner} ba-last__bead${story.natural ? ' is-natural' : ''}`} aria-hidden>
          {story.winner === 'banker' ? story.bankerTotal : story.playerTotal}
        </span>
        <span className="last-roll__title">
          <span className="eyebrow">
            {dealing ? 'Previous coup' : 'Last coup'}
            {story.natural ? ' · natural' : ''}
          </span>
          <strong>{story.headline}</strong>
        </span>
        <strong className={`last-roll__net num is-${tone}`}>{story.net === 0 ? 'Even' : signedMoney(story.net, true)}</strong>
        <IconChevron className="last-roll__chevron" width={14} height={14} />
      </button>

      {open && (
        <motion.div key={story.seq} className="last-roll__body" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="ba-last__hands">
            <Hand side="player" cards={last.coup.player} total={story.playerTotal} />
            <Hand side="banker" cards={last.coup.banker} total={story.bankerTotal} />
          </div>
          <ol className="ba-last__steps">
            {story.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <span className="eyebrow ba-last__label">Your bets</span>
          <ul className="last-roll__items">
            {story.items.map((item) => (
              <li key={item.kind} className={`last-roll__item is-${item.outcome}`}>
                <div className="last-roll__row">
                  <span className="last-roll__tag">{TAG[item.outcome]}</span>
                  <span className="last-roll__name">{item.label}</span>
                  <span className="last-roll__amount num">{item.outcome === 'push' ? money(item.stake) : signedMoney(item.net, true)}</span>
                </div>
                <p className="last-roll__why">
                  {item.why}
                  {item.fate && <span className="last-roll__fate"> {item.fate}</span>}
                </p>
              </li>
            ))}
          </ul>

          <dl className="ba-last__sum">
            <div>
              <dt>Bet</dt>
              <dd className="num">{money(story.staked, true)}</dd>
            </div>
            <div>
              <dt>Returned</dt>
              <dd className="num">{money(story.returned, true)}</dd>
            </div>
            <div className={`is-${tone}`}>
              <dt>Net</dt>
              <dd className="num">{story.net === 0 ? 'Even' : signedMoney(story.net, true)}</dd>
            </div>
          </dl>
          <p className="ba-last__note">{returnedNote(story)}</p>
        </motion.div>
      )}
    </section>
  )
}

/** One hand as it finished, the third card ringed the way a dealer lays it sideways. */
function Hand({ side, cards, total }: { side: Side; cards: CoupCard[]; total: number }) {
  return (
    <div className="ba-last__line">
      <span className={`ba-last__who tone-${side}`}>{side === 'player' ? 'Player' : 'Banker'}</span>
      <span className="ba-last__cards">
        {cards.map((card) => (
          <span key={card.id} className={`card-chip${isRed(card.suit) ? ' is-red' : ''}${card.third ? ' is-third' : ''}`} title={card.third ? 'Third card' : undefined}>
            {cardText(card)}
          </span>
        ))}
      </span>
      <strong className="ba-last__points num">{total}</strong>
    </div>
  )
}

/** What "Returned" is made of, so it can be checked against the rack. */
function returnedNote(story: CoupStory): string {
  if (story.returned === 0) return `Nothing came back: every bet lost, and the house took ${money(story.staked, true)}.`
  const winnings = story.winnings > 0 ? ` + ${money(story.winnings, true)} in winnings` : ''
  const commission = story.commission > 0 ? `, after the ${money(story.commission, true)} Banker commission` : ''
  const kept = story.staked - story.stakesBack > 0 ? ` The house took ${money(story.staked - story.stakesBack, true)} in losing bets.` : ''
  return `Returned is ${money(story.stakesBack, true)} in stakes back${winnings}${commission}.${kept}`
}
