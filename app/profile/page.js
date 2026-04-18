'use client';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Navbar } from '../Navbar';
import Link from 'next/link';

export default function ProfilePage() {
  const { data: session } = useSession();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch('/api/user/me')
      .then(r => r.json())
      .then(d => { setUserData(d); setLoading(false); });
  }, [session]);

  if (!session) return <><Navbar /><div className="loading">not signed in</div></>;
  if (loading) return <><Navbar /><div className="loading">loading...</div></>;

  const { user, positions } = userData;
  const won = positions?.filter(p => p.status === 'resolved' && p.side === p.outcome).length || 0;
  const lost = positions?.filter(p => p.status === 'resolved' && p.side !== p.outcome).length || 0;
  const open = positions?.filter(p => p.status === 'open').length || 0;

  return (
    <>
      <Navbar />
      <div className="page-sm">
        <Link href="/" style={{ color: 'var(--text3)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', display: 'inline-block', marginBottom: 24 }}>
          ← markets
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          {user.image && <img src={user.image} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} />}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{user.name}</div>
            <div style={{ color: 'var(--text2)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>{user.email}</div>
          </div>
          {user.is_admin && <span className="tag-admin">admin</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Credits', val: user.credits, color: 'var(--accent)' },
            { label: 'Active', val: open, color: 'var(--text)' },
            { label: 'Won', val: won, color: 'var(--yes)' },
            { label: 'Lost', val: lost, color: 'var(--no)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: '16px 10px' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
            Positions
          </div>
          {positions?.length === 0 ? (
            <div className="empty" style={{ padding: '32px 0' }}>No positions yet. <Link href="/" style={{ color: 'var(--accent)' }}>Browse markets →</Link></div>
          ) : (
            <div className="positions-list">
              {positions?.map((p, i) => (
                <Link href={`/bets/${p.bet_id}`} key={i} className="position-row" style={{ display: 'flex' }}>
                  <span className="position-title">{p.title}</span>
                  <span className="position-meta">
                    <span style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>
                      {p.side.toUpperCase()}
                    </span>
                    <span>{p.amount} cr</span>
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
        </div>

        <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/' })}>
          Sign out
        </button>
      </div>
    </>
  );
}
