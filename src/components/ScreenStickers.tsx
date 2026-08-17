import { type MouseEvent } from 'react'
import type { ScreenSticker, StickerPackId } from '../lib/stickers'
import { STICKER_PACKS } from '../lib/stickers'

type OverlayProps = {
  stickers: ScreenSticker[]
  selectedEmoji: string | null
  selectedPack: StickerPackId | null
  myUserId: string
  canClear: boolean
  onPlace: (emoji: string, pack: StickerPackId, x: number, y: number) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export function ScreenStickerOverlay({
  stickers,
  selectedEmoji,
  selectedPack,
  myUserId,
  canClear,
  onPlace,
  onRemove,
  onClear,
}: OverlayProps) {
  const placing = Boolean(selectedEmoji && selectedPack)

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!selectedEmoji || !selectedPack) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onPlace(selectedEmoji, selectedPack, x, y)
  }

  return (
    <div
      className={`sticker-overlay ${placing ? 'placing' : ''}`}
      onClick={handleClick}
      title={placing ? 'Click để dán sticker' : undefined}
    >
      {stickers.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`screen-sticker ${s.userId === myUserId ? 'mine' : ''}`}
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
          title={`${s.name} · click để gỡ (nếu là của bạn)`}
          onClick={(e) => {
            e.stopPropagation()
            if (s.userId === myUserId || canClear) onRemove(s.id)
          }}
        >
          <span>{s.emoji}</span>
        </button>
      ))}

      {canClear && stickers.length > 0 && (
        <button
          type="button"
          className="sticker-clear-btn"
          onClick={(e) => {
            e.stopPropagation()
            onClear()
          }}
        >
          Xóa hết
        </button>
      )}

      {placing && <div className="sticker-hint">Click lên màn share để dán {selectedEmoji}</div>}
    </div>
  )
}

type PickerProps = {
  packId: StickerPackId
  selectedEmoji: string | null
  onPackChange: (id: StickerPackId) => void
  onSelect: (emoji: string | null) => void
  canClear?: boolean
  stickerCount?: number
  onClear?: () => void
}

export function StickerPackPicker({
  packId,
  selectedEmoji,
  onPackChange,
  onSelect,
  canClear = false,
  stickerCount = 0,
  onClear,
}: PickerProps) {
  const pack = STICKER_PACKS.find((p) => p.id === packId) ?? STICKER_PACKS[0]!

  return (
    <div className="sticker-picker">
      {canClear && (
        <button
          type="button"
          className="sticker-clear-quick"
          disabled={stickerCount === 0}
          onClick={() => onClear?.()}
          title="Xóa hết sticker trên màn hình"
        >
          🧹 Xóa hết {stickerCount > 0 ? `(${stickerCount})` : ''}
        </button>
      )}
      <div className="sticker-pack-tabs">
        {STICKER_PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`sticker-tab ${p.id === packId ? 'active' : ''}`}
            onClick={() => onPackChange(p.id)}
          >
            {p.label}
          </button>
        ))}
        {selectedEmoji && (
          <button type="button" className="sticker-tab cancel" onClick={() => onSelect(null)}>
            Hủy
          </button>
        )}
      </div>
      <div className="sticker-pack-grid">
        {pack.stickers.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={`sticker-pick ${selectedEmoji === emoji ? 'selected' : ''}`}
            onClick={() => onSelect(selectedEmoji === emoji ? null : emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
