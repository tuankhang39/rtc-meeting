import { useEffect, useRef, useState, useCallback } from 'react'
import { watchSpeaking } from '../lib/speakingMeter'

export type ActiveSpeakerTarget = {
  id: string
  audioStream: MediaStream | null
  micOn?: boolean
  isHost?: boolean
  joinedAt?: number
}

type Options = {
  /** Phải nói liên tục bao lâu mới được đẩy lên (lọc tiếng ho, "ừ", gõ phím...). */
  promoteAfterMs?: number
  /** Khoảng cách tối thiểu giữa hai lần đổi thứ tự. */
  minSwapIntervalMs?: number
  /** Số ô đầu danh sách coi như "đang thấy": ai đã nằm trong đó thì không bị dời chỗ. */
  visibleSlots?: number
}

type Sortable = { id: string; isHost?: boolean; isHostUser?: boolean; joinedAt?: number }

function fallbackCompare(a: ActiveSpeakerTarget, b: ActiveSpeakerTarget) {
  const aHost = Boolean(a.isHost)
  const bHost = Boolean(b.isHost)
  if (aHost && !bHost) return -1
  if (!aHost && bHost) return 1
  return (a.joinedAt ?? 0) - (b.joinedAt ?? 0)
}

/**
 * Sắp xếp kiểu Zoom: thứ tự là một danh sách ổn định, chỉ thay đổi khi
 * - một người nói liên tục đủ `promoteAfterMs`, VÀ
 * - người đó đang nằm ngoài `visibleSlots` ô đầu, VÀ
 * - đã qua `minSwapIntervalMs` kể từ lần đổi trước (nếu chưa thì xếp hàng chờ).
 * Người mới vào được thêm vào cuối, người rời phòng bị bỏ ra — không ai khác bị xáo trộn.
 */
export function useActiveSpeakers(targets: ActiveSpeakerTarget[], options: Options = {}) {
  const { promoteAfterMs = 1200, minSwapIntervalMs = 3000, visibleSlots = 3 } = options

  const [order, setOrder] = useState<string[]>([])
  const orderRef = useRef<string[]>([])
  const speakingRef = useRef<Record<string, boolean>>({})
  const lastSwapRef = useRef(0)
  const pendingRef = useRef<string[]>([])
  const swapTimerRef = useRef(0)
  const promoteTimersRef = useRef<Record<string, number>>({})
  const optsRef = useRef({ promoteAfterMs, minSwapIntervalMs, visibleSlots })
  optsRef.current = { promoteAfterMs, minSwapIntervalMs, visibleSlots }

  const commitOrder = useCallback((next: string[]) => {
    orderRef.current = next
    setOrder(next)
  }, [])

  // Đồng bộ danh sách người: giữ nguyên thứ tự cũ, thêm người mới vào cuối.
  const membershipKey = targets.map((t) => t.id).join('|')
  useEffect(() => {
    const ids = new Set(targets.map((t) => t.id))
    const kept = orderRef.current.filter((id) => ids.has(id))
    const known = new Set(kept)
    const added = targets.filter((t) => !known.has(t.id)).sort(fallbackCompare).map((t) => t.id)
    if (added.length === 0 && kept.length === orderRef.current.length) return
    pendingRef.current = pendingRef.current.filter((id) => ids.has(id))
    commitOrder([...kept, ...added])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipKey, commitOrder])

  const flushPending = useCallback(() => {
    swapTimerRef.current = 0
    const { minSwapIntervalMs: gap, visibleSlots: slots } = optsRef.current

    // Bỏ những người đã ngừng nói hoặc đã lọt vào vùng đang thấy.
    pendingRef.current = pendingRef.current.filter((id) => {
      const idx = orderRef.current.indexOf(id)
      return speakingRef.current[id] && idx >= slots
    })
    const next = pendingRef.current.shift()
    if (!next) return

    const wait = lastSwapRef.current + gap - Date.now()
    if (wait > 0) {
      pendingRef.current.unshift(next)
      swapTimerRef.current = window.setTimeout(flushPending, wait)
      return
    }

    lastSwapRef.current = Date.now()
    commitOrder([next, ...orderRef.current.filter((id) => id !== next)])

    if (pendingRef.current.length > 0) {
      swapTimerRef.current = window.setTimeout(flushPending, gap)
    }
  }, [commitOrder])

  const requestPromote = useCallback(
    (id: string) => {
      const idx = orderRef.current.indexOf(id)
      if (idx >= 0 && idx < optsRef.current.visibleSlots) return
      if (!pendingRef.current.includes(id)) pendingRef.current.push(id)
      if (!swapTimerRef.current) flushPending()
    },
    [flushPending]
  )

  const handleSpeaking = useCallback(
    (id: string, speaking: boolean) => {
      // Chỉ giữ trong ref: viền "đang nói" do từng ô tự đo (useSpeaking), ở đây
      // mà setState thì cả Room render lại mỗi lần ai đó mở miệng.
      speakingRef.current[id] = speaking

      const timers = promoteTimersRef.current
      window.clearTimeout(timers[id])
      delete timers[id]
      if (speaking) {
        timers[id] = window.setTimeout(() => {
          delete timers[id]
          if (speakingRef.current[id]) requestPromote(id)
        }, optsRef.current.promoteAfterMs)
      }
    },
    [requestPromote]
  )

  useEffect(() => {
    const cleanups: Array<() => void> = []

    targets.forEach((target) => {
      const enabled = target.micOn !== false
      const stream = target.audioStream

      if (!enabled || !stream) {
        if (speakingRef.current[target.id]) handleSpeaking(target.id, false)
        return
      }

      let detach: (() => void) | null = null
      let retryTimer = 0

      const attach = () => {
        const track = stream.getAudioTracks().find((t) => t.readyState === 'live')
        if (!track) {
          retryTimer = window.setTimeout(attach, 500)
          return
        }

        const stop = watchSpeaking(track, (speaking) => handleSpeaking(target.id, speaking))

        const reattach = () => {
          detach?.()
          detach = null
          attach()
        }

        track.addEventListener('ended', reattach)
        detach = () => {
          track.removeEventListener('ended', reattach)
          stop()
        }
      }

      const onAddTrack = () => {
        if (detach) return
        window.clearTimeout(retryTimer)
        attach()
      }
      stream.addEventListener('addtrack', onAddTrack)

      attach()

      cleanups.push(() => {
        window.clearTimeout(retryTimer)
        stream.removeEventListener('addtrack', onAddTrack)
        detach?.()
        if (speakingRef.current[target.id]) handleSpeaking(target.id, false)
      })
    })

    return () => {
      cleanups.forEach((c) => c())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    handleSpeaking,
    targets.map((t) => `${t.id}:${t.audioStream?.id ?? ''}:${t.micOn !== false}`).join('|'),
  ])

  useEffect(() => {
    const timers = promoteTimersRef.current
    return () => {
      window.clearTimeout(swapTimerRef.current)
      Object.values(timers).forEach((t) => window.clearTimeout(t))
    }
  }, [])

  const sortPeople = useCallback(
    <T extends Sortable>(items: T[]): T[] => {
      const rank = new Map(order.map((id, i) => [id, i]))
      return items
        .map((item, i) => ({ item, r: rank.get(item.id) ?? order.length + i }))
        .sort((a, b) => a.r - b.r)
        .map((x) => x.item)
    },
    [order]
  )

  return {
    order,
    sortPeople,
  }
}
