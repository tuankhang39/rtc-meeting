import { useEffect, useState } from 'react'

// Ngưỡng có chủ ý lệch nhau để UI không nhấp nháy quanh mức im lặng.
const ON = 22
const OFF = 14
const ON_FRAMES = 3
const OFF_FRAMES = 10

/** Detect voice activity — ổn định, tránh bật/tắt liên tục gây nhấp nháy UI. */
export function useSpeaking(stream: MediaStream | null, enabled = true) {
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!enabled || !stream) {
      setSpeaking(false)
      return
    }

    let waitTimer = 0
    let stopAnalyser: (() => void) | null = null

    const listen = (track: MediaStreamTrack) => {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return null

      const ctx = new AudioCtx()
      const source = ctx.createMediaStreamSource(new MediaStream([track]))
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)

      const data = new Uint8Array(analyser.frequencyBinCount)
      let raf = 0
      let active = false
      let onCount = 0
      let offCount = 0

      const tick = () => {
        if (!track.enabled) {
          if (active) {
            active = false
            setSpeaking(false)
          }
          raf = requestAnimationFrame(tick)
          return
        }

        analyser.getByteFrequencyData(data)
        let sum = 0
        const end = Math.min(data.length, 40)
        for (let i = 2; i < end; i++) sum += data[i]!
        const avg = sum / (end - 2)

        if (!active) {
          if (avg > ON) {
            onCount++
            if (onCount >= ON_FRAMES) {
              active = true
              offCount = 0
              setSpeaking(true)
            }
          } else {
            onCount = 0
          }
        } else if (avg < OFF) {
          offCount++
          if (offCount >= OFF_FRAMES) {
            active = false
            onCount = 0
            setSpeaking(false)
          }
        } else {
          offCount = 0
        }

        raf = requestAnimationFrame(tick)
      }

      void ctx.resume().then(() => {
        raf = requestAnimationFrame(tick)
      })
      track.addEventListener('ended', restart)

      return () => {
        cancelAnimationFrame(raf)
        track.removeEventListener('ended', restart)
        try {
          source.disconnect()
        } catch {
          /* ignore */
        }
        void ctx.close()
      }
    }

    // Stream của peer được tạo trước khi track audio tới → chờ track rồi mới đo.
    const waitForTrack = () => {
      const track = stream.getAudioTracks().find((t) => t.readyState === 'live')
      if (!track) {
        waitTimer = window.setTimeout(waitForTrack, 600)
        return
      }
      stopAnalyser = listen(track)
    }

    function restart() {
      stopAnalyser?.()
      stopAnalyser = null
      setSpeaking(false)
      waitForTrack()
    }

    waitForTrack()
    return () => {
      window.clearTimeout(waitTimer)
      stopAnalyser?.()
    }
  }, [enabled, stream])

  return speaking
}
