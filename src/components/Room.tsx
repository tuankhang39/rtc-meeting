import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BRAND_SHORT } from '../lib/brand'
import { useRoom } from '../hooks/useRoom'
import { MAX_PARTICIPANTS } from '../lib/webrtc'
import {
  IconCam,
  IconCamOff,
  IconCopy,
  IconLeave,
  IconMic,
  IconMicOff,
  IconScreen,
  IconScreenOff,
  IconSend,
} from './Icons'
import { ToastStack, useToasts } from './Toast'
import { ReactionBar, ReactionBurst } from './Reactions'
import { QuickCommentBar } from './QuickComments'
import { unlockQuickAudio } from '../lib/quickAudio'
import { PlayfulPicker } from './PlayfulInteractions'
import { ScreenStickerOverlay, StickerPackPicker } from './ScreenStickers'
import { ThemeToggle } from './ThemeToggle'
import { VideoTile } from './VideoTile'
import type { StickerPackId } from '../lib/stickers'

type Props = {
  roomId: string
  displayName: string
  asHost?: boolean
  onLeave: () => void
}

export function Room({ roomId, displayName, asHost = false, onLeave }: Props) {
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
    isHost,
    hostNotice,
    joinToast,
    reactions,
    screenStickers,
    playfulByUser,
    playfulToast,
    quickCommentToast,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    muteRemote,
    sendChat,
    sendReaction,
    sendPlayful,
    sendQuickComment,
    placeScreenSticker,
    removeScreenSticker,
    clearScreenStickers,
    leave,
    userId,
  } = useRoom({ roomId, displayName, asHost })

  const { toasts, push, dismiss } = useToasts()
  const [chatText, setChatText] = useState('')
  const [copied, setCopied] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const [stickerPack, setStickerPack] = useState<StickerPackId>('cute')
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null)
  const [showStickerPanel, setShowStickerPanel] = useState(false)
  const [showPlayfulPanel, setShowPlayfulPanel] = useState(false)
  const [showQuickComments, setShowQuickComments] = useState(false)

  useEffect(() => {
    unlockQuickAudio()
  }, [])

  useEffect(() => {
    if (hostNotice) push(hostNotice, 'warn')
  }, [hostNotice, push])

  useEffect(() => {
    if (mediaWarning) push(mediaWarning.split('\n')[0] ?? mediaWarning, 'warn')
  }, [mediaWarning, push])

  useEffect(() => {
    if (joinToast) push(joinToast, 'ok')
  }, [joinToast, push])

  useEffect(() => {
    if (playfulToast) push(playfulToast, 'ok')
  }, [playfulToast, push])

  useEffect(() => {
    if (quickCommentToast) push(quickCommentToast, 'ok')
  }, [quickCommentToast, push])

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

  useEffect(() => {
    if (!stage) {
      setSelectedSticker(null)
      setShowStickerPanel(false)
    }
  }, [stage])

  const handleLeave = async () => {
    await leave()
    onLeave()
  }

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    push('Đã copy link phòng', 'ok')
    setTimeout(() => setCopied(false), 1500)
  }

  const onSubmitChat = (e: FormEvent) => {
    e.preventDefault()
    void sendChat(chatText)
    setChatText('')
  }

  const onMuteRemote = async (id: string, name: string) => {
    await muteRemote(id)
    push(`Đã tắt mic của ${name}`, 'ok')
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
        audioStream={localStream}
        muted
        mirror
        self
        isHostUser={isHost}
        compact={Boolean(stage)}
        label={displayName}
        micOn={micOn}
        camOn={camOn}
        sharing={false}
        playfulEffects={playfulByUser[userId] ?? []}
      />
      {remotes.map((r) => {
        const camStream =
          r.sharing && r.screenStream && r.stream && r.stream.id !== r.screenStream.id
            ? r.stream
            : r.sharing && !r.screenStream
              ? null
              : r.stream
        const peerIsHost = participants[r.userId]?.isHost === true
        return (
          <VideoTile
            key={r.userId}
            stream={camStream}
            audioStream={r.stream}
            compact={Boolean(stage)}
            label={r.name}
            micOn={r.mic}
            camOn={r.camera && Boolean(camStream)}
            sharing={r.sharing}
            isHostUser={peerIsHost}
            canMute={isHost && !peerIsHost}
            onMute={() => void onMuteRemote(r.userId, r.name)}
            playfulEffects={playfulByUser[r.userId] ?? []}
          />
        )
      })}
    </>
  )

  return (
    <div className="room">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <ReactionBurst reactions={reactions} />

      <header className="room-bar">
        <div>
          <strong className="brand">{BRAND_SHORT}</strong>
          <span className="muted"> / {roomId}</span>
          {isHost && <span className="pill host-pill">Host</span>}
        </div>
        <div className="room-bar-right">
          <ThemeToggle className="theme-toggle-compact" />
          <span className="pill">
            {count}/{MAX_PARTICIPANTS}
          </span>
          <button type="button" className="btn ghost icon-btn" onClick={() => void copyLink()} title="Copy link">
            <IconCopy />
            <span>{copied ? 'Đã copy' : 'Copy link'}</span>
          </button>
        </div>
      </header>

      <div className={`room-body ${stage ? 'has-stage' : ''}`}>
        {stage ? (
          <section className="stage-layout">
            <div className="stage-main stage-with-stickers">
              <VideoTile
                stream={stage.stream}
                audioStream={screenSharing ? localStream : undefined}
                muted={false}
                label={stage.label}
                micOn={stage.micOn}
                camOn
                sharing
                fit="contain"
              />
              <ScreenStickerOverlay
                stickers={screenStickers}
                selectedEmoji={selectedSticker}
                selectedPack={stickerPack}
                myUserId={userId}
                canClear={isHost || screenSharing}
                onPlace={(emoji, pack, x, y) => {
                  void placeScreenSticker(emoji, pack, x, y)
                }}
                onRemove={(id) => void removeScreenSticker(id)}
                onClear={() => {
                  void clearScreenStickers()
                  push('Đã xóa sticker trên màn share', 'ok')
                }}
              />
              {showStickerPanel && (
                <StickerPackPicker
                  packId={stickerPack}
                  selectedEmoji={selectedSticker}
                  onPackChange={setStickerPack}
                  onSelect={setSelectedSticker}
                />
              )}
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
            <button type="submit" className="btn icon-btn" title="Gửi">
              <IconSend />
              <span>Gửi</span>
            </button>
          </form>
        </aside>
      </div>

      <footer className="controls">
        {showQuickComments && (
          <QuickCommentBar
            onSend={(comment) => {
              void sendQuickComment(comment)
              setShowQuickComments(false)
            }}
          />
        )}
        {showPlayfulPanel && (
          <PlayfulPicker
            participants={participants}
            myUserId={userId}
            onSend={(targetId, kind) => {
              const name = participants[targetId]?.name
              void sendPlayful(targetId, kind, name)
              setShowPlayfulPanel(false)
            }}
          />
        )}
        {showReactions && (
          <ReactionBar
            onReact={(emoji) => {
              void sendReaction(emoji)
              setShowReactions(false)
            }}
          />
        )}
        <button
          type="button"
          className={`btn control-btn ${micOn ? '' : 'danger'}`}
          onClick={() => void toggleMic()}
          title={micOn ? 'Tắt mic' : 'Bật mic'}
          aria-label={micOn ? 'Tắt mic' : 'Bật mic'}
        >
          {micOn ? <IconMic /> : <IconMicOff />}
          <span>{micOn ? 'Mic' : 'Unmute'}</span>
        </button>
        <button
          type="button"
          className={`btn control-btn ${camOn ? '' : 'danger'}`}
          onClick={() => void toggleCam()}
          title={camOn ? 'Tắt camera' : 'Bật camera'}
          aria-label={camOn ? 'Tắt camera' : 'Bật camera'}
        >
          {camOn ? <IconCam /> : <IconCamOff />}
          <span>{camOn ? 'Cam' : 'Cam off'}</span>
        </button>
        <button
          type="button"
          className={`btn control-btn ${showReactions ? 'active-share' : ''}`}
          onClick={() => {
            setShowReactions((v) => !v)
            setShowStickerPanel(false)
            setShowPlayfulPanel(false)
            setShowQuickComments(false)
          }}
          title="Reaction vui"
          aria-label="Reaction"
        >
          <span className="react-face" aria-hidden>
            😊
          </span>
          <span>React</span>
        </button>
        <button
          type="button"
          className={`btn control-btn ${showPlayfulPanel ? 'active-share' : ''}`}
          onClick={() => {
            setShowPlayfulPanel((v) => !v)
            setShowReactions(false)
            setShowStickerPanel(false)
            setShowQuickComments(false)
          }}
          title="Chọc ghẹo, tặng hoa, phê bình"
          aria-label="Chọc ghẹo"
        >
          <span className="react-face" aria-hidden>
            🎭
          </span>
          <span>Chọc</span>
        </button>
        <button
          type="button"
          className={`btn control-btn ${showQuickComments ? 'active-share' : ''}`}
          onClick={() => {
            unlockQuickAudio()
            setShowQuickComments((v) => !v)
            setShowReactions(false)
            setShowStickerPanel(false)
            setShowPlayfulPanel(false)
          }}
          title="Bình luận nhanh buổi học"
          aria-label="Bình luận nhanh"
        >
          <span className="react-face" aria-hidden>
            📢
          </span>
          <span>Nhanh</span>
        </button>
        {stage && (
          <button
            type="button"
            className={`btn control-btn ${showStickerPanel || selectedSticker ? 'active-share' : ''}`}
            onClick={() => {
              setShowStickerPanel((v) => !v)
              setShowReactions(false)
              setShowPlayfulPanel(false)
              setShowQuickComments(false)
              if (showStickerPanel) setSelectedSticker(null)
            }}
            title="Sticker trên màn share"
            aria-label="Sticker"
          >
            <span className="react-face" aria-hidden>
              🎀
            </span>
            <span>Sticker</span>
          </button>
        )}
        <button
          type="button"
          className={`btn control-btn ${screenSharing ? 'active-share' : ''}`}
          onClick={() => void toggleScreenShare()}
          title={screenSharing ? 'Dừng share' : 'Share màn hình'}
          aria-label={screenSharing ? 'Dừng share' : 'Share màn hình'}
        >
          {screenSharing ? <IconScreenOff /> : <IconScreen />}
          <span>{screenSharing ? 'Dừng' : 'Share'}</span>
        </button>
        <button
          type="button"
          className="btn control-btn danger leave"
          onClick={() => void handleLeave()}
          title="Rời phòng"
          aria-label="Rời phòng"
        >
          <IconLeave />
          <span>Rời</span>
        </button>
        {status === 'connecting' && <span className="muted">Đang kết nối…</span>}
      </footer>
    </div>
  )
}
