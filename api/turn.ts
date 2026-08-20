export const config = { runtime: 'edge' }

const STUN_ONLY = {
  iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }],
}

export default async function handler() {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN

  if (!keyId?.trim() || !token?.trim()) {
    return Response.json(STUN_ONLY, { headers: { 'Cache-Control': 'private, max-age=60' } })
  }

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId.trim())}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86_400 }),
      },
    )

    if (!res.ok) {
      console.error('[api/turn]', res.status, await res.text())
      return Response.json({ ...STUN_ONLY, error: 'turn_fetch_failed' })
    }

    return Response.json(await res.json(), { headers: { 'Cache-Control': 'private, max-age=3600' } })
  } catch (e) {
    console.error('[api/turn]', e)
    return Response.json({ ...STUN_ONLY, error: 'turn_exception' })
  }
}
