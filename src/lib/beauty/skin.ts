/** Mịn da + sáng da cho preset Tự nhiên */

export type SkinOptions = {
  /** 0–100 độ mịn (chỉ vùng da) */
  smooth: number
  /** 0–100 độ sáng */
  brighten: number
}

export const DEFAULT_SKIN: SkinOptions = {
  smooth: 55,
  brighten: 40,
}
