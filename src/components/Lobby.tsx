import { useState, type FormEvent } from 'react'
import { BRAND_DESC, BRAND_NAME, BRAND_TAGLINE } from '../lib/brand'
import { isFirebaseConfigured } from '../lib/firebase'
import { isHostLoggedIn, loginHost, logoutHost } from '../lib/hostAuth'
import { randomId } from '../lib/webrtc'
import { ThemeToggle } from './ThemeToggle'

type Props = {
  initialRoomId?: string
  onJoin: (roomId: string, name: string, asHost: boolean) => void
  onOpenAdmin: () => void
}

export function Lobby({ initialRoomId = '', onJoin, onOpenAdmin }: Props) {
  const [name, setName] = useState(() => localStorage.getItem('rtc-name') ?? '')
  const [roomId, setRoomId] = useState(initialRoomId)
  const [hostOk, setHostOk] = useState(() => isHostLoggedIn())
  const [showLogin, setShowLogin] = useState(false)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const configured = isFirebaseConfigured()

  const enterRoom = (id: string, asHost: boolean) => {
    const display = name.trim() || `Guest-${randomId(3)}`
    localStorage.setItem('rtc-name', display)
    onJoin(id, display, asHost)
  }

  const joinExisting = (e: FormEvent) => {
    e.preventDefault()
    if (!configured) return
    const id = roomId.trim().toLowerCase()
    if (!id) return
    enterRoom(id, hostOk || isHostLoggedIn())
  }

  const createRoom = () => {
    if (!configured || !hostOk) return
    enterRoom(randomId(6), true)
  }

  const onLogin = (e: FormEvent) => {
    e.preventDefault()
    if (loginHost(user, pass)) {
      setHostOk(true)
      setShowLogin(false)
      setLoginError(null)
      setPass('')
      setUser('')
    } else {
      setLoginError('Sai username hoặc mật khẩu')
    }
  }

  return (
    <div className="lobby">
      <ThemeToggle className="theme-toggle-float" />
      <div className="lobby-card">
        <span className="card-sticker card-sticker-l">🍓</span>
        <span className="card-sticker card-sticker-r">🧸</span>
        <p className="eyebrow">{BRAND_TAGLINE}</p>
        <h1 className="brand-hero">
          <span className="brand-hero-line">Cuộc họp của</span>
          <span className="brand-hero-main">Xiao Xin Laoshi</span>
        </h1>
        <p className="lede">{BRAND_DESC}</p>
        <span className="sr-only">{BRAND_NAME}</span>

        {!configured && (
          <div className="banner warn">
            Chưa cấu hình Firebase. Copy <code>.env.example</code> → <code>.env</code> rồi chạy lại{' '}
            <code>npm run dev</code>.
          </div>
        )}

        {hostOk && (
          <div className="banner ok host-bar">
            <span>Đã đăng nhập host (lưu trên máy này)</span>
            <button
              type="button"
              className="btn ghost tiny"
              onClick={() => {
                logoutHost()
                setHostOk(false)
              }}
            >
              Đăng xuất
            </button>
          </div>
        )}

        <form className="lobby-form" onSubmit={joinExisting}>
          <label>
            Tên của bạn
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bé Mèo"
              maxLength={40}
            />
          </label>
          <label>
            Room ID (để vào phòng có sẵn)
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="abc123"
              maxLength={24}
            />
          </label>
          <div className="lobby-actions">
            <button type="submit" className="btn primary" disabled={!configured || !roomId.trim()}>
              {hostOk ? 'Vào phòng (host)' : 'Vào phòng'}
            </button>
            {hostOk ? (
              <button type="button" className="btn" disabled={!configured} onClick={createRoom}>
                Tạo phòng nhanh
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowLogin(true)
                  setLoginError(null)
                }}
              >
                Đăng nhập
              </button>
            )}
          </div>
        </form>

        <p className="lobby-admin-link">
          <button type="button" className="btn ghost tiny" onClick={onOpenAdmin}>
            Trang quản lý /admin
          </button>
        </p>
      </div>

      {showLogin && (
        <div className="modal-backdrop" onClick={() => setShowLogin(false)}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={onLogin}>
            <p className="eyebrow">Host only</p>
            <h2>Đăng nhập</h2>
            <label>
              Username
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="admin"
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
              />
            </label>
            {loginError && <p className="login-error">{loginError}</p>}
            <div className="lobby-actions">
              <button type="submit" className="btn primary">
                Đăng nhập
              </button>
              <button type="button" className="btn" onClick={() => setShowLogin(false)}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
