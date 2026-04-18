'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Navbar } from '../Navbar';
import Link from 'next/link';

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard').then(r => r.json()).then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const medals = ['🥇', '🥈', '🥉'];
  // Use numbers for all ranks

  return (
    <>
      <Navbar />
      <div className="page-sm">
        <Link href="/" style={{ color: 'var(--text3)', fontSize: '0.78rem', display: 'inline-block', marginBottom: 24 }}>← back</Link>
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
              const isMe = session?.user?.username
                ? session.user.username === row.display_name
                : session?.user?.name === row.display_name;
              return (
                <Link
                  key={i}
                  href={`/user/${encodeURIComponent(row.display_name)}`}
                  className="lb-row"
                  style={{ background: isMe ? 'var(--surface2)' : 'transparent', textDecoration: 'none' }}
                >
                  <div className="lb-rank">
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{i + 1}.</span>
                  </div>
                  <div className="lb-name" style={{ fontWeight: isMe ? 600 : 500 }}>
                    {row.display_name}
                    {isMe && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '0.72rem', marginLeft: 6 }}>you</span>}
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
