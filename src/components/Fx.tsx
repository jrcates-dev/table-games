import { useEffect, useRef } from 'react'
import { registerEmitter, type Particle } from './celebrate'

/**
 * The canvas every celebration is drawn on: one full-screen layer above
 * everything, idle until something fires and asleep again the moment the last
 * particle fades — no animation loop runs while nobody is winning.
 */
export function FxLayer() {
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
        p.life++
        const drag = p.kind === 'confetti' ? 0.965 : 0.975
        p.vx *= drag
        p.vy = p.vy * drag + (p.kind === 'sparks' ? 0.08 : 0.26)
        p.x += p.vx
        p.y += p.vy
        p.angle += p.spin
        const t = p.life / p.max
        ctx.globalAlpha = Math.max(0, t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3)
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
