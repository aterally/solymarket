'use client';
import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import Link from 'next/link';

function BetCard({ bet }) {
  const total = (bet.total_yes || 0) + (bet.total_no || 0);
  const yesPct = total > 0 ? Math.round((bet.total_yes / total) * 100) : 50;
  const noPct = 100 - yesPct;

  return (
    <Link href={`/bets/${bet.id}`} className="card card-link">
      <div className="bet-meta">
        <span>by {bet.creator_name || 'anon'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {bet.status === 'resolved' && bet.outcome && (
            <span className={`outcome-badge outcome-${bet.outcome}`}>{bet.outcome}</span>
          )}
          <span className={`status-badge status-${bet.status}`}>{bet.status}</span>
        </div>
      </div>
      <div className="bet-title">{bet.title}</div>
      {bet.description && <div className="bet-desc">{bet.description}</div>}
      <div className="bar-container" style={{ marginBottom: 6 }}>
        <div className="bar-yes" style={{ width: yesPct + '%' }} />
        <div className="bar-no" style={{ width: noPct + '%' }} />
      </div>
      <div className="bar-labels">
        <span className="yes-label">YES {yesPct}%</span>
        <span className="total-pool">{total} cr pool</span>
        <span className="no-label">{noPct}% NO</span>
      </div>
    </Link>
  );
}

function CreateBetModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!title.trim()) return setErr('Title is required');
    setLoading(true);
    setErr('');
    const res = await fetch('/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(data.error);
    onCreated(data);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>New Market</h2>
        <div className="form-group">
          <label>Question</label>
          <input
            placeholder="Will X happen by Y date?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Description (optional)</label>
          <textarea
            placeholder="Additional context or resolution criteria..."
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={1000}
          />
        </div>
        {err && <div className="error-msg">{err}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ flex: 2 }}>
            {loading ? '...' : 'Create Market'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!session) return;
    fetch('/api/bets')
      .then(r => r.json())
      .then(data => { setBets(Array.isArray(data) ? data : []); setLoading(false); });
  }, [session]);

  if (status === 'loading') return <div className="loading">loading...</div>;

  if (!session) {
    return (
      <div className="sign-in-page">
        <div className="sign-in-logo">FORECAST</div>
        <div className="sign-in-tagline">Prediction markets. Bet on outcomes with friends.</div>
        <div className="sign-in-card">
          <p style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: 20 }}>
            Sign in to start with 100 free credits
          </p>
          <button className="google-btn" onClick={() => signIn('google')}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.48A4.8 4.8 0 0 1 4.5 7.5V5.43H1.83a8 8 0 0 0 0 7.14l2.67-2.1z"/>
              <path fill="#EA4335" d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.54-2.54A8 8 0 0 0 1.83 5.43L4.5 7.5c.66-1.97 2.52-3.92 4.48-3.92z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  const filtered = filter === 'all' ? bets : bets.filter(b => b.status === filter);

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1>Markets</h1>
            <p>Bet on what you know. Everyone starts with 100 credits.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New Market
          </button>
        </div>

        <div className="tabs">
          {['all', 'open', 'resolved'].map(f => (
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
          <div className="loading">loading markets...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            {filter === 'all' ? 'No markets yet. Create the first one!' : `No ${filter} markets.`}
          </div>
        ) : (
          <div className="bet-grid">
            {filtered.map(bet => <BetCard key={bet.id} bet={bet} />)}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateBetModal
          onClose={() => setShowCreate(false)}
          onCreated={bet => setBets(prev => [bet, ...prev])}
        />
      )}
    </>
  );
}
