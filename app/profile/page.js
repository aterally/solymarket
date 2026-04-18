'use client';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
import { Navbar } from '../Navbar';
import Link from 'next/link';

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameErr, setUsernameErr] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameOk, setUsernameOk] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarErr, setAvatarErr] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (!session) return;
    fetch('/api/user/me').then(r => r.json()).then(d => { setUserData(d); setLoading(false); });
  }, [session]);

  async function saveUsername() {
    if (!newUsername.trim()) return setUsernameErr('Enter a username');
    setUsernameSaving(true); setUsernameErr(''); setUsernameOk('');
    const res = await fetch('/api/user/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername }),
    });
    const d = await res.json();
    setUsernameSaving(false);
    if (!res.ok) return setUsernameErr(d.error);
    setUsernameOk('Saved!');
    setEditingUsername(false);
    setNewUsername('');
    await update();
    fetch('/api/user/me').then(r => r.json()).then(d => setUserData(d));
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setAvatarErr('Only images allowed');
    if (file.size > 600000) return setAvatarErr('Image too large (max ~500KB)');
    setUploadingAvatar(true); setAvatarErr('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, type: 'avatar' }),
      });
      const d = await res.json();
      setUploadingAvatar(false);
      if (!res.ok) return setAvatarErr(d.error);
      // Refresh user data to show new avatar
      fetch('/api/user/me').then(r => r.json()).then(d => setUserData(d));
      await update();
    };
    reader.readAsDataURL(file);
  }

  if (!session) return <><Navbar /><div className="loading">not signed in</div></>;
  if (loading) return <><Navbar /><div className="loading">loading</div></>;

  const { user, positions } = userData;
  const won = positions?.filter(p => p.status === 'resolved' && p.side === p.outcome).length || 0;
  const lost = positions?.filter(p => p.status === 'resolved' && p.side !== p.outcome).length || 0;
  const open = positions?.filter(p => p.status === 'open').length || 0;
  const displayName = user.username || user.name;
  const avatarSrc = user.custom_image || user.image;

  return (
    <>
      <Navbar />
      <div className="page-sm">
        <Link href="/" style={{ color: 'var(--text3)', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 28 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </Link>

        <div className="profile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Avatar with upload button */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {avatarSrc
                ? <img src={avatarSrc} alt="" className="profile-avatar" />
                : <div className="profile-avatar" style={{ background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--text3)' }}>
                    {displayName?.[0]?.toUpperCase()}
                  </div>
              }
              <label style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--surface2)', border: '2px solid var(--bg)', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' }} title="Change avatar">
                {uploadingAvatar
                  ? <span style={{ fontSize: '0.6rem' }}>...</span>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                }
                <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
              </label>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h1 className="profile-name">{displayName}</h1>
                {user.is_admin && <span className="tag-admin">admin</span>}
                {user.is_manager && <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#2d1f00', color: '#d29922', border: '1px solid #5a3e00', borderRadius: 20, fontWeight: 600 }}>manager</span>}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text3)' }}>{user.email}</div>
              {avatarErr && <div style={{ color: 'var(--no)', fontSize: '0.75rem', marginTop: 4 }}>{avatarErr}</div>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stat-grid">
          {[
            { label: 'Solies', val: user.credits },
            { label: 'Active', val: open },
            { label: 'Won', val: won, color: 'var(--yes)' },
            { label: 'Lost', val: lost, color: 'var(--no)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-val" style={{ color: s.color || 'var(--text)' }}>{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Username */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 3 }}>Username</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{user.username || <span style={{ color: 'var(--text3)' }}>not set</span>}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditingUsername(!editingUsername); setNewUsername(user.username || ''); setUsernameErr(''); setUsernameOk(''); }}>
              {editingUsername ? 'Cancel' : 'Change'}
            </button>
          </div>
          {editingUsername && (
            <div style={{ marginTop: 12 }}>
              <input placeholder="new username" value={newUsername} onChange={e => setNewUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveUsername()} maxLength={24} autoFocus />
              {usernameErr && <div className="error-msg">{usernameErr}</div>}
              {usernameOk && <div className="success-msg">{usernameOk}</div>}
              <button className="btn btn-primary" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={saveUsername} disabled={usernameSaving}>
                {usernameSaving ? '...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Positions */}
        <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 12 }}>
          Positions
        </div>
        {positions?.length === 0 ? (
          <div className="empty" style={{ padding: '40px 0' }}>
            No positions yet. <Link href="/" style={{ color: 'var(--accent)' }}>Browse markets</Link>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
            {positions?.map((p, i) => (
              <Link href={`/bets/${p.bet_id}`} key={i}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < positions.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ flex: 1, marginRight: 16, fontSize: '0.9rem', color: 'var(--text2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, fontSize: '0.85rem' }}>
                  <span style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 700 }}>{p.side.toUpperCase()}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{p.amount} sl</span>
                  <span className={`status-badge status-${p.status}`}>{p.status}</span>
                  {p.status === 'resolved' && (
                    <span style={{ color: p.side === p.outcome ? 'var(--yes)' : 'var(--no)', fontWeight: 700 }}>
                      {p.side === p.outcome ? 'Won' : 'Lost'}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/messages" className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Messages & Credits
          </Link>
          <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/' })} style={{ color: 'var(--no)' }}>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
