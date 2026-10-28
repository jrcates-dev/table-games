import { useId, useState, type ReactNode } from 'react'
import { play } from '../audio'

/** Form controls for the settings drawers, in the house style. */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="form-section">
      <h3 className="form-section__title">{title}</h3>
      <div className="form-section__body">{children}</div>
    </section>
  )
}

/** The label names the group, so a screen reader reads it out on the input, select or buttons inside. */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <span id={id} className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  )
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange(next: boolean): void
  disabled?: boolean
}) {
  return (
    <label className={`toggle${disabled ? ' is-disabled' : ''}`}>
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        {hint && <span className="toggle__hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          play('click')
          onChange(event.target.checked)
        }}
      />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange(next: T): void
  disabled?: boolean
}) {
  return (
    <div className={`segmented${disabled ? ' is-disabled' : ''}`} role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={option.value === value ? 'is-active' : undefined}
          disabled={disabled}
          onClick={() => {
            play('click')
            onChange(option.value)
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange(next: number): void
  disabled?: boolean
}) {
  return (
    <label className={`slider${disabled ? ' is-disabled' : ''}`}>
      <span className="slider__label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        style={{ '--fill': `${Math.round(value * 100)}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
      <span className="slider__value num">{Math.round(value * 100)}</span>
    </label>
  )
}

export function Swatches<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ id: T; name: string; swatch: string }>
  onChange(next: T): void
}) {
  return (
    <div className="swatches" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          className={`swatch${option.id === value ? ' is-active' : ''}`}
          onClick={() => {
            play('click')
            onChange(option.id)
          }}
          title={option.name}
        >
          <span className="swatch__dot" style={{ background: option.swatch }} />
          <span className="swatch__name">{option.name}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * A number typed in rather than picked from a list — $500 and $250,000 are
 * different games and no shortlist holds everyone's. The text is held locally
 * while editing so clearing the field to retype does not fight the clamp on
 * every keystroke; the store has the last word on commit.
 */
export function MoneyInput({ value, onCommit, label }: { value: number; onCommit(next: number): void; label?: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const parsed = Number(draft.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(parsed) && parsed > 0) onCommit(parsed)
    setDraft(null)
  }
  return (
    <div className="money-input">
      <span>$</span>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={draft ?? value.toLocaleString('en-US')}
        onFocus={(event) => {
          setDraft(String(value))
          requestAnimationFrame(() => event.target.select())
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </div>
  )
}
