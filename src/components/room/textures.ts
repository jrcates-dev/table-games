/**
 * The room's textures, drawn once as SVG and handed to CSS as data URLs.
 *
 * A casino floor is recognisable at a glance by its carpet — loud, ornate and
 * endlessly repeating so that nobody's eye rests on the floor for long — and
 * its walls by gilt and lacquer. Both are generated here rather than shipped
 * as images, like everything else on the floor.
 */

import { blackjackTable, crapsTable, type TableArt } from './tables'

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`

/** A star of `points` points as an SVG path, centred on the origin. */
function star(points: number, outer: number, inner: number, turn = 0): string {
  const step = Math.PI / points
  const out: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = turn + i * step - Math.PI / 2
    out.push(`${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`)
  }
  return `M ${out.join(' L ')} Z`
}

/** Four petals round the origin, as a rosette. */
function petals(length: number, width: number, turn = 0): string {
  const out: string[] = []
  for (let i = 0; i < 4; i++) {
    const a = turn + (i * Math.PI) / 2
    const tip = [Math.cos(a) * length, Math.sin(a) * length]
    const l = [Math.cos(a - Math.PI / 2) * width, Math.sin(a - Math.PI / 2) * width]
    const r = [Math.cos(a + Math.PI / 2) * width, Math.sin(a + Math.PI / 2) * width]
    out.push(
      `M 0 0 Q ${(l[0] + tip[0] * 0.55).toFixed(2)} ${(l[1] + tip[1] * 0.55).toFixed(2)} ${tip[0].toFixed(2)} ${tip[1].toFixed(2)} Q ${(r[0] + tip[0] * 0.55).toFixed(2)} ${(r[1] + tip[1] * 0.55).toFixed(2)} 0 0 Z`,
    )
  }
  return out.join(' ')
}

/**
 * One repeat of the carpet: an oxblood ground, a gold lattice, a teal
 * eight-point medallion in every diamond and a royal-blue rosette where four
 * diamonds meet, with scrolls and seed-dots filling the gaps.
 */
export function carpetSvg(): string {
  const S = 200
  const h = S / 2
  const corners = [
    [0, 0],
    [S, 0],
    [0, S],
    [S, S],
  ]
  const scroll = (x: number, y: number, rot: number) =>
    `<path transform='translate(${x} ${y}) rotate(${rot})' d='M -16 6 C -16 -10 4 -14 10 -4 C 14 3 6 9 1 5 C -2 2 1 -2 4 0' fill='none' stroke='#d8a94c' stroke-width='2.4' stroke-linecap='round'/>`
  const leaf = (rot: number) =>
    `<path transform='rotate(${rot})' d='M 0 -40 Q 9 -52 0 -66 Q -9 -52 0 -40 Z' fill='#c4483c'/><circle transform='rotate(${rot})' cx='0' cy='-72' r='3' fill='#e8c878'/>`

  return `
<svg xmlns='http://www.w3.org/2000/svg' width='${S}' height='${S}' viewBox='0 0 ${S} ${S}'>
  <rect width='${S}' height='${S}' fill='#3d0c19'/>
  <g fill='#4f1424'>
    ${[25, 75, 125, 175].flatMap((x) => [25, 75, 125, 175].map((y) => `<path d='M ${x} ${y - 7} L ${x + 7} ${y} L ${x} ${y + 7} L ${x - 7} ${y} Z'/>`)).join('')}
  </g>
  <path d='M ${h} 0 L ${S} ${h} L ${h} ${S} L 0 ${h} Z' fill='#2a0812'/>
  <path d='M ${h} 10 L ${S - 10} ${h} L ${h} ${S - 10} L 10 ${h} Z' fill='none' stroke='#1f6a73' stroke-width='3'/>
  <path d='M ${h} 0 L ${S} ${h} L ${h} ${S} L 0 ${h} Z' fill='none' stroke='#d3a24a' stroke-width='4'/>
  <g transform='translate(${h} ${h})'>
    ${[0, 90, 180, 270].map(leaf).join('')}
    <circle r='36' fill='#15525a'/>
    <circle r='36' fill='none' stroke='#d3a24a' stroke-width='2.5'/>
    <path d='${star(8, 31, 15)}' fill='#e0b45a'/>
    <path d='${star(8, 19, 10, Math.PI / 8)}' fill='#7a1a2e'/>
    <circle r='8' fill='#1b6e78' stroke='#f0d58f' stroke-width='2'/>
  </g>
  ${corners
    .map(
      ([x, y]) => `
  <g transform='translate(${x} ${y})'>
    <circle r='30' fill='#23306e'/>
    <path d='${petals(27, 11, Math.PI / 4)}' fill='#c99c45'/>
    <path d='${petals(16, 7)}' fill='#3f8f99'/>
    <circle r='6' fill='#f0d58f'/>
  </g>`,
    )
    .join('')}
  ${scroll(52, 22, 0)}${scroll(148, 22, 90)}${scroll(178, 148, 180)}${scroll(22, 148, 270)}
  ${scroll(22, 52, 270)}${scroll(178, 52, 0)}${scroll(148, 178, 90)}${scroll(52, 178, 180)}
  <g fill='#e8c878'>
    <circle cx='${h}' cy='24' r='2.6'/><circle cx='${h}' cy='${S - 24}' r='2.6'/>
    <circle cx='24' cy='${h}' r='2.6'/><circle cx='${S - 24}' cy='${h}' r='2.6'/>
  </g>
</svg>`
}

/**
 * One bay of the back wall: lacquered panels between fluted, gilt pilasters,
 * each panel carrying an Art Deco sunburst.
 */
export function wallSvg(): string {
  const W = 240
  const H = 480
  const rays = Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI + (i / 12) * Math.PI
    const x = 120 + Math.cos(a) * 70
    const y = 210 + Math.sin(a) * 70
    return `<line x1='120' y1='210' x2='${x.toFixed(1)}' y2='${y.toFixed(1)}'/>`
  }).join('')
  return `
<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>
  <defs>
    <linearGradient id='p' x1='0' x2='1'>
      <stop offset='0' stop-color='#120709'/>
      <stop offset='0.5' stop-color='#2a1013'/>
      <stop offset='1' stop-color='#120709'/>
    </linearGradient>
    <linearGradient id='g' x1='0' x2='1'>
      <stop offset='0' stop-color='#6b4a1c'/>
      <stop offset='0.5' stop-color='#d9b46a'/>
      <stop offset='1' stop-color='#6b4a1c'/>
    </linearGradient>
  </defs>
  <rect width='${W}' height='${H}' fill='#1a0a0d'/>
  <rect x='40' y='40' width='160' height='400' rx='3' fill='url(#p)'/>
  <rect x='40' y='40' width='160' height='400' rx='3' fill='none' stroke='#b98a3a' stroke-opacity='0.55' stroke-width='1.5'/>
  <rect x='50' y='50' width='140' height='380' rx='2' fill='none' stroke='#b98a3a' stroke-opacity='0.25' stroke-width='1'/>
  <g stroke='#c99c45' stroke-opacity='0.28' stroke-width='1.2'>${rays}</g>
  <path d='M 50 210 A 70 70 0 0 1 190 210' fill='none' stroke='#c99c45' stroke-opacity='0.45' stroke-width='1.5'/>
  <path d='M 76 210 A 44 44 0 0 1 164 210' fill='none' stroke='#c99c45' stroke-opacity='0.3' stroke-width='1'/>
  <path d='M 120 300 L 132 330 L 120 360 L 108 330 Z' fill='none' stroke='#c99c45' stroke-opacity='0.35' stroke-width='1.2'/>
  <rect x='0' y='0' width='18' height='${H}' fill='url(#g)' opacity='0.5'/>
  <rect x='${W - 18}' y='0' width='18' height='${H}' fill='url(#g)' opacity='0.5'/>
  <g fill='#000' opacity='0.35'>
    <rect x='4' y='0' width='2' height='${H}'/><rect x='10' y='0' width='2' height='${H}'/>
    <rect x='${W - 14}' y='0' width='2' height='${H}'/><rect x='${W - 8}' y='0' width='2' height='${H}'/>
  </g>
</svg>`
}

/** Geometry of one repeat of the slot bank, shared with the CSS that lights it. */
export const SLOTS = { cab: 96, gap: 10, aisle: 80, h: 300, base: 258 } as const
export const SLOTS_W = SLOTS.cab * 4 + SLOTS.gap * 3 + SLOTS.aisle

/**
 * A bank of four slot machines and the aisle beside it, repeated along the
 * far wall — marquee toppers, lit glass, reels and the button deck — each
 * with its upholstered swivel stool pulled up in front, seen from behind.
 */
export function slotsSvg(): string {
  const { cab: CAB, gap: GAP, aisle: AISLE, h: H, base: BASE } = SLOTS
  const W = SLOTS_W
  const themes = [
    { top: ['#ff6b6b', '#a3172a'], glass: ['#ffe08a', '#e0662a'] },
    { top: ['#ffd86e', '#a9721c'], glass: ['#8fd9ff', '#2c4fc4'] },
    { top: ['#c99bff', '#55229a'], glass: ['#ff9bd6', '#93247f'] },
    { top: ['#7af2cf', '#13806b'], glass: ['#fff09a', '#c98a16'] },
  ]
  const defs = themes
    .map(
      (t, i) => `
    <linearGradient id='t${i}' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${t.top[0]}'/><stop offset='1' stop-color='${t.top[1]}'/></linearGradient>
    <radialGradient id='g${i}' cx='0.5' cy='0.4' r='0.75'><stop offset='0' stop-color='#fff6dc'/><stop offset='0.3' stop-color='${t.glass[0]}'/><stop offset='1' stop-color='${t.glass[1]}'/></radialGradient>`,
    )
    .join('')

  const seven = (x: number, y: number) =>
    `<path d='M ${x - 5} ${y - 7} H ${x + 5} L ${x - 1} ${y + 8}' fill='none' stroke='#d3182c' stroke-width='3' stroke-linejoin='round'/>`
  const cherry = (x: number, y: number) =>
    `<path d='M ${x - 3} ${y + 2} Q ${x} ${y - 9} ${x + 4} ${y - 8}' fill='none' stroke='#2f8a3a' stroke-width='1.4'/><circle cx='${x - 3}' cy='${y + 4}' r='3.4' fill='#d3182c'/><circle cx='${x + 3}' cy='${y + 3}' r='3.4' fill='#e02a3c'/>`
  const bar = (x: number, y: number) =>
    `<rect x='${x - 7}' y='${y - 4}' width='14' height='8' rx='1.5' fill='#1b1a20'/><rect x='${x - 5}' y='${y - 1}' width='10' height='2' fill='#e3c170'/>`
  const symbols = [seven, cherry, bar]

  const cabinet = (i: number) => {
    const x = AISLE / 2 + i * (CAB + GAP)
    const cx = CAB / 2
    return `
  <g transform='translate(${x} 0)'>
    <rect x='0' y='26' width='${CAB}' height='${BASE - 26}' rx='7' fill='url(#body)'/>
    <rect x='0' y='26' width='3.5' height='${BASE - 26}' rx='1.5' fill='url(#chrome)'/>
    <rect x='${CAB - 3.5}' y='26' width='3.5' height='${BASE - 26}' rx='1.5' fill='url(#chrome)'/>
    <rect x='5' y='0' width='${CAB - 10}' height='36' rx='13' fill='url(#t${i})'/>
    <rect x='12' y='5' width='${CAB - 24}' height='9' rx='4.5' fill='#fff' opacity='0.4'/>
    <rect x='7' y='42' width='${CAB - 14}' height='72' rx='6' fill='#0a090d'/>
    <rect x='10' y='45' width='${CAB - 20}' height='66' rx='4' fill='url(#g${i})'/>
    <rect x='10' y='45' width='${CAB - 20}' height='22' rx='4' fill='#fff' opacity='0.12'/>
    <rect x='9' y='122' width='${CAB - 18}' height='42' rx='4' fill='#0a090d'/>
    ${[0, 1, 2].map((r) => `<rect x='${13 + r * 24}' y='125' width='22' height='36' rx='2' fill='url(#reel)'/>${symbols[(r + i) % 3](24 + r * 24, 143)}`).join('')}
    <rect x='12' y='142' width='${CAB - 24}' height='1.2' fill='#ff3b3b' opacity='0.65'/>
    <path d='M 4 172 L ${CAB - 4} 172 L ${CAB - 8} 188 L 8 188 Z' fill='#2c2830'/>
    ${[0, 1, 2, 3, 4].map((b) => `<circle cx='${18 + b * 15}' cy='180' r='3.6' fill='${['#ff5a5a', '#ffd25a', '#5ad1ff', '#ffd25a', '#8cff7a'][b]}'/>`).join('')}
    <rect x='14' y='200' width='${CAB - 28}' height='38' rx='3' fill='#100e13' stroke='#b98a3a' stroke-opacity='0.55' stroke-width='1'/>
    <rect x='${cx - 14}' y='214' width='28' height='10' rx='2' fill='url(#t${i})' opacity='0.7'/>
    <rect x='2' y='${BASE - 10}' width='${CAB - 4}' height='10' rx='2' fill='#050406'/>
  </g>`
  }

  const stool = (i: number) => {
    const cx = AISLE / 2 + i * (CAB + GAP) + CAB / 2
    return `
  <g>
    <ellipse cx='${cx}' cy='${H - 7}' rx='34' ry='7' fill='url(#shadow)'/>
    <ellipse cx='${cx}' cy='${H - 9}' rx='24' ry='5' fill='url(#chrome)'/>
    <rect x='${cx - 3.5}' y='236' width='7' height='${H - 245}' fill='url(#chrome)'/>
    <ellipse cx='${cx}' cy='238' rx='33' ry='9' fill='#1c0508'/>
    <ellipse cx='${cx}' cy='233' rx='33' ry='10' fill='url(#seat)'/>
    <path d='M ${cx - 29} 232 L ${cx - 31} 184 Q ${cx - 31} 168 ${cx - 16} 168 L ${cx + 16} 168 Q ${cx + 31} 168 ${cx + 31} 184 L ${cx + 29} 232 Z' fill='url(#back)'/>
    <path d='M ${cx - 29} 232 L ${cx - 31} 184 Q ${cx - 31} 168 ${cx - 16} 168 L ${cx + 16} 168 Q ${cx + 31} 168 ${cx + 31} 184 L ${cx + 29} 232' fill='none' stroke='#d6ac5c' stroke-width='1.6'/>
    <path d='M ${cx - 10} 176 V 226 M ${cx + 10} 176 V 226' stroke='#2a060c' stroke-width='1.2' opacity='0.7'/>
    <path d='M ${cx - 22} 173 Q ${cx} 170 ${cx + 22} 173' fill='none' stroke='#fff' stroke-opacity='0.18' stroke-width='3' stroke-linecap='round'/>
  </g>`
  }

  return `
<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>
  <defs>
    <linearGradient id='body' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#0d0c11'/><stop offset='0.5' stop-color='#26232d'/><stop offset='1' stop-color='#0d0c11'/></linearGradient>
    <linearGradient id='chrome' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#55545c'/><stop offset='0.45' stop-color='#e6e5ec'/><stop offset='1' stop-color='#4a4950'/></linearGradient>
    <linearGradient id='reel' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#b9b3a6'/><stop offset='0.5' stop-color='#f6f1e4'/><stop offset='1' stop-color='#b9b3a6'/></linearGradient>
    <linearGradient id='back' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#8a1c30'/><stop offset='0.55' stop-color='#5c0f1e'/><stop offset='1' stop-color='#360812'/></linearGradient>
    <radialGradient id='seat' cx='0.5' cy='0.3' r='0.8'><stop offset='0' stop-color='#8a1c30'/><stop offset='1' stop-color='#3d0914'/></radialGradient>
    <radialGradient id='shadow'><stop offset='0' stop-color='#000' stop-opacity='0.6'/><stop offset='1' stop-color='#000' stop-opacity='0'/></radialGradient>
    <linearGradient id='contact' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#000' stop-opacity='0.55'/><stop offset='1' stop-color='#000' stop-opacity='0'/></linearGradient>
    ${defs}
  </defs>
  <rect x='${AISLE / 2 - 6}' y='${BASE}' width='${CAB * 4 + GAP * 3 + 12}' height='16' fill='url(#contact)'/>
  ${[0, 1, 2, 3].map(cabinet).join('')}
  ${[0, 1, 2, 3].map(stool).join('')}
</svg>`
}

/** A table's picture as a CSS image, with the proportions needed to stand it on the floor. */
export type TablePicture = Omit<TableArt, 'svg'> & { url: string }

const picture = ({ svg, ...rest }: TableArt): TablePicture => ({ url: svgUrl(svg), ...rest })

let cache: { carpet: string; wall: string; slots: string; blackjack: TablePicture; craps: TablePicture } | null = null

export function roomTextures() {
  cache ??= {
    carpet: svgUrl(carpetSvg()),
    wall: svgUrl(wallSvg()),
    slots: svgUrl(slotsSvg()),
    blackjack: picture(blackjackTable()),
    craps: picture(crapsTable()),
  }
  return cache
}
