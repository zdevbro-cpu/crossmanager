import './Page.css'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useToast } from '../components/ToastProvider'
import { Eye, EyeOff } from 'lucide-react'

function SignupPage() {
    const { show } = useToast()
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [name, setName] = useState('')
    const [contact, setContact] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    // Phone number formatting
    const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9]/g, '')
        let formatted = value
        if (value.length > 3 && value.length <= 7) {
            formatted = `${value.slice(0, 3)}-${value.slice(3)}`
        } else if (value.length > 7) {
            formatted = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7, 11)}`
        }
        setContact(formatted)
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.')
            return
        }

        setLoading(true)
        setError('')

        try {
            if (!auth) throw new Error('Firebase Auth not initialized')
            // 1. Firebase Signup
            const userCredential = await createUserWithEmailAndPassword(auth, email, password)
            const user = userCredential.user

            // 2. Register to Backend (Strip hyphens from contact)
            const cleanContact = contact.replace(/-/g, '')
            const res = await fetch('http://localhost:3000/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    name: name,
                    contact: cleanContact
                }),
            })

            if (!res.ok) throw new Error('Backend registration failed')

            // Success
            show('직원 등록 요청이 전송되었습니다. 관리자 승인을 기다려주세요.', 'success')
            navigate('/login')
        } catch (err: any) {
            console.error(err)
            if (err.code === 'auth/email-already-in-use') {
                setError('이미 사용 중인 이메일입니다.')
            } else {
                setError('회원가입 중 오류가 발생했습니다.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="center-page">
            <div className="auth-card">
                <h2>직원등록</h2>
                <p className="muted">시스템 사용을 위해 가입을 요청합니다.</p>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSignup} className="auth-form">
                    <label>
                        <span>이메일</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="user@example.com"
                        />
                    </label>
                    <label>
                        <span>비밀번호</span>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="Min. 6 characters"
                                style={{ width: '100%', paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: '#9fb2cc',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 0
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </label>
                    <label>
                        <span>비밀번호 확인</span>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="비밀번호 재입력"
                                style={{ width: '100%', paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: '#9fb2cc',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 0
                                }}
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </label>
                    <label>
                        <span>이름</span>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="홍길동"
                        />
                    </label>
                    <label>
                        <span>연락처</span>
                        <input
                            type="text"
                            value={contact}
                            onChange={handleContactChange}
                            required
                            placeholder="010-1234-5678"
                            maxLength={13}
                        />
                    </label>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? '처리 중...' : '가입 요청'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>이미 계정이 있으신가요? <a onClick={() => navigate('/login')}>로그인</a></p>
                </div>
            </div>
        </div>
    )
}

export default SignupPage
