'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BetPage({ params }) {
  const { data: session } = useSession();
  const router = useRouter();
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
    setPlacing(true);
    setErr('');
    const res = await fetch(`/api/bets/${params.id}/place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ side, amount: credits }),
    });
    const d = await res.json();
    setPlacing(false);
    if (!res.ok) return setErr(d.error);
    setSuccess(`Placed ${credits} cr on ${side.toUpperCase()}!`);
    setUserCredits(d.credits);
    setAmount('');
    load();
  }

  if (loading) return <><Navbar /><div className="loading">loading...</div></>;
  if (!data) return <><Navbar /><div className="page"><p>Not found</p></div></>;

  const { bet, positions } = data;
  const total = (bet.total_yes || 0) + (bet.total_no || 0);
  const yesPct = total > 0 ? Math.round((bet.total_yes / total) * 100) : 50;
  const noPct = 100 - yesPct;

  return (
    <>
      <Navbar />
      <div className="page">
        <Link href="/" style={{ color: 'var(--text3)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', display: 'inline-block', marginBottom: 20 }}>
          ← markets
        </Link>

        <div className="two-col">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className={`status-badge status-${bet.status}`}>{bet.status}</span>
              {bet.status === 'resolved' && bet.outcome && (
                <span className={`outcome-badge outcome-${bet.outcome}`}>
                  Resolved: {bet.outcome.toUpperCase()}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.3 }}>
              {bet.title}
            </h1>

            {bet.description && (
              <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 20, lineHeight: 1.6 }}>
                {bet.description}
              </p>
            )}

            <div style={{ marginBottom: 24 }}>
              <div className="bar-container" style={{ height: 10, marginBottom: 8 }}>
                <div className="bar-yes" style={{ width: yesPct + '%' }} />
                <div className="bar-no" style={{ width: noPct + '%' }} />
              </div>
              <div className="bar-labels">
                <span className="yes-label">YES {yesPct}% — {bet.total_yes || 0} cr</span>
                <span className="total-pool">{total} cr total</span>
                <span className="no-label">{bet.total_no || 0} cr — {noPct}% NO</span>
              </div>
            </div>

            <div style={{ color: 'var(--text3)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', marginBottom: 24 }}>
              Created by {bet.creator_name || 'anon'} · {positions.length} participant{positions.length !== 1 ? 's' : ''}
            </div>

            {positions.length > 0 && (
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
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
                <div style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Your Position
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: myPosition.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 700, fontSize: '1.1rem' }}>
                    {myPosition.side.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                    {myPosition.amount} cr
                  </span>
                </div>
                {bet.status === 'resolved' && (
                  <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--text2)' }}>
                    {myPosition.side === bet.outcome ? (
                      <span style={{ color: 'var(--yes)' }}>✓ You won!</span>
                    ) : (
                      <span style={{ color: 'var(--no)' }}>✗ You lost</span>
                    )}
                  </div>
                )}
              </div>
            ) : bet.status === 'open' && session ? (
              <div className="card">
                <div style={{ fontSize: '0.78rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                  Place Bet
                </div>
                <div className="side-btns">
                  <button
                    className={`btn btn-yes`}
                    style={side !== 'yes' ? { opacity: 0.4 } : {}}
                    onClick={() => setSide('yes')}
                  >
                    YES
                  </button>
                  <button
                    className={`btn btn-no`}
                    style={side !== 'no' ? { opacity: 0.4 } : {}}
                    onClick={() => setSide('no')}
                  >
                    NO
                  </button>
                </div>
                <div className="form-group">
                  <label>Amount (credits)</label>
                  <div className="amount-input-row">
                    <input
                      type="number"
                      min="1"
                      max={userCredits || 100}
                      placeholder="10"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                    />
                  </div>
                  {userCredits !== null && (
                    <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                      Balance: {userCredits} cr
                      <button
                        onClick={() => setAmount(String(userCredits))}
                        style={{ marginLeft: 8, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
                      >
                        max
                      </button>
                    </div>
                  )}
                </div>
                {err && <div className="error-msg">{err}</div>}
                {success && <div className="success-msg">{success}</div>}
                <button
                  className={`btn ${side === 'yes' ? 'btn-yes' : 'btn-no'}`}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                  onClick={placeBet}
                  disabled={placing}
                >
                  {placing ? '...' : `Bet ${side.toUpperCase()}`}
                </button>
              </div>
            ) : bet.status === 'resolved' ? (
              <div className="card">
                <div style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>This market has resolved.</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
