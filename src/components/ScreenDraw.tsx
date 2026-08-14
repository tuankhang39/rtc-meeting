import { useEffect, useRef } from 'react'
import type { DrawPoint, DrawStroke } from '../lib/draw'

type OverlayProps = {
  strokes: DrawStroke[]
  board?: boolean
}

function paintMarks(
  ctx: CanvasRenderingContext2D,
  strokes: DrawStroke[],
  w: number,
  h: number,
  board?: boolean,
) {
  if (board) {
    const x = (10 / 100) * w
    const y = (16 / 100) * h
    const bw = (80 / 100) * w
    const bh = (68 / 100) * h
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.18)'
    ctx.lineWidth = 2
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, bw, bh, 18)
    else ctx.rect(x, y, bw, bh)
    ctx.fill()
    ctx.stroke()
  }
  const drawOne = (pts: DrawPoint[], strokeColor: string, width: number) => {
    if (pts.length === 0) return
    ctx.strokeStyle = strokeColor
    ctx.fillStyle = strokeColor
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo((pts[0]!.x / 100) * w, (pts[0]!.y / 100) * h)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo((pts[i]!.x / 100) * w, (pts[i]!.y / 100) * h)
    }
    if (pts.length === 1) {
      ctx.arc((pts[0]!.x / 100) * w, (pts[0]!.y / 100) * h, width / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.stroke()
    }
  }

  const drawText = (s: DrawStroke) => {
    const label = s.text?.trim()
    if (!label) return
    const size = ((s.size || 4) / 100) * h
    ctx.fillStyle = s.color
    ctx.font = `700 ${Math.max(14, size)}px "Segoe UI", system-ui, sans-serif`
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillText(label, ((s.x ?? 0) / 100) * w, ((s.y ?? 0) / 100) * h)
  }

  for (const s of strokes) {
    if (s.kind === 'text') drawText(s)
    else drawOne(s.points, s.color, s.width)
  }
}

export function ScreenDrawOverlay({ strokes, board = false }: OverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef(strokes)
  const boardRef = useRef(board)
  strokesRef.current = strokes
  boardRef.current = board

  useEffect(() => {
    const paint = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const parent = canvas.parentElement
      if (!parent) return
      const w = parent.clientWidth
      const h = parent.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      paintMarks(ctx, strokesRef.current, w, h, boardRef.current)
    }

    paint()
    const parent = canvasRef.current?.parentElement
    if (!parent || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', paint)
      return () => window.removeEventListener('resize', paint)
    }
    const ro = new ResizeObserver(() => paint())
    ro.observe(parent)
    return () => ro.disconnect()
  }, [strokes, board])

  return <canvas ref={canvasRef} className="draw-overlay" style={{ pointerEvents: 'none' }} />
}
