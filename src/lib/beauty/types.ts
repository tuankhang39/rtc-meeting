export type BeautySettings = {
  /** 0–100 mịn da */
  smooth: number
  /** 0–100 làm trắng / sáng da */
  whiten: number
  /** 0–100 độ đậm son */
  lipstick: number
  /** màu son hex */
  lipstickColor: string
  /** 0–100 mờ nền */
  blurBg: number
}

export const DEFAULT_BEAUTY: BeautySettings = {
  smooth: 0,
  whiten: 0,
  lipstick: 0,
  lipstickColor: '#b94a5a',
  blurBg: 0,
}

export function beautyActive(s: BeautySettings) {
  return s.smooth > 0 || s.whiten > 0 || s.lipstick > 0 || s.blurBg > 0
}

export function beautyNeedsAi(s: BeautySettings) {
  // Son/mịn/trắng → OpenMakeup (FaceMesh); mờ nền → Segmo
  return s.lipstick > 0 || s.blurBg > 0 || s.smooth > 0 || s.whiten > 0
}
