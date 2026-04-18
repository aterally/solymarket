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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: bet.id, outcome }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    onDone(`Resolved as ${outcome.toUpperCase()}. ${d.winnersCount} winner(s), ${d.totalPool} sl pool.`);
    onClose();
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
    onDone(`Refunded ${d.refunded} participant(s).`);
    onClose();
  }

  const total = (bet.total_yes || 0) + (bet.total_no || 0);
  const yesPct = total > 0 ? Math.round((bet.total_yes / total) * 100) : 50;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Close market</h2>
        <p style={{ color: 'var(--text2)', fontSize: '0.82rem', marginBottom: 16, lineHeight: 1.5 }}>{bet.title}</p>
        <div style={{ marginBottom: 16 }}>
          <div className="bar-container" style={{ height: 5, marginBottom: 6 }}>
            <div className="bar-yes" style={{ width: yesPct + '%' }} />
            <div className="bar-no" style={{ width: (100 - yesPct) + '%' }} />
          </div>
          <div className="bar-labels">
            <span className="yes-label">YES {bet.total_yes || 0} sl</span>
            <span className="total-pool">{total} sl pool</span>
            <span className="no-label">{bet.total_no || 0} sl NO</span>
          </div>
        </div>

        <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: 8 }}>
          Resolve outcome
        </div>
        <div className="side-btns" style={{ marginBottom: 16 }}>
          <button className={`btn btn-yes${outcome === 'yes' ? ' active' : ''}`} onClick={() => setOutcome('yes')}>YES wins</button>
          <button className={`btn btn-no${outcome === 'no' ? ' active' : ''}`} onClick={() => setOutcome('no')}>NO wins</button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 14 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: 8 }}>
            Or cancel & refund everyone
          </div>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }} onClick={refund} disabled={loading}>
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
      setPositions(d.positions || []);
      setLoading(false);
    });
  }, [bet.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <h2>{bet.title}</h2>
        <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 14 }}>
          Created by: {bet.creator_name || 'unknown'} · Status: {bet.status}
          {bet.outcome && ` · Outcome: ${bet.outcome.toUpperCase()}`}
        </div>
        {loading ? <div style={{ padding: '20px 0', color: 'var(--text3)', fontSize: '0.82rem' }}>loading...</div> : (
          positions.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: '0.82rem', padding: '12px 0' }}>No positions yet.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>User</th><th>Side</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {positions.map((p, i) => (
                  <tr key={i}>
                    <td>{p.user_name}</td>
                    <td>
                      <span style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>
                        {p.side.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{p.amount} sl</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users?userId=${user.id}`)
      .then(r => r.json())
      .then(d => { setTrades(Array.isArray(d) ? d : []); setLoading(false); });
  }, [user.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <h2>{user.display_name} — trades</h2>
        <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 14 }}>
          {user.email} · {user.credits} sl · {user.last_ip ? `IP: ${user.last_ip}` : 'IP: unknown'}
        </div>
        {loading ? (
          <div style={{ padding: '20px 0', color: 'var(--text3)', fontSize: '0.82rem' }}>loading...</div>
        ) : trades.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: '0.82rem', padding: '12px 0' }}>No trades yet.</div>
        ) : (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr><th>Market</th><th>Side</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i}>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Link href={`/bets/${t.bet_id}`} style={{ color: 'var(--text2)' }}>{t.title}</Link>
                    </td>
                    <td>
                      <span style={{ color: t.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>
                        {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{t.amount} sl</td>
                    <td>
                      <span className={`status-badge status-${t.status}`}>{t.status}</span>
                      {t.status === 'resolved' && (
                        <span style={{ marginLeft: 4, color: t.side === t.outcome ? 'var(--yes)' : 'var(--no)', fontSize: '0.75rem' }}>
                          {t.side === t.outcome ? '✓ W' : '✗ L'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    const delta = parseInt(amount);
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'adjust_credits', userId: user.id, amount: delta }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    onDone(`${user.display_name} now has ${d.credits} sl`);
    onClose();
  }

  const parsed = parseInt(amount);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Adjust solies</h2>
        <p style={{ color: 'var(--text2)', fontSize: '0.82rem', marginBottom: 14 }}>
          {user.display_name} · current: {user.credits} sl
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
  const [adjustingUser, setAdjustingUser] = useState(null);
  const [viewingUserTrades, setViewingUserTrades] = useState(null);
  const [toast, setToast] = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 4000); }

  useEffect(() => {
    if (!session) return;
    fetch('/api/bets').then(r => r.json()).then(d => { setBets(Array.isArray(d) ? d : []); setBetsLoading(false); });
    fetch('/api/admin/users').then(r => r.json()).then(d => { setUsers(Array.isArray(d) ? d : []); setUsersLoading(false); });
  }, [session]);

  function refreshBets() {
    fetch('/api/bets').then(r => r.json()).then(d => setBets(Array.isArray(d) ? d : []));
  }

  function refreshUsers() {
    fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : []));
  }

  async function toggleBan(user) {
    const action = user.is_banned ? 'unban' : 'ban';
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: user.id }),
    });
    if (res.ok) {
      showToast(`${user.display_name} ${action === 'ban' ? 'banned' : 'unbanned'}`);
      refreshUsers();
    }
  }

  if (status === 'loading') return <><Navbar /><div className="loading">loading</div></>;
  if (!session?.user?.isAdmin) {
    return (
      <>
        <Navbar />
        <div className="page-sm" style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ color: 'var(--text2)', fontSize: '0.88rem' }}>Access denied.</p>
          <Link href="/" className="btn btn-ghost" style={{ marginTop: 16, display: 'inline-flex' }}>← Back</Link>
        </div>
      </>
    );
  }

  // Sort: open first, then rest
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
          <div style={{ position: 'fixed', bottom: 20, right: 20, background: 'var(--text)', color: 'var(--bg)', borderRadius: 7, padding: '10px 16px', fontSize: '0.8rem', zIndex: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
            {toast}
          </div>
        )}

        <div className="page-header">
          <h1>Admin</h1>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Markets', val: bets.length },
            { label: 'Open', val: bets.filter(b => b.status === 'open').length },
            { label: 'Users', val: users.length },
            { label: 'Banned', val: users.filter(u => u.is_banned).length },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 600 }}>{s.val}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="tabs">
          {[['markets', 'Markets'], ['users', 'Users']].map(([val, label]) => (
            <button key={val} className={`tab${tab === val ? ' active' : ''}`} onClick={() => setTab(val)}>{label}</button>
          ))}
        </div>

        {/* ── MARKETS TAB ── */}
        {tab === 'markets' && (
          <>
            <div className="tabs" style={{ marginBottom: 18 }}>
              {[['all', 'All'], ['open', 'Open'], ['closed', 'Closed']].map(([val, label]) => (
                <button key={val} className={`tab${marketFilter === val ? ' active' : ''}`} onClick={() => setMarketFilter(val)}>{label}</button>
              ))}
            </div>
            {betsLoading ? <div className="loading">loading</div> : filteredBets.length === 0 ? <div className="empty">No markets.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredBets.map(bet => {
                  const total = (bet.total_yes || 0) + (bet.total_no || 0);
                  const yesPct = total > 0 ? Math.round((bet.total_yes / total) * 100) : 50;
                  return (
                    <div key={bet.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <span className={`status-badge status-${bet.status}`}>{bet.status}</span>
                          {bet.outcome && <span className={`outcome-badge outcome-${bet.outcome}`}>{bet.outcome.toUpperCase()}</span>}
                          <span style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>#{bet.id} · by {bet.creator_name || 'anon'}</span>
                        </div>
                        <div style={{ fontWeight: 500, fontSize: '0.88rem', marginBottom: 7, lineHeight: 1.3 }}>{bet.title}</div>
                        <div className="bar-container" style={{ marginBottom: 4 }}>
                          <div className="bar-yes" style={{ width: yesPct + '%' }} />
                          <div className="bar-no" style={{ width: (100 - yesPct) + '%' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                          <span className="yes-label">YES {bet.total_yes || 0} sl</span>
                          <span style={{ color: 'var(--text3)' }}>{bet.participant_count || 0} participants</span>
                          <span className="no-label">{bet.total_no || 0} sl NO</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => setViewingBet(bet)}>Details</button>
                        {bet.status === 'open' && (
                          <button className="btn btn-primary" style={{ fontSize: '0.75rem' }} onClick={() => setResolving(bet)}>Close</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          usersLoading ? <div className="loading">loading</div> : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Solies</th>
                    <th>IP</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <button
                          onClick={() => setViewingUserTrades(u)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                        >
                          <div style={{ fontWeight: 500, color: 'var(--text)', textDecoration: 'underline', textDecorationColor: 'var(--border2)' }}>{u.display_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{u.email}</div>
                        </button>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{u.credits}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>
                        {u.last_ip || '—'}
                      </td>
                      <td>
                        {u.is_admin && <span className="tag-admin" style={{ marginRight: 4 }}>admin</span>}
                        {u.is_banned && <span style={{ fontSize: '0.65rem', background: '#2d0808', color: '#f87171', padding: '2px 6px', borderRadius: 3, fontWeight: 500 }}>banned</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '4px 8px' }} onClick={() => setAdjustingUser(u)}>Solies</button>
                          {!u.is_admin && (
                            <button
                              className={`btn ${u.is_banned ? 'btn-ghost' : 'btn-danger'}`}
                              style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                              onClick={() => toggleBan(u)}
                            >
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

      {resolving && (
        <ResolveModal
          bet={resolving}
          onClose={() => setResolving(null)}
          onDone={(msg) => { showToast(msg); refreshBets(); }}
        />
      )}
      {viewingBet && (
        <BetDetailModal bet={viewingBet} onClose={() => setViewingBet(null)} />
      )}
      {adjustingUser && (
        <AdjustCreditsModal
          user={adjustingUser}
          onClose={() => setAdjustingUser(null)}
          onDone={(msg) => { showToast(msg); refreshUsers(); }}
        />
      )}
      {viewingUserTrades && (
        <UserTradesModal
          user={viewingUserTrades}
          onClose={() => setViewingUserTrades(null)}
        />
      )}
    </>
  );
}
