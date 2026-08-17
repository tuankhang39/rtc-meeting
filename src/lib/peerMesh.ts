/**
 * WebRTC mesh — Perfect Negotiation (W3C).
 * Mỗi cặp peer: 1 RTCPeerConnection, trickle ICE qua signaling bên ngoài.
 *
 * Quy tắc offerer: userId > peerId (impolite). Còn lại polite.
 * Lần đầu: chỉ offerer gửi offer. Sau khi đã negotiate: cả hai được offer (share màn hình).
 */

export type SignalPayload =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'candidate'; candidate: RTCIceCandidateInit | null }

export type PeerLinkState = RTCPeerConnection['connectionState'] | 'none'

export type PeerMeshEvents = {
  onTrack: (peerId: string, ev: RTCTrackEvent) => void
  onLink: (peerId: string, state: PeerLinkState) => void
  onSignal: (to: string, payload: SignalPayload) => void
}

type PeerEntry = {
  pc: RTCPeerConnection
  makingOffer: boolean
  ignoreOffer: boolean
  iceQueue: RTCIceCandidateInit[]
  retryTimer: number | null
  negotiateTimer: number | null
  negotiateForce: boolean
  lastRebuildAt: number
  audioSender: RTCRtpSender | null
  cameraSender: RTCRtpSender | null
  screenSender: RTCRtpSender | null
}

export class PeerMesh {
  private peers = new Map<string, PeerEntry>()
  private signalChain = new Map<string, Promise<void>>()
  private userId: string
  private createPc: () => RTCPeerConnection
  private events: PeerMeshEvents
  private getMedia: () => { local: MediaStream | null; screen: MediaStreamTrack | null }

  constructor(
    userId: string,
    createPc: () => RTCPeerConnection,
    events: PeerMeshEvents,
    getMedia: () => { local: MediaStream | null; screen: MediaStreamTrack | null },
  ) {
    this.userId = userId
    this.createPc = createPc
    this.events = events
    this.getMedia = getMedia
  }

  /** Impolite = offerer (gửi offer đầu tiên) */
  isOfferer(peerId: string) {
    return this.userId > peerId
  }

  isPolite(peerId: string) {
    return !this.isOfferer(peerId)
  }

  getConnection(peerId: string) {
    return this.peers.get(peerId)?.pc ?? null
  }

  /** Tạo / lấy PC. Chỉ gọi startOffer khi initiate=true (từ participant listener). */
  connect(peerId: string, localStream: MediaStream | null, screenTrack?: MediaStreamTrack | null, initiate = false) {
    let entry = this.peers.get(peerId)
    if (entry) {
      const dead = entry.pc.connectionState === 'closed' || entry.pc.connectionState === 'failed'
      if (!dead) {
        const hadScreen = Boolean(entry.screenSender?.track)
        this.syncCamMic(entry, localStream)
        if (screenTrack) this.attachScreen(entry, screenTrack)
        else if (this.isOfferer(peerId)) this.ensureRecvScreenSlot(entry)
        if (!hadScreen && entry.screenSender?.track) this.scheduleNegotiation(peerId, true)
        return entry.pc
      }
      this.disconnect(peerId, false)
    }

    const pc = this.createPc()
    entry = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      iceQueue: [],
      retryTimer: null,
      negotiateTimer: null,
      negotiateForce: false,
      lastRebuildAt: 0,
      audioSender: null,
      cameraSender: null,
      screenSender: null,
    }
    this.peers.set(peerId, entry)

    pc.ontrack = (ev) => this.events.onTrack(peerId, ev)
    pc.onicecandidate = (ev) => {
      this.events.onSignal(peerId, { type: 'candidate', candidate: ev.candidate?.toJSON() ?? null })
    }
    pc.onnegotiationneeded = () => {
      if (this.peers.get(peerId)?.pc !== pc) return
      const negotiated = Boolean(pc.remoteDescription)
      if (!negotiated && !this.isOfferer(peerId)) return
      if (pc.signalingState !== 'stable') {
        entry.negotiateForce = true
        return
      }
      this.scheduleNegotiation(peerId, negotiated)
    }
    pc.onconnectionstatechange = () => {
      if (this.peers.get(peerId)?.pc !== pc) return
      this.events.onLink(peerId, pc.connectionState)
      if (pc.connectionState === 'connected') {
        this.clearRetry(peerId)
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.scheduleRebuild(peerId)
      } else if (pc.connectionState === 'closed') {
        this.disconnect(peerId, false)
      }
    }

