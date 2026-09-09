import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import './Login.css';

export default function Signup() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Phone number formatting
    const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        let formatted = value;
        if (value.length > 3 && value.length <= 7) {
            formatted = `${value.slice(0, 3)}-${value.slice(3)}`;
        } else if (value.length > 7) {
            formatted = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7, 11)}`;
        }
        setContact(formatted);
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            if (!auth) throw new Error('Firebase Auth not initialized');

            // 1. Firebase Signup
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Register to Backend (Strip hyphens from contact)
            const cleanContact = contact.replace(/-/g, '');
            const res = await fetch('http://localhost:3000/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    name: name,
                    contact: cleanContact
                }),
            });

            if (!res.ok) throw new Error('Backend registration failed');

            // Success
            setSuccess('직원 등록 요청이 전송되었습니다. 관리자 승인을 기다려주세요.');
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                setError('이미 사용 중인 이메일입니다.');
            } else {
                setError('회원가입 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="login-card"
            >
                <div className="login-header">
                    <h1 className="login-title">Cross Manager</h1>
                    <p className="login-subtitle">직원 등록 (Employee Registration)</p>
                </div>

                {error && (
                    <div className="login-error">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="login-error" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399' }}>
                        {success}
                    </div>
                )}

                <form onSubmit={handleSignup} className="login-form">
                    <div className="form-group">
                        <label>이메일 (Email)</label>
                        <div className="input-wrapper">
                            <Mail className="input-icon" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>비밀번호 (Password)</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Min. 6 characters"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 0
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>비밀번호 확인 (Confirm Password)</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 0
                                }}
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>이름 (Name)</label>
                        <div className="input-wrapper">
                            <User className="input-icon" size={20} />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="홍길동"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>연락처 (Contact)</label>
                        <div className="input-wrapper">
                            <Phone className="input-icon" size={20} />
                            <input
                                type="text"
                                value={contact}
                                onChange={handleContactChange}
                                placeholder="010-1234-5678"
                                maxLength={13}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? '처리 중...' : '가입 요청'}
                    </button>
                </form>

                <div className="login-footer">
                    <p style={{ cursor: 'pointer' }} onClick={() => navigate('/login')}>
                        이미 계정이 있으신가요? 로그인
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
