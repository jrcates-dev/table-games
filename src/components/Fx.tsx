import { useEffect, useRef } from 'react'
import { useEffectsLevel } from '../lib/effects'
import { advance, fade, flightPath, registerEmitter, type FxKind, type Particle } from './celebrate'

/**
 * Where every celebration is drawn: one full-screen layer above everything.
 *
 * With full effects it is a canvas, idle until something fires and asleep
 * again the moment the last particle fades — no animation loop runs while
 * nobody is winning. A full-screen canvas redrawn every frame is a lot for a
 * phone to hand over, though, all of it again at every frame, just as the
 * banner and the chips are moving too. With lighter effects a burst is a
 * handful of small pieces instead, each flight worked out the moment it is
 * fired and handed to the browser to run, so nothing is drawn by script at all.
 */
export function FxLayer() {
  return useEffectsLevel() === 'reduced' ? <LightFx /> : <CanvasFx />
}

function CanvasFx() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let particles: Particle[] = []
    let frame = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    const step = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles = particles.filter((p) => p.life < p.max)
      for (const p of particles) {
        advance(p)
        ctx.globalAlpha = fade(p)
        if (p.kind === 'sparks') {
          ctx.globalCompositeOperation = 'lighter'
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4)
          g.addColorStop(0, p.color)
          g.addColorStop(1, 'rgba(255,220,150,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2)
          ctx.fill()
        } else if (p.kind === 'coins') {
          ctx.globalCompositeOperation = 'source-over'
          const squash = Math.abs(Math.cos(p.angle * 3))
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.ellipse(p.x, p.y, p.size, p.size * (0.25 + 0.75 * squash), p.angle, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'rgba(120, 80, 20, 0.6)'
          ctx.lineWidth = 1
          ctx.stroke()
        } else {
          ctx.globalCompositeOperation = 'source-over'
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.angle)
          ctx.scale(1, Math.cos(p.life * 0.25 + p.angle))
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
          ctx.restore()
        }
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      frame = particles.length > 0 ? requestAnimationFrame(step) : 0
    }

    registerEmitter((added) => {
      particles.push(...added)
      if (!frame) frame = requestAnimationFrame(step)
    })

    return () => {
      registerEmitter(null)
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="fx-layer" aria-hidden="true" />
}

/** The most pieces a lighter burst throws, whatever was asked for. */
const LIGHT_PIECES: Record<FxKind, number> = { sparks: 14, confetti: 24, coins: 20 }

/** Moments along each flight the browser is given; it runs straight between them. */
const SAMPLES = 16

/** A frame of the canvas's flight, in milliseconds. */
const FRAME_MS = 1000 / 60

function LightFx() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = ref.current
    if (!layer) return
    registerEmitter((added) => {
      const kind = added[0]?.kind
      if (!kind) return
      for (const p of added.slice(0, LIGHT_PIECES[kind])) fly(layer, p)
    })
    return () => {
      registerEmitter(null)
      layer.replaceChildren()
    }
  }, [])

  return <div ref={ref} className="fx-layer fx-layer--light" aria-hidden="true" />
}

/** One piece, launched on its way: moved and faded by the compositor alone, and gone when it lands. */
function fly(layer: HTMLElement, p: Particle) {
  const piece = document.createElement('span')
  piece.className = `fx-piece fx-piece--${p.kind}`
  // The same sizes the canvas draws: a spark's glow, a coin's face, a strip of confetti.
  const width = p.kind === 'sparks' ? p.size * 8 : p.kind === 'coins' ? p.size * 2 : p.size
  const height = p.kind === 'confetti' ? width / 2 : width
  piece.style.width = `${width}px`
  piece.style.height = `${height}px`
  piece.style.setProperty('--fx-color', p.color)
  layer.append(piece)
  // A coin turns about its own width as it tumbles.
  const squash = (angle: number) => (p.kind === 'coins' ? 0.25 + 0.75 * Math.abs(Math.cos(angle * 3)) : 1)
  const keyframes = flightPath(p, SAMPLES).map((at) => ({
    transform: `translate(${at.x - width / 2}px, ${at.y - height / 2}px) rotate(${at.angle}rad) scaleY(${squash(at.angle)})`,
    opacity: at.alpha,
  }))
  const flight = piece.animate(keyframes, { duration: p.max * FRAME_MS, easing: 'linear', fill: 'forwards' })
  flight.onfinish = flight.oncancel = () => piece.remove()
}
