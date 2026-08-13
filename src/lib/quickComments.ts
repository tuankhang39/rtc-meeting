export type QuickComment = {
  id: string
  text: string
  emoji: string
}

export const QUICK_COMMENTS: QuickComment[] = [
  { id: 'focus', text: 'Tập trung nào các em', emoji: '👀' },
  { id: 'ten', text: '10 điểm!', emoji: '⭐' },
  { id: 'good', text: 'Giỏi lắm!', emoji: '👏' },
  { id: 'quiet', text: 'Im lặng nào', emoji: '🤫' },
  { id: 'answer', text: 'Ai trả lời thử?', emoji: '🙋' },
  { id: 'homework', text: 'Về nhà làm bài đầy đủ nha', emoji: '📝' },
  { id: 'late', text: 'Muộn rồi đấy', emoji: '⏰' },
  { id: 'sleep', text: 'Đừng ngủ gật nha', emoji: '😴' },
  { id: 'camera', text: 'Bật cam lên nào', emoji: '📷' },
  { id: 'zero', text: '0 điểm!', emoji: '💀' },
  { id: 'bonus', text: 'Cộng điểm chuyên cần', emoji: '✨' },
  { id: 'think', text: 'Suy nghĩ kỹ rồi trả lời', emoji: '🧠' },
  { id: 'repeat', text: 'Thầy cô nói lại lần nữa nha', emoji: '🔁' },
  { id: 'note', text: 'Ghi bài vào vở đi', emoji: '✏️' },
  { id: 'group', text: 'Chia nhóm thảo luận', emoji: '👥' },
  { id: 'break', text: 'Nghỉ giải lao 5 phút', emoji: '☕' },
  { id: 'exam', text: 'Kiểm tra miệng nha', emoji: '📋' },
  { id: 'raise', text: 'Giơ tay trước khi nói', emoji: '✋' },
  { id: 'laugh', text: 'Cười gì vậy?', emoji: '😂' },
  { id: 'almost', text: 'Gần đúng rồi!', emoji: '🎯' },
]

export type QuickCommentEvent = {
  id: string
  text: string
  emoji: string
  fromUserId: string
  fromName: string
  createdAt: number
}

export function quickCommentAnnounce(fromName: string, text: string, myUserId?: string, fromUserId?: string): string {
  const from = myUserId && fromUserId === myUserId ? 'Bạn' : fromName || 'Ai đó'
  return `${from}: ${text}`
}
