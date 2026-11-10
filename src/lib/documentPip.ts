import { TEACH_PIP_CSS, teachPipSize } from './teachPipStyles'

type PipWindowOptions = {
  width?: number
  height?: number
}

export function canUseDocumentPip() {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window
}

export async function requestDocumentPip(options: PipWindowOptions = {}): Promise<Window | null> {
  const api = window.documentPictureInPicture
  if (!api) return null
  const size = teachPipSize()
  const width = options.width ?? size.width
  const height = options.height ?? size.height
  try {
    return await api.requestWindow({
      width,
      height,
      disallowReturnToOpener: true,
      preferInitialWindowPlacement: true,
    })
  } catch {
    try {
      return await api.requestWindow({ width, height })
    } catch {
      return null
    }
  }
}

export function copyStylesToWindow(target: Window) {
  const doc = target.document
  doc.documentElement.lang = 'vi'
  doc.documentElement.classList.add('teach-pip-html')
  doc.title = 'Học viên'

  for (const node of [...doc.head.querySelectorAll('style, link[rel="stylesheet"]')]) {
    if (node.id !== 'teach-pip-css') node.remove()
  }

  let style = doc.getElementById('teach-pip-css') as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = 'teach-pip-css'
    doc.head.appendChild(style)
  }
  style.textContent = TEACH_PIP_CSS
  doc.body.className = 'teach-pip-body'
}

export function syncPipTheme(target: Window | null) {
  if (!target || target.closed) return
  copyStylesToWindow(target)
}
