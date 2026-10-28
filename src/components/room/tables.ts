/**
 * The tables on the casino floor, drawn as SVG from simple 3D models.
 *
 * Each table is built in centimetres — a padded rail lofted round its outline,
 * an apron, a plinth, chairs pulled up to it — then projected through a camera
 * standing where the viewer does and shaded by the light of the chandelier
 * overhead. The result is a single picture per table, generated once and
 * handed to CSS like the room's other textures, so the floor stays as cheap
 * as a painted backdrop while the tables keep real perspective.
 */

type V3 = readonly [number, number, number]
type RGB = readonly [number, number, number]

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (a: V3): V3 => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1))
const rad = (deg: number) => (deg * Math.PI) / 180

function rgbOf(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const hexOf = (c: RGB) =>
  `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`

interface Material {
  /** Light that reaches every face. */
  ambient: number
  diffuse: number
  specular: number
  shine: number
}

const MATTE: Material = { ambient: 0.32, diffuse: 0.78, specular: 0.04, shine: 8 }
const LEATHER: Material = { ambient: 0.3, diffuse: 0.7, specular: 0.3, shine: 16 }
const LACQUER: Material = { ambient: 0.3, diffuse: 0.7, specular: 0.45, shine: 40 }
/** Under the overhang of a table top, out of the chandelier's light. */
const SHADOWED: Material = { ambient: 0.22, diffuse: 0.3, specular: 0.05, shine: 10 }
const CHROME: Material = { ambient: 0.35, diffuse: 0.45, specular: 0.9, shine: 30 }

/** The chandelier: high, a little to the left and toward the viewer. */
const LIGHT = unit([-0.3, 1, -0.42])

/**
 * A camera aimed at `target` from `distance` away, swung `azimuth` degrees
 * round to the right and raised `elevation` degrees, and the canvas it draws
 * onto. Points are x right, y up, z away from the viewer.
 */
class Scene {
  readonly eye: V3
  private readonly fwd: V3
  private readonly right: V3
  private readonly up: V3
  private readonly parts: string[] = []
  private minX = Infinity
  private minY = Infinity
  private maxX = -Infinity
  private maxY = -Infinity

  constructor(target: V3, azimuth: number, elevation: number, distance: number) {
    const a = rad(azimuth)
    const e = rad(elevation)
    this.eye = add(target, [Math.sin(a) * Math.cos(e) * distance, Math.sin(e) * distance, -Math.cos(a) * Math.cos(e) * distance])
    this.fwd = unit(sub(target, this.eye))
    this.right = unit([this.fwd[2], 0, -this.fwd[0]])
    this.up = [
      this.fwd[1] * this.right[2] - this.fwd[2] * this.right[1],
      this.fwd[2] * this.right[0] - this.fwd[0] * this.right[2],
      this.fwd[0] * this.right[1] - this.fwd[1] * this.right[0],
    ]
  }

  /** Screen position, in units of a centimetre at the target. */
  at(p: V3): [number, number] {
    const d = sub(p, this.eye)
    const z = dot(d, this.fwd)
    const k = this.distanceToTarget / z
    return [dot(d, this.right) * k, -dot(d, this.up) * k]
  }

  get distanceToTarget(): number {
    return 1000
  }

  depth(p: V3): number {
    return dot(sub(p, this.eye), this.fwd)
  }

  /** Whether a face with outward normal `n` at `p` faces the camera. */
  sees(p: V3, n: V3): boolean {
    return dot(n, sub(this.eye, p)) > 0
  }

  shade(colour: string | RGB, n: V3, p: V3, m: Material): string {
    const c = typeof colour === 'string' ? rgbOf(colour) : colour
    const diffuse = Math.max(0, dot(n, LIGHT))
    const view = unit(sub(this.eye, p))
    const half = unit(add(LIGHT, view))
    const spec = m.specular * Math.pow(Math.max(0, dot(n, half)), m.shine) * 255
    const k = m.ambient + m.diffuse * diffuse
    return hexOf([c[0] * k + spec, c[1] * k + spec, c[2] * k + spec])
  }

  private track(x: number, y: number) {
    if (x < this.minX) this.minX = x
    if (x > this.maxX) this.maxX = x
    if (y < this.minY) this.minY = y
    if (y > this.maxY) this.maxY = y
  }

  path(points: V3[], close = true): string {
    return (
      points
        .map((p, i) => {
          const [x, y] = this.at(p)
          this.track(x, y)
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
        })
        .join('') + (close ? 'Z' : '')
    )
  }

  /** A filled polygon. The fill is stroked too, which hides seams between neighbouring faces. */
  poly(points: V3[], fill: string, extra = '') {
    this.parts.push(`<path d='${this.path(points)}' fill='${fill}' stroke='${fill}' stroke-width='0.6' stroke-linejoin='round'${extra}/>`)
  }

  line(points: V3[], stroke: string, width: number, extra = '') {
    this.parts.push(`<path d='${this.path(points, false)}' fill='none' stroke='${stroke}' stroke-width='${width}' stroke-linecap='round' stroke-linejoin='round'${extra}/>`)
  }

  raw(svg: string) {
    this.parts.push(svg)
  }

  /** Text lying on a horizontal surface, `u` along its baseline and `v` toward its top. */
  text(origin: V3, u: V3, v: V3, size: number, content: string, attrs: string) {
    const [x0, y0] = this.at(origin)
    const [x1, y1] = this.at(add(origin, mul(u, size)))
    const [x2, y2] = this.at(add(origin, mul(v, -size)))
    const m = [(x1 - x0) / size, (y1 - y0) / size, (x2 - x0) / size, (y2 - y0) / size, x0, y0].map((n) => n.toFixed(3))
    this.parts.push(`<text transform='matrix(${m.join(' ')})' font-size='${size}' text-anchor='middle' ${attrs}>${content}</text>`)
  }

  /** The finished picture, with where `anchor` landed in it. */
  render(anchor: V3, defs: string, margin = 6): TableArt {
    const x0 = this.minX - margin
    const y0 = this.minY - margin
    const w = this.maxX - this.minX + margin * 2
    const h = this.maxY - this.minY + margin * 2
    const [ax, ay] = this.at(anchor)
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}'><defs>${defs}</defs>${this.parts.join('')}</svg>`
    return { svg, width: w, height: h, anchorX: (ax - x0) / w, anchorY: (ay - y0) / h }
  }
}

