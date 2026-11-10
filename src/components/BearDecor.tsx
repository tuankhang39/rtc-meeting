import type { CSSProperties } from 'react'
import { bearPalette, bearPatternSvg, bearSvg, svgDataUri, type BearKind } from '../lib/bearArt'

/** Biến CSS chứa nền pattern gấu cho cả app (sáng + tối). */
export const BEAR_THEME_VARS = {
  '--bear-pattern': svgDataUri(bearPatternSvg({ opacity: 0.16 })),
  '--bear-pattern-dark': svgDataUri(
    bearPatternSvg({ opacity: 0.08, paw: '#8ec5e8', heart: '#b8d9f0', star: '#e8d48e', bow: '#8ec5e8' }),
  ),
} as CSSProperties

/** Mặt gấu/mèo inline. SVG là chuỗi tĩnh sinh từ bearArt.ts, không chứa dữ liệu người dùng. */
export function BearArt({ kind, size = 64, className }: { kind: BearKind; size?: number; className?: string }) {
  return (
    <span
      className={['bear-art', className].filter(Boolean).join(' ')}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: bearSvg(kind, size) }}
    />
  )
}

/** Gấu ngó lên từ mép trên của thẻ, hai bàn chân bám vào mép. Đặt trong phần tử position: relative. */
export function PeekBear({ kind = 'teddy', size = 92 }: { kind?: BearKind; size?: number }) {
  return (
    <span
      className="peek-bear"
      aria-hidden
      style={
        {
          '--peek-size': `${size}px`,
          // panda có chân đen (cùng màu tai), các con khác chân cùng màu lông
          '--peek-fur': kind === 'panda' ? bearPalette(kind).ear : bearPalette(kind).fur,
        } as CSSProperties
      }
    >
      <BearArt kind={kind} size={size} className="peek-bear-face" />
      <span className="peek-bear-paw left" />
      <span className="peek-bear-paw right" />
    </span>
  )
}
