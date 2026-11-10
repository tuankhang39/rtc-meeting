/**
 * Artwork gấu dùng chung cho cửa sổ PiP: avatar khi tắt cam, ảnh chờ, và nền pattern.
 * Tất cả là chuỗi SVG tĩnh (không chứa dữ liệu người dùng) nên an toàn để inline.
 */

export type BearKind =
  | 'brown'
  | 'panda'
  | 'polar'
  | 'strawberry'
  | 'sleepy'
  | 'koala'
  | 'teddy'
  | 'kitty'
  | 'tabby'

export const BEAR_KINDS: BearKind[] = [
  'brown',
  'teddy',
  'kitty',
  'panda',
  'polar',
  'tabby',
  'strawberry',
  'sleepy',
  'koala',
]

type Palette = {
  fur: string
  ear: string
  muzzle: string
  nose: string
  eye: string
  cheek: string
  bg: [string, string]
}

const PALETTE: Record<BearKind, Palette> = {
  brown: { fur: '#b5784a', ear: '#f2c4c9', muzzle: '#f6dcc6', nose: '#4a2a18', eye: '#3a2214', cheek: '#ff8fab', bg: ['#fde8ef', '#f3c2d2'] },
  panda: { fur: '#ffffff', ear: '#3a2f38', muzzle: '#ffffff', nose: '#3a2f38', eye: '#3a2f38', cheek: '#ffa3bd', bg: ['#f6ecf8', '#e2c9ea'] },
  polar: { fur: '#fbf8f4', ear: '#f8c9d6', muzzle: '#ffffff', nose: '#4a3040', eye: '#4a3040', cheek: '#ffadc3', bg: ['#fdeef3', '#efc9d8'] },
  strawberry: { fur: '#f5b3c7', ear: '#ffe1ea', muzzle: '#fff1f5', nose: '#8c3a5a', eye: '#5a2340', cheek: '#ff6f98', bg: ['#fff0f5', '#f8cbdb'] },
  sleepy: { fur: '#9a6a52', ear: '#e7b9c3', muzzle: '#ecc9b8', nose: '#3a1d12', eye: '#3a1d12', cheek: '#ff8fab', bg: ['#f3e8fb', '#d9c3ee'] },
  koala: { fur: '#b3a9b6', ear: '#f6e6ee', muzzle: '#cdc2cf', nose: '#4a3a48', eye: '#3a2e38', cheek: '#ffa3bd', bg: ['#f8eef4', '#e6d1de'] },
  teddy: { fur: '#d29b66', ear: '#f3cfa6', muzzle: '#f7e2c6', nose: '#4a2a18', eye: '#2e1a10', cheek: '#ff8fab', bg: ['#fff1e8', '#f6cfd6'] },
  kitty: { fur: '#ffffff', ear: '#ffc2d4', muzzle: '#ffffff', nose: '#ff7aa2', eye: '#3a2a36', cheek: '#ffa3bd', bg: ['#fff0f6', '#f9c9dc'] },
  tabby: { fur: '#f6b77a', ear: '#ffd6c2', muzzle: '#fff1e2', nose: '#ff8a9e', eye: '#3a2414', cheek: '#ff8fab', bg: ['#fff3ea', '#f9d0c8'] },
}

const isCat = (kind: BearKind) => kind === 'kitty' || kind === 'tabby'

