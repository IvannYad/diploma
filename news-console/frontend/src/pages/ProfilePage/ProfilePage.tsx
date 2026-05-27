import './ProfilePage.scss';
import { useState, useEffect } from 'react';
import { LOGIN_KEY, LOGIN_NAME_KEY, LOGIN_EMAIL_KEY, LOGIN_ROLE_KEY } from '../../lib/session';

const API_BASE = 'http://localhost:5000';

interface Profile {
  id: number;
  name: string;
  surname: string | null;
  address: string | null;
  email: string;
  phone: string | null;
  role: string;
  hasOpenAiKey: boolean;
  createdAt: string;
}

export default function ProfilePage() {
  const token = sessionStorage.getItem(LOGIN_KEY) ?? '';

  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [loadErr,  setLoadErr]  = useState('');

  const [name,     setName]     = useState('');
  const [surname,  setSurname]  = useState('');
  const [address,  setAddress]  = useState('');
  const [phone,    setPhone]    = useState('');

  const [curPw,    setCurPw]    = useState('');
  const [newPw,    setNewPw]    = useState('');
  const [confPw,   setConfPw]   = useState('');

  const [openAiKey, setOpenAiKey] = useState('');

  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState('');
  const [error,    setError]    = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: Profile) => {
        setProfile(data);
        setName(data.name);
        setSurname(data.surname ?? '');
        setAddress(data.address ?? '');
        setPhone(data.phone ?? '');
      })
      .catch(() => setLoadErr('Could not load profile.'));
  }, [token]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPw && newPw !== confPw) {
      setError('New passwords do not match.');
      return;
    }
    if (newPw && newPw.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string | null> = {
        name:    name.trim() || null,
        surname: surname.trim() || null,
        address: address.trim() || null,
        phone:   phone.trim() || null,
        currentPassword: curPw || null,
        newPassword:     newPw || null,
        openAiKey:       openAiKey.trim() !== '' ? openAiKey.trim() : null,
      };

      const res = await fetch(`${API_BASE}/api/profile`, {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json() as Profile & { error?: string };
      if (!res.ok) {
        setError((data as unknown as { error: string }).error ?? 'Update failed.');
        return;
      }

      // Header reads the display name from sessionStorage, not this page.
      sessionStorage.setItem(LOGIN_NAME_KEY, data.name);

      setProfile(data);
      setName(data.name);
      setSurname(data.surname ?? '');
      setAddress(data.address ?? '');
      setPhone(data.phone ?? '');
      setCurPw(''); setNewPw(''); setConfPw('');
      setOpenAiKey('');
      setSuccess('Profile updated successfully.');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  if (loadErr) return <div className="profile-page"><p className="profile-error">{loadErr}</p></div>;
  if (!profile) return <div className="profile-page"><div className="profile-loading">Loading…</div></div>;

  return (
    <div className="profile-page">
      <div className="profile-inner">
        <header className="profile-header">
          <div className="profile-avatar">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="profile-header-info">
            <div className="profile-title">{profile.name}{profile.surname ? ` ${profile.surname}` : ''}</div>
            <div className="profile-meta">{profile.email} · Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</div>
          </div>
          <span className={`profile-role-badge profile-role-badge--${profile.role.toLowerCase()}`}>{profile.role}</span>
        </header>

        <form className="profile-form" onSubmit={handleSave} autoComplete="off">

          <section className="profile-section">
            <h2 className="profile-section-title">Personal information</h2>
            <div className="profile-row">
              <div className="profile-field">
                <label className="profile-label" htmlFor="pf-name">First name <span className="profile-required">*</span></label>
                <input id="pf-name" className="profile-input" type="text" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="profile-field">
                <label className="profile-label" htmlFor="pf-surname">Last name</label>
                <input id="pf-surname" className="profile-input" type="text" value={surname} onChange={e => setSurname(e.target.value)} placeholder="(optional)" />
              </div>
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="pf-email">Email address</label>
              <input id="pf-email" className="profile-input profile-input--readonly" type="email" value={profile.email} readOnly tabIndex={-1} />
              <span className="profile-hint">Email cannot be changed.</span>
            </div>
            <div className="profile-row">
              <div className="profile-field">
                <label className="profile-label" htmlFor="pf-phone">Phone</label>
                <input id="pf-phone" className="profile-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380 99 123 4567" pattern="[+]?[\d\s\-().]{7,20}" maxLength={20} />
              </div>
              <div className="profile-field">
                <label className="profile-label" htmlFor="pf-address">Address</label>
                <input id="pf-address" className="profile-input" type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="(optional)" />
              </div>
            </div>
          </section>

          <section className="profile-section">
            <h2 className="profile-section-title">Change password</h2>
            <p className="profile-hint" style={{ marginBottom: 12 }}>Leave blank to keep your current password.</p>
            <div className="profile-field">
              <label className="profile-label" htmlFor="pf-cur-pw">Current password</label>
              <input id="pf-cur-pw" className="profile-input" type="password" value={curPw} onChange={e => setCurPw(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="profile-row">
              <div className="profile-field">
                <label className="profile-label" htmlFor="pf-new-pw">New password</label>
                <input id="pf-new-pw" className="profile-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" />
              </div>
              <div className="profile-field">
                <label className="profile-label" htmlFor="pf-conf-pw">Confirm new password</label>
                <input id="pf-conf-pw" className={`profile-input${confPw && confPw !== newPw ? ' profile-input--error' : ''}`} type="password" value={confPw} onChange={e => setConfPw(e.target.value)} autoComplete="new-password" placeholder="Repeat new password" />
              </div>
            </div>
          </section>

          <section className="profile-section">
            <h2 className="profile-section-title">OpenAI API key</h2>
            <p className="profile-hint" style={{ marginBottom: 12 }}>
              {profile.hasOpenAiKey
                ? 'A key is currently stored. Enter a new value to replace it, or leave blank to keep the existing one.'
                : 'No key stored yet. Paste your OpenAI API key below.'}
            </p>
            <div className="profile-field">
              <label className="profile-label" htmlFor="pf-oai">OpenAI API key</label>
              <input
                id="pf-oai"
                className="profile-input"
                type="password"
                value={openAiKey}
                onChange={e => setOpenAiKey(e.target.value)}
                placeholder={profile.hasOpenAiKey ? '••••••••••••••••••••' : 'sk-…'}
                autoComplete="off"
              />
            </div>
          </section>

          {error   && <div className="profile-status profile-status--error"><span>✕</span>{error}</div>}
          {success && <div className="profile-status profile-status--ok"><span>✓</span>{success}</div>}

          <button className="profile-save-btn" type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>

        </form>
      </div>
    </div>
  );
}
