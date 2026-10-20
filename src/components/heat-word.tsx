import { useEffect, useRef } from 'react'

const WORD = '#needthat'
const FONT =
  '800 52px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'

export function HeatWord() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    context.font = FONT
    const width = Math.ceil(context.measureText(WORD).width) + 8
    const height = 64
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * ratio)
    canvas.height = Math.floor(height * ratio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const heat = { x: width / 2, y: height / 2, active: false }

    const paint = () => {
      const ink =
        getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() ||
        '#1c1c1a'
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      context.font = FONT
      context.textBaseline = 'middle'
      context.lineWidth = 2.5
      context.lineJoin = 'round'
      context.strokeStyle = ink
      context.fillStyle = ink
      context.strokeText(WORD, 4, height / 2 + 1)
      context.fillText(WORD, 4, height / 2 + 1)
      if (reduce || !heat.active) return
      context.globalCompositeOperation = 'source-atop'
      const gradient = context.createRadialGradient(heat.x, heat.y, 0, heat.x, heat.y, 64)
      gradient.addColorStop(0, '#fff7e8')
      gradient.addColorStop(0.42, '#ff6a00')
      gradient.addColorStop(1, 'rgba(255, 80, 0, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
      context.globalCompositeOperation = 'source-over'
    }

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      heat.x = event.clientX - rect.left
      heat.y = event.clientY - rect.top
      heat.active = true
      paint()
    }
    const onLeave = () => {
      heat.active = false
      paint()
    }

    paint()
    const themeObserver = new MutationObserver(paint)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    return () => {
      themeObserver.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <span className="heat">
      <canvas ref={canvasRef} className="heat-canvas" aria-hidden="true" />
      <span className="sr-only">{WORD}</span>
    </span>
  )
}
