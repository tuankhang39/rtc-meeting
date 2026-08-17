import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  get,
  increment,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from 'firebase/database'
import { getDb, connectDb } from '../lib/firebase'
import { acquireLocalMedia, acquireScreenShare, explainMediaError, explainScreenShareError } from '../lib/media'
import {
  buildPlayfulPayload,
  playfulAnnounceMessage,
  type PlayfulEffect,
  type PlayfulKind,
} from '../lib/playful'
import { quickCommentAnnounce, type QuickComment } from '../lib/quickComments'
import { playQuickCommentSound, unlockQuickAudio } from '../lib/quickAudio'
import type { DrawStroke } from '../lib/draw'
import type { ScreenSticker, StickerPackId } from '../lib/stickers'
import { MAX_PARTICIPANTS, createPeerConnection, randomId } from '../lib/webrtc'
import { markRoomEmptyIfNeeded, markRoomOccupied, sweepEmptyRooms } from '../lib/rooms'

export type Participant = {
  name: string
  mic: boolean
  camera: boolean
  sharing?: boolean
  isHost?: boolean
  joinedAt: number
  seenAt?: number
}

export type ChatMessage = {
  id: string
  userId: string
  name: string
  text: string
  createdAt: number
}

export type RoomReaction = {
  id: string
  emoji: string
  name: string
  userId: string
  x: number
  createdAt: number
}

export const FUN_EMOJIS = ['💖', '😂', '👏', '🔥', '🥺', '🎉', '✨', '🐰'] as const

const CUTE_HELLO = [
  'Vào phòng rồi đó, cute ghê ✨',
  'Xin chào mọi người 🐰',
  'Room hồng đã sẵn sàng 💖',
  'Ai đó vừa xuất hiện 🌸',
]

export type RemotePeer = {
  userId: string
  stream: MediaStream | null
  screenStream: MediaStream | null
  name: string
  mic: boolean
  camera: boolean
  sharing: boolean
  link: RTCPeerConnection['connectionState'] | 'none'
  hasAudio: boolean
  hasVideo: boolean
}

export type StarScore = {
  count: number
  name: string
}

export type StarGift = {
  id: string
  toUserId: string
  toName: string
  fromUserId: string
  fromName: string
  createdAt: number
}

type SignalPayload =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'candidate'; candidate: RTCIceCandidateInit }

type UseRoomOptions = {
  roomId: string
  displayName: string
  asHost?: boolean
}

