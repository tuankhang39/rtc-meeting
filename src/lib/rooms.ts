import { get, onValue, ref, remove, set, update, type Unsubscribe } from 'firebase/database'
import { getDb } from './firebase'
import { MAX_PARTICIPANTS, randomId } from './webrtc'

export const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000

export type RoomIndexEntry = {
  name: string
  description?: string | null
  persistent: boolean
  createdAt: number
  emptyAt: number | null
  hostName?: string | null
}

function roomMetaRef(roomId: string) {
  return ref(getDb(), `rooms/${roomId}/meta`)
}

function roomIndexRef(roomId?: string) {
  return roomId ? ref(getDb(), `roomIndex/${roomId}`) : ref(getDb(), 'roomIndex')
}

export async function createPreparedRoom(name: string, description?: string, hostName?: string) {
  const id = randomId(6)
  const now = Date.now()
  const title = name.trim() || `Phòng ${id}`
  const desc = description?.trim() || null
  const meta: RoomIndexEntry & { updatedAt: number; maxParticipants: number } = {
    name: title,
    description: desc,
    persistent: true,
    createdAt: now,
    updatedAt: now,
    emptyAt: null,
    hostName: hostName?.trim() || null,
    maxParticipants: MAX_PARTICIPANTS,
  }
  await set(roomMetaRef(id), meta)
  await set(roomIndexRef(id), {
    name: title,
    description: desc,
    persistent: true,
    createdAt: now,
    emptyAt: null,
    hostName: hostName?.trim() || null,
  })
  return { id, name: title, description: desc }
}

export async function syncRoomIndex(
  roomId: string,
  patch: Partial<RoomIndexEntry> & { updatedAt?: number; maxParticipants?: number },
) {
  const now = Date.now()
  await update(roomMetaRef(roomId), { ...patch, updatedAt: now })
  const indexPatch: Record<string, unknown> = { updatedAt: now }
  if (patch.name !== undefined) indexPatch.name = patch.name
  if (patch.persistent !== undefined) indexPatch.persistent = patch.persistent
  if (patch.createdAt !== undefined) indexPatch.createdAt = patch.createdAt
  if (patch.emptyAt !== undefined) indexPatch.emptyAt = patch.emptyAt
  if (patch.hostName !== undefined) indexPatch.hostName = patch.hostName
  if (patch.description !== undefined) indexPatch.description = patch.description
  await update(roomIndexRef(roomId), indexPatch)
}

export async function markRoomOccupied(roomId: string, extra: Partial<RoomIndexEntry> = {}) {
  await syncRoomIndex(roomId, { ...extra, emptyAt: null })
}

export async function markRoomEmptyIfNeeded(roomId: string) {
  const db = getDb()
  const partsSnap = await get(ref(db, `rooms/${roomId}/participants`))
  const parts = partsSnap.val() as Record<string, unknown> | null
  if (parts && Object.keys(parts).length > 0) return

  const metaSnap = await get(roomMetaRef(roomId))
  const meta = (metaSnap.val() as RoomIndexEntry | null) ?? null
  if (meta?.persistent) {
    await syncRoomIndex(roomId, {
      name: meta.name,
      description: meta.description ?? null,
      persistent: true,
      createdAt: meta.createdAt,
      emptyAt: null,
      hostName: meta.hostName ?? null,
    })
    return
  }

  const emptyAt = Date.now()
  await syncRoomIndex(roomId, {
    name: meta?.name || `Phòng ${roomId}`,
    description: meta?.description ?? null,
    persistent: false,
    createdAt: meta?.createdAt ?? emptyAt,
    emptyAt,
    hostName: meta?.hostName ?? null,
  })
}

export async function deleteRoom(roomId: string) {
  const db = getDb()
  await remove(ref(db, `rooms/${roomId}`))
  await remove(roomIndexRef(roomId))
}

export async function sweepEmptyRooms(exceptRoomId?: string) {
  const snap = await get(roomIndexRef())
  const index = (snap.val() as Record<string, RoomIndexEntry> | null) ?? {}
  const now = Date.now()
  const db = getDb()

  for (const [id, entry] of Object.entries(index)) {
    if (id === exceptRoomId) continue
    if (entry?.persistent) continue
    const partsSnap = await get(ref(db, `rooms/${id}/participants`))
    const parts = partsSnap.val() as Record<string, unknown> | null
    const n = parts ? Object.keys(parts).length : 0
    if (n > 0) {
      if (entry.emptyAt) await syncRoomIndex(id, { ...entry, emptyAt: null })
      continue
    }
    const emptyAt = entry.emptyAt
    if (!emptyAt) {
      await syncRoomIndex(id, { ...entry, emptyAt: now })
      continue
    }
    if (now - emptyAt >= EMPTY_ROOM_TTL_MS) {
      const again = await get(ref(db, `rooms/${id}/participants`))
      const still = again.val() as Record<string, unknown> | null
      if (still && Object.keys(still).length > 0) continue
      const meta = (await get(roomMetaRef(id))).val() as RoomIndexEntry | null
      if (meta?.persistent) continue
      await deleteRoom(id)
    }
  }
}

export function roomJoinUrl(roomId: string) {
  const url = new URL('/', window.location.href)
  url.search = ''
  url.searchParams.set('room', roomId)
  return url.toString()
}

export function listenRoomIndex(cb: (rooms: Record<string, RoomIndexEntry>) => void): Unsubscribe {
  return onValue(roomIndexRef(), (snap) => {
    cb((snap.val() as Record<string, RoomIndexEntry> | null) ?? {})
  })
}
