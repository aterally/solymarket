'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../../Navbar';

export default function UserProfilePage({ params }) {
  const { username } = params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/user/${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setErr(d.error);
        else setData(d);
        setLoading(false);
      });
  }, [username]);

  if (loading) return <><Navbar /><div className="loading">loading</div></>;
  if (err) return <><Navbar /><div className="page-sm"><p style={{ color: 'var(--text2)' }}>User not found.</p></div></>;

  const { user, positions, rank } = data;
  const won = positions.filter(p => p.status === 'resolved' && p.side === p.outcome).length;
  const lost = positions.filter(p => p.status === 'resolved' && p.side !== p.outcome).length;
  const active = positions.filter(p => p.status === 'open').length;
  const totalWagered = positions.reduce((s, p) => s + p.amount, 0);
  const winRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : null;

  return (
    <>
      <Navbar />
      <div className="page-sm">
        <Link href="/leaderboard" style={{ color: 'var(--text3)', fontSize: '0.78rem', display: 'inline-block', marginBottom: 24 }}>← leaderboard</Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          {user.image && <img src={user.image} alt="" style={{ width: 40, height: 40, borderRadius: '50%', opacity: 0.8 }} />}
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>{user.display_name}</div>
            <div style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>rank #{rank}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
          {[
            { label: 'Solies', val: user.credits },
            { label: 'Active', val: active },
            { label: 'Won', val: won, color: 'var(--yes)' },
            { label: 'Lost', val: lost, color: 'var(--no)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: s.color || 'var(--text)' }}>{s.val}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {(winRate !== null || totalWagered > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
            {winRate !== null && (
              <div className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{winRate}%</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>Win rate</div>
              </div>
            )}
            <div className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{totalWagered}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>Total wagered</div>
            </div>
          </div>
        )}

        {/* Trade history */}
        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: 12 }}>
          Trade history
        </div>
        {positions.length === 0 ? (
          <div className="empty" style={{ padding: '28px 0' }}>No trades yet.</div>
        ) : (
          <div className="positions-list">
            {positions.map((p, i) => (
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
      </div>
    </>
  );
}
