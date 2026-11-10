import { BearArt } from './BearDecor'

/** Sticker gấu/mèo trang trí góc màn hình — không chặn click */
export function CuteStickers() {
  return (
    <div className="cute-stickers" aria-hidden="true">
      <div className="sticker sticker-tl">
        <BearArt kind="teddy" size={78} />
      </div>
      <div className="sticker sticker-tr">
        <BearArt kind="kitty" size={66} />
      </div>
      <div className="sticker sticker-bl">
        <BearArt kind="strawberry" size={72} />
      </div>
      <div className="sticker sticker-br">
        <BearArt kind="sleepy" size={70} />
      </div>
      <div className="sticker sticker-mid-l">
        <BearArt kind="panda" size={48} />
      </div>
      <div className="sticker sticker-mid-r">
        <BearArt kind="tabby" size={50} />
      </div>

      <div className="sticker sticker-star-1">⭐</div>
      <div className="sticker sticker-star-2">💖</div>
      <div className="sticker sticker-star-3">🎀</div>
    </div>
  )
}
