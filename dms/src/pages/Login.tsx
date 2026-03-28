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
      show('로그인 성공', 'success')
      window.location.assign('/dms/dashboard')
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
        <h2>DMS 로그인</h2>
        <p className="muted">서비스를 이용하려면 로그인하세요.</p>

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
