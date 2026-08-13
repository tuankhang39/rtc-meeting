import { useCallback, useEffect, useState } from 'react'

export type ToastItem = {
  id: string
  message: string
  tone?: 'info' | 'ok' | 'warn'
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((message: string, tone: ToastItem['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev.slice(-4), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
    return id
  }, [])

  return { toasts, push, dismiss }
}

type ToastStackProps = {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), 20)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className={`toast toast-${item.tone ?? 'info'} ${show ? 'show' : ''}`} role="status">
      <span className="toast-msg">{item.message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Đóng">
        ×
      </button>
    </div>
  )
}