export interface TableArt {
  svg: string
  width: number
  height: number
  /** Where the middle of the table's footprint falls, as fractions of the picture. */
  anchorX: number
  anchorY: number
}

/** A point on an outline and the horizontal direction pointing out of the solid there. */
interface Edge {
  p: V3
  out: V3
}

const offset = (e: Edge, by: number, y: number): V3 => [e.p[0] + e.out[0] * by, y, e.p[2] + e.out[2] * by]

/**
 * Sweep a cross-section along an outline. The profile is a list of
 * [outward offset, height] pairs running up the outside and over the top, so
 * the solid always lies to the left of the direction of travel.
 */
function loft(scene: Scene, edges: Edge[], profile: [number, number][], colour: string, m: Material, closed = false) {
  const faces: { pts: V3[]; fill: string; depth: number }[] = []
  const count = closed ? edges.length : edges.length - 1
  for (let i = 0; i < count; i++) {
    const a = edges[i]
    const b = edges[(i + 1) % edges.length]
    const out = unit(add(a.out, b.out))
    for (let j = 0; j < profile.length - 1; j++) {
      const [o0, y0] = profile[j]
      const [o1, y1] = profile[j + 1]
      const n = unit(add(mul(out, y1 - y0), [0, -(o1 - o0), 0]))
      const pts = [offset(a, o0, y0), offset(b, o0, y0), offset(b, o1, y1), offset(a, o1, y1)]
      const mid = mul(pts.reduce(add), 0.25)
      if (!scene.sees(mid, n)) continue
      faces.push({ pts, fill: scene.shade(colour, n, mid, m), depth: scene.depth(mid) })
    }
  }
  faces.sort((p, q) => q.depth - p.depth)
  for (const f of faces) scene.poly(f.pts, f.fill)
}

/** An upright cylinder: its visible side, then its top. */
function cylinder(scene: Scene, c: V3, r: number, h: number, colour: string, m: Material, top?: string) {
  const n = 28
  const ring = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { p: [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r] as V3, out: [Math.cos(a), 0, Math.sin(a)] as V3 }
  })
  loft(scene, ring.map((e) => ({ p: [c[0], 0, c[2]] as V3, out: e.out })), [
    [r, c[1]],
    [r, c[1] + h],
  ], colour, m, true)
  scene.poly(
    ring.map((e) => [e.p[0], c[1] + h, e.p[2]] as V3),
    top ?? scene.shade(colour, [0, 1, 0], add(c, [0, h, 0]), m),
  )
}

/** A flat outline on a horizontal surface. */
function ellipse(c: V3, rx: number, rz: number, n = 24): V3[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [c[0] + Math.cos(a) * rx, c[1], c[2] + Math.sin(a) * rz] as V3
  })
}

/** A rectangle lying flat, centred on `c`, turned `turn` degrees about the vertical. */
function flatRect(c: V3, w: number, d: number, turn = 0): V3[] {
  const a = rad(turn)
  const u: V3 = [Math.cos(a), 0, Math.sin(a)]
  const v: V3 = [-Math.sin(a), 0, Math.cos(a)]
  return [
    add(c, add(mul(u, -w / 2), mul(v, -d / 2))),
    add(c, add(mul(u, w / 2), mul(v, -d / 2))),
    add(c, add(mul(u, w / 2), mul(v, d / 2))),
    add(c, add(mul(u, -w / 2), mul(v, d / 2))),
  ]
}

