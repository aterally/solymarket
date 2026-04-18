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
        <Link href="/" style={{ color: 'var(--text3)', fontSize: '0.78rem', display: 'inline-block', marginBottom: 24 }}>← back</Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          {user.image && <img src={user.image} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />}
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>{displayName}</div>
            <div style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>{user.email}</div>
          </div>
          {user.is_admin && <span className="tag-admin">admin</span>}
        </div>

        {/* Username section */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editingUsername ? 12 : 0 }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: 2 }}>Username</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{user.username || <span style={{ color: 'var(--text3)' }}>not set</span>}</div>
            </div>
            <button className="btn btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => { setEditingUsername(!editingUsername); setNewUsername(user.username || ''); setUsernameErr(''); setUsernameOk(''); }}>
              {editingUsername ? 'Cancel' : 'Change'}
            </button>
          </div>
          {editingUsername && (
            <div>
              <input
                placeholder="new username"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveUsername()}
                maxLength={24}
                autoFocus
              />
              {usernameErr && <div className="error-msg">{usernameErr}</div>}
              {usernameOk && <div className="success-msg">{usernameOk}</div>}
              <button className="btn btn-primary" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={saveUsername} disabled={usernameSaving}>
                {usernameSaving ? '...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
          {[
            { label: 'Solies', val: user.credits },
            { label: 'Active', val: open },
            { label: 'Won', val: won, color: 'var(--yes)' },
            { label: 'Lost', val: lost, color: 'var(--no)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: s.color || 'var(--text)' }}>{s.val}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Positions */}
        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: 12 }}>
          Positions
        </div>
        {positions?.length === 0 ? (
          <div className="empty" style={{ padding: '28px 0' }}>
            No positions yet. <Link href="/" style={{ color: 'var(--text)' }}>Browse markets →</Link>
          </div>
        ) : (
          <div className="positions-list" style={{ marginBottom: 24 }}>
            {positions?.map((p, i) => (
              <Link href={`/bets/${p.bet_id}`} key={i} className="position-row" style={{ display: 'flex' }}>
                <span className="position-title">{p.title}</span>
                <span className="position-meta">
                  <span style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>{p.side.toUpperCase()}</span>
                  <span>{p.amount} sl</span>
                  <span className={`status-badge status-${p.status}`}>{p.status}</span>
                  {p.status === 'resolved' && (
                    <span style={{ color: p.side === p.outcome ? 'var(--yes)' : 'var(--no)' }}>
                      {p.side === p.outcome ? '✓' : '✗'}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}

        <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>
      </div>
    </>
  );
}
