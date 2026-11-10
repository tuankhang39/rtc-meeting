import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { BRAND_SHORT } from '../lib/brand'
import { connectDb, disconnectDb, isFirebaseConfigured } from '../lib/firebase'
import { isHostLoggedIn, loginHost, logoutHost } from '../lib/hostAuth'
import {
  createPreparedRoom,
  deleteRoom,
  listenRoomIndex,
  roomJoinUrl,
  sweepEmptyRooms,
  type RoomIndexEntry,
} from '../lib/rooms'
import { ThemeToggle } from './ThemeToggle'
import { BearArt, PeekBear } from './BearDecor'
import { BearCopy, BearEnter, BearHouse, BearKey, BearLeave, BearPaw, BearPlus, BearTrash } from './BearIcons'
import { bearForId, bearPalette } from '../lib/bearArt'

function cardTint(id: string) {
  const [a, b] = bearPalette(bearForId(id)).bg
  return { '--card-a': a, '--card-b': b } as CSSProperties
}

type TabId = 'create'

type Props = {
  onOpenRoom: (roomId: string) => void
  onBack: () => void
}

function formatWhen(ts?: number) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function AdminDashboard({ onOpenRoom, onBack }: Props) {
  const [hostOk, setHostOk] = useState(() => isHostLoggedIn())
  const [tab, setTab] = useState<TabId>('create')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [roomTitle, setRoomTitle] = useState('')
  const [roomDesc, setRoomDesc] = useState('')
  const [rooms, setRooms] = useState<Record<string, RoomIndexEntry>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const configured = isFirebaseConfigured()

  useEffect(() => {
    if (!configured || !hostOk) return
    connectDb('admin')
    void sweepEmptyRooms().catch(() => {})
    const unsub = listenRoomIndex(setRooms)
    const tick = window.setInterval(() => {
      void sweepEmptyRooms().catch(() => {})
    }, 30_000)
    return () => {
      unsub()
      window.clearInterval(tick)
      disconnectDb()
    }
  }, [configured, hostOk])

  const cards = useMemo(() => {
    return Object.entries(rooms)
      .filter(([, r]) => r.persistent)
      .sort((a, b) => (b[1].createdAt ?? 0) - (a[1].createdAt ?? 0))
  }, [rooms])

  const onLogin = (e: FormEvent) => {
    e.preventDefault()
    if (!loginHost(user, pass)) {
      setLoginError('Sai username hoặc mật khẩu')
      return
    }
    setHostOk(true)
    setLoginError(null)
    setPass('')
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    const title = roomTitle.trim()
    if (!title) {
      setNotice('Nhập tên phòng')
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const created = await createPreparedRoom(title, roomDesc)
      setRoomTitle('')
      setRoomDesc('')
      setNotice(`Đã lưu phòng «${created.name}» trên Firebase`)
    } catch (err) {
      console.error(err)
      setNotice('Không tạo được phòng. Kiểm tra Firebase rules.')
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async (id: string) => {
    await navigator.clipboard.writeText(roomJoinUrl(id))
    setNotice(`Đã copy link phòng ${id}`)
  }

  if (!hostOk) {
    return (
      <div className="admin-page">
        <ThemeToggle className="theme-toggle-float" />
        <form className="admin-login" onSubmit={onLogin}>
          <PeekBear kind="panda" size={88} />
          <p className="eyebrow">Admin</p>
          <h1>Quản lý phòng học</h1>
          <p className="lede">Đăng nhập host để tạo phòng sẵn và xem danh sách.</p>
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
            <button type="submit" className="btn primary icon-btn">
              <BearKey />
              Đăng nhập
            </button>
            <button type="button" className="btn ghost icon-btn" onClick={onBack}>
              <BearHouse size={16} />
              Về trang vào phòng
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-bar">
        <div className="admin-bar-title">
          <BearArt kind="teddy" size={52} className="admin-bar-bear" />
          <div>
            <p className="eyebrow">{BRAND_SHORT}</p>
            <h1>Dashboard quản lý</h1>
          </div>
        </div>
        <div className="admin-bar-right">
          <ThemeToggle className="theme-toggle-compact" />
          <button type="button" className="btn ghost tiny icon-btn" onClick={onBack}>
            <BearEnter size={15} />
            Vào phòng
          </button>
          <button
            type="button"
            className="btn ghost tiny icon-btn"
            onClick={() => {
              logoutHost()
              setHostOk(false)
            }}
          >
            <BearLeave size={15} />
            Đăng xuất
          </button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Mục quản lý">
        <button type="button" className={`admin-tab${tab === 'create' ? ' on' : ''}`} onClick={() => setTab('create')}>
          <BearPaw size={14} />
          Tạo phòng
        </button>
      </nav>

      {tab === 'create' && (
        <section className="admin-panel">
          {!configured && (
            <div className="banner warn">Chưa cấu hình Firebase. Kiểm tra file <code>.env</code>.</div>
          )}
          {notice && <div className="banner ok">{notice}</div>}

          <form className="admin-create" onSubmit={(e) => void onCreate(e)}>
            <label>
              Tên phòng
              <input
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                placeholder="Lớp chiều T3"
                maxLength={60}
                disabled={!configured || busy}
              />
            </label>
            <label>
              Mô tả
              <textarea
                value={roomDesc}
                onChange={(e) => setRoomDesc(e.target.value)}
                placeholder="Dạy 2 4 6, 19h–20h"
                maxLength={160}
                rows={2}
                disabled={!configured || busy}
              />
            </label>
            <button
              type="submit"
              className="btn primary icon-btn"
              disabled={!configured || busy || !roomTitle.trim()}
            >
              <BearPlus size={16} />
              Tạo phòng
            </button>
          </form>
          <p className="muted lobby-hint">
            Dữ liệu lưu trên Firebase Realtime Database: <code>roomIndex</code> (danh sách) và{' '}
            <code>rooms/…/meta</code> (chi tiết phòng). Phòng tạo sẵn không tự xoá khi trống.
          </p>

          <div className="admin-card-grid">
            {cards.length === 0 ? (
              <div className="admin-empty">
                <BearArt kind="sleepy" size={96} className="admin-empty-bear" />
                <p className="muted">Chưa có phòng. Nhập tên rồi bấm Tạo phòng.</p>
              </div>
            ) : (
              cards.map(([id, room]) => (
                <article key={id} className="admin-room-card" style={cardTint(id)}>
                  <div className="admin-card-head">
                    <BearArt kind={bearForId(id)} size={48} className="admin-card-bear" />
                    <div className="admin-card-heading">
                      <p className="admin-card-kicker">Phòng sẵn</p>
                      <h2>{room.name || id}</h2>
                    </div>
                  </div>
                  {room.description ? <p className="admin-card-desc">{room.description}</p> : null}
                  <p className="muted admin-card-id">{id}</p>
                  {room.createdAt ? <p className="muted admin-card-date">{formatWhen(room.createdAt)}</p> : null}
                  <div className="admin-card-actions">
                    <button type="button" className="btn primary tiny icon-btn" onClick={() => onOpenRoom(id)}>
                      <BearEnter size={14} />
                      Vào dạy
                    </button>
                    <button type="button" className="btn tiny icon-btn" onClick={() => void copyLink(id)}>
                      <BearCopy size={14} />
                      Copy link
                    </button>
                    <button
                      type="button"
                      className="btn ghost tiny icon-btn admin-card-delete"
                      onClick={() => {
                        void deleteRoom(id).then(() => setNotice(`Đã xoá «${room.name || id}»`))
                      }}
                    >
                      <BearTrash size={14} />
                      Xoá
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}
