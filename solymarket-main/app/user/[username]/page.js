'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
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
    <div className="card" style={{ borderColor: 'var(--yes-dim)', background: 'rgba(34,197,94,0.03)', marginBottom: 20 }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--yes)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 12 }}>
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
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 4 }}>Amount (+ or -)</div>
            <input type="number" placeholder="e.g. 50 or -20" value={credits} onChange={e => setCredits(e.target.value)} style={{ fontSize: '0.85rem' }} />
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

function BalanceChart({ positions, startingBalance = 100 }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  // Build balance history from resolved positions
  const history = (() => {
    const resolved = positions
      .filter(p => p.status === 'resolved' && p.outcome)
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    let bal = startingBalance;
    const pts = [{ bal, label: 'Start', time: '' }];
    for (const p of resolved) {
      if (p.side === p.outcome) {
        bal += Math.abs(p.pnl || p.amount);
      } else {
        bal -= p.amount;
      }
      pts.push({ bal: Math.max(0, bal), label: p.title?.slice(0, 30), time: p.created_at });
    }
    return pts;
  })();

  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (W === 0 || H === 0) return;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      if (history.length < 2) {
        ctx.fillStyle = '#444';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No trade history yet', W / 2, H / 2);
        return;
      }

      const vals = history.map(p => p.bal);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      const pad = { top: 16, bottom: 24, left: 10, right: 10 };
      const cW = W - pad.left - pad.right;
      const cH = H - pad.top - pad.bottom;

      const xOf = i => pad.left + (i / (history.length - 1)) * cW;
      const yOf = v => pad.top + cH - ((v - minV) / range) * cH;

      // Grid lines
      ctx.strokeStyle = 'rgba(36,36,36,0.8)';
      ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(f => {
        const y = pad.top + f * cH;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      });

      // Area fill
      const gradient = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
      gradient.addColorStop(0, 'rgba(34,197,94,0.18)');
      gradient.addColorStop(1, 'rgba(34,197,94,0)');
      ctx.beginPath();
      history.forEach((p, i) => {
        const x = xOf(i); const y = yOf(p.bal);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo(xOf(history.length - 1), H - pad.bottom);
      ctx.lineTo(xOf(0), H - pad.bottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Line
      ctx.beginPath();
      history.forEach((p, i) => {
        const x = xOf(i); const y = yOf(p.bal);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // End dot
      const lastX = xOf(history.length - 1);
      const lastY = yOf(history[history.length - 1].bal);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
    }

    draw();
    const ro = new ResizeObserver(draw);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [history]);

  function handleMouseMove(e) {
    const wrap = wrapRef.current;
    if (!wrap || history.length < 2) return;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const W = rect.width;
    const pad = { left: 10, right: 10 };
    const cW = W - pad.left - pad.right;
    const ratio = (mx - pad.left) / cW;
    const idx = Math.max(0, Math.min(history.length - 1, Math.round(ratio * (history.length - 1))));
    const pt = history[idx];
    const xOf = i => pad.left + (i / (history.length - 1)) * cW;
    setTooltip({ x: xOf(idx), bal: pt.bal, label: pt.label, time: pt.time });
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 8 }}>
        Balance over time
      </div>
      <div
        ref={wrapRef}
        style={{ position: 'relative', height: 130, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />
        {tooltip && (
          <div style={{
            position: 'absolute', top: 8,
            left: Math.min(tooltip.x + 8, 200),
            background: 'var(--surface2)', border: '1px solid var(--border2)',
            borderRadius: 'var(--radius)', padding: '5px 8px', pointerEvents: 'none',
            fontSize: '0.75rem', color: 'var(--text)', whiteSpace: 'nowrap',
          }}>
            <div style={{ color: 'var(--yes)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{tooltip.bal} sl</div>
            {tooltip.label && <div style={{ color: 'var(--text3)', fontSize: '0.68rem', marginTop: 2 }}>{tooltip.label}</div>}
          </div>
        )}
      </div>
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
  const resolvedPositions = positions.filter(p => p.status === 'resolved' && p.outcome);
  const won = resolvedPositions.filter(p => p.side === p.outcome).length;
  const lost = resolvedPositions.filter(p => p.side !== p.outcome).length;
  const active = positions.filter(p => p.status === 'open').length;
  const totalWagered = positions.reduce((s, p) => s + p.amount, 0);
  const winRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : null;
  const isAdmin = session?.user?.isAdmin;
  const isMe = session?.user?.email && user.email === session.user.email;

  // History only = resolved or refunded, not open
  const historyPositions = positions.filter(p => p.status !== 'open');

  return (
    <>
      <Navbar />
      <div className="page-sm">
        <Link href="/leaderboard" style={{ color: 'var(--text3)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Leaderboard
        </Link>

        <div className="profile-header">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              {user.image
                ? <img src={user.image} alt="" className="profile-avatar" />
                : <div className="profile-avatar" style={{ background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', color: 'var(--text3)' }}>
                    {user.display_name?.[0]?.toUpperCase()}
                  </div>
              }
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h1 className="profile-name">{user.display_name}</h1>
                  {user.is_admin && <span className="tag-admin">admin</span>}
                  {user.is_banned && <span className="tag-banned">banned</span>}
                  {isMe && <span style={{ fontSize: '0.7rem', color: 'var(--text3)', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 2, border: '1px solid var(--border)' }}>you</span>}
                </div>
                <div className="profile-rank">
                  Rank <strong>#{rank}</strong>
                  {winRate !== null && <span style={{ color: 'var(--text3)', marginLeft: 10 }}>· {winRate}% win rate</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {isAdmin && !isMe && <AdminPanel user={user} onDone={load} />}

        <div className="stat-grid">
          {[
            { label: 'Solies', val: user.credits, color: 'var(--yes)' },
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

        {/* Balance chart */}
        <BalanceChart positions={resolvedPositions} startingBalance={100} />

        {/* Trade history - resolved/refunded only */}
        <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 10 }}>
          Trade history
        </div>
        {historyPositions.length === 0 ? (
          <div className="empty" style={{ padding: '40px 0' }}>No completed trades yet.</div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {historyPositions.map((p, i) => {
              let pnl = null;
              if (p.status === 'resolved' && p.outcome) {
                pnl = p.side === p.outcome ? Math.abs(p.pnl || p.amount) : -p.amount;
              }
              const isWin = pnl !== null && pnl > 0;
              const isLoss = pnl !== null && pnl < 0;
              return (
                <Link href={`/bets/${p.bet_id}`} key={i}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: i < historyPositions.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Left: PnL */}
                  <div style={{ width: 72, flexShrink: 0, marginRight: 12 }}>
                    {pnl !== null ? (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 700, color: isWin ? 'var(--yes)' : 'var(--no)' }}>
                        {isWin ? '+' : ''}{pnl} sl
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>refunded</span>
                    )}
                  </div>

                  {/* Middle: title */}
                  <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title}
                  </span>

                  {/* Right: side badge (greyed) */}
                  <div style={{ marginLeft: 12, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 2 }}>
                      {p.side?.toUpperCase()}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
