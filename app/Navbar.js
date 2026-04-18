'use client';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function Navbar() {
  const { data: session } = useSession();
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    if (!session) return;
    fetch('/api/user/me')
      .then(r => r.json())
      .then(d => { if (d.user) setCredits(d.user.credits); });
  }, [session]);

  if (!session) return null;

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          FORECAST <span>markets</span>
        </Link>
        <div className="nav-right">
          {credits !== null && (
            <span className="credits-badge">
              <strong>{credits}</strong> cr
            </span>
          )}
          <Link href="/profile" className="btn btn-ghost">
            {session.user.image && (
              <img src={session.user.image} alt="" className="user-avatar" />
            )}
            <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.user.name?.split(' ')[0]}
            </span>
          </Link>
          {session.user.isAdmin && (
            <Link href="/admin" className="tag-admin">admin</Link>
          )}
          <button className="btn btn-ghost" onClick={() => signOut()}>
            out
          </button>
        </div>
      </div>
    </nav>
  );
}
