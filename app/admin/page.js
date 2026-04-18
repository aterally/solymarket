'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Navbar } from './Navbar';
import Link from 'next/link';

function ResolveModal({ bet, onClose, onResolved }) {
  const [outcome, setOutcome] = useState('yes');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function resolve() {
    setLoading(true);
    setErr('');
    const res = await fetch('/api/admin/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: bet.id, outcome }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    onResolved(bet.id, outcome, d);
    onClose();
  }

  const total = (bet.total_yes || 0) + (bet.total_no || 0);
  const yesPct = total > 0 ? Math.round((bet.total_yes / total) * 100) : 50;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Resolve Market</h2>
        <p style={{ color: 'var(--text2)', fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.5 }}>
          {bet.title}
        </p>

        <div style={{ marginBottom: 20 }}>
          <div className="bar-container" style={{ height: 8, marginBottom: 8 }}>
            <div className="bar-yes" style={{ width: yesPct + '%' }} />
            <div className="bar-no" style={{ width: (100 - yesPct) + '%' }} />
          </div>
          <div className="bar-labels">
            <span className="yes-label">YES {bet.total_yes || 0} cr</span>
            <span className="total-pool">{total} cr pool</span>
            <span className="no-label">{bet.total_no || 0} cr NO</span>
          </div>
        </div>

        <div className="form-group">
          <label>Outcome</label>
          <div className="side-btns">
            <button
              className="btn btn-yes"
              style={outcome !== 'yes' ? { opacity: 0.4 } : {}}
              onClick={() => setOutcome('yes')}
            >
              YES wins
            </button>
            <button
              className="btn btn-no"
              style={outcome !== 'no' ? { opacity: 0.4 } : {}}
              onClick={() => setOutcome('no')}
            >
              NO wins
            </button>
          </div>
        </div>

        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 14px',
          fontSize: '0.82rem',
          color: 'var(--text2)',
          marginBottom: 16,
          fontFamily: 'var(--font-mono)',
        }}>
          {outcome === 'yes' ? (
            <>Winners (YES): {bet.total_yes || 0} cr staked — will receive proportional share of {bet.total_no || 0} cr loser pool</>
          ) : (
            <>Winners (NO): {bet.total_no || 0} cr staked — will receive proportional share of {bet.total_yes || 0} cr loser pool</>
          )}
        </div>

        {err && <div className="error-msg">{err}</div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button
            className={`btn ${outcome === 'yes' ? 'btn-yes' : 'btn-no'}`}
            onClick={resolve}
            disabled={loading}
            style={{ flex: 2, justifyContent: 'center' }}
          >
            {loading ? '...' : `Resolve as ${outcome.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('open');

  useEffect(() => {
    if (!session) return;
    fetch('/api/bets')
      .then(r => r.json())
      .then(data => { setBets(Array.isArray(data) ? data : []); setLoading(false); });
  }, [session]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleResolved(betId, outcome, result) {
    setBets(prev => prev.map(b =>
      b.id === betId ? { ...b, status: 'resolved', outcome } : b
    ));
    showToast(`Resolved! ${result.winnersCount} winner(s) paid from ${result.totalPool} cr pool.`);
  }

  if (status === 'loading') return <><Navbar /><div className="loading">loading...</div></>;

  if (!session || !session.user?.isAdmin) {
    return (
      <>
        <Navbar />
        <div className="page-sm" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⛔</div>
          <p style={{ color: 'var(--text2)' }}>Admin access only.</p>
          <Link href="/" className="btn btn-ghost" style={{ marginTop: 20, display: 'inline-flex' }}>← Back</Link>
        </div>
      </>
    );
  }

  const filtered = filter === 'all' ? bets : bets.filter(b => b.status === filter);

  return (
    <>
      <Navbar />
      <div className="page">
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'var(--surface)',
            border: '1px solid var(--yes)',
            borderRadius: 8,
            padding: '12px 18px',
            color: 'var(--yes)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            zIndex: 300,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            {toast}
          </div>
        )}

        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1>Admin Panel</h1>
            <span className="tag-admin">admin</span>
          </div>
          <p>Resolve markets when outcomes are confirmed. Credits are distributed automatically.</p>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 28,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}>
          {[
            { label: 'Total Markets', val: bets.length },
            { label: 'Open', val: bets.filter(b => b.status === 'open').length, color: 'var(--yes)' },
            { label: 'Resolved', val: bets.filter(b => b.status === 'resolved').length, color: 'var(--text2)' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: s.color || 'var(--text)', fontFamily: 'var(--font-mono)' }}>{s.val}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="tabs">
          {['open', 'resolved', 'all'].map(f => (
            <button
              key={f}
              className={`tab${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading">loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">No {filter === 'all' ? '' : filter} markets.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(bet => {
              const total = (bet.total_yes || 0) + (bet.total_no || 0);
              const yesPct = total > 0 ? Math.round((bet.total_yes / total) * 100) : 50;

              return (
                <div key={bet.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className={`status-badge status-${bet.status}`}>{bet.status}</span>
                      {bet.status === 'resolved' && bet.outcome && (
                        <span className={`outcome-badge outcome-${bet.outcome}`}>{bet.outcome.toUpperCase()}</span>
                      )}
                      <span style={{ color: 'var(--text3)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        #{bet.id}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: 8, lineHeight: 1.3 }}>{bet.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div className="bar-container" style={{ marginBottom: 4 }}>
                          <div className="bar-yes" style={{ width: yesPct + '%' }} />
                          <div className="bar-no" style={{ width: (100 - yesPct) + '%' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                          <span className="yes-label">YES {bet.total_yes || 0} cr</span>
                          <span style={{ color: 'var(--text3)' }}>{bet.participant_count || 0} players</span>
                          <span className="no-label">{bet.total_no || 0} cr NO</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Link href={`/bets/${bet.id}`} className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>
                      View
                    </Link>
                    {bet.status === 'open' && (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => setResolving(bet)}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {resolving && (
        <ResolveModal
          bet={resolving}
          onClose={() => setResolving(null)}
          onResolved={handleResolved}
        />
      )}
    </>
  );
}
