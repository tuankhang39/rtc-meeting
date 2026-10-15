/**
 * Một setInterval dùng chung cho mỗi chu kỳ.
 *
 * Mỗi ô video (lưới, thanh bên, PiP) cần soát định kỳ: video đã có hình chưa,
 * audio có bị autoplay chặn không. Mỗi ô tự tạo timer thì phòng 6 người lúc share
 * + mở PiP là hơn 20 timer thức dậy lệch nhịp nhau. Gom về một timer/chu kỳ để
 * trình duyệt chỉ thức một lần rồi chạy hết.
 */

type Group = { timer: number; fns: Set<() => void> }

const groups = new Map<number, Group>()

/** Gọi `fn` mỗi `ms` mili giây; trả về hàm huỷ. */
export function onTick(ms: number, fn: () => void): () => void {
  let group = groups.get(ms)
  if (!group) {
    const fns = new Set<() => void>()
    const timer = window.setInterval(() => {
      for (const f of fns) {
        try {
          f()
        } catch {
          /* một ô lỗi không được làm dừng các ô khác */
        }
      }
    }, ms)
    group = { timer, fns }
    groups.set(ms, group)
  }
  group.fns.add(fn)

  return () => {
    const current = groups.get(ms)
    if (!current) return
    current.fns.delete(fn)
    if (current.fns.size > 0) return
    window.clearInterval(current.timer)
    groups.delete(ms)
  }
}
