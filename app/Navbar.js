'use client';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

function TransferModal({ credits, onClose, onDone }) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!to.trim()) return setErr('Enter a username');
    const n = parseInt(amount);
    if (!n || n < 1) return setErr('Enter a valid amount');
    if (n > credits) return setErr('Not enough solies');
    setLoading(true); setErr('');
    const res = await fetch('/api/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUsername: to.trim(), amount: n }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    onDone(d.newBalance);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Transfer solies</h2>
        <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 20 }}>
          Your balance: <strong style={{ color: 'var(--text)' }}>{credits} sl</strong>
        </p>
        <div className="form-group">
          <label>Recipient username</label>
          <input placeholder="username" value={to} onChange={e => setTo(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label>Amount</label>
          <input type="number" min="1" max={credits} placeholder="10" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        {err && <div className="error-msg">{err}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Navbar() {
  const { data: session } = useSession();
  const [credits, setCredits] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);

  async function fetchCredits() {
    if (!session) return;
    const res = await fetch('/api/user/me');
    const d = await res.json();
    if (d.user) setCredits(d.user.credits);
  }

  useEffect(() => { fetchCredits(); }, [session]);

  if (!session) return null;

  const displayName = session.user.username || session.user.name?.split(' ')[0] || 'me';
  const isAdmin = session.user.isAdmin;

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">solymarket</Link>
          <div className="nav-right">
            {credits !== null && (
              <button
                className="credits-badge"
                style={{ cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)' }}
                onClick={() => setShowTransfer(true)}
                title="Transfer solies"
              >
                <strong>{credits}</strong> sl
              </button>
            )}
            <Link href="/leaderboard" className="btn btn-ghost btn-sm" title="Leaderboard">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="2" width="8" height="20" rx="1"/><rect x="2" y="10" width="6" height="12" rx="1"/><rect x="16" y="6" width="6" height="16" rx="1"/>
              </svg>
            </Link>
            {isAdmin && (
              <Link href="/admin" className="btn btn-sm" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid #1c4282', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Admin
              </Link>
            )}
            <Link href="/profile" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {session.user.image && <img src={session.user.image} alt="" className="user-avatar" />}
              {displayName}
            </Link>
          </div>
        </div>
      </nav>
      {showTransfer && (
        <TransferModal
          credits={credits}
          onClose={() => setShowTransfer(false)}
          onDone={(newBal) => { setCredits(newBal); }}
        />
      )}
    </>
  );
}
