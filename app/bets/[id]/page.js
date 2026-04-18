'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '../../Navbar';

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
    setSuccess(`Placed ${credits} cr on ${side.toUpperCase()}`);
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
                <span className="yes-label">YES {yesPct}% · {bet.total_yes || 0} cr</span>
                <span className="total-pool">{total} cr total</span>
                <span className="no-label">{bet.total_no || 0} cr · {noPct}% NO</span>
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
                  {positions.map((p, i) => (
                    <div key={i} className="position-row">
                      <span className="position-title">{p.user_name}</span>
                      <span className="position-meta">
                        <span style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>
                          {p.side.toUpperCase()}
                        </span>
                        <span>{p.amount} cr</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="sticky-sidebar">
            {myPosition ? (
              <div className="card">
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, fontWeight: 500 }}>
                  Your position
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: myPosition.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 600, fontSize: '1rem' }}>
                    {myPosition.side.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.88rem' }}>{myPosition.amount} cr</span>
                </div>
                {bet.status === 'resolved' && (
                  <div style={{ marginTop: 10, fontSize: '0.8rem' }}>
                    {myPosition.side === bet.outcome
                      ? <span style={{ color: 'var(--yes)' }}>✓ You won</span>
                      : <span style={{ color: 'var(--no)' }}>✗ You lost</span>}
                  </div>
                )}
                {bet.status === 'refunded' && (
                  <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text2)' }}>
                    Refunded
                  </div>
                )}
              </div>
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
                      <span>Balance: {userCredits} cr</span>
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
            ) : (bet.status !== 'open') ? (
              <div className="card">
                <div style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>This market is closed.</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
