'use client';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function Navbar() {
  const { data: session } = useSession();
  const [credits, setCredits] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  async function fetchCredits() {
    if (!session) return;
    const res = await fetch('/api/user/me');
    const d = await res.json();
    if (d.user) setCredits(d.user.credits);
  }

  async function fetchPending() {
    if (!session) return;
    const res = await fetch('/api/credits');
    const d = await res.json();
    if (d.requests && d.myId) {
      setPendingCount(d.requests.filter(r => r.to_user_id === d.myId).length);
    }
  }

  useEffect(() => {
    fetchCredits();
    fetchPending();
    const iv = setInterval(() => { fetchCredits(); fetchPending(); }, 30000);
    return () => clearInterval(iv);
  }, [session]);

  if (!session) return null;

  const displayName = session.user.username || session.user.name?.split(' ')[0] || 'me';
  const isAdmin = session.user.isAdmin;

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">solymarket</Link>
        <div className="nav-right">
          {credits !== null && (
            <Link href="/messages" style={{ textDecoration: 'none' }}>
              <div className="credits-badge" style={{ cursor: 'pointer' }}>
                <strong>{credits}</strong> sl
              </div>
            </Link>
          )}
          <Link href="/messages" className="btn btn-ghost btn-sm" title="Messages" style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {pendingCount > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--no)', color: '#fff', borderRadius: '50%', width: 14, height: 14, fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {pendingCount}
              </span>
            )}
          </Link>
          <Link href="/leaderboard" className="btn btn-ghost btn-sm" title="Leaderboard">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="2" width="8" height="20" rx="1"/><rect x="2" y="10" width="6" height="12" rx="1"/><rect x="16" y="6" width="6" height="16" rx="1"/>
            </svg>
          </Link>
          {isAdmin && (
            <Link href="/admin" className="btn btn-sm" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid #1c4282', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Admin
            </Link>
          )}
          <Link href="/profile" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {session.user.image && <img src={session.user.image} alt="" className="user-avatar" />}
            {displayName}
          </Link>
        </div>
      </div>
    </nav>
  );
}
