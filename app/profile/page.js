'use client';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
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

  if (!session) return <><Navbar /><div className="loading">not signed in</div></>;
  if (loading) return <><Navbar /><div className="loading">loading</div></>;

  const { user, positions } = userData;
  const won = positions?.filter(p => p.status === 'resolved' && p.side === p.outcome).length || 0;
  const lost = positions?.filter(p => p.status === 'resolved' && p.side !== p.outcome).length || 0;
  const open = positions?.filter(p => p.status === 'open').length || 0;
  const displayName = user.username || user.name;

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
            {user.image
              ? <img src={user.image} alt="" className="profile-avatar" />
              : <div className="profile-avatar" style={{ background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--text3)' }}>
                  {displayName?.[0]?.toUpperCase()}
                </div>
            }
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h1 className="profile-name">{displayName}</h1>
                {user.is_admin && <span className="tag-admin">admin</span>}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text3)' }}>{user.email}</div>
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

        <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/' })} style={{ color: 'var(--no)' }}>
          Sign out
        </button>
      </div>
    </>
  );
}
