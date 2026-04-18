'use client';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Trophy/leaderboard icon
function LeaderboardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="20" rx="1"/>
      <rect x="2" y="10" width="6" height="12" rx="1"/>
      <rect x="16" y="6" width="6" height="16" rx="1"/>
    </svg>
  );
}

export function Navbar({ onRefreshCredits }) {
  const { data: session } = useSession();
  const [credits, setCredits] = useState(null);

  async function fetchCredits() {
    if (!session) return;
    const res = await fetch('/api/user/me');
    const d = await res.json();
    if (d.user) setCredits(d.user.credits);
  }

  useEffect(() => { fetchCredits(); }, [session]);

  if (!session) return null;

  const displayName = session.user.username || session.user.name?.split(' ')[0] || 'me';

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">solymarket</Link>
        <div className="nav-right">
          {credits !== null && (
            <span className="credits-badge"><strong>{credits}</strong> sl</span>
          )}
          <Link href="/leaderboard" className="btn btn-ghost" style={{ padding: '5px 10px' }} title="Leaderboard">
            <LeaderboardIcon />
          </Link>
          <Link href="/profile" className="btn btn-ghost" style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            {session.user.image && <img src={session.user.image} alt="" className="user-avatar" />}
            {displayName}
          </Link>
        </div>
      </div>
    </nav>
  );
}
