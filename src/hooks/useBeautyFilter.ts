import { useCallback, useEffect, useRef, useState } from 'react'
import { BeautyEngine, type BeautyEngineStatus } from '../lib/beauty/engine'
import {
  beautyActive,
  beautyNeedsAi,
  DEFAULT_BEAUTY,
  type BeautySettings,
} from '../lib/beauty/types'

type Args = {
  sourceTrack: MediaStreamTrack | null
  camOn: boolean
  onOutputTrack: (track: MediaStreamTrack | null) => void
}

/**
 * Lifecycle ổn định: queue tuần tự + debounce slider,
 * không stop engine khi chỉ đổi mức filter.
 */
export function useBeautyFilter({ sourceTrack, camOn, onOutputTrack }: Args) {
  const [settings, setSettingsState] = useState<BeautySettings>(DEFAULT_BEAUTY)
  const [status, setStatus] = useState<BeautyEngineStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const engineRef = useRef<BeautyEngine | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const onOutputRef = useRef(onOutputTrack)
  onOutputRef.current = onOutputTrack
  const sourceRef = useRef(sourceTrack)
  sourceRef.current = sourceTrack
  const camOnRef = useRef(camOn)
  camOnRef.current = camOn
  const debounceRef = useRef(0)
  const chainRef = useRef(Promise.resolve())
  const unmountedRef = useRef(false)

  const setSettings = useCallback((patch: Partial<BeautySettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setSettingsState(DEFAULT_BEAUTY)
  }, [])

  const syncEngine = useCallback(() => {
    chainRef.current = chainRef.current.then(async () => {
      if (unmountedRef.current) return

      const s = settingsRef.current
      const src = sourceRef.current
      const cam = camOnRef.current

      if (!cam || !src || src.readyState !== 'live' || !beautyActive(s)) {
        const eng = engineRef.current
        engineRef.current = null
        if (eng) await eng.stop()
        if (!unmountedRef.current) {
          onOutputRef.current(null)
          setStatus('idle')
          setError(null)
        }
        return
      }

      try {
        if (beautyNeedsAi(s)) setStatus('loading')

        let eng = engineRef.current
        if (!eng) {
          eng = new BeautyEngine(s)
          eng.setStatusHandler((st, err) => {
            if (unmountedRef.current) return
            setStatus(st)
            if (err) setError(err)
          })
          eng.setTrackHandler((track) => {
            if (unmountedRef.current) return
            onOutputRef.current(track)
          })
          engineRef.current = eng
          const out = await eng.start(src)
          if (unmountedRef.current) return
          onOutputRef.current(out)
        } else {
          await eng.ensureAiFor(s)
          eng.updateSettings(s)
          let out = eng.getOutputTrack()
          if (!out || out.readyState !== 'live') {
            out = await eng.start(src)
          }
          if (unmountedRef.current) return
          if (out) onOutputRef.current(out)
        }

        if (!unmountedRef.current) {
          setError(null)
          setStatus('running')
        }
      } catch (e) {
        if (unmountedRef.current) return
        setError(e instanceof Error ? e.message : 'Lỗi filter')
        setStatus('error')
        const eng = engineRef.current
        engineRef.current = null
        if (eng) await eng.stop()
        onOutputRef.current(null)
      }
    })
  }, [])

  useEffect(() => {
    void syncEngine()
  }, [sourceTrack, camOn, syncEngine])

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => syncEngine(), 100)
    return () => window.clearTimeout(debounceRef.current)
  }, [settings, syncEngine])

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      window.clearTimeout(debounceRef.current)
      const eng = engineRef.current
      engineRef.current = null
      void eng?.stop()
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
