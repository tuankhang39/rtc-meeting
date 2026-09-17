import { filterActive, getFilterPreset, type FilterPresetId } from './presets'

export type BeautyEngineStatus = 'idle' | 'loading' | 'running' | 'error'

/**
 * Filter nhẹ. Preset "Tự nhiên":
 * - Mịn chỉ trên pixel da (không blur cả khung)
 * - Nâng đỏ chọn lọc môi (không kéo má/da)
 * - Lớp môi làm mượt thời gian → hết giật
 */
export class BeautyEngine {
  private video = document.createElement('video')
  private canvas = document.createElement('canvas')
  private workCanvas = document.createElement('canvas')
  private lipCanvas = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private workCtx: CanvasRenderingContext2D
  private lipCtx: CanvasRenderingContext2D
  private out: MediaStream | null = null
  private outTrack: MediaStreamTrack | null = null
  private presetId: FilterPresetId = 'none'
  private raf = 0
  private frame = 0
  private running = false
  private lipSmooth: Float32Array | null = null
  private onStatus: ((s: BeautyEngineStatus, err?: string) => void) | null = null
  private onTrack: ((t: MediaStreamTrack | null) => void) | null = null

  constructor(presetId: FilterPresetId = 'none') {
    this.presetId = presetId
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    const workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true })
    const lipCtx = this.lipCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx || !workCtx || !lipCtx) throw new Error('Canvas 2D không khả dụng')
    this.ctx = ctx
    this.workCtx = workCtx
    this.lipCtx = lipCtx
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
    // ~1/2.5 res — đủ cho mịn da / môi, nhẹ CPU
    const sw = Math.max(160, Math.round(w / 2.5))
    const sh = Math.max(90, Math.round(h / 2.5))
    this.workCanvas.width = sw
    this.workCanvas.height = sh
    this.lipCanvas.width = sw
    this.lipCanvas.height = sh
    this.lipSmooth = null
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

    // Base sáng nhẹ — không blur toàn khung
    this.ctx.filter = css
    this.ctx.drawImage(this.video, 0, 0, w, h)
    this.ctx.filter = 'none'

    // Mịn da chọn lọc (mỗi frame, half-res)
    this.smoothSkinOnly()

    // Môi đỏ — mỗi frame + EMA để khỏi giật
    this.boostLipsOnly()
  }

  /** Da: R≈G cao hơn B, không quá đỏ (tránh môi). Chỉ làm mịn vùng này. */
  private isSkin(r: number, g: number, b: number) {
    if (r < 70 || g < 45 || b < 25) return false
    if (r < g || g < b - 8) return false
    const rg = r - g
    const rb = r - b
    // Da thường rg nhỏ; môi/má đỏ rg lớn hơn
    if (rg > 42) return false
    if (rb < 12 || rb > 95) return false
    if (rg > 28 && r > 150) return false
    return true
  }

  /** Môi: đỏ rõ, bão hòa hơn da, không kéo cả mặt */
  private isLip(r: number, g: number, b: number) {
    if (r < 95) return false
    const rg = r - g
    const rb = r - b
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    // Đỏ rõ + bão hòa vừa — loại da cam nhạt
    if (rg < 32 || rb < 28) return false
    if (sat < 0.22) return false
    if (g > r * 0.82) return false
    // Tránh tóc/đồ đỏ quá tối hoặc quá neon
    if (r > 245 && g < 40) return false
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

        // Trung bình 3×3 chỉ lấy pixel da → mịn, mép mắt/tóc giữ nét
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
        // Mix mạnh hơn trước nhưng chỉ trên da
        const mix = 0.62
        d[i] = r * (1 - mix) + (sr / n) * mix
        d[i + 1] = g * (1 - mix) + (sg / n) * mix
        d[i + 2] = b * (1 - mix) + (sb / n) * mix
        // Sáng da rất nhẹ
        d[i] = Math.min(255, d[i]! + 4)
        d[i + 1] = Math.min(255, d[i + 1]! + 3)
        d[i + 2] = Math.min(255, d[i + 2]! + 2)
      }
    }

    this.workCtx.putImageData(img, 0, 0)
    this.ctx.globalAlpha = 0.72
    this.ctx.drawImage(this.workCanvas, 0, 0, this.canvas.width, this.canvas.height)
    this.ctx.globalAlpha = 1
  }

  private boostLipsOnly() {
    const sw = this.lipCanvas.width
    const sh = this.lipCanvas.height
    this.lipCtx.drawImage(this.canvas, 0, 0, sw, sh)
    const img = this.lipCtx.getImageData(0, 0, sw, sh)
    const d = img.data
    const nPix = sw * sh

    if (!this.lipSmooth || this.lipSmooth.length !== nPix) {
      this.lipSmooth = new Float32Array(nPix)
    }

    // Mask môi + EMA (0.75 cũ / 0.25 mới) → hết nhấp nháy
    for (let p = 0; p < nPix; p++) {
      const i = p * 4
      const lip = this.isLip(d[i]!, d[i + 1]!, d[i + 2]!) ? 1 : 0
      const prev = this.lipSmooth[p] ?? 0
      this.lipSmooth[p] = prev * 0.75 + lip * 0.25
    }

    // Chỉ tô khi mask ổn định
    for (let p = 0; p < nPix; p++) {
      const m = this.lipSmooth[p]!
      if (m < 0.35) continue
      const i = p * 4
      const r = d[i]!
      const g = d[i + 1]!
      const b = d[i + 2]!
      const strength = (m - 0.35) / 0.65
      // Đỏ rõ hơn nhưng vẫn soft
      const lift = 14 + strength * 28
      d[i] = Math.min(255, r + lift)
      d[i + 1] = Math.max(0, g - lift * 0.22)
      d[i + 2] = Math.max(0, b - lift * 0.28)
    }

    this.lipCtx.putImageData(img, 0, 0)
    this.ctx.globalAlpha = 0.5
    this.ctx.drawImage(this.lipCanvas, 0, 0, this.canvas.width, this.canvas.height)
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
    this.lipSmooth = null
    this.onTrack?.(null)
    this.setStatus('idle')
  }
}
