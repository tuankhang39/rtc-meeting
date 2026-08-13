export type StickerPackId = 'cute' | 'love' | 'fun' | 'food'

export type StickerPack = {
  id: StickerPackId
  label: string
  stickers: string[]
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'cute',
    label: 'Cute',
    stickers: ['🐰', '🐱', '🐻', '🐥', '🌸', '🎀', '✨', '🧸'],
  },
  {
    id: 'love',
    label: 'Love',
    stickers: ['💖', '💕', '💗', '💘', '🥰', '😘', '💌', '🌹'],
  },
  {
    id: 'fun',
    label: 'Fun',
    stickers: ['😂', '🥳', '🔥', '👏', '🎉', '🤩', '💯', '😎'],
  },
  {
    id: 'food',
    label: 'Food',
    stickers: ['🍓', '🍰', '🧋', '🍩', '🍪', '🍭', '🧁', '🍑'],
  },
]

export type ScreenSticker = {
  id: string
  emoji: string
  pack: StickerPackId
  x: number
  y: number
  userId: string
  name: string
  createdAt: number
}
