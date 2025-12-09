import './Page.css'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { firebaseReady } from '../lib/firebase'
import { useToast } from '../components/ToastProvider'

function LoginPage() {
  const { signIn, signOut } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const from = (location.state as { from?: string } | undefined)?.from || '/equipment'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firebaseReady) {
      show('Firebase 설정이 없어 로그인할 수 없습니다. .env.local을 확인하세요.', 'warning')
      return
    }
    if (!email || !password) {
      show('이메일/비밀번호를 입력하세요.', 'warning')
      return
    }
    setLoading(true)
    try {
      // 1. Firebase Login
      await signIn(email, password)

      // 2. Check Backend Status (Skipped for Production/Demo until Backend is deployed)
      // if (auth && auth.currentUser) { ... }

      show('로그인 성공', 'success')
      navigate(from, { replace: true })

      show('로그인 성공', 'success')
      navigate(from, { replace: true })
    } catch (err: any) {
      console.error(err)
      await signOut()
      show('로그인 실패: 이메일/비번 또는 승인 상태를 확인하세요.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="center-page">
      <div className="auth-card">
        <h2>EMS 로그인</h2>
        <p className="muted">장비 관리 시스템 - 승인된 계정으로 접속하세요.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>이메일</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '확인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
