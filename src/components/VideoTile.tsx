import { useEffect, useRef } from 'react'
import { useSpeaking } from '../hooks/useSpeaking'
import { useVideoStream } from '../hooks/useVideoStream'
import type { PlayfulEffect } from '../lib/playful'
import { PlayfulOverlay } from './PlayfulInteractions'
import { IconMicOff } from './Icons'

type Props = {
  stream: MediaStream | null
  audioStream?: MediaStream | null
  muted?: boolean
  mirror?: boolean
  label: string
  micOn?: boolean
  camOn?: boolean
  sharing?: boolean
  self?: boolean
  isHostUser?: boolean
  fit?: 'cover' | 'contain'
  compact?: boolean
  /** Host can mute this participant */
  canMute?: boolean
  onMute?: () => void
  stars?: number
  canStar?: boolean
  onStar?: () => void
  starBurst?: boolean
  playfulEffects?: PlayfulEffect[]
  /** Hiện thay avatar khi chưa có hình (dùng cho khung màn hình đang share). */
  placeholder?: string
}

export function VideoTile({
  stream,
  audioStream,
  muted = false,
  mirror = false,
  label,
  micOn = true,
  camOn = true,
  sharing = false,
  self = false,
  isHostUser = false,
  fit = 'cover',
  compact = false,
  canMute = false,
  onMute,
  stars = 0,
  canStar = false,
  onStar,
  starBurst = false,
  playfulEffects = [],
  placeholder,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const speakFrom = audioStream ?? stream
  const speaking = useSpeaking(speakFrom, micOn)

  const painted = useVideoStream(videoRef, stream)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const src = muted ? null : (audioStream ?? stream)
    if (el.srcObject !== src) el.srcObject = src

    const hasLiveAudio = () => Boolean(src?.getAudioTracks().some((t) => t.readyState === 'live'))

    const play = () => {
      if (!hasLiveAudio()) return
      void el.play().catch(() => {})
    }

    play()
    // Autoplay hay bị chặn → thử lại khi user tương tác / tab hiện lại.
    document.addEventListener('pointerdown', play)
    document.addEventListener('keydown', play)
    document.addEventListener('visibilitychange', play)
    const timer = window.setInterval(play, 2000)

    const onAdd = () => play()
    src?.addEventListener('addtrack', onAdd)

    return () => {
      document.removeEventListener('pointerdown', play)
      document.removeEventListener('keydown', play)
      document.removeEventListener('visibilitychange', play)
      window.clearInterval(timer)
      src?.removeEventListener('addtrack', onAdd)
    }
  }, [audioStream, muted, stream])

  const showVideo = camOn && painted

  return (
    <div
      className={[
        'tile',
        self ? 'tile-self' : '',
        sharing ? 'tile-sharing' : '',
        compact ? 'tile-compact' : '',
        fit === 'contain' ? 'tile-stage' : '',
        speaking ? 'is-speaking' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="speak-fx" aria-hidden>
        <span className="ripple ripple-1" />
        <span className="ripple ripple-2" />
      </div>

      <div className="tile-media">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`${mirror && !sharing ? 'mirror' : ''} fit-${fit}`}
          style={{ opacity: showVideo ? 1 : 0 }}
        />
        {!muted && <audio ref={audioRef} autoPlay />}
        {!showVideo &&
          (placeholder ? (
            <div className="stage-wait">
              <p>{placeholder}</p>
              <span className="muted">Chờ hình từ người share</span>
            </div>
          ) : (
            <div className="tile-avatar">{label.slice(0, 1).toUpperCase()}</div>
          ))}
      </div>

      <PlayfulOverlay effects={playfulEffects} />

      {isHostUser && <span className="host-badge">Host</span>}

      <div className="tile-actions">
        {canStar && (
          <button
            type="button"
            className="tile-star-btn"
            title={`Tặng sao cho ${label}`}
            aria-label={`Tặng sao ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              onStar?.()
            }}
          >
            ⭐
          </button>
        )}
        {canMute && micOn && (
          <button
            type="button"
            className="tile-mute-btn"
            title="Tắt mic người này"
            aria-label={`Tắt mic ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              onMute?.()
            }}
          >
            <IconMicOff size={16} />
          </button>
        )}
      </div>

      {starBurst && (
        <div className="star-burst" aria-hidden>
          ⭐
        </div>
      )}

      <div className="tile-meta">
        <span>
          {label}
          {self ? ' (bạn)' : ''}
          {sharing ? ' · đang share' : ''}
        </span>
        <span className="tile-star-count" title={`${stars} sao`}>
          ⭐ {stars}
        </span>
        <span className={`dot ${micOn ? (speaking ? 'speak' : 'on') : 'off'}`} title={micOn ? 'Mic on' : 'Mic off'} />
      </div>
    </div>
  )
}
