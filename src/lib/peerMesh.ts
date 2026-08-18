/**
 * WebRTC mesh — layout m-line CỐ ĐỊNH + Perfect Negotiation (W3C).
 *
 * Mỗi cặp peer có 1 RTCPeerConnection với đúng 3 slot, thứ tự không đổi:
 *   slot 0: audio  → mic
 *   slot 1: video  → camera
 *   slot 2: video  → screen share
 *
 * Cả 3 slot được negotiate MỘT LẦN lúc kết nối và luôn `sendrecv`.
 * Về sau bật/tắt cam, bật/tắt share chỉ là `replaceTrack`:
 * không tạo m-line mới, không renegotiate, không glare.
 * Nhờ vậy bên nhận luôn biết track nào là cam, track nào là màn hình.
 */

export type TrackRole = 'mic' | 'camera' | 'screen'

export type SignalPayload =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'candidate'; candidate: RTCIceCandidateInit | null }

export type PeerLinkState = RTCPeerConnection['connectionState'] | 'none'

export type LocalTracks = Record<TrackRole, MediaStreamTrack | null>

export type PeerMeshEvents = {
  onTrack: (peerId: string, role: TrackRole, track: MediaStreamTrack) => void
  onLink: (peerId: string, state: PeerLinkState) => void
  onSignal: (to: string, payload: SignalPayload) => void
}

/** Tham số nhánh mesh: mỗi người phải upload 1 bản cho từng peer. */
type Quality = { peers: number; sharing: boolean }

type TunableParams = RTCRtpSendParameters & {
  degradationPreference?: 'balanced' | 'maintain-framerate' | 'maintain-resolution'
}

const SLOTS: TrackRole[] = ['mic', 'camera', 'screen']

type PeerEntry = {
  pc: RTCPeerConnection
  polite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
  iceQueue: RTCIceCandidateInit[]
  slots: Record<TrackRole, RTCRtpTransceiver | null>
  recoverTimer: number | null
  offeredAt: number
  restarts: number
}

/** Gửi lại offer cũ nếu chờ answer quá lâu (tin signaling có thể bị mất). */
const OFFER_RESEND_MS = 6000
const WATCHDOG_MS = 4000

/**
 * Không có SFU nên upload = (số peer) × (bitrate mỗi luồng).
 * Các mức dưới đây giữ tổng upload của người đang share dưới ~4 Mbps
 * ở phòng đông nhất, tức là vừa với đường truyền cáp quang gia đình.
 */
function encodingFor(role: TrackRole, { peers, sharing }: Quality): RTCRtpEncodingParameters {
  if (role === 'mic') return { maxBitrate: 40_000 }

  if (role === 'screen') {
    const maxBitrate = peers >= 4 ? 800_000 : peers === 3 ? 1_000_000 : peers === 2 ? 1_500_000 : 2_000_000
    return { maxBitrate, maxFramerate: 15, scaleResolutionDownBy: 1 }
  }

  // Camera nhường băng thông cho màn hình khi đang dạy.
  if (sharing) return { maxBitrate: 120_000, maxFramerate: 15, scaleResolutionDownBy: 2 }
  if (peers >= 4) return { maxBitrate: 200_000, maxFramerate: 20, scaleResolutionDownBy: 2 }
  if (peers === 3) return { maxBitrate: 280_000, maxFramerate: 20, scaleResolutionDownBy: 1.5 }
  if (peers === 2) return { maxBitrate: 400_000, maxFramerate: 24, scaleResolutionDownBy: 1 }
  return { maxBitrate: 600_000, maxFramerate: 24, scaleResolutionDownBy: 1 }
}

function degradationFor(role: TrackRole): TunableParams['degradationPreference'] {
  if (role === 'screen') return 'maintain-resolution'
  return 'balanced'
}

export class PeerMesh {
  private peers = new Map<string, PeerEntry>()
  private signalChain = new Map<string, Promise<void>>()
  private quality: Quality = { peers: 1, sharing: false }
  private watchdog = 0

  private userId: string
  private createPc: () => RTCPeerConnection
  private events: PeerMeshEvents
  private getTracks: () => LocalTracks

