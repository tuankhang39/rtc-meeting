/**
 * WebRTC mesh — 3 slot cố định (mic / camera / screen) + Perfect Negotiation.
 *
 * Chỉ OFFERER tạo 3 transceiver. Answerer map slot từ SDP rồi replaceTrack
 * (await) trước khi trả answer — nếu không await dễ ra one-way audio/video.
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
  /** Lần gần nhất đã nhận remoteDescription (offer/answer) */
  negotiatedAt: number
}

const OFFER_RESEND_MS = 3500
const WATCHDOG_MS = 2500
const ANSWERER_WAIT_MS = 8000

function encodingFor(role: TrackRole, { peers, sharing }: Quality): RTCRtpEncodingParameters {
  if (role === 'mic') return { maxBitrate: 48_000 }

  if (role === 'screen') {
    const maxBitrate = peers >= 4 ? 800_000 : peers === 3 ? 1_000_000 : peers === 2 ? 1_500_000 : 2_000_000
    return { maxBitrate, maxFramerate: 15, scaleResolutionDownBy: 1 }
  }

  if (sharing) return { maxBitrate: 150_000, maxFramerate: 15, scaleResolutionDownBy: 2 }
  if (peers >= 4) return { maxBitrate: 220_000, maxFramerate: 20, scaleResolutionDownBy: 2 }
  if (peers === 3) return { maxBitrate: 320_000, maxFramerate: 20, scaleResolutionDownBy: 1.5 }
  if (peers === 2) return { maxBitrate: 450_000, maxFramerate: 24, scaleResolutionDownBy: 1 }
  return { maxBitrate: 650_000, maxFramerate: 24, scaleResolutionDownBy: 1 }
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
        void this.syncPeer(existing)
        this.ensureProgress(peerId, existing)
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
      negotiatedAt: 0,
    }
    this.peers.set(peerId, entry)

    pc.ontrack = (ev) => {
      const role = this.roleOf(entry, ev.transceiver)
      if (!role) return
      const track = ev.track
      this.events.onTrack(peerId, role, track)
      // Một số Chrome chỉ fire ontrack 1 lần; unmute sau đó mới có media thật.
      const bump = () => this.events.onTrack(peerId, role, track)
      track.addEventListener('unmute', bump)
      track.addEventListener('mute', bump)
    }

    pc.onicecandidate = (ev) => {
      this.events.onSignal(peerId, {
        type: 'candidate',
        candidate: ev.candidate ? ev.candidate.toJSON() : null,
      })
    }

    pc.onnegotiationneeded = () => {
      if (this.peers.get(peerId)?.pc !== pc) return
      // Chỉ offerer (hoặc đã negotiate) mới được tự offer từ event này.
      if (!this.isOfferer(peerId) && !pc.remoteDescription) return
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
        void this.syncPeer(entry)
      } else if (state === 'disconnected') {
        this.scheduleRecover(peerId, 4000)
      } else if (state === 'failed') {
        this.scheduleRecover(peerId, 600)
      } else if (state === 'closed') {
        this.disconnect(peerId)
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (this.peers.get(peerId)?.pc !== pc) return
      if (pc.iceConnectionState === 'failed') this.scheduleRecover(peerId, 500)
    }

    // Chỉ offerer dựng layout. Answerer chờ offer rồi map slot.
    if (this.isOfferer(peerId)) {
      for (const role of SLOTS) this.createSlot(entry, role)
      void this.syncPeer(entry).then(() => this.offer(peerId))
    } else {
      // Mốc chờ offer — quá hạn thì rebuild để offerer gửi lại sạch.
      entry.offeredAt = Date.now()
    }

    this.events.onLink(peerId, pc.connectionState)
    return pc
  }

  private ensureProgress(peerId: string, entry: PeerEntry) {
    const { pc } = entry
    if (pc.connectionState === 'connected' || pc.connectionState === 'closed') return

    if (this.isOfferer(peerId)) {
      if (pc.signalingState === 'stable' && !pc.currentRemoteDescription) {
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
      return
    }

    // Answerer: quá lâu không nhận offer → rebuild (offerer watchdog sẽ offer lại).
    if (!pc.remoteDescription && Date.now() - entry.offeredAt > ANSWERER_WAIT_MS) {
      entry.offeredAt = Date.now()
      this.rebuild(peerId)
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
      entry.pc.oniceconnectionstatechange = null
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
      for (const [peerId, entry] of this.peers) this.ensureProgress(peerId, entry)
    }, WATCHDOG_MS)
  }

  syncLocalTracks() {
    for (const entry of this.peers.values()) void this.syncPeer(entry)
  }

  setQuality(peers: number, sharing: boolean) {
    if (this.quality.peers === peers && this.quality.sharing === sharing) return
    this.quality = { peers, sharing }
    for (const entry of this.peers.values()) this.tunePeer(entry)
  }

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
              sending: tr.sender.track
                ? `${tr.sender.track.kind}${tr.sender.track.enabled ? '' : ' (disabled)'}`
                : null,
              receiving: tr.receiver.track
                ? `${tr.receiver.track.kind}${tr.receiver.track.muted ? ' (muted)' : ''}`
                : null,
            }
          : null
      }
      out[peerId] = {
        myRole: this.isOfferer(peerId) ? 'offerer' : 'answerer',
        connection: entry.pc.connectionState,
        ice: entry.pc.iceConnectionState,
        signaling: entry.pc.signalingState,
        restarts: entry.restarts,
        slots,
      }
    }
    return out
  }

  /** @returns false nếu xử lý lỗi — caller KHÔNG nên xóa signal trên Firebase */
  async handleSignal(from: string, payload: SignalPayload): Promise<boolean> {
    const prev = this.signalChain.get(from) ?? Promise.resolve(true)
    const next = prev.then(
      () => this.processSignal(from, payload),
      () => this.processSignal(from, payload),
    )
    this.signalChain.set(
      from,
      next.then(
        () => undefined,
        () => undefined,
      ),
    )
    return next
  }

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

  private mapSlots(entry: PeerEntry) {
    const videos: RTCRtpTransceiver[] = []
    for (const tr of entry.pc.getTransceivers()) {
      if (tr.currentDirection === 'stopped') continue
      const kind = tr.receiver.track?.kind ?? tr.sender.track?.kind
      if (kind === 'audio') {
        if (!entry.slots.mic) entry.slots.mic = tr
      } else if (kind === 'video') {
        videos.push(tr)
      }
    }
    // Sắp theo mid số để ổn định giữa các trình duyệt
    videos.sort((a, b) => String(a.mid ?? '').localeCompare(String(b.mid ?? ''), undefined, { numeric: true }))
    if (!entry.slots.camera) entry.slots.camera = videos[0] ?? null
    if (!entry.slots.screen) entry.slots.screen = videos[1] ?? null
  }

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
    this.mapSlots(entry)
    for (const role of SLOTS) if (entry.slots[role] === tr) return role
    return this.roleByPosition(entry, tr)
  }

  private roleByPosition(entry: PeerEntry, tr: RTCRtpTransceiver): TrackRole | null {
    const track = tr.receiver.track
    if (!track) return null
    if (track.kind === 'audio') return 'mic'
    if (track.kind !== 'video') return null
    const receivingVideos = entry.pc
      .getTransceivers()
      .filter((t) => t.receiver.track?.kind === 'video' && t.currentDirection !== 'stopped')
      .sort((a, b) => String(a.mid ?? '').localeCompare(String(b.mid ?? ''), undefined, { numeric: true }))
    const idx = receivingVideos.indexOf(tr)
    if (idx < 0) return null
    return idx === 0 ? 'camera' : 'screen'
  }

  /** Await replaceTrack — bắt buộc trước createAnswer nếu không dễ one-way. */
  private async syncPeer(entry: PeerEntry) {
    const tracks = this.getTracks()
    const jobs: Promise<void>[] = []
    for (const role of SLOTS) {
      const want = tracks[role]
      const tr = entry.slots[role]
      if (!tr || tr.currentDirection === 'stopped') continue
      const current = tr.sender.track
      if (current === want) continue
      if (current && want && current.id === want.id) continue
      jobs.push(
        tr.sender.replaceTrack(want ?? null).then(() => {
          if (want) this.tuneSender(tr.sender, role)
        }),
      )
    }
    if (jobs.length) await Promise.allSettled(jobs)
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

  private async offer(peerId: string) {
    const entry = this.peers.get(peerId)
    if (!entry) return
    const { pc } = entry
    if (entry.makingOffer || pc.signalingState !== 'stable') return
    entry.makingOffer = true
    try {
      await this.syncPeer(entry)
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

  private async processSignal(from: string, payload: SignalPayload): Promise<boolean> {
    if (!this.peers.has(from)) this.connect(from)
    const entry = this.peers.get(from)
    if (!entry) return false
    const { pc } = entry

    try {
      if (payload.type === 'candidate') {
        if (!payload.candidate) return true
        if (!pc.remoteDescription) {
          entry.iceQueue.push(payload.candidate)
          return true
        }
        try {
          await pc.addIceCandidate(payload.candidate)
        } catch (err) {
          if (!entry.ignoreOffer) console.error('addIceCandidate', from, err)
        }
        return true
      }

      if (payload.type === 'answer' && pc.signalingState !== 'have-local-offer') {
        // Answer muộn / trùng — bỏ qua, coi như đã xử lý để không spam
        return true
      }

      const collision = payload.type === 'offer' && (entry.makingOffer || pc.signalingState !== 'stable')
      entry.ignoreOffer = !entry.polite && collision
      if (entry.ignoreOffer) return true

      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
      if (this.peers.get(from) !== entry) return false
      entry.ignoreOffer = false
      entry.negotiatedAt = Date.now()
      await this.flushIce(entry)

      if (payload.type === 'offer') {
        this.mapSlots(entry)
        this.openSlots(entry)
        // QUAN TRỌNG: phải gắn track xong rồi mới createAnswer
        await this.syncPeer(entry)
        await pc.setLocalDescription()
        if (this.peers.get(from) !== entry || !pc.localDescription) return false
        this.events.onSignal(from, { type: 'answer', sdp: this.desc(pc.localDescription) })
      } else {
        this.mapSlots(entry)
        await this.syncPeer(entry)
      }
      this.tunePeer(entry)
      return true
    } catch (err) {
      console.error('processSignal', from, payload.type, err)
      return false
    }
  }

  private async flushIce(entry: PeerEntry) {
    if (!entry.iceQueue.length || !entry.pc.remoteDescription) return
    const queued = entry.iceQueue.splice(0, entry.iceQueue.length)
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

  private clearRecover(entry: PeerEntry) {
    if (entry.recoverTimer) {
      window.clearTimeout(entry.recoverTimer)
      entry.recoverTimer = null
    }
  }

  private scheduleRecover(peerId: string, delay: number) {
    const entry = this.peers.get(peerId)
    if (!entry || entry.recoverTimer) return
    entry.recoverTimer = window.setTimeout(() => {
      entry.recoverTimer = null
      const current = this.peers.get(peerId)
      if (current !== entry) return
      const state = entry.pc.connectionState
      if (state === 'connected' || state === 'closed') return

      if (entry.restarts >= 2) {
        this.rebuild(peerId)
        return
      }
      entry.restarts += 1
      try {
        entry.pc.restartIce()
      } catch {
        /* ignore */
      }
      if (this.isOfferer(peerId) || entry.pc.signalingState === 'stable') {
        void this.offer(peerId)
      }
      this.scheduleRecover(peerId, 6000)
    }, delay)
  }

  private rebuild(peerId: string) {
    this.disconnect(peerId)
    this.connect(peerId)
  }
}
