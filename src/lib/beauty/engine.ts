import type { BeautySettings } from './types'
import { beautyActive, beautyNeedsAi } from './types'

const FACE_MESH_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619'
const ASSETS_BASE = '/openmakeup'
const MEDIAPIPE_BASE = FACE_MESH_CDN

export type BeautyEngineStatus = 'idle' | 'loading' | 'running' | 'error'

type SegProcessor = {
  createProcessedTrack: (t: MediaStreamTrack) => Promise<MediaStreamTrack>
  setBackgroundMode: (m: 'blur' | 'none' | 'color' | 'image') => void
  setBlurRadius: (n: number) => void
  destroy?: () => void | Promise<void>
}

let scriptsReady: Promise<void> | null = null

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-beauty-src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.beautySrc = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Không tải được ${src}`))
    document.head.appendChild(s)
  })
}

function ensureMediaPipeScripts() {
  if (!scriptsReady) {
    scriptsReady = (async () => {
      await loadScript(`${FACE_MESH_CDN}/face_mesh.js`)
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js')
      if (!(window as unknown as { FaceMesh?: unknown }).FaceMesh) {
        throw new Error('MediaPipe FaceMesh không sẵn sàng')
      }
    })()
  }
  return scriptsReady
}

/** Camera giả: dùng track có sẵn, không gọi getUserMedia (tránh mở cam lần 2). */
class ExternalFrameCamera {
  video: HTMLVideoElement
  private onFrame: () => Promise<void> | void
  private raf = 0
  private alive = false

  constructor(video: HTMLVideoElement, opts: { onFrame: () => Promise<void> | void }) {
    this.video = video
    this.onFrame = opts.onFrame
  }

  async start() {
    this.alive = true
    const tick = async () => {
      if (!this.alive) return
      this.raf = requestAnimationFrame(() => void tick())
      if (this.video.readyState >= 2) {
        try {
          await this.onFrame()
        } catch {
          /* frame lỗi — bỏ qua */
        }
      }
    }
    void tick()
  }

  stop() {
    this.alive = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }
}

function mixHex(a: string, b: string, t: number) {
  const parse = (h: string) => {
    const n = h.replace('#', '')
    const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
    const v = Number.parseInt(full, 16)
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
  }
  const A = parse(a)
  const B = parse(b)
  const r = Math.round(A.r + (B.r - A.r) * t)
  const g = Math.round(A.g + (B.g - A.g) * t)
  const bl = Math.round(A.b + (B.b - A.b) * t)
  return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

export class BeautyEngine {
  private host: HTMLDivElement | null = null
  private video: HTMLVideoElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private makeup: {
    init: () => Promise<unknown>
    setAR: (type: string, color: string, mode: string) => void
    clearPart: (type: string) => void
    clearAll: () => void
    stop: () => void
    dispose: () => void
    start: () => void
  } | null = null
  private seg: SegProcessor | null = null
  private segTrack: MediaStreamTrack | null = null
  private out: MediaStream | null = null
  private outTrack: MediaStreamTrack | null = null
  private source: MediaStreamTrack | null = null
  private settings: BeautySettings
  private onStatus: ((s: BeautyEngineStatus, err?: string) => void) | null = null
  private onTrack: ((t: MediaStreamTrack | null) => void) | null = null

  constructor(settings: BeautySettings) {
    this.settings = { ...settings }
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

  updateSettings(next: BeautySettings) {
    const prevMode = this.modeKey(this.settings)
    this.settings = { ...next }
    const nextMode = this.modeKey(this.settings)
    this.applyLooks()

    if (prevMode !== nextMode && this.source) {
      const src = this.source
      void this.start(src).catch((e) => {
        this.setStatus('error', e instanceof Error ? e.message : 'Lỗi beauty')
      })
      return
    }
    void this.syncBlurOnly()
  }

  private modeKey(s: BeautySettings) {
    const makeup = s.lipstick > 0 || s.smooth > 0 || s.whiten > 0 ? 'm' : '-'
    const blur = s.blurBg > 0 ? 'b' : '-'
    return `${makeup}${blur}`
  }

  async ensureAiFor(settings: BeautySettings) {
    this.settings = { ...settings }
    if (!beautyNeedsAi(settings) && settings.smooth === 0 && settings.whiten === 0) return
    // Models tải trong start / syncBlur
    if (settings.blurBg > 0 && !this.seg) await this.ensureSegmo()
    if ((settings.lipstick > 0 || settings.smooth > 0 || settings.whiten > 0) && !this.makeup) {
      // start() sẽ tạo makeup; ở đây chỉ báo loading
      this.setStatus('loading')
    }
  }

  async start(source: MediaStreamTrack): Promise<MediaStreamTrack> {
    const src = source
    await this.stop()
    if (!beautyActive(this.settings)) throw new Error('Chưa bật hiệu ứng nào')

    this.source = src
    this.setStatus('loading')

    try {
      const needsMakeup =
        this.settings.lipstick > 0 || this.settings.smooth > 0 || this.settings.whiten > 0
      const needsBlur = this.settings.blurBg > 0

      let feedTrack = src
      if (needsBlur) {
        await this.ensureSegmo()
        feedTrack = await this.startSegmo(src)
      }

      if (needsMakeup) {
        await ensureMediaPipeScripts()
        await this.startMakeup(feedTrack)
        this.out = this.canvas!.captureStream(24)
        this.outTrack = this.out.getVideoTracks()[0] ?? null
      } else {
        this.outTrack = feedTrack
        this.out = new MediaStream([feedTrack])
      }

      if (!this.outTrack) throw new Error('Không tạo được track beauty')
      this.applyLooks()
      this.setStatus('running')
      this.onTrack?.(this.outTrack)
      return this.outTrack
    } catch (e) {
      this.setStatus('error', e instanceof Error ? e.message : 'Lỗi beauty')
      await this.stop()
      throw e
    }
  }

  private async ensureSegmo() {
    if (this.seg) return
    const { SegmentationProcessor } = await import('segmo')
    this.seg = new SegmentationProcessor({
      backgroundMode: 'blur',
      blurRadius: 12,
      useWorker: true,
    })
  }

  private async startSegmo(source: MediaStreamTrack) {
    if (!this.seg) await this.ensureSegmo()
    const radius = Math.round(6 + (this.settings.blurBg / 100) * 18)
    this.seg!.setBackgroundMode(this.settings.blurBg > 0 ? 'blur' : 'none')
    this.seg!.setBlurRadius(radius)
    this.segTrack = await this.seg!.createProcessedTrack(source)
    return this.segTrack
  }

  private async syncBlurOnly() {
    if (!this.seg || !this.source) return
    if (this.settings.blurBg <= 0) {
      this.seg.setBackgroundMode('none')
      return
    }
    this.seg.setBackgroundMode('blur')
    this.seg.setBlurRadius(Math.round(6 + (this.settings.blurBg / 100) * 18))
  }

  private async startMakeup(feedTrack: MediaStreamTrack) {
    const { MakeupEngine } = await import('open-makeup-sdk')

    this.host = document.createElement('div')
    this.host.setAttribute('aria-hidden', 'true')
    const w = feedTrack.getSettings().width || 640
    const h = feedTrack.getSettings().height || 480
    this.host.style.cssText = `position:fixed;left:-10000px;top:0;width:${w}px;height:${h}px;overflow:hidden;pointer-events:none;opacity:0;`

    this.video = document.createElement('video')
    this.video.playsInline = true
    this.video.muted = true
    this.video.autoplay = true
    this.video.style.cssText = 'width:100%;height:100%;object-fit:cover;'
    this.video.srcObject = new MediaStream([feedTrack])

    this.canvas = document.createElement('canvas')
    this.canvas.width = w
    this.canvas.height = h
    this.canvas.style.cssText = 'width:100%;height:100%;'

    this.host.append(this.video, this.canvas)
    document.body.appendChild(this.host)

    await this.video.play().catch(() => {})
    for (let i = 0; i < 40 && this.video.videoWidth < 2; i++) {
      await new Promise((r) => setTimeout(r, 50))
    }

    const engine = new MakeupEngine({
      video: this.video,
      renderCanvas: this.canvas,
      assetsBaseUrl: ASSETS_BASE,
      mediapipeBaseUrl: MEDIAPIPE_BASE,
      camera: { width: w, height: h },
      faceMeshClass: (window as unknown as { FaceMesh: new (c: unknown) => unknown }).FaceMesh,
      cameraClass: ExternalFrameCamera as unknown as new (
        v: HTMLVideoElement,
        o: { onFrame: () => Promise<void> | void },
      ) => unknown,
    })

    await engine.init()
    this.makeup = engine
  }

  private applyLooks() {
    if (!this.makeup) return
    const { smooth, whiten, lipstick, lipstickColor } = this.settings

    if (smooth > 0 || whiten > 0) {
      // Foundation: màu sáng hơn khi trắng; finish matte (mode 1)
      const base = '#f3d4c4'
      const light = '#ffe8dc'
      const t = Math.min(1, (whiten / 100) * 0.85 + (smooth / 100) * 0.25)
      const color = mixHex(base, light, t)
      this.makeup.setAR('foundation', color, smooth > 55 ? '5' : '1')
    } else {
      this.makeup.clearPart('foundation')
    }

    if (lipstick > 0) {
      const soft = mixHex('#c98a8a', lipstickColor, 0.35 + (lipstick / 100) * 0.65)
      // mode 7 = soft shine — tự nhiên hơn opaque
      this.makeup.setAR('lipstick', soft, lipstick > 70 ? '5' : '7')
    } else {
      this.makeup.clearPart('lipstick')
    }
  }

  async stop() {
    try {
      this.makeup?.stop()
      this.makeup?.dispose()
    } catch {
      /* ignore */
    }
    this.makeup = null

    this.outTrack?.stop()
    this.out?.getTracks().forEach((t) => {
      if (t !== this.source && t !== this.segTrack) t.stop()
    })
    this.out = null
    this.outTrack = null

    if (this.segTrack && this.segTrack !== this.source) {
      try {
        this.segTrack.stop()
      } catch {
        /* ignore */
      }
    }
    this.segTrack = null

    if (this.seg?.destroy) {
      try {
        await this.seg.destroy()
      } catch {
        /* ignore */
      }
    }
    this.seg = null

    if (this.video) this.video.srcObject = null
    this.host?.remove()
    this.host = null
    this.video = null
    this.canvas = null
    this.source = null
    this.onTrack?.(null)
    this.setStatus('idle')
  }
}