/** A box, turned `turn` degrees about the vertical: its visible sides, then its top. */
function box(scene: Scene, c: V3, w: number, d: number, h: number, turn: number, colour: string, m: Material) {
  const base = flatRect(c, w, d, turn)
  const lid = base.map((p) => add(p, [0, h, 0]))
  const sides = base.map((p, i) => {
    const q = base[(i + 1) % 4]
    const mid = mul(add(add(p, q), [0, h, 0]), 0.5)
    const n = unit(sub([mid[0], c[1], mid[2]], c))
    return { pts: [p, q, lid[(i + 1) % 4], lid[i]], n, mid }
  })
  sides
    .filter((s) => scene.sees(s.mid, s.n))
    .forEach((s) => scene.poly(s.pts, scene.shade(colour, s.n, s.mid, m)))
  scene.poly(lid, scene.shade(colour, [0, 1, 0], add(c, [0, h, 0]), m))
  return lid
}

/** A stack of `count` chips of one colour, lying on a surface at `c`. */
function chips(scene: Scene, c: V3, colours: string[]) {
  colours.forEach((colour, i) => {
    cylinder(scene, add(c, [0, i * 0.36, 0]), 2, 0.36, colour, LACQUER)
    const top = add(c, [0, (i + 1) * 0.36 + 0.01, 0])
    scene.poly(ellipse(top, 1.3, 1.3, 14), '#efe6d0', ` opacity='0.7'`)
  })
}

const CHIP_COLOURS = ['#c4262e', '#1b7d4a', '#18171d', '#5d2b8c', '#e3a72a']

/** A playing card lying on the felt. */
function card(scene: Scene, c: V3, turn: number, faceUp: boolean) {
  const outline = flatRect(c, 6.3, 8.8, turn)
  scene.poly(outline, faceUp ? '#f4efe3' : '#8c1d2a')
  if (faceUp) {
    scene.poly(flatRect(add(c, [0, 0.01, 0]), 1.6, 2, turn), Math.abs(turn) % 2 > 1 ? '#b3202a' : '#1a1a1f')
  } else {
    scene.poly(flatRect(add(c, [0, 0.01, 0]), 5.1, 7.6, turn), '#a83242')
  }
}

/** A swivel chair facing `facing` (a horizontal unit vector), the kind pulled up to every table game. */
function chair(scene: Scene, c: V3, facing: V3, seat = 58) {
  const side: V3 = [facing[2], 0, -facing[0]]
  // Pedestal, column and seat.
  cylinder(scene, c, 19, 2, '#17151a', CHROME)
  cylinder(scene, add(c, [0, 2, 0]), 2.4, seat - 10, '#9a9ca6', CHROME)

  const backParts = () => {
    // A curved, tufted back, raked a few degrees and set at the back of the seat.
    const rows = [seat + 4, seat + 14, seat + 24, seat + 32]
    const cols = 9
    const point = (u: number, y: number, depth: number): V3 => {
      const curl = u * u * 7
      const rake = (y - seat) * 0.16
      return add(c, add(mul(side, u * 22), add([0, y, 0], mul(facing, -17 + curl - rake + depth))))
    }
    const faces: { pts: V3[]; n: V3; mid: V3 }[] = []
    for (let i = 0; i < cols; i++) {
      const u0 = -1 + (2 * i) / cols
      const u1 = -1 + (2 * (i + 1)) / cols
      for (let j = 0; j < rows.length - 1; j++) {
        // Front, back, and the rolled top.
        const front = [point(u0, rows[j], 0), point(u1, rows[j], 0), point(u1, rows[j + 1], 0), point(u0, rows[j + 1], 0)]
        const back = [point(u1, rows[j], -6), point(u0, rows[j], -6), point(u0, rows[j + 1], -6), point(u1, rows[j + 1], -6)]
        const lean = unit(add(facing, [0, 0.16, 0]))
        const across = unit(add(side, mul(facing, -((u0 + u1) / 2) * 0.3)))
        const nFront = unit(add(lean, mul(across, -((u0 + u1) / 2) * 0.25)))
        faces.push({ pts: front, n: nFront, mid: mul(front.reduce(add), 0.25) })
        faces.push({ pts: back, n: mul(nFront, -1), mid: mul(back.reduce(add), 0.25) })
      }
      const crown = [point(u0, rows[rows.length - 1], 0), point(u1, rows[rows.length - 1], 0), point(u1, rows[rows.length - 1] + 1.5, -3), point(u0, rows[rows.length - 1] + 1.5, -3)]
      const crownBack = [point(u0, rows[rows.length - 1], -6), point(u1, rows[rows.length - 1], -6), point(u1, rows[rows.length - 1] + 1.5, -3), point(u0, rows[rows.length - 1] + 1.5, -3)]
      faces.push({ pts: crown, n: unit(add([0, 1, 0], mul(facing, 0.6))), mid: mul(crown.reduce(add), 0.25) })
      faces.push({ pts: crownBack, n: unit(add([0, 1, 0], mul(facing, -0.6))), mid: mul(crownBack.reduce(add), 0.25) })
    }
    faces
      .filter((f) => scene.sees(f.mid, f.n))
      .sort((p, q) => scene.depth(q.mid) - scene.depth(p.mid))
      .forEach((f) => scene.poly(f.pts, scene.shade('#7a1626', f.n, f.mid, LEATHER)))
    // Gold piping round the face of the back, when the face is the side we see.
    const faceMid = point(0, rows[1], 0)
    if (scene.sees(faceMid, facing)) {
      const edge: V3[] = []
      for (let i = 0; i <= cols; i++) edge.push(point(-1 + (2 * i) / cols, rows[rows.length - 1] + 0.6, -0.4))
      scene.line(edge, '#d6ac5c', 0.9)
      for (let k = -1; k <= 1; k++) {
        scene.poly(ellipse(add(point(k * 0.5, rows[1] + 4, 0.2), [0, 0, 0]), 0.9, 0.9, 8), '#3a0810', ` opacity='0.6'`)
      }
    }
  }

  const seatParts = () => {
    cylinder(scene, add(c, [0, seat - 8, 0]), 21, 8, '#7a1626', LEATHER, scene.shade('#8c1f30', [0, 1, 0], add(c, [0, seat, 0]), LEATHER))
    scene.line(
      Array.from({ length: 29 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2
        return add(c, [Math.cos(a) * 21, seat, Math.sin(a) * 21])
      }),
      '#d6ac5c',
      0.7,
      ` opacity='0.8'`,
    )
  }

  // Whichever of seat and back is farther from the camera goes down first.
  const backCentre = add(c, add([0, seat + 20, 0], mul(facing, -17)))
  if (scene.depth(backCentre) > scene.depth(add(c, [0, seat, 0]))) {
    backParts()
    seatParts()
  } else {
    seatParts()
    backParts()
  }
}

