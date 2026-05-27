import '../LandingPage/LandingPage.scss';
import './RegisterPage.scss';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LOGIN_KEY, LOGIN_NAME_KEY, LOGIN_EMAIL_KEY, LOGIN_ROLE_KEY } from '../../lib/session';

const API_BASE = 'http://localhost:5000';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [name,     setName]     = useState('');
  const [surname,  setSurname]  = useState('');
  const [address,  setAddress]  = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [emailError, setEmailError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) {
      setError('Please enter a valid email address (e.g. you@example.com).');
      return;
    }

    const phoneVal = phone.trim();
    if (phoneVal) {
      const phoneRe = /^[+]?[\d\s\-().]{7,20}$/;
      if (!phoneRe.test(phoneVal)) {
        setError('Phone must be 7–20 characters and may only contain digits, spaces, +, -, (, ).');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     name.trim(),
          surname:  surname.trim() || null,
          address:  address.trim() || null,
          email:    email.trim(),
          phone:    phone.trim() || null,
          password,
        }),
      });

      const data = await res.json() as {
        token?: string; name?: string; email?: string; role?: string;
        apiKey?: string; error?: string;
      };

      if (!res.ok) {
        const msg = data.error ?? 'Registration failed. Please try again.';
        const isDuplicateEmail = msg.toLowerCase().includes('email') && msg.toLowerCase().includes('already');
        setEmailError(isDuplicateEmail);
        setError(msg);
        return;
      }

      sessionStorage.setItem(LOGIN_KEY,       data.token!);
      sessionStorage.setItem(LOGIN_NAME_KEY,  data.name  ?? '');
      sessionStorage.setItem(LOGIN_EMAIL_KEY, data.email ?? '');
      sessionStorage.setItem(LOGIN_ROLE_KEY,  data.role  ?? 'user');

      navigate('/');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing">
      <div className="landing-inner">

        <div className="landing-hero">
          <div className="landing-eyebrow">News Intelligence Platform</div>
          <h1 className="landing-title">News<span>Trend</span></h1>
        </div>

        <div className="landing-card">
          <div className="landing-card-header">
            <div className="landing-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            <div>
              <div className="landing-card-title">Create Account</div>
              <div className="landing-card-subtitle">Fill in your details to get started</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" data-testid="register-form">

            <div className="register-row">
              <div className="register-field">
                <label className="landing-connect-label" htmlFor="reg-name">
                  First name <span className="register-required">*</span>
                </label>
                <input
                  id="reg-name"
                  className="landing-connect-input"
                  type="text"
                  placeholder="John"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  required
                />
              </div>
              <div className="register-field">
                <label className="landing-connect-label" htmlFor="reg-surname">
                  Last name <span className="register-optional">(optional)</span>
                </label>
                <input
                  id="reg-surname"
                  className="landing-connect-input"
                  type="text"
                  placeholder="Doe"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                />
              </div>
            </div>

            <label className="landing-connect-label" htmlFor="reg-email" style={{ marginTop: '14px' }}>
              Email address <span className="register-required">*</span>
            </label>
              <input
                  id="reg-email"
                  className={`landing-connect-input${emailError ? ' landing-connect-input--error' : ''}`}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => { setEmail(e.target.value); setError(''); setEmailError(false); }}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />

            <label className="landing-connect-label" htmlFor="reg-phone" style={{ marginTop: '14px' }}>
              Phone <span className="register-optional">(optional)</span>
            </label>
            <input
              id="reg-phone"
              className="landing-connect-input"
              type="tel"
              placeholder="+380 99 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              pattern="[+]?[\d\s\-().]{7,20}"
              maxLength={20}
              title="7–20 characters: digits, spaces, +, -, (, ) only"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />

            <label className="landing-connect-label" htmlFor="reg-address" style={{ marginTop: '14px' }}>
              Address <span className="register-optional">(optional)</span>
            </label>
            <input
              id="reg-address"
              className="landing-connect-input"
              type="text"
              placeholder="Kyiv, Ukraine"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />

            <label className="landing-connect-label" htmlFor="reg-password" style={{ marginTop: '14px' }}>
              Password <span className="register-required">*</span>
            </label>
            <input
              id="reg-password"
              className="landing-connect-input"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              autoComplete="new-password"
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              required
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
              disabled={loading || !name.trim() || !email.trim() || !password}
              style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}
            >
              {loading ? <span className="landing-spinner" /> : (
                <>
                  Create Account
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="login-hint">
            Already have an account?{' '}
            <Link to="/login" className="auth-switch-link">Sign in</Link>
          </p>
        </div>

      </div>
    </div>
  );
}
