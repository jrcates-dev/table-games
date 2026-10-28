import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { cancelHold, swallowClick } from '../lib/touch'

/**
 * A closer look at the felt, for a finger.
 *
 * On a phone the whole table is drawn at a third of its size: the layout is
 * there, but a roulette number is narrower than a fingertip and the printing
 * on the felt is a blur. Two fingers pinch it up to the size it was drawn at,
 * one finger drags it about, and a button closes in on the betting layout and
 * pulls back again. While the round plays out — cards dealt, dice in the air,
 * the ball running — the view pulls back to the whole table, and once betting
 * opens again it goes back to where the player had it.
 *
 * The zoom is one transform on a layer of its own inside the stage, set
 * directly rather than through React, so a pinch never re-renders the table.
 */

export interface StageZoom {
  /** What the zoom button closes in on: a selector for the parts of the picture to frame. */
  focus: string
  /** The round is playing out. The view pulls back to the whole table, and stays there. */
  playing: boolean
  /** Betting is open. A view the round took away comes back. */
  betting: boolean
}

/** Where the picture sits at zoom 1, and the room it has, in the stage's own pixels. */
export interface StageFrame {
  scale: number
  left: number
  top: number
  /** The stage's box. */
  w: number
  h: number
  /** The picture, in logical pixels: its width, and how far down the playable part runs. */
  width: number
  floor: number
  /** Screen pixels covered at the top (the top bar) and the bottom (the dock). */
  reserveTop: number
  reserve: number
}

/** A zoom, and how far the layer is moved under it, in the stage's own pixels. */
interface View {
  z: number
  x: number
  y: number
}

const WHOLE: View = { z: 1, x: 0, y: 0 }
/** How far a finger may move before a touch is a drag. */
const SLOP = 10
/** The button's step in. */
const STEP = 2
const EASE = 'transform 340ms cubic-bezier(0.2, 0.7, 0.2, 1)'

/** As far as the table was drawn — the felt at its design size — and never less than twice, nor more than four times. */
export function maxZoom(frame: StageFrame): number {
  return Math.min(4, Math.max(STEP, 1 / frame.scale))
}

/**
 * Keep the picture over the room it has: zoomed past the room, no gap opens at
 * an edge; smaller than it, nothing slides out of view. The playable part is
 * what counts going down, so the near rail can always be brought up over the
 * dock.
 */
function fit(view: View, frame: StageFrame): View {
  const z = Math.min(maxZoom(frame), Math.max(1, view.z))
  if (z < 1.001) return WHOLE
  const s = frame.scale
  const axis = (shift: number, base: number, extent: number, from: number, to: number) => {
    // Never tighter than the picture already is at zoom 1, so zooming out always lands back on it.
    const lo = Math.min(from, base)
    const hi = Math.max(to, base + s * extent)
    const size = s * z * extent
    const [min, max] = size >= hi - lo ? [hi - size, lo] : [lo, hi - size]
    const start = Math.min(max, Math.max(min, shift + z * base))
    return start - z * base
  }
  return {
    z,
    x: axis(view.x, frame.left, frame.width, 0, frame.w),
    y: axis(view.y, frame.top, frame.floor, frame.reserveTop, frame.h - frame.reserve),
  }
}

/** The stage on screen, for a control outside it. */
let active: { zoomAt: (x: number, y: number) => void; allowed: () => boolean } | null = null

/** Whether the table on screen can close in now. */
export function canZoom(): boolean {
  return active?.allowed() === true
}

/** Close in on a point on screen, if the table can. Returns whether it did. */
export function zoomInAt(clientX: number, clientY: number): boolean {
  if (!active?.allowed()) return false
  active.zoomAt(clientX, clientY)
  return true
}

/** The box around everything the selector matches, on screen. */
function focusBox(stage: HTMLElement, selector: string | undefined) {
  if (!selector) return null
  let box: { left: number; top: number; right: number; bottom: number } | null = null
  for (const el of stage.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    box = box
      ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) }
      : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
  }
  return box
}

