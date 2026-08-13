import type { RoomReaction } from '../hooks/useRoom'
import { FUN_EMOJIS } from '../hooks/useRoom'

type BurstProps = {
  reactions: RoomReaction[]
}

export function ReactionBurst({ reactions }: BurstProps) {
  if (reactions.length === 0) return null
  return (
    <div className="reaction-burst" aria-hidden>
      {reactions.map((r) => (
        <div
          key={r.id}
          className="flying-emoji"
          style={{ left: `${r.x}%`, ['--drift' as string]: `${(Math.random() * 40 - 20).toFixed(0)}px` }}
        >
          <span className="flying-emoji-main">{r.emoji}</span>
          <span className="flying-emoji-name">{r.name}</span>
        </div>
      ))}
    </div>
  )
}

type BarProps = {
  onReact: (emoji: string) => void
}

export function ReactionBar({ onReact }: BarProps) {
  return (
    <div className="reaction-bar" role="group" aria-label="Reactions">
      {FUN_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="reaction-chip"
          title={`Gửi ${emoji}`}
          onClick={() => onReact(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
