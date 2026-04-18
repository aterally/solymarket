'use client';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

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
            <span className="credits-badge"><strong>{credits}</strong> cr</span>
          )}
          <Link href="/leaderboard" className="btn btn-ghost" style={{ padding: '5px 10px' }}>lb</Link>
          <Link href="/profile" className="btn btn-ghost" style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            {session.user.image && <img src={session.user.image} alt="" className="user-avatar" />}
            {displayName}
          </Link>
          {session.user.isAdmin && (
            <Link href="/admin" className="tag-admin">admin</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
