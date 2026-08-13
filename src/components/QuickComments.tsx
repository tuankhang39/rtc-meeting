import { useEffect } from 'react'
import { prefetchQuickCommentSounds, unlockQuickAudio } from '../lib/quickAudio'
import { QUICK_COMMENTS, type QuickComment } from '../lib/quickComments'

type Props = {
  onSend: (comment: QuickComment) => void
}

export function QuickCommentBar({ onSend }: Props) {
  useEffect(() => {
    unlockQuickAudio()
    prefetchQuickCommentSounds()
  }, [])

  return (
    <div className="quick-comment-bar" role="group" aria-label="Bình luận nhanh">
      <p className="quick-comment-title">📢 Bình luận nhanh</p>
      <div className="quick-comment-grid">
        {QUICK_COMMENTS.map((c) => (
          <button
            key={c.id}
            type="button"
            className="quick-comment-chip"
            title={c.text}
            onClick={() => {
              unlockQuickAudio()
              onSend(c)
            }}
          >
            <span className="quick-comment-emoji">{c.emoji}</span>
            <span className="quick-comment-text">{c.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
