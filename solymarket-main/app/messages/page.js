'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
import { Navbar } from '../Navbar';

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

export default function MessagesPage() {
  const { data: session } = useSession();
  const [convos, setConvos] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [myInfo, setMyInfo] = useState(null);

  const [creditAttachment, setCreditAttachment] = useState(null);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditType, setCreditType] = useState('send');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [creditErr, setCreditErr] = useState('');

  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const convosPollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!session) return;
    fetch('/api/user/me').then(r => r.json()).then(d => { if (d.user) setMyInfo(d.user); });
    loadConvos();
    convosPollRef.current = setInterval(loadConvos, 5000);
    return () => clearInterval(convosPollRef.current);
  }, [session]);

  async function loadConvos() {
    const res = await fetch('/api/dms');
    const d = await res.json();
    if (Array.isArray(d)) setConvos(d);
  }

  async function openChat(username) {
    setActiveUser(username);
    setSearchError('');
    setSearchQuery('');
    const res = await fetch(`/api/dms?with=${encodeURIComponent(username)}`);
    if (!res.ok) return;
    const d = await res.json();
    if (Array.isArray(d)) setMessages(d);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const r2 = await fetch(`/api/dms?with=${encodeURIComponent(username)}`);
      const d2 = await r2.json();
      if (Array.isArray(d2)) setMessages(d2);
    }, 3000);
  }

  useEffect(() => () => { clearInterval(pollRef.current); clearInterval(convosPollRef.current); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function handleSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchError('');
    const res = await fetch(`/api/dms?with=${encodeURIComponent(q)}`);
    if (!res.ok) { setSearchError(`User "${q}" doesn't exist.`); return; }
    openChat(q);
  }

  async function sendMsg() {
    if ((!newMsg.trim() && !creditAttachment) || !activeUser) return;
    setSending(true);

    if (creditAttachment) {
      const res = await fetch('/api/credits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: creditAttachment.type, toUsername: activeUser, amount: creditAttachment.amount, note: creditAttachment.note || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setSending(false); return; }

      const msgContent = `[CREDIT_${creditAttachment.type.toUpperCase()}:${creditAttachment.amount}:${creditAttachment.note || ''}]${newMsg.trim() ? ' ' + newMsg.trim() : ''}`;
      const dmRes = await fetch('/api/dms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUsername: activeUser, content: msgContent }),
      });
      const dm = await dmRes.json();
      if (dmRes.ok) { setMessages(prev => [...prev, dm]); setNewMsg(''); setCreditAttachment(null); loadConvos(); }
    } else {
      const res = await fetch('/api/dms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUsername: activeUser, content: newMsg.trim() }),
      });
      const d = await res.json();
      if (res.ok) { setMessages(prev => [...prev, d]); setNewMsg(''); loadConvos(); }
    }
    setSending(false);
  }

  function attachCredit() {
    const n = parseInt(creditAmount);
    if (!n || n < 1) { setCreditErr('Enter a valid amount'); return; }
    setCreditAttachment({ type: creditType, amount: n, note: creditNote.trim() });
    setShowCreditForm(false);
    setCreditAmount(''); setCreditNote(''); setCreditErr('');
    inputRef.current?.focus();
  }

  function parseMessage(content) {
    const match = content.match(/^\[CREDIT_(SEND|REQUEST):(\d+):([^\]]*)\](.*)/s);
    if (match) {
      return { isCreditMsg: true, creditType: match[1].toLowerCase(), amount: parseInt(match[2]), note: match[3] || '', text: match[4].trim() };
    }
    return { isCreditMsg: false, text: content };
  }

  function CreditMessageBubble({ msg, isMe, senderName }) {
    const [status, setStatus] = useState(null); // null | 'accepted' | 'declined' | 'loading-accept' | 'loading-decline'

    async function decidePending(action) {
      setStatus(action === 'accept' ? 'loading-accept' : 'loading-decline');
      const res = await fetch('/api/credits');
      const d = await res.json();
      if (d.requests) {
        const matchingReq = d.requests.find(r => r.from_name === senderName && r.type === msg.creditType && r.amount === msg.amount);
        if (matchingReq) {
          const actRes = await fetch('/api/credits', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, requestId: matchingReq.id }),
          });
          const actData = await actRes.json();
          if (actRes.ok) {
            setStatus(action === 'accept' ? 'accepted' : 'declined');
            // Refresh user info for credit balance
            fetch('/api/user/me').then(r => r.json()).then(d => { if (d.user) setMyInfo(d.user); });
          } else {
            setStatus(null);
          }
          return;
        }
      }
      setStatus(null);
    }

    const label = msg.creditType === 'send' ? 'sending' : 'requesting';
    const isLoading = status === 'loading-accept' || status === 'loading-decline';
    const acted = status === 'accepted' || status === 'declined';

    return (
      <div style={{
        padding: '12px 14px', borderRadius: isMe ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
        background: isMe ? 'var(--surface3)' : 'var(--surface2)',
        border: '1px solid var(--border)',
        maxWidth: '72%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--yes)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            credit {label}
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--yes)', marginBottom: msg.note ? 4 : 0 }}>
          {msg.amount} sl
        </div>
        {msg.note && <div style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 8 }}>{msg.note}</div>}
        {msg.text && <div style={{ fontSize: '0.88rem', color: 'var(--text)', marginBottom: 8 }}>{msg.text}</div>}

        {!isMe && !acted && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button
              onClick={() => decidePending('decline')}
              disabled={isLoading}
              style={{ flex: 1, padding: '6px 0', background: 'var(--no-dim)', border: '1px solid #7f1d1d', borderRadius: 'var(--radius)', color: 'var(--no)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
            >
              {status === 'loading-decline' ? '...' : 'Deny'}
            </button>
            <button
              onClick={() => decidePending('accept')}
              disabled={isLoading}
              style={{ flex: 1, padding: '6px 0', background: '#16a34a', border: '1px solid #22c55e', borderRadius: 'var(--radius)', color: '#fff', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}
            >
              {status === 'loading-accept' ? '...' : 'Accept'}
            </button>
          </div>
        )}

        {acted && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: 'var(--radius)', textAlign: 'center',
            background: status === 'accepted' ? 'var(--yes-dim)' : 'var(--no-dim)',
            border: `1px solid ${status === 'accepted' ? '#166534' : '#7f1d1d'}`,
            color: status === 'accepted' ? 'var(--yes)' : 'var(--no)',
            fontSize: '0.82rem', fontWeight: 700,
          }}>
            {status === 'accepted' ? '✓ Offer Accepted' : '✗ Offer Declined'}
          </div>
        )}
        {isMe && !acted && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 6 }}>Awaiting response</div>}
      </div>
    );
  }

  const myUsername = myInfo ? (myInfo.username || myInfo.name) : '';

  if (!session) return <><Navbar /><div className="loading">Not signed in</div></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      <div className="messages-layout" style={{ flex: 1 }}>
        {/* Sidebar */}
        <div style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 12 }}>Messages</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                placeholder="Search user..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ fontSize: '0.85rem' }}
              />
              <button onClick={handleSearch} style={{ padding: '8px 12px', background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text2)', cursor: 'pointer', fontSize: '0.9rem', flexShrink: 0 }}>→</button>
            </div>
            {searchError && <div style={{ fontSize: '0.78rem', color: 'var(--no)', marginTop: 6 }}>{searchError}</div>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {convos.length === 0
              ? <div style={{ padding: '24px 16px', color: 'var(--text3)', fontSize: '0.85rem', textAlign: 'center' }}>No conversations yet</div>
              : convos.map(c => (
                  <button key={c.partner_id} onClick={() => openChat(c.partner_name)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: activeUser === c.partner_name ? 'var(--surface2)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}>
                    <Avatar src={c.partner_image} name={c.partner_name} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>{c.partner_name}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.content?.startsWith('[CREDIT_') ? '💸 Credit request' : c.content}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text3)', flexShrink: 0 }}>{timeAgo(c.created_at)}</div>
                  </button>
                ))
            }
          </div>
        </div>

        {/* Chat window */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeUser ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', flexDirection: 'column', gap: 12 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span style={{ fontSize: '0.92rem' }}>Select a conversation or search for a user</span>
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.93rem', background: 'var(--surface)', flexShrink: 0 }}>
                {activeUser}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map(m => {
                  const isMe = m.sender_name === myUsername;
                  const parsed = parseMessage(m.content);
                  return (
                    <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      {!isMe && <Avatar src={m.sender_image} name={m.sender_name} size={28} />}
                      <div style={{ maxWidth: '72%' }}>
                        {parsed.isCreditMsg ? (
                          <CreditMessageBubble msg={parsed} isMe={isMe} senderName={m.sender_name} />
                        ) : (
                          <div style={{
                            padding: '9px 14px', borderRadius: isMe ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
                            background: isMe ? 'var(--surface3)' : 'var(--surface2)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.55,
                          }}>
                            {m.content}
                          </div>
                        )}
                        <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>{timeAgo(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {creditAttachment && (
                <div style={{ margin: '0 16px 6px', padding: '8px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--yes)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  <span style={{ fontSize: '0.82rem', color: 'var(--yes)', fontWeight: 600 }}>
                    {creditAttachment.type === 'send' ? 'Sending' : 'Requesting'} {creditAttachment.amount} sl{creditAttachment.note ? ` · ${creditAttachment.note}` : ''}
                  </span>
                  <button onClick={() => setCreditAttachment(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>✕</button>
                </div>
              )}

              {showCreditForm && (
                <div style={{ margin: '0 16px 6px', padding: '14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 12 }}>Attach Credits</div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                    {['send', 'request'].map(t => (
                      <button key={t} onClick={() => setCreditType(t)}
                        style={{ flex: 1, padding: '6px 0', background: creditType === t ? 'var(--yes-dim)' : 'transparent', border: `1px solid ${creditType === t ? '#166534' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: creditType === t ? 'var(--yes)' : 'var(--text3)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input type="number" placeholder="Amount (sl)" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} style={{ fontSize: '0.9rem' }} />
                    <input placeholder="Note (optional)" value={creditNote} onChange={e => setCreditNote(e.target.value)} style={{ fontSize: '0.9rem' }} />
                  </div>
                  {creditErr && <div style={{ fontSize: '0.78rem', color: 'var(--no)', marginBottom: 8 }}>{creditErr}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setShowCreditForm(false); setCreditErr(''); }} style={{ flex: 1, padding: '6px 0', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text3)', fontSize: '0.82rem', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={attachCredit} style={{ flex: 2, padding: '6px 0', background: '#16a34a', border: '1px solid #22c55e', borderRadius: 'var(--radius)', color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>Attach</button>
                  </div>
                </div>
              )}

              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0, background: 'var(--surface)' }}>
                <button onClick={() => setShowCreditForm(v => !v)} title="Attach credits"
                  style={{ padding: '8px 12px', background: showCreditForm ? 'var(--yes-dim)' : 'var(--surface2)', border: `1px solid ${showCreditForm ? '#166534' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: showCreditForm ? 'var(--yes)' : 'var(--text3)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </button>
                <input
                  ref={inputRef}
                  placeholder="Message..."
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg()}
                  style={{ flex: 1, borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: '0.9rem' }}
                />
                <button onClick={sendMsg} disabled={sending || (!newMsg.trim() && !creditAttachment)}
                  style={{ padding: '8px 18px', background: '#16a34a', border: '1px solid #22c55e', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.87rem', opacity: (!newMsg.trim() && !creditAttachment) ? 0.35 : 1, flexShrink: 0 }}>
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
