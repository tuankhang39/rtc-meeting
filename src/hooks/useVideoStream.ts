import { useEffect, type RefObject } from 'react'

const TRACK_EVENTS = ['unmute', 'mute', 'ended'] as const
const TICK_MS = 700
/** Số nhịp liên tiếp không có frame mới trước khi gắn lại srcObject (~4s). */
const STALL_TICKS = 6

/**
 * Gắn MediaStream vào <video> và giữ cho nó luôn chạy.
 *
 * Ba tình huống hay làm video đứng/đen mà React không hề biết:
 *  • track WebRTC được thêm vào stream bằng code → không có event `addtrack`
 *  • trình duyệt để video ở trạng thái paused sau khi tab bị ẩn hoặc
 *    sau khi cửa sổ Picture-in-Picture di chuyển / đổi kích thước
 *  • track chuyển muted → unmuted khi bên gửi bật cam hoặc bắt đầu share
 *
 * Nhịp kiểm tra ngắn xử lý cả ba: phát lại khi bị pause, và gắn lại
 * srcObject khi frame không nhích trong vài giây.
 */
export function useVideoStream(ref: RefObject<HTMLVideoElement | null>, stream: MediaStream | null) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const hasLiveVideo = () =>
      Boolean(stream?.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted))

    const kick = () => {
      const node = ref.current
      if (!node) return
      if (node.srcObject !== stream) node.srcObject = stream
      if (hasLiveVideo() && node.paused) void node.play().catch(() => {})
    }

    const watched = new Set<MediaStreamTrack>()
    const watchNewTracks = () => {
      if (!stream) return
      for (const track of stream.getTracks()) {
        if (watched.has(track)) continue
        watched.add(track)
        for (const ev of TRACK_EVENTS) track.addEventListener(ev, kick)
      }
    }

    let lastTime = -1
    let stalls = 0
    const tick = () => {
      watchNewTracks()
      const node = ref.current
      if (!node) return
      if (node.srcObject !== stream) node.srcObject = stream
      if (!hasLiveVideo()) {
        lastTime = -1
        stalls = 0
        return
      }
      if (node.paused) {
        void node.play().catch(() => {})
        return
      }
      if (node.currentTime !== lastTime) {
        lastTime = node.currentTime
        stalls = 0
        return
      }
      stalls += 1
      if (stalls < STALL_TICKS) return
      stalls = 0
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
      doc.removeEventListener('visibilitychange', kick)
      view?.removeEventListener('resize', kick)
      view?.removeEventListener('focus', kick)
    }
  }, [ref, stream])
}
