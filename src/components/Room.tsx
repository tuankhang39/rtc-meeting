import { useMemo, useState, type FormEvent } from 'react'
import { useRoom } from '../hooks/useRoom'
import { MAX_PARTICIPANTS } from '../lib/webrtc'
import { VideoTile } from './VideoTile'

type Props = {
  roomId: string
  displayName: string
  onLeave: () => void
}

export function Room({ roomId, displayName, onLeave }: Props) {
  const {
    localStream,
    screenStream,
    remotes,
    participants,
    messages,
    micOn,
    camOn,
    status,
    error,
    mediaWarning,
    screenSharing,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    sendChat,
    leave,
  } = useRoom({ roomId, displayName })

  const [chatText, setChatText] = useState('')
  const [copied, setCopied] = useState(false)

  const count = useMemo(() => Object.keys(participants).length, [participants])

  const stage = useMemo(() => {
    if (screenSharing && screenStream) {
      return { stream: screenStream, label: `${displayName} · màn hình`, micOn, sharing: true }
    }
    const remoteSharer = remotes.find((r) => r.sharing && (r.screenStream || r.stream))
    if (remoteSharer) {
      return {
        stream: remoteSharer.screenStream ?? remoteSharer.stream,
        label: `${remoteSharer.name} · màn hình`,
        micOn: remoteSharer.mic,
        sharing: true,
      }
    }
    return null
  }, [displayName, micOn, remotes, screenSharing, screenStream])

  const handleLeave = async () => {
    await leave()
    onLeave()
  }

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const onSubmitChat = (e: FormEvent) => {
    e.preventDefault()
    void sendChat(chatText)
    setChatText('')
  }

  if (status === 'error') {
    return (
      <div className="panel center">
        <h1>Không vào được phòng</h1>
        <pre className="error-help muted">{error}</pre>
        <button type="button" className="btn" onClick={onLeave}>
          Quay lại
        </button>
      </div>
    )
  }

  const peopleTiles = (
    <>
      <VideoTile
        stream={localStream}
        muted
        mirror
        self
        compact={Boolean(stage)}
        label={displayName}
        micOn={micOn}
        camOn={camOn}
        sharing={false}
      />
      {remotes.map((r) => {
        const camStream =
          r.sharing && r.screenStream && r.stream && r.stream.id !== r.screenStream.id
            ? r.stream
            : r.sharing && !r.screenStream
              ? null
              : r.stream
        return (
          <VideoTile
            key={r.userId}
            stream={camStream}
            compact={Boolean(stage)}
            label={r.name}
            micOn={r.mic}
            camOn={r.camera && Boolean(camStream)}
            sharing={r.sharing}
          />
        )
      })}
    </>
  )

  return (
    <div className="room">
      <header className="room-bar">
        <div>
          <strong className="brand">RTC</strong>
          <span className="muted"> / {roomId}</span>
        </div>
        <div className="room-bar-right">
          <span className="pill">
            {count}/{MAX_PARTICIPANTS}
          </span>
          <button type="button" className="btn ghost" onClick={() => void copyLink()}>
            {copied ? 'Đã copy' : 'Copy link'}
          </button>
        </div>
      </header>

      {mediaWarning && (
        <div className="banner warn room-warn">
          <pre className="error-help">{mediaWarning}</pre>
        </div>
      )}

      <div className={`room-body ${stage ? 'has-stage' : ''}`}>
        {stage ? (
          <section className="stage-layout">
            <div className="stage-main">
              <VideoTile
                stream={stage.stream}
                muted={false}
                label={stage.label}
                micOn={stage.micOn}
                camOn
                sharing
                fit="contain"
              />
            </div>
            <aside className="stage-people">{peopleTiles}</aside>
          </section>
        ) : (
          <section className={`grid count-${Math.min(1 + remotes.length, 3)}`}>{peopleTiles}</section>
        )}

        <aside className="chat">
          <h2>Chat</h2>
          <div className="chat-list">
            {messages.length === 0 && <p className="muted">Chưa có tin nhắn</p>}
            {messages.map((m) => (
              <div key={m.id} className="chat-item">
                <strong>{m.name}</strong>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={onSubmitChat} className="chat-form">
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Nhắn gì đó..."
              maxLength={500}
            />
            <button type="submit" className="btn">
              Gửi
            </button>
          </form>
        </aside>
      </div>

      <footer className="controls">
        <button type="button" className={`btn round ${micOn ? '' : 'danger'}`} onClick={() => void toggleMic()}>
          {micOn ? 'Mic' : 'Unmute'}
        </button>
        <button
          type="button"
          className={`btn round ${screenSharing ? 'active-share' : ''}`}
          onClick={() => void toggleScreenShare()}
        >
          {screenSharing ? 'Dừng share' : 'Share màn hình'}
        </button>
        <button type="button" className={`btn round ${camOn ? '' : 'danger'}`} onClick={() => void toggleCam()}>
          {camOn ? 'Cam' : 'Cam off'}
        </button>
        <button type="button" className="btn round danger" onClick={() => void handleLeave()}>
          Rời phòng
        </button>
        {status === 'connecting' && <span className="muted">Đang kết nối…</span>}
      </footer>
    </div>
  )
}
