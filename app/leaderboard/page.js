'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Navbar } from '../Navbar';
import Link from 'next/link';

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myInfo, setMyInfo] = useState(null);

  useEffect(() => {
    fetch('/api/leaderboard').then(r => r.json()).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false); });
    if (session) fetch('/api/user/me').then(r => r.json()).then(d => { if (d.user) setMyInfo(d.user); });
  }, [session]);

  const myName = myInfo ? (myInfo.username || myInfo.name) : null;

  return (
    <>
      <Navbar />
      <div className="page-sm">
        <Link href="/" style={{ color: 'var(--text3)', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 28 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </Link>
        <div className="page-header">
          <h1>Leaderboard</h1>
          <p>Top 15 by solies</p>
        </div>

        {loading ? (
          <div className="loading">loading</div>
        ) : rows.length === 0 ? (
          <div className="empty">No data yet.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {rows.map((row, i) => {
              const isMe = myName && myName === row.display_name;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
              return (
                <Link
                  key={i}
                  href={`/user/${encodeURIComponent(row.display_name)}`}
                  className="lb-row"
                  style={{ background: isMe ? 'var(--surface2)' : 'transparent' }}
                >
                  <div className="lb-rank">{medal || `${i + 1}.`}</div>
                  {/* Avatar */}
                  {row.avatar
                    ? <img src={row.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
                        {row.display_name?.[0]?.toUpperCase()}
                      </div>
                  }
                  <div className="lb-name" style={{ fontWeight: isMe ? 700 : 500 }}>
                    {row.display_name}
                    {isMe && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '0.75rem', marginLeft: 8 }}>you</span>}
                  </div>
                  <div className="lb-credits">{row.credits} sl</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
