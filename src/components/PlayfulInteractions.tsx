import type { Participant } from '../hooks/useRoom'
import { PLAYFUL_ACTIONS, type PlayfulEffect, type PlayfulKind } from '../lib/playful'

type OverlayProps = {
  effects: PlayfulEffect[]
}

export function PlayfulOverlay({ effects }: OverlayProps) {
  if (effects.length === 0) return null

  return (
    <div className="playful-overlay" aria-hidden>
      {effects.map((fx) => (
        <div key={fx.id} className={`playful-fx playful-${fx.kind}`}>
          {fx.kind === 'tease' && (
            <>
              <span className="playful-poke">{fx.emoji}</span>
              <span className="playful-boop">Boop!</span>
            </>
          )}
          {fx.kind === 'flower' && (
            <>
              <span className="playful-bouquet">{fx.emoji}</span>
              <span className="playful-petal p1">🌸</span>
              <span className="playful-petal p2">🌺</span>
              <span className="playful-petal p3">💮</span>
            </>
          )}
          {fx.kind === 'judge' && (
            <div className="playful-stamp">
              <span className="playful-stamp-emoji">{fx.emoji}</span>
              <span className="playful-stamp-label">{fx.label ?? 'Phê bình'}</span>
            </div>
          )}
          {fx.kind === 'slap' && (
            <>
              <span className="playful-throw">{fx.emoji}</span>
              <span className="playful-splat">💥</span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

type PickerProps = {
  participants: Record<string, Participant>
  myUserId: string
  onSend: (targetId: string, kind: PlayfulKind) => void
}

export function PlayfulPicker({ participants, myUserId, onSend }: PickerProps) {
  const others = Object.entries(participants).filter(([id]) => id !== myUserId)

  return (
    <div className="playful-picker" role="group" aria-label="Chọc ghẹo bạn bè">
      <p className="playful-picker-title">Chọn người &amp; hành động</p>

      {others.length === 0 ? (
        <p className="muted playful-empty">Chưa có ai để chọc ghẹo cả 🐰</p>
      ) : (
        others.map(([id, p]) => (
          <div key={id} className="playful-target">
            <span className="playful-target-name">{p.name}</span>
            <div className="playful-actions">
              {PLAYFUL_ACTIONS.map((action) => (
                <button
                  key={action.kind}
                  type="button"
                  className="playful-action-btn"
                  title={`${action.title}: ${action.hint}`}
                  onClick={() => onSend(id, action.kind)}
                >
                  <span className="playful-action-emoji">{action.emoji}</span>
                  <span className="playful-action-label">{action.title}</span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
