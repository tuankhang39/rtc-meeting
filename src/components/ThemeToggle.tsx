import { useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, toggleTheme, type AppTheme } from '../lib/brand'

/** Theme lưu trong localStorage key `xiaoxin-theme` (`pink` | `dark`) */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<AppTheme>(() => getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'xiaoxin-theme') return
      const next = e.newValue === 'dark' ? 'dark' : 'pink'
      setTheme(next)
      applyTheme(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      title={theme === 'pink' ? 'Đổi sang Dark' : 'Đổi sang Pink'}
      aria-label={theme === 'pink' ? 'Đổi sang Dark' : 'Đổi sang Pink'}
      onClick={() => setTheme((t) => toggleTheme(t))}
    >
      <span aria-hidden>{theme === 'pink' ? '🌙' : '🌸'}</span>
      <span>{theme === 'pink' ? 'Dark' : 'Pink'}</span>
    </button>
  )
}
