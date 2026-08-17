/** Lấy media linh hoạt: cam+mic → chỉ mic → vào phòng không thiết bị. */

export type LocalMedia = {
  stream: MediaStream
  mic: boolean
  camera: boolean
  warning: string | null
}

function isDomError(e: unknown, name: string) {
  return e instanceof DOMException && e.name === name
}

export function explainMediaError(e: unknown): string {
  if (isDomError(e, 'NotFoundError') || (e instanceof Error && /Requested device not found/i.test(e.message))) {
    return [
      'Không tìm thấy camera/mic.',
      '• Cắm webcam / bật mic',
      '• Windows: Settings → Privacy → Camera & Microphone → cho phép trình duyệt',
      '• Đóng Zoom/Teams/OBS đang giữ cam',
      '• Thử Chrome/Edge (không dùng HTTP trên máy khác — localhost thì OK)',
    ].join('\n')
  }
  if (isDomError(e, 'NotAllowedError') || isDomError(e, 'PermissionDeniedError')) {
    return 'Bạn đã chặn quyền camera/mic. Bấm ổ khóa trên thanh địa chỉ → Allow → tải lại trang.'
  }
  if (isDomError(e, 'NotReadableError') || isDomError(e, 'AbortError')) {
    return 'Camera/mic đang bị app khác chiếm (Zoom, Teams, Camera…). Đóng app đó rồi thử lại.'
  }
  if (e instanceof Error) return e.message
  return 'Không mở được camera/mic'
}

export function explainScreenShareError(e: unknown): string {
  if (isDomError(e, 'NotAllowedError') || isDomError(e, 'PermissionDeniedError')) {
    return 'Bạn đã hủy chia sẻ màn hình hoặc chặn quyền.'
  }
  if (e instanceof Error) return e.message
  return 'Không chia sẻ được màn hình'
}

export async function acquireScreenShare(): Promise<MediaStreamTrack> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Trình duyệt không hỗ trợ share màn hình. Dùng Chrome/Edge.')
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  })
  const track = stream.getVideoTracks()[0]
  if (!track) {
    stream.getTracks().forEach((t) => t.stop())
    throw new Error('Không lấy được track màn hình')
  }
  return track
}

export async function acquireLocalMedia(): Promise<LocalMedia> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Trình duyệt không hỗ trợ getUserMedia. Dùng Chrome/Edge mới.')
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    })
    return { stream, mic: true, camera: true, warning: null }
  } catch {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      return { stream, mic: true, camera: false, warning: null }
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
        return { stream, mic: false, camera: true, warning: null }
      } catch {
        return { stream: new MediaStream(), mic: false, camera: false, warning: 'Không mở được camera và mic. Kiểm tra quyền trình duyệt / thiết bị rồi tải lại trang.' }
      }
    }
  }
}