export function useRoom({ roomId, displayName, asHost = false }: UseRoomOptions) {
  const userIdRef = useRef(randomId(10))
  const userId = userIdRef.current

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [remotes, setRemotes] = useState<RemotePeer[]>([])
  const [participants, setParticipants] = useState<Record<string, Participant>>({})
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [mediaWarning, setMediaWarning] = useState<string | null>(null)
  const [screenSharing, setScreenSharing] = useState(false)
  const [isHost] = useState(asHost)
  const [hostNotice, setHostNotice] = useState<string | null>(null)
  const [reactions, setReactions] = useState<RoomReaction[]>([])
  const [screenStickers, setScreenStickers] = useState<ScreenSticker[]>([])
  const [drawCommitted, setDrawCommitted] = useState<DrawStroke[]>([])
  const [drawLive, setDrawLive] = useState<DrawStroke[]>([])
  const [drawBoard, setDrawBoard] = useState(false)
  const drawStrokes = useMemo(() => [...drawCommitted, ...drawLive], [drawCommitted, drawLive])
  const [playfulByUser, setPlayfulByUser] = useState<Record<string, PlayfulEffect[]>>({})
  const [playfulToast, setPlayfulToast] = useState<string | null>(null)
  const [quickCommentToast, setQuickCommentToast] = useState<string | null>(null)
  const [starScores, setStarScores] = useState<Record<string, StarScore>>({})
  const [starFxByUser, setStarFxByUser] = useState<Record<string, StarGift[]>>({})
  const playfulCooldownRef = useRef<Record<string, number>>({})
  const starCooldownRef = useRef(0)
  const quickCommentCooldownRef = useRef(0)
  const skipEchoSpeakRef = useRef<{ commentId: string; at: number } | null>(null)
  const [joinToast, setJoinToast] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string | null>(null)

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const makingOfferRef = useRef<Map<string, boolean>>(new Map())
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map())
  const iceQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const signalChainRef = useRef<Map<string, Promise<void>>>(new Map())
  const remoteMediaRef = useRef<
    Map<string, { camera: MediaStream; screen: MediaStream; streamByTrack: Map<string, string> }>
  >(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const screenTrackRef = useRef<MediaStreamTrack | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const screenSharingRef = useRef(false)
  const stopScreenShareRef = useRef<() => Promise<void>>(async () => {})
  const applyMicRef = useRef<(on: boolean) => Promise<void>>(async () => {})
  const renegotiateAllRef = useRef<() => void>(() => {})
  const screenSendersRef = useRef(new Map<RTCPeerConnection, RTCRtpSender>())
  const sessionAliveRef = useRef(false)
  screenSharingRef.current = screenSharing
  const participantsRef = useRef<Record<string, Participant>>({})
  const displayNameRef = useRef(displayName)
  displayNameRef.current = displayName
  const isHostRef = useRef(asHost)
  isHostRef.current = asHost

  const publishScreenTrack = useCallback((track: MediaStreamTrack) => {
    track.contentHint = 'detail'
    let screen = screenStreamRef.current
    if (!screen) {
      screen = new MediaStream()
      screenStreamRef.current = screen
    }
    for (const t of [...screen.getVideoTracks()]) {
      if (t !== track) screen.removeTrack(t)
    }
    if (!screen.getTracks().some((t) => t.id === track.id)) screen.addTrack(track)
    setScreenStream(screen)
    let needOffer = false
    for (const pc of pcsRef.current.values()) {
      const sender = screenSendersRef.current.get(pc)
      if (sender) {
        void sender.replaceTrack(track)
      } else {
        screenSendersRef.current.set(pc, pc.addTrack(track, screen))
        needOffer = true
      }
    }
    if (needOffer) renegotiateAllRef.current()
  }, [])

  const unpublishScreenTrack = useCallback(() => {
    const track = screenTrackRef.current
    for (const pc of pcsRef.current.values()) {
      const sender = screenSendersRef.current.get(pc)
      if (sender) void sender.replaceTrack(null)
    }
    track?.stop()
    const screen = screenStreamRef.current
    if (screen && track) {
      try {
        screen.removeTrack(track)
      } catch {
        /* ignore */
      }
    }
    screenTrackRef.current = null
    setScreenStream(null)
  }, [])

  const removeRemote = useCallback((peerId: string) => {
    remoteMediaRef.current.delete(peerId)
    iceQueueRef.current.delete(peerId)
    makingOfferRef.current.delete(peerId)
    ignoreOfferRef.current.delete(peerId)
    setRemotes((prev) => prev.filter((p) => p.userId !== peerId))
  }, [])

  useEffect(() => {
    let cancelled = false
    sessionAliveRef.current = true
    const alive = () => sessionAliveRef.current && !cancelled
    const sessionStartedAt = Date.now()
    const STALE_MS = 120_000
    const cleanups: Array<() => void> = []
    const signalUnsubs = new Map<string, () => void>()
    const offerRetryTimers = new Map<string, number>()
    const lastRebuildAt = new Map<string, number>()
    const db = connectDb('room')

    const descInit = (desc: RTCSessionDescription | null): RTCSessionDescriptionInit => {
      if (!desc) throw new Error('missing session description')
      return { type: desc.type, sdp: desc.sdp }
    }

    const processedSignalKeys = new Set<string>()

    const listenPeerSignals = (from: string) => {
      if (!from || from === userId || signalUnsubs.has(from)) return
      const msgsRef = ref(db, `rooms/${roomId}/signals/${userId}/${from}`)

      const handleMsg = async (
        key: string | null,
        payload: SignalPayload & { createdAt?: number },
        msgRef: ReturnType<typeof ref>,
      ) => {
        if (!alive() || !key || !payload?.type) return
        const dedupe = `${from}/${key}`
        if (processedSignalKeys.has(dedupe)) return
        processedSignalKeys.add(dedupe)

        if (typeof payload.createdAt === 'number' && payload.createdAt < sessionStartedAt - 15_000) {
          void remove(msgRef)
          return
        }
        await enqueueSignal(from, payload)
        void remove(msgRef)
      }

      const unsubMsgs = onChildAdded(msgsRef, async (msgSnap) => {
        const payload = msgSnap.val() as SignalPayload & { createdAt?: number }
        await handleMsg(msgSnap.key, payload, msgSnap.ref)
      })
      signalUnsubs.set(from, unsubMsgs)
    }

    const sendSignal = async (to: string, payload: SignalPayload) => {
      if (!alive()) return
      const signalRef = push(ref(db, `rooms/${roomId}/signals/${to}/${userId}`))
      await set(signalRef, { ...payload, createdAt: Date.now() })
    }

    const upsertRemote = (peerId: string) => {
      const media = remoteMediaRef.current.get(peerId)
      const meta = participantsRef.current[peerId]
      const screenLive = Boolean(media?.screen.getVideoTracks().some((t) => t.readyState !== 'ended'))
      const audioTrack = media?.camera.getAudioTracks().find((t) => t.readyState !== 'ended')
      const videoTrack = media?.camera.getVideoTracks().find((t) => t.readyState !== 'ended')
      const hasMedia = Boolean(audioTrack || videoTrack)
      const pc = pcsRef.current.get(peerId)
      const peer: RemotePeer = {
        userId: peerId,
        name: meta?.name ?? peerId.slice(0, 6),
        mic: audioTrack ? meta?.mic !== false && audioTrack.enabled : (meta?.mic ?? false),
        camera: videoTrack ? meta?.camera !== false && videoTrack.enabled : (meta?.camera ?? false),
        sharing: meta?.sharing ?? screenLive,
        stream: hasMedia ? media!.camera : null,
        screenStream: screenLive ? media!.screen : null,
        link: pc?.connectionState ?? 'none',
        hasAudio: Boolean(audioTrack),
        hasVideo: Boolean(videoTrack),
      }
      setRemotes((prev) => {
        if (!prev.some((p) => p.userId === peerId)) return [...prev, peer]
        return prev.map((p) => (p.userId === peerId ? { ...p, ...peer } : p))
      })
    }

    const attachIncomingTrack = (peerId: string, ev: RTCTrackEvent) => {
      const track = ev.track
      const inbound = ev.streams[0]
      let media = remoteMediaRef.current.get(peerId)
      if (!media) {
        media = { camera: new MediaStream(), screen: new MediaStream(), streamByTrack: new Map() }
        remoteMediaRef.current.set(peerId, media)
      }
      if (inbound) {
        media.streamByTrack.set(track.id, inbound.id)
      } else {
        const pc = pcsRef.current.get(peerId)
        const videos =
          pc
            ?.getTransceivers()
            .map((t) => t.receiver.track)
            .filter((t) => t.kind === 'video' && t.readyState !== 'ended') ?? []
        const videoIdx = videos.findIndex((t) => t.id === track.id)
        media.streamByTrack.set(track.id, track.kind === 'audio' || videoIdx <= 0 ? `cam:${peerId}` : `screen:${peerId}`)
      }

      const rebalance = () => {
        const m = remoteMediaRef.current.get(peerId)
        if (!m) return
        const known = new Map<string, MediaStreamTrack>()
        for (const t of [...m.camera.getTracks(), ...m.screen.getTracks(), track]) {
          known.set(t.id, t)
        }
        const audio = [...known.values()].find((t) => t.kind === 'audio' && t.readyState !== 'ended')
        const cameraSid = audio ? m.streamByTrack.get(audio.id) : undefined

        for (const t of known.values()) {
          if (t.readyState === 'ended') {
            if (m.camera.getTracks().some((x) => x.id === t.id)) m.camera.removeTrack(t)
            if (m.screen.getTracks().some((x) => x.id === t.id)) m.screen.removeTrack(t)
            continue
          }
          const sid = m.streamByTrack.get(t.id)
          const camAlreadyHasVideo = m.camera
            .getVideoTracks()
            .some((x) => x.id !== t.id && x.readyState !== 'ended')
          const meta = participantsRef.current[peerId]
          const toScreen =
            t.kind === 'video' &&
            (Boolean(cameraSid && sid && sid !== cameraSid) ||
              camAlreadyHasVideo ||
              (meta?.sharing === true && meta.camera === false && !camAlreadyHasVideo))
          const dest = toScreen ? m.screen : m.camera
          const other = dest === m.screen ? m.camera : m.screen
          if (other.getTracks().some((x) => x.id === t.id)) other.removeTrack(t)
          if (!dest.getTracks().some((x) => x.id === t.id)) dest.addTrack(t)
        }
        upsertRemote(peerId)
      }

      rebalance()
      track.addEventListener('ended', rebalance)
    }

    const flushIce = async (from: string, pc: RTCPeerConnection) => {
      const queued = iceQueueRef.current.get(from)
      if (!queued?.length || !pc.remoteDescription) return
      iceQueueRef.current.set(from, [])
      for (const c of queued) {
        try {
          await pc.addIceCandidate(c)
        } catch (e) {
          if (!ignoreOfferRef.current.get(from)) console.error('addIceCandidate', e)
        }
      }
    }

    /** Chỉ 1 phía gửi offer (id lớn hơn) — tránh glare khi người 2 và 3 cùng nối. */
    const isOfferer = (peerId: string) => userId > peerId

    const teardownPeer = (peerId: string) => {
      const retry = offerRetryTimers.get(peerId)
      if (retry) {
        window.clearTimeout(retry)
        offerRetryTimers.delete(peerId)
      }
      const pc = pcsRef.current.get(peerId)
      if (pc) {
        screenSendersRef.current.delete(pc)
        pcsRef.current.delete(peerId)
        try {
          pc.close()
        } catch {
          /* ignore */
        }
      }
      signalUnsubs.get(peerId)?.()
      signalUnsubs.delete(peerId)
      signalChainRef.current.delete(peerId)
      iceQueueRef.current.delete(peerId)
      makingOfferRef.current.delete(peerId)
      ignoreOfferRef.current.delete(peerId)
      removeRemote(peerId)
      void remove(ref(db, `rooms/${roomId}/signals/${userId}/${peerId}`))
    }

    const startOffer = async (peerId: string, force = false) => {
      if (!alive()) return
      const pc = pcsRef.current.get(peerId)
      if (!pc) return
      if (!force && pc.signalingState !== 'stable') return
      if (makingOfferRef.current.get(peerId)) return
      const alreadyNegotiated = Boolean(pc.currentRemoteDescription ?? pc.remoteDescription)
      if (!force && !alreadyNegotiated && !isOfferer(peerId)) return
      if (force && !isOfferer(peerId) && !alreadyNegotiated) return
      makingOfferRef.current.set(peerId, true)
      try {
        if (force && pc.signalingState !== 'stable') {
          try {
            await pc.setLocalDescription({ type: 'rollback' })
          } catch {
            /* ignore */
          }
        }
        await pc.setLocalDescription(await pc.createOffer({ iceRestart: force && alreadyNegotiated }))
        if (!alive()) return
        const local = pc.localDescription
        if (!local) return
        await sendSignal(peerId, {
          type: 'offer',
          sdp: descInit(local),
        })
      } catch (e) {
        console.error('startOffer', e)
      } finally {
        makingOfferRef.current.set(peerId, false)
      }
    }

    const scheduleOfferRetry = (peerId: string) => {
      const prev = offerRetryTimers.get(peerId)
      if (prev) window.clearTimeout(prev)
      offerRetryTimers.set(
        peerId,
        window.setTimeout(() => {
          offerRetryTimers.delete(peerId)
          const pc = pcsRef.current.get(peerId)
          if (!pc) return
          if (pc.connectionState === 'connected') return
          if (!participantsRef.current[peerId] || !participantsRef.current[userId]) return
          if (!isOfferer(peerId) && pc.remoteDescription) return
          void startOffer(peerId, true)
        }, 2500),
      )
    }

    const ensurePeer = (peerId: string) => {
      const existing = pcsRef.current.get(peerId)
      if (existing) {
        const dead = existing.connectionState === 'closed' || existing.connectionState === 'failed'
        if (!dead) return existing
        teardownPeer(peerId)
      }

      const pc = createPeerConnection()
      pcsRef.current.set(peerId, pc)

      pc.ontrack = (ev) => attachIncomingTrack(peerId, ev)

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          void sendSignal(peerId, {
            type: 'candidate',
            candidate: ev.candidate.toJSON(),
          })
        }
      }

      pc.onnegotiationneeded = () => {
        void startOffer(peerId)
      }

      pc.onconnectionstatechange = () => {
        if (pcsRef.current.get(peerId) !== pc) return
        upsertRemote(peerId)
        if (pc.connectionState === 'disconnected') {
          window.setTimeout(() => {
            if (pcsRef.current.get(peerId) !== pc) return
            if (pc.connectionState !== 'disconnected' && pc.connectionState !== 'failed') return
            if (!alive()) return
            if (!participantsRef.current[peerId] || !participantsRef.current[userId]) return
            const prev = lastRebuildAt.get(peerId) ?? 0
            if (Date.now() - prev < 8000) return
            lastRebuildAt.set(peerId, Date.now())
            teardownPeer(peerId)
            ensurePeer(peerId)
          }, 4000)
        }
        if (pc.connectionState === 'failed') {
          try {
            pc.restartIce()
            void startOffer(peerId)
          } catch (e) {
            console.error('restartIce', e)
          }
          window.setTimeout(() => {
            if (pcsRef.current.get(peerId) !== pc) return
            if (pc.connectionState !== 'failed') return
            if (!alive()) return
            if (!participantsRef.current[peerId] || !participantsRef.current[userId]) return
            const prev = lastRebuildAt.get(peerId) ?? 0
            if (Date.now() - prev < 8000) return
            lastRebuildAt.set(peerId, Date.now())
            teardownPeer(peerId)
            ensurePeer(peerId)
          }, 1200)
        }
        if (pc.connectionState === 'closed') {
          if (pcsRef.current.get(peerId) === pc) teardownPeer(peerId)
        }
      }

      const stream = localStreamRef.current
      const liveTracks = stream?.getTracks().filter((t) => t.readyState !== 'ended') ?? []
      try {
        const audioTx = pc.addTransceiver('audio', { direction: 'sendrecv' })
        const videoTx = pc.addTransceiver('video', { direction: 'sendrecv' })
        if (stream && liveTracks.length > 0) {
          const at = stream.getAudioTracks().find((t) => t.readyState !== 'ended')
          const vt = stream.getVideoTracks().find((t) => t.readyState !== 'ended')
          if (at) void audioTx.sender.replaceTrack(at)
          if (vt) void videoTx.sender.replaceTrack(vt)
        }
      } catch (e) {
        console.error('addTransceiver', e)
        if (stream && liveTracks.length > 0) {
          for (const t of liveTracks) pc.addTrack(t, stream)
        }
      }
      if (screenTrackRef.current && screenStreamRef.current) {
        screenSendersRef.current.set(pc, pc.addTrack(screenTrackRef.current, screenStreamRef.current))
      }

      void startOffer(peerId)
      scheduleOfferRetry(peerId)
      upsertRemote(peerId)
      return pc
    }

    renegotiateAllRef.current = () => {
      for (const id of pcsRef.current.keys()) void startOffer(id)
    }

    const handleSignal = async (from: string, payload: SignalPayload) => {
      if (!alive()) return
      const polite = !isOfferer(from)
      const pc = ensurePeer(from)

      try {
        if (payload.type === 'offer') {
          if (pc.remoteDescription?.sdp && pc.remoteDescription.sdp === payload.sdp.sdp) return

          const makingOffer = makingOfferRef.current.get(from) === true
          const offerCollision = makingOffer || pc.signalingState !== 'stable'
          ignoreOfferRef.current.set(from, !polite && offerCollision)
          if (ignoreOfferRef.current.get(from)) return

          if (offerCollision && pc.signalingState !== 'stable') {
            try {
              await pc.setLocalDescription({ type: 'rollback' })
            } catch {
              // Chrome rollback ngầm trong setRemoteDescription
            }
          }

          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          ignoreOfferRef.current.set(from, false)
          await flushIce(from, pc)
          await pc.setLocalDescription(await pc.createAnswer())
          await sendSignal(from, {
            type: 'answer',
            sdp: descInit(pc.localDescription),
          })
        } else if (payload.type === 'answer') {
          if (pc.remoteDescription?.sdp && pc.remoteDescription.sdp === payload.sdp.sdp) return
          if (pc.signalingState !== 'have-local-offer') return
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          ignoreOfferRef.current.set(from, false)
          await flushIce(from, pc)
        } else if (payload.type === 'candidate') {
          if (!pc.remoteDescription) {
            const q = iceQueueRef.current.get(from) ?? []
            q.push(payload.candidate)
            iceQueueRef.current.set(from, q)
            return
          }
          try {
            await pc.addIceCandidate(payload.candidate)
          } catch (e) {
            if (!ignoreOfferRef.current.get(from)) throw e
          }
        }
      } catch (e) {
        console.error('handleSignal', from, payload.type, e)
      }
    }

    const enqueueSignal = (from: string, payload: SignalPayload) => {
      const prev = signalChainRef.current.get(from) ?? Promise.resolve()
      const next = prev.then(() => handleSignal(from, payload)).catch((e) => console.error('signal queue', e))
      signalChainRef.current.set(from, next)
      return next
    }

    async function boot() {
      try {
        const now = Date.now()
        const partsSnap = await get(ref(db, `rooms/${roomId}/participants`))
        const existing = (partsSnap.val() as Record<string, Participant> | null) ?? {}
        const liveIds = new Set<string>([userId])
        for (const [id, p] of Object.entries(existing)) {
          if (id === userId) continue
          const seen = typeof p.seenAt === 'number' ? p.seenAt : null
          const leftoverSession = typeof p.joinedAt === 'number' && now - p.joinedAt > 6 * 60 * 60 * 1000
          if ((seen != null && now - seen > STALE_MS) || (seen == null && leftoverSession)) {
            await remove(ref(db, `rooms/${roomId}/participants/${id}`))
            await remove(ref(db, `rooms/${roomId}/signals/${id}`))
            continue
          }
          liveIds.add(id)
        }
        const sigSnap = await get(ref(db, `rooms/${roomId}/signals`))
        const sigs = sigSnap.val() as Record<string, Record<string, unknown>> | null
        if (sigs) {
          for (const [to, froms] of Object.entries(sigs)) {
            if (!liveIds.has(to)) {
              await remove(ref(db, `rooms/${roomId}/signals/${to}`))
              continue
            }
            for (const from of Object.keys(froms || {})) {
              if (!liveIds.has(from)) {
                await remove(ref(db, `rooms/${roomId}/signals/${to}/${from}`))
              }
            }
          }
        }

        if (!alive()) return

        const liveCount = [...liveIds].filter((id) => id !== userId).length
        if (liveCount >= MAX_PARTICIPANTS) {
          setError(`Phòng đã đủ ${MAX_PARTICIPANTS} người`)
          setStatus('error')
          return
        }

        const media = await acquireLocalMedia()
        if (!alive()) {
          media.stream.getTracks().forEach((t) => t.stop())
          return
        }
        localStreamRef.current = media.stream
        setLocalStream(media.stream)
        cameraTrackRef.current = media.stream.getVideoTracks()[0] ?? null
        setMicOn(media.mic)
        setCamOn(media.camera)
        setMediaWarning(media.warning)

        const me: Participant = {
          name: displayNameRef.current.trim() || `User-${userId.slice(0, 4)}`,
          mic: media.mic,
          camera: media.camera,
          sharing: false,
          isHost: isHostRef.current,
          joinedAt: Date.now(),
          seenAt: Date.now(),
        }

        const meRef = ref(db, `rooms/${roomId}/participants/${userId}`)
        const signalsInRef = ref(db, `rooms/${roomId}/signals/${userId}`)

        const unsubSignals = onChildAdded(signalsInRef, (fromSnap) => {
          const from = fromSnap.key
          if (from) listenPeerSignals(from)
        })
        cleanups.push(() => {
          unsubSignals()
          for (const u of signalUnsubs.values()) u()
          signalUnsubs.clear()
        })

        const unsubParticipants = onValue(ref(db, `rooms/${roomId}/participants`), (snap) => {
          if (!alive()) return
          const val = (snap.val() as Record<string, Participant> | null) ?? {}
          participantsRef.current = val
          setParticipants(val)

          setRemotes((prev) =>
            prev.map((r) => {
              const meta = val[r.userId]
              if (!meta) return r
              const sharing = meta.sharing ?? false
              const audioTrack = r.stream?.getAudioTracks().find((t) => t.readyState !== 'ended')
              const videoTrack = r.stream?.getVideoTracks().find((t) => t.readyState !== 'ended')
              return {
                ...r,
                name: meta.name,
                mic: audioTrack ? meta.mic !== false && audioTrack.enabled : meta.mic,
                camera: videoTrack ? meta.camera !== false && videoTrack.enabled : meta.camera,
                sharing,
                screenStream: sharing ? r.screenStream : null,
              }
            }),
          )

          for (const peerId of [...pcsRef.current.keys()]) {
            if (!val[peerId]) teardownPeer(peerId)
          }

          if (!val[userId]) return

          for (const peerId of Object.keys(val)) {
            if (peerId === userId) continue
            listenPeerSignals(peerId)
            ensurePeer(peerId)
          }
        })
        cleanups.push(() => unsubParticipants())

        if (!alive()) {
          media.stream.getTracks().forEach((t) => t.stop())
          return
        }

        const joinTx = await runTransaction(ref(db, `rooms/${roomId}/participants`), (current) => {
          const cur = (current as Record<string, Participant> | null) ?? {}
          const others = Object.keys(cur).filter((id) => id !== userId).length
          if (others >= MAX_PARTICIPANTS && !cur[userId]) return
          return { ...cur, [userId]: me }
        })
        if (!alive()) {
          media.stream.getTracks().forEach((t) => t.stop())
          void remove(meRef)
          return
        }
        if (!joinTx.committed) {
          media.stream.getTracks().forEach((t) => t.stop())
          setError(`Phòng đã đủ ${MAX_PARTICIPANTS} người`)
          setStatus('error')
          return
        }

        const joined = (joinTx.snapshot.val() as Record<string, Participant> | null) ?? {
          [userId]: me,
        }
        participantsRef.current = joined
        setParticipants(joined)
        for (const peerId of Object.keys(joined)) {
          if (peerId === userId) continue
          listenPeerSignals(peerId)
          ensurePeer(peerId)
        }

        await set(ref(db, `rooms/${roomId}/stars/${userId}`), { count: 0, name: me.name })

        const signalsRef = ref(db, `rooms/${roomId}/signals/${userId}`)
        const modRef = ref(db, `rooms/${roomId}/moderation/${userId}`)

        const armDisconnect = async () => {
          await onDisconnect(meRef).remove()
          await onDisconnect(signalsRef).remove()
          await onDisconnect(modRef).remove()
        }

        const writePresence = () => {
          if (!alive()) return Promise.resolve()
          return set(meRef, {
            name: displayNameRef.current.trim() || `User-${userId.slice(0, 4)}`,
            mic: localStreamRef.current?.getAudioTracks().some((t) => t.enabled) ?? me.mic,
            camera: Boolean(cameraTrackRef.current && cameraTrackRef.current.readyState === 'live'),
            sharing: screenSharingRef.current,
            isHost: isHostRef.current,
            joinedAt: me.joinedAt,
            seenAt: Date.now(),
          })
        }

        if (!alive()) {
          media.stream.getTracks().forEach((t) => t.stop())
          void remove(meRef)
          return
        }
        await armDisconnect()

        const heartbeat = window.setInterval(() => {
          if (!alive()) return
          void update(meRef, { seenAt: Date.now() }).catch(() => {})
        }, 20_000)
        cleanups.push(() => window.clearInterval(heartbeat))

        const unsubConnected = onValue(ref(db, '.info/connected'), async (snap) => {
          if (!alive() || snap.val() !== true) return
          try {
            await armDisconnect()
            if (!alive()) return
            await writePresence()
          } catch (e) {
            console.error('armDisconnect', e)
          }
        })
        cleanups.push(() => unsubConnected())

        const hangUp = (ev?: Event) => {
          if (ev && 'persisted' in ev && (ev as PageTransitionEvent).persisted) return
          sessionAliveRef.current = false
          cancelled = true
          for (const id of offerRetryTimers.values()) window.clearTimeout(id)
          offerRetryTimers.clear()
          for (const pc of pcsRef.current.values()) {
            try {
              pc.close()
            } catch {
              /* ignore */
            }
          }
          pcsRef.current.clear()
          localStreamRef.current?.getTracks().forEach((t) => t.stop())
          screenTrackRef.current?.stop()
          void remove(meRef)
          void remove(signalsRef)
          void remove(modRef)
        }
        window.addEventListener('pagehide', hangUp)
        cleanups.push(() => {
          window.removeEventListener('pagehide', hangUp)
        })

        const metaSnap = await get(ref(db, `rooms/${roomId}/meta`))
        if (!alive()) return
        const existingMeta = (metaSnap.val() as {
          name?: string
          description?: string | null
          persistent?: boolean
          createdAt?: number
          hostName?: string | null
        } | null) ?? {}
        const persistent = existingMeta.persistent === true
        const roomTitle = existingMeta.name?.trim() || `Phòng ${roomId}`
        setRoomName(roomTitle)

        const metaUpdate: Record<string, unknown> = {
          updatedAt: Date.now(),
          maxParticipants: MAX_PARTICIPANTS,
          emptyAt: null,
          persistent,
          name: roomTitle,
          createdAt: existingMeta.createdAt ?? Date.now(),
        }
        if (existingMeta.description != null) metaUpdate.description = existingMeta.description
        if (isHostRef.current) {
          metaUpdate.hostId = userId
          metaUpdate.hostName = me.name
        }
        await update(ref(db, `rooms/${roomId}/meta`), metaUpdate)
        if (!alive()) return
        await markRoomOccupied(roomId, {
          name: roomTitle,
          description: existingMeta.description ?? null,
          persistent,
          createdAt: (existingMeta.createdAt as number | undefined) ?? Date.now(),
          hostName: isHostRef.current ? me.name : existingMeta.hostName ?? null,
        })
        if (!alive()) return
        void sweepEmptyRooms(roomId).catch(() => {})

        const unsubMeta = onValue(ref(db, `rooms/${roomId}/meta`), (snap) => {
          const name = (snap.val() as { name?: string } | null)?.name?.trim()
          if (name) setRoomName(name)
        })
        cleanups.push(() => unsubMeta())

        const unsubChat = onChildAdded(ref(db, `rooms/${roomId}/chat`), (snap) => {
          const val = snap.val() as Omit<ChatMessage, 'id'> | null
          if (!val || !snap.key) return
          setMessages((prev) => {
            if (prev.some((m) => m.id === snap.key)) return prev
            return [...prev, { id: snap.key!, ...val }].slice(-100)
          })
        })
        cleanups.push(() => unsubChat())

        // Host mute commands
        const unsubMod = onChildAdded(ref(db, `rooms/${roomId}/moderation/${userId}`), async (snap) => {
          const cmd = snap.val() as { type?: string; byName?: string } | null
          if (cmd?.type === 'mute') {
            await applyMicRef.current(false)
            setHostNotice(cmd.byName ? `Host (${cmd.byName}) đã tắt mic của bạn` : 'Host đã tắt mic của bạn')
            window.setTimeout(() => setHostNotice(null), 4000)
          }
          void remove(snap.ref)
        })
        cleanups.push(() => unsubMod())

        const unsubReactions = onChildAdded(ref(db, `rooms/${roomId}/reactions`), (snap) => {
          const val = snap.val() as Omit<RoomReaction, 'id'> | null
          if (!val?.emoji || !snap.key) return
          // Ignore very old reactions (reconnect)
          if (Date.now() - (val.createdAt ?? 0) > 8000) return
          const item: RoomReaction = { id: snap.key, ...val }
          setReactions((prev) => [...prev.slice(-20), item])
          window.setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== snap.key))
          }, 2800)
        })
        cleanups.push(() => unsubReactions())

        const unsubStickers = onValue(ref(db, `rooms/${roomId}/stickers`), (snap) => {
          const val = (snap.val() as Record<string, Omit<ScreenSticker, 'id'>> | null) ?? {}
          const list: ScreenSticker[] = Object.entries(val).map(([id, s]) => ({ id, ...s }))
          list.sort((a, b) => a.createdAt - b.createdAt)
          setScreenStickers(list.slice(-40))
        })
        cleanups.push(() => unsubStickers())

        const unsubDraw = onValue(ref(db, `rooms/${roomId}/drawings`), (snap) => {
          const val = (snap.val() as Record<string, Omit<DrawStroke, 'id'>> | null) ?? {}
          const list: DrawStroke[] = Object.entries(val)
            .map(([id, s]) => ({
              id,
              ...s,
              kind: s.kind === 'text' ? ('text' as const) : ('stroke' as const),
              points: Array.isArray(s.points) ? s.points : [],
              text: typeof s.text === 'string' ? s.text : '',
              x: typeof s.x === 'number' ? s.x : 0,
              y: typeof s.y === 'number' ? s.y : 0,
              size: typeof s.size === 'number' ? s.size : 4,
            }))
            .filter((s) => (s.kind === 'text' ? Boolean(s.text?.trim()) : s.points.length > 0))
          list.sort((a, b) => a.createdAt - b.createdAt)
          setDrawCommitted(list.slice(-80))
        })
        cleanups.push(() => unsubDraw())

        const unsubDrawLive = onValue(ref(db, `rooms/${roomId}/drawLive`), (snap) => {
          const val = (snap.val() as Record<string, Omit<DrawStroke, 'id'>> | null) ?? {}
          const list: DrawStroke[] = Object.entries(val)
            .map(([id, s]) => ({
              id: `live-${id}`,
              ...s,
              kind: s.kind === 'text' ? ('text' as const) : ('stroke' as const),
              points: Array.isArray(s.points) ? s.points : [],
              text: typeof s.text === 'string' ? s.text : '',
              x: typeof s.x === 'number' ? s.x : 0,
              y: typeof s.y === 'number' ? s.y : 0,
              size: typeof s.size === 'number' ? s.size : 4,
              userId: s.userId || id,
              name: s.name || '',
              createdAt: s.createdAt || 0,
            }))
            .filter((s) => (s.kind === 'text' ? Boolean(String(s.text || '').trim()) : s.points.length > 0))
          setDrawLive(list)
        })
        cleanups.push(() => unsubDrawLive())

        const unsubBoard = onValue(ref(db, `rooms/${roomId}/drawBoard`), (snap) => {
          const val = snap.val() as { on?: boolean } | null
          setDrawBoard(Boolean(val?.on))
        })
        cleanups.push(() => unsubBoard())

        const unsubPlayful = onChildAdded(ref(db, `rooms/${roomId}/playful`), (snap) => {
          const val = snap.val() as Omit<PlayfulEffect, 'id'> | null
          if (!val?.kind || !val.toUserId || !snap.key) return
          if (Date.now() - (val.createdAt ?? 0) > 8000) return

          const effect: PlayfulEffect = {
            id: snap.key,
            ...val,
            toName: val.toName || 'ai đó',
            fromName: val.fromName || 'Ai đó',
          }
          setPlayfulByUser((prev) => ({
            ...prev,
            [val.toUserId]: [...(prev[val.toUserId] ?? []).slice(-2), effect],
          }))
          window.setTimeout(() => {
            setPlayfulByUser((prev) => ({
              ...prev,
              [val.toUserId]: (prev[val.toUserId] ?? []).filter((e) => e.id !== snap.key),
            }))
          }, 3200)

          const announce = playfulAnnounceMessage(
            val.kind,
            effect.fromName,
            effect.toName,
            val.label,
            userId,
            val.fromUserId,
            val.toUserId,
          )
          setPlayfulToast(announce)
          window.setTimeout(() => setPlayfulToast(null), 3500)
          // Phần Chọc: chỉ toast + animation, không đọc giọng
        })
        cleanups.push(() => unsubPlayful())

        const unsubStars = onValue(ref(db, `rooms/${roomId}/stars`), (snap) => {
          const val = (snap.val() as Record<string, StarScore> | null) ?? {}
          setStarScores(val)
        })
        cleanups.push(() => unsubStars())

        const unsubStarGifts = onChildAdded(ref(db, `rooms/${roomId}/starGifts`), (snap) => {
          const val = snap.val() as Omit<StarGift, 'id'> | null
          if (!val?.toUserId || !snap.key) return
          if (Date.now() - (val.createdAt ?? 0) > 8000) return
          const gift: StarGift = { id: snap.key, ...val }
          setStarFxByUser((prev) => ({
            ...prev,
            [val.toUserId]: [...(prev[val.toUserId] ?? []).slice(-3), gift],
          }))
          window.setTimeout(() => {
            setStarFxByUser((prev) => ({
              ...prev,
              [val.toUserId]: (prev[val.toUserId] ?? []).filter((g) => g.id !== snap.key),
            }))
          }, 1800)
          const from = val.fromName || 'Ai đó'
          const to = val.toName || 'học viên'
          const mine = val.toUserId === userId
          setPlayfulToast(mine ? `${from} tặng bạn một ngôi sao ⭐` : `${from} tặng sao cho ${to} ⭐`)
          window.setTimeout(() => setPlayfulToast(null), 2800)
        })
        cleanups.push(() => unsubStarGifts())

        const unsubQuickComments = onChildAdded(ref(db, `rooms/${roomId}/quickComments`), (snap) => {
          const val = snap.val() as {
            text?: string
            emoji?: string
            commentId?: string
            fromUserId?: string
            fromName?: string
            createdAt?: number
          } | null
          if (!val?.text || !snap.key) return
          if (Date.now() - (val.createdAt ?? 0) > 8000) return

          const announce = quickCommentAnnounce(
            val.fromName || 'Ai đó',
            val.text,
            userId,
            val.fromUserId,
          )
          setQuickCommentToast(announce)
          window.setTimeout(() => setQuickCommentToast(null), 3500)

          const commentId = val.commentId
          if (!commentId) return

          const skip = skipEchoSpeakRef.current
          if (
            skip &&
            val.fromUserId === userId &&
            skip.commentId === commentId &&
            Date.now() - skip.at < 5000
          ) {
            skipEchoSpeakRef.current = null
          } else {
            playQuickCommentSound(commentId, snap.key)
          }
        })
        cleanups.push(() => unsubQuickComments())

        // Cute join notice for others via chat-like system message... local toast for self
        setJoinToast(CUTE_HELLO[Math.floor(Math.random() * CUTE_HELLO.length)] ?? CUTE_HELLO[0])

        setStatus('ready')
      } catch (e) {
        console.error(e)
        setError(explainMediaError(e))
        setStatus('error')
      }
    }

    void boot()

    return () => {
      sessionAliveRef.current = false
      cancelled = true
      renegotiateAllRef.current = () => {}
      screenSendersRef.current.clear()
      for (const id of offerRetryTimers.values()) window.clearTimeout(id)
      offerRetryTimers.clear()
      for (const c of cleanups) c()
      for (const pc of pcsRef.current.values()) pc.close()
      pcsRef.current.clear()
      makingOfferRef.current.clear()
      ignoreOfferRef.current.clear()
      iceQueueRef.current.clear()
      signalChainRef.current.clear()
      remoteMediaRef.current.clear()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenTrackRef.current?.stop()
      screenTrackRef.current = null
      screenStreamRef.current = null
      cameraTrackRef.current = null
      void remove(ref(db, `rooms/${roomId}/participants/${userId}`))
        .then(() => markRoomEmptyIfNeeded(roomId))
      void remove(ref(db, `rooms/${roomId}/signals/${userId}`))
      void remove(ref(db, `rooms/${roomId}/moderation/${userId}`))
    }
  }, [removeRemote, roomId, userId])

  const applyMic = useCallback(
    async (on: boolean) => {
      if (!sessionAliveRef.current) return
      const stream = localStreamRef.current
      if (!stream) return
      stream.getAudioTracks().forEach((t) => {
        t.enabled = on
      })
      setMicOn(on)
      await update(ref(getDb(), `rooms/${roomId}/participants/${userId}`), { mic: on })
    },
    [roomId, userId],
  )
  applyMicRef.current = applyMic

  const stopScreenShare = useCallback(async () => {
    if (!screenSharingRef.current && !screenTrackRef.current) return
    unpublishScreenTrack()
    setScreenSharing(false)
    await update(ref(getDb(), `rooms/${roomId}/participants/${userId}`), {
      sharing: false,
    })
    // Xóa sticker / nét vẽ trên màn share khi dừng share
    await remove(ref(getDb(), `rooms/${roomId}/stickers`))
    await remove(ref(getDb(), `rooms/${roomId}/drawings`))
    await remove(ref(getDb(), `rooms/${roomId}/drawLive`))
    await remove(ref(getDb(), `rooms/${roomId}/drawBoard`))
  }, [roomId, unpublishScreenTrack, userId])

  stopScreenShareRef.current = stopScreenShare

  const startScreenShare = useCallback(async () => {
    if (screenSharingRef.current) return true
    try {
      const track = await acquireScreenShare()
      screenTrackRef.current = track
      track.onended = () => {
        void stopScreenShareRef.current()
      }
      publishScreenTrack(track)
      setScreenSharing(true)
      await update(ref(getDb(), `rooms/${roomId}/participants/${userId}`), {
        sharing: true,
      })
      return true
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'NotAllowedError')) {
        setMediaWarning(explainScreenShareError(e))
      }
      return false
    }
  }, [publishScreenTrack, roomId, userId])

  const toggleScreenShare = useCallback(async () => {
    if (screenSharingRef.current) {
      await stopScreenShare()
      return false
    }
    return startScreenShare()
  }, [startScreenShare, stopScreenShare])

  const toggleMic = useCallback(async () => {
    await applyMic(!micOn)
  }, [applyMic, micOn])

  const muteRemote = useCallback(
    async (targetId: string) => {
      if (!isHostRef.current || targetId === userId) return
      const db = getDb()
      await push(ref(db, `rooms/${roomId}/moderation/${targetId}`), {
        type: 'mute',
        by: userId,
        byName: displayNameRef.current.trim() || 'Host',
        at: Date.now(),
      })
      // Optimistic UI for host view
      await update(ref(db, `rooms/${roomId}/participants/${targetId}`), { mic: false })
    },
    [roomId, userId],
  )

  const toggleCam = useCallback(async () => {
    const stream = localStreamRef.current
    if (!stream) return
    const cam = cameraTrackRef.current
    const next = !camOn
    if (cam && cam.readyState === 'live') {
      cam.enabled = next
    } else {
      stream.getVideoTracks().forEach((t) => {
        if (t !== screenTrackRef.current) t.enabled = next
      })
    }
    setCamOn(next)
    await update(ref(getDb(), `rooms/${roomId}/participants/${userId}`), { camera: next })
  }, [camOn, roomId, userId])

  const sendChat = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      await push(ref(getDb(), `rooms/${roomId}/chat`), {
        userId,
        name: displayNameRef.current.trim() || `User-${userId.slice(0, 4)}`,
        text: trimmed,
        createdAt: Date.now(),
      })
    },
    [roomId, userId],
  )

  const sendReaction = useCallback(
    async (emoji: string) => {
      await push(ref(getDb(), `rooms/${roomId}/reactions`), {
        emoji,
        userId,
        name: displayNameRef.current.trim() || `User-${userId.slice(0, 4)}`,
        x: 12 + Math.random() * 76,
        createdAt: Date.now(),
      })
    },
    [roomId, userId],
  )

  const placeScreenSticker = useCallback(
    async (emoji: string, pack: StickerPackId, x: number, y: number) => {
      await push(ref(getDb(), `rooms/${roomId}/stickers`), {
        emoji,
        pack,
        x: Math.min(96, Math.max(4, x)),
        y: Math.min(96, Math.max(4, y)),
        userId,
        name: displayNameRef.current.trim() || `User-${userId.slice(0, 4)}`,
        createdAt: Date.now(),
      })
    },
    [roomId, userId],
  )

  const removeScreenSticker = useCallback(
    async (stickerId: string) => {
      await remove(ref(getDb(), `rooms/${roomId}/stickers/${stickerId}`))
    },
    [roomId],
  )

  const clearScreenStickers = useCallback(async () => {
    await remove(ref(getDb(), `rooms/${roomId}/stickers`))
  }, [roomId])

  const giveStar = useCallback(
    async (targetId: string, targetName?: string) => {
      if (!isHostRef.current || targetId === userId) return
      const now = Date.now()
      if (now - starCooldownRef.current < 700) return
      starCooldownRef.current = now

      const fromName = displayNameRef.current.trim() || `User-${userId.slice(0, 4)}`
      const toName =
        targetName?.trim() ||
        participants[targetId]?.name ||
        starScores[targetId]?.name ||
        `User-${targetId.slice(0, 4)}`

      const db = getDb()
      await update(ref(db, `rooms/${roomId}/stars/${targetId}`), {
        count: increment(1),
        name: toName,
      })
      await push(ref(db, `rooms/${roomId}/starGifts`), {
        toUserId: targetId,
        toName,
        fromUserId: userId,
        fromName,
        createdAt: Date.now(),
      })
    },
    [participants, roomId, starScores, userId],
  )

  const sendPlayful = useCallback(
    async (targetId: string, kind: PlayfulKind, targetName?: string) => {
      if (targetId === userId) return
      const key = `${targetId}:${kind}`
      const now = Date.now()
      if (now - (playfulCooldownRef.current[key] ?? 0) < 2000) return
      playfulCooldownRef.current[key] = now

      const fromName = displayNameRef.current.trim() || `User-${userId.slice(0, 4)}`
      const toName =
        targetName?.trim() ||
        participants[targetId]?.name ||
        `User-${targetId.slice(0, 4)}`
      const payload = buildPlayfulPayload(kind, targetId, toName, userId, fromName)
      await push(ref(getDb(), `rooms/${roomId}/playful`), payload)
    },
    [participants, roomId, userId],
  )

  const sendQuickComment = useCallback(
    async (comment: QuickComment) => {
      if (!isHostRef.current) return
      const now = Date.now()
      if (now - quickCommentCooldownRef.current < 800) return
      quickCommentCooldownRef.current = now

      unlockQuickAudio()
      skipEchoSpeakRef.current = { commentId: comment.id, at: Date.now() }
      playQuickCommentSound(comment.id)

      const fromName = displayNameRef.current.trim() || `User-${userId.slice(0, 4)}`
      await push(ref(getDb(), `rooms/${roomId}/quickComments`), {
        commentId: comment.id,
        text: comment.text,
        emoji: comment.emoji,
        fromUserId: userId,
        fromName,
        createdAt: Date.now(),
      })
    },
    [roomId, userId],
  )

  const leave = useCallback(async () => {
    sessionAliveRef.current = false
    unpublishScreenTrack()
    for (const pc of pcsRef.current.values()) pc.close()
    pcsRef.current.clear()
    makingOfferRef.current.clear()
    ignoreOfferRef.current.clear()
    iceQueueRef.current.clear()
    signalChainRef.current.clear()
    remoteMediaRef.current.clear()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    await remove(ref(getDb(), `rooms/${roomId}/participants/${userId}`))
    await remove(ref(getDb(), `rooms/${roomId}/signals/${userId}`))
    await remove(ref(getDb(), `rooms/${roomId}/moderation/${userId}`))
    await markRoomEmptyIfNeeded(roomId)
  }, [roomId, unpublishScreenTrack, userId])

  return {
    userId,
    localStream,
    screenStream,
    remotes,
    participants,
    messages,
    micOn,
    camOn,
    status,
    error,
    mediaWarning,
    screenSharing,
    isHost,
    roomName,
    hostNotice,
    joinToast,
    reactions,
    screenStickers,
    drawStrokes,
    drawBoard,
    playfulByUser,
    playfulToast,
    quickCommentToast,
    starScores,
    starFxByUser,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    muteRemote,
    sendChat,
    sendReaction,
    sendPlayful,
    giveStar,
    sendQuickComment,
    placeScreenSticker,
    removeScreenSticker,
    clearScreenStickers,
    leave,
  }
}
