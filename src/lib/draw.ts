export type DrawPoint = { x: number; y: number }

export type DrawStroke = {
  id: string
  kind?: 'stroke' | 'text'
  points: DrawPoint[]
  text?: string
  x?: number
  y?: number
  size?: number
  color: string
  width: number
  userId: string
  name: string
  createdAt: number
}

export type DrawTool = 'draw' | 'erase' | null

export const DRAW_COLORS = ['#e85a8a', '#2563eb', '#16a34a', '#f59e0b', '#111827', '#ffffff'] as const

export function clampPct(n: number) {
  return Math.min(99.8, Math.max(0.2, n))
}

export function dist(a: DrawPoint, b: DrawPoint) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

export function simplifyPoints(points: DrawPoint[], minGap = 0.9): DrawPoint[] {
  if (points.length < 3) return points
  const out: DrawPoint[] = [points[0]!]
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!
    if (dist(out[out.length - 1]!, p) >= minGap) out.push(p)
  }
  out.push(points[points.length - 1]!)
  return out.slice(0, 80)
}

export function hitStroke(stroke: DrawStroke, p: DrawPoint, threshold = 2.4) {
  const pts = stroke.points
  if (pts.length === 1) return dist(pts[0]!, p) <= threshold
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const abx = b.x - a.x
    const aby = b.y - a.y
    const apx = p.x - a.x
    const apy = p.y - a.y
    const ab2 = abx * abx + aby * aby
    const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))
    const cx = a.x + abx * t
    const cy = a.y + aby * t
    if (Math.hypot(p.x - cx, p.y - cy) <= threshold) return true
  }
  return false
}
