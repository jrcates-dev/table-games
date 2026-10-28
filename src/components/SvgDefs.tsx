/**
 * Gradients and filters shared by every chip, card and table on the page.
 *
 * Defined once at the root and referenced by id, so a felt covered in forty
 * stacks carries forty references rather than forty copies of the same
 * gradient. Kept visible-but-empty rather than `display: none`, which some
 * engines treat as removing the definitions along with the box.
 */
export function SvgDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        {/* Chips ------------------------------------------------------------ */}
        <radialGradient id="chip-shine" cx="0.34" cy="0.26" r="0.82">
          <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
          <stop offset="0.38" stopColor="#fff" stopOpacity="0.07" />
          <stop offset="0.72" stopColor="#000" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000" stopOpacity="0.32" />
        </radialGradient>
        <radialGradient id="chip-inlay" cx="0.42" cy="0.36" r="0.75">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="0.7" stopColor="#f3ead6" />
          <stop offset="1" stopColor="#dccfb2" />
        </radialGradient>
        <linearGradient id="chip-tube" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.72" />
          <stop offset="0.14" stopColor="#000" stopOpacity="0.3" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.76" stopColor="#000" stopOpacity="0.2" />
          <stop offset="1" stopColor="#000" stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id="chip-tube-lip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.85" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="chip-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="0.16" stopColor="#000" stopOpacity="0.12" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.58" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.86" stopColor="#000" stopOpacity="0.16" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </linearGradient>

        {/* Gold ------------------------------------------------------------- */}
        <linearGradient id="gold-foil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1c9" />
          <stop offset="0.25" stopColor="#e8c67a" />
          <stop offset="0.48" stopColor="#b98a3a" />
          <stop offset="0.66" stopColor="#f4d994" />
          <stop offset="0.84" stopColor="#c89a47" />
          <stop offset="1" stopColor="#8a6526" />
        </linearGradient>
        <linearGradient id="gold-foil-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0c4" />
          <stop offset="0.45" stopColor="#e3c170" />
          <stop offset="0.55" stopColor="#c99c45" />
          <stop offset="1" stopColor="#f0d58f" />
        </linearGradient>

        {/* Cards ------------------------------------------------------------ */}
        {/* Matte card stock: warm off-white with no hotspot, so a card under the
            pendant light reads as paper rather than glare. */}
        <linearGradient id="card-paper" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#f7f2e7" />
          <stop offset="1" stopColor="#ebe3d2" />
        </linearGradient>
      </defs>
    </svg>
  )
}