export function useStageZoom(
  stageRef: RefObject<HTMLDivElement | null>,
  layerRef: RefObject<HTMLDivElement | null>,
  frame: StageFrame,
  options: StageZoom | undefined,
) {
  const [zoomed, setZoomed] = useState(false)
  const view = useRef<View>(WHOLE)
  /** Where the player had it when the round took the view away. */
  const saved = useRef<View | null>(null)
  const frameRef = useRef(frame)
  frameRef.current = frame
  const allowed = options ? !options.playing : false
  const betting = options?.betting ?? false
  const allowedRef = useRef(allowed)
  allowedRef.current = allowed

  const show = useCallback(
    (next: View, animate: boolean) => {
      const layer = layerRef.current
      view.current = next
      setZoomed(next.z > 1.001)
      if (!layer) return
      layer.style.transition = animate ? EASE : 'none'
      layer.style.transform = next.z > 1.001 ? `translate(${next.x}px, ${next.y}px) scale(${next.z})` : ''
    },
    [layerRef],
  )

  /** Close in on a point given in the stage's own pixels, putting it in the middle of the room. */
  const closeIn = useCallback(
    (sx: number, sy: number, z: number) => {
      saved.current = null
      const f = frameRef.current
      const v = view.current
      // The point on the layer under the finger, and the middle of the room it goes to.
      const qx = (sx - v.x) / v.z
      const qy = (sy - v.y) / v.z
      const cx = f.w / 2
      const cy = (f.reserveTop + f.h - f.reserve) / 2
      show(fit({ z, x: cx - z * qx, y: cy - z * qy }, f), true)
    },
    [show],
  )

  const toggle = useCallback(() => {
    const stage = stageRef.current
    if (!stage || !allowedRef.current) return
    saved.current = null
    if (view.current.z > 1.001) return show(WHOLE, true)
    const box = stage.getBoundingClientRect()
    const target = focusBox(stage, options?.focus)
    const sx = target ? (target.left + target.right) / 2 - box.left : box.width / 2
    const sy = target ? (target.top + target.bottom) / 2 - box.top : box.height / 2
    closeIn(sx, sy, Math.min(maxZoom(frameRef.current), STEP))
  }, [stageRef, options?.focus, show, closeIn])

  // The picture moved or resized under the zoom: keep it inside the room.
  useLayoutEffect(() => {
    if (view.current.z > 1.001) show(fit(view.current, frame), false)
  }, [frame, show])

  // The round takes the view away, and gives it back when betting opens again.
  const zooms = Boolean(options)
  useEffect(() => {
    if (!zooms) return
    if (!allowed && view.current.z > 1.001) {
      saved.current = view.current
      show(WHOLE, true)
    } else if (betting && saved.current) {
      show(fit(saved.current, frameRef.current), true)
      saved.current = null
    }
  }, [allowed, betting, zooms, show])

  // A control outside the stage (the bet picker) may ask it to close in.
  useEffect(() => {
    if (!zooms) return
    const entry = {
      allowed: () => allowedRef.current,
      zoomAt: (clientX: number, clientY: number) => {
        const stage = stageRef.current
        if (!stage) return
        const box = stage.getBoundingClientRect()
        const z = Math.min(maxZoom(frameRef.current), Math.max(STEP, view.current.z * 1.5))
        closeIn(clientX - box.left, clientY - box.top, z)
      },
    }
    active = entry
    return () => {
      if (active === entry) active = null
    }
  }, [zooms, stageRef, closeIn])

  // Pinch and drag. Fingers only: a mouse has the whole table at a size it can point at.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !zooms) return
    const fingers = new Map<number, { x: number; y: number }>()
    let pinch: { d0: number; z0: number; qx: number; qy: number } | null = null
    let drag: { x0: number; y0: number; from: View; moving: boolean } | null = null
    let box = stage.getBoundingClientRect()

    const local = (p: { x: number; y: number }) => ({ x: p.x - box.left, y: p.y - box.top })
    const pair = () => {
      const [a, b] = [...fingers.values()]
      return { mid: local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), d: Math.hypot(a.x - b.x, a.y - b.y) }
    }
    const startDrag = (p: { x: number; y: number }, moving: boolean) => {
      drag = { x0: p.x, y0: p.y, from: view.current, moving }
    }
    const settle = () => {
      if (layerRef.current) layerRef.current.style.willChange = ''
      if (view.current.z < 1.08) show(WHOLE, true)
      else setZoomed(true)
    }

    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !allowedRef.current) return
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      box = stage.getBoundingClientRect()
      if (fingers.size === 2) {
        // A second finger: a pinch, never a bet or a held card.
        cancelHold()
        swallowClick()
        saved.current = null
        for (const id of fingers.keys()) if (stage.hasPointerCapture?.(id) === false) stage.setPointerCapture(id)
        const { mid, d } = pair()
        const v = view.current
        // The point on the layer between the fingers stays between them.
        pinch = { d0: Math.max(d, 1), z0: v.z, qx: (mid.x - v.x) / v.z, qy: (mid.y - v.y) / v.z }
        drag = null
        if (layerRef.current) layerRef.current.style.willChange = 'transform'
      } else if (fingers.size === 1 && view.current.z > 1.001) {
        saved.current = null
        startDrag({ x: event.clientX, y: event.clientY }, false)
      }
    }

    const move = (event: PointerEvent) => {
      const finger = fingers.get(event.pointerId)
      if (!finger) return
      finger.x = event.clientX
      finger.y = event.clientY
      const f = frameRef.current
      if (pinch && fingers.size >= 2) {
        swallowClick()
        const { mid, d } = pair()
        const z = Math.min(maxZoom(f), Math.max(1, (pinch.z0 * d) / pinch.d0))
        show(fit({ z, x: mid.x - z * pinch.qx, y: mid.y - z * pinch.qy }, f), false)
        return
      }
      if (!drag) return
      const dx = event.clientX - drag.x0
      const dy = event.clientY - drag.y0
      if (!drag.moving) {
        if (Math.hypot(dx, dy) < SLOP) return
        drag.moving = true
        cancelHold()
        stage.setPointerCapture(event.pointerId)
        if (layerRef.current) layerRef.current.style.willChange = 'transform'
      }
      swallowClick()
      show(fit({ z: drag.from.z, x: drag.from.x + dx, y: drag.from.y + dy }, f), false)
    }

    const up = (event: PointerEvent) => {
      if (!fingers.delete(event.pointerId)) return
      if (pinch && fingers.size === 1) {
        // One finger left on the glass carries on as a drag.
        pinch = null
        const [rest] = [...fingers.values()]
        if (view.current.z > 1.001) startDrag(rest, true)
        return
      }
      if (fingers.size === 0) {
        const gestured = pinch || drag?.moving
        pinch = null
        drag = null
        if (gestured) settle()
      }
    }

    // Safari's own pinch, which would zoom the page, not the table.
    const gesture = (event: Event) => event.preventDefault()

    stage.addEventListener('pointerdown', down)
    stage.addEventListener('pointermove', move)
    stage.addEventListener('pointerup', up)
    stage.addEventListener('pointercancel', up)
    stage.addEventListener('gesturestart', gesture)
    return () => {
      stage.removeEventListener('pointerdown', down)
      stage.removeEventListener('pointermove', move)
      stage.removeEventListener('pointerup', up)
      stage.removeEventListener('pointercancel', up)
      stage.removeEventListener('gesturestart', gesture)
    }
  }, [stageRef, layerRef, zooms, show])

  return { zoomed, toggle }
}
