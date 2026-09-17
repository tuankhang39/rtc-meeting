/** Chân mày — detect cùng Face Landmarker */

export type BrowStyle = 'natural' | 'soft' | 'defined'

export type BrowOptions = {
  /** 0–100 độ đậm (0 = tắt) */
  intensity: number
  /** 0–100 độ dày */
  thickness: number
  /** Kiểu chân mày */
  style: BrowStyle
}

export const BROW_STYLES: Array<{ id: BrowStyle; label: string }> = [
  { id: 'natural', label: 'Tự nhiên' },
  { id: 'soft', label: 'Mềm' },
  { id: 'defined', label: 'Sắc' },
]

export const DEFAULT_BROW: BrowOptions = {
  intensity: 40,
  thickness: 45,
  style: 'natural',
}
