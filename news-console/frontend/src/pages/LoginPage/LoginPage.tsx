import '../LandingPage/LandingPage.scss';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LOGIN_KEY, LOGIN_NAME_KEY, LOGIN_EMAIL_KEY, LOGIN_ROLE_KEY } from '../../lib/session';

const API_BASE = 'http://localhost:5000';

export default function LoginPage() {
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json() as {
        token?: string; name?: string; email?: string; role?: string; error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? 'Invalid email or password.');
        return;
      }

      sessionStorage.setItem(LOGIN_KEY,       data.token!);
      sessionStorage.setItem(LOGIN_NAME_KEY,  data.name  ?? '');
      sessionStorage.setItem(LOGIN_EMAIL_KEY, data.email ?? '');
      sessionStorage.setItem(LOGIN_ROLE_KEY,  data.role  ?? 'user');
      navigate('/news');
    } catch {
      setError('Server unreachable.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing">
      <div className="landing-inner">

        <div className="landing-hero">
          <div className="landing-eyebrow">News Intelligence Platform</div>
          <h1 className="landing-title">
            News<span>Trend</span>
          </h1>
        </div>

        <div className="landing-card">
          <div className="landing-card-header">
            <div className="landing-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <div className="landing-card-title">Sign In</div>
              <div className="landing-card-subtitle">Enter your email and password to continue</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off">
            <label className="landing-connect-label" htmlFor="login-email">
              Email address
            </label>
            <input
              id="login-email"
              className="landing-connect-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              autoComplete="email"
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />

            <label
              className="landing-connect-label"
              htmlFor="login-password"
              style={{ marginTop: '14px' }}
            >
              Password
            </label>
            <input
              id="login-password"
              className="landing-connect-input"
              type="password"
              placeholder="Your password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />

            {error && (
              <div className="landing-status landing-status--error" style={{ marginTop: '12px' }}>
                <span className="landing-status-icon">✕</span>
                <span>{error}</span>
              </div>
            )}

            <button
              className="landing-btn"
              type="submit"
              disabled={loading || !email.trim() || !password}
              style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}
            >
              {loading ? <span className="landing-spinner" /> : (
                <>
                  Sign In
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="login-hint">
            Don't have an account?{' '}
            <Link to="/register" className="auth-switch-link">Create one</Link>
          </p>
        </div>

      </div>
    </div>
  );
}
