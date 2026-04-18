'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../Navbar';

// ── Resolve Modal ──────────────────────────────────────────────
function ResolveModal({ bet, onClose, onDone }) {
  const [outcome, setOutcome] = useState('yes');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function resolve() {
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: bet.id, outcome }),
    });
    const d = await res.json(); setLoading(false);
    if (!res.ok) return setErr(d.error);
    onDone(`Resolved as ${outcome.toUpperCase()}. ${d.winnersCount} winner(s), ${d.totalPool} sl pool.`);
    onClose();
  }

  async function refund() {
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/refund', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: bet.id }),
    });
    const d = await res.json(); setLoading(false);
    if (!res.ok) return setErr(d.error);
    onDone(`Refunded ${d.refunded} participant(s).`);
    onClose();
  }

  const total = (bet.total_yes || 0) + (bet.total_no || 0);
  const yesPct = total > 0 ? Math.round((bet.total_yes / total) * 100) : 50;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Close market</h2>
        <p style={{ color: 'var(--text2)', fontSize: '0.95rem', marginBottom: 18, lineHeight: 1.5 }}>{bet.title}</p>
        <div style={{ marginBottom: 18 }}>
          <div className="bar-container" style={{ height: 6, marginBottom: 8 }}>
            <div className="bar-yes" style={{ width: yesPct + '%' }} />
            <div className="bar-no" style={{ width: (100 - yesPct) + '%' }} />
          </div>
          <div className="bar-labels">
            <span className="yes-label">YES {bet.total_yes || 0} sl</span>
            <span className="total-pool">{total} sl pool</span>
            <span className="no-label">{bet.total_no || 0} sl NO</span>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 10 }}>Resolve outcome</div>
        <div className="side-btns" style={{ marginBottom: 18 }}>
          <button className={`btn btn-yes${outcome === 'yes' ? ' active' : ''}`} onClick={() => setOutcome('yes')}>YES wins</button>
          <button className={`btn btn-no${outcome === 'no' ? ' active' : ''}`} onClick={() => setOutcome('no')}>NO wins</button>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 10 }}>Or cancel & refund everyone</div>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={refund} disabled={loading}>
            {loading ? '...' : 'Refund all participants'}
          </button>
        </div>
        {err && <div className="error-msg">{err}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className={`btn ${outcome === 'yes' ? 'btn-yes' : 'btn-no'}`} onClick={resolve} disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? '...' : `Resolve ${outcome.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bet Detail Modal ───────────────────────────────────────────
function BetDetailModal({ bet, onClose }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/bets/${bet.id}`).then(r => r.json()).then(d => {
      setPositions(d.positions || []); setLoading(false);
    });
  }, [bet.id]);

  function getPnl(p) {
    if (bet.status === 'refunded') return null;
    if (bet.status !== 'resolved') return null;
    const total = (bet.total_yes || 0) + (bet.total_no || 0);
    const winPool = bet.outcome === 'yes' ? (bet.total_yes || 0) : (bet.total_no || 0);
    if (p.side === bet.outcome) {
      if (winPool === 0) return null;
      return Math.round((p.amount / winPool) * total) - p.amount;
    }
    return -p.amount;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <h2>{bet.title}</h2>
        <div style={{ fontSize: '0.82rem', color: 'var(--text3)', marginBottom: 16 }}>
          By {bet.creator_name || 'unknown'} · {bet.status}{bet.outcome ? ` · ${bet.outcome.toUpperCase()}` : ''}
        </div>
        {loading ? <div style={{ padding: '20px 0', color: 'var(--text3)' }}>loading...</div> : positions.length === 0 ? (
          <div style={{ color: 'var(--text3)', padding: '12px 0' }}>No positions yet.</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>User</th><th>Side</th><th>Amount</th><th>P&amp;L</th></tr></thead>
            <tbody>
              {positions.map((p, i) => {
                const pnl = getPnl(p);
                return (
                  <tr key={i}>
                    <td>{p.user_name}</td>
                    <td><span style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 700 }}>{p.side.toUpperCase()}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{p.amount} sl</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {bet.status === 'refunded'
                        ? <span style={{ color: 'var(--text3)' }}>refunded</span>
                        : pnl === null
                          ? <span style={{ color: 'var(--text3)' }}>—</span>
                          : <span style={{ color: pnl >= 0 ? 'var(--yes)' : 'var(--no)' }}>{pnl >= 0 ? '+' : ''}{pnl} sl</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── User Trades Modal ──────────────────────────────────────────
function UserTradesModal({ user, onClose }) {
  const [trades, setTrades] = useState([]);
  const [createdMarkets, setCreatedMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/users?userId=${user.id}`).then(r => r.json()),
      fetch(`/api/admin/users?createdBy=${user.id}`).then(r => r.json()),
    ]).then(([tradesData, marketsData]) => {
      setTrades(Array.isArray(tradesData) ? tradesData : []);
      setCreatedMarkets(Array.isArray(marketsData) ? marketsData : []);
      setLoading(false);
    });
  }, [user.id]);

  const won = trades.filter(t => t.status === 'resolved' && t.side === t.outcome).length;
  const lost = trades.filter(t => t.status === 'resolved' && t.side !== t.outcome).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <h2>{user.display_name}</h2>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18, fontSize: '0.85rem', color: 'var(--text2)', alignItems: 'center' }}>
          <span>{user.email}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{user.credits} sl</span>
          {user.last_ip && (
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text3)', fontSize: '0.78rem', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 4 }}>
              IP: {user.last_ip}
            </span>
          )}
          {won + lost > 0 && <span style={{ color: 'var(--yes)' }}>{Math.round(won / (won + lost) * 100)}% win rate</span>}
        </div>

        {createdMarkets.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8 }}>
              Markets Created ({createdMarkets.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {createdMarkets.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 5 }}>
                  <Link href={`/bets/${m.id}`} style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                    {m.title}
                  </Link>
                  <span className={`status-badge status-${m.status}`} style={{ fontSize: '0.68rem', flexShrink: 0 }}>{m.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '20px 0', color: 'var(--text3)' }}>loading...</div>
        ) : trades.length === 0 ? (
          <div style={{ color: 'var(--text3)', padding: '12px 0' }}>No trades yet.</div>
        ) : (
          <>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8 }}>
              Trade History ({trades.length})
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Market</th><th>Side</th><th>Amount</th><th>Result</th></tr></thead>
                <tbody>
                  {trades.map((t, i) => (
                    <tr key={i}>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link href={`/bets/${t.bet_id}`} style={{ color: 'var(--text2)' }}>{t.title}</Link>
                      </td>
                      <td><span style={{ color: t.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 700 }}>{t.side.toUpperCase()}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{t.amount} sl</td>
                      <td>
                        {t.status === 'refunded'
                          ? <span style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>refunded</span>
                          : t.status === 'resolved'
                            ? <span style={{ color: t.side === t.outcome ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>
                                {t.side === t.outcome ? '✓ Won' : '✗ Lost'}
                              </span>
                            : <span className={`status-badge status-${t.status}`}>{t.status}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Credits Modal ──────────────────────────────────────────────
function AdjustCreditsModal({ user, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function adjust() {
    const delta = parseInt(amount); setLoading(true); setErr('');
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'adjust_credits', userId: user.id, amount: delta }),
    });
    const d = await res.json(); setLoading(false);
    if (!res.ok) return setErr(d.error);
    onDone(`${user.display_name} now has ${d.credits} sl`); onClose();
  }

  const parsed = parseInt(amount);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Adjust solies</h2>
        <p style={{ color: 'var(--text2)', fontSize: '0.95rem', marginBottom: 16 }}>
          {user.display_name} · current: <strong>{user.credits}</strong> sl
        </p>
        <div className="form-group">
          <label>Amount (positive to add, negative to remove)</label>
          <input type="number" placeholder="e.g. 50 or -20" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </div>
        {err && <div className="error-msg">{err}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={adjust} disabled={loading || isNaN(parsed) || parsed === 0} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? '...' : parsed > 0 ? `+${parsed} sl` : `${parsed} sl`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────
function DeleteMarketModal({ bet, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function deleteBet() {
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: bet.id }),
    });
    const d = await res.json(); setLoading(false);
    if (!res.ok) return setErr(d.error);
    onDone(`Market deleted.`); onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Delete market</h2>
        <p style={{ color: 'var(--text2)', fontSize: '0.95rem', marginBottom: 18, lineHeight: 1.5 }}>
          Permanently delete <strong>{bet.title}</strong>? This cannot be undone.
        </p>
        {err && <div className="error-msg">{err}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-danger" onClick={deleteBet} disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? '...' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Page ────────────────────────────────────────────
export default function AdminPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState('markets');
  const [bets, setBets] = useState([]);
  const [users, setUsers] = useState([]);
  const [betsLoading, setBetsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [marketFilter, setMarketFilter] = useState('all');
  const [resolving, setResolving] = useState(null);
  const [viewingBet, setViewingBet] = useState(null);
  const [deletingBet, setDeletingBet] = useState(null);
  const [adjustingUser, setAdjustingUser] = useState(null);
  const [viewingUserTrades, setViewingUserTrades] = useState(null);
  const [toast, setToast] = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 4000); }

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/bets').then(r => r.json()).then(d => { setBets(Array.isArray(d) ? d : []); setBetsLoading(false); });
    fetch('/api/admin/users').then(r => r.json()).then(d => { setUsers(Array.isArray(d) ? d : []); setUsersLoading(false); });
  }, [status]);

  function refreshBets() {
    fetch('/api/bets').then(r => r.json()).then(d => setBets(Array.isArray(d) ? d : []));
  }
  function refreshUsers() {
    fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : []));
  }

  async function toggleBan(user) {
    const action = user.is_banned ? 'unban' : 'ban';
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: user.id }),
    });
    if (res.ok) { showToast(`${user.display_name} ${action === 'ban' ? 'banned' : 'unbanned'}`); refreshUsers(); }
  }

  if (status === 'loading') return <><Navbar /><div className="loading">loading...</div></>;

  if (status !== 'authenticated' || !session?.user?.isAdmin) {
    return (
      <>
        <Navbar />
        <div className="page-sm" style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ color: 'var(--text2)', fontSize: '1rem' }}>Access denied.</p>
          <Link href="/" className="btn btn-ghost" style={{ marginTop: 18, display: 'inline-flex' }}>← Back</Link>
        </div>
      </>
    );
  }

  const sortedBets = [...bets].sort((a, b) => {
    const ao = a.status === 'open' ? 0 : 1;
    const bo = b.status === 'open' ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const filteredBets = marketFilter === 'all' ? sortedBets : sortedBets.filter(b =>
    marketFilter === 'open' ? b.status === 'open' : b.status !== 'open'
  );

  return (
    <>
      <Navbar />
      <div className="page">
        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--text)', color: 'var(--bg)', borderRadius: 8, padding: '12px 18px', fontSize: '0.9rem', zIndex: 300, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
            {toast}
          </div>
        )}

        <div className="page-header"><h1>Admin</h1></div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Markets', val: bets.length },
            { label: 'Open', val: bets.filter(b => b.status === 'open').length },
            { label: 'Users', val: users.length },
            { label: 'Banned', val: users.filter(u => u.is_banned).length },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{s.val}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="tabs">
          <button className={`tab${tab === 'markets' ? ' active' : ''}`} onClick={() => setTab('markets')}>Markets</button>
          <button className={`tab${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>
            Users {usersLoading ? '' : `(${users.length})`}
          </button>
        </div>

        {tab === 'markets' && (
          <>
            <div className="tabs" style={{ marginBottom: 20 }}>
              {[['all', 'All'], ['open', 'Open'], ['closed', 'Closed']].map(([val, label]) => (
                <button key={val} className={`tab${marketFilter === val ? ' active' : ''}`} onClick={() => setMarketFilter(val)}>{label}</button>
              ))}
            </div>
            {betsLoading ? <div className="loading">loading</div> : filteredBets.length === 0 ? <div className="empty">No markets.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredBets.map(bet => {
                  const total = (bet.total_yes || 0) + (bet.total_no || 0);
                  const yesPct = total > 0 ? Math.round((bet.total_yes / total) * 100) : 50;
                  const isClosed = bet.status !== 'open';
                  return (
                    <div key={bet.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: isClosed ? 0.72 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                          <span className={`status-badge status-${bet.status}`}>{bet.status}</span>
                          {bet.outcome && <span className={`outcome-badge outcome-${bet.outcome}`}>{bet.outcome.toUpperCase()}</span>}
                          <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>#{bet.id} · by {bet.creator_name || 'anon'}</span>
                        </div>
                        <div style={{ fontWeight: 500, fontSize: '0.95rem', marginBottom: 9, lineHeight: 1.35 }}>{bet.title}</div>
                        <div className="bar-container" style={{ marginBottom: 6 }}>
                          <div className="bar-yes" style={{ width: yesPct + '%' }} />
                          <div className="bar-no" style={{ width: (100 - yesPct) + '%' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                          <span className="yes-label">YES {bet.total_yes || 0} sl</span>
                          <span style={{ color: 'var(--text3)' }}>{total} sl pool · {bet.participant_count || 0} participants</span>
                          <span className="no-label">{bet.total_no || 0} sl NO</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                        <button className="btn btn-ghost" style={{ fontSize: '0.82rem' }} onClick={() => setViewingBet(bet)}>Details</button>
                        {!isClosed
                          ? <button className="btn btn-primary" style={{ fontSize: '0.82rem' }} onClick={() => setResolving(bet)}>Close</button>
                          : <button className="btn btn-danger" style={{ fontSize: '0.82rem' }} onClick={() => setDeletingBet(bet)}>Delete</button>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'users' && (
          usersLoading ? <div className="loading">loading</div> : users.length === 0 ? <div className="empty">No users yet.</div> : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th><th>Solies</th><th>IP</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <button onClick={() => setViewingUserTrades(u)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'underline', textDecorationColor: 'var(--border2)', fontSize: '0.9rem' }}>{u.display_name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 1 }}>{u.email}</div>
                        </button>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600 }}>{u.credits}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text3)' }}>{u.last_ip || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {u.is_admin && <span className="tag-admin">admin</span>}
                          {u.is_banned && <span style={{ fontSize: '0.72rem', background: '#2d0808', color: '#f87171', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>banned</span>}
                          {!u.is_admin && !u.is_banned && <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>active</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '5px 10px' }} onClick={() => setAdjustingUser(u)}>Solies</button>
                          {!u.is_admin && (
                            <button className={`btn ${u.is_banned ? 'btn-ghost' : 'btn-danger'}`} style={{ fontSize: '0.8rem', padding: '5px 10px' }} onClick={() => toggleBan(u)}>
                              {u.is_banned ? 'Unban' : 'Ban'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {resolving && <ResolveModal bet={resolving} onClose={() => setResolving(null)} onDone={(msg) => { showToast(msg); refreshBets(); }} />}
      {viewingBet && <BetDetailModal bet={viewingBet} onClose={() => setViewingBet(null)} />}
      {deletingBet && <DeleteMarketModal bet={deletingBet} onClose={() => setDeletingBet(null)} onDone={(msg) => { showToast(msg); refreshBets(); }} />}
      {adjustingUser && <AdjustCreditsModal user={adjustingUser} onClose={() => setAdjustingUser(null)} onDone={(msg) => { showToast(msg); refreshUsers(); }} />}
      {viewingUserTrades && <UserTradesModal user={viewingUserTrades} onClose={() => setViewingUserTrades(null)} />}
    </>
  );
}