  constructor(
    userId: string,
    createPc: () => RTCPeerConnection,
    events: PeerMeshEvents,
    getTracks: () => LocalTracks,
  ) {
    this.userId = userId
    this.createPc = createPc
    this.events = events
    this.getTracks = getTracks
  }

  /** Impolite = bên gửi offer đầu tiên và tạo layout m-line. */
  isOfferer(peerId: string) {
    return this.userId > peerId
  }

  getConnection(peerId: string) {
    return this.peers.get(peerId)?.pc ?? null
  }

  peerIds() {
    return [...this.peers.keys()]
  }

  connect(peerId: string) {
    this.startWatchdog()
    const existing = this.peers.get(peerId)
    if (existing) {
      if (existing.pc.connectionState !== 'closed') {
        this.syncPeer(existing)
        this.ensureOfferProgress(peerId, existing)
        return existing.pc
      }
      this.disconnect(peerId)
    }

    const pc = this.createPc()
    const entry: PeerEntry = {
      pc,
      polite: !this.isOfferer(peerId),
      makingOffer: false,
      ignoreOffer: false,
      iceQueue: [],
      slots: { mic: null, camera: null, screen: null },
      recoverTimer: null,
      offeredAt: 0,
      restarts: 0,
    }
    this.peers.set(peerId, entry)

    pc.ontrack = (ev) => {
      const role = this.roleOf(entry, ev.transceiver)
      if (role) this.events.onTrack(peerId, role, ev.track)
    }

    pc.onicecandidate = (ev) => {
      this.events.onSignal(peerId, { type: 'candidate', candidate: ev.candidate?.toJSON() ?? null })
    }

    pc.onnegotiationneeded = () => {
      if (this.peers.get(peerId)?.pc !== pc) return
      void this.offer(peerId)
    }

    pc.onconnectionstatechange = () => {
      if (this.peers.get(peerId)?.pc !== pc) return
      const state = pc.connectionState
      this.events.onLink(peerId, state)
      if (state === 'connected') {
        this.clearRecover(entry)
        entry.restarts = 0
        this.tunePeer(entry)
      } else if (state === 'disconnected') {
        this.scheduleRecover(peerId, 6000)
      } else if (state === 'failed') {
        this.scheduleRecover(peerId, 800)
      } else if (state === 'closed') {
        this.disconnect(peerId)
      }
    }

    // CHỈ bên offerer được dựng layout. Nếu cả hai cùng dựng trên một PC thì
    // thành 6 m-line: mỗi bên gửi trên nửa của mình, bên nhận map sai slot,
    // và cam sẽ bị hiểu thành màn hình. Bên kia chỉ chờ offer, không được tự offer.
    if (this.isOfferer(peerId)) {
      for (const role of SLOTS) this.createSlot(entry, role)
      this.syncPeer(entry)
      void this.offer(peerId)
    }

    this.events.onLink(peerId, pc.connectionState)
    return pc
  }

  /**
   * Tin signaling có thể mất (Firebase chớp, tab vừa mở chưa kịp lắng nghe).
   * Bên offerer chịu trách nhiệm gửi lại — gửi lại ĐÚNG offer cũ nên layout
   * không đổi và bên kia xử lý lại vô hại.
   */
  private ensureOfferProgress(peerId: string, entry: PeerEntry) {
    if (!this.isOfferer(peerId)) return
    const { pc } = entry
    if (pc.connectionState === 'connected' || pc.connectionState === 'closed') return

    if (pc.signalingState === 'stable' && !pc.localDescription) {
      void this.offer(peerId)
      return
    }
    if (
      pc.signalingState === 'have-local-offer' &&
      pc.localDescription &&
      Date.now() - entry.offeredAt > OFFER_RESEND_MS
    ) {
      entry.offeredAt = Date.now()
      this.events.onSignal(peerId, { type: 'offer', sdp: this.desc(pc.localDescription) })
    }
  }

