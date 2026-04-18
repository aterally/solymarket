'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../../Navbar';

function AdminPanel({ user, onDone }) {
  const [loading, setLoading] = useState('');
  const [credits, setCredits] = useState('');
  const [editCredits, setEditCredits] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function toggleBan() {
    setLoading('ban');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: user.is_banned ? 'unban' : 'ban', userId: user.id }),
    });
    setLoading('');
    if (res.ok) { setMsg(user.is_banned ? 'User unbanned.' : 'User banned.'); onDone(); }
    else setErr('Failed');
  }

  async function adjustCredits() {
    const delta = parseInt(credits);
    if (isNaN(delta)) return setErr('Invalid amount');
    setLoading('credits');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'adjust_credits', userId: user.id, amount: delta }),
    });
    const d = await res.json();
    setLoading('');
    if (res.ok) { setMsg(`Credits updated to ${d.credits} sl`); setEditCredits(false); setCredits(''); onDone(); }
    else setErr(d.error);
  }

  return (
    <div className="card" style={{ borderColor: '#388bfd44', background: 'rgba(56,139,253,0.04)', marginBottom: 24 }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 14 }}>
        Admin controls
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!user.is_admin && (
          <button
            className={`btn btn-sm ${user.is_banned ? 'btn-ghost' : 'btn-danger'}`}
            onClick={toggleBan}
            disabled={loading === 'ban'}
          >
            {loading === 'ban' ? '...' : user.is_banned ? 'Unban user' : 'Ban user'}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => setEditCredits(!editCredits)}>
          Adjust solies
        </button>
      </div>
      {editCredits && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: 4 }}>Amount (+ or -)</div>
            <input type="number" placeholder="e.g. 50 or -20" value={credits} onChange={e => setCredits(e.target.value)} style={{ fontSize: '0.88rem' }} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={adjustCredits} disabled={loading === 'credits'}>
            {loading === 'credits' ? '...' : 'Apply'}
          </button>
        </div>
      )}
      {msg && <div className="success-msg" style={{ marginTop: 8 }}>{msg}</div>}
      {err && <div className="error-msg" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

export default function UserProfilePage({ params }) {
  const { username } = params;
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  function load() {
    setLoading(true);
    fetch(`/api/user/${encodeURIComponent(username)}?admin=${session?.user?.isAdmin ? '1' : '0'}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setErr(d.error);
        else setData(d);
        setLoading(false);
      });
  }

  useEffect(() => { if (session !== undefined) load(); }, [username, session]);

  if (loading) return <><Navbar /><div className="loading">loading</div></>;
  if (err) return <><Navbar /><div className="page-sm"><p style={{ color: 'var(--text2)' }}>User not found.</p></div></>;

  const { user, positions, rank } = data;
  const won = positions.filter(p => p.status === 'resolved' && p.side === p.outcome).length;
  const lost = positions.filter(p => p.status === 'resolved' && p.side !== p.outcome).length;
  const active = positions.filter(p => p.status === 'open').length;
  const totalWagered = positions.reduce((s, p) => s + p.amount, 0);
  const winRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : null;
  const isAdmin = session?.user?.isAdmin;
  const isMe = session?.user?.email && user.email === session.user.email;

  return (
    <>
      <Navbar />
      <div className="page-sm">
        <Link href="/leaderboard" style={{ color: 'var(--text3)', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 28 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Leaderboard
        </Link>

        {/* Profile header */}
        <div className="profile-header">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
              {user.image
                ? <img src={user.image} alt="" className="profile-avatar" />
                : <div className="profile-avatar" style={{ background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--text3)' }}>
                    {user.display_name?.[0]?.toUpperCase()}
                  </div>
              }
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h1 className="profile-name">{user.display_name}</h1>
                  {user.is_admin && <span className="tag-admin">admin</span>}
                  {user.is_banned && <span className="tag-banned">banned</span>}
                  {isMe && <span style={{ fontSize: '0.75rem', color: 'var(--text3)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 20, border: '1px solid var(--border)' }}>you</span>}
                </div>
                <div className="profile-rank">
                  Rank <strong>#{rank}</strong>
                  {winRate !== null && <span style={{ color: 'var(--text3)', marginLeft: 12 }}>· {winRate}% win rate</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin panel */}
        {isAdmin && !isMe && <AdminPanel user={user} onDone={load} />}

        {/* Stats */}
        <div className="stat-grid">
          {[
            { label: 'Solies', val: user.credits, color: 'var(--text)' },
            { label: 'Active', val: active, color: 'var(--text)' },
            { label: 'Won', val: won, color: 'var(--yes)' },
            { label: 'Lost', val: lost, color: 'var(--no)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {totalWagered > 0 && (
          <div className="card" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>Total wagered</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{totalWagered} sl</span>
          </div>
        )}

        {/* Trade history */}
        <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 12 }}>
          Trade history
        </div>
        {positions.length === 0 ? (
          <div className="empty" style={{ padding: '40px 0' }}>No trades yet.</div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {positions.map((p, i) => (
              <Link href={`/bets/${p.bet_id}`} key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < positions.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ flex: 1, marginRight: 16, fontSize: '0.9rem', color: 'var(--text2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, fontSize: '0.85rem' }}>
                  <span style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 700 }}>{p.side.toUpperCase()}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{p.amount} sl</span>
                  <span className={`status-badge status-${p.status}`}>{p.status}</span>
                  {p.status === 'resolved' && (
                    <span style={{ color: p.side === p.outcome ? 'var(--yes)' : 'var(--no)', fontWeight: 700 }}>
                      {p.side === p.outcome ? '+' : '-'}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
