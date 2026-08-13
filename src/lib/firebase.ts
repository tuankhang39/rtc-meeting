import { type FirebaseApp, initializeApp } from 'firebase/app'
import { type Database, getDatabase, goOnline, onDisconnect, ref, remove, set } from 'firebase/database'
import { randomId } from './webrtc'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.databaseURL &&
      firebaseConfig.projectId &&
      !String(firebaseConfig.apiKey).includes('your_'),
  )
}

let app: FirebaseApp | null = null
let database: Database | null = null
let presenceId: string | null = null

export function getDb(): Database {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase chưa được cấu hình (.env)')
  }
  if (!app || !database) {
    app = initializeApp(firebaseConfig)
    database = getDatabase(app)
  }
  return database
}

async function markPresence(page: string) {
  const db = getDb()
  if (!presenceId) presenceId = randomId(10)
  const presenceRef = ref(db, `appPresence/${presenceId}`)
  await set(presenceRef, { page, at: Date.now() })
  await onDisconnect(presenceRef).remove()
}

export function connectDb(page = 'app'): Database {
  const db = getDb()
  try {
    goOnline(db)
  } catch {
    /* already online */
  }
  void markPresence(page).catch(() => {})
  return db
}

export function disconnectDb() {
  if (!database) return
  if (presenceId) {
    void remove(ref(database, `appPresence/${presenceId}`))
    presenceId = null
  }
  // Không goOffline: cắt socket rồi vào lại phòng cũ làm signaling/WebRTC chết.
  // Tab đóng thì onDisconnect vẫn gỡ presence.
}
