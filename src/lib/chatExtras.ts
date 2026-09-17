export type ChatTabId = 'chat' | 'pins' | 'notes' | 'resources'

export const CHAT_TABS: Array<{ id: ChatTabId; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'pins', label: 'Ghim' },
  { id: 'notes', label: 'Ghi chú' },
  { id: 'resources', label: 'Học liệu' },
]

export type PinnedMessage = {
  id: string
  messageId: string
  text: string
  authorId: string
  authorName: string
  pinnedBy: string
  pinnedByName: string
  createdAt: number
}

export type ChatNote = {
  id: string
  tag: string
  text: string
  userId: string
  name: string
  createdAt: number
}

export type ChatLesson = {
  id: string
  title: string
  link: string
  userId: string
  name: string
  createdAt: number
}

export type ChatMaterial = {
  id: string
  label: string
  link: string
  userId: string
  name: string
  createdAt: number
}

/** Mục học liệu thống nhất (bài học + tài liệu) */
export type ChatResource = {
  id: string
  source: 'lesson' | 'material'
  title: string
  link: string
  userId: string
  name: string
  createdAt: number
}

export function mergeChatResources(lessons: ChatLesson[], materials: ChatMaterial[]): ChatResource[] {
  const list: ChatResource[] = [
    ...lessons.map((l) => ({
      id: l.id,
      source: 'lesson' as const,
      title: l.title,
      link: l.link,
      userId: l.userId,
      name: l.name,
      createdAt: l.createdAt,
    })),
    ...materials.map((m) => ({
      id: m.id,
      source: 'material' as const,
      title: m.label,
      link: m.link,
      userId: m.userId,
      name: m.name,
      createdAt: m.createdAt,
    })),
  ]
  list.sort((a, b) => b.createdAt - a.createdAt)
  return list
}
