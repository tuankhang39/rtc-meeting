/**
 * Đo mức nói cho nhiều track bằng MỘT AudioContext và MỘT vòng rAF dùng chung.
 *
 * Trước đây mỗi ô video tự tạo AudioContext riêng. Phòng 5 người là 5–6
 * AudioContext mỗi trang — Chrome chỉ cho tối đa 6, và mỗi cái là một luồng
 * audio thật. Cộng với 4 PeerConnection đang giải mã video thì máy yếu đứng hình,
 * nặng hơn là treo cả trang.
 */

type Watcher = {
  track: MediaStreamTrack
  source: MediaStreamAudioSourceNode
  analyser: AnalyserNode
  data: Uint8Array<ArrayBuffer>
  listeners: Set<(speaking: boolean) => void>
  active: boolean
  onCount: number
  offCount: number
}

// Ngưỡng bật/tắt cố ý lệch nhau để UI không nhấp nháy quanh mức im lặng.
const ON = 22
const OFF = 14
const ON_FRAMES = 3
const OFF_FRAMES = 10

let ctx: AudioContext | null = null
let raf = 0
const watchers = new Map<string, Watcher>()

function audioContext() {
  if (ctx && ctx.state !== 'closed') return ctx
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null
  try {
    ctx = new AudioCtx()
  } catch {
    return null
  }
  return ctx
}

function emit(watcher: Watcher, speaking: boolean) {
  watcher.active = speaking
  for (const listener of watcher.listeners) listener(speaking)
}

function tick() {
  for (const watcher of watchers.values()) {
    if (!watcher.track.enabled || watcher.track.readyState === 'ended') {
      if (watcher.active) emit(watcher, false)
      continue
    }

    watcher.analyser.getByteFrequencyData(watcher.data)
    let sum = 0
    const end = Math.min(watcher.data.length, 40)
    for (let i = 2; i < end; i++) sum += watcher.data[i]!
    const avg = sum / (end - 2)

    if (!watcher.active) {
      if (avg > ON) {
        watcher.onCount += 1
        if (watcher.onCount >= ON_FRAMES) {
          watcher.offCount = 0
          emit(watcher, true)
        }
      } else {
        watcher.onCount = 0
      }
    } else if (avg < OFF) {
      watcher.offCount += 1
      if (watcher.offCount >= OFF_FRAMES) {
        watcher.onCount = 0
        emit(watcher, false)
      }
    } else {
      watcher.offCount = 0
    }
  }

  raf = watchers.size > 0 ? requestAnimationFrame(tick) : 0
}

/** Theo dõi một track; trả về hàm huỷ theo dõi. */
export function watchSpeaking(track: MediaStreamTrack, onChange: (speaking: boolean) => void) {
  const context = audioContext()
  if (!context) return () => {}

  let watcher = watchers.get(track.id)
  if (!watcher) {
    let source: MediaStreamAudioSourceNode
    let analyser: AnalyserNode
    try {
      source = context.createMediaStreamSource(new MediaStream([track]))
      analyser = context.createAnalyser()
    } catch {
      return () => {}
    }
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)
    watcher = {
      track,
      source,
      analyser,
      data: new Uint8Array(analyser.frequencyBinCount),
      listeners: new Set(),
      active: false,
      onCount: 0,
      offCount: 0,
    }
    watchers.set(track.id, watcher)
  }

  watcher.listeners.add(onChange)
  void context.resume().catch(() => {})
  if (!raf) raf = requestAnimationFrame(tick)

  return () => {
    const current = watchers.get(track.id)
    if (!current) return
    current.listeners.delete(onChange)
    if (current.listeners.size > 0) return
    try {
      current.source.disconnect()
    } catch {
      /* ignore */
    }
    watchers.delete(track.id)
    if (watchers.size === 0 && raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }
}
