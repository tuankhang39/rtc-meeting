/**
 * FREE-ONLY ICE config.
 * Nhiều STUN free để tăng tỷ lệ P2P trên WiFi nhà khác mạng.
 * Không TURN → một số NAT đối xứng vẫn fail (VPN/công ty).
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

export const MAX_PARTICIPANTS = 5

/** Chế độ miễn phí: cấm mọi URL turn:/turns: */
export function createPeerConnection() {
  const servers = ICE_SERVERS.filter((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls]
    return urls.every((u) => typeof u === 'string' && u.startsWith('stun:'))
  })

  return new RTCPeerConnection({
    iceServers: servers,
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