/** Mặt mèo con (tự vẽ, không mô phỏng nhân vật có bản quyền) — cùng hệ toạ độ 64×64. */
function catFace(kind: BearKind): string {
  const p = PALETTE[kind]
  const stroke = `stroke="#6b3a52" stroke-opacity=".2" stroke-width="1.2" stroke-linejoin="round"`
  const ears =
    `<path d="M9 33 12.5 7.5 31 19z" fill="${p.fur}" ${stroke}/>` +
    `<path d="M55 33 51.5 7.5 33 19z" fill="${p.fur}" ${stroke}/>` +
    `<path d="M14 26.5 15.6 13.5 25 20z" fill="${p.ear}"/>` +
    `<path d="M50 26.5 48.4 13.5 39 20z" fill="${p.ear}"/>`
  const head = `<ellipse cx="32" cy="38" rx="25" ry="20" fill="${p.fur}" ${stroke}/>`
  const stripes =
    kind === 'tabby'
      ? `<path d="M32 19.5v6M26 20.5l1.6 5M38 20.5l-1.6 5" stroke="#d9874a" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="M8.5 37h5M8.8 42h4.4M55.5 37h-5M55.2 42h-4.4" stroke="#d9874a" stroke-width="2.2" stroke-linecap="round"/>`
      : ''
  const eyes =
    `<ellipse cx="22.5" cy="36" rx="2.9" ry="3.5" fill="${p.eye}"/>` +
    `<ellipse cx="41.5" cy="36" rx="2.9" ry="3.5" fill="${p.eye}"/>` +
    `<circle cx="23.5" cy="34.6" r="1.1" fill="#fff"/><circle cx="42.5" cy="34.6" r="1.1" fill="#fff"/>`
  const nose = `<path d="M29.6 41.6h4.8L32 44.2z" fill="${p.nose}" stroke="${p.nose}" stroke-width=".8" stroke-linejoin="round"/>`
  const mouth = `<path d="M32 44.2q-1.4 3-4.4 1.6M32 44.2q1.4 3 4.4 1.6" fill="none" stroke="#5a3a48" stroke-width="1.5" stroke-linecap="round"/>`
  const whiskers = `<path d="M15 42.5 4 41M15 45.5 5 47.5M49 42.5l11-1.5M49 45.5l10 2" stroke="#8a6a7a" stroke-opacity=".55" stroke-width="1.2" stroke-linecap="round"/>`
  const cheeks =
    `<ellipse cx="16.5" cy="44.5" rx="3.6" ry="2.6" fill="${p.cheek}" opacity=".5"/>` +
    `<ellipse cx="47.5" cy="44.5" rx="3.6" ry="2.6" fill="${p.cheek}" opacity=".5"/>`
  // Mèo trắng đeo vòng cổ có chuông; mèo vàng đeo hoa nhỏ trên đầu.
  const extra =
    kind === 'kitty'
      ? `<path d="M15 54.5q17 7 34 0" fill="none" stroke="#e8578a" stroke-width="3" stroke-linecap="round"/>` +
        `<circle cx="32" cy="58.6" r="3.4" fill="#f5c96a" stroke="#c9952e" stroke-width=".9"/><path d="M30.4 58.8h3.2" stroke="#a87820" stroke-width=".9" stroke-linecap="round"/>`
      : `<g transform="translate(44 17)" fill="#ff8fab"><circle cy="-2.8" r="2.2"/><circle cx="2.7" cy="-.9" r="2.2"/><circle cx="1.7" cy="2.3" r="2.2"/><circle cx="-1.7" cy="2.3" r="2.2"/><circle cx="-2.7" cy="-.9" r="2.2"/><circle r="1.5" fill="#fff6c9"/></g>`
  return ears + head + stripes + eyes + cheeks + whiskers + nose + mouth + extra
}

export function bearPalette(kind: BearKind) {
  return PALETTE[kind]
}

