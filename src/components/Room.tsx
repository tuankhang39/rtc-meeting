import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
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
import { ScreenDrawOverlay } from './ScreenDraw'
import { ScreenStickerOverlay, StickerPackPicker } from './ScreenStickers'
import { ThemeToggle } from './ThemeToggle'
import { VideoTile } from './VideoTile'
import { StarBoard } from './StarBoard'
import { useTeachPip } from '../hooks/useTeachPip'
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
    roomName,
    hostNotice,
    joinToast,
    reactions,
    screenStickers,
    drawStrokes,
    drawBoard,
    playfulByUser,
    playfulToast,
    quickCommentToast,
    starScores,
    starFxByUser,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    muteRemote,
    sendChat,
    sendReaction,
    sendPlayful,
    giveStar,
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
  const [showChat, setShowChat] = useState(true)
  const [showStars, setShowStars] = useState(false)

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

  const otherPeople = useMemo(() => {
    const ids = new Set([
      ...Object.keys(participants).filter((id) => id !== userId),
      ...remotes.map((r) => r.userId),
    ])
    return [...ids]
      .map((id) => {
        const p = participants[id]
        const r = remotes.find((x) => x.userId === id)
        const sharing = p?.sharing ?? r?.sharing ?? false
        const stream = r?.stream ?? null
        const screenStream = r?.screenStream ?? null
        const sameAsScreen = Boolean(sharing && screenStream && stream && stream.id === screenStream.id)
        const camStream = sharing && (sameAsScreen || !screenStream) ? null : stream
        const linked = r?.link === 'connected'
        const hasMedia = Boolean(r?.hasAudio || r?.hasVideo)
        return {
          userId: id,
          name: p?.name ?? r?.name ?? id.slice(0, 6),
          mic: r?.hasAudio ? r.mic : (p?.mic ?? false),
          camera: r?.hasVideo ? r.camera && Boolean(camStream) : false,
          sharing,
          isHost: p?.isHost === true,
          camStream,
          stream,
          linked,
          connecting: !hasMedia || !linked,
          joinedAt: p?.joinedAt ?? 0,
        }
      })
      .sort((a, b) => a.joinedAt - b.joinedAt)
  }, [participants, remotes, userId])

  const linkWarnRef = useRef(false)
  useEffect(() => {
    const failed = remotes.some((r) => r.link === 'failed')
    if (failed && !linkWarnRef.current) {
      linkWarnRef.current = true
      push(
        'Chưa nghe/thấy được ai đó: thử cùng WiFi, tắt VPN, bấm một lần vào màn hình (bật tiếng trình duyệt).',
        'warn',
      )
    }
  }, [remotes, push])

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

  const pipPeople = useMemo(
    () =>
      otherPeople.map((r) => ({
        id: r.userId,
        stream: r.camStream,
        label: r.name,
        micOn: r.mic,
        camOn: r.camera,
        isHostUser: r.isHost,
        stars: starScores[r.userId]?.count ?? 0,
      })),
    [otherPeople, starScores],
  )
  const teachPip = useTeachPip(pipPeople, {
    micOn,
    camOn,
    isHost,
    onToggleMic: () => void toggleMic(),
    onToggleCam: () => void toggleCam(),
    onStopShare: () => void toggleScreenShare(),
    onQuickComment: (comment) => void sendQuickComment(comment),
    starTargets: Object.entries(participants)
      .filter(([id]) => id !== userId)
      .map(([id, p]) => ({
        id,
        name: p.name,
        count: starScores[id]?.count ?? 0,
      })),
    onGiveStar: (id, name) => void giveStar(id, name),
  })
  const wasSharingRef = useRef(false)

  useEffect(() => {
    if (wasSharingRef.current && !screenSharing) {
      teachPip.close()
    }
    wasSharingRef.current = screenSharing
  }, [screenSharing, teachPip.close])

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
        stars={starScores[userId]?.count ?? 0}
        starBurst={Boolean(starFxByUser[userId]?.length)}
      />
      {otherPeople.map((r) => (
          <VideoTile
            key={r.userId}
            stream={r.camStream}
            audioStream={r.stream}
            compact={Boolean(stage)}
            label={r.connecting ? `${r.name} · đang kết nối` : r.name}
            micOn={r.mic}
            camOn={r.camera}
            sharing={r.sharing}
            isHostUser={r.isHost}
            canMute={isHost && !r.isHost}
            onMute={() => void onMuteRemote(r.userId, r.name)}
            playfulEffects={playfulByUser[r.userId] ?? []}
            stars={starScores[r.userId]?.count ?? 0}
            canStar={isHost}
            onStar={() => void giveStar(r.userId, r.name)}
            starBurst={Boolean(starFxByUser[r.userId]?.length)}
          />
        ))}
    </>
  )

  const onToggleShare = async () => {
    if (screenSharing) {
      teachPip.close()
      await toggleScreenShare()
      return
    }
    const pipOk = await teachPip.openPip()
    const started = await toggleScreenShare()
    if (!started) {
      teachPip.close()
      return
    }
    if (!pipOk) {
      push('Chrome/Edge: bấm «Học viên» để ghim hộp người khi chuyển tab dạy', 'warn')
    }
  }

  const canClearStickers = isHost || screenSharing

  const handleClearStickers = () => {
    if (screenStickers.length === 0) return
    void clearScreenStickers()
    setSelectedSticker(null)
    push('Đã xóa hết sticker trên màn hình', 'ok')
  }

  return (
    <div className="room">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <ReactionBurst reactions={reactions} />

      <header className="room-bar">
        <div>
          <strong className="brand">{BRAND_SHORT}</strong>
          <span className="muted"> / {roomName ? `${roomName} · ${roomId}` : roomId}</span>
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

      <div className={`room-body ${stage ? 'has-stage' : ''} ${showChat ? 'has-chat' : ''}`}>
        {stage ? (
          <section className="stage-layout">
            <div className="stage-main stage-with-stickers">
              <VideoTile
                stream={stage.stream}
                audioStream={screenSharing ? localStream : undefined}
                muted={screenSharing}
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
                canClear={canClearStickers}
                onPlace={(emoji, pack, x, y) => {
                  void placeScreenSticker(emoji, pack, x, y)
                }}
                onRemove={(id) => void removeScreenSticker(id)}
                onClear={handleClearStickers}
              />
              <ScreenDrawOverlay strokes={drawStrokes} board={drawBoard} />
              {showStickerPanel && (
                <StickerPackPicker
                  packId={stickerPack}
                  selectedEmoji={selectedSticker}
                  onPackChange={setStickerPack}
                  onSelect={setSelectedSticker}
                  canClear={canClearStickers}
                  stickerCount={screenStickers.length}
                  onClear={handleClearStickers}
                />
              )}
            </div>
            <aside className="stage-people">{peopleTiles}</aside>
          </section>
        ) : (
          <section className={`grid count-${Math.min(1 + otherPeople.length, 5)}`}>{peopleTiles}</section>
        )}

        <aside className={`chat${showChat ? '' : ' collapsed'}`}>
          <h2>
            {showChat && <span>Chat</span>}
            <span className="chat-controls">
              <button
                type="button"
                className="chat-toggle"
                onClick={() => setShowChat((v) => !v)}
                title={showChat ? 'Thu gọn chat' : 'Mở chat'}
                aria-label={showChat ? 'Thu gọn chat' : 'Mở chat'}
              >
                −
              </button>
              {showChat && (
                <button
                  type="button"
                  className="chat-close"
                  title="Đóng chat"
                  aria-label="Đóng chat"
                  onClick={() => setShowChat(false)}
                >
                  ×
                </button>
              )}
            </span>
          </h2>
          {showChat && (
            <>
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
            </>
          )}
        </aside>
      </div>

      <footer className="controls">
        {isHost && showQuickComments && (
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
        {isHost && showStars && (
          <StarBoard
            participants={participants}
            scores={starScores}
            myUserId={userId}
            onGive={(id, name) => {
              void giveStar(id, name)
            }}
          />
        )}
        {isHost && (
        <button
          type="button"
          className={`btn control-btn ${showStars ? 'active-share' : ''}`}
          onClick={() => {
            setShowStars((v) => !v)
            setShowReactions(false)
            setShowPlayfulPanel(false)
            setShowQuickComments(false)
            setShowStickerPanel(false)
          }}
          title="Tặng sao, xem điểm buổi học"
          aria-label="Tặng sao"
        >
          <span className="react-face" aria-hidden>
            ⭐
          </span>
          <span>Sao</span>
        </button>
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
            setShowStars(false)
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
            setShowStars(false)
          }}
          title="Chọc ghẹo, tặng hoa, phê bình"
          aria-label="Chọc ghẹo"
        >
          <span className="react-face" aria-hidden>
            🎭
          </span>
          <span>Chọc</span>
        </button>
        {isHost && (
        <button
          type="button"
          className={`btn control-btn ${showQuickComments ? 'active-share' : ''}`}
          onClick={() => {
            unlockQuickAudio()
            setShowQuickComments((v) => !v)
            setShowReactions(false)
            setShowStickerPanel(false)
            setShowPlayfulPanel(false)
            setShowStars(false)
          }}
          title="Bình luận nhanh buổi học"
          aria-label="Bình luận nhanh"
        >
          <span className="react-face" aria-hidden>
            📢
          </span>
          <span>Nhanh</span>
        </button>
        )}
        {stage && (
          <button
            type="button"
            className={`btn control-btn ${showStickerPanel || selectedSticker ? 'active-share' : ''}`}
            onClick={() => {
              setShowStickerPanel((v) => !v)
              setShowReactions(false)
              setShowPlayfulPanel(false)
              setShowQuickComments(false)
              setShowStars(false)
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
        {stage && canClearStickers && (
          <button
            type="button"
            className="btn control-btn"
            disabled={screenStickers.length === 0}
            onClick={handleClearStickers}
            title="Xóa hết sticker trên màn hình"
            aria-label="Xóa hết sticker"
          >
            <span className="react-face" aria-hidden>
              🧹
            </span>
            <span>{screenStickers.length > 0 ? `Xóa (${screenStickers.length})` : 'Xóa sticker'}</span>
          </button>
        )}
        {screenSharing && (
          <button
            type="button"
            className={`btn control-btn ${teachPip.open ? 'active-share' : ''}`}
            onClick={() => {
              if (teachPip.open) teachPip.close()
              else {
                void teachPip.openPip().then((ok) => {
                  if (!ok) push('Cửa sổ học viên cần Chrome hoặc Edge mới', 'warn')
                })
              }
            }}
            title="Ghim hộp học viên lên màn hình khi dạy"
            aria-label="Hộp học viên"
          >
            <span className="react-face" aria-hidden>
              👥
            </span>
            <span>{teachPip.open ? 'Đóng hộp' : 'Học viên'}</span>
          </button>
        )}
        <button
          type="button"
          className={`btn control-btn ${screenSharing ? 'active-share' : ''}`}
          onClick={() => void onToggleShare()}
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
