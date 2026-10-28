import { motion } from 'motion/react'
import { useMemo } from 'react'
import { play } from '../audio'
import { FlatDie } from '../components/CssDie'
import { IconChevron } from '../components/icons'
import { money, signedMoney } from '../lib/format'
import { useCrapsStore } from '../store/crapsStore'
import { explainRoll, type RollOutcome } from './rollStory'

const TAG: Record<RollOutcome, string> = {
  won: 'Won',
  lost: 'Lost',
  push: 'Push',
  off: 'Off',
  point: 'Point',
  moved: 'Moved',
  waiting: 'Up',
}

/**
 * What happened last roll: the number, every bet it decided and why, and the
 * bets it left alone.
 *
 * The callout says the roll out loud and is gone in a couple of seconds; this
 * stays until the next throw lands, so the chips that moved can be checked
 * against a reason at the player's own pace. It folds to one line for anyone
 * who no longer needs the reasons.
 */
export function LastRoll() {
  const lastThrow = useCrapsStore((s) => s.lastThrow)
  const rolling = useCrapsStore((s) => s.game.phase === 'rolling')
  const open = useCrapsStore((s) => s.profile.settings.showSettlementDetail)
  const update = useCrapsStore((s) => s.updateSettings)
  const story = useMemo(() => (lastThrow ? explainRoll(lastThrow.before, lastThrow.after) : null), [lastThrow])
  if (!story) return null

  const tone = story.net > 0 ? 'win' : story.net < 0 ? 'lose' : 'flat'
  const decided = story.items.filter((item) => item.outcome !== 'waiting')
  const waiting = story.items.filter((item) => item.outcome === 'waiting')

  return (
    <section className={`last-roll is-${tone}${open ? ' is-open' : ''}${rolling ? ' is-stale' : ''}`} aria-label="What happened last roll">
      <button
        type="button"
        className="last-roll__head"
        onClick={() => {
          play(open ? 'close' : 'open')
          update({ showSettlementDetail: !open })
        }}
        aria-expanded={open}
        title={open ? 'Fold the explanation away' : 'Show what the last roll did to every bet, and why'}
      >
        <span className="last-roll__dice">
          <FlatDie value={story.a} size={22} />
          <FlatDie value={story.b} size={22} />
        </span>
        <span className="last-roll__title">
          <span className="eyebrow">{rolling ? 'Previous roll' : 'Last roll'} · {story.total}</span>
          <strong>{story.headline}</strong>
        </span>
        <strong className={`last-roll__net num is-${tone}`}>{story.net === 0 ? 'Even' : signedMoney(story.net)}</strong>
        <IconChevron className="last-roll__chevron" width={14} height={14} />
      </button>

      {open && (
        <motion.div key={story.seq} className="last-roll__body" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <p className="last-roll__summary">{story.summary}</p>
          {decided.length > 0 && (
            <ul className="last-roll__items">
              {decided.map((item) => (
                <li key={item.id} className={`last-roll__item is-${item.outcome}`}>
                  <div className="last-roll__row">
                    <span className="last-roll__tag">{TAG[item.outcome]}</span>
                    <span className="last-roll__name">{item.label}</span>
                    <span className="last-roll__amount num">
                      {item.outcome === 'won' || item.outcome === 'lost' ? signedMoney(item.amount) : money(item.amount)}
                    </span>
                  </div>
                  <p className="last-roll__why">
                    {item.why}
                    {item.fate && <span className="last-roll__fate"> {item.fate}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {waiting.length > 0 && (
            <>
              {/* The rest of the felt, so nothing on it goes unexplained — one line each, because the rail below already says the rest. */}
              <span className="eyebrow last-roll__quiet-head">{story.waitingLabel}</span>
              <ul className="last-roll__quiet">
                {waiting.map((item) => (
                  <li key={item.id}>
                    <span className="last-roll__name">{item.label}</span>
                    <span className="last-roll__amount num">{money(item.amount)}</span>
                    <span className="last-roll__why">{item.why}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.div>
      )}
    </section>
  )
}