/** Nhóm SVG khuôn mặt gấu trong hệ toạ độ 64×64 (không có thẻ <svg>). */
export function bearFace(kind: BearKind): string {
  if (isCat(kind)) return catFace(kind)
  const p = PALETTE[kind]
  const stroke = `stroke="#6b3a52" stroke-opacity=".18" stroke-width="1.2"`
  const isPanda = kind === 'panda'
  const isKoala = kind === 'koala'
  const earR = isKoala ? 13 : 10
  const earIn = isKoala ? 8 : 5.5
  const earOuter = isPanda ? p.ear : p.fur

  const ears =
    `<circle cx="${isKoala ? 12 : 16}" cy="${isKoala ? 22 : 17}" r="${earR}" fill="${earOuter}" ${stroke}/>` +
    `<circle cx="${isKoala ? 52 : 48}" cy="${isKoala ? 22 : 17}" r="${earR}" fill="${earOuter}" ${stroke}/>` +
    (isPanda
      ? ''
      : `<circle cx="${isKoala ? 12 : 16}" cy="${isKoala ? 22 : 17}" r="${earIn}" fill="${p.ear}"/>` +
        `<circle cx="${isKoala ? 52 : 48}" cy="${isKoala ? 22 : 17}" r="${earIn}" fill="${p.ear}"/>`)

  const head = `<ellipse cx="32" cy="36" rx="23" ry="21" fill="${p.fur}" ${stroke}/>`

  const patches = isPanda
    ? `<ellipse cx="22.5" cy="32" rx="5.2" ry="6.6" transform="rotate(-25 22.5 32)" fill="${p.ear}"/>` +
      `<ellipse cx="41.5" cy="32" rx="5.2" ry="6.6" transform="rotate(25 41.5 32)" fill="${p.ear}"/>`
    : ''

  const eyes =
    kind === 'sleepy'
      ? `<path d="M19.5 32.5q3.5 3 7 0M37.5 32.5q3.5 3 7 0" fill="none" stroke="${p.eye}" stroke-width="2" stroke-linecap="round"/>`
      : `<circle cx="23" cy="32" r="2.7" fill="${isPanda ? '#fff' : p.eye}"/>` +
        `<circle cx="41" cy="32" r="2.7" fill="${isPanda ? '#fff' : p.eye}"/>` +
        (isPanda
          ? `<circle cx="23.4" cy="32.4" r="1.5" fill="${p.eye}"/><circle cx="41.4" cy="32.4" r="1.5" fill="${p.eye}"/>`
          : `<circle cx="24" cy="31" r=".9" fill="#fff"/><circle cx="42" cy="31" r=".9" fill="#fff"/>`)

  const muzzle = isKoala
    ? `<ellipse cx="32" cy="40" rx="5.5" ry="7" fill="${p.nose}"/>`
    : `<ellipse cx="32" cy="43" rx="10" ry="7.5" fill="${p.muzzle}"/>` +
      `<ellipse cx="32" cy="39.8" rx="3.8" ry="2.7" fill="${p.nose}"/>`

  const mouth = isKoala
    ? `<path d="M28 49.5q4 2.5 8 0" fill="none" stroke="${p.nose}" stroke-width="1.6" stroke-linecap="round"/>`
    : `<path d="M32 42.4v2.4M32 44.8q-2.6 2.6-5 .4M32 44.8q2.6 2.6 5 .4" fill="none" stroke="${p.nose}" stroke-width="1.6" stroke-linecap="round"/>`

  const cheeks =
    `<circle cx="16.5" cy="41" r="3.2" fill="${p.cheek}" opacity=".45"/>` +
    `<circle cx="47.5" cy="41" r="3.2" fill="${p.cheek}" opacity=".45"/>`

  const extra =
    kind === 'strawberry'
      ? // nơ hồng trên tai phải
        `<g transform="translate(50 9) rotate(18)"><path d="M0 0l-7-4.5v9zM0 0l7-4.5v9z" fill="#ff7aa2"/><circle r="2.2" fill="#ff4f86"/></g>`
      : kind === 'sleepy'
        ? `<text x="50" y="12" font-family="Segoe UI, sans-serif" font-weight="800" font-size="9" fill="#b56b88">z</text>` +
          `<text x="56" y="5" font-family="Segoe UI, sans-serif" font-weight="800" font-size="6.5" fill="#b56b88">z</text>`
        : kind === 'polar'
          ? // khăn quàng nhỏ
            `<path d="M14 52q18 9 36 0l-1.5 5q-16.5 7-33 0z" fill="#d889a6"/>`
          : kind === 'teddy'
            ? // gấu bông: miếng vá có đường khâu + nơ cổ
              `<g transform="rotate(-14 44 24)"><rect x="38.5" y="19.5" width="10" height="9" rx="2.4" fill="#f2b8c8"/>` +
              `<path d="M40 21l1.6 1.6m0-1.6L40 22.6M45.4 25.4l1.6 1.6m0-1.6-1.6 1.6" stroke="#9a5a6e" stroke-width=".9" stroke-linecap="round"/>` +
              `<rect x="38.5" y="19.5" width="10" height="9" rx="2.4" fill="none" stroke="#9a5a6e" stroke-width=".8" stroke-dasharray="1.6 1.2"/></g>` +
              `<path d="M26.5 49.5q5.5 2.2 11 0" fill="none" stroke="#9a6a48" stroke-width=".9" stroke-dasharray="1.4 1.2" stroke-linecap="round"/>` +
              `<g transform="translate(32 58.5)"><path d="M0 0l-8-4.5q-1.4 4.5 0 9zM0 0l8-4.5q1.4 4.5 0 9z" fill="#e8578a"/><circle r="2.4" fill="#c73a6b"/></g>`
            : ''

  return ears + head + patches + eyes + muzzle + mouth + cheeks + extra
}

