import { useEffect, useMemo, useState } from 'react'
import { CuteStickers } from './components/CuteStickers'
import { AdminDashboard } from './components/AdminDashboard'
import { Lobby } from './components/Lobby'
import { Room } from './components/Room'
import { randomId } from './lib/webrtc'
import './App.css'

function readRoomFromUrl() {
  const q = new URLSearchParams(window.location.search)
  return q.get('room')?.trim().toLowerCase() ?? ''
}

function readPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

function go(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const [path, setPath] = useState(readPath)
  const initialRoom = useMemo(() => readRoomFromUrl(), [])
  const [session, setSession] = useState<{ roomId: string; name: string; asHost: boolean } | null>(null)

  useEffect(() => {
    const onPop = () => setPath(readPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const joinRoom = (roomId: string, name: string, asHost: boolean) => {
    const url = new URL('/', window.location.href)
    url.searchParams.set('room', roomId)
    window.history.replaceState({}, '', url)
    setPath('/')
    setSession({ roomId, name, asHost })
  }

  const leaveRoom = () => {
    const url = new URL('/', window.location.href)
    url.search = ''
    window.history.replaceState({}, '', url)
    setPath('/')
    setSession(null)
  }

  const isAdmin = path === '/admin' || path === '/dashboard'

  return (
    <div className="app-shell">
      <CuteStickers />
      <div className="app-content">
        {session ? (
          <Room
            roomId={session.roomId}
            displayName={session.name}
            asHost={session.asHost}
            onLeave={leaveRoom}
          />
        ) : isAdmin ? (
          <AdminDashboard
            onBack={() => go('/')}
            onOpenRoom={(roomId) => {
              const display = localStorage.getItem('rtc-name')?.trim() || `Host-${randomId(3)}`
              localStorage.setItem('rtc-name', display)
              joinRoom(roomId, display, true)
            }}
          />
        ) : (
          <Lobby
            initialRoomId={initialRoom}
            onJoin={joinRoom}
            onOpenAdmin={() => go('/admin')}
          />
        )}
      </div>
    </div>
  )
}
