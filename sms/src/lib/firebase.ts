import { initializeApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

export const firebaseReady = missingKeys.length === 0

if (!firebaseReady) {
  // eslint-disable-next-line no-console
  console.warn(`Firebase 환경변수가 누락되었습니다: ${missingKeys.join(', ')}. 로컬 모드로 동작합니다.`)
}

export const app = firebaseReady ? initializeApp(firebaseConfig) : undefined
export const auth: Auth | undefined = app ? getAuth(app) : undefined
export const storage: FirebaseStorage | undefined = app ? getStorage(app) : undefined
