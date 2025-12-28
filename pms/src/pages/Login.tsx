import './Page.css'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { firebaseReady } from '../lib/firebase'
import { useToast } from '../components/ToastProvider'

function LoginPage() {
  const { signIn } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  void location

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email || !password) {
      show('Please enter email and password.', 'warning')
      return
    }
    setLoading(true)
    try {
      if (!firebaseReady) {
        show('Firebase env missing. Using local login fallback.', 'warning')
      }
      await signIn(email, password)
      show('Login successful.', 'success')
      const baseUrl = import.meta.env.BASE_URL || '/pms/'
      window.location.assign(`${baseUrl}overview`)
    } catch (err) {
      console.error(err)
      show('Login failed. Check your account or env settings.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="center-page">
      <div className="auth-card">
        <h2>PMS Login</h2>
        <p className="muted">Sign in to continue.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            No account?{' '}
            <a onClick={() => navigate('/signup')}>Create one</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
