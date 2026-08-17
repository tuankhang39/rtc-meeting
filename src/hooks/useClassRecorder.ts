import { useCallback, useEffect, useRef, useState } from 'react'
import { ClassRecorder, formatRecordElapsed } from '../lib/classRecorder'

type RemoteLike = {
  stream: MediaStream | null
}

type Options = {
  enabled: boolean
  roomId: string
  localStream: MediaStream | null
  remotes: RemoteLike[]
  onCaptureEnded?: () => void
}

export function useClassRecorder({ enabled, roomId, localStream, remotes, onCaptureEnded }: Options) {
  const recorderRef = useRef<ClassRecorder | null>(null)
  const onEndedRef = useRef(onCaptureEnded)
  onEndedRef.current = onCaptureEnded

  const [recording, setRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!recorderRef.current) recorderRef.current = new ClassRecorder({ roomId })
    recorderRef.current.setOnCaptureEnded(() => {
      setRecording(false)
      onEndedRef.current?.()
    })
  }, [roomId])

  useEffect(() => {
    if (!recording) {
      setElapsedMs(0)
      return
    }
    const tick = window.setInterval(() => {
      const started = recorderRef.current?.getStartedAt() ?? 0
      if (started) setElapsedMs(Date.now() - started)
    }, 500)
    return () => window.clearInterval(tick)
  }, [recording])

  const buildSource = useCallback(() => {
    const remoteStreams: MediaStream[] = []
    for (const r of remotes) {
      if (r.stream) remoteStreams.push(r.stream)
    }
    return { localStream, remoteStreams }
  }, [localStream, remotes])

  const startRecording = useCallback(async () => {
    if (!enabled) throw new Error('Chỉ admin mới được ghi hình')
    const rec = recorderRef.current ?? new ClassRecorder({ roomId })
    recorderRef.current = rec
    rec.setOnCaptureEnded(() => {
      setRecording(false)
      onEndedRef.current?.()
    })
    await rec.start(buildSource())
    setRecording(true)
  }, [buildSource, enabled, roomId])

  const stopRecording = useCallback(async () => {
    const rec = recorderRef.current
    if (!rec?.active) {
      setRecording(false)
      return null
    }
    const blob = await rec.stop()
    setRecording(false)
    if (blob && blob.size > 0) rec.download(blob)
    return blob
  }, [])

  useEffect(() => {
    if (!enabled && recording) {
      void stopRecording()
    }
  }, [enabled, recording, stopRecording])

  return {
    recording,
    elapsedLabel: formatRecordElapsed(elapsedMs),
    canRecord:
      enabled &&
      typeof MediaRecorder !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getDisplayMedia),
    startRecording,
    stopRecording,
  }
}
