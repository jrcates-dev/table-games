/**
 * Which way each face of a die points, and how to turn one face into another.
 *
 * Opposite faces sum to seven, as on every real die. The rotation that carries
 * one face's normal onto another is always one of the cube's own symmetries —
 * a quarter or half turn about an axis — so re-labelling a die with it changes
 * which number is where without changing the shape that is tumbling.
 */

export type V3 = [number, number, number]
export type Q4 = [number, number, number, number] // x, y, z, w

export const FACE_NORMAL: Record<number, V3> = {
  1: [0, 1, 0],
  6: [0, -1, 0],
  2: [1, 0, 0],
  5: [-1, 0, 0],
  3: [0, 0, 1],
  4: [0, 0, -1],
}

export function rotate(q: Q4, v: V3): V3 {
  const [qx, qy, qz, qw] = q
  const [vx, vy, vz] = v
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * vz - qz * vy)
  const ty = 2 * (qz * vx - qx * vz)
  const tz = 2 * (qx * vy - qy * vx)
  return [vx + qw * tx + (qy * tz - qz * ty), vy + qw * ty + (qz * tx - qx * tz), vz + qw * tz + (qx * ty - qy * tx)]
}

export function multiply(a: Q4, b: Q4): Q4 {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

export function axisAngle(axis: V3, angle: number): Q4 {
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1
  const s = Math.sin(angle / 2) / len
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)]
}

/** The face pointing most nearly straight up for a body in orientation `q`. */
export function faceUp(q: Q4): number {
  let best = 1
  let bestY = -Infinity
  for (const face of [1, 2, 3, 4, 5, 6]) {
    const y = rotate(q, FACE_NORMAL[face])[1]
    if (y > bestY) {
      bestY = y
      best = face
    }
  }
  return best
}

/**
 * The local rotation that puts face `want` where face `got` is.
 *
 * Applied to the drawn die only — the simulated body keeps its orientation —
 * so at rest the face that was simulated pointing up now carries the number
 * the engine rolled.
 */
export function relabel(want: number, got: number): Q4 {
  if (want === got) return [0, 0, 0, 1]
  const a = FACE_NORMAL[want]
  const b = FACE_NORMAL[got]
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  if (dot < -0.5) {
    // Opposite faces: a half turn about any axis perpendicular to both.
    const axis: V3 = Math.abs(a[1]) > 0.5 ? [1, 0, 0] : [0, 1, 0]
    return axisAngle(axis, Math.PI)
  }
  const axis: V3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  return axisAngle(axis, Math.PI / 2)
}
