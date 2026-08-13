export type PlayfulKind = 'tease' | 'flower' | 'judge' | 'slap'

export type PlayfulEffect = {
  id: string
  kind: PlayfulKind
  toUserId: string
  toName: string
  fromUserId: string
  fromName: string
  emoji: string
  label?: string
  createdAt: number
}

export const PLAYFUL_ACTIONS: {
  kind: PlayfulKind
  title: string
  hint: string
  emoji: string
}[] = [
  { kind: 'tease', title: 'Chọc ghẹo', hint: 'Chọc nhẹ một cái', emoji: '👆' },
  { kind: 'flower', title: 'Tặng hoa', hint: 'Tặng bó hoa cute', emoji: '💐' },
  { kind: 'judge', title: 'Phê bình', hint: 'Nhận xét vui thôi', emoji: '🧐' },
  { kind: 'slap', title: 'Tán vô mặt', hint: 'Ném bánh vào mặt', emoji: '🥧' },
]

export const TEASE_EMOJIS = ['👆', '🤭', '😜', '👉', '🫵'] as const
export const FLOWER_EMOJIS = ['💐', '🌸', '🌹', '🌺', '💮'] as const
export const SLAP_EMOJIS = ['🥧', '🍰', '💦', '🧁', '🎂'] as const

export const JUDGE_LINES = [
  'Gà vờ lờ',
  'Cùi bắp',
  'Cần luyện thêm',
  '0 điểm',
  'Skill issue',
  'Mlem approved',
  'Cute vậy trời',
  'Ok la, pass',
  'Nguy hiểm quá',
] as const

export function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

export function buildPlayfulPayload(
  kind: PlayfulKind,
  toUserId: string,
  toName: string,
  fromUserId: string,
  fromName: string,
): Omit<PlayfulEffect, 'id'> {
  const base = {
    kind,
    toUserId,
    toName,
    fromUserId,
    fromName,
    createdAt: Date.now(),
  }
  switch (kind) {
    case 'tease':
      return { ...base, emoji: pickRandom(TEASE_EMOJIS) }
    case 'flower':
      return { ...base, emoji: pickRandom(FLOWER_EMOJIS) }
    case 'slap':
      return { ...base, emoji: pickRandom(SLAP_EMOJIS) }
    case 'judge':
      return { ...base, emoji: '🧐', label: pickRandom(JUDGE_LINES) }
  }
}

/** Toast / speech text for everyone in the room */
export function playfulAnnounceMessage(
  kind: PlayfulKind,
  fromName: string,
  toName: string,
  label?: string,
  myUserId?: string,
  fromUserId?: string,
  toUserId?: string,
): string {
  const from =
    myUserId && fromUserId === myUserId ? 'Bạn' : fromName || 'Ai đó'
  const to = myUserId && toUserId === myUserId ? 'bạn' : toName || 'ai đó'

  switch (kind) {
    case 'tease':
      return `${from} vừa chọc ghẹo ${to}`
    case 'flower':
      return `${from} vừa tặng hoa cho ${to}`
    case 'judge':
      return label
        ? `${from} phê bình ${to}: ${label}`
        : `${from} vừa phê bình ${to}`
    case 'slap':
      return `${from} vừa tán vô mặt ${to}`
  }
}

