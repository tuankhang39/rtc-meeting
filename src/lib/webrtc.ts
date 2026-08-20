/**
 * ICE: STUN (miễn phí) + TURN relay (tùy chọn qua /api/turn hoặc VITE_TURN_*).
 * Chỉ STUN: hai bên khác IPv4/IPv6 hoặc NAT chặt thường không P2P trực tiếp được.
 */
export type IceServerList = RTCIceServer[]

export const STUN_SERVERS: IceServerList = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

/** @deprecated dùng STUN_SERVERS */
export const ICE_SERVERS = STUN_SERVERS

export const MAX_PARTICIPANTS = 5

export function createPeerConnection(iceServers: IceServerList = STUN_SERVERS) {
  return new RTCPeerConnection({
    iceServers,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 8,
  })
}

export function randomId(len = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}
