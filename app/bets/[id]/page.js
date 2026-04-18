'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../../Navbar';

function AdminSidebar({ bet, onResolved }) {
  const [outcome, setOutcome] = useState('yes');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function resolve() {
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: bet.id, outcome }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    setMsg(`Resolved ${outcome.toUpperCase()}. ${d.winnersCount} winner(s).`);
    onResolved();
  }

  async function refund() {
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: bet.id }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    setMsg(`Refunded ${d.refunded} participant(s).`);
    onResolved();
  }

  async function deleteBet() {
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: bet.id }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    window.location.href = '/';
  }

  if (bet.status !== 'open') return (
    <div className="card" style={{ borderColor: 'var(--border2)' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: 12 }}>Admin</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text3)', marginBottom: 14 }}>Market is closed.</div>
      {!confirmDelete ? (
        <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }} onClick={() => setConfirmDelete(true)}>
          Delete market
        </button>
      ) : (
        <>
          <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: 10 }}>Delete permanently? This cannot be undone.</div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }} onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="btn btn-danger" style={{ flex: 2, justifyContent: 'center', fontSize: '0.8rem' }} onClick={deleteBet} disabled={loading}>
              {loading ? '...' : 'Confirm delete'}
            </button>
          </div>
        </>
      )}
      {err && <div className="error-msg" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );

  return (
    <div className="card" style={{ borderColor: 'var(--border2)' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: 12 }}>Admin controls</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 8 }}>Resolve outcome</div>
      <div className="side-btns" style={{ marginBottom: 12 }}>
        <button className={`btn btn-yes${outcome === 'yes' ? ' active' : ''}`} onClick={() => setOutcome('yes')}>YES</button>
        <button className={`btn btn-no${outcome === 'no' ? ' active' : ''}`} onClick={() => setOutcome('no')}>NO</button>
      </div>
      <button className={`btn ${outcome === 'yes' ? 'btn-yes' : 'btn-no'}`} style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }} onClick={resolve} disabled={loading}>
        {loading ? '...' : `Resolve ${outcome.toUpperCase()}`}
      </button>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }} onClick={refund} disabled={loading}>
          Refund all
        </button>
      </div>
      {err && <div className="error-msg">{err}</div>}
      {msg && <div className="success-msg">{msg}</div>}
    </div>
  );
}

