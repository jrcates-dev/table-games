/** The dock when the rack is empty: the run is over, and a fresh stake is one press away. */
export function OutOfChips({ onRebuy }: { onRebuy(): void }) {
  return (
    <div className="dock__row dock__row--center">
      <div className="dock__message">
        <span className="eyebrow">Out of chips</span>
        <p>The rack is empty. This run is filed with its peak — sit back down with a fresh stake.</p>
      </div>
      <button type="button" className="btn btn--gold btn--lg" onClick={onRebuy}>
        Buy back in
      </button>
    </div>
  )
}
