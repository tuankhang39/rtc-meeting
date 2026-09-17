import { FILTER_PRESETS, type FilterPresetId } from '../lib/beauty/presets'
import { TRENDING_LIP_COLORS, type LipOptions } from '../lib/beauty/lipColors'

type Props = {
  presetId: FilterPresetId
  onSelect: (id: FilterPresetId) => void
  lip: LipOptions
  onLipChange: (patch: Partial<LipOptions>) => void
  onClose: () => void
}

export function BeautyPanel({ presetId, onSelect, lip, onLipChange, onClose }: Props) {
  const showLips = presetId === 'natural'

  return (
    <div className="beauty-panel" role="dialog" aria-label="Filter camera">
      <div className="beauty-panel-head">
        <strong>Filter cam</strong>
        <button type="button" className="btn ghost beauty-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
      </div>

      <p className="beauty-hint muted">
        Tự nhiên: mịn da nhẹ + môi theo Face Landmarker. Chọn màu trending hoặc custom.
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

      {showLips && (
        <div className="beauty-lips">
          <div className="beauty-lips-head">
            <strong>Màu môi trending</strong>
            <span className="muted">Rose · Nude · Choc · Cherry · Berry · Coral</span>
          </div>

          <div className="beauty-lip-swatches" role="listbox" aria-label="Màu môi gợi ý">
            {TRENDING_LIP_COLORS.map((s) => {
              const active = lip.color.toLowerCase() === s.color.toLowerCase()
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  title={`${s.label}${s.hint ? ` — ${s.hint}` : ''}`}
                  className={`beauty-lip-swatch${active ? ' active' : ''}`}
                  style={{ background: s.color }}
                  onClick={() => onLipChange({ color: s.color })}
                >
                  <span className="sr-only">{s.label}</span>
                </button>
              )
            })}
          </div>

          <label className="beauty-lip-row">
            <span>Custom</span>
            <input
              type="color"
              value={lip.color.length === 7 ? lip.color : '#c47a8a'}
              onChange={(e) => onLipChange({ color: e.target.value })}
              aria-label="Chọn màu môi tùy chỉnh"
            />
            <input
              type="text"
              className="beauty-lip-hex"
              value={lip.color}
              maxLength={7}
              spellCheck={false}
              onChange={(e) => {
                let v = e.target.value.trim()
                if (!v.startsWith('#')) v = `#${v}`
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onLipChange({ color: v })
              }}
              aria-label="Mã hex màu môi"
            />
          </label>

          <label className="beauty-lip-row beauty-lip-slider">
            <span>Đậm nhạt</span>
            <input
              type="range"
              min={0}
              max={100}
              value={lip.intensity}
              onChange={(e) => onLipChange({ intensity: Number(e.target.value) })}
              aria-valuetext={`${lip.intensity}%`}
            />
            <em>{lip.intensity}%</em>
          </label>

          <label className="beauty-lip-row beauty-lip-check">
            <input
              type="checkbox"
              checked={lip.gloss}
              onChange={(e) => onLipChange({ gloss: e.target.checked })}
            />
            <span>Bóng môi dưới (gloss)</span>
          </label>
        </div>
      )}
    </div>
  )
}
