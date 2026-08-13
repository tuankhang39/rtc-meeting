/** Sticker trang trí góc màn hình — không chặn click */
export function CuteStickers() {
  return (
    <div className="cute-stickers" aria-hidden="true">
      <div className="sticker sticker-tl">
        <svg viewBox="0 0 80 80" width="64" height="64">
          <circle cx="40" cy="40" r="36" fill="#f3e4ea" stroke="#d4a8ba" strokeWidth="2" />
          <path
            d="M40 58 C28 46 18 38 18 28 C18 22 22 18 28 18 C32 18 36 20 40 24 C44 20 48 18 52 18 C58 18 62 22 62 28 C62 38 52 46 40 58Z"
            fill="#c07a96"
          />
          <circle cx="28" cy="26" r="3" fill="#fff" opacity="0.55" />
        </svg>
      </div>

      <div className="sticker sticker-tr">
        <svg viewBox="0 0 80 80" width="60" height="60">
          <circle cx="40" cy="40" r="36" fill="#f6eef2" stroke="#d4b0c0" strokeWidth="2" />
          <text x="40" y="48" textAnchor="middle" fontSize="28">
            🐰
          </text>
        </svg>
      </div>

      <div className="sticker sticker-bl">
        <svg viewBox="0 0 80 80" width="56" height="56">
          <circle cx="40" cy="40" r="36" fill="#f1e6eb" stroke="#d0a8ba" strokeWidth="2" />
          <text x="40" y="48" textAnchor="middle" fontSize="26">
            🌸
          </text>
        </svg>
      </div>

      <div className="sticker sticker-br">
        <svg viewBox="0 0 80 80" width="58" height="58">
          <circle cx="40" cy="40" r="36" fill="#f4ebea" stroke="#c9a0b2" strokeWidth="2" />
          <text x="40" y="48" textAnchor="middle" fontSize="24">
            ✨
          </text>
        </svg>
      </div>

      <div className="sticker sticker-mid-l">
        <svg viewBox="0 0 60 60" width="42" height="42">
          <circle cx="30" cy="30" r="28" fill="rgba(255,255,255,0.55)" stroke="#d8b8c6" strokeWidth="1.5" />
          <text x="30" y="38" textAnchor="middle" fontSize="18">
            🎀
          </text>
        </svg>
      </div>

      <div className="sticker sticker-mid-r">
        <svg viewBox="0 0 60 60" width="40" height="40">
          <circle cx="30" cy="30" r="28" fill="rgba(255,255,255,0.55)" stroke="#d8b8c6" strokeWidth="1.5" />
          <text x="30" y="38" textAnchor="middle" fontSize="18">
            💕
          </text>
        </svg>
      </div>

      <div className="sticker sticker-star-1">⭐</div>
      <div className="sticker sticker-star-2">💖</div>
      <div className="sticker sticker-star-3">🌷</div>
    </div>
  )
}
