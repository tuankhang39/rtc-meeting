/**
 * FREE-ONLY ICE config.
 * Chỉ STUN (Google, miễn phí). Không dùng TURN → không phát sinh phí relay.
 * Nếu hai máy không nối được trên mạng khó (công ty/VPN), cuộc gọi fail
 * thay vì tự chuyển sang TURN trả phí.
 */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export const MAX_PARTICIPANTS = 3

/** Chế độ miễn phí: cấm mọi URL turn:/turns: */
export function createPeerConnection() {
  const servers = ICE_SERVERS.filter((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls]
    return urls.every((u) => u.startsWith('stun:'))
  })

  return new RTCPeerConnection({
    iceServers: servers,
    iceTransportPolicy: 'all', // vẫn ưu tiên P2P; không có TURN để fallback
  })
}

export function randomId(len = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}