/** A soft shadow on the floor under a footprint. */
function floorShadow(scene: Scene, outline: V3[], id: string) {
  scene.raw(`<path d='${scene.path(outline)}' fill='#000' opacity='0.7' filter='url(#${id})'/>`)
}

/* ---- Blackjack ---------------------------------------------------------- */

/**
 * A seven-spot blackjack table, the dealer's side toward the viewer: chip tray,
 * shoe and discard rack at the near edge, the betting spots round the far
 * curve, a hand or two already out and the chairs waiting.
 */
export function blackjackTable(): TableArt {
  const R = 96
  const RZ = 86
  const FELT_Y = 78
  const scene = new Scene([0, 50, 40], 22, 24, 520)

  const arcEdge = (t: number): Edge => {
    const a = rad(t)
    return { p: [Math.cos(a) * R, 0, Math.sin(a) * RZ], out: unit([Math.cos(a) / R, 0, Math.sin(a) / RZ]) }
  }
  const arc = Array.from({ length: 49 }, (_, i) => arcEdge((i / 48) * 180))
  const straight: Edge[] = [
    { p: [-R, 0, 0], out: [0, 0, -1] },
    { p: [R, 0, 0], out: [0, 0, -1] },
  ]

  floorShadow(scene, [...arc.map((e) => offset(e, 30, 0)), [-R - 30, 0, -26], [R + 30, 0, -26]], 'bj-shadow')

  const seats = [15, 45, 75, 105, 135, 165].map((t) => {
    const e = arcEdge(t)
    return { pos: offset(e, 27, 0), facing: mul(e.out, -1) }
  })
  const behind = seats.filter((s) => dot(s.facing, sub(scene.eye, s.pos)) > 0)
  const before = seats.filter((s) => !behind.includes(s))
  behind.sort((p, q) => scene.depth(q.pos) - scene.depth(p.pos)).forEach((s) => chair(scene, s.pos, s.facing))

  // Plinth, apron and the walnut dealer's edge.
  // The plinth sits well back under the top, in its shadow.
  const plinth = Array.from({ length: 25 }, (_, i) => {
    const a = rad((i / 24) * 180)
    const p: V3 = [Math.cos(a) * (R - 40), 0, 18 + Math.sin(a) * (RZ - 40)]
    return { p, out: unit([Math.cos(a) / (R - 40), 0, Math.sin(a) / (RZ - 40)]) } as Edge
  })
  const plinthFront: Edge[] = [
    { p: [-(R - 40), 0, 18], out: [0, 0, -1] },
    { p: [R - 40, 0, 18], out: [0, 0, -1] },
  ]
  for (const edges of [plinth, plinthFront]) {
    loft(scene, edges, [[0, 0], [0, 6]], '#8a6526', LACQUER)
    loft(scene, edges, [[-0.5, 6], [-0.5, 64]], '#2a170d', SHADOWED)
  }
  loft(scene, arc, [[0, 64], [0, 72]], '#4a2a15', LACQUER)
  loft(scene, straight, [[0, 64], [0, FELT_Y + 0.8], [-5, FELT_Y + 0.8]], '#5a3519', LACQUER)
  scene.line([offset(straight[0], 0.1, FELT_Y + 0.8), offset(straight[1], 0.1, FELT_Y + 0.8)], '#d9b46a', 0.8)

  // The felt.
  const feltEdge = arc.map((e) => offset(e, -12, FELT_Y))
  const felt: V3[] = [...feltEdge, [-R + 12, FELT_Y, 5], [R - 12, FELT_Y, 5]]
  scene.poly(felt, '#17603f')
  scene.raw(`<path d='${scene.path(felt)}' fill='url(#bj-lamp)'/>`)

  // Printing: two gold arcs and the seven betting spots.
  const printArc = (k: number) =>
    Array.from({ length: 33 }, (_, i) => {
      const a = rad(24 + (i / 32) * 132)
      return [Math.cos(a) * (R - 12) * k, FELT_Y + 0.05, Math.sin(a) * (RZ - 12) * k] as V3
    })
  scene.line(printArc(0.6), '#d9b46a', 0.7, ` opacity='0.75'`)
  scene.line(printArc(0.68), '#d9b46a', 0.7, ` opacity='0.75'`)
  const spot = (i: number): V3 => {
    const a = rad(22.5 + i * 22.5)
    return [Math.cos(a) * (R - 12) * 0.83, FELT_Y + 0.05, Math.sin(a) * (RZ - 12) * 0.83]
  }
  for (let i = 0; i < 7; i++) scene.line([...ellipse(spot(i), 6, 6, 20), ellipse(spot(i), 6, 6, 20)[0]], '#e8cf95', 0.8, ` opacity='0.85'`)

  // Chip tray and the cards out on the felt.
  box(scene, [0, FELT_Y - 1.4, 11], 62, 13, 1.6, 0, '#0c0b10', LACQUER)
  const trayColours = ['#7a5846', '#e3a72a', '#5d2b8c', '#18171d', '#18171d', '#1b7d4a', '#1b7d4a', '#1b7d4a', '#c4262e', '#c4262e']
  trayColours.forEach((colour, i) => {
    const x = -27 + i * 6
    scene.poly(flatRect([x, FELT_Y + 0.3, 11], 5, 11), scene.shade(colour, [0, 1, 0], [x, FELT_Y, 11], LACQUER))
    scene.line([[x - 0.6, FELT_Y + 0.35, 6], [x - 0.6, FELT_Y + 0.35, 16]], '#fff', 0.7, ` opacity='0.35'`)
    scene.line([[x - 2.4, FELT_Y + 0.35, 6], [x - 2.4, FELT_Y + 0.35, 16]], '#000', 0.7, ` opacity='0.5'`)
  })

  card(scene, [-5, FELT_Y + 0.1, 27], -4, true)
  card(scene, [3, FELT_Y + 0.1, 27.5], 6, false)
  ;[1, 3, 5].forEach((i, n) => {
    const s = spot(i)
    const toward = unit([-s[0], 0, -s[2]])
    const at = add(s, mul(toward, 13))
    card(scene, add(at, [-2, 0.08, 0]), 8 * (n - 1) - 6, true)
    card(scene, add(at, [2.2, 0.12, -1]), 8 * (n - 1) + 6, true)
  })
  ;[1, 3, 4, 5].forEach((i, n) => {
    const count = [3, 2, 5, 1][n]
    chips(scene, add(spot(i), [0, 0.05, 0]), Array.from({ length: count }, (_, k) => CHIP_COLOURS[(i + k * 2) % 3]))
  })

  // The shoe and the discard rack.
  box(scene, [-64, FELT_Y, 16], 17, 32, 10, -18, '#1a1a20', LACQUER)
  scene.poly(flatRect([-64, FELT_Y + 10.05, 16], 13, 26, -18), '#8c1d2a', ` opacity='0.75'`)
  box(scene, [64, FELT_Y, 14], 12, 16, 8, 14, '#2a262e', LACQUER)
  scene.poly(flatRect([64, FELT_Y + 8.05, 14], 9, 12, 14), '#8c1d2a', ` opacity='0.8'`)

  // The padded rail round the players' side.
  const rail: [number, number][] = [
    [0, 72],
    [0, 76],
    [-1.2, 80],
    [-3.5, 82.8],
    [-6.5, 84],
    [-9.5, 83.2],
    [-11.5, 81],
    [-12.2, FELT_Y],
  ]
  loft(scene, arc, rail, '#2a1a16', LEATHER)
  for (const t of [0, 180]) {
    const e = arcEdge(t)
    scene.poly(
      rail.map(([o, y]) => offset(e, o, y)),
      scene.shade('#2a1a16', [0, 0, -1], e.p, LEATHER),
    )
  }
  scene.line(arc.map((e) => offset(e, -6.5, 84.1)), '#c9a26a', 0.5, ` opacity='0.35' stroke-dasharray='1.2 1.4'`)

  // The limit sign on its post at the dealer's right.
  const post: V3 = [R - 8, FELT_Y, 4]
  cylinder(scene, post, 0.9, 16, '#9a9ca6', CHROME)
  const sign = flatRect(add(post, [0, 0, 0]), 16, 0, -12).slice(0, 2)
  const signFace: V3[] = [add(sign[0], [0, 16, 0]), add(sign[1], [0, 16, 0]), add(sign[1], [0, 26, 0]), add(sign[0], [0, 26, 0])]
  scene.poly(signFace, '#0b0a0e')
  scene.line([...signFace, signFace[0]], '#d9b46a', 0.5, ` opacity='0.8'`)
  const [sx, sy] = scene.at(add(post, [0, 21, 0]))
  scene.raw(`<text x='${sx.toFixed(1)}' y='${(sy + 2.4).toFixed(1)}' font-family='Consolas, monospace' font-size='7.5' font-weight='700' fill='#ff4a3d' text-anchor='middle' filter='url(#bj-led)'>$25</text>`)

  before.sort((p, q) => scene.depth(q.pos) - scene.depth(p.pos)).forEach((s) => chair(scene, s.pos, s.facing))

  const defs = `
    <filter id='bj-shadow' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='9'/></filter>
    <filter id='bj-led' x='-50%' y='-80%' width='200%' height='260%'><feGaussianBlur stdDeviation='0.8' result='b'/><feMerge><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge></filter>
    <radialGradient id='bj-lamp' cx='0.5' cy='0.55' r='0.6'>
      <stop offset='0' stop-color='#fff2d0' stop-opacity='0.24'/>
      <stop offset='0.6' stop-color='#fff2d0' stop-opacity='0.06'/>
      <stop offset='1' stop-color='#000' stop-opacity='0.25'/>
    </radialGradient>`
  return scene.render([0, 0, 40], defs)
}