  disconnect(peerId: string) {
    const entry = this.peers.get(peerId)
    if (!entry) return
    this.clearRecover(entry)
    this.peers.delete(peerId)
    this.signalChain.delete(peerId)
    try {
      entry.pc.ontrack = null
      entry.pc.onicecandidate = null
      entry.pc.onnegotiationneeded = null
      entry.pc.onconnectionstatechange = null
      entry.pc.close()
    } catch {
      /* ignore */
    }
    this.events.onLink(peerId, 'closed')
  }

  disconnectAll() {
    for (const id of [...this.peers.keys()]) this.disconnect(id)
    if (this.watchdog) {
      window.clearInterval(this.watchdog)
      this.watchdog = 0
    }
  }

  private startWatchdog() {
    if (this.watchdog) return
    this.watchdog = window.setInterval(() => {
      for (const [peerId, entry] of this.peers) this.ensureOfferProgress(peerId, entry)
    }, WATCHDOG_MS)
  }

  /** Gọi khi mic/cam/share đổi track. Chỉ replaceTrack — không renegotiate. */
  syncLocalTracks() {
    for (const entry of this.peers.values()) this.syncPeer(entry)
  }

  /** Cập nhật giới hạn băng thông theo số người và trạng thái share. */
  setQuality(peers: number, sharing: boolean) {
    if (this.quality.peers === peers && this.quality.sharing === sharing) return
    this.quality = { peers, sharing }
    for (const entry of this.peers.values()) this.tunePeer(entry)
  }

  /** Ảnh chụp đường truyền để soi khi có máy không nhận được hình/tiếng. */
  async debug() {
    const out: Record<string, unknown> = {}
    for (const [peerId, entry] of this.peers) {
      const slots: Record<string, unknown> = {}
      for (const role of SLOTS) {
        const tr = entry.slots[role]
        slots[role] = tr
          ? {
              mid: tr.mid,
              want: tr.direction,
              actual: tr.currentDirection,
              sending: tr.sender.track ? `${tr.sender.track.kind}${tr.sender.track.enabled ? '' : ' (disabled)'}` : null,
              receiving: tr.receiver.track
                ? `${tr.receiver.track.kind}${tr.receiver.track.muted ? ' (muted)' : ''}`
                : null,
            }
          : null
      }

      const rtp: Record<string, unknown> = {}
      try {
        const stats = await entry.pc.getStats()
        stats.forEach((report) => {
          const r = report as Record<string, unknown>
          if (r.type === 'inbound-rtp') {
            rtp[`in:${String(r.kind)}:${String(r.mid ?? r.id)}`] = {
              packets: r.packetsReceived,
              lost: r.packetsLost,
              frames: r.framesDecoded,
              size: r.frameWidth ? `${String(r.frameWidth)}x${String(r.frameHeight)}` : null,
            }
          } else if (r.type === 'outbound-rtp') {
            rtp[`out:${String(r.kind)}:${String(r.mid ?? r.id)}`] = {
              packets: r.packetsSent,
              frames: r.framesEncoded,
              size: r.frameWidth ? `${String(r.frameWidth)}x${String(r.frameHeight)}` : null,
            }
          }
        })
      } catch {
        /* ignore */
      }

      out[peerId] = {
        myRole: this.isOfferer(peerId) ? 'offerer' : 'answerer',
        connection: entry.pc.connectionState,
        ice: entry.pc.iceConnectionState,
        signaling: entry.pc.signalingState,
        restarts: entry.restarts,
        slots,
        rtp,
      }
    }
    return out
  }

  async handleSignal(from: string, payload: SignalPayload) {
    const prev = this.signalChain.get(from) ?? Promise.resolve()
    const next = prev.then(() => this.processSignal(from, payload))
    this.signalChain.set(from, next)
    return next
  }

  /* ── slots ── */

  /**
   * Tạo slot. Có trình duyệt kén `sendEncodings` nên phải có đường lùi:
   * nếu ném lỗi ở đây thì cả phiên sẽ không bao giờ gửi được offer.
   */
  private createSlot(entry: PeerEntry, role: TrackRole) {
    if (entry.slots[role]) return entry.slots[role]
    const kind = role === 'mic' ? 'audio' : 'video'
    let tr: RTCRtpTransceiver | null = null
    try {
      tr = entry.pc.addTransceiver(kind, {
        direction: 'sendrecv',
        sendEncodings: [encodingFor(role, this.quality)],
      })
    } catch {
      try {
        tr = entry.pc.addTransceiver(kind, { direction: 'sendrecv' })
      } catch (err) {
        console.error('addTransceiver', role, err)
        return null
      }
    }
    entry.slots[role] = tr
    return tr
  }

