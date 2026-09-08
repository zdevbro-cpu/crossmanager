import { useState, useEffect, useContext, createContext } from 'react'
import { signInWithEmailAndPassword, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from '../lib/firebase'

interface AuthContextType {
  user: any
  loading: boolean
  signIn: (email: string, pass: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => { },
  signOut: async () => { },
})

const getPortalLoginUrl = () => {
  const envUrl = import.meta.env.VITE_PORTAL_LOGIN_URL as string | undefined
  if (envUrl) return envUrl

  const { protocol, hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:5173/login`
  }
  return `${window.location.origin}/login`
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // SSO Check
    const params = new URLSearchParams(window.location.search)
    const ssoUserStr = params.get('sso_user')
    const STORAGE_KEY = 'ems-local-user'

    if (ssoUserStr) {
      try {
        const ssoUser = JSON.parse(decodeURIComponent(ssoUserStr))
        const localUser = {
          uid: ssoUser.uid || 'sso-user',
          email: ssoUser.email,
          displayName: ssoUser.name,
          role: ssoUser.role,
          mock: true
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localUser))
        setUser(localUser)
        setLoading(false)
        window.history.replaceState({}, '', window.location.pathname)
        return
      } catch (e) {
        console.error('SSO Login Failed:', e)
      }
    }

    if (!auth) {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setUser(JSON.parse(stored))
      }
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async (email: string, pass: string) => {
    if (auth) {
      await signInWithEmailAndPassword(auth, email, pass)
    }
  }

  const signOut = async () => {
    if (auth) {
      await firebaseSignOut(auth)
    }
    window.location.replace(getPortalLoginUrl())
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