/* ---- Craps ---------------------------------------------------------------- */

/** A rounded rectangle as an outline, corners sampled, starting at the near-right corner and running anticlockwise from above. */
function roundedRect(halfL: number, halfW: number, r: number, steps = 14): Edge[] {
  const corners: [number, number, number][] = [
    [halfL - r, -halfW + r, -90],
    [halfL - r, halfW - r, 0],
    [-halfL + r, halfW - r, 90],
    [-halfL + r, -halfW + r, 180],
  ]
  const out: Edge[] = []
  for (const [cx, cz, start] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = rad(start + (i / steps) * 90)
      out.push({ p: [cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r], out: [Math.cos(a), 0, Math.sin(a)] })
    }
  }
  return out
}

/**
 * A twelve-foot craps table seen from near one end, as it stands on the right
 * of the room running back toward the slots: the tub with its padded rail and
 * chip groove, pyramid rubber on the end walls, the layout printed on the
 * felt, the bank set into the boxman's rail, the dice out and a few bets
 * working. Seen from the same height as the blackjack table across the room.
 */
export function crapsTable(): TableArt {
  const HL = 170
  const HW = 76
  const CORNER = 46
  const FELT_Y = 76
  const scene = new Scene([0, 58, 0], -80, 24, 720)
  const outline = roundedRect(HL, HW, CORNER, 20)
  const inner = 23

  floorShadow(scene, outline.map((e) => offset(e, 10, 0)), 'cr-shadow')

  // Plinth, well back in the shadow under the tub.
  const plinth = roundedRect(HL - 38, HW - 34, 14, 4)
  loft(scene, plinth, [[0, 0], [0, 6]], '#8a6526', LACQUER, true)
  loft(scene, plinth, [[-0.5, 6], [-0.5, 62]], '#2a170d', SHADOWED, true)

  // The felt and its layout.
  const fx = HL - inner
  const fz = HW - inner
  const felt = outline.map((e) => offset(e, -inner, FELT_Y))
  scene.poly(felt, '#17603f')
  scene.raw(`<path d='${scene.path(felt)}' fill='url(#cr-lamp)'/>`)

  const y = FELT_Y + 0.05
  const P = (x: number, z: number): V3 => [x, y, z]
  const rect = (x0: number, z0: number, x1: number, z1: number) => [P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1), P(x0, z0)]
  const ink = '#f1e8d2'
  const lineW = 0.9
  const X: V3 = [1, 0, 0]
  const Z: V3 = [0, 0, 1]
  const serif = `font-family='Georgia, Times New Roman, serif' font-weight='700'`

  for (const side of [-1, 1]) {
    const sx = (x: number) => x * side
    const inner0 = 34
    // Pass line round the outside, the don't pass bar inside it.
    scene.line([P(sx(inner0), -fz + 10), P(sx(fx - 10), -fz + 10), P(sx(fx - 10), fz - 6)], ink, lineW)
    scene.line([P(sx(inner0), -fz + 19), P(sx(fx - 19), -fz + 19), P(sx(fx - 19), fz - 30)], ink, lineW)
    // Field and come.
    scene.line([P(sx(inner0), -fz + 36), P(sx(fx - 19), -fz + 36)], ink, lineW)
    scene.line([P(sx(inner0), 6), P(sx(fx - 19), 6)], ink, lineW)
    // The place numbers along the back wall, the don't come bar beside them.
    const boxes = 6
    const bx0 = inner0 + 14
    const bw = (fx - 19 - bx0) / boxes
    scene.line(rect(sx(inner0), 6, sx(fx - 19), fz - 4), ink, lineW)
    for (let i = 0; i <= boxes; i++) scene.line([P(sx(bx0 + i * bw), 6), P(sx(bx0 + i * bw), fz - 4)], ink, lineW)
    const numbers = side < 0 ? ['10', 'NINE', '8', 'SIX', '5', '4'] : ['4', '5', 'SIX', '8', 'NINE', '10']
    numbers.forEach((label, i) => {
      const at = side < 0 ? fx - 19 - (i + 0.5) * bw : bx0 + (i + 0.5) * bw
      const x = side < 0 ? -at : at
      scene.text(P(x, 18), X, Z, label.length > 2 ? 6 : 11, label, `${serif} fill='#f3d27a'`)
    })
    // The words.
    const mid = sx((inner0 + fx - 19) / 2)
    scene.text(P(mid, -14), X, Z, 15, 'COME', `${serif} fill='#d8433a' letter-spacing='3'`)
    scene.text(P(mid, -fz + 24.5), X, Z, 6, 'FIELD  2 · 3 · 4 · 9 · 10 · 11 · 12', `${serif} fill='#f3d27a'`)
    scene.text(P(mid, -fz + 12.5), X, Z, 5.5, 'DON&#8217;T PASS BAR', `${serif} fill='${ink}' letter-spacing='1'`)
    scene.text(P(mid, -fz + 1.8), X, Z, 7, 'PASS LINE', `${serif} fill='${ink}' letter-spacing='4'`)
  }
  // The proposition box in the middle.
  scene.line(rect(-28, -fz + 4, 28, fz - 4), '#d9b46a', 1.1)
  scene.line([P(-28, fz - 18), P(28, fz - 18)], '#d9b46a', 0.8)
  scene.line([P(-28, -fz + 18), P(28, -fz + 18)], '#d9b46a', 0.8)
  scene.line([P(0, fz - 18), P(0, -fz + 18)], '#d9b46a', 0.8)
  scene.line([P(-28, 0), P(28, 0)], '#d9b46a', 0.8)
  scene.text(P(0, fz - 15), X, Z, 7, 'SEVEN', `${serif} fill='#d8433a' letter-spacing='2'`)
  scene.text(P(0, -fz + 7.5), X, Z, 5.5, 'ANY CRAPS', `${serif} fill='#d8433a' letter-spacing='1'`)
  for (const [x, z] of [[-14, 17], [14, 17], [-14, -17], [14, -17]]) {
    scene.poly(flatRect(P(x - 3, z), 4, 4), '#c4262e')
    scene.poly(flatRect(P(x + 3, z), 4, 4), '#c4262e')
  }

  // The tub's inner walls: pyramid rubber at the ends, padding along the sides.
  const wall = outline.map((e) => ({ p: offset(e, -inner, 0), out: mul(e.out, -1) }) as Edge)
  const wallFaces: { pts: V3[]; fill: string; end: boolean; depth: number }[] = []
  for (let i = 0; i < wall.length; i++) {
    const a = wall[i]
    const b = wall[(i + 1) % wall.length]
    const n = unit(add(a.out, b.out))
    const pts: V3[] = [[a.p[0], FELT_Y, a.p[2]], [b.p[0], FELT_Y, b.p[2]], [b.p[0], 96, b.p[2]], [a.p[0], 96, a.p[2]]]
    const mid = mul(pts.reduce(add), 0.25)
    if (!scene.sees(mid, n)) continue
    wallFaces.push({ pts, fill: scene.shade('#2a2630', n, mid, MATTE), end: Math.abs(mid[0]) > fx - CORNER + inner - 1, depth: scene.depth(mid) })
  }
  wallFaces.sort((p, q) => q.depth - p.depth)
  for (const f of wallFaces) {
    scene.poly(f.pts, f.fill)
    if (f.end) scene.raw(`<path d='${scene.path(f.pts)}' fill='url(#cr-pyramids)' opacity='0.85'/>`)
  }

  // Bets working, the puck on the six and the dice just landed.
  const stacks: [number, number, number][] = [
    [-110, -fz + 4.5, 3],
    [-70, -fz + 4.5, 2],
    [96, -fz + 4.5, 4],
    [-62, 14, 3],
    [-82, 26, 2],
    [74, 14, 3],
    [-100, -fz + 28, 1],
  ]
  stacks.forEach(([x, z, n], k) => chips(scene, P(x, z), Array.from({ length: n }, (_, i) => CHIP_COLOURS[(k + i) % 4])))
  cylinder(scene, P(-bx(fx) , 34), 3.6, 1.2, '#f4efe3', LACQUER)
  function bx(fxv: number) {
    return 34 + 14 + ((fxv - 19 - 48) / 6) * 2.5
  }
  const [px, py] = scene.at(P(-bx(fx), 34))
  scene.raw(`<text x='${px.toFixed(1)}' y='${(py + 1.6).toFixed(1)}' font-family='Arial, sans-serif' font-size='3.6' font-weight='700' fill='#111' text-anchor='middle'>ON</text>`)
  box(scene, P(112, -6), 1.9, 1.9, 1.9, 20, '#c4111d', LACQUER)
  box(scene, P(118, 2), 1.9, 1.9, 1.9, -15, '#c4111d', LACQUER)

  // The padded rail with its chip groove, and the walnut apron below it.
  loft(scene, outline, [[0, 62], [0, 70]], '#4a2a15', LACQUER, true)
  loft(scene, outline, [
    [0, 70],
    [0.5, 88],
    [-0.5, 95],
    [-3, 98.6],
    [-7, 100],
    [-10, 99.4],
    [-11, 97],
    [-17, 97],
    [-18, 99.2],
    [-20.5, 99.6],
    [-22.5, 98],
    [-inner, 96],
  ], '#24161a', LEATHER, true)
  // The brass bead along the top of the apron, on the faces turned this way.
  let bead: V3[] = []
  for (const e of [...outline, outline[0]]) {
    const p = offset(e, 0.6, 70)
    if (scene.sees(p, e.out)) bead.push(p)
    else {
      if (bead.length > 1) scene.line(bead, '#d9b46a', 0.7, ` opacity='0.7'`)
      bead = []
    }
  }
  if (bead.length > 1) scene.line(bead, '#d9b46a', 0.7, ` opacity='0.7'`)

  // Players' chips in the groove along their rail.
  for (const [x, colour, len] of [[-120, '#c4262e', 9], [-60, '#1b7d4a', 7], [10, '#18171d', 6], [70, '#c4262e', 10], [130, '#5d2b8c', 5]] as [number, string, number][]) {
    const z = -HW + 14
    scene.poly(flatRect([x, 98.2, z], len, 4.6), scene.shade(colour, [0, 1, 0], [x, 98, z], LACQUER))
    scene.line([[x - len / 2, 98.4, z - 0.8], [x + len / 2, 98.4, z - 0.8]], '#fff', 0.6, ` opacity='0.35'`)
  }

  // The bank, set into the rail in front of the boxman.
  box(scene, [0, 96, HW - 12], 74, 12, 4.4, 0, '#0c0b10', LACQUER)
  ;['#7a5846', '#e3a72a', '#5d2b8c', '#18171d', '#18171d', '#1b7d4a', '#1b7d4a', '#c4262e', '#c4262e', '#ece5d3'].forEach((colour, i) => {
    const x = -32 + i * 7.1
    scene.poly(flatRect([x, 100.5, HW - 12], 5.6, 10), scene.shade(colour, [0, 1, 0], [x, 100, HW - 12], LACQUER))
  })

  const defs = `
    <filter id='cr-shadow' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='9'/></filter>
    <pattern id='cr-pyramids' width='3' height='3' patternUnits='userSpaceOnUse'>
      <path d='M1.5 0 L3 1.5 L1.5 1.5 Z' fill='#55505e'/><path d='M0 1.5 L1.5 0 L1.5 1.5 Z' fill='#34303b'/>
      <path d='M0 1.5 L1.5 1.5 L1.5 3 Z' fill='#1c1a21'/><path d='M1.5 1.5 L3 1.5 L1.5 3 Z' fill='#0b0a0e'/>
    </pattern>
    <radialGradient id='cr-lamp' cx='0.5' cy='0.5' r='0.6'>
      <stop offset='0' stop-color='#fff2d0' stop-opacity='0.22'/>
      <stop offset='0.6' stop-color='#fff2d0' stop-opacity='0.05'/>
      <stop offset='1' stop-color='#000' stop-opacity='0.25'/>
    </radialGradient>`
  return scene.render([0, 0, 0], defs)
}
