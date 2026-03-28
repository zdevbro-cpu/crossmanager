import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

type LocalUser = {
  uid: string
  email: string | null
  displayName?: string | null
  role?: string
  mock: true
}

type SessionUser = User | LocalUser

type AuthContextValue = {
  user: SessionUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const STORAGE_KEY = 'swms-local-user'

const AuthContext = createContext<AuthContextValue | null>(null)

const getPortalLoginUrl = () => {
  const envUrl = import.meta.env.VITE_PORTAL_LOGIN_URL as string | undefined
  if (envUrl) return envUrl

  const { protocol, hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:5173/login`
  }
  return `${window.location.origin}/login`
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    // 1. Try SSO first (High Priority)
    const params = new URLSearchParams(window.location.search)
    const ssoUserStr = params.get('sso_user')
    if (ssoUserStr) {
      try {
        const ssoUser = JSON.parse(decodeURIComponent(ssoUserStr))
        const localUser: LocalUser = {
          uid: ssoUser.uid || 'sso-user',
          email: ssoUser.email,
          displayName: ssoUser.name,
          role: ssoUser.role,
          mock: true
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localUser))
        window.history.replaceState({}, '', window.location.pathname)
        return localUser
      } catch (e) {
        console.error('SSO Login Failed:', e)
      }
    }

    // 2. Try Local Storage
    if (!auth) {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as LocalUser
      }
    }
    return null
  })

  // Loading state depends on whether we have a user initially
  const [loading, setLoading] = useState(!user && !!auth)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u)
      } else {
        const isLocalMock = user && 'mock' in user && (user as LocalUser).mock
        if (!isLocalMock) {
          setUser(null)
        }
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (auth) {
      await signInWithEmailAndPassword(auth, email, password)
      return
    }

    const localUser: LocalUser = {
      uid: 'local-dev',
      email,
      displayName: 'SWMS local user',
      mock: true,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localUser))
    setUser(localUser)
  }

  const signOut = async () => {
    if (auth) {
      await firebaseSignOut(auth)
    }
    localStorage.removeItem(STORAGE_KEY)
    window.location.replace(`${getPortalLoginUrl()}?action=logout`)
  }

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider must wrap useAuth.')
  return ctx
}
