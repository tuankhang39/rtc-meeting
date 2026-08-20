import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const STUN_ONLY = {
  iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }],
}

function turnDevApi(): Plugin {
  return {
    name: 'turn-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/turn', async (_req: IncomingMessage, res: ServerResponse) => {
        const env = loadEnv(server.config.mode, server.config.root, '')
        const keyId = env.CLOUDFLARE_TURN_KEY_ID
        const token = env.CLOUDFLARE_TURN_API_TOKEN

        const send = (body: unknown) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }

        if (!keyId?.trim() || !token?.trim()) {
          send(STUN_ONLY)
          return
        }

        try {
          const r = await fetch(
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
          if (!r.ok) {
            send({ ...STUN_ONLY, error: 'turn_fetch_failed' })
            return
          }
          send(await r.json())
        } catch {
          send({ ...STUN_ONLY, error: 'turn_exception' })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), turnDevApi()],
})
