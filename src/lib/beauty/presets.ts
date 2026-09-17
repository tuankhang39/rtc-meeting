export type FilterPresetId =
  | 'none'
  | 'natural'
  | 'soft'
  | 'warm'
  | 'cool'
  | 'bright'
  | 'vivid'
  | 'vintage'
  | 'bw'

export type FilterPreset = {
  id: FilterPresetId
  label: string
  /** CSS filter string for canvas 2D — rất nhẹ */
  css: string
  /** Preset đặc biệt: mịn + sáng nhẹ + nâng vùng đỏ (môi) */
  mode?: 'beauty'
}

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'none', label: 'Gốc', css: 'none' },
  {
    id: 'natural',
    label: 'Tự nhiên',
    css: 'brightness(1.05) contrast(0.97) saturate(1.04)',
    mode: 'beauty',
  },
  { id: 'soft', label: 'Mềm', css: 'brightness(1.06) contrast(0.94) saturate(0.92)' },
  { id: 'warm', label: 'Ấm', css: 'brightness(1.05) sepia(0.22) saturate(1.15)' },
  { id: 'cool', label: 'Mát', css: 'brightness(1.04) hue-rotate(12deg) saturate(1.05)' },
  { id: 'bright', label: 'Sáng', css: 'brightness(1.18) contrast(1.05) saturate(1.08)' },
  { id: 'vivid', label: 'Rực', css: 'brightness(1.06) contrast(1.12) saturate(1.45)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.35) contrast(0.95) brightness(1.05)' },
  { id: 'bw', label: 'Đen trắng', css: 'grayscale(1) contrast(1.08)' },
]

export function getFilterPreset(id: FilterPresetId): FilterPreset {
  return FILTER_PRESETS.find((p) => p.id === id) ?? FILTER_PRESETS[0]!
}

export function filterActive(id: FilterPresetId) {
  return id !== 'none'
}
