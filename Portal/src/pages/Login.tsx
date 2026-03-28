import React, { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail } from 'lucide-react';
import './Login.css';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'logout') {
            signOut(auth).then(() => {
                // Clear the query param so refresh doesn't keep logging out
                window.history.replaceState({}, '', window.location.pathname);
            });
            return; // Stop here, don't redirect to dashboard yet
        }

        if (user) {
            navigate('/', { replace: true });
        }
    }, [user, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Navigation handled by useEffect when user state updates
        } catch (err: any) {
            setError('Login failed. Please check your credentials.');
            console.error('Login error:', err);
            let msg = 'Login failed. ';
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                msg += 'Invalid email or password.';
            } else {
                msg += err.message;
            }
            setError(msg);
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
                    <h1 className="login-title">Cross Manager Portal</h1>
                    <p className="login-subtitle">Sign in to access your workspace</p>
                </div>

                {error && (
                    <div className="login-error">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label>Email Address</label>
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
                        <label>Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="login-button">
                        Sign In
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: '#cbd5e1' }}>
                    <p>
                        계정이 없으신가요?{' '}
                        <span
                            style={{ color: '#60a5fa', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => navigate('/signup')}
                        >
                            직원등록
                        </span>
                    </p>
                </div>

                <div className="login-footer">
                    © 2024 Cross Unified System
                </div>
            </motion.div>
        </div>
    );
}
