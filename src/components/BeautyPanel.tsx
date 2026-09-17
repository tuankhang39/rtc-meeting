import type { BeautySettings } from '../lib/beauty/types'

type Props = {
  settings: BeautySettings
  status: 'idle' | 'loading' | 'running' | 'error'
  error: string | null
  onChange: (patch: Partial<BeautySettings>) => void
  onReset: () => void
  onClose: () => void
}

function Row({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  disabled?: boolean
}) {
  return (
    <label className="beauty-row">
      <span className="beauty-row-label">
        {label}
        <em>{value}</em>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function BeautyPanel({ settings, status, error, onChange, onReset, onClose }: Props) {
  return (
    <div className="beauty-panel" role="dialog" aria-label="Làm đẹp camera">
      <div className="beauty-panel-head">
        <strong>Làm đẹp cam</strong>
        <button type="button" className="btn ghost beauty-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
      </div>

      <p className="beauty-hint muted">
        Chỉ chạy trên máy bạn. Son / mờ nền lần đầu sẽ tải model AI (~vài MB).
      </p>

      {status === 'loading' && <p className="beauty-status">Đang tải model…</p>}
      {status === 'error' && error && <p className="beauty-status beauty-error">{error}</p>}

      <Row label="Mịn da" value={settings.smooth} onChange={(smooth) => onChange({ smooth })} />
      <Row label="Trắng da" value={settings.whiten} onChange={(whiten) => onChange({ whiten })} />
      <Row label="Son môi" value={settings.lipstick} onChange={(lipstick) => onChange({ lipstick })} />

      <label className="beauty-row beauty-color-row">
        <span className="beauty-row-label">Màu son</span>
        <input
          type="color"
          value={settings.lipstickColor}
          disabled={settings.lipstick === 0}
          onChange={(e) => onChange({ lipstickColor: e.target.value })}
        />
      </label>

      <Row label="Mờ nền" value={settings.blurBg} onChange={(blurBg) => onChange({ blurBg })} />

      <div className="beauty-actions">
        <button type="button" className="btn ghost" onClick={onReset}>
          Tắt hết
        </button>
      </div>
    </div>
  )
}
