import { useRef } from 'react'
import { useSpeaking } from '../hooks/useSpeaking'
import { useVideoStream } from '../hooks/useVideoStream'
import { QUICK_COMMENTS, type QuickComment } from '../lib/quickComments'
import { IconCam, IconCamOff, IconMic, IconMicOff, IconScreenOff } from './Icons'

export type TeachPipPerson = {
  id: string
  stream: MediaStream | null
  label: string
  micOn: boolean
  camOn: boolean
  isHostUser?: boolean
  mirror?: boolean
  stars?: number
}

export type TeachPipStarTarget = {
  id: string
  name: string
  count: number
}

export type TeachPipDock = {
  micOn: boolean
  camOn: boolean
  isHost?: boolean
  onToggleMic: () => void
  onToggleCam: () => void
  onStopShare: () => void
  onQuickComment: (comment: QuickComment) => void
  starTargets: TeachPipStarTarget[]
  onGiveStar: (id: string, name: string) => void
}

type Props = {
  people: TeachPipPerson[]
  dock: TeachPipDock
  panel: 'quick' | 'star' | null
  onPanel: (panel: 'quick' | 'star' | null) => void
}

function StripTile({
  person,
  canStar,
  onGiveStar,
}: {
  person: TeachPipPerson
  canStar: boolean
  onGiveStar: (id: string, name: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const speaking = useSpeaking(person.stream, person.micOn)
  const painted = useVideoStream(videoRef, person.stream)
  const showVideo = person.camOn && painted
  const stars = person.stars ?? 0

  return (
    <div className={`teach-strip-tile${speaking ? ' is-speaking' : ''}${showVideo ? '' : ' cam-off'}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        disablePictureInPicture
        controls={false}
        controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
        className={person.mirror ? 'mirror' : ''}
      />
      {!showVideo && <div className="teach-strip-avatar">{person.label.slice(0, 1).toUpperCase()}</div>}
      <div className="teach-strip-meta">
        <div className="teach-strip-meta-left">
          <span className="teach-strip-name">{person.label}</span>
          <span className="teach-strip-stars">⭐ {stars}</span>
        </div>
        <div className="teach-strip-meta-right">
          {!person.micOn && (
            <span className="teach-strip-mute" title="Mic tắt">
              <IconMicOff size={14} />
            </span>
          )}
          {canStar && (
            <button
              type="button"
              className="teach-strip-star-btn"
              title={`Tặng sao cho ${person.label}`}
              aria-label={`Tặng sao ${person.label}`}
              onClick={() => onGiveStar(person.id, person.label)}
            >
              ⭐
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function TeachPipGrid({ people, dock, panel, onPanel }: Props) {
  return (
    <div className="teach-pip">
      <div className="teach-pip-dock">
        <button type="button" className={dock.micOn ? '' : 'off'} onClick={dock.onToggleMic}>
          {dock.micOn ? <IconMic size={18} /> : <IconMicOff size={18} />}
          {dock.micOn ? 'Mic' : 'Unmute'}
        </button>
        <button type="button" className={dock.camOn ? '' : 'off'} onClick={dock.onToggleCam}>
          {dock.camOn ? <IconCam size={18} /> : <IconCamOff size={18} />}
          {dock.camOn ? 'Cam' : 'Cam off'}
        </button>
        <button type="button" className="stop" onClick={dock.onStopShare}>
          <IconScreenOff size={18} />
          Dừng
        </button>
        {dock.isHost && (
          <button
            type="button"
            className={panel === 'quick' ? 'on' : ''}
            onClick={() => onPanel(panel === 'quick' ? null : 'quick')}
          >
            <span>📢</span>
            Nhanh
          </button>
        )}
      </div>

      <div className="teach-pip-stage">
        {people.length === 0 ? (
          <div className="teach-pip-empty">Đang chờ học viên…</div>
        ) : (
          <div className="teach-pip-list">
            {people.map((p) => (
              <StripTile
                key={p.id}
                person={p}
                canStar={Boolean(dock.isHost)}
                onGiveStar={dock.onGiveStar}
              />
            ))}
          </div>
        )}

        {dock.isHost && panel === 'quick' && (
          <div className="teach-pip-panel">
            {QUICK_COMMENTS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="teach-pip-chip"
                onClick={() => {
                  dock.onQuickComment(c)
                  onPanel(null)
                }}
              >
                <span>{c.emoji}</span>
                {c.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
