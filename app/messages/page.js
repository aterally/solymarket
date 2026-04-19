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

  // Credit attachment state
  const [creditAttachment, setCreditAttachment] = useState(null); // { type: 'send'|'request', amount, note }
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditType, setCreditType] = useState('send');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [creditErr, setCreditErr] = useState('');

  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const inputRef = useRef(null);

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

  useEffect(() => () => clearInterval(pollRef.current), []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function handleSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchError('');
    // Check if user exists by trying to open a chat (the API returns 404 if not found)
    const res = await fetch(`/api/dms?with=${encodeURIComponent(q)}`);
    if (!res.ok) {
      setSearchError(`User "${q}" doesn't exist.`);
      return;
    }
    openChat(q);
  }

  async function sendMsg() {
    if ((!newMsg.trim() && !creditAttachment) || !activeUser) return;
    setSending(true);

    if (creditAttachment) {
      // Send credit request via credits API, then send a DM notification
      const res = await fetch('/api/credits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: creditAttachment.type,
          toUsername: activeUser,
          amount: creditAttachment.amount,
          note: creditAttachment.note || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setSending(false); return; }

      // Send a DM referencing the credit action
      const msgContent = `[CREDIT_${creditAttachment.type.toUpperCase()}:${creditAttachment.amount}:${creditAttachment.note || ''}]${newMsg.trim() ? ' ' + newMsg.trim() : ''}`;
      const dmRes = await fetch('/api/dms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUsername: activeUser, content: msgContent }),
      });
      const dm = await dmRes.json();
      if (dmRes.ok) {
        setMessages(prev => [...prev, dm]);
        setNewMsg('');
        setCreditAttachment(null);
        loadConvos();
      }
    } else {
      const res = await fetch('/api/dms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUsername: activeUser, content: newMsg.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, d]);
        setNewMsg('');
        loadConvos();
      }
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
      return {
        isCreditMsg: true,
        creditType: match[1].toLowerCase(),
        amount: parseInt(match[2]),
        note: match[3] || '',
        text: match[4].trim(),
      };
    }
    return { isCreditMsg: false, text: content };
  }

  function CreditMessageBubble({ msg, isMe, myUsername, senderName }) {
    const [acted, setActed] = useState(false);
    const [acting, setActing] = useState(null);

    async function decidePending(action) {
      // Find pending credit request from sender
      setActing(action);
      const res = await fetch('/api/credits');
      const d = await res.json();
      if (d.requests) {
        // Find the matching request
        const matchingReq = d.requests.find(r => {
          const fromName = r.from_name;
          return fromName === senderName && r.type === msg.creditType && r.amount === msg.amount;
        });
        if (matchingReq) {
          await fetch('/api/credits', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, requestId: matchingReq.id }),
          });
          setActed(true);
        }
      }
      setActing(null);
    }

    const label = msg.creditType === 'send' ? 'sending' : 'requesting';
    return (
      <div style={{
        padding: '10px 12px', borderRadius: isMe ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
        background: isMe ? 'var(--surface3)' : 'var(--surface2)',
        border: '1px solid var(--border)',
        maxWidth: '72%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--yes)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            credit {label}
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--yes)', marginBottom: msg.note ? 4 : 0 }}>
          {msg.amount} sl
        </div>
        {msg.note && <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: 8 }}>{msg.note}</div>}
        {msg.text && <div style={{ fontSize: '0.88rem', color: 'var(--text)', marginBottom: 8 }}>{msg.text}</div>}
        {!isMe && !acted && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={() => decidePending('decline')}
              disabled={!!acting}
              style={{ flex: 1, padding: '5px 0', background: 'var(--no-dim)', border: '1px solid #7f1d1d', borderRadius: 4, color: 'var(--no)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
            >
              {acting === 'decline' ? '...' : 'Deny'}
            </button>
            <button
              onClick={() => decidePending('accept')}
              disabled={!!acting}
              style={{ flex: 1, padding: '5px 0', background: '#16a34a', border: '1px solid #22c55e', borderRadius: 4, color: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}
            >
              {acting === 'accept' ? '...' : 'Accept'}
            </button>
          </div>
        )}
        {acted && <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 6 }}>Responded</div>}
        {isMe && <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 4 }}>Awaiting response</div>}
      </div>
    );
  }

  const myUsername = myInfo ? (myInfo.username || myInfo.name) : '';

  if (!session) return <><Navbar /><div className="loading">not signed in</div></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      <div className="messages-layout" style={{ flex: 1 }}>
        {/* Left sidebar: conversations */}
        <div style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>Messages</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                placeholder="Search user..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ fontSize: '0.82rem', flex: 1 }}
              />
              <button
                onClick={handleSearch}
                style={{ padding: '6px 10px', background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text2)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}
              >
                →
              </button>
            </div>
            {searchError && <div style={{ fontSize: '0.78rem', color: 'var(--no)', marginTop: 6 }}>{searchError}</div>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {convos.length === 0
              ? <div style={{ padding: '20px 14px', color: 'var(--text3)', fontSize: '0.82rem', textAlign: 'center' }}>No conversations yet</div>
              : convos.map(c => (
                  <button key={c.partner_id} onClick={() => openChat(c.partner_name)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: activeUser === c.partner_name ? 'var(--surface2)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}>
                    <Avatar src={c.partner_image} name={c.partner_name} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{c.partner_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.content?.startsWith('[CREDIT_') ? '💸 Credit request' : c.content}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text3)', flexShrink: 0 }}>{timeAgo(c.created_at)}</div>
                  </button>
                ))
            }
          </div>
        </div>

        {/* Right: chat window */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeUser ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', flexDirection: 'column', gap: 10 }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span style={{ fontSize: '0.9rem' }}>Select a conversation or search for a user</span>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.9rem', background: 'var(--surface)', flexShrink: 0 }}>
                {activeUser}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map(m => {
                  const isMe = m.sender_name === myUsername;
                  const parsed = parseMessage(m.content);
                  return (
                    <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      {!isMe && <Avatar src={m.sender_image} name={m.sender_name} size={26} />}
                      <div style={{ maxWidth: '72%' }}>
                        {parsed.isCreditMsg ? (
                          <CreditMessageBubble msg={parsed} isMe={isMe} myUsername={myUsername} senderName={m.sender_name} />
                        ) : (
                          <div style={{
                            padding: '8px 12px', borderRadius: isMe ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
                            background: isMe ? 'var(--surface3)' : 'var(--surface2)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            fontSize: '0.88rem', lineHeight: 1.5,
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

              {/* Credit attachment preview */}
              {creditAttachment && (
                <div style={{ margin: '0 16px', padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--yes)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  <span style={{ fontSize: '0.8rem', color: 'var(--yes)', fontWeight: 600 }}>
                    {creditAttachment.type === 'send' ? 'Sending' : 'Requesting'} {creditAttachment.amount} sl
                    {creditAttachment.note ? ` · ${creditAttachment.note}` : ''}
                  </span>
                  <button onClick={() => setCreditAttachment(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                </div>
              )}

              {/* Credit form popup */}
              {showCreditForm && (
                <div style={{ margin: '0 16px', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>Attach Credits</div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                    {['send', 'request'].map(t => (
                      <button key={t} onClick={() => setCreditType(t)}
                        style={{ flex: 1, padding: '5px 0', background: creditType === t ? 'var(--yes-dim)' : 'transparent', border: `1px solid ${creditType === t ? '#166534' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: creditType === t ? 'var(--yes)' : 'var(--text3)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input type="number" placeholder="Amount (sl)" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} style={{ fontSize: '0.85rem' }} />
                    <input placeholder="Note (optional)" value={creditNote} onChange={e => setCreditNote(e.target.value)} style={{ fontSize: '0.85rem' }} />
                  </div>
                  {creditErr && <div style={{ fontSize: '0.78rem', color: 'var(--no)', marginBottom: 6 }}>{creditErr}</div>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setShowCreditForm(false); setCreditErr(''); }} style={{ flex: 1, padding: '5px 0', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text3)', fontSize: '0.78rem', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={attachCredit} style={{ flex: 2, padding: '5px 0', background: '#16a34a', border: '1px solid #22c55e', borderRadius: 'var(--radius)', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>Attach</button>
                  </div>
                </div>
              )}

              {/* Input bar */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexShrink: 0, background: 'var(--surface)' }}>
                <button
                  onClick={() => setShowCreditForm(v => !v)}
                  title="Attach credits"
                  style={{ padding: '7px 10px', background: showCreditForm ? 'var(--yes-dim)' : 'var(--surface2)', border: `1px solid ${showCreditForm ? '#166534' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: showCreditForm ? 'var(--yes)' : 'var(--text3)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </button>
                <input
                  ref={inputRef}
                  placeholder="Message..."
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg()}
                  style={{ flex: 1, borderRadius: 'var(--radius)', padding: '7px 12px', fontSize: '0.88rem' }}
                />
                <button
                  onClick={sendMsg}
                  disabled={sending || (!newMsg.trim() && !creditAttachment)}
                  style={{ padding: '7px 16px', background: '#16a34a', border: '1px solid #22c55e', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', opacity: (!newMsg.trim() && !creditAttachment) ? 0.35 : 1, flexShrink: 0 }}
                >
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
