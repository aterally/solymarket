'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';

export function UsernameModal({ onDone }) {
  const { data: session, update } = useSession();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!username.trim()) return setErr('Enter a username');
    setLoading(true); setErr('');
    const res = await fetch('/api/user/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    await update(); // refresh session
    onDone(d.username);
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Choose a username</h2>
        <p style={{ color: 'var(--text2)', fontSize: '0.82rem', marginBottom: 16 }}>
          Pick a name to display publicly. You can change it later in your profile.
        </p>
        <div className="form-group">
          <input
            placeholder="e.g. cryptobro99"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            maxLength={24}
            autoFocus
          />
          <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: 4 }}>
            2–24 chars, letters/numbers/spaces/_ - .
          </div>
        </div>
        {err && <div className="error-msg">{err}</div>}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
            {loading ? '...' : 'Set username'}
          </button>
        </div>
      </div>
    </div>
  );
}
