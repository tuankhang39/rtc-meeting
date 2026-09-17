import type { BeautySettings } from './types'
import { beautyActive, beautyNeedsAi } from './types'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const SEG_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

const OUTER_LIP = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]

type FaceLandmarker = Awaited<ReturnType<typeof loadFace>>
type ImageSegmenter = Awaited<ReturnType<typeof loadSeg>>

let faceReady: Promise<FaceLandmarker> | null = null
let segReady: Promise<ImageSegmenter> | null = null

async function loadVision() {
  const { FilesetResolver } = await import('@mediapipe/tasks-vision')
  return FilesetResolver.forVisionTasks(WASM)
}

async function loadFace() {
  const { FaceLandmarker } = await import('@mediapipe/tasks-vision')
  const vision = await loadVision()
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
  })
}

async function loadSeg() {
  const { ImageSegmenter } = await import('@mediapipe/tasks-vision')
  const vision = await loadVision()
  return ImageSegmenter.createFromOptions(vision, {
    baseOptions: { modelAssetPath: SEG_MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  })
}

function getFace() {
  if (!faceReady) faceReady = loadFace()
  return faceReady
}

function getSeg() {
  if (!segReady) segReady = loadSeg()
  return segReady
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const v = Number.parseInt(n, 16)
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
}

function isSkin(r: number, g: number, b: number) {
  return r > 60 && g > 40 && b > 20 && r > g && r - b > 15 && g > b - 20 && r - g < 90
}

export type BeautyEngineStatus = 'idle' | 'loading' | 'running' | 'error'

export class BeautyEngine {
  private video = document.createElement('video')
  private canvas = document.createElement('canvas')
  private blurCanvas = document.createElement('canvas')
  private workCanvas = document.createElement('canvas')
  private skinCanvas = document.createElement('canvas')
  private personCanvas = document.createElement('canvas')
  private maskCanvas = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private blurCtx: CanvasRenderingContext2D
  private workCtx: CanvasRenderingContext2D
  private skinCtx: CanvasRenderingContext2D
  private personCtx: CanvasRenderingContext2D
  private maskCtx: CanvasRenderingContext2D
  private out: MediaStream | null = null
  private outTrack: MediaStreamTrack | null = null
  private settings: BeautySettings
  private raf = 0
  private running = false
  private frame = 0
  private face: FaceLandmarker | null = null
  private seg: ImageSegmenter | null = null
  private personIsNonZero = true
  private onStatus: ((s: BeautyEngineStatus, err?: string) => void) | null = null

  constructor(settings: BeautySettings) {
    this.settings = { ...settings }
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    const blurCtx = this.blurCanvas.getContext('2d')
    const workCtx = this.workCanvas.getContext('2d')
    const skinCtx = this.skinCanvas.getContext('2d', { willReadFrequently: true })
    const personCtx = this.personCanvas.getContext('2d')
    const maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx || !blurCtx || !workCtx || !skinCtx || !personCtx || !maskCtx) {
      throw new Error('Canvas 2D không khả dụng')
    }
    this.ctx = ctx
    this.blurCtx = blurCtx
    this.workCtx = workCtx
    this.skinCtx = skinCtx
    this.personCtx = personCtx
    this.maskCtx = maskCtx
    this.video.playsInline = true
    this.video.muted = true
    this.video.autoplay = true
  }

  setStatusHandler(fn: (s: BeautyEngineStatus, err?: string) => void) {
    this.onStatus = fn
  }

  private setStatus(s: BeautyEngineStatus, err?: string) {
    this.onStatus?.(s, err)
  }

  getOutputTrack() {
    return this.outTrack
  }

  updateSettings(next: BeautySettings) {
    this.settings = { ...next }
  }

  async start(source: MediaStreamTrack): Promise<MediaStreamTrack> {
    await this.stop()
    if (!beautyActive(this.settings)) throw new Error('Chưa bật hiệu ứng nào')

    this.video.srcObject = new MediaStream([source])
    await this.video.play().catch(() => {})

    for (let i = 0; i < 30 && !this.video.videoWidth; i++) {
      await new Promise((r) => setTimeout(r, 50))
    }

    const w = Math.min(640, source.getSettings().width || this.video.videoWidth || 640)
    const h = Math.min(360, source.getSettings().height || this.video.videoHeight || 360)
    for (const c of [this.canvas, this.blurCanvas, this.workCanvas, this.personCanvas]) {
      c.width = w
      c.height = h
    }
    this.skinCanvas.width = Math.max(160, Math.round(w / 2))
    this.skinCanvas.height = Math.max(90, Math.round(h / 2))

    if (beautyNeedsAi(this.settings)) {
      this.setStatus('loading')
      try {
        if (this.settings.lipstick > 0) this.face = await getFace()
        if (this.settings.blurBg > 0) this.seg = await getSeg()
      } catch (e) {
        this.setStatus('error', e instanceof Error ? e.message : 'Không tải được model AI')
        throw e
      }
    }

    this.out = this.canvas.captureStream(18)
    this.outTrack = this.out.getVideoTracks()[0] ?? null
    if (!this.outTrack) throw new Error('Không tạo được track filter')

    this.running = true
    this.setStatus('running')
    this.loop()
    return this.outTrack
  }

  async ensureAiFor(settings: BeautySettings) {
    this.settings = { ...settings }
    if (!beautyNeedsAi(settings)) return
    this.setStatus('loading')
    try {
      if (settings.lipstick > 0 && !this.face) this.face = await getFace()
      if (settings.blurBg > 0 && !this.seg) this.seg = await getSeg()
      if (this.running) this.setStatus('running')
      else this.setStatus('idle')
    } catch (e) {
      this.setStatus('error', e instanceof Error ? e.message : 'Không tải được model AI')
      throw e
    }
  }

  private loop = () => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    this.frame++
    if (this.video.readyState < 2) return

    const w = this.canvas.width
    const h = this.canvas.height
    const { smooth, whiten, lipstick, lipstickColor, blurBg } = this.settings

    this.workCtx.drawImage(this.video, 0, 0, w, h)

    if (blurBg > 0 && this.seg) this.applyBlurBg(blurBg / 100)
    else this.ctx.drawImage(this.workCanvas, 0, 0)

    if ((smooth > 0 || whiten > 0) && this.frame % 2 === 0) {
      this.applySkin(smooth / 100, whiten / 100)
    }

    if (lipstick > 0 && this.face && this.frame % 2 === 0) {
      try {
        const res = this.face.detectForVideo(this.video, performance.now())
        const lm = res.faceLandmarks?.[0]
        if (lm) this.drawLips(lm, lipstick / 100, lipstickColor)
      } catch {
        /* ignore */
      }
    }
  }

  private applyBlurBg(amount: number) {
    const w = this.canvas.width
    const h = this.canvas.height

    if (this.frame % 3 === 0) {
      try {
        const result = this.seg!.segmentForVideo(this.video, performance.now())
        const mask = result.categoryMask
        if (mask) {
          const mw = mask.width
          const mh = mask.height
          const data = mask.getAsUint8Array()
          if (this.maskCanvas.width !== mw || this.maskCanvas.height !== mh) {
            this.maskCanvas.width = mw
            this.maskCanvas.height = mh
          }
          const mid = Math.floor(mh / 2) * mw + Math.floor(mw / 2)
          this.personIsNonZero = (data[mid] ?? 0) > 0

          const img = this.maskCtx.createImageData(mw, mh)
          for (let i = 0; i < data.length; i++) {
            const person = this.personIsNonZero ? data[i]! > 0 : data[i]! === 0
            const v = person ? 255 : 0
            const o = i * 4
            img.data[o] = v
            img.data[o + 1] = v
            img.data[o + 2] = v
            img.data[o + 3] = 255
          }
          this.maskCtx.putImageData(img, 0, 0)
          mask.close()
        }
      } catch {
        /* ignore */
      }
    }

    const px = Math.max(6, Math.round(10 + amount * 18))
    this.blurCtx.filter = `blur(${px}px)`
    this.blurCtx.drawImage(this.workCanvas, 0, 0, w, h)
    this.blurCtx.filter = 'none'

    this.personCtx.clearRect(0, 0, w, h)
    this.personCtx.drawImage(this.workCanvas, 0, 0, w, h)
    this.personCtx.globalCompositeOperation = 'destination-in'
    this.personCtx.drawImage(this.maskCanvas, 0, 0, w, h)
    this.personCtx.globalCompositeOperation = 'source-over'

    this.ctx.clearRect(0, 0, w, h)
    this.ctx.drawImage(this.blurCanvas, 0, 0, w, h)
    this.ctx.drawImage(this.personCanvas, 0, 0, w, h)
  }

  private applySkin(smoothAmt: number, whitenAmt: number) {
    const sw = this.skinCanvas.width
    const sh = this.skinCanvas.height
    this.skinCtx.drawImage(this.canvas, 0, 0, sw, sh)
    const img = this.skinCtx.getImageData(0, 0, sw, sh)
    const d = img.data
    const copy = new Uint8ClampedArray(d)

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4
        let r = copy[i]!
        let g = copy[i + 1]!
        let b = copy[i + 2]!
        if (!isSkin(r, g, b)) continue

        if (smoothAmt > 0) {
          let sr = 0
          let sg = 0
          let sb = 0
          let n = 0
          for (let dy = -1; dy <= 1; dy++) {
            const yy = y + dy
            if (yy < 0 || yy >= sh) continue
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx
              if (xx < 0 || xx >= sw) continue
              const j = (yy * sw + xx) * 4
              const rr = copy[j]!
              const gg = copy[j + 1]!
              const bb = copy[j + 2]!
              if (!isSkin(rr, gg, bb)) continue
              sr += rr
              sg += gg
              sb += bb
              n++
            }
          }
          if (n > 0) {
            const mix = 0.4 + smoothAmt * 0.5
            r = r * (1 - mix) + (sr / n) * mix
            g = g * (1 - mix) + (sg / n) * mix
            b = b * (1 - mix) + (sb / n) * mix
          }
        }

        if (whitenAmt > 0) {
          const lift = 10 + whitenAmt * 42
          r = Math.min(255, r + lift * 0.95)
          g = Math.min(255, g + lift * 0.85)
          b = Math.min(255, b + lift * 0.72)
          const gray = 0.299 * r + 0.587 * g + 0.114 * b
          const desat = whitenAmt * 0.22
          r = r * (1 - desat) + gray * desat
          g = g * (1 - desat) + gray * desat
          b = b * (1 - desat) + gray * desat
        }

        d[i] = r
        d[i + 1] = g
        d[i + 2] = b
      }
    }
    this.skinCtx.putImageData(img, 0, 0)
    this.ctx.globalAlpha = 0.55 + Math.max(smoothAmt, whitenAmt) * 0.35
    this.ctx.drawImage(this.skinCanvas, 0, 0, this.canvas.width, this.canvas.height)
    this.ctx.globalAlpha = 1
  }

  private drawLips(
    landmarks: Array<{ x: number; y: number }>,
    amount: number,
    color: string,
  ) {
    const w = this.canvas.width
    const h = this.canvas.height
    const { r, g, b } = hexToRgb(color)
    this.ctx.save()
    this.ctx.beginPath()
    OUTER_LIP.forEach((idx, i) => {
      const p = landmarks[idx]
      if (!p) return
      const x = p.x * w
      const y = p.y * h
      if (i === 0) this.ctx.moveTo(x, y)
      else this.ctx.lineTo(x, y)
    })
    this.ctx.closePath()
    this.ctx.fillStyle = `rgba(${r},${g},${b},${0.18 + amount * 0.55})`
    this.ctx.fill()
    this.ctx.restore()
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
    this.setStatus('idle')
  }
}
