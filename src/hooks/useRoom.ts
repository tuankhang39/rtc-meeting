import { useCallback, useEffect, useRef, useState } from 'react'
import {
  get,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from 'firebase/database'
import { getDb } from '../lib/firebase'
import { acquireLocalMedia, acquireScreenShare, explainMediaError, explainScreenShareError } from '../lib/media'
import { MAX_PARTICIPANTS, createPeerConnection, randomId } from '../lib/webrtc'

export type Participant = {
  name: string
  mic: boolean
  camera: boolean
  sharing?: boolean
  joinedAt: number
}

export type ChatMessage = {
  id: string
  userId: string
  name: string
  text: string
  createdAt: number
}

export type RemotePeer = {
  userId: string
  stream: MediaStream | null
  screenStream: MediaStream | null
  name: string
  mic: boolean
  camera: boolean
  sharing: boolean
}

type SignalPayload =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'candidate'; candidate: RTCIceCandidateInit }

type UseRoomOptions = {
  roomId: string
  displayName: string
}

export function useRoom({ roomId, displayName }: UseRoomOptions) {
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

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const makingOfferRef = useRef<Map<string, boolean>>(new Map())
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const screenTrackRef = useRef<MediaStreamTrack | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const screenSharingRef = useRef(false)
  const stopScreenShareRef = useRef<() => Promise<void>>(async () => {})
  screenSharingRef.current = screenSharing
  const participantsRef = useRef<Record<string, Participant>>({})
  const displayNameRef = useRef(displayName)
  displayNameRef.current = displayName

  const publishScreenTrack = useCallback((track: MediaStreamTrack) => {
    const screen = new MediaStream([track])
    screenStreamRef.current = screen
    setScreenStream(screen)
    for (const pc of pcsRef.current.values()) {
      const already = pc.getSenders().some((s) => s.track?.id === track.id)
      if (!already) pc.addTrack(track, screen)
    }
  }, [])

  const unpublishScreenTrack = useCallback(() => {
    const track = screenTrackRef.current
    for (const pc of pcsRef.current.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.track && (sender.track === track || sender.track.id === track?.id)) {
          pc.removeTrack(sender)
        }
      }
    }
    track?.stop()
    screenTrackRef.current = null
    screenStreamRef.current = null
    setScreenStream(null)
  }, [])

  const removeRemote = useCallback((peerId: string) => {
    setRemotes((prev) => prev.filter((p) => p.userId !== peerId))
  }, [])

  useEffect(() => {
    let cancelled = false
    const cleanups: Array<() => void> = []
    const signalUnsubs = new Map<string, () => void>()
    const db = getDb()

    const sendSignal = async (to: string, payload: SignalPayload) => {
      const signalRef = push(ref(db, `rooms/${roomId}/signals/${to}/${userId}`))
      await set(signalRef, { ...payload, createdAt: Date.now() })
    }

    const ensurePeer = (peerId: string) => {
      const existing = pcsRef.current.get(peerId)
      if (existing) return existing

      const pc = createPeerConnection()
      pcsRef.current.set(peerId, pc)

      const stream = localStreamRef.current
      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream)
        }
      }
      if (screenTrackRef.current && screenStreamRef.current) {
        pc.addTrack(screenTrackRef.current, screenStreamRef.current)
      }

      pc.ontrack = (ev) => {
        const [remoteStream] = ev.streams
        const meta = participantsRef.current[peerId]
        const base = {
          userId: peerId,
          name: meta?.name ?? peerId.slice(0, 6),
          mic: meta?.mic ?? true,
          camera: meta?.camera ?? true,
          sharing: meta?.sharing ?? false,
        }

        setRemotes((prev) => {
          const existing = prev.find((p) => p.userId === peerId)
          const hasCamera = Boolean(existing?.stream?.getVideoTracks().length)
          const incomingVideo = remoteStream.getVideoTracks().length > 0

          let stream = existing?.stream ?? null
          let screen = existing?.screenStream ?? null

          if (incomingVideo && hasCamera && remoteStream.id !== existing?.stream?.id) {
            screen = remoteStream
          } else if (incomingVideo && meta?.sharing && hasCamera) {
            screen = remoteStream
          } else if (incomingVideo && meta?.sharing && !hasCamera) {
            // Peer joined already sharing: first video = screen until camera arrives
            screen = remoteStream
            if (!stream) stream = remoteStream
          } else {
            stream = remoteStream
          }

          const peer: RemotePeer = {
            ...base,
            stream,
            screenStream: screen,
          }
          if (!existing) return [...prev, peer]
          return prev.map((p) => (p.userId === peerId ? { ...p, ...peer } : p))
        })
      }

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          void sendSignal(peerId, {
            type: 'candidate',
            candidate: ev.candidate.toJSON(),
          })
        }
      }

      pc.onnegotiationneeded = async () => {
        try {
          makingOfferRef.current.set(peerId, true)
          await pc.setLocalDescription(await pc.createOffer())
          await sendSignal(peerId, {
            type: 'offer',
            sdp: pc.localDescription!.toJSON(),
          })
        } catch (e) {
          console.error('negotiationneeded', e)
        } finally {
          makingOfferRef.current.set(peerId, false)
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          pc.close()
          pcsRef.current.delete(peerId)
          removeRemote(peerId)
        }
      }

      return pc
    }

    const handleSignal = async (from: string, payload: SignalPayload) => {
      const myJoined = participantsRef.current[userId]?.joinedAt ?? 0
      const theirJoined = participantsRef.current[from]?.joinedAt ?? 0
      const polite = myJoined < theirJoined
      const pc = ensurePeer(from)

      try {
        if (payload.type === 'offer') {
          const makingOffer = makingOfferRef.current.get(from)
          const offerCollision = Boolean(makingOffer) || pc.signalingState !== 'stable'
          ignoreOfferRef.current.set(from, !polite && offerCollision)
          if (ignoreOfferRef.current.get(from)) return

          await pc.setRemoteDescription(payload.sdp)
          await pc.setLocalDescription(await pc.createAnswer())
          await sendSignal(from, {
            type: 'answer',
            sdp: pc.localDescription!.toJSON(),
          })
        } else if (payload.type === 'answer') {
          if (pc.signalingState !== 'have-local-offer') return
          await pc.setRemoteDescription(payload.sdp)
        } else if (payload.type === 'candidate') {
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

    async function boot() {
      try {
        const participantsSnap = await get(ref(db, `rooms/${roomId}/participants`))
        const existing = participantsSnap.val() as Record<string, Participant> | null
        const count = existing ? Object.keys(existing).length : 0
        if (count >= MAX_PARTICIPANTS) {
          setError(`Phòng đã đủ ${MAX_PARTICIPANTS} người`)
          setStatus('error')
          return
        }

        const media = await acquireLocalMedia()
        if (cancelled) {
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
          joinedAt: Date.now(),
        }

        const meRef = ref(db, `rooms/${roomId}/participants/${userId}`)
        await set(meRef, me)
        await onDisconnect(meRef).remove()
        await onDisconnect(ref(db, `rooms/${roomId}/signals/${userId}`)).remove()

        await update(ref(db, `rooms/${roomId}/meta`), {
          updatedAt: Date.now(),
          maxParticipants: MAX_PARTICIPANTS,
        })

        const unsubParticipants = onValue(ref(db, `rooms/${roomId}/participants`), (snap) => {
          const val = (snap.val() as Record<string, Participant> | null) ?? {}
          participantsRef.current = val
          setParticipants(val)

          setRemotes((prev) =>
            prev.map((r) => {
              const meta = val[r.userId]
              if (!meta) return r
              const sharing = meta.sharing ?? false
              return {
                ...r,
                name: meta.name,
                mic: meta.mic,
                camera: meta.camera,
                sharing,
                screenStream: sharing ? r.screenStream : null,
              }
            }),
          )

          const myJoined = val[userId]?.joinedAt
          if (!myJoined) return

          for (const [peerId, peer] of Object.entries(val)) {
            if (peerId === userId) continue
            // Joiner (newer) initiates toward existing peers
            if (peer.joinedAt < myJoined) ensurePeer(peerId)
          }

          for (const peerId of [...pcsRef.current.keys()]) {
            if (!val[peerId]) {
              pcsRef.current.get(peerId)?.close()
              pcsRef.current.delete(peerId)
              removeRemote(peerId)
            }
          }
        })
        cleanups.push(() => unsubParticipants())

        const unsubSignals = onChildAdded(ref(db, `rooms/${roomId}/signals/${userId}`), (fromSnap) => {
          const from = fromSnap.key
          if (!from || signalUnsubs.has(from)) return
          const unsubMsgs = onChildAdded(fromSnap.ref, async (msgSnap) => {
            const payload = msgSnap.val() as SignalPayload & { createdAt?: number }
            if (!payload?.type) return
            await handleSignal(from, payload)
            void remove(msgSnap.ref)
          })
          signalUnsubs.set(from, unsubMsgs)
        })
        cleanups.push(() => {
          unsubSignals()
          for (const u of signalUnsubs.values()) u()
          signalUnsubs.clear()
        })

        const unsubChat = onChildAdded(ref(db, `rooms/${roomId}/chat`), (snap) => {
          const val = snap.val() as Omit<ChatMessage, 'id'> | null
          if (!val || !snap.key) return
          setMessages((prev) => {
            if (prev.some((m) => m.id === snap.key)) return prev
            return [...prev, { id: snap.key!, ...val }].slice(-100)
          })
        })
        cleanups.push(() => unsubChat())

        setStatus('ready')
      } catch (e) {
        console.error(e)
        setError(explainMediaError(e))
        setStatus('error')
      }
    }

    void boot()

    return () => {
      cancelled = true
      for (const c of cleanups) c()
      for (const pc of pcsRef.current.values()) pc.close()
      pcsRef.current.clear()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenTrackRef.current?.stop()
      screenTrackRef.current = null
      screenStreamRef.current = null
      cameraTrackRef.current = null
      void remove(ref(db, `rooms/${roomId}/participants/${userId}`))
      void remove(ref(db, `rooms/${roomId}/signals/${userId}`))
    }
  }, [removeRemote, roomId, userId])

  const stopScreenShare = useCallback(async () => {
    if (!screenSharingRef.current && !screenTrackRef.current) return
    unpublishScreenTrack()
    setScreenSharing(false)
    await update(ref(getDb(), `rooms/${roomId}/participants/${userId}`), {
      sharing: false,
    })
  }, [roomId, unpublishScreenTrack, userId])

  stopScreenShareRef.current = stopScreenShare

  const startScreenShare = useCallback(async () => {
    if (screenSharingRef.current) return
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
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'NotAllowedError')) {
        setMediaWarning(explainScreenShareError(e))
      }
    }
  }, [publishScreenTrack, roomId, userId])

  const toggleScreenShare = useCallback(async () => {
    if (screenSharingRef.current) await stopScreenShare()
    else await startScreenShare()
  }, [startScreenShare, stopScreenShare])

  const toggleMic = useCallback(async () => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !micOn
    stream.getAudioTracks().forEach((t) => {
      t.enabled = next
    })
    setMicOn(next)
    await update(ref(getDb(), `rooms/${roomId}/participants/${userId}`), { mic: next })
  }, [micOn, roomId, userId])

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

  const leave = useCallback(async () => {
    unpublishScreenTrack()
    for (const pc of pcsRef.current.values()) pc.close()
    pcsRef.current.clear()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    await remove(ref(getDb(), `rooms/${roomId}/participants/${userId}`))
    await remove(ref(getDb(), `rooms/${roomId}/signals/${userId}`))
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
    toggleMic,
    toggleCam,
    toggleScreenShare,
    sendChat,
    leave,
  }
}
