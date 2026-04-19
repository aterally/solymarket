'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../Navbar';

// ── Resolve Modal ──────────────────────────────────────
function ResolveModal({ bet, onClose, onDone }) {
  const [outcome, setOutcome] = useState('yes');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [proposals, setProposals] = useState(null);

  useEffect(() => {
    fetch(`/api/proposals?betId=${bet.id}`)
      .then(r => r.json())
      .then(d => { if (d) setProposals(d); });
  }, [bet.id]);

  async function resolve() {
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        <p style={{ color: 'var(--text2)', fontSize: '0.95rem', marginBottom: 18, lineHeight: 1.5 }}>{bet.title}</p>

        {proposals && (proposals.yes + proposals.no) > 0 && (
          <div style={{ marginBottom: 18, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8 }}>
              User proposals ({proposals.yes + proposals.no} total)
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ color: 'var(--yes)', fontWeight: 700 }}>{proposals.yes} YES</span>
              <span style={{ color: 'var(--no)', fontWeight: 700 }}>{proposals.no} NO</span>
            </div>
          </div>
        )}

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
        <div style={{ fontSize: '0.75rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>Resolve outcome</div>
        <div className="side-btns" style={{ marginBottom: 18 }}>
          <button className={`btn btn-yes${outcome === 'yes' ? ' active' : ''}`} onClick={() => setOutcome('yes')}>YES wins</button>
          <button className={`btn btn-no${outcome === 'no' ? ' active' : ''}`} onClick={() => setOutcome('no')}>NO wins</button>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
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

// ── User Management Modal ──────────────────────────────
function UserManageModal({ user, onClose, onDone }) {
  const [loading, setLoading] = useState('');
  const [err, setErr] = useState('');
  const [ip, setIp] = useState(user.last_ip || '');

  async function doAction(action, extra = {}) {
    setLoading(action); setErr('');
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: user.id, ...extra }),
    });
    const d = await res.json();
    setLoading('');
    if (!res.ok) return setErr(d.error);
    onDone(`Action "${action}" applied to ${user.display_name}`);
    onClose();
  }

  const tags = [];
  if (user.is_admin) tags.push({ label: 'admin', color: 'var(--yes)' });
  if (user.is_manager) tags.push({ label: 'manager', color: '#d29922' });
  if (user.is_banned) tags.push({ label: 'banned', color: 'var(--no)' });
  if (user.is_muted_comments) tags.push({ label: 'muted comments', color: 'var(--text3)' });
  if (user.is_muted_proposing) tags.push({ label: 'muted proposing', color: 'var(--text3)' });
  if (user.is_muted_markets) tags.push({ label: 'muted markets', color: 'var(--text3)' });
  if (user.is_frozen) tags.push({ label: 'betting frozen', color: '#a78bfa' });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          {user.image
            ? <img src={user.image} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
            : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontWeight: 700 }}>{user.display_name?.[0]?.toUpperCase()}</div>
          }
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{user.display_name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{user.email} · {user.credits} sl</div>
          </div>
        </div>

        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {tags.map(t => (
              <span key={t.label} style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 20, border: `1px solid ${t.color}`, color: t.color, background: 'transparent', fontWeight: 600 }}>
                {t.label}
              </span>
            ))}
          </div>
        )}

        {err && <div className="error-msg" style={{ marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Role management */}
          <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 2 }}>Role</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {!user.is_admin && (
              <button className="btn btn-sm" style={{ background: 'var(--yes-dim)', color: 'var(--yes)', border: '1px solid #166534' }} disabled={loading === 'make_admin'} onClick={() => doAction('make_admin')}>
                Make admin
              </button>
            )}
            {user.is_admin && (
              <button className="btn btn-ghost btn-sm" disabled={loading === 'revoke_admin'} onClick={() => doAction('revoke_admin')}>
                Revoke admin
              </button>
            )}
            {!user.is_manager && !user.is_admin && (
              <button className="btn btn-sm" style={{ background: '#2d1f00', color: '#d29922', border: '1px solid #5a3e00' }} disabled={loading === 'make_manager'} onClick={() => doAction('make_manager')}>
                Make manager
              </button>
            )}
            {user.is_manager && (
              <button className="btn btn-ghost btn-sm" disabled={loading === 'revoke_manager'} onClick={() => doAction('revoke_manager')}>
                Revoke manager
              </button>
            )}
          </div>

          {/* Mute controls */}
          <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: 6, marginBottom: 2 }}>Restrictions</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${user.is_muted_comments ? 'btn-ghost' : 'btn-danger'}`}
              disabled={!!loading}
              onClick={() => doAction(user.is_muted_comments ? 'unmute_comments' : 'mute_comments')}>
              {user.is_muted_comments ? 'Unmute comments' : 'Mute comments'}
            </button>
            <button className={`btn btn-sm ${user.is_muted_proposing ? 'btn-ghost' : 'btn-danger'}`}
              disabled={!!loading}
              onClick={() => doAction(user.is_muted_proposing ? 'unmute_proposing' : 'mute_proposing')}>
              {user.is_muted_proposing ? 'Unmute proposing' : 'Mute proposing'}
            </button>
            <button className={`btn btn-sm ${user.is_muted_markets ? 'btn-ghost' : 'btn-danger'}`}
              disabled={!!loading}
              onClick={() => doAction(user.is_muted_markets ? 'unmute_markets' : 'mute_markets')}>
              {user.is_muted_markets ? 'Allow markets' : 'Block markets'}
            </button>
            <button className={`btn btn-sm ${user.is_frozen ? 'btn-ghost' : 'btn-danger'}`}
              style={user.is_frozen ? {} : { background: '#1a0d2e', color: '#a78bfa', border: '1px solid #4c1d95' }}
              disabled={!!loading}
              onClick={() => doAction(user.is_frozen ? 'unfreeze' : 'freeze')}>
              {user.is_frozen ? 'Unfreeze bets' : 'Freeze bets'}
            </button>
          </div>

          {/* Ban */}
          <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: 6, marginBottom: 2 }}>Account</div>
          {!user.is_admin && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <button className={`btn btn-sm ${user.is_banned ? 'btn-ghost' : 'btn-danger'}`}
                disabled={!!loading}
                onClick={() => doAction(user.is_banned ? 'unban' : 'ban')}>
                {user.is_banned ? 'Unban' : 'Ban account'}
              </button>
            </div>
          )}

          {/* IP ban */}
          {user.last_ip && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: 6, marginBottom: 6 }}>Ban IP</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={ip}
                  onChange={e => setIp(e.target.value)}
                  style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', flex: 1 }}
                  placeholder="IP address"
                />
                <button className="btn btn-danger btn-sm" disabled={!!loading || !ip.trim()} onClick={() => doAction('ban_ip', { ip: ip.trim() })}>
                  Ban IP
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────
function DeleteMarketModal({ bet, onClose, onDone }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function deleteBet() {
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: bet.id }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    onDone('Market deleted.'); onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Delete market</h2>
        <p style={{ color: 'var(--text2)', fontSize: '0.95rem', marginBottom: 18, lineHeight: 1.5 }}>
          Permanently delete <strong style={{ color: 'var(--text)' }}>{bet.title}</strong>? This cannot be undone.
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

// ── Adjust Credits Modal ───────────────────────────────
function AdjustCreditsModal({ user, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function adjust() {
    const delta = parseInt(amount);
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        <p style={{ color: 'var(--text2)', fontSize: '0.95rem', marginBottom: 16 }}>
          {user.display_name} · current: <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{user.credits} sl</strong>
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

// ── Manager Proposals Panel ────────────────────────────
function ManagerProposalsPanel({ onToast }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  async function load() {
    const res = await fetch('/api/manager');
    const d = await res.json();
    setProposals(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function decide(propId, action) {
    setActing(propId);
    const res = await fetch('/api/manager', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: propId, action }),
    });
    const d = await res.json();
    setActing(null);
    if (!res.ok) return onToast(d.error || 'Error');
    onToast(action === 'confirm' ? 'Manager proposal confirmed & market resolved' : 'Proposal rejected');
    load();
  }

  if (loading) return <div style={{ color: 'var(--text3)', fontSize: '0.9rem', padding: '16px 0' }}>Loading...</div>;
  if (proposals.length === 0) return <div style={{ color: 'var(--text3)', fontSize: '0.9rem', padding: '16px 0' }}>No pending manager proposals.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {proposals.map(p => (
        <div key={p.id} className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 4 }}>
                Manager <strong style={{ color: 'var(--text2)' }}>{p.manager_name}</strong> proposes:
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 6, lineHeight: 1.4 }}>{p.bet_title}</div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: p.proposed_outcome === 'yes' ? 'var(--yes)' : 'var(--no)' }}>
                → {p.proposed_outcome.toUpperCase()}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
              <button className="btn btn-danger btn-sm" disabled={acting === p.id} onClick={() => decide(p.id, 'reject')}>
                Reject
              </button>
              <button className={`btn btn-sm ${p.proposed_outcome === 'yes' ? 'btn-yes' : 'btn-no'}`}
                disabled={acting === p.id} onClick={() => decide(p.id, 'confirm')}>
                {acting === p.id ? '...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Admin Page ────────────────────────────────────
export default function AdminPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState('markets');
  const [bets, setBets] = useState([]);
  const [users, setUsers] = useState([]);
  const [betsLoading, setBetsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [marketFilter, setMarketFilter] = useState('open');
  const [userSearch, setUserSearch] = useState('');
  const [resolving, setResolving] = useState(null);
  const [deletingBet, setDeletingBet] = useState(null);
  const [managingUser, setManagingUser] = useState(null);
  const [adjustingUser, setAdjustingUser] = useState(null);
  const [toast, setToast] = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 4000); }

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/bets').then(r => r.json()).then(d => { setBets(Array.isArray(d) ? d : []); setBetsLoading(false); });
    fetch('/api/admin/users').then(r => r.json()).then(d => { setUsers(Array.isArray(d) ? d : []); setUsersLoading(false); });
  }, [status]);

  function refreshBets() { fetch('/api/bets').then(r => r.json()).then(d => setBets(Array.isArray(d) ? d : [])); }
  function refreshUsers() { fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])); }

  if (status === 'loading') return <><Navbar /><div className="loading">loading...</div></>;

  if (status !== 'authenticated' || !session?.user?.isAdmin) {
    return (
      <>
        <Navbar />
        <div className="page-sm" style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ color: 'var(--text2)', fontSize: '1rem' }}>Access denied.</p>
          <Link href="/" className="btn btn-ghost" style={{ marginTop: 18, display: 'inline-flex' }}>Back</Link>
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

  const filteredUsers = userSearch.trim()
    ? users.filter(u => (u.display_name || '').toLowerCase().includes(userSearch.toLowerCase()) || (u.email || '').toLowerCase().includes(userSearch.toLowerCase()))
    : users;

  const stats = [
    { label: 'Markets', val: bets.length },
    { label: 'Open', val: bets.filter(b => b.status === 'open').length },
    { label: 'Users', val: users.length },
    { label: 'Banned', val: users.filter(u => u.is_banned).length },
    { label: 'Managers', val: users.filter(u => u.is_manager).length },
    { label: 'Frozen', val: users.filter(u => u.is_frozen).length },
  ];

  return (
    <>
      <Navbar />
      <div className="page">
        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface2)', color: 'var(--text)', borderRadius: 8, padding: '12px 20px', fontSize: '0.9rem', zIndex: 300, boxShadow: '0 4px 24px rgba(0,0,0,0.6)', border: '1px solid var(--border2)' }}>
            {toast}
          </div>
        )}

        <div className="page-header">
          <h1>Admin panel</h1>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 32 }}>
          {stats.map(s => (
            <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>{s.val}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="tabs">
          <button className={`tab${tab === 'markets' ? ' active' : ''}`} onClick={() => setTab('markets')}>Markets</button>
          <button className={`tab${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>Users {!usersLoading && `(${users.length})`}</button>
          <button className={`tab${tab === 'manager_proposals' ? ' active' : ''}`} onClick={() => setTab('manager_proposals')}>Manager proposals</button>
        </div>

        {/* Markets tab */}
        {tab === 'markets' && (
          <>
            <div className="tabs" style={{ marginBottom: 20 }}>
              {[['open', 'Open'], ['all', 'All'], ['closed', 'Closed']].map(([val, label]) => (
                <button key={val} className={`tab${marketFilter === val ? ' active' : ''}`} onClick={() => setMarketFilter(val)}>{label}</button>
              ))}
            </div>
            {betsLoading ? <div className="loading">loading</div> : filteredBets.length === 0 ? <div className="empty">No markets.</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredBets.map(bet => {
                  const total = (bet.total_yes || 0) + (bet.total_no || 0);
                  const yesPct = total > 0 ? Math.round((bet.total_yes / total) * 100) : 50;
                  const isClosed = bet.status !== 'open';
                  return (
                    <div key={bet.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, opacity: isClosed ? 0.72 : 1, padding: '14px 18px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span className={`status-badge status-${bet.status}`}>{bet.status}</span>
                          {bet.outcome && <span className={`outcome-badge outcome-${bet.outcome}`}>{bet.outcome.toUpperCase()}</span>}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>#{bet.id} · {bet.creator_name || 'anon'}</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 8, lineHeight: 1.35 }}>{bet.title}</div>
                        <div className="bar-container" style={{ marginBottom: 5, height: 4 }}>
                          <div className="bar-yes" style={{ width: yesPct + '%' }} />
                          <div className="bar-no" style={{ width: (100 - yesPct) + '%' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span className="yes-label">YES {bet.total_yes || 0} sl</span>
                          <span style={{ color: 'var(--text3)' }}>{total} sl · {bet.participant_count || 0} bettors</span>
                          <span className="no-label">{bet.total_no || 0} sl NO</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                        <Link href={`/bets/${bet.id}`} className="btn btn-ghost btn-sm" target="_blank">View</Link>
                        {!isClosed
                          ? <button className="btn btn-primary btn-sm" onClick={() => setResolving(bet)}>Resolve</button>
                          : <button className="btn btn-danger btn-sm" onClick={() => setDeletingBet(bet)}>Delete</button>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Users tab */}
        {tab === 'users' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <input
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ maxWidth: 320 }}
              />
            </div>
            {usersLoading ? <div className="loading">loading</div> : filteredUsers.length === 0 ? <div className="empty">No users.</div> : (
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
                    {filteredUsers.map(u => {
                      const restrictions = [];
                      if (u.is_muted_comments) restrictions.push('comments');
                      if (u.is_muted_proposing) restrictions.push('proposing');
                      if (u.is_muted_markets) restrictions.push('markets');
                      if (u.is_frozen) restrictions.push('frozen');
                      return (
                        <tr key={u.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>{u.display_name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 1 }}>{u.email}</div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600 }}>{u.credits}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>{u.last_ip || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {u.is_admin && <span className="tag-admin">admin</span>}
                              {u.is_manager && <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#2d1f00', color: '#d29922', border: '1px solid #5a3e00', borderRadius: 20, fontWeight: 600 }}>manager</span>}
                              {u.is_banned && <span className="tag-banned">banned</span>}
                              {restrictions.length > 0 && <span style={{ fontSize: '0.68rem', padding: '2px 7px', background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 20 }}>restricted</span>}
                              {!u.is_admin && !u.is_manager && !u.is_banned && restrictions.length === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>active</span>}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => setAdjustingUser(u)}>Solies</button>
                              <button className="btn btn-sm" style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }} onClick={() => setManagingUser(u)}>Manage</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Manager proposals tab */}
        {tab === 'manager_proposals' && (
          <ManagerProposalsPanel onToast={showToast} />
        )}
      </div>

      {resolving && <ResolveModal bet={resolving} onClose={() => setResolving(null)} onDone={(msg) => { showToast(msg); refreshBets(); }} />}
      {deletingBet && <DeleteMarketModal bet={deletingBet} onClose={() => setDeletingBet(null)} onDone={(msg) => { showToast(msg); refreshBets(); }} />}
      {managingUser && <UserManageModal user={managingUser} onClose={() => setManagingUser(null)} onDone={(msg) => { showToast(msg); refreshUsers(); }} />}
      {adjustingUser && <AdjustCreditsModal user={adjustingUser} onClose={() => setAdjustingUser(null)} onDone={(msg) => { showToast(msg); refreshUsers(); }} />}
    </>
  );
}
