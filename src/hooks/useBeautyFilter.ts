import { useCallback, useEffect, useRef, useState } from 'react'
import { BeautyEngine, type BeautyEngineStatus } from '../lib/beauty/engine'
import {
  beautyActive,
  beautyNeedsAi,
  DEFAULT_BEAUTY,
  type BeautySettings,
} from '../lib/beauty/types'

type Args = {
  /** Track cam gốc (getUserMedia) */
  sourceTrack: MediaStreamTrack | null
  /** Cam đang bật */
  camOn: boolean
  /** Nhận track đã filter để publish (null = dùng cam gốc) */
  onOutputTrack: (track: MediaStreamTrack | null) => void
}

export function useBeautyFilter({ sourceTrack, camOn, onOutputTrack }: Args) {
  const [settings, setSettingsState] = useState<BeautySettings>(DEFAULT_BEAUTY)
  const [status, setStatus] = useState<BeautyEngineStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const engineRef = useRef<BeautyEngine | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const onOutputRef = useRef(onOutputTrack)
  onOutputRef.current = onOutputTrack

  const setSettings = useCallback((patch: Partial<BeautySettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setSettingsState(DEFAULT_BEAUTY)
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const s = settingsRef.current
      const src = sourceTrack
      const engine = engineRef.current

      if (!camOn || !src || src.readyState !== 'live' || !beautyActive(s)) {
        if (engine) {
          await engine.stop()
          engineRef.current = null
        }
        if (!cancelled) {
          setStatus('idle')
          setError(null)
          onOutputRef.current(null)
        }
        return
      }

      try {
        if (beautyNeedsAi(s)) {
          if (!cancelled) setStatus('loading')
        }
        let eng = engineRef.current
        if (!eng) {
          eng = new BeautyEngine(s)
          eng.setStatusHandler((st, err) => {
            if (cancelled) return
            setStatus(st)
            if (err) setError(err)
          })
          engineRef.current = eng
          const out = await eng.start(src)
          if (cancelled) {
            await eng.stop()
            return
          }
          onOutputRef.current(out)
        } else {
          await eng.ensureAiFor(s)
          eng.updateSettings(s)
          if (!eng.getOutputTrack()) {
            const out = await eng.start(src)
            if (!cancelled) onOutputRef.current(out)
          }
        }
        if (!cancelled) {
          setError(null)
          setStatus('running')
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Lỗi filter')
        setStatus('error')
        onOutputRef.current(null)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [settings, sourceTrack, camOn])

  useEffect(() => {
    return () => {
      void engineRef.current?.stop()
      engineRef.current = null
      onOutputRef.current(null)
    }
  }, [])

  return {
    settings,
    setSettings,
    reset,
    status,
    error,
    active: beautyActive(settings),
  }
}
