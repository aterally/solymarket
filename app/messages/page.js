'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
import { Navbar } from '../Navbar';
import Link from 'next/link';

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Avatar({ src, name, size = 32 }) {
  return src
    ? <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
        {name?.[0]?.toUpperCase()}
      </div>;
}

function CreditPanel({ myUsername, onClose }) {
  const [tab, setTab] = useState('send');
  const [to, setTo] = useState(myUsername ? '' : '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [requests, setRequests] = useState([]);
  const [myId, setMyId] = useState(null);
  const [acting, setActing] = useState(null);

  async function loadRequests() {
    const res = await fetch('/api/credits');
    const d = await res.json();
    if (d.requests) { setRequests(d.requests); setMyId(d.myId); }
  }

  useEffect(() => { loadRequests(); }, []);

  async function submit() {
    const n = parseInt(amount);
    if (!to.trim()) return setErr('Enter a username');
    if (!n || n < 1) return setErr('Enter a valid amount');
    setLoading(true); setErr(''); setOk('');
    const res = await fetch('/api/credits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: tab, toUsername: to.trim(), amount: n, note: note.trim() || undefined }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    setOk(tab === 'send' ? 'Send request sent! They need to accept.' : 'Credit request sent!');
    setTo(''); setAmount(''); setNote('');
    loadRequests();
  }

  async function decide(id, action) {
    setActing(id);
    await fetch('/api/credits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, requestId: id }),
    });
    setActing(null);
    loadRequests();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 16px 64px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 18 }}>Credits</h2>

        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {['send', 'request', 'inbox'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 500, background: 'none', color: tab === t ? 'var(--text)' : 'var(--text3)', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1, textTransform: 'capitalize', transition: 'all 0.12s' }}>
              {t}{t === 'inbox' && requests.filter(r => r.to_user_id === myId).length > 0 ? ` (${requests.filter(r => r.to_user_id === myId).length})` : ''}
            </button>
          ))}
        </div>

        {(tab === 'send' || tab === 'request') && (
          <>
            <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 16 }}>
              {tab === 'send' ? 'Send credits to another user. They must accept.' : 'Request credits from another user.'}
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text3)', marginBottom: 5 }}>Username</label>
              <input placeholder="their username" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text3)', marginBottom: 5 }}>Amount (sl)</label>
              <input type="number" min="1" placeholder="10" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text3)', marginBottom: 5 }}>Note (optional)</label>
              <input placeholder="reason..." value={note} onChange={e => setNote(e.target.value)} />
            </div>
            {err && <div style={{ color: 'var(--no)', fontSize: '0.82rem', marginBottom: 10 }}>{err}</div>}
            {ok && <div style={{ color: 'var(--yes)', fontSize: '0.82rem', marginBottom: 10 }}>{ok}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submit} disabled={loading} style={{ flex: 2, padding: '8px', background: tab === 'send' ? '#238636' : 'var(--accent-dim)', border: `1px solid ${tab === 'send' ? '#2ea043' : '#1c4282'}`, borderRadius: 6, color: tab === 'send' ? '#fff' : 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>
                {loading ? '...' : tab === 'send' ? 'Send credits' : 'Request credits'}
              </button>
            </div>
          </>
        )}

        {tab === 'inbox' && (
          <>
            {requests.length === 0
              ? <div style={{ color: 'var(--text3)', fontSize: '0.9rem', padding: '20px 0', textAlign: 'center' }}>No pending requests</div>
              : requests.map(r => {
                  const isMine = r.from_user_id === myId;
                  const isIncoming = r.to_user_id === myId;
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <Avatar src={isMine ? r.to_image : r.from_image} name={isMine ? r.to_name : r.from_name} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {isMine ? `→ ${r.to_name}` : `← ${r.from_name}`}
                          <span style={{ marginLeft: 8, fontSize: '0.78rem', fontWeight: 400, color: 'var(--text3)', background: 'var(--surface2)', padding: '1px 7px', borderRadius: 10 }}>
                            {r.type === 'send' ? 'sending' : 'requesting'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--yes)', fontFamily: 'var(--font-mono)' }}>{r.amount} sl{r.note ? ` · ${r.note}` : ''}</div>
                      </div>
                      {isIncoming && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => decide(r.id, 'decline')} disabled={acting === r.id} style={{ padding: '4px 10px', background: 'var(--no-dim)', border: '1px solid #5c1a1a', borderRadius: 5, color: 'var(--no)', fontSize: '0.78rem', cursor: 'pointer' }}>Decline</button>
                          <button onClick={() => decide(r.id, 'accept')} disabled={acting === r.id} style={{ padding: '4px 10px', background: '#238636', border: '1px solid #2ea043', borderRadius: 5, color: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>Accept</button>
                        </div>
                      )}
                      {isMine && <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>waiting</span>}
                    </div>
                  );
                })
            }
          </>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { data: session } = useSession();
  const [convos, setConvos] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [newChat, setNewChat] = useState('');
  const [showCredits, setShowCredits] = useState(false);
  const [myInfo, setMyInfo] = useState(null);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!session) return;
    fetch('/api/user/me').then(r => r.json()).then(d => { if (d.user) setMyInfo(d.user); });
    loadConvos();
  }, [session]);

  async function loadConvos() {
    const res = await fetch('/api/dms');
    const d = await res.json();
    if (Array.isArray(d)) setConvos(d);
  }

  async function openChat(username) {
    setActiveUser(username);
    const res = await fetch(`/api/dms?with=${encodeURIComponent(username)}`);
    const d = await res.json();
    if (Array.isArray(d)) setMessages(d);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    // Poll for new messages
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const r2 = await fetch(`/api/dms?with=${encodeURIComponent(username)}`);
      const d2 = await r2.json();
      if (Array.isArray(d2)) setMessages(d2);
    }, 3000);
  }

  useEffect(() => () => clearInterval(pollRef.current), []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendMsg() {
    if (!newMsg.trim() || !activeUser) return;
    setSending(true);
    const res = await fetch('/api/dms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUsername: activeUser, content: newMsg.trim() }),
    });
    const d = await res.json();
    setSending(false);
    if (res.ok) {
      setMessages(prev => [...prev, d]);
      setNewMsg('');
      loadConvos();
    }
  }

  async function startNewChat() {
    if (!newChat.trim()) return;
    openChat(newChat.trim());
    setNewChat('');
  }

  const myUsername = myInfo ? (myInfo.username || myInfo.name) : '';

  if (!session) return <><Navbar /><div className="loading">not signed in</div></>;

  return (
    <>
      <Navbar />
      {showCredits && <CreditPanel myUsername={myUsername} onClose={() => setShowCredits(false)} />}
      <div className="page" style={{ padding: '24px 32px', maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/" style={{ color: 'var(--text3)', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </Link>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Messages</h1>
          </div>
          <button onClick={() => setShowCredits(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            Credits
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, height: 'calc(100vh - 180px)', minHeight: 400 }}>
          {/* Left: conversation list */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  placeholder="Username to message..."
                  value={newChat}
                  onChange={e => setNewChat(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && startNewChat()}
                  style={{ fontSize: '0.85rem', flex: 1 }}
                />
                <button onClick={startNewChat} style={{ padding: '6px 10px', background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>+</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {convos.length === 0
                ? <div style={{ padding: 20, color: 'var(--text3)', fontSize: '0.85rem', textAlign: 'center' }}>No conversations yet</div>
                : convos.map(c => (
                    <button key={c.partner_id} onClick={() => openChat(c.partner_name)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: activeUser === c.partner_name ? 'var(--surface2)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}>
                      <Avatar src={c.partner_image} name={c.partner_name} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>{c.partner_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.content}</div>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text3)', flexShrink: 0 }}>{timeAgo(c.created_at)}</div>
                    </button>
                  ))
              }
            </div>
          </div>

          {/* Right: chat window */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!activeUser ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', flexDirection: 'column', gap: 12 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span style={{ fontSize: '0.95rem' }}>Select a conversation</span>
              </div>
            ) : (
              <>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.95rem' }}>
                  {activeUser}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {messages.map(m => {
                    const isMe = m.sender_name === myUsername;
                    return (
                      <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                        {!isMe && <Avatar src={m.sender_image} name={m.sender_name} size={28} />}
                        <div style={{ maxWidth: '72%' }}>
                          <div style={{
                            padding: '8px 12px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                            background: isMe ? 'var(--accent)' : 'var(--surface2)',
                            color: isMe ? '#fff' : 'var(--text)',
                            fontSize: '0.9rem', lineHeight: 1.5,
                          }}>
                            {m.content}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>{timeAgo(m.created_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                  <input
                    placeholder="Message..."
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg()}
                    style={{ flex: 1, borderRadius: 20, padding: '8px 14px', fontSize: '0.9rem' }}
                  />
                  <button onClick={sendMsg} disabled={sending || !newMsg.trim()} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 20, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', opacity: !newMsg.trim() ? 0.4 : 1 }}>
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
