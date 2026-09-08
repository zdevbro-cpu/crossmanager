import './Page.css'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
    const from = (location.state as { from?: string } | undefined)?.from || '/'

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!email || !password) {
            show('이메일과 비밀번호를 입력하세요.', 'warning')
            return
        }
        setLoading(true)
        try {
            await signIn(email, password)
            show(firebaseReady ? '로그인 완료' : '로컬 모드로 로그인했습니다.', 'success')
            navigate(from, { replace: true })
        } catch (err) {
            console.error(err)
            show('로그인에 실패했습니다. 계정 정보를 확인하세요.', 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="center-page">
            <div className="auth-card">
                <h2>SWMS 로그인</h2>
                <p className="muted">
                    {firebaseReady ? '스크랩·폐기물 관리 계정으로 로그인하세요.' : 'Firebase 환경변수가 없어 로컬 모드로 로그인합니다.'}
                </p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <label>
                        <span>이메일</span>
                        <input
                            type="email"
                            value={email}
                            autoComplete="email"
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </label>
                    <label>
                        <span>비밀번호</span>
                        <input
                            type="password"
                            value={password}
                            autoComplete="current-password"
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
