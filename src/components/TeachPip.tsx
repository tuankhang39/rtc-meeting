import { useRef } from 'react'
import { useSpeaking } from '../hooks/useSpeaking'
import { useVideoStream } from '../hooks/useVideoStream'
import { QUICK_COMMENTS, type QuickComment } from '../lib/quickComments'
import { bearForId, bearPatternSvg, bearSvg, svgDataUri } from '../lib/bearArt'
import {
  BearCam,
  BearChat,
  BearCrown,
  BearMic,
  BearMinus,
  BearPaw,
  BearPin,
  BearPlus,
  BearStar,
  BearStopShare,
} from './BearIcons'

export type TeachPipPerson = {
  id: string
  stream: MediaStream | null
  label: string
  micOn: boolean
  camOn: boolean
  isHostUser?: boolean
  mirror?: boolean
  self?: boolean
  pinned?: boolean
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
  myUserId?: string
  onToggleMic: () => void
  onToggleCam: () => void
  onStopShare: () => void
  onQuickComment: (comment: QuickComment) => void
  starTargets: TeachPipStarTarget[]
  onGiveStar: (id: string, name: string) => void
  onTakeStar: (id: string, name: string) => void
}

type Props = {
  people: TeachPipPerson[]
  dock: TeachPipDock
  panel: 'quick' | 'star' | null
  onPanel: (panel: 'quick' | 'star' | null) => void
}

function BearArt({ svg, className }: { svg: string; className?: string }) {
  // svg là chuỗi tĩnh sinh từ bearArt.ts, không chứa dữ liệu người dùng.
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}

function StripTile({
  person,
  canStar,
  onGiveStar,
  onTakeStar,
}: {
  person: TeachPipPerson
  canStar: boolean
  onGiveStar: (id: string, name: string) => void
  onTakeStar: (id: string, name: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const speaking = useSpeaking(person.stream, person.micOn)
  const painted = useVideoStream(videoRef, person.stream)
  const showVideo = person.camOn && painted
  const stars = person.stars ?? 0
  const bear = bearForId(person.id || person.label)

  return (
    <div
      className={[
        'teach-strip-tile',
        `bear-${bear}`,
        speaking ? 'is-speaking' : '',
        showVideo ? '' : 'cam-off',
        person.pinned ? 'is-pinned' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {(person.pinned || person.isHostUser) && (
        <div className="teach-strip-badges">
          {person.pinned && (
            <span className="teach-strip-badge pin">
              <BearPin size={11} />
              Ghim
            </span>
          )}
          {person.isHostUser && (
            <span className="teach-strip-badge host">
              <BearCrown size={11} />
              Host
            </span>
          )}
        </div>
      )}
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
      {!showVideo && (
        <div className="teach-strip-avatar">
          <BearArt className="teach-strip-bear" svg={bearSvg(bear, 72)} />
          <span className="teach-strip-initial">{person.label.slice(0, 1).toUpperCase()}</span>
        </div>
      )}
      <div className="teach-strip-meta">
        <div className="teach-strip-meta-left">
          <span className="teach-strip-name">
            {person.label}
            {person.self ? ' (bạn)' : ''}
          </span>
          <span className="teach-strip-stars">
            <BearStar size={12} />
            {stars}
          </span>
        </div>
        <div className="teach-strip-meta-right">
          {!person.micOn && (
            <span className="teach-strip-mute" title="Mic tắt">
              <BearMic size={14} off />
            </span>
          )}
          {canStar && (
            <div className="teach-strip-star-group">
              <button
                type="button"
                className="teach-strip-star-btn take"
                title={`Trừ sao của ${person.label}`}
                aria-label={`Trừ sao ${person.label}`}
                disabled={stars <= 0}
                onClick={() => onTakeStar(person.id, person.label)}
              >
                <BearMinus size={12} />
              </button>
              <button
                type="button"
                className="teach-strip-star-btn give"
                title={`Tặng sao cho ${person.label}`}
                aria-label={`Tặng sao ${person.label}`}
                onClick={() => onGiveStar(person.id, person.label)}
              >
                <BearPlus size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const PATTERN = svgDataUri(bearPatternSvg())

export function TeachPipGrid({ people, dock, panel, onPanel }: Props) {
  return (
    <div className="teach-pip" style={{ backgroundImage: PATTERN }}>
      <div className="teach-pip-dock">
        <button type="button" className={dock.micOn ? 'is-on' : 'off'} onClick={dock.onToggleMic}>
          <span className="teach-pip-dock-ico">
            <BearMic size={20} off={!dock.micOn} />
          </span>
          {dock.micOn ? 'Mic' : 'Bật mic'}
        </button>
        <button type="button" className={dock.camOn ? 'is-on' : 'off'} onClick={dock.onToggleCam}>
          <span className="teach-pip-dock-ico">
            <BearCam size={20} off={!dock.camOn} />
          </span>
          {dock.camOn ? 'Cam' : 'Bật cam'}
        </button>
        <button type="button" className="stop" onClick={dock.onStopShare}>
          <span className="teach-pip-dock-ico">
            <BearStopShare size={20} />
          </span>
          Dừng
        </button>
        {dock.isHost && (
          <button
            type="button"
            className={['wide', panel === 'quick' ? 'on' : ''].filter(Boolean).join(' ')}
            onClick={() => onPanel(panel === 'quick' ? null : 'quick')}
          >
            <span className="teach-pip-dock-ico">
              <BearChat size={20} />
            </span>
            Nhắc nhanh
          </button>
        )}
      </div>

      <div className="teach-pip-stage">
        {people.length === 0 ? (
          <div className="teach-pip-empty">
            <BearArt className="teach-pip-empty-bear" svg={bearSvg('sleepy', 84)} />
            <span>Đang chờ học viên…</span>
          </div>
        ) : (
          <div className="teach-pip-list">
            {people.map((p) => (
              <StripTile
                key={p.id}
                person={p}
                canStar={Boolean(dock.isHost) && p.id !== dock.myUserId && !p.self}
                onGiveStar={dock.onGiveStar}
                onTakeStar={dock.onTakeStar}
              />
            ))}
          </div>
        )}

        {dock.isHost && panel === 'quick' && (
          <div className="teach-pip-panel">
            <div className="teach-pip-panel-head">
              <BearPaw size={14} />
              Nhắc nhanh
            </div>
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
                <span className="teach-pip-chip-emoji">{c.emoji}</span>
                {c.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