  /** Bên answerer: gán slot theo đúng thứ tự m-line của offer. */
  private mapSlots(entry: PeerEntry) {
    const videos: RTCRtpTransceiver[] = []
    for (const tr of entry.pc.getTransceivers()) {
      const kind = tr.receiver.track?.kind ?? tr.sender.track?.kind
      if (kind === 'audio') {
        if (!entry.slots.mic) entry.slots.mic = tr
      } else if (kind === 'video') {
        videos.push(tr)
      }
    }
    if (!entry.slots.camera) entry.slots.camera = videos[0] ?? null
    if (!entry.slots.screen) entry.slots.screen = videos[1] ?? null
  }

  /** Mở quyền gửi trên slot đã nhận từ offer (mặc định trình duyệt là recvonly). */
  private openSlots(entry: PeerEntry) {
    for (const role of SLOTS) {
      const tr = entry.slots[role]
      if (!tr || tr.currentDirection === 'stopped') continue
      if (tr.direction !== 'sendrecv') {
        try {
          tr.direction = 'sendrecv'
        } catch {
          /* ignore */
        }
      }
    }
  }

  private roleOf(entry: PeerEntry, tr: RTCRtpTransceiver): TrackRole | null {
    for (const role of SLOTS) if (entry.slots[role] === tr) return role
    // ontrack chạy trong lúc setRemoteDescription, trước khi kịp gán slot.
    this.mapSlots(entry)
    for (const role of SLOTS) if (entry.slots[role] === tr) return role
    return this.roleByPosition(entry, tr)
  }

  /**
   * Chốt hạ: suy ra role theo thứ tự m-line để không bao giờ mất track.
   * Chỉ đếm các transceiver đang NHẬN, vì thứ tự trong danh sách nhận mới
   * tương ứng với thứ tự mic → camera → screen mà bên kia gửi.
   */
  private roleByPosition(entry: PeerEntry, tr: RTCRtpTransceiver): TrackRole | null {
    const track = tr.receiver.track
    if (!track) return null
    if (track.kind === 'audio') return 'mic'
    if (track.kind !== 'video') return null
    const receivingVideos = entry.pc
      .getTransceivers()
      .filter((t) => t.receiver.track?.kind === 'video' && t.currentDirection !== 'stopped')
    const idx = receivingVideos.indexOf(tr)
    if (idx < 0) return null
    return idx === 0 ? 'camera' : 'screen'
  }

  /**
   * Chỉ điền track vào slot có sẵn. Tuyệt đối không tạo slot ở đây:
   * tạo slot sẽ kích `negotiationneeded` và bên đang chờ offer lại đi offer,
   * gây glare ngay giữa lúc bắt tay lần đầu.
   */
  private syncPeer(entry: PeerEntry) {
    const tracks = this.getTracks()
    for (const role of SLOTS) {
      const want = tracks[role]
      const tr = entry.slots[role]
      if (!tr || tr.currentDirection === 'stopped') continue
      const current = tr.sender.track
      if (current === want) continue
      if (current && want && current.id === want.id) continue
      void tr.sender.replaceTrack(want ?? null).catch(() => {})
      if (want) this.tuneSender(tr.sender, role)
    }
  }

  private tunePeer(entry: PeerEntry) {
    for (const role of SLOTS) {
      const tr = entry.slots[role]
      if (tr?.sender.track) this.tuneSender(tr.sender, role)
    }
  }

