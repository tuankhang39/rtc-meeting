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
  lastRebuildAt: number
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
        this.syncTracks(entry, localStream, screenTrack)
        return entry.pc
      }
      this.disconnect(peerId, false)
    }

    const pc = this.createPc()
    entry = { pc, makingOffer: false, ignoreOffer: false, iceQueue: [], retryTimer: null, lastRebuildAt: 0, screenSender: null }
    this.peers.set(peerId, entry)

    pc.ontrack = (ev) => this.events.onTrack(peerId, ev)
    pc.onicecandidate = (ev) => {
      this.events.onSignal(peerId, { type: 'candidate', candidate: ev.candidate?.toJSON() ?? null })
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

    this.syncTracks(entry, localStream, screenTrack)

    if (initiate) void this.maybeOffer(peerId, true)
    this.scheduleRetry(peerId)
    this.events.onLink(peerId, pc.connectionState)
    return pc
  }

  /** Chỉ lấy PC — dùng khi xử lý signal, KHÔNG gửi offer. */
  private getOrCreate(peerId: string, localStream: MediaStream | null, screenTrack?: MediaStreamTrack | null) {
    const existing = this.peers.get(peerId)
    if (existing && existing.pc.connectionState !== 'closed' && existing.pc.connectionState !== 'failed') {
      this.syncTracks(existing, localStream, screenTrack)
      return existing.pc
    }
    return this.connect(peerId, localStream, screenTrack, false)
  }

  private syncTracks(entry: PeerEntry, localStream: MediaStream | null, screenTrack?: MediaStreamTrack | null) {
    const { pc } = entry
    const senders = pc.getSenders()

    if (localStream) {
      for (const track of localStream.getTracks()) {
        if (track.readyState === 'ended') continue
        const sender = senders.find((s) => s.track?.kind === track.kind)
        if (sender) {
          if (sender.track?.id !== track.id) void sender.replaceTrack(track)
        } else {
          pc.addTrack(track, localStream)
        }
      }
    }

    if (screenTrack && screenTrack.readyState !== 'ended') {
      if (entry.screenSender) {
        void entry.screenSender.replaceTrack(screenTrack)
      } else {
        const stream = new MediaStream([screenTrack])
        entry.screenSender = pc.addTrack(screenTrack, stream)
      }
    } else if (entry.screenSender) {
      void entry.screenSender.replaceTrack(null)
    }
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
    const pc = entry?.pc ?? this.getOrCreate(from, localStream, screenTrack)
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
        await pc.setLocalDescription(await pc.createAnswer())
        this.events.onSignal(from, { type: 'answer', sdp: this.desc(pc.localDescription) })
      } else if (payload.type === 'answer') {
        if (pc.signalingState !== 'have-local-offer') return
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        e.ignoreOffer = false
        await this.flushIce(from, pc)
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
    if (pc.signalingState !== 'stable') return
    if (entry.makingOffer) return

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
    } finally {
      entry.makingOffer = false
    }
  }

  renegotiateAll() {
    for (const id of this.peers.keys()) void this.maybeOffer(id, true)
  }

  publishScreen(screenTrack: MediaStreamTrack, localStream: MediaStream | null) {
    for (const [peerId, entry] of this.peers) {
      if (entry.screenSender) {
        void entry.screenSender.replaceTrack(screenTrack)
      } else {
        const stream = new MediaStream([screenTrack])
        entry.screenSender = entry.pc.addTrack(screenTrack, stream)
      }
      this.syncTracks(entry, localStream, screenTrack)
      void this.maybeOffer(peerId, true)
    }
  }

  unpublishScreen(localStream: MediaStream | null) {
    for (const [, entry] of this.peers) {
      if (entry.screenSender) void entry.screenSender.replaceTrack(null)
      entry.screenSender = null
      this.syncTracks(entry, localStream, null)
    }
  }

  peerIds() {
    return [...this.peers.keys()]
  }

  disconnect(peerId: string, _full = false) {
    const entry = this.peers.get(peerId)
    if (!entry) return
    this.clearRetry(peerId)
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
