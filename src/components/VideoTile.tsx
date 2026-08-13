import { useEffect, useRef } from 'react'

type Props = {
  stream: MediaStream | null
  muted?: boolean
  mirror?: boolean
  label: string
  micOn?: boolean
  camOn?: boolean
  sharing?: boolean
  self?: boolean
  /** contain = share stage, cover = camera tiles */
  fit?: 'cover' | 'contain'
  compact?: boolean
}

export function VideoTile({
  stream,
  muted = false,
  mirror = false,
  label,
  micOn = true,
  camOn = true,
  sharing = false,
  self = false,
  fit = 'cover',
  compact = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
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
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`${mirror && !sharing ? 'mirror' : ''} fit-${fit}`}
        style={{ opacity: showVideo ? 1 : 0 }}
      />
      {!showVideo && <div className="tile-avatar">{label.slice(0, 1).toUpperCase()}</div>}
      <div className="tile-meta">
        <span>
          {label}
          {self ? ' (bạn)' : ''}
          {sharing ? ' · đang share' : ''}
        </span>
        <span className={`dot ${micOn ? 'on' : 'off'}`} title={micOn ? 'Mic on' : 'Mic off'} />
      </div>
    </div>
  )
}
