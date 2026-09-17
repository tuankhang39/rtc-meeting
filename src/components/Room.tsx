import { useEffect, useMemo, useRef, useState } from 'react'
import { BRAND_SHORT } from '../lib/brand'
import { useRoom } from '../hooks/useRoom'
import { MAX_PARTICIPANTS } from '../lib/webrtc'
import {
  IconBeauty,
  IconCam,
  IconCamOff,
  IconCopy,
  IconEraser,
  IconLeave,
  IconMegaphone,
  IconMic,
  IconMicOff,
  IconPeople,
  IconPlayful,
  IconReact,
  IconRecord,
  IconScreen,
  IconScreenOff,
  IconSticker,
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
import { ChatPanel } from './ChatPanel'
import { useTeachPip } from '../hooks/useTeachPip'
import { useClassRecorder } from '../hooks/useClassRecorder'
import { isHostLoggedIn } from '../lib/hostAuth'
import { BeautyPanel } from './BeautyPanel'
import { useBeautyFilter } from '../hooks/useBeautyFilter'
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
    pinnedMessages,
    chatNotes,
    chatLessons,
    chatMaterials,
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
    setBeautyTrack,
    rawCameraTrack,
    toggleScreenShare,
    muteRemote,
    sendChat,
    pinChatMessage,
    unpinChatMessage,
    addChatNote,
    removeChatNote,
    addChatLesson,
    removeChatLesson,
    addChatMaterial,
    removeChatMaterial,
    sendReaction,
    sendPlayful,
    giveStar,
    takeStar,
    sendQuickComment,
    placeScreenSticker,
    removeScreenSticker,
    clearScreenStickers,
    leave,
    userId,
  } = useRoom({ roomId, displayName, asHost })

  const { toasts, push, dismiss } = useToasts()
  const [copied, setCopied] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const [stickerPack, setStickerPack] = useState<StickerPackId>('cute')
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null)
  const [showStickerPanel, setShowStickerPanel] = useState(false)
  const [showPlayfulPanel, setShowPlayfulPanel] = useState(false)
  const [showQuickComments, setShowQuickComments] = useState(false)
  const [showChat, setShowChat] = useState(true)
  const [showStars, setShowStars] = useState(false)
  const [showBeauty, setShowBeauty] = useState(false)

  const beauty = useBeautyFilter({
    sourceTrack: rawCameraTrack,
    camOn,
    onOutputTrack: setBeautyTrack,
  })

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
        const linked = r?.link === 'connected'
        return {
          userId: id,
          name: p?.name ?? r?.name ?? id.slice(0, 6),
          mic: r?.hasAudio ? r.mic : (p?.mic ?? false),
          camera: Boolean(r?.camLive) && p?.camera !== false,
          sharing,
          isHost: p?.isHost === true,
          camStream: r?.stream ?? null,
          stream: r?.stream ?? null,
          linked,
          connecting: !linked,
          joinedAt: p?.joinedAt ?? 0,
        }
      })
      .sort((a, b) => {
        if (a.isHost && !b.isHost) return -1
        if (!a.isHost && b.isHost) return 1
        return a.joinedAt - b.joinedAt
      })
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
      return { stream: screenStream, label: `${displayName} · màn hình`, micOn, sharing: true, waiting: false }
    }
    // Ai đang share chỉ lấy theo trạng thái phòng; còn có hình chưa thì tile tự biết.
    const sharer = otherPeople.find((p) => p.sharing)
    if (!sharer) return null
    const remote = remotes.find((r) => r.userId === sharer.userId)
    return {
      stream: remote?.screenLive ? remote.screenStream : null,
      label: `${sharer.name} · màn hình`,
      micOn: sharer.mic,
      sharing: true,
      waiting: false,
    }
  }, [displayName, micOn, otherPeople, remotes, screenSharing, screenStream])

  const canAdminRecord = isHost && isHostLoggedIn()
  const canManageChatExtras = canAdminRecord
  const {
    recording,
    elapsedLabel,
    canRecord,
    startRecording,
    stopRecording,
  } = useClassRecorder({
    enabled: canAdminRecord,
    roomId,
    localStream,
    remotes,
    onCaptureEnded: () => {
      push('Đã dừng ghi (màn hình bị đóng). File đã lưu nếu có.', 'ok')
    },
  })

  useEffect(() => {
    if (!stage) {
      setSelectedSticker(null)
      setShowStickerPanel(false)
    }
  }, [stage])

  const handleLeave = async () => {
    if (recording) await stopRecording()
    await leave()
    onLeave()
  }

  const onToggleRecord = async () => {
    if (recording) {
      const blob = await stopRecording()
      if (blob && blob.size > 0) push('Đã lưu file ghi màn hình (.webm)', 'ok')
      else push('Đã dừng ghi', 'ok')
      return
    }
    try {
      await startRecording()
      push('Chọn **Toàn màn hình** — ghi cả desktop + tiếng lớp học', 'ok')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        push('Đã hủy chọn màn hình', 'warn')
        return
      }
      push(e instanceof Error ? e.message : 'Không bắt đầu ghi được', 'warn')
    }
  }

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    push('Đã copy link phòng', 'ok')
    setTimeout(() => setCopied(false), 1500)
  }

  const onMuteRemote = async (id: string, name: string) => {
    await muteRemote(id)
    push(`Đã tắt mic của ${name}`, 'ok')
  }

  const pipPeople = useMemo(() => {
    const remotes = [...otherPeople]
      .sort((a, b) => {
        if (a.isHost && !b.isHost) return -1
        if (!a.isHost && b.isHost) return 1
        return a.joinedAt - b.joinedAt
      })
      .map((r) => ({
        id: r.userId,
        stream: r.camStream,
        label: r.name,
        micOn: r.mic,
        camOn: r.camera,
        isHostUser: r.isHost,
        pinned: r.isHost,
        stars: starScores[r.userId]?.count ?? 0,
      }))

    // Giáo viên đang share: luôn ghim cam của mình lên đầu thanh Học viên
    if (isHost && screenSharing) {
      return [
        {
          id: userId,
          stream: localStream,
          label: displayName,
          micOn,
          camOn,
          isHostUser: true,
          mirror: true,
          self: true,
          pinned: true,
          stars: starScores[userId]?.count ?? 0,
        },
        ...remotes,
      ]
    }

    return remotes
  }, [
    otherPeople,
    starScores,
    isHost,
    screenSharing,
    userId,
    localStream,
    displayName,
    micOn,
    camOn,
  ])

  const teachPip = useTeachPip(pipPeople, {
    micOn,
    camOn,
    isHost,
    myUserId: userId,
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
    onTakeStar: (id, name) => void takeStar(id, name),
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
            onTakeStar={() => void takeStar(r.userId, r.name)}
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
          {recording && (
            <span className="pill record-pill" title="Đang ghi màn hình máy (local)">
              ● REC {elapsedLabel}
            </span>
          )}
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
                fit="cover"
                placeholder="Đang nhận màn hình…"
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

        <ChatPanel
          open={showChat}
          onToggle={() => setShowChat((v) => !v)}
          onClose={() => setShowChat(false)}
          userId={userId}
          isHost={isHost}
          canManageExtras={canManageChatExtras}
          messages={messages}
          pinnedMessages={pinnedMessages}
          notes={chatNotes}
          lessons={chatLessons}
          materials={chatMaterials}
          onSendChat={sendChat}
          onPin={pinChatMessage}
          onUnpin={unpinChatMessage}
          onAddNote={addChatNote}
          onRemoveNote={removeChatNote}
          onAddLesson={addChatLesson}
          onRemoveLesson={removeChatLesson}
          onAddMaterial={addChatMaterial}
          onRemoveMaterial={removeChatMaterial}
        />
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
        {showBeauty && (
          <BeautyPanel
            presetId={beauty.presetId}
            onSelect={beauty.setPresetId}
            lip={beauty.lip}
            onLipChange={beauty.setLipOptions}
            skin={beauty.skin}
            onSkinChange={beauty.setSkinOptions}
            brow={beauty.brow}
            onBrowChange={beauty.setBrowOptions}
            onClose={() => setShowBeauty(false)}
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
            onTake={(id, name) => {
              void takeStar(id, name)
            }}
          />
        )}

        <div className="controls-toolbar">
          <div className="controls-primary" aria-label="Điều khiển chính">
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
              className={`btn control-btn ${showBeauty || beauty.active ? 'active-share' : ''}`}
              onClick={() => {
                setShowBeauty((v) => !v)
                setShowReactions(false)
                setShowStickerPanel(false)
                setShowPlayfulPanel(false)
                setShowQuickComments(false)
                setShowStars(false)
              }}
              title="Làm đẹp camera"
              aria-label="Làm đẹp"
              disabled={!camOn}
            >
              <IconBeauty />
              <span>Làm đẹp</span>
            </button>
            <button
              type="button"
              className={`btn control-btn ${screenSharing ? 'active-share' : ''}`}
              onClick={() => void onToggleShare()}
              title={screenSharing ? 'Dừng share' : 'Share màn hình'}
              aria-label={screenSharing ? 'Dừng share' : 'Share màn hình'}
            >
              {screenSharing ? <IconScreenOff /> : <IconScreen />}
              <span>{screenSharing ? 'Dừng share' : 'Share'}</span>
            </button>
            {canAdminRecord && canRecord && (
              <button
                type="button"
                className={`btn control-btn ${recording ? 'recording-active danger' : ''}`}
                onClick={() => void onToggleRecord()}
                title={
                  recording
                    ? 'Dừng ghi và tải file .webm về máy'
                    : 'Ghi toàn màn hình máy (chọn Entire screen) + tiếng lớp'
                }
                aria-label={recording ? 'Dừng ghi màn hình' : 'Ghi màn hình'}
              >
                <IconRecord active={recording} />
                <span>{recording ? `Dừng ${elapsedLabel}` : 'Ghi màn'}</span>
              </button>
            )}
          </div>

          <div className="controls-extra" aria-label="Công cụ bổ trợ">
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
                <IconPeople />
                <span>{teachPip.open ? 'Đóng hộp' : 'Học viên'}</span>
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
                  setShowBeauty(false)
                  if (showStickerPanel) setSelectedSticker(null)
                }}
                title="Sticker trên màn share"
                aria-label="Sticker"
              >
                <IconSticker />
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
                <IconEraser />
                <span>{screenStickers.length > 0 ? `Xóa (${screenStickers.length})` : 'Xóa sticker'}</span>
              </button>
            )}
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
              <IconReact />
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
              <IconPlayful />
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
                <IconMegaphone />
                <span>Nhanh</span>
              </button>
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
          </div>

          <div className="controls-leave">
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
          </div>
        </div>

        {status === 'connecting' && <span className="muted">Đang kết nối…</span>}
      </footer>
    </div>
  )
}
