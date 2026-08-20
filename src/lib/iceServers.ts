import { STUN_SERVERS, type IceServerList } from './webrtc'

let cache: { servers: IceServerList; until: number } | null = null

function urlsOf(server: RTCIceServer): string[] {
  const u = server.urls
  return Array.isArray(u) ? u.map(String) : [String(u)]
}

export function iceServersIncludeTurn(servers: IceServerList): boolean {
  return servers.some((s) => urlsOf(s).some((u) => u.startsWith('turn:') || u.startsWith('turns:')))
}

/** STUN + TURN (nếu cấu hình). TURN giúp IPv4↔IPv6 / WiFi công ty / CGNAT nối được. */
export async function resolveIceServers(): Promise<IceServerList> {
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined
  const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined
  if (turnUrl?.trim() && turnUser && turnCred) {
    const servers: IceServerList = [
      ...STUN_SERVERS,
      { urls: turnUrl.trim(), username: turnUser, credential: turnCred },
    ]
    cache = { servers, until: Date.now() + 23 * 3_600_000 }
    return servers
  }

  if (cache && Date.now() < cache.until) return cache.servers

  try {
    const res = await fetch('/api/turn', { credentials: 'same-origin' })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { iceServers?: IceServerList }
    const servers = data.iceServers?.length ? data.iceServers : STUN_SERVERS
    cache = { servers, until: Date.now() + (iceServersIncludeTurn(servers) ? 3_600_000 : 60_000) }
    if (iceServersIncludeTurn(servers)) {
      console.info('[rtc] TURN relay đang bật')
    } else {
      console.warn('[rtc] Chỉ STUN — hai máy khác IPv4/IPv6 hoặc WiFi công ty có thể không nối được')
    }
    return servers
  } catch {
    return cache?.servers ?? STUN_SERVERS
  }
}
