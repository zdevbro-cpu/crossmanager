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
  const from = (location.state as { from?: string } | undefined)?.from || '/overview'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email || !password) {
      show('?´ë©”??ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?˜ì„¸??', 'warning')
      return
    }
    setLoading(true)
    try {
      // 1. Firebase Login
      if (!firebaseReady) {
        show('Firebase env missing. Using local login fallback.', 'warning')
      }
      await signIn(email, password)

      // 2. Check Backend Status
      // 2. Check Backend Status skipped
      // if (auth && auth.currentUser) { ... }

      show('ë¡œê·¸???±ê³µ', 'success')
      navigate(from, { replace: true })
    } catch (err: any) {
      console.error(err)
      show('ë¡œê·¸???¤íŒ¨: ?´ë©”??ë¹„ë²ˆ ?ëŠ” ?¹ì¸ ?íƒœë¥??•ì¸?˜ì„¸??', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="center-page">
      <div className="auth-card">
        <h2>ì§ì› ë¡œê·¸??/h2>
        <p className="muted">?¹ì¸???´ë©”??ê³„ì •?¼ë¡œ ?‘ì†?´ì£¼?¸ìš”.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>?´ë©”??/span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span>ë¹„ë?ë²ˆí˜¸</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '?•ì¸ ì¤?..' : 'ë¡œê·¸??}
          </button>
        </form>

        <div className="auth-footer">
          <p>ê³„ì •???†ìœ¼? ê??? <a onClick={() => navigate('/signup')}>ì§ì› ?±ë¡(ê°€?…ìš”ì²?</a></p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage








