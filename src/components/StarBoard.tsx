import type { Participant, StarScore } from '../hooks/useRoom'

type Props = {
  participants: Record<string, Participant>
  scores: Record<string, StarScore>
  myUserId: string
  onGive: (targetId: string, name: string) => void
}

export function StarBoard({ participants, scores, myUserId, onGive }: Props) {
  const rows = Object.entries(participants)
    .map(([id, p]) => ({
      id,
      name: p.name,
      count: scores[id]?.count ?? 0,
      self: id === myUserId,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return (
    <div className="star-board" role="group" aria-label="Bảng sao buổi học">
      <p className="star-board-title">Sao buổi học</p>
      {rows.length === 0 ? (
        <p className="muted star-board-empty">Chưa có ai trong phòng</p>
      ) : (
        rows.map((row) => (
          <div key={row.id} className="star-board-row">
            <span className="star-board-name">
              {row.name}
              {row.self ? ' (bạn)' : ''}
            </span>
            <span className="star-board-count">⭐ {row.count}</span>
            {!row.self && (
              <button
                type="button"
                className="star-board-give"
                title={`Tặng sao cho ${row.name}`}
                onClick={() => onGive(row.id, row.name)}
              >
                Tặng
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
