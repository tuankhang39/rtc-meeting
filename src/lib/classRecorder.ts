/** Ghi màn hình máy local (getDisplayMedia) — admin, không upload server. */

export type RecordSource = {
  localStream: MediaStream | null
  remoteStreams: MediaStream[]
}

export type RecorderOptions = {
  roomId: string
  videoBitsPerSecond?: number
  audioBitsPerSecond?: number
}

function collectCallAudioTracks(src: RecordSource): MediaStreamTrack[] {
  const seen = new Set<string>()
  const tracks: MediaStreamTrack[] = []
  const add = (stream: MediaStream | null | undefined) => {
    if (!stream) return
    for (const t of stream.getAudioTracks()) {
      if (t.readyState !== 'live' || seen.has(t.id)) continue
      seen.add(t.id)
      tracks.push(t)
    }
  }
  add(src.localStream)
  for (const s of src.remoteStreams) add(s)
  return tracks
}

function pickMimeType(): string {
  const types = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return 'video/webm'
}

export async function acquireDisplayCapture(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Trình duyệt không hỗ trợ ghi màn hình. Dùng Chrome/Edge.')
  }
  return navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 24, max: 30 },
    },
    audio: true,
  })
}

function mixAudioTracks(tracks: MediaStreamTrack[]): { stream: MediaStream; ctx: AudioContext } | null {
  const live = tracks.filter((t) => t.readyState === 'live')
  if (!live.length) return null
  const ctx = new AudioContext()
  const dest = ctx.createMediaStreamDestination()
  for (const t of live) {
    try {
      ctx.createMediaStreamSource(new MediaStream([t])).connect(dest)
    } catch {
      /* track không mix được */
    }
  }
  if (!dest.stream.getAudioTracks().length) {
    void ctx.close()
    return null
  }
  return { stream: dest.stream, ctx }
}

async function buildScreenRecordStream(src: RecordSource): Promise<{
  stream: MediaStream
  capture: MediaStream
  audioCtx: AudioContext | null
}> {
  const capture = await acquireDisplayCapture()
  const out = new MediaStream()

  const video = capture.getVideoTracks()[0]
  if (!video) {
    capture.getTracks().forEach((t) => t.stop())
    throw new Error('Không lấy được video màn hình')
  }
  out.addTrack(video)

  const audioInputs = [...capture.getAudioTracks(), ...collectCallAudioTracks(src)]
  const mixed = mixAudioTracks(audioInputs)
  if (mixed) {
    const a = mixed.stream.getAudioTracks()[0]
    if (a) out.addTrack(a)
  } else {
    for (const a of collectCallAudioTracks(src)) out.addTrack(a)
  }

  return { stream: out, capture, audioCtx: mixed?.ctx ?? null }
}

export class ClassRecorder {
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private startedAt = 0
  private roomId: string
  private videoBps: number
  private audioBps: number
  private captureStream: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private onCaptureEnded: (() => void) | null = null

  constructor(opts: RecorderOptions) {
    this.roomId = opts.roomId
    this.videoBps = opts.videoBitsPerSecond ?? 1_500_000
    this.audioBps = opts.audioBitsPerSecond ?? 128_000
  }

  get active() {
    return this.recorder?.state === 'recording'
  }

  getStartedAt() {
    return this.startedAt
  }

  setOnCaptureEnded(cb: (() => void) | null) {
    this.onCaptureEnded = cb
  }

  async start(src: RecordSource): Promise<void> {
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Trình duyệt không hỗ trợ ghi hình')
    }
    if (this.active) return

    const { stream, capture, audioCtx } = await buildScreenRecordStream(src)
    this.captureStream = capture
    this.audioCtx = audioCtx

    const video = stream.getVideoTracks()[0]
    if (video) {
      video.addEventListener('ended', () => {
        void this.stop().then((blob) => {
          if (blob && blob.size > 0) this.download(blob)
          this.onCaptureEnded?.()
        })
      })
    }

    this.chunks = []
    const mimeType = pickMimeType()
    this.recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: stream.getVideoTracks().length ? this.videoBps : undefined,
      audioBitsPerSecond: stream.getAudioTracks().length ? this.audioBps : undefined,
    })

    this.recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) this.chunks.push(ev.data)
    }

    this.startedAt = Date.now()
    this.recorder.start(1000)
  }

  private releaseCapture() {
    this.captureStream?.getTracks().forEach((t) => t.stop())
    this.captureStream = null
    if (this.audioCtx) {
      void this.audioCtx.close()
      this.audioCtx = null
    }
  }

  async stop(): Promise<Blob | null> {
    const rec = this.recorder
    if (!rec || rec.state === 'inactive') {
      this.recorder = null
      this.releaseCapture()
      const blob = this.chunks.length ? new Blob(this.chunks, { type: pickMimeType() }) : null
      this.chunks = []
      this.startedAt = 0
      return blob
    }

    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = this.chunks.length ? new Blob(this.chunks, { type: pickMimeType() }) : null
        this.chunks = []
        this.recorder = null
        this.startedAt = 0
        this.releaseCapture()
        resolve(blob)
      }
      try {
        rec.stop()
      } catch {
        this.releaseCapture()
        resolve(null)
      }
    })
  }

  download(blob: Blob) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `xiaoxin-man-${this.roomId}-${stamp}.webm`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

export function formatRecordElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}
