import { EDGE_LABEL, edgeBand } from '../engine/edge'

/**
 * What the house keeps on a bet, as the coloured pill every table uses: the
 * same five bands and the same five words, so a red pill means the same thing
 * on the roulette layout as it does in the middle of the craps table.
 *
 * A negative edge is the player's: it happens in baccarat, late in a shoe,
 * when the cards already gone have tilted a side bet in your favour.
 */
export function EdgePill({ edge, digits = 2, label = true, title }: { edge: number; digits?: number; label?: boolean; title?: string }) {
  const band = edgeBand(edge)
  const yours = edge < 0
  const figure = edge === 0 ? 'No edge' : `${(Math.abs(edge) * 100).toFixed(digits)}%${yours ? ' yours' : ''}`
  return (
    <span className={`edge-pill edge-pill--${band}${yours ? ' is-yours' : ''}`} title={title ?? (yours ? 'The edge is with you on this bet' : `${(edge * 100).toFixed(3)}% house edge`)}>
      {figure}
      {label && ` · ${yours ? 'Advantage' : EDGE_LABEL[band]}`}
    </span>
  )
}

/** A bar for the reference cards: how far along the scale from free to the worst bet in the building. */
export function EdgeBar({ edge, worst = 0.21 }: { edge: number; worst?: number }) {
  const band = edgeBand(edge)
  return (
    <span className={`edge-bar edge-bar--${band}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, (edge / worst) * 100))}%` }} />
    </span>
  )
}
