export type AppTheme = 'pink' | 'dark'

const THEME_KEY = 'xiaoxin-theme'

export function getStoredTheme(): AppTheme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'dark' || v === 'pink') return v
  } catch {
    // ignore
  }
  return 'pink'
}

export function applyTheme(theme: AppTheme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
}

export function toggleTheme(current: AppTheme): AppTheme {
  const next: AppTheme = current === 'pink' ? 'dark' : 'pink'
  applyTheme(next)
  return next
}

export const BRAND_NAME = 'Cuộc hợp của Xiao xin Laoshi'
export const BRAND_SHORT = 'Xiao xin Laoshi'
export const BRAND_TAGLINE = 'Học không giới hạn, làm bạn Tiếng Trung'
export const BRAND_DESC =
  'Họp video 2–3 người. Ai cũng vào được bằng Room ID — tạo phòng cần đăng nhập host → Học không giới hạn, làm bạn Tiếng Trung'
