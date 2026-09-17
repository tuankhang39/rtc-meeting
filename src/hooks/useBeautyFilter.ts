import { useCallback, useEffect, useRef, useState } from 'react'
import { BeautyEngine, type BeautyEngineStatus } from '../lib/beauty/engine'
import { DEFAULT_LIP, type LipOptions } from '../lib/beauty/lipColors'
import { DEFAULT_SKIN, type SkinOptions } from '../lib/beauty/skin'
import { filterActive, type FilterPresetId } from '../lib/beauty/presets'

type Args = {
  sourceTrack: MediaStreamTrack | null
  camOn: boolean
  onOutputTrack: (track: MediaStreamTrack | null) => void
}

export function useBeautyFilter({ sourceTrack, camOn, onOutputTrack }: Args) {
  const [presetId, setPresetId] = useState<FilterPresetId>('none')
  const [lip, setLip] = useState<LipOptions>(() => ({ ...DEFAULT_LIP }))
  const [skin, setSkin] = useState<SkinOptions>(() => ({ ...DEFAULT_SKIN }))
  const [status, setStatus] = useState<BeautyEngineStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const engineRef = useRef<BeautyEngine | null>(null)
  const presetRef = useRef(presetId)
  presetRef.current = presetId
  const lipRef = useRef(lip)
  lipRef.current = lip
  const skinRef = useRef(skin)
  skinRef.current = skin
  const onOutputRef = useRef(onOutputTrack)
  onOutputRef.current = onOutputTrack
  const sourceRef = useRef(sourceTrack)
  sourceRef.current = sourceTrack
  const camOnRef = useRef(camOn)
  camOnRef.current = camOn
  const chainRef = useRef(Promise.resolve())
  const unmountedRef = useRef(false)

  const reset = useCallback(() => {
    setPresetId('none')
    setLip({ ...DEFAULT_LIP })
    setSkin({ ...DEFAULT_SKIN })
  }, [])

  const setLipOptions = useCallback((patch: Partial<LipOptions>) => {
    setLip((prev) => {
      const next = { ...prev, ...patch }
      engineRef.current?.setLipOptions(next)
      return next
    })
  }, [])

  const setSkinOptions = useCallback((patch: Partial<SkinOptions>) => {
    setSkin((prev) => {
      const next = { ...prev, ...patch }
      engineRef.current?.setSkinOptions(next)
      return next
    })
  }, [])

  const syncEngine = useCallback(() => {
    chainRef.current = chainRef.current.then(async () => {
      if (unmountedRef.current) return

      const id = presetRef.current
      const src = sourceRef.current
      const cam = camOnRef.current

      if (!cam || !src || src.readyState !== 'live' || !filterActive(id)) {
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
        let eng = engineRef.current
        if (!eng) {
          eng = new BeautyEngine(id, lipRef.current, skinRef.current)
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
          eng.setPreset(id)
          eng.setLipOptions(lipRef.current)
          eng.setSkinOptions(skinRef.current)
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
  }, [sourceTrack, camOn, presetId, syncEngine])

  useEffect(() => {
    engineRef.current?.setLipOptions(lip)
  }, [lip])

  useEffect(() => {
    engineRef.current?.setSkinOptions(skin)
  }, [skin])

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      const eng = engineRef.current
      engineRef.current = null
      void eng?.stop()
      onOutputRef.current(null)
    }
  }, [])

  return {
    presetId,
    setPresetId,
    lip,
    setLipOptions,
    skin,
    setSkinOptions,
    reset,
    status,
    error,
    active: filterActive(presetId),
  }
}
