import { QUICK_COMMENTS, type QuickComment } from './quickComments'

export function getQuickCommentById(id: string): QuickComment | undefined {
  return QUICK_COMMENTS.find((c) => c.id === id)
}

export function getQuickCommentByText(text: string): QuickComment | undefined {
  return QUICK_COMMENTS.find((c) => c.text === text)
}

let sharedAudio: HTMLAudioElement | null = null
let audioUnlocked = false

function getAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio()
    sharedAudio.preload = 'auto'
  }
  return sharedAudio
}

/** Gọi khi bấm nút — mở khóa autoplay Chrome */
export function unlockQuickAudio() {
  if (audioUnlocked || typeof window === 'undefined') return
  const audio = getAudio()
  audio.volume = 0.01
  audio.src =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='
  void audio
    .play()
    .then(() => {
      audio.pause()
      audio.currentTime = 0
      audio.volume = 1
      audioUnlocked = true
    })
    .catch(() => {
      audio.volume = 1
    })
}

const playedIds = new Set<string>()

/** Phát MP3 sẵn trong /tts/{id}.mp3 — không cần giọng trình duyệt */
export function playQuickCommentSound(commentId: string, eventId?: string) {
  if (typeof window === 'undefined') return
  if (!commentId) return

  if (eventId) {
    if (playedIds.has(eventId)) return
    playedIds.add(eventId)
    if (playedIds.size > 40) {
      const first = playedIds.values().next().value
      if (first) playedIds.delete(first)
    }
  }

  unlockQuickAudio()
  const audio = getAudio()
  try {
    audio.pause()
    audio.currentTime = 0
    audio.src = `/tts/${commentId}.mp3`
    audio.volume = 1
    void audio.play().catch(() => {
      // Autoplay blocked — ignore
    })
  } catch {
    // ignore
  }
}

/** Prefetch để lần bấm đầu nhanh */
export function prefetchQuickCommentSounds() {
  if (typeof window === 'undefined') return
  for (const c of QUICK_COMMENTS) {
    const a = new Audio()
    a.preload = 'auto'
    a.src = `/tts/${c.id}.mp3`
  }
}