    this.syncCamMic(entry, localStream)
    if (screenTrack) this.attachScreen(entry, screenTrack)
    else if (this.isOfferer(peerId)) this.ensureRecvScreenSlot(entry)

    if (initiate) void this.maybeOffer(peerId, true)
    this.scheduleRetry(peerId)
    this.events.onLink(peerId, pc.connectionState)
    return pc
  }

  /** Chỉ lấy PC — dùng khi xử lý signal, KHÔNG gửi offer. */
  private getOrCreate(peerId: string, localStream: MediaStream | null, screenTrack?: MediaStreamTrack | null) {
    const existing = this.peers.get(peerId)
    if (existing && existing.pc.connectionState !== 'closed' && existing.pc.connectionState !== 'failed') {
      this.syncCamMic(existing, localStream)
      return existing.pc
    }
    return this.connect(peerId, localStream, screenTrack, false)
  }

  private syncCamMic(entry: PeerEntry, localStream: MediaStream | null) {
    if (!localStream) return
    for (const track of localStream.getTracks()) {
      if (track.readyState === 'ended') continue
      if (track.kind === 'audio') this.upsertSender(entry, 'audioSender', track, localStream)
      else if (track.kind === 'video') this.upsertSender(entry, 'cameraSender', track, localStream)
    }
  }

  /** Offerer luôn chừa 1 m-line video nhận share — người vào sau mới nhận được màn hình. */
  private ensureRecvScreenSlot(entry: PeerEntry) {
    if (entry.screenSender) return
    const tr = entry.pc.addTransceiver('video', { direction: 'recvonly' })
    entry.screenSender = tr.sender
  }

  /**
   * Gắn track share. Sau setRemoteDescription thì ưu tiên reuse transceiver
   * (m-line recvonly trong offer) — không addTrack tạo m-line mới trong answer.
   */
  private attachScreen(entry: PeerEntry, screenTrack: MediaStreamTrack | null | undefined): boolean {
    const live = screenTrack && screenTrack.readyState !== 'ended' ? screenTrack : null
    if (entry.screenSender) {
      if (entry.screenSender.track?.id !== (live?.id ?? undefined)) {
        void entry.screenSender.replaceTrack(live)
      }
      const tr = entry.pc.getTransceivers().find((t) => t.sender === entry.screenSender)
      if (tr && live && tr.direction === 'recvonly') tr.direction = 'sendrecv'
      return false
    }
    if (!live) return false

    const spare = entry.pc.getTransceivers().find((t) => {
      if (t.sender === entry.cameraSender || t.sender === entry.audioSender) return false
      if (t.sender.track) return false
      if (t.receiver.track?.kind === 'audio') return false
      return t.receiver.track?.kind === 'video' || t.direction === 'recvonly'
    })
    if (spare) {
      void spare.sender.replaceTrack(live)
      spare.direction = 'sendrecv'
      entry.screenSender = spare.sender
      return false
    }

    entry.screenSender = entry.pc.addTrack(live, new MediaStream([live]))
    return true
  }

  private screenNeedsOffer(entry: PeerEntry) {
    if (!entry.screenSender?.track) return false
    const tr = entry.pc.getTransceivers().find((t) => t.sender === entry.screenSender)
    return Boolean(tr && !tr.mid)
  }

  /** Người vào sau / đang share: ép offer lại để có track màn hình. */
  nudgeScreen(peerId: string) {
    const entry = this.peers.get(peerId)
    if (!entry) return
    const { local, screen } = this.getMedia()
    this.syncCamMic(entry, local)
    if (screen) {
      const addedNew = this.attachScreen(entry, screen)
      this.scheduleNegotiation(peerId, true)
      if (addedNew) this.scheduleNegotiation(peerId, true)
    } else if (this.isOfferer(peerId)) {
      this.ensureRecvScreenSlot(entry)
      this.scheduleNegotiation(peerId, true)
    }
  }

  private upsertSender(
    entry: PeerEntry,
    slot: 'audioSender' | 'cameraSender',
    track: MediaStreamTrack,
    stream: MediaStream,
  ) {
    const existing = entry[slot]
    if (existing) {
      if (existing.track?.id !== track.id) void existing.replaceTrack(track)
      return
    }
    const reserved = new Set([entry.audioSender, entry.cameraSender, entry.screenSender])
    const found = entry.pc.getSenders().find((s) => !reserved.has(s) && s.track?.kind === track.kind)
    if (found && (!found.track || found.track.kind === track.kind)) {
      entry[slot] = found
      if (found.track?.id !== track.id) void found.replaceTrack(track)
      return
    }
    entry[slot] = entry.pc.addTrack(track, stream)
  }

  async handleSignal(
    from: string,
    payload: SignalPayload,
    localStream: MediaStream | null,
    screenTrack?: MediaStreamTrack | null,
  ) {
    const prev = this.signalChain.get(from) ?? Promise.resolve()
    const next = prev.then(() => this.processSignal(from, payload, localStream, screenTrack))
    this.signalChain.set(from, next)
    return next
  }

  private async processSignal(
    from: string,
    payload: SignalPayload,
    localStream: MediaStream | null,
    screenTrack?: MediaStreamTrack | null,
  ) {
    const entry = this.peers.get(from)
    const pc = entry?.pc ?? this.getOrCreate(from, localStream, null)
    const e = this.peers.get(from)!
    const polite = this.isPolite(from)

    try {
      if (payload.type === 'offer') {
        const collision = e.makingOffer || pc.signalingState !== 'stable'
        e.ignoreOffer = !polite && collision
        if (e.ignoreOffer) return

        if (collision) {
          try {
            await pc.setLocalDescription({ type: 'rollback' })
          } catch {
            /* Chrome tự rollback */
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        e.ignoreOffer = false
        await this.flushIce(from, pc)
        this.syncCamMic(e, localStream)
        const addedScreenMLine = this.attachScreen(e, screenTrack)
        await pc.setLocalDescription(await pc.createAnswer())
        this.events.onSignal(from, { type: 'answer', sdp: this.desc(pc.localDescription) })
        if (addedScreenMLine || this.screenNeedsOffer(e) || e.negotiateForce) {
          this.scheduleNegotiation(from, true)
        }
      } else if (payload.type === 'answer') {
        if (pc.signalingState !== 'have-local-offer') return
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        e.ignoreOffer = false
        await this.flushIce(from, pc)
        this.attachScreen(e, screenTrack)
        if (this.screenNeedsOffer(e) || e.negotiateForce) this.scheduleNegotiation(from, true)
      } else if (payload.type === 'candidate') {
        if (!payload.candidate) return
        if (!pc.remoteDescription) {
          e.iceQueue.push(payload.candidate)
          return
        }
        try {
          await pc.addIceCandidate(payload.candidate)
        } catch (err) {
          if (!e.ignoreOffer) console.error('addIceCandidate', err)
        }
      }
    } catch (err) {
      console.error('processSignal', from, payload.type, err)
    }
  }

  /** Gửi offer nếu là offerer (lần đầu) hoặc đã negotiate (re-share). */
  async maybeOffer(peerId: string, force = false) {
    const entry = this.peers.get(peerId)
    if (!entry) return
    const { pc } = entry
    if (pc.signalingState !== 'stable') {
      this.scheduleNegotiation(peerId, force)
      return
    }
    if (entry.makingOffer) {
      this.scheduleNegotiation(peerId, force)
      return
    }

    const negotiated = Boolean(pc.currentRemoteDescription ?? pc.remoteDescription)
    if (!force && !negotiated && !this.isOfferer(peerId)) return

    entry.makingOffer = true
    try {
      await pc.setLocalDescription(await pc.createOffer())
      const local = pc.localDescription
      if (!local) return
      this.events.onSignal(peerId, { type: 'offer', sdp: this.desc(local) })
    } catch (err) {
      console.error('maybeOffer', peerId, err)
      this.scheduleNegotiation(peerId, force)
    } finally {
      entry.makingOffer = false
      if (entry.negotiateForce) this.scheduleNegotiation(peerId, entry.negotiateForce)
    }
  }

  private scheduleNegotiation(peerId: string, force = false) {
    const entry = this.peers.get(peerId)
    if (!entry) return
    entry.negotiateForce = entry.negotiateForce || force
    if (entry.negotiateTimer) return
    entry.negotiateTimer = window.setTimeout(() => {
      entry.negotiateTimer = null
      const forceNow = entry.negotiateForce
      entry.negotiateForce = false
      void this.maybeOffer(peerId, forceNow)
    }, 80)
  }

  renegotiateAll() {
    for (const id of this.peers.keys()) this.scheduleNegotiation(id, true)
  }

  publishScreen(screenTrack: MediaStreamTrack, localStream: MediaStream | null) {
    for (const [peerId, entry] of this.peers) {
      this.syncCamMic(entry, localStream)
      const addedNew = this.attachScreen(entry, screenTrack)
      this.scheduleNegotiation(peerId, true)
      if (addedNew) this.scheduleNegotiation(peerId, true)
    }
  }

  unpublishScreen(localStream: MediaStream | null) {
    for (const entry of this.peers.values()) {
      if (entry.screenSender?.track) void entry.screenSender.replaceTrack(null)
      this.syncCamMic(entry, localStream)
    }
  }

  peerIds() {
    return [...this.peers.keys()]
  }

  disconnect(peerId: string, _full = false) {
    const entry = this.peers.get(peerId)
    if (!entry) return
    this.clearRetry(peerId)
    if (entry.negotiateTimer) {
      window.clearTimeout(entry.negotiateTimer)
      entry.negotiateTimer = null
    }
    try {
      entry.pc.close()
    } catch {
      /* ignore */
    }
    this.peers.delete(peerId)
    this.signalChain.delete(peerId)
    this.events.onLink(peerId, 'closed')
  }

  disconnectAll() {
    for (const id of [...this.peers.keys()]) this.disconnect(id)
  }

  private async flushIce(peerId: string, pc: RTCPeerConnection) {
    const entry = this.peers.get(peerId)
    if (!entry?.iceQueue.length || !pc.remoteDescription) return
    const queued = entry.iceQueue
    entry.iceQueue = []
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c)
      } catch (err) {
        if (!entry.ignoreOffer) console.error('flushIce', err)
      }
    }
  }

  private desc(d: RTCSessionDescription | null): RTCSessionDescriptionInit {
    if (!d) throw new Error('missing SDP')
    return { type: d.type, sdp: d.sdp }
  }

  private clearRetry(peerId: string) {
    const entry = this.peers.get(peerId)
    if (entry?.retryTimer) {
      window.clearTimeout(entry.retryTimer)
      entry.retryTimer = null
    }
  }

  private scheduleRetry(peerId: string) {
    this.clearRetry(peerId)
    const entry = this.peers.get(peerId)
    if (!entry) return
    entry.retryTimer = window.setTimeout(() => {
      entry.retryTimer = null
      const pc = entry.pc
      if (pc.connectionState === 'connected') return
      const now = Date.now()
      if (now - entry.lastRebuildAt < 8000) return
      entry.lastRebuildAt = now
      this.rebuild(peerId)
    }, 6000)
  }

  private scheduleRebuild(peerId: string) {
    const entry = this.peers.get(peerId)
    if (!entry || entry.retryTimer) return
    const delay = entry.pc.connectionState === 'failed' ? 1500 : 4000
    entry.retryTimer = window.setTimeout(() => {
      entry.retryTimer = null
      const pc = entry.pc
      if (!pc || pc.connectionState === 'connected' || pc.connectionState === 'closed') return
      const now = Date.now()
      if (now - entry.lastRebuildAt < 8000) return
      entry.lastRebuildAt = now
      this.rebuild(peerId)
    }, delay)
  }

  private rebuild(peerId: string) {
    this.disconnect(peerId, false)
    const { local, screen } = this.getMedia()
    this.connect(peerId, local, screen, true)
  }
}
