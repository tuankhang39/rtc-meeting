import { useEffect, useRef } from 'react'
import { useSpeaking } from '../hooks/useSpeaking'
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
  playfulEffects?: PlayfulEffect[]
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
  playfulEffects = [],
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const speakFrom = audioStream ?? stream
  const speaking = useSpeaking(speakFrom, micOn)

  useEffect(() => {
    const el = videoRef.current
    if (!el || el.srcObject === stream) return
    el.srcObject = stream
  }, [stream])

  const showVideo = sharing || camOn

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
          muted={muted}
          className={`${mirror && !sharing ? 'mirror' : ''} fit-${fit}`}
          style={{ opacity: showVideo ? 1 : 0 }}
        />
        {!showVideo && <div className="tile-avatar">{label.slice(0, 1).toUpperCase()}</div>}
      </div>

      <PlayfulOverlay effects={playfulEffects} />

      {isHostUser && <span className="host-badge">Host</span>}

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

      <div className="tile-meta">
        <span>
          {label}
          {self ? ' (bạn)' : ''}
          {sharing ? ' · đang share' : ''}
        </span>
        <span className={`dot ${micOn ? (speaking ? 'speak' : 'on') : 'off'}`} title={micOn ? 'Mic on' : 'Mic off'} />
      </div>
    </div>
  )
}