  private tuneSender(sender: RTCRtpSender, role: TrackRole) {
    let params: TunableParams
    try {
      params = sender.getParameters() as TunableParams
    } catch {
      return
    }
    const wanted = encodingFor(role, this.quality)
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{ ...wanted }]
    } else {
      params.encodings = params.encodings.map((enc, idx) => (idx === 0 ? { ...enc, ...wanted } : enc))
    }
    params.degradationPreference = degradationFor(role)
    void sender.setParameters(params).catch(() => {})
  }

  /* ── negotiation ── */

  private async offer(peerId: string) {
    const entry = this.peers.get(peerId)
    if (!entry) return
    const { pc } = entry
    if (entry.makingOffer || pc.signalingState !== 'stable') return
    entry.makingOffer = true
    try {
      await pc.setLocalDescription()
      if (this.peers.get(peerId) !== entry || !pc.localDescription) return
      entry.offeredAt = Date.now()
      this.events.onSignal(peerId, { type: 'offer', sdp: this.desc(pc.localDescription) })
    } catch (err) {
      console.error('offer', peerId, err)
    } finally {
      entry.makingOffer = false
    }
  }

  private async processSignal(from: string, payload: SignalPayload) {
    if (!this.peers.has(from)) this.connect(from)
    const entry = this.peers.get(from)
    if (!entry) return
    const { pc } = entry

    try {
      if (payload.type === 'candidate') {
        if (!payload.candidate) return
        if (!pc.remoteDescription) {
          entry.iceQueue.push(payload.candidate)
          return
        }
        try {
          await pc.addIceCandidate(payload.candidate)
        } catch (err) {
          if (!entry.ignoreOffer) console.error('addIceCandidate', from, err)
        }
        return
      }

      if (payload.type === 'answer' && pc.signalingState !== 'have-local-offer') return

      const collision = payload.type === 'offer' && (entry.makingOffer || pc.signalingState !== 'stable')
      entry.ignoreOffer = !entry.polite && collision
      if (entry.ignoreOffer) return

      // Polite: setRemoteDescription tự rollback offer của mình khi có collision.
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
      if (this.peers.get(from) !== entry) return
      entry.ignoreOffer = false
      await this.flushIce(entry)

      if (payload.type === 'offer') {
        this.mapSlots(entry)
        this.openSlots(entry)
        this.syncPeer(entry)
        await pc.setLocalDescription()
        if (this.peers.get(from) !== entry || !pc.localDescription) return
        this.events.onSignal(from, { type: 'answer', sdp: this.desc(pc.localDescription) })
      } else {
        this.mapSlots(entry)
        this.syncPeer(entry)
      }
      this.tunePeer(entry)
    } catch (err) {
      console.error('processSignal', from, payload.type, err)
    }
  }

  private async flushIce(entry: PeerEntry) {
    if (!entry.iceQueue.length || !entry.pc.remoteDescription) return
    const queued = entry.iceQueue
    entry.iceQueue = []
    for (const candidate of queued) {
      try {
        await entry.pc.addIceCandidate(candidate)
      } catch (err) {
        if (!entry.ignoreOffer) console.error('flushIce', err)
      }
    }
  }

  private desc(d: RTCSessionDescription): RTCSessionDescriptionInit {
    return { type: d.type, sdp: d.sdp }
  }

  /* ── hồi phục kết nối ── */

  private clearRecover(entry: PeerEntry) {
    if (entry.recoverTimer) {
      window.clearTimeout(entry.recoverTimer)
      entry.recoverTimer = null
    }
  }

  /** Ưu tiên ICE restart (giữ nguyên media), chỉ dựng lại PC khi thật sự chết. */
  private scheduleRecover(peerId: string, delay: number) {
    const entry = this.peers.get(peerId)
    if (!entry || entry.recoverTimer) return
    entry.recoverTimer = window.setTimeout(() => {
      entry.recoverTimer = null
      const current = this.peers.get(peerId)
      if (current !== entry) return
      const state = entry.pc.connectionState
      if (state === 'connected' || state === 'closed') return

      if (entry.restarts >= 3) {
        this.rebuild(peerId)
        return
      }
      entry.restarts += 1
      try {
        entry.pc.restartIce()
      } catch {
        /* ignore */
      }
      void this.offer(peerId)
      this.scheduleRecover(peerId, 8000)
    }, delay)
  }

  private rebuild(peerId: string) {
    this.disconnect(peerId)
    this.connect(peerId)
  }
}
