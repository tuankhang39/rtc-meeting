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
  lipstickColor: '#c43b5c',
  blurBg: 0,
}

export function beautyActive(s: BeautySettings) {
  return s.smooth > 0 || s.whiten > 0 || s.lipstick > 0 || s.blurBg > 0
}

export function beautyNeedsAi(s: BeautySettings) {
  return s.lipstick > 0 || s.blurBg > 0
}
