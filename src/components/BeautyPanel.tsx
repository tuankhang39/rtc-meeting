import { FILTER_PRESETS, type FilterPresetId } from '../lib/beauty/presets'

type Props = {
  presetId: FilterPresetId
  onSelect: (id: FilterPresetId) => void
  onClose: () => void
}

export function BeautyPanel({ presetId, onSelect, onClose }: Props) {
  return (
    <div className="beauty-panel" role="dialog" aria-label="Filter camera">
      <div className="beauty-panel-head">
        <strong>Filter cam</strong>
        <button type="button" className="btn ghost beauty-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
      </div>

      <p className="beauty-hint muted">
        Tự nhiên: mịn da nhẹ + môi theo Face Landmarker (lần đầu tải model nhỏ).
      </p>

      <div className="beauty-presets">
        {FILTER_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`beauty-preset-btn${presetId === p.id ? ' active' : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <span className={`beauty-preset-swatch beauty-swatch-${p.id}`} aria-hidden />
            <span>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