export function bearSvg(kind: BearKind, size = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 68 68" width="${size}" height="${size}" aria-hidden="true">${bearFace(kind)}</svg>`
}

/** Chọn kiểu gấu ổn định theo id người dùng. */
export function bearForId(id: string): BearKind {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return BEAR_KINDS[Math.abs(h) % BEAR_KINDS.length]
}

const PAW = (fill: string) =>
  `<g fill="${fill}"><ellipse cx="0" cy="3" rx="5" ry="4.2"/><circle cx="-5" cy="-3" r="2"/><circle cx="-1.8" cy="-5.6" r="2"/><circle cx="1.8" cy="-5.6" r="2"/><circle cx="5" cy="-3" r="2"/></g>`
const HEART = (fill: string) => `<path d="M0 3.5C-6-1-4-6.5 0-3.5 4-6.5 6-1 0 3.5z" fill="${fill}"/>`
const STAR = (fill: string) =>
  `<path d="M0-5l1.5 3.2 3.5.4-2.6 2.4.7 3.5L0 2.8l-3.1 1.7.7-3.5L-5-1.4l3.5-.4z" fill="${fill}"/>`
const BOW = (fill: string) =>
  `<g fill="${fill}"><path d="M0 0l-7-4.5q-1.5 4.5 0 9zM0 0l7-4.5q1.5 4.5 0 9z"/><circle r="2.2"/></g>`
const FLOWER = (fill: string) =>
  `<g fill="${fill}"><circle cx="0" cy="-3.6" r="2.6"/><circle cx="3.4" cy="-1.1" r="2.6"/><circle cx="2.1" cy="2.9" r="2.6"/><circle cx="-2.1" cy="2.9" r="2.6"/><circle cx="-3.4" cy="-1.1" r="2.6"/><circle r="1.8" fill="#fff6c9"/></g>`

type PatternOptions = {
  /** Độ đậm toàn bộ pattern (0–1). */
  opacity?: number
  /** Màu dấu chân gấu. */
  paw?: string
  heart?: string
  star?: string
  bow?: string
}

/** Ô pattern nền 200×200 với nhiều kiểu gấu + phụ kiện, để lặp lại. */
export function bearPatternSvg({
  opacity = 0.2,
  paw = '#d48aa6',
  heart = '#ff8fab',
  star = '#f5c96a',
  bow = '#e77fa3',
}: PatternOptions = {}): string {
  const bear = (kind: BearKind, x: number, y: number, s: number, r: number) =>
    `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s}) translate(-32 -36)">${bearFace(kind)}</g>`
  const at = (markup: string, x: number, y: number, s = 1, r = 0) =>
    `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">${markup}</g>`

  const body =
    bear('teddy', 38, 40, 0.5, -12) +
    bear('panda', 140, 26, 0.42, 10) +
    bear('strawberry', 102, 104, 0.48, -6) +
    bear('kitty', 30, 150, 0.44, 14) +
    bear('sleepy', 164, 150, 0.46, -14) +
    bear('tabby', 82, 186, 0.36, 6) +
    at(PAW(paw), 92, 34, 0.9, 20) +
    at(PAW(paw), 104, 50, 0.75, 28) +
    at(PAW(paw), 178, 86, 0.8, -30) +
    at(HEART(heart), 64, 92, 1.1, -10) +
    at(HEART(heart), 186, 20, 0.8, 12) +
    at(STAR(star), 14, 96, 1, 0) +
    at(STAR(star), 136, 72, 0.8, 18) +
    at(STAR(star), 122, 172, 0.9, -8) +
    at(BOW(bow), 160, 110, 1, 8) +
    at(FLOWER(heart), 66, 140, 0.95, -12)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><g opacity="${opacity}">${body}</g></svg>`
}

export function svgDataUri(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
