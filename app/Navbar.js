'use client';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';

export function Navbar() {
  const { data: session } = useSession();
  const [userInfo, setUserInfo] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const pollRef = useRef(null);

  async function fetchAll() {
    if (!session) return;
    try {
      const [meRes, crRes] = await Promise.all([
        fetch('/api/user/me'),
        fetch('/api/credits'),
      ]);
      const me = await meRes.json();
      const cr = await crRes.json();
      if (me.user) setUserInfo(me.user);
      if (cr.requests && cr.myId) {
        setPendingCount(cr.requests.filter(r => r.to_user_id === cr.myId).length);
      }
    } catch {}
  }

  useEffect(() => {
    fetchAll();
    clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchAll, 5000); // live update every 5s
    return () => clearInterval(pollRef.current);
  }, [session]);

  if (!session) return null;

  const displayName = userInfo?.username || session.user.username || session.user.name?.split(' ')[0] || 'me';
  const isAdmin = session.user.isAdmin || userInfo?.is_admin;
  const credits = userInfo?.credits ?? null;

  const statusBanners = [];
  if (userInfo?.is_banned)            statusBanners.push({ label: '🚫 Your account is banned', color: '#ef4444', bg: '#1f0000' });
  if (userInfo?.is_frozen)            statusBanners.push({ label: '❄️ Your betting is frozen', color: '#60a5fa', bg: '#00101f' });
  if (userInfo?.is_muted_comments)    statusBanners.push({ label: '🔇 You are muted from commenting', color: '#f97316', bg: '#1f0a00' });
  if (userInfo?.is_muted_markets)     statusBanners.push({ label: '📵 You cannot create markets', color: '#a78bfa', bg: '#0d0015' });
  if (userInfo?.is_muted_proposing)   statusBanners.push({ label: '🔕 You cannot propose outcomes', color: '#facc15', bg: '#1a1500' });

  return (
    <>
      {statusBanners.map((b, i) => (
        <div key={i} style={{
          width: '100%', background: b.bg, borderBottom: `1px solid ${b.color}33`,
          padding: '7px 24px', textAlign: 'center', fontSize: '0.82rem',
          color: b.color, fontWeight: 600, letterSpacing: '0.01em',
          zIndex: 200, position: 'relative',
        }}>
          {b.label}
        </div>
      ))}
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <span style={{ color: 'var(--yes)' }}>soly</span>market
          </Link>
          <div className="nav-right">
            {credits !== null && (
              <Link href="/messages" style={{ textDecoration: 'none' }}>
                <div className="credits-badge">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--yes)" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  <strong>{credits.toLocaleString()}</strong>
                  <span style={{ color: 'var(--text3)' }}>sl</span>
                </div>
              </Link>
            )}
            <Link href="/messages" className="nav-icon-btn" title="Messages" style={{ position: 'relative' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {pendingCount > 0 && (
                <span className="nav-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
              )}
            </Link>
            <Link href="/leaderboard" className="nav-icon-btn" title="Leaderboard">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="2" width="8" height="20" rx="1"/><rect x="2" y="10" width="6" height="12" rx="1"/><rect x="16" y="6" width="6" height="16" rx="1"/>
              </svg>
            </Link>
            {isAdmin && (
              <Link href="/admin" className="nav-admin-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Admin
              </Link>
            )}
            <Link href="/profile" className="nav-user-btn">
              {(userInfo?.image || session.user.image) && (
                <img src={userInfo?.image || session.user.image} alt="" className="user-avatar" />
              )}
              <span>{displayName}</span>
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
