import { filterActive, getFilterPreset, type FilterPresetId } from './presets'

export type BeautyEngineStatus = 'idle' | 'loading' | 'running' | 'error'

/**
 * Filter nhẹ: Canvas 2D + CSS filter.
 * Preset "Tự nhiên": mịn nhẹ + sáng vừa + nâng vùng đỏ (môi).
 */
export class BeautyEngine {
  private video = document.createElement('video')
  private canvas = document.createElement('canvas')
  private softCanvas = document.createElement('canvas')
  private workCanvas = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private softCtx: CanvasRenderingContext2D
  private workCtx: CanvasRenderingContext2D
  private out: MediaStream | null = null
  private outTrack: MediaStreamTrack | null = null
  private presetId: FilterPresetId = 'none'
  private raf = 0
  private frame = 0
  private running = false
  private onStatus: ((s: BeautyEngineStatus, err?: string) => void) | null = null
  private onTrack: ((t: MediaStreamTrack | null) => void) | null = null

  constructor(presetId: FilterPresetId = 'none') {
    this.presetId = presetId
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    const softCtx = this.softCanvas.getContext('2d')
    const workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx || !softCtx || !workCtx) throw new Error('Canvas 2D không khả dụng')
    this.ctx = ctx
    this.softCtx = softCtx
    this.workCtx = workCtx
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
    this.softCanvas.width = w
    this.softCanvas.height = h
    // half-res cho mịn + nâng đỏ — nhẹ CPU
    this.workCanvas.width = Math.max(160, Math.round(w / 2))
    this.workCanvas.height = Math.max(90, Math.round(h / 2))
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

  /** Mịn nhẹ + sáng vừa + môi/má đỏ hơn một chút */
  private drawNatural(css: string) {
    const w = this.canvas.width
    const h = this.canvas.height

    // 1) Base sáng nhẹ (không cháy)
    this.ctx.filter = css
    this.ctx.drawImage(this.video, 0, 0, w, h)
    this.ctx.filter = 'none'

    // 2) Lớp mịn: blur nhẹ phủ ~28% → da trông mịn, vẫn giữ nét
    this.softCtx.filter = 'blur(2.2px)'
    this.softCtx.drawImage(this.video, 0, 0, w, h)
    this.softCtx.filter = 'none'
    this.ctx.globalAlpha = 0.28
    this.ctx.drawImage(this.softCanvas, 0, 0)
    this.ctx.globalAlpha = 1

    // 3) Nâng vùng đỏ (môi / má hồng) — half-res mỗi 2 frame
    if (this.frame % 2 === 0) this.boostReds()
  }

  private boostReds() {
    const sw = this.workCanvas.width
    const sh = this.workCanvas.height
    this.workCtx.drawImage(this.canvas, 0, 0, sw, sh)
    const img = this.workCtx.getImageData(0, 0, sw, sh)
    const d = img.data

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!
      const g = d[i + 1]!
      const b = d[i + 2]!
      // Vùng đỏ hơn (môi, má): R vượt G/B rõ
      const redBias = r - Math.max(g, b)
      if (redBias < 18 || r < 70) continue
      // Độ mạnh theo “đỏ bao nhiêu” — tối đa ~12%
      const t = Math.min(1, (redBias - 18) / 55)
      const lift = 6 + t * 18
      d[i] = Math.min(255, r + lift)
      d[i + 1] = Math.max(0, g - lift * 0.12)
      d[i + 2] = Math.max(0, b - lift * 0.18)
    }

    this.workCtx.putImageData(img, 0, 0)
    this.ctx.globalAlpha = 0.55
    this.ctx.drawImage(this.workCanvas, 0, 0, this.canvas.width, this.canvas.height)
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
    this.onTrack?.(null)
    this.setStatus('idle')
  }
}
