import { filterActive, getFilterPreset, type FilterPresetId } from './presets'

export type BeautyEngineStatus = 'idle' | 'loading' | 'running' | 'error'

const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'

/** Viền môi ngoài / trong (Face Landmarker 478 điểm) */
const UPPER_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
const UPPER_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
const LOWER_OUTER = [291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61]
const LOWER_INNER = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78]

type FaceLandmarker = {
  detectForVideo: (
    video: HTMLVideoElement,
    ts: number,
  ) => { faceLandmarks?: Array<Array<{ x: number; y: number }>> }
  close?: () => void
}

let faceReady: Promise<FaceLandmarker> | null = null

async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!faceReady) {
    faceReady = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(WASM)
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
      })
    })()
  }
  return faceReady
}

function pathFrom(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<{ x: number; y: number }>,
  indices: number[],
  w: number,
  h: number,
) {
  indices.forEach((idx, i) => {
    const p = landmarks[idx]
    if (!p) return
    const x = p.x * w
    const y = p.y * h
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
}

/**
 * Filter nhẹ.
 * - Mịn da: pixel da (không model)
 * - Môi đỏ: MediaPipe Face Landmarker — chỉ điểm môi, lazy-load
 */
export class BeautyEngine {
  private video = document.createElement('video')
  private canvas = document.createElement('canvas')
  private workCanvas = document.createElement('canvas')
  private lipMask = document.createElement('canvas')
  private lipTint = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private workCtx: CanvasRenderingContext2D
  private lipMaskCtx: CanvasRenderingContext2D
  private lipTintCtx: CanvasRenderingContext2D
  private out: MediaStream | null = null
  private outTrack: MediaStreamTrack | null = null
  private presetId: FilterPresetId = 'none'
  private raf = 0
  private frame = 0
  private running = false
  private face: FaceLandmarker | null = null
  private lastLips: Array<{ x: number; y: number }> | null = null
  private onStatus: ((s: BeautyEngineStatus, err?: string) => void) | null = null
  private onTrack: ((t: MediaStreamTrack | null) => void) | null = null

  constructor(presetId: FilterPresetId = 'none') {
    this.presetId = presetId
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    const workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true })
    const lipMaskCtx = this.lipMask.getContext('2d')
    const lipTintCtx = this.lipTint.getContext('2d')
    if (!ctx || !workCtx || !lipMaskCtx || !lipTintCtx) throw new Error('Canvas 2D không khả dụng')
    this.ctx = ctx
    this.workCtx = workCtx
    this.lipMaskCtx = lipMaskCtx
    this.lipTintCtx = lipTintCtx
    this.video.playsInline = true
    this.video.muted = true
    this.video.autoplay = true
  }

  setStatusHandler(fn: (s: BeautyEngineStatus, err?: string) => void) {
    this.onStatus = fn
  }

  setTrackHandler(fn: (t: MediaStreamTrack | null) => void) {
    this.onTrack = fn
  }

  private setStatus(s: BeautyEngineStatus, err?: string) {
    this.onStatus?.(s, err)
  }

  getOutputTrack() {
    return this.outTrack
  }

  setPreset(id: FilterPresetId) {
    this.presetId = id
  }

  async start(source: MediaStreamTrack): Promise<MediaStreamTrack> {
    await this.stop()
    if (!filterActive(this.presetId)) throw new Error('Chưa chọn filter')

    this.video.srcObject = new MediaStream([source])
    await this.video.play().catch(() => {})

    for (let i = 0; i < 30 && this.video.videoWidth < 2; i++) {
      await new Promise((r) => setTimeout(r, 40))
    }

    const settings = source.getSettings()
    const w = this.video.videoWidth || settings.width || 640
    const h = this.video.videoHeight || settings.height || 480
    this.resize(w, h)

    const preset = getFilterPreset(this.presetId)
    if (preset.mode === 'beauty') {
      this.setStatus('loading')
      try {
        this.face = await getFaceLandmarker()
      } catch (e) {
        this.setStatus('error', e instanceof Error ? e.message : 'Không tải Face Landmarker')
        // Vẫn chạy mịn da nếu model lỗi
        this.face = null
      }
    }

    const fps = Math.min(24, Math.max(15, Math.round(settings.frameRate || 24)))
    this.out = this.canvas.captureStream(fps)
    this.outTrack = this.out.getVideoTracks()[0] ?? null
    if (!this.outTrack) throw new Error('Không tạo được track filter')

    this.running = true
    this.setStatus('running')
    this.onTrack?.(this.outTrack)
    this.loop()
    return this.outTrack
  }

  private resize(w: number, h: number) {
    this.canvas.width = w
    this.canvas.height = h
    this.lipMask.width = w
    this.lipMask.height = h
    this.lipTint.width = w
    this.lipTint.height = h
    this.workCanvas.width = Math.max(160, Math.round(w / 2.5))
    this.workCanvas.height = Math.max(90, Math.round(h / 2.5))
  }

  private loop = () => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    this.frame++
    if (this.video.readyState < 2) return

    if (
      this.video.videoWidth > 0 &&
      (this.video.videoWidth !== this.canvas.width || this.video.videoHeight !== this.canvas.height)
    ) {
      this.resize(this.video.videoWidth, this.video.videoHeight)
    }

    const preset = getFilterPreset(this.presetId)
    if (preset.mode === 'beauty') {
      this.drawNatural(preset.css)
      return
    }

    this.ctx.filter = preset.css === 'none' ? 'none' : preset.css
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height)
    this.ctx.filter = 'none'
  }

  private drawNatural(css: string) {
    const w = this.canvas.width
    const h = this.canvas.height

    this.ctx.filter = css
    this.ctx.drawImage(this.video, 0, 0, w, h)
    this.ctx.filter = 'none'

    this.smoothSkinOnly()

    // Detect môi mỗi 3 frame — giữ landmark cũ giữa các frame (không giật)
    if (this.face && this.frame % 3 === 0) {
      try {
        const res = this.face.detectForVideo(this.video, performance.now())
        const lm = res.faceLandmarks?.[0]
        if (lm?.length) this.lastLips = lm
      } catch {
        /* giữ landmark cũ */
      }
    }

    if (this.lastLips) this.drawLipsFromLandmarks(this.lastLips)
  }

  private isSkin(r: number, g: number, b: number) {
    if (r < 70 || g < 45 || b < 25) return false
    if (r < g || g < b - 8) return false
    const rg = r - g
    const rb = r - b
    if (rg > 42) return false
    if (rb < 12 || rb > 95) return false
    if (rg > 28 && r > 150) return false
    return true
  }

  private smoothSkinOnly() {
    const sw = this.workCanvas.width
    const sh = this.workCanvas.height
    this.workCtx.drawImage(this.canvas, 0, 0, sw, sh)
    const img = this.workCtx.getImageData(0, 0, sw, sh)
    const d = img.data
    const src = new Uint8ClampedArray(d)

    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const i = (y * sw + x) * 4
        const r = src[i]!
        const g = src[i + 1]!
        const b = src[i + 2]!
        if (!this.isSkin(r, g, b)) continue

        let sr = 0
        let sg = 0
        let sb = 0
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const j = ((y + dy) * sw + (x + dx)) * 4
            const rr = src[j]!
            const gg = src[j + 1]!
            const bb = src[j + 2]!
            if (!this.isSkin(rr, gg, bb)) continue
            sr += rr
            sg += gg
            sb += bb
            n++
          }
        }
        if (n < 3) continue
        const mix = 0.62
        d[i] = Math.min(255, r * (1 - mix) + (sr / n) * mix + 4)
        d[i + 1] = Math.min(255, g * (1 - mix) + (sg / n) * mix + 3)
        d[i + 2] = Math.min(255, b * (1 - mix) + (sb / n) * mix + 2)
      }
    }

    this.workCtx.putImageData(img, 0, 0)
    this.ctx.globalAlpha = 0.72
    this.ctx.drawImage(this.workCanvas, 0, 0, this.canvas.width, this.canvas.height)
    this.ctx.globalAlpha = 1
  }

  private drawLipsFromLandmarks(landmarks: Array<{ x: number; y: number }>) {
    const w = this.canvas.width
    const h = this.canvas.height

    // Mask môi (khoét miệng)
    this.lipMaskCtx.clearRect(0, 0, w, h)
    this.lipMaskCtx.fillStyle = '#fff'
    this.lipMaskCtx.beginPath()
    pathFrom(this.lipMaskCtx, landmarks, UPPER_OUTER, w, h)
    this.lipMaskCtx.fill()
    this.lipMaskCtx.beginPath()
    pathFrom(this.lipMaskCtx, landmarks, LOWER_OUTER, w, h)
    this.lipMaskCtx.fill()
    this.lipMaskCtx.globalCompositeOperation = 'destination-out'
    this.lipMaskCtx.beginPath()
    pathFrom(this.lipMaskCtx, landmarks, UPPER_INNER, w, h)
    this.lipMaskCtx.fill()
    this.lipMaskCtx.beginPath()
    pathFrom(this.lipMaskCtx, landmarks, LOWER_INNER, w, h)
    this.lipMaskCtx.fill()
    this.lipMaskCtx.globalCompositeOperation = 'source-over'
    // Mép mềm
    this.lipMaskCtx.filter = 'blur(1.5px)'
    this.lipMaskCtx.drawImage(this.lipMask, 0, 0)
    this.lipMaskCtx.filter = 'none'

    // Tint đỏ tự nhiên: multiply lên da môi thật
    this.lipTintCtx.clearRect(0, 0, w, h)
    this.lipTintCtx.drawImage(this.canvas, 0, 0)
    this.lipTintCtx.globalCompositeOperation = 'multiply'
    this.lipTintCtx.fillStyle = '#c43b55'
    this.lipTintCtx.fillRect(0, 0, w, h)
    this.lipTintCtx.globalCompositeOperation = 'source-atop'
    this.lipTintCtx.fillStyle = 'rgba(196, 59, 85, 0.28)'
    this.lipTintCtx.fillRect(0, 0, w, h)
    this.lipTintCtx.globalCompositeOperation = 'destination-in'
    this.lipTintCtx.drawImage(this.lipMask, 0, 0)
    this.lipTintCtx.globalCompositeOperation = 'source-over'

    this.ctx.globalAlpha = 0.55
    this.ctx.drawImage(this.lipTint, 0, 0)
    this.ctx.globalAlpha = 1
  }

  async stop() {
    this.running = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.outTrack?.stop()
    this.out?.getTracks().forEach((t) => t.stop())
    this.out = null
    this.outTrack = null
    this.video.srcObject = null
    this.lastLips = null
    // Giữ face singleton cache — không close (reuse lần sau)
    this.face = null
    this.onTrack?.(null)
    this.setStatus('idle')
  }
}
