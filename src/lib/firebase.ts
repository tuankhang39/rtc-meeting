import { type FirebaseApp, initializeApp } from 'firebase/app'
import { type Database, getDatabase } from 'firebase/database'

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
