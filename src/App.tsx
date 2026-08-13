import { useMemo, useState } from 'react'
import { CuteStickers } from './components/CuteStickers'
import { Lobby } from './components/Lobby'
import { Room } from './components/Room'
import './App.css'

function readRoomFromUrl() {
  const q = new URLSearchParams(window.location.search)
  return q.get('room')?.trim().toLowerCase() ?? ''
}

export default function App() {
  const initialRoom = useMemo(() => readRoomFromUrl(), [])
  const [session, setSession] = useState<{ roomId: string; name: string; asHost: boolean } | null>(null)

  return (
    <div className="app-shell">
      <CuteStickers />
      <div className="app-content">
        {!session ? (
          <Lobby
            initialRoomId={initialRoom}
            onJoin={(roomId, name, asHost) => {
              const url = new URL(window.location.href)
              url.searchParams.set('room', roomId)
              window.history.replaceState({}, '', url)
              setSession({ roomId, name, asHost })
            }}
          />
        ) : (
          <Room
            roomId={session.roomId}
            displayName={session.name}
            asHost={session.asHost}
            onLeave={() => {
              const url = new URL(window.location.href)
              url.searchParams.delete('room')
              window.history.replaceState({}, '', url)
              setSession(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
