/** Màu môi đang thịnh (2025–2026): rose, nude, nâu chocolate, cherry, berry */

export type LipSwatch = {
  id: string
  label: string
  color: string
  hint?: string
}

export const TRENDING_LIP_COLORS: LipSwatch[] = [
  { id: 'rose', label: 'Rose khói', color: '#c47a8a', hint: 'Smoky rose' },
  { id: 'nude', label: 'Nude đào', color: '#d4a08c', hint: 'Peachy nude' },
  { id: 'choc', label: 'Chocolate', color: '#8b5a4a', hint: 'Brown / taupe' },
  { id: 'cherry', label: 'Cherry', color: '#b83245', hint: 'Cherry / brick' },
  { id: 'berry', label: 'Berry', color: '#8e3a5b', hint: 'Wine / plum' },
  { id: 'coral', label: 'Coral', color: '#e07a6a', hint: 'Warm coral' },
]

export type LipOptions = {
  /** Hex màu môi */
  color: string
  /** 0–100 độ đậm */
  intensity: number
  /** Bóng môi dưới */
  gloss: boolean
}

export const DEFAULT_LIP: LipOptions = {
  color: TRENDING_LIP_COLORS[0]!.color,
  intensity: 45,
  gloss: true,
}

export function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const v = Number.parseInt(n, 16)
  if (Number.isNaN(v)) return { r: 196, g: 59, b: 85 }
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
}
