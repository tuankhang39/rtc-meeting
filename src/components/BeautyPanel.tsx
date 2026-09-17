import { FILTER_PRESETS, type FilterPresetId } from '../lib/beauty/presets'
import { TRENDING_LIP_COLORS, type LipOptions } from '../lib/beauty/lipColors'
import { BROW_STYLES, type BrowOptions } from '../lib/beauty/brows'
import type { SkinOptions } from '../lib/beauty/skin'

type Props = {
  presetId: FilterPresetId
  onSelect: (id: FilterPresetId) => void
  lip: LipOptions
  onLipChange: (patch: Partial<LipOptions>) => void
  skin: SkinOptions
  onSkinChange: (patch: Partial<SkinOptions>) => void
  brow: BrowOptions
  onBrowChange: (patch: Partial<BrowOptions>) => void
  onClose: () => void
}

export function BeautyPanel({
  presetId,
  onSelect,
  lip,
  onLipChange,
  skin,
  onSkinChange,
  brow,
  onBrowChange,
  onClose,
}: Props) {
  const showBeauty = presetId === 'natural'

  return (
    <div className="beauty-panel" role="dialog" aria-label="Làm đẹp camera">
      <div className="beauty-panel-head">
        <strong>Làm đẹp</strong>
        <button type="button" className="btn ghost beauty-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
      </div>

      <p className="beauty-hint muted">Chọn hiệu ứng. Với Tự nhiên có thể chỉnh da, chân mày và môi.</p>

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

      {showBeauty && (
        <>
          <div className="beauty-skin">
            <div className="beauty-lips-head">
              <strong>Da</strong>
              <span className="muted">Chỉ áp dụng trên khuôn mặt</span>
            </div>

            <label className="beauty-lip-row beauty-lip-slider">
              <span>Mịn</span>
              <input
                type="range"
                min={0}
                max={100}
                value={skin.smooth}
                onChange={(e) => onSkinChange({ smooth: Number(e.target.value) })}
                aria-valuetext={`${skin.smooth}%`}
              />
              <em>{skin.smooth}%</em>
            </label>

            <label className="beauty-lip-row beauty-lip-slider">
              <span>Sáng</span>
              <input
                type="range"
                min={0}
                max={100}
                value={skin.brighten}
                onChange={(e) => onSkinChange({ brighten: Number(e.target.value) })}
                aria-valuetext={`${skin.brighten}%`}
              />
              <em>{skin.brighten}%</em>
            </label>
          </div>

          <div className="beauty-brows">
            <div className="beauty-lips-head">
              <strong>Chân mày</strong>
              <span className="muted">Theo khuôn mặt · kéo đậm về 0 để tắt</span>
            </div>

            <div className="beauty-brow-styles" role="group" aria-label="Kiểu chân mày">
              {BROW_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`beauty-brow-style${brow.style === s.id ? ' active' : ''}`}
                  onClick={() => onBrowChange({ style: s.id })}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <label className="beauty-lip-row beauty-lip-slider">
              <span>Đậm</span>
              <input
                type="range"
                min={0}
                max={100}
                value={brow.intensity}
                onChange={(e) => onBrowChange({ intensity: Number(e.target.value) })}
                aria-valuetext={`${brow.intensity}%`}
              />
              <em>{brow.intensity}%</em>
            </label>

            <label className="beauty-lip-row beauty-lip-slider">
              <span>Dày</span>
              <input
                type="range"
                min={0}
                max={100}
                value={brow.thickness}
                onChange={(e) => onBrowChange({ thickness: Number(e.target.value) })}
                aria-valuetext={`${brow.thickness}%`}
              />
              <em>{brow.thickness}%</em>
            </label>
          </div>

          <div className="beauty-lips">
            <div className="beauty-lips-head">
              <strong>Son môi</strong>
              <span className="muted">Gợi ý đang thịnh</span>
            </div>

            <div className="beauty-lip-swatches" role="listbox" aria-label="Màu son gợi ý">
              {TRENDING_LIP_COLORS.map((s) => {
                const active = lip.color.toLowerCase() === s.color.toLowerCase()
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    title={s.label}
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
              <span>Tự chọn</span>
              <input
                type="color"
                value={lip.color.length === 7 ? lip.color : '#e04a32'}
                onChange={(e) => onLipChange({ color: e.target.value })}
                aria-label="Chọn màu son"
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
                aria-label="Mã màu son"
              />
            </label>

            <label className="beauty-lip-row beauty-lip-slider">
              <span>Độ đậm</span>
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
              <span>Bóng môi</span>
            </label>
          </div>
        </>
      )}
    </div>
  )
}
