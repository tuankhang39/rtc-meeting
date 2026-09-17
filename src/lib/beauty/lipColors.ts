/** Bảng màu môi trending (đỏ / cam / hồng — soft blur edge) */

export type LipSwatch = {
  id: string
  label: string
  color: string
  hint?: string
}

export const TRENDING_LIP_COLORS: LipSwatch[] = [
  { id: 'do-cam', label: 'Đỏ cam', color: '#e04a32', hint: 'Orange red' },
  { id: 'do-ruby', label: 'Đỏ ruby', color: '#c41e3a', hint: 'Ruby red' },
  { id: 'do-hong', label: 'Đỏ hồng', color: '#e84568', hint: 'Pink red' },
  { id: 'do-cherry', label: 'Đỏ cherry', color: '#9a1a2e', hint: 'Cherry red' },
  { id: 'cam-nude', label: 'Cam nude', color: '#c9927a', hint: 'Nude orange' },
  { id: 'cam-gach', label: 'Cam gạch', color: '#c45a38', hint: 'Brick orange' },
  { id: 'cam-dao', label: 'Cam đào', color: '#e8a890', hint: 'Peach orange' },
  { id: 'cam-san-ho', label: 'Cam san hô', color: '#f07050', hint: 'Coral orange' },
  { id: 'hong-dat', label: 'Hồng đất', color: '#b87a7e', hint: 'Dusty pink' },
  { id: 'hong-berry', label: 'Hồng berry', color: '#d9406a', hint: 'Berry pink' },
  { id: 'hong-baby', label: 'Hồng baby', color: '#e85a9a', hint: 'Baby / fuchsia pink' },
  { id: 'hong-dau', label: 'Hồng dâu', color: '#e85a7a', hint: 'Strawberry pink' },
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
