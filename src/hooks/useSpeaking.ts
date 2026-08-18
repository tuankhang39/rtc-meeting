import { useEffect, useState } from 'react'
import { watchSpeaking } from '../lib/speakingMeter'

/** Detect voice activity — ổn định, tránh bật/tắt liên tục gây nhấp nháy UI. */
export function useSpeaking(stream: MediaStream | null, enabled = true) {
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!enabled || !stream) {
      setSpeaking(false)
      return
    }

    let detach: (() => void) | null = null
    let retry = 0

    // Stream của peer được tạo trước khi track audio tới → chờ track rồi mới đo.
    const attach = () => {
      const track = stream.getAudioTracks().find((t) => t.readyState === 'live')
      if (!track) {
        retry = window.setTimeout(attach, 600)
        return
      }
      const stopWatching = watchSpeaking(track, setSpeaking)
      track.addEventListener('ended', reattach)
      detach = () => {
        track.removeEventListener('ended', reattach)
        stopWatching()
      }
    }

    function reattach() {
      detach?.()
      detach = null
      setSpeaking(false)
      attach()
    }

    attach()
    return () => {
      window.clearTimeout(retry)
      detach?.()
      setSpeaking(false)
    }
  }, [enabled, stream])

  return speaking
}
