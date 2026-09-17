import { filterActive, getFilterPreset, type FilterPresetId } from './presets'
import { DEFAULT_LIP, hexToRgb, type LipOptions } from './lipColors'
import { DEFAULT_SKIN, type SkinOptions } from './skin'
import { DEFAULT_BROW, type BrowOptions } from './brows'

export type BeautyEngineStatus = 'idle' | 'loading' | 'running' | 'error'

const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'

/** Viền môi ngoài / trong (Face Landmarker 478 điểm) */
const UPPER_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
const UPPER_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
const LOWER_OUTER = [291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61]
const LOWER_INNER = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78]

/** Viền mặt + mắt (khoét mắt để giữ nét) */
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]
const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]

/** Chân mày: upper outer→inner + lower outer→inner */
const RIGHT_BROW_UPPER = [46, 53, 52, 65, 55]
const RIGHT_BROW_LOWER = [70, 63, 105, 66, 107]
const LEFT_BROW_UPPER = [276, 283, 282, 295, 285]
const LEFT_BROW_LOWER = [300, 293, 334, 296, 336]

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

/** Polygon chân mày có giãn dày theo pháp tuyến gần đúng */
function browExpandedPath(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<{ x: number; y: number }>,
  upper: number[],
  lower: number[],
  w: number,
  h: number,
  expandPx: number,
) {
  const up = upper
    .map((i) => landmarks[i])
    .filter(Boolean)
    .map((p) => ({ x: p!.x * w, y: p!.y * h }))
  const lo = lower
    .map((i) => landmarks[i])
    .filter(Boolean)
    .map((p) => ({ x: p!.x * w, y: p!.y * h }))
  if (up.length < 2 || lo.length < 2) return

  const midY = (up.reduce((s, p) => s + p.y, 0) / up.length + lo.reduce((s, p) => s + p.y, 0) / lo.length) / 2
  const expandUp = up.map((p) => ({
    x: p.x,
    y: p.y - expandPx * (p.y <= midY + 2 ? 1 : 0.35),
  }))
  const expandLo = lo.map((p) => ({
    x: p.x,
    y: p.y + expandPx * (p.y >= midY - 2 ? 1 : 0.35),
  }))

  ctx.beginPath()
  expandUp.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  for (let i = expandLo.length - 1; i >= 0; i--) {
    const p = expandLo[i]!
    ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
}

/**
 * Filter nhẹ.
 * - Mịn / sáng / môi / chân mày: cùng Face Landmarker (không thêm model)
 */
export class BeautyEngine {
  private video = document.createElement('video')
  private canvas = document.createElement('canvas')
  private workCanvas = document.createElement('canvas')
  private faceMask = document.createElement('canvas')
  private lipMask = document.createElement('canvas')
  private lipTint = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private workCtx: CanvasRenderingContext2D
  private faceMaskCtx: CanvasRenderingContext2D
  private lipMaskCtx: CanvasRenderingContext2D
  private lipTintCtx: CanvasRenderingContext2D
  private out: MediaStream | null = null
  private outTrack: MediaStreamTrack | null = null
  private presetId: FilterPresetId = 'none'
  private lip: LipOptions = { ...DEFAULT_LIP }
  private skin: SkinOptions = { ...DEFAULT_SKIN }
  private brow: BrowOptions = { ...DEFAULT_BROW }
  private raf = 0
  private frame = 0
  private running = false
  private face: FaceLandmarker | null = null
  private smoothLips: Array<{ x: number; y: number }> | null = null
  private landmarkTarget: Array<{ x: number; y: number }> | null = null
  private onStatus: ((s: BeautyEngineStatus, err?: string) => void) | null = null
  private onTrack: ((t: MediaStreamTrack | null) => void) | null = null

  constructor(
    presetId: FilterPresetId = 'none',
    lip: LipOptions = DEFAULT_LIP,
    skin: SkinOptions = DEFAULT_SKIN,
    brow: BrowOptions = DEFAULT_BROW,
  ) {
    this.presetId = presetId
    this.lip = { ...lip }
    this.skin = { ...skin }
    this.brow = { ...brow }
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    const workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true })
    const faceMaskCtx = this.faceMask.getContext('2d')
    const lipMaskCtx = this.lipMask.getContext('2d')
    const lipTintCtx = this.lipTint.getContext('2d')
    if (!ctx || !workCtx || !faceMaskCtx || !lipMaskCtx || !lipTintCtx) {
      throw new Error('Canvas 2D không khả dụng')
    }
    this.ctx = ctx
    this.workCtx = workCtx
    this.faceMaskCtx = faceMaskCtx
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

  setLipOptions(lip: LipOptions) {
    this.lip = { ...lip }
  }

  setSkinOptions(skin: SkinOptions) {
    this.skin = { ...skin }
  }

  setBrowOptions(brow: BrowOptions) {
    this.brow = { ...brow }
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

    // Beauty nặng hơn → 18fps; CSS filter giữ cao hơn
    const wantFps = preset.mode === 'beauty' ? 18 : 24
    const fps = Math.min(wantFps, Math.max(15, Math.round(settings.frameRate || wantFps)))
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
    this.faceMask.width = w
    this.faceMask.height = h
    this.lipMask.width = w
    this.lipMask.height = h
    this.lipTint.width = w
    this.lipTint.height = h
    this.workCanvas.width = Math.max(120, Math.round(w / 3.2))
    this.workCanvas.height = Math.max(68, Math.round(h / 3.2))
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

  private drawNatural(_css: string) {
    const w = this.canvas.width
    const h = this.canvas.height

    this.ctx.filter = 'none'
    this.ctx.drawImage(this.video, 0, 0, w, h)

    // Detect mỗi 2 frame; frame còn lại lerp bám landmark
    if (this.face && this.frame % 2 === 0) {
      try {
        const res = this.face.detectForVideo(this.video, performance.now())
        const lm = res.faceLandmarks?.[0]
        if (lm?.length) this.setLandmarkTarget(lm)
      } catch {
        /* giữ target trước */
      }
    }
    this.coastLandmarks()

    if (this.smoothLips) {
      const needFaceFx =
        this.skin.brighten >= 2 || this.skin.smooth >= 2
      if (needFaceFx) this.buildFaceMask(this.smoothLips)
      this.brightenFace()
      // Pixel smooth (nặng) mỗi 2 frame; frame xen kẽ dùng blur nhẹ trong mask
      if (this.frame % 2 === 0) this.smoothFaceSkin()
      else this.softSmoothFace()
      this.drawBrowsFromLandmarks(this.smoothLips)
      this.drawLipsFromLandmarks(this.smoothLips)
      return
    }

    this.smoothSkinFallback()
  }

  private setLandmarkTarget(next: Array<{ x: number; y: number }>) {
    if (!this.landmarkTarget || this.landmarkTarget.length !== next.length) {
      this.landmarkTarget = next.map((p) => ({ x: p.x, y: p.y }))
      this.smoothLips = next.map((p) => ({ x: p.x, y: p.y }))
      return
    }
    for (let i = 0; i < next.length; i++) {
      const p = next[i]!
      const t = this.landmarkTarget[i]!
      t.x = p.x
      t.y = p.y
    }
  }

  /** Mỗi frame tiến dần về landmark mới — tránh lệch khi detect cách frame */
  private coastLandmarks() {
    if (!this.landmarkTarget || !this.smoothLips) return
    if (this.smoothLips.length !== this.landmarkTarget.length) {
      this.smoothLips = this.landmarkTarget.map((p) => ({ x: p.x, y: p.y }))
      return
    }
    const a = 0.58
    for (let i = 0; i < this.landmarkTarget.length; i++) {
      const t = this.landmarkTarget[i]!
      const s = this.smoothLips[i]!
      s.x = s.x * (1 - a) + t.x * a
      s.y = s.y * (1 - a) + t.y * a
    }
  }

  private buildFaceMask(landmarks: Array<{ x: number; y: number }>) {
    const w = this.faceMask.width
    const h = this.faceMask.height
    this.faceMaskCtx.clearRect(0, 0, w, h)
    this.faceMaskCtx.fillStyle = '#fff'
    this.faceMaskCtx.beginPath()
    pathFrom(this.faceMaskCtx, landmarks, FACE_OVAL, w, h)
    this.faceMaskCtx.fill()

    this.faceMaskCtx.globalCompositeOperation = 'destination-out'
    this.faceMaskCtx.beginPath()
    pathFrom(this.faceMaskCtx, landmarks, LEFT_EYE, w, h)
    this.faceMaskCtx.fill()
    this.faceMaskCtx.beginPath()
    pathFrom(this.faceMaskCtx, landmarks, RIGHT_EYE, w, h)
    this.faceMaskCtx.fill()
    this.faceMaskCtx.globalCompositeOperation = 'source-over'

    this.faceMaskCtx.filter = 'blur(8px)'
    this.faceMaskCtx.drawImage(this.faceMask, 0, 0)
    this.faceMaskCtx.filter = 'none'
  }

  private brightenFace() {
    const bright = Math.max(0, Math.min(100, this.skin.brighten)) / 100
    if (bright < 0.02) return

    const w = this.canvas.width
    const h = this.canvas.height
    const brightness = 1 + bright * 0.22
    const contrast = 1 - bright * 0.03
    const saturate = 1 + bright * 0.05

    this.lipTintCtx.clearRect(0, 0, w, h)
    this.lipTintCtx.filter = `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturate.toFixed(3)})`
    this.lipTintCtx.drawImage(this.canvas, 0, 0)
    this.lipTintCtx.filter = 'none'
    this.lipTintCtx.globalCompositeOperation = 'destination-in'
    this.lipTintCtx.drawImage(this.faceMask, 0, 0)
    this.lipTintCtx.globalCompositeOperation = 'source-over'

    this.ctx.globalAlpha = 0.55 + bright * 0.4
    this.ctx.drawImage(this.lipTint, 0, 0)
    this.ctx.globalAlpha = 1
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

  /** Mịn nhẹ bằng blur trong mask — rẻ hơn getImageData */
  private softSmoothFace() {
    const smooth = Math.max(0, Math.min(100, this.skin.smooth)) / 100
    if (smooth < 0.02) return

    const w = this.canvas.width
    const h = this.canvas.height
    const blur = 1.2 + smooth * 2.2
    this.lipTintCtx.clearRect(0, 0, w, h)
    this.lipTintCtx.filter = `blur(${blur.toFixed(1)}px)`
    this.lipTintCtx.drawImage(this.canvas, 0, 0)
    this.lipTintCtx.filter = 'none'
    this.lipTintCtx.globalCompositeOperation = 'destination-in'
    this.lipTintCtx.drawImage(this.faceMask, 0, 0)
    this.lipTintCtx.globalCompositeOperation = 'source-over'

    this.ctx.globalAlpha = 0.22 + smooth * 0.28
    this.ctx.drawImage(this.lipTint, 0, 0)
    this.ctx.globalAlpha = 1
  }

  /** Mịn trong oval mặt + chỉ pixel da (không đụng tóc / nền) */
  private smoothFaceSkin() {
    const smooth = Math.max(0, Math.min(100, this.skin.smooth)) / 100
    if (smooth < 0.02) return

    const sw = this.workCanvas.width
    const sh = this.workCanvas.height
    this.workCtx.drawImage(this.canvas, 0, 0, sw, sh)
    const img = this.workCtx.getImageData(0, 0, sw, sh)
    const d = img.data
    const src = new Uint8ClampedArray(d)

    const mix = 0.35 + smooth * 0.43
    const liftR = 2 + smooth * 5
    const liftG = 1.5 + smooth * 4
    const liftB = 1 + smooth * 3

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
        d[i] = Math.min(255, r * (1 - mix) + (sr / n) * mix + liftR)
        d[i + 1] = Math.min(255, g * (1 - mix) + (sg / n) * mix + liftG)
        d[i + 2] = Math.min(255, b * (1 - mix) + (sb / n) * mix + liftB)
      }
    }

    this.workCtx.putImageData(img, 0, 0)
    // Chỉ phủ trong vùng mặt
    this.workCtx.globalCompositeOperation = 'destination-in'
    this.workCtx.drawImage(this.faceMask, 0, 0, sw, sh)
    this.workCtx.globalCompositeOperation = 'source-over'

    this.ctx.globalAlpha = 0.4 + smooth * 0.45
    this.ctx.drawImage(this.workCanvas, 0, 0, this.canvas.width, this.canvas.height)
    this.ctx.globalAlpha = 1
  }

  /** Khi chưa detect được mặt */
  private smoothSkinFallback() {
    const smooth = Math.max(0, Math.min(100, this.skin.smooth)) / 100
    const bright = Math.max(0, Math.min(100, this.skin.brighten)) / 100
    if (bright >= 0.02) {
      const brightness = 1 + bright * 0.12
      this.ctx.filter = `brightness(${brightness.toFixed(3)})`
      this.ctx.drawImage(this.canvas, 0, 0)
      this.ctx.filter = 'none'
    }
    if (smooth < 0.02) return

    const sw = this.workCanvas.width
    const sh = this.workCanvas.height
    this.workCtx.drawImage(this.canvas, 0, 0, sw, sh)
    const img = this.workCtx.getImageData(0, 0, sw, sh)
    const d = img.data
    const src = new Uint8ClampedArray(d)
    const mix = 0.3 + smooth * 0.35

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
            if (!this.isSkin(src[j]!, src[j + 1]!, src[j + 2]!)) continue
            sr += src[j]!
            sg += src[j + 1]!
            sb += src[j + 2]!
            n++
          }
        }
        if (n < 3) continue
        d[i] = Math.min(255, r * (1 - mix) + (sr / n) * mix)
        d[i + 1] = Math.min(255, g * (1 - mix) + (sg / n) * mix)
        d[i + 2] = Math.min(255, b * (1 - mix) + (sb / n) * mix)
      }
    }
    this.workCtx.putImageData(img, 0, 0)
    this.ctx.globalAlpha = 0.35 + smooth * 0.35
    this.ctx.drawImage(this.workCanvas, 0, 0, this.canvas.width, this.canvas.height)
    this.ctx.globalAlpha = 1
  }

  private drawBrowsFromLandmarks(landmarks: Array<{ x: number; y: number }>) {
    const intensity = Math.max(0, Math.min(100, this.brow.intensity)) / 100
    if (intensity < 0.02) return

    const w = this.canvas.width
    const h = this.canvas.height
    const thick = Math.max(0, Math.min(100, this.brow.thickness)) / 100
    // Độ dày theo khoảng cách mắt–mày
    const eyeRef = landmarks[159] && landmarks[70]
      ? Math.abs((landmarks[70].y - landmarks[159].y) * h)
      : h * 0.03
    const expandPx = 0.5 + thick * Math.max(2.5, eyeRef * 0.55)

    const style = this.brow.style
    const blurPx = style === 'soft' ? 7 : style === 'defined' ? 2.2 : 4.5
    const softA = style === 'defined' ? 0.5 + intensity * 0.45 : 0.35 + intensity * 0.4
    const mulA = style === 'soft' ? 0.06 + intensity * 0.14 : 0.1 + intensity * 0.22
    // Nâu ấm tự nhiên
    const r = style === 'defined' ? 48 : 58
    const g = style === 'defined' ? 32 : 40
    const b = style === 'defined' ? 24 : 30

    this.lipMaskCtx.clearRect(0, 0, w, h)
    this.lipMaskCtx.fillStyle = '#fff'
    browExpandedPath(
      this.lipMaskCtx,
      landmarks,
      RIGHT_BROW_UPPER,
      RIGHT_BROW_LOWER,
      w,
      h,
      expandPx,
    )
    this.lipMaskCtx.fill()
    browExpandedPath(
      this.lipMaskCtx,
      landmarks,
      LEFT_BROW_UPPER,
      LEFT_BROW_LOWER,
      w,
      h,
      expandPx,
    )
    this.lipMaskCtx.fill()

    // Làm mềm viền — kiểu chân mày tự nhiên, không khối cứng
    this.lipMaskCtx.filter = `blur(${blurPx}px)`
    this.lipMaskCtx.drawImage(this.lipMask, 0, 0)
    this.lipMaskCtx.filter = 'none'

    this.lipTintCtx.clearRect(0, 0, w, h)
    this.lipTintCtx.drawImage(this.canvas, 0, 0)
    this.lipTintCtx.globalCompositeOperation = 'multiply'
    this.lipTintCtx.fillStyle = `rgba(${r},${g},${b},${mulA})`
    this.lipTintCtx.fillRect(0, 0, w, h)
    this.lipTintCtx.globalCompositeOperation = 'soft-light'
    this.lipTintCtx.fillStyle = `rgba(${r + 20},${g + 12},${b + 8},${softA})`
    this.lipTintCtx.fillRect(0, 0, w, h)
    this.lipTintCtx.globalCompositeOperation = 'destination-in'
    this.lipTintCtx.drawImage(this.lipMask, 0, 0)
    this.lipTintCtx.globalCompositeOperation = 'source-over'

    this.ctx.globalAlpha = 0.32 + intensity * 0.48
    this.ctx.drawImage(this.lipTint, 0, 0)
    this.ctx.globalAlpha = 1

    // Vạch nhẹ theo cung để không bị “đắp khối”
    if (style !== 'soft') {
      this.drawBrowHairHints(landmarks, intensity, style === 'defined' ? 0.22 : 0.14)
    }
  }

  private drawBrowHairHints(
    landmarks: Array<{ x: number; y: number }>,
    intensity: number,
    alpha: number,
  ) {
    const w = this.canvas.width
    const h = this.canvas.height
    const arches = [RIGHT_BROW_UPPER, LEFT_BROW_UPPER]
    this.ctx.save()
    this.ctx.strokeStyle = `rgba(55, 36, 26, ${alpha * intensity})`
    this.ctx.lineWidth = Math.max(0.8, w * 0.0018)
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    for (const arch of arches) {
      this.ctx.beginPath()
      arch.forEach((idx, i) => {
        const p = landmarks[idx]
        if (!p) return
        const x = p.x * w
        const y = p.y * h
        if (i === 0) this.ctx.moveTo(x, y)
        else this.ctx.lineTo(x, y)
      })
      this.ctx.stroke()
    }
    this.ctx.restore()
  }

  private drawLipsFromLandmarks(landmarks: Array<{ x: number; y: number }>) {
    const w = this.canvas.width
    const h = this.canvas.height
    const { r, g, b } = hexToRgb(this.lip.color)
    const intensity = Math.max(0, Math.min(100, this.lip.intensity)) / 100
    if (intensity < 0.02) return

    // 1) Mask cứng (môi trên + dưới, khoét miệng)
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

    // 2) Viền mờ hơn (blur mạnh) — cloud / blurred lip trend
    this.lipMaskCtx.save()
    this.lipMaskCtx.globalCompositeOperation = 'destination-in'
    this.lipMaskCtx.filter = 'blur(3px)'
    this.lipMaskCtx.drawImage(this.lipMask, 0, 0)
    this.lipMaskCtx.filter = 'none'
    this.lipMaskCtx.restore()

    this.lipMaskCtx.filter = 'blur(6.5px)'
    this.lipMaskCtx.drawImage(this.lipMask, 0, 0)
    this.lipMaskCtx.filter = 'none'

    // 3) Tint theo màu + độ đậm
    const softA = 0.55 + intensity * 0.4
    const overlayA = 0.08 + intensity * 0.22
    this.lipTintCtx.clearRect(0, 0, w, h)
    this.lipTintCtx.drawImage(this.canvas, 0, 0)
    this.lipTintCtx.globalCompositeOperation = 'soft-light'
    this.lipTintCtx.fillStyle = `rgba(${r},${g},${b},${softA})`
    this.lipTintCtx.fillRect(0, 0, w, h)
    this.lipTintCtx.globalCompositeOperation = 'source-atop'
    this.lipTintCtx.fillStyle = `rgba(${r},${g},${b},${overlayA})`
    this.lipTintCtx.fillRect(0, 0, w, h)
    this.lipTintCtx.globalCompositeOperation = 'destination-in'
    this.lipTintCtx.drawImage(this.lipMask, 0, 0)
    this.lipTintCtx.globalCompositeOperation = 'source-over'

    this.ctx.globalAlpha = 0.28 + intensity * 0.4
    this.ctx.drawImage(this.lipTint, 0, 0)
    this.ctx.globalAlpha = 1

    // 4) Bóng môi dưới (glassy pout)
    if (this.lip.gloss) this.drawLowerLipGloss(landmarks)
  }

  private drawLowerLipGloss(landmarks: Array<{ x: number; y: number }>) {
    const w = this.canvas.width
    const h = this.canvas.height
    // Điểm giữa môi dưới: 17 (bottom) + 14 (inner) — highlight dải ngang
    const mid = landmarks[17]
    const left = landmarks[84]
    const right = landmarks[314]
    const inner = landmarks[14]
    if (!mid || !left || !right || !inner) return

    const cx = ((left.x + right.x) / 2) * w
    const cy = ((mid.y + inner.y) / 2) * h
    const rx = Math.abs(right.x - left.x) * w * 0.28
    const ry = Math.max(2, Math.abs(mid.y - inner.y) * h * 0.35)

    this.lipTintCtx.clearRect(0, 0, w, h)
    const grad = this.lipTintCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry))
    grad.addColorStop(0, 'rgba(255,255,255,0.55)')
    grad.addColorStop(0.45, 'rgba(255,255,255,0.22)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    this.lipTintCtx.fillStyle = grad
    this.lipTintCtx.beginPath()
    this.lipTintCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    this.lipTintCtx.fill()
    this.lipTintCtx.filter = 'blur(3px)'
    this.lipTintCtx.drawImage(this.lipTint, 0, 0)
    this.lipTintCtx.filter = 'none'

    // Chỉ trong vùng môi dưới
    this.lipMaskCtx.clearRect(0, 0, w, h)
    this.lipMaskCtx.fillStyle = '#fff'
    this.lipMaskCtx.beginPath()
    pathFrom(this.lipMaskCtx, landmarks, LOWER_OUTER, w, h)
    this.lipMaskCtx.fill()
    this.lipMaskCtx.globalCompositeOperation = 'destination-out'
    this.lipMaskCtx.beginPath()
    pathFrom(this.lipMaskCtx, landmarks, LOWER_INNER, w, h)
    this.lipMaskCtx.fill()
    this.lipMaskCtx.globalCompositeOperation = 'source-over'
    this.lipMaskCtx.filter = 'blur(5px)'
    this.lipMaskCtx.drawImage(this.lipMask, 0, 0)
    this.lipMaskCtx.filter = 'none'

    this.lipTintCtx.globalCompositeOperation = 'destination-in'
    this.lipTintCtx.drawImage(this.lipMask, 0, 0)
    this.lipTintCtx.globalCompositeOperation = 'source-over'

    this.ctx.globalCompositeOperation = 'soft-light'
    this.ctx.globalAlpha = 0.55
    this.ctx.drawImage(this.lipTint, 0, 0)
    this.ctx.globalAlpha = 1
    this.ctx.globalCompositeOperation = 'source-over'
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
    this.smoothLips = null
    this.landmarkTarget = null
    // Giữ face singleton cache — không close (reuse lần sau)
    this.face = null
    this.onTrack?.(null)
    this.setStatus('idle')
  }
}
