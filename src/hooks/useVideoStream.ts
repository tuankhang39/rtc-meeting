import { useEffect, useState, type RefObject } from 'react'

const TRACK_EVENTS = ['unmute', 'mute', 'ended'] as const
const TICK_MS = 700
/** Số nhịp chưa hề có frame nào trước khi thử gắn lại srcObject (~3.5s). */
const BLANK_TICKS = 5

/**
 * Gắn MediaStream vào <video>, giữ cho nó luôn chạy, và cho biết đã có hình thật chưa.
 *
 * `playing` dựa vào `videoWidth` — chỉ khác 0 khi trình duyệt đã decode được
 * ít nhất một frame. Đây là nguồn tin duy nhất đáng tin: `track.muted` của
 * WebRTC báo trễ và hay bỏ sót, dựa vào nó là ẩn mất video đang tốt.
 *
 * Watchdog chỉ gắn lại srcObject khi video CHƯA từng có frame. Video đã có hình
 * rồi mà frame ngừng nhích thì để yên — màn hình share tĩnh (slide) là như vậy,
 * gắn lại chỉ làm nó nháy.
 */
export function useVideoStream(ref: RefObject<HTMLVideoElement | null>, stream: MediaStream | null) {
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const hasVideoTrack = () => Boolean(stream?.getVideoTracks().some((t) => t.readyState !== 'ended'))

    const kick = () => {
      const node = ref.current
      if (!node) return
      if (node.srcObject !== stream) node.srcObject = stream
      if (hasVideoTrack() && node.paused) void node.play().catch(() => {})
    }

    const watched = new Set<MediaStreamTrack>()
    const watchNewTracks = () => {
      // Track WebRTC được thêm bằng code nên không có event `addtrack`.
      if (!stream) return
      for (const track of stream.getTracks()) {
        if (watched.has(track)) continue
        watched.add(track)
        for (const ev of TRACK_EVENTS) track.addEventListener(ev, kick)
      }
    }

    let blank = 0
    const tick = () => {
      watchNewTracks()
      const node = ref.current
      if (!node) return
      if (node.srcObject !== stream) node.srcObject = stream

      const painted = node.videoWidth > 0
      setPlaying(painted && hasVideoTrack())

      if (!hasVideoTrack()) {
        blank = 0
        return
      }
      if (node.paused) {
        void node.play().catch(() => {})
        return
      }
      if (painted) {
        blank = 0
        return
      }
      blank += 1
      if (blank < BLANK_TICKS) return
      blank = 0
      node.srcObject = null
      node.srcObject = stream
      void node.play().catch(() => {})
    }

    const onAddTrack = (ev: MediaStreamTrackEvent) => {
      watched.add(ev.track)
      for (const name of TRACK_EVENTS) ev.track.addEventListener(name, kick)
      kick()
    }
    stream?.addEventListener('addtrack', onAddTrack)
    stream?.addEventListener('removetrack', kick)

    el.addEventListener('loadedmetadata', kick)
    el.addEventListener('canplay', kick)
    el.addEventListener('resize', tick)

    // Với Picture-in-Picture, `document` toàn cục không phải document chứa video.
    const doc = el.ownerDocument
    const view = doc.defaultView
    doc.addEventListener('visibilitychange', kick)
    view?.addEventListener('resize', kick)
    view?.addEventListener('focus', kick)

    tick()
    const timer = window.setInterval(tick, TICK_MS)

    return () => {
      window.clearInterval(timer)
      for (const track of watched) {
        for (const name of TRACK_EVENTS) track.removeEventListener(name, kick)
      }
      stream?.removeEventListener('addtrack', onAddTrack)
      stream?.removeEventListener('removetrack', kick)
      el.removeEventListener('loadedmetadata', kick)
      el.removeEventListener('canplay', kick)
      el.removeEventListener('resize', tick)
      doc.removeEventListener('visibilitychange', kick)
      view?.removeEventListener('resize', kick)
      view?.removeEventListener('focus', kick)
      setPlaying(false)
    }
  }, [ref, stream])

  return playing
}
