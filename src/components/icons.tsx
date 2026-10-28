import type { SVGProps } from 'react'

/**
 * A small, consistent icon set: 24px grid, 1.6 stroke, round joins. Drawn here
 * rather than pulled from a library so every glyph shares one hand.
 */
type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconBook = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4.5h10.5a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2v-13Z" fill="currentColor" fillOpacity="0.12" />
    <path d="M5 17.5a2 2 0 0 1 2-2h10.5" />
    <path d="M13 4.5v5.5l-1.8-1.3-1.8 1.3V4.5" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconStats = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 19.5h16" />
    <rect x="5.5" y="11" width="3" height="6.5" rx="0.8" />
    <rect x="10.5" y="7" width="3" height="10.5" rx="0.8" />
    <rect x="15.5" y="4" width="3" height="13.5" rx="0.8" />
  </Svg>
)

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
)

export const IconVolume = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fillOpacity="0.14" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
)

export const IconMute = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fillOpacity="0.14" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Svg>
)

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const IconBack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Svg>
)

export const IconUndo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14 4.5 9.5 9 5" />
    <path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" />
  </Svg>
)

export const IconClear = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9L17.5 7" />
    <path d="M10.5 11v5M13.5 11v5" />
  </Svg>
)

export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 13.8 9l5.7 1.5-5.7 1.7L12 18l-1.8-5.8-5.7-1.7L10.2 9z" fill="currentColor" fillOpacity="0.18" />
  </Svg>
)

export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 7.8v.1" />
  </Svg>
)

export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 5.5 6.5 6.5L9 18.5" />
  </Svg>
)

export const IconHand = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 12V6.5a1.5 1.5 0 0 1 3 0V11m0-4.5v-2a1.5 1.5 0 0 1 3 0V11m0-4a1.5 1.5 0 0 1 3 0v4.5m0-2.5a1.5 1.5 0 0 1 3 0v5.5a6.5 6.5 0 0 1-6.5 6.5h-1a6 6 0 0 1-5.2-3l-2.6-4.6a1.5 1.5 0 0 1 2.4-1.8l1.4 1.6" />
  </Svg>
)

export const IconPlusCard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="3.5" width="12" height="17" rx="2" />
    <path d="M12 9v6M9 12h6" />
  </Svg>
)

export const IconDouble = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9.5" cy="12" r="5.5" />
    <circle cx="14.5" cy="12" r="5.5" />
  </Svg>
)

export const IconSplit = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="8" height="12" rx="1.6" />
    <rect x="13.5" y="6" width="8" height="12" rx="1.6" />
    <path d="M12 3v18" strokeDasharray="1.5 2.5" />
  </Svg>
)

export const IconFlag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 21V4.5" />
    <path d="M6 5h11l-2.5 4 2.5 4H6" fill="currentColor" fillOpacity="0.14" />
  </Svg>
)

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 19 6v5.5c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6z" fill="currentColor" fillOpacity="0.12" />
  </Svg>
)

export const IconDice = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="8" width="11" height="11" rx="2.2" />
    <path d="M10 5.5 12.2 3.4a2 2 0 0 1 2.8 0l5.6 5.6a2 2 0 0 1 0 2.8L16.5 16" />
    <circle cx="6.3" cy="11.3" r="0.9" fill="currentColor" />
    <circle cx="10.7" cy="15.7" r="0.9" fill="currentColor" />
    <circle cx="8.5" cy="13.5" r="0.9" fill="currentColor" />
  </Svg>
)

export const IconHistory = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" />
    <path d="M4 4v4.5h4.5M12 8v4.5l3 2" />
  </Svg>
)

export const IconZoomIn = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 4.5 4.5M10.5 7.8v5.4M7.8 10.5h5.4" />
  </Svg>
)

export const IconZoomOut = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 4.5 4.5M7.8 10.5h5.4" />
  </Svg>
)
