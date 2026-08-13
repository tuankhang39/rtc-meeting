import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TeachPipGrid, type TeachPipDock, type TeachPipPerson } from '../components/TeachPip'
import { teachPipSize } from '../lib/teachPipStyles'
import {
  canUseDocumentPip,
  copyStylesToWindow,
  fitPipWindow,
  requestDocumentPip,
  syncPipTheme,
} from '../lib/documentPip'

type PipPanel = 'quick' | 'star' | null

export function useTeachPip(people: TeachPipPerson[], dock: TeachPipDock) {
  const peopleRef = useRef(people)
  peopleRef.current = people
  const dockRef = useRef(dock)
  dockRef.current = dock
  const winRef = useRef<Window | null>(null)
  const rootRef = useRef<Root | null>(null)
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<PipPanel>(null)
  const panelRef = useRef<PipPanel>(null)
  panelRef.current = panel

  const paint = useCallback(() => {
    const win = winRef.current
    if (!rootRef.current || !win || win.closed) return
    syncPipTheme(win)
    rootRef.current.render(
      <TeachPipGrid
        people={peopleRef.current}
        dock={dockRef.current}
        panel={panelRef.current}
        onPanel={setPanel}
      />,
    )
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (winRef.current && !winRef.current.closed) fitPipWindow(winRef.current)
      })
    })
  }, [])

  const close = useCallback(() => {
    rootRef.current?.unmount()
    rootRef.current = null
    const win = winRef.current
    winRef.current = null
    setOpen(false)
    setPanel(null)
    if (win && !win.closed) {
      try {
        win.close()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const openPip = useCallback(async () => {
    if (!canUseDocumentPip()) return false
    const existing = winRef.current
    if (existing && !existing.closed) {
      existing.focus()
      paint()
      return true
    }

    const size = teachPipSize(peopleRef.current.length, dockRef.current.isHost)
    const win = await requestDocumentPip(size)
    if (!win) return false

    copyStylesToWindow(win)
    const mount = win.document.createElement('div')
    mount.id = 'teach-pip-root'
    win.document.body.appendChild(mount)
    winRef.current = win
    rootRef.current = createRoot(mount)
    setOpen(true)
    setPanel(null)
    paint()

    const onGone = () => {
      rootRef.current?.unmount()
      rootRef.current = null
      winRef.current = null
      setOpen(false)
      setPanel(null)
    }
    win.addEventListener('pagehide', onGone)
    return true
  }, [paint])

  useEffect(() => {
    if (!dock.isHost && panel) setPanel(null)
  }, [dock.isHost, panel])

  useEffect(() => {
    paint()
  }, [people, dock.micOn, dock.camOn, dock.isHost, dock.starTargets, panel, paint])

  useEffect(() => () => close(), [close])

  return { open, supported: canUseDocumentPip(), openPip, close }
}