export default function BetPage({ params }) {
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState('yes');
  const [amount, setAmount] = useState('');
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [myPosition, setMyPosition] = useState(null);
  const [userCredits, setUserCredits] = useState(null);

  async function load() {
    const res = await fetch(`/api/bets/${params.id}`);
    const d = await res.json();
    if (d.bet) {
      setData(d);
      if (session?.user?.email) {
        const meRes = await fetch('/api/user/me');
        const me = await meRes.json();
        if (me.user) setUserCredits(me.user.credits);
        if (me.positions) {
          const pos = me.positions.find(p => p.bet_id === parseInt(params.id));
          if (pos) setMyPosition(pos);
        }
      }
    }
    setLoading(false);
  }

  useEffect(() => { if (session !== undefined) load(); }, [session, params.id]);

  async function placeBet() {
    const credits = parseInt(amount);
    if (!credits || credits < 1) return setErr('Enter a valid amount');
    setPlacing(true); setErr('');
    const res = await fetch(`/api/bets/${params.id}/place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ side, amount: credits }),
    });
    const d = await res.json();
    setPlacing(false);
    if (!res.ok) return setErr(d.error);
    setSuccess(`Placed ${credits} sl on ${side.toUpperCase()}`);
    setUserCredits(d.credits);
    setAmount('');
    load();
  }

  if (loading) return <><Navbar /><div className="loading">loading</div></>;
  if (!data) return <><Navbar /><div className="page"><p style={{ color: 'var(--text2)' }}>Market not found.</p></div></>;

  const { bet, positions } = data;
  const total = (bet.total_yes || 0) + (bet.total_no || 0);
  const yesPct = total > 0 ? Math.round((bet.total_yes / total) * 100) : 50;
  const noPct = 100 - yesPct;
  const isAdmin = session?.user?.isAdmin;

  return (
    <>
      <Navbar />
      <div className="page">
        <Link href="/" style={{ color: 'var(--text3)', fontSize: '0.78rem', display: 'inline-block', marginBottom: 20 }}>← back</Link>

        <div className="two-col">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span className={`status-badge status-${bet.status}`}>{bet.status}</span>
              {bet.status === 'resolved' && bet.outcome && (
                <span className={`outcome-badge outcome-${bet.outcome}`}>resolved {bet.outcome.toUpperCase()}</span>
              )}
              {bet.status === 'refunded' && (
                <span className="status-badge status-refunded">all bets refunded</span>
              )}
            </div>

            <h1 style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8, lineHeight: 1.4 }}>
              {bet.title}
            </h1>

            {bet.description && (
              <p style={{ color: 'var(--text2)', fontSize: '0.82rem', marginBottom: 18, lineHeight: 1.6 }}>
                {bet.description}
              </p>
            )}

            <div style={{ marginBottom: 20 }}>
              <div className="bar-container" style={{ height: 6, marginBottom: 7 }}>
                <div className="bar-yes" style={{ width: yesPct + '%' }} />
                <div className="bar-no" style={{ width: noPct + '%' }} />
              </div>
              <div className="bar-labels">
                <span className="yes-label">YES {yesPct}% · {bet.total_yes || 0} sl</span>
                <span className="total-pool">{total} sl total</span>
                <span className="no-label">{bet.total_no || 0} sl · {noPct}% NO</span>
              </div>
            </div>

            <div style={{ color: 'var(--text3)', fontSize: '0.72rem', marginBottom: 20 }}>
              {positions.length} participant{positions.length !== 1 ? 's' : ''}
            </div>

            {positions.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, fontWeight: 500 }}>
                  Positions
                </div>
                <div className="positions-list">
                  {positions.map((p, i) => {
                    const total = (bet.total_yes || 0) + (bet.total_no || 0);
                    let pnl = null;
                    if (bet.status === 'resolved' && bet.outcome) {
                      if (p.side === bet.outcome) {
                        const winnerPool = bet.outcome === 'yes' ? (bet.total_yes || 0) : (bet.total_no || 0);
                        const payout = winnerPool > 0 ? Math.round((p.amount / winnerPool) * total) : 0;
                        pnl = payout - p.amount;
                      } else {
                        pnl = -p.amount;
                      }
                    }
                    return (
                    <div key={i} className="position-row">
                      <Link href={`/user/${encodeURIComponent(p.user_name)}`} className="position-title" style={{ color: 'var(--text)' }}>
                        {p.user_name}
                      </Link>
                      <span className="position-meta">
                        <span style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>
                          {p.side.toUpperCase()}
                        </span>
                        <span>{p.amount} sl</span>
                        {bet.status === 'refunded'
                          ? <span style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>refunded</span>
                          : pnl !== null && <span style={{ color: pnl >= 0 ? 'var(--yes)' : 'var(--no)', fontSize: '0.75rem', fontWeight: 600 }}>{pnl >= 0 ? '+' : ''}{pnl} sl</span>
                        }
                      </span>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="sticky-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Admin controls shown first for admins */}
            {isAdmin && <AdminSidebar bet={bet} onResolved={load} />}

            {/* Regular bet placement for non-admins or if admin hasn't bet */}
            {!isAdmin && (myPosition ? (\n              <div className="card">\n                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, fontWeight: 500 }}>\n                  Your position\n                </div>\n                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>\n                  <span style={{ color: myPosition.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 600, fontSize: '1rem' }}>\n                    {myPosition.side.toUpperCase()}\n                  </span>\n                  <span style={{ fontSize: '0.88rem' }}>{myPosition.amount} sl</span>\n                </div>\n                {bet.status === 'resolved' && (() => {\n                  const t = (bet.total_yes || 0) + (bet.total_no || 0);\n                  const winnerPool = bet.outcome === 'yes' ? (bet.total_yes || 0) : (bet.total_no || 0);\n                  const won = myPosition.side === bet.outcome;\n                  const payout = won && winnerPool > 0 ? Math.round((myPosition.amount / winnerPool) * t) : 0;\n                  const pnl = won ? payout - myPosition.amount : -myPosition.amount;\n                  return (\n                    <div style={{ marginTop: 10, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>\n                      <span style={{ color: won ? 'var(--yes)' : 'var(--no)' }}>{won ? '✓ You won' : '✗ You lost'}</span>\n                      <span style={{ color: pnl >= 0 ? 'var(--yes)' : 'var(--no)', fontWeight: 700 }}>{pnl >= 0 ? '+' : ''}{pnl} sl</span>\n                    </div>\n                  );\n                })()}\n                {bet.status === 'refunded' && (\n                  <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text2)' }}>Refunded</div>\n                )}\n              </div>
            ) : bet.status === 'open' && session ? (
              <div className="card">
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14, fontWeight: 500 }}>
                  Place bet
                </div>
                <div className="side-btns">
                  <button className={`btn btn-yes${side === 'yes' ? ' active' : ''}`} onClick={() => setSide('yes')}>YES</button>
                  <button className={`btn btn-no${side === 'no' ? ' active' : ''}`} onClick={() => setSide('no')}>NO</button>
                </div>
                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="number" min="1" max={userCredits || 100}
                    placeholder="10" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && placeBet()}
                  />
                  {userCredits !== null && (
                    <div style={{ marginTop: 4, fontSize: '0.7rem', color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Balance: {userCredits} sl</span>
                      <button onClick={() => setAmount(String(userCredits))} style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 500 }}>
                        max
                      </button>
                    </div>
                  )}
                </div>
                {err && <div className="error-msg">{err}</div>}
                {success && <div className="success-msg">{success}</div>}
                <button
                  className={`btn ${side === 'yes' ? 'btn-yes' : 'btn-no'}`}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 2 }}
                  onClick={placeBet}
                  disabled={placing}
                >
                  {placing ? '...' : `Bet ${side.toUpperCase()}`}
                </button>
              </div>
            ) : bet.status !== 'open' ? (
              <div className="card">
                <div style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>This market is closed.</div>
              </div>
            ) : null)}
          </div>
        </div>
      </div>
    </>
  );
}
