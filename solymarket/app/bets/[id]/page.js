'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '../../Navbar';

// ── Simple real-time percentage chart ─────────────────
function YesNoChart({ yesPct }) {
  const canvasRef = useRef(null);
  const historyRef = useRef([]);
  const animRef = useRef(null);

  useEffect(() => {
    const history = historyRef.current;
    if (history.length === 0 || history[history.length - 1] !== yesPct) {
      history.push(yesPct);
      if (history.length > 60) history.shift();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    ctx.clearRect(0, 0, W, H);

    if (history.length < 2) {
      // Just show a flat line
      const y = H - (yesPct / 100) * H;
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(W, y);
      ctx.strokeStyle = '#3fb950';
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(48,54,61,0.6)';
    ctx.lineWidth = 1;
    [25, 50, 75].forEach(pct => {
      const y = H - (pct / 100) * H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    });

    // Labels
    ctx.fillStyle = '#484f58';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    [25, 50, 75].forEach(pct => {
      ctx.fillText(pct + '%', W - 4, H - (pct / 100) * H - 3);
    });

    // YES line
    const stepX = W / (history.length - 1);
    ctx.beginPath();
    history.forEach((v, i) => {
      const x = i * stepX;
      const y = H - (v / 100) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#3fb950';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Fill under line
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = 'rgba(63,185,80,0.08)';
    ctx.fill();

    // Current value dot
    const lastX = (history.length - 1) * stepX;
    const lastY = H - (history[history.length - 1] / 100) * H;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#3fb950';
    ctx.fill();
  }, [yesPct]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8 }}>
        YES probability over time
      </div>
      <div style={{ position: 'relative', height: 140, background: 'var(--surface2)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  );
}

// ── Comment component ──────────────────────────────────
function Comment({ comment, allComments, session, betId, onReplyPosted, depth = 0 }) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const [likes, setLikes] = useState(parseInt(comment.likes) || 0);
  const [liked, setLiked] = useState(false);

  const replies = allComments.filter(c => c.parent_id === comment.id);

  async function toggleLike() {
    if (!session) return;
    const res = await fetch('/api/comments/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId: comment.id }),
    });
    const d = await res.json();
    if (res.ok) { setLiked(d.liked); setLikes(d.count); }
  }

  async function postReply() {
    if (!replyText.trim()) return;
    setPosting(true);
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId, content: replyText, parentId: comment.id }),
    });
    const d = await res.json();
    setPosting(false);
    if (res.ok) {
      onReplyPosted(d);
      setReplyText('');
      setReplying(false);
    }
  }

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="comment" style={{ paddingLeft: depth > 0 ? 0 : undefined }}>
      <div className="comment-header">
        {comment.author_image
          ? <img src={comment.author_image} alt="" className="comment-avatar" />
          : <div className="comment-avatar" style={{ background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text3)' }}>
              {comment.author_name?.[0]?.toUpperCase()}
            </div>
        }
        <Link href={`/user/${encodeURIComponent(comment.author_name)}`} className="comment-author" style={{ textDecoration: 'none' }}>
          {comment.author_name}
        </Link>
        <span className="comment-time">{timeAgo(comment.created_at)}</span>
      </div>
      <div className="comment-body">{comment.content}</div>
      <div className="comment-actions">
        <button
          className={`comment-action-btn${liked ? ' liked' : ''}`}
          onClick={toggleLike}
          title="Like"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {likes > 0 && <span>{likes}</span>}
        </button>
        {session && depth < 2 && (
          <button className="comment-action-btn" onClick={() => setReplying(!replying)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Reply
          </button>
        )}
      </div>

      {replying && (
        <div style={{ paddingLeft: 38, marginTop: 10 }}>
          <textarea
            placeholder={`Reply to ${comment.author_name}...`}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            style={{ minHeight: 60, fontSize: '0.88rem' }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setReplying(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={postReply} disabled={posting || !replyText.trim()}>
              {posting ? '...' : 'Reply'}
            </button>
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <div className="reply-list">
          {replies.map(r => (
            <Comment key={r.id} comment={r} allComments={allComments} session={session} betId={betId} onReplyPosted={onReplyPosted} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Comments section ───────────────────────────────────
function CommentsSection({ betId, session }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetch(`/api/comments?betId=${betId}`)
      .then(r => r.json())
      .then(d => { setComments(Array.isArray(d) ? d : []); setLoading(false); });
  }, [betId]);

  async function postComment() {
    if (!newComment.trim()) return;
    setPosting(true);
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId, content: newComment }),
    });
    const d = await res.json();
    setPosting(false);
    if (res.ok) { setComments(prev => [...prev, d]); setNewComment(''); }
  }

  const topLevel = comments.filter(c => !c.parent_id);

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 28 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20 }}>
          Comments {comments.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({comments.length})</span>}
        </h3>

        {session && (
          <div style={{ marginBottom: 24 }}>
            <textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              style={{ marginBottom: 8, fontSize: '0.9rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={postComment}
                disabled={posting || !newComment.trim()}
              >
                {posting ? '...' : 'Comment'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--text3)', padding: '20px 0', fontSize: '0.9rem' }}>loading...</div>
        ) : topLevel.length === 0 ? (
          <div style={{ color: 'var(--text3)', padding: '20px 0', fontSize: '0.9rem' }}>No comments yet. Be the first.</div>
        ) : (
          <div className="comment-list">
            {topLevel.map(c => (
              <Comment
                key={c.id}
                comment={c}
                allComments={comments}
                session={session}
                betId={betId}
                onReplyPosted={reply => setComments(prev => [...prev, reply])}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin sidebar ──────────────────────────────────────
function AdminSidebar({ bet, onResolved }) {
  const [outcome, setOutcome] = useState('yes');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function resolve() {
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: bet.id, outcome }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    setMsg(`Resolved ${outcome.toUpperCase()}.`);
    onResolved();
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
    setMsg(`Refunded ${d.refunded} participants.`);
    onResolved();
  }

  async function deleteBet() {
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ betId: bet.id }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    window.location.href = '/';
  }

  if (bet.status !== 'open') return (
    <div className="card" style={{ borderColor: 'var(--border2)' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 12 }}>
        Admin
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text2)', marginBottom: 14 }}>Market is closed.</div>
      {!confirmDelete ? (
        <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }} onClick={() => setConfirmDelete(true)}>
          Delete market
        </button>
      ) : (
        <>
          <div style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 10 }}>Permanently delete this market and all its data?</div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="btn btn-danger" style={{ flex: 2, justifyContent: 'center' }} onClick={deleteBet} disabled={loading}>
              {loading ? '...' : 'Delete'}
            </button>
          </div>
        </>
      )}
      {err && <div className="error-msg" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );

  return (
    <div className="card" style={{ borderColor: 'var(--border2)' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 14 }}>
        Admin controls
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: 8 }}>Resolve outcome</div>
      <div className="side-btns" style={{ marginBottom: 12 }}>
        <button className={`btn btn-yes${outcome === 'yes' ? ' active' : ''}`} onClick={() => setOutcome('yes')}>YES</button>
        <button className={`btn btn-no${outcome === 'no' ? ' active' : ''}`} onClick={() => setOutcome('no')}>NO</button>
      </div>
      <button className={`btn ${outcome === 'yes' ? 'btn-yes' : 'btn-no'}`} style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={resolve} disabled={loading}>
        {loading ? '...' : `Resolve ${outcome.toUpperCase()}`}
      </button>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem' }} onClick={refund} disabled={loading}>
          Refund all
        </button>
      </div>
      {err && <div className="error-msg">{err}</div>}
      {msg && <div className="success-msg">{msg}</div>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────
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
    setSuccess(`Placed ${credits} sl on ${side.toUpperCase()}`);
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
  const isAdmin = session?.user?.isAdmin;

  return (
    <>
      <Navbar />
      <div className="page">
        <Link href="/" style={{ color: 'var(--text3)', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to markets
        </Link>

        <div className="two-col">
          {/* Left column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className={`status-badge status-${bet.status}`}>{bet.status}</span>
              {bet.status === 'resolved' && bet.outcome && (
                <span className={`outcome-badge outcome-${bet.outcome}`}>resolved {bet.outcome.toUpperCase()}</span>
              )}
              {bet.status === 'refunded' && (
                <span className="status-badge status-refunded">all bets refunded</span>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text3)', marginLeft: 4 }}>
                by {bet.creator_name || 'anon'}
              </span>
            </div>

            <h1 className="market-title">{bet.title}</h1>

            {bet.description && (
              <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.65 }}>
                {bet.description}
              </p>
            )}

            {/* Chart */}
            <YesNoChart yesPct={yesPct} />

            {/* Current odds */}
            <div style={{ marginBottom: 24 }}>
              <div className="bar-container" style={{ height: 8, marginBottom: 10 }}>
                <div className="bar-yes" style={{ width: yesPct + '%' }} />
                <div className="bar-no" style={{ width: noPct + '%' }} />
              </div>
              <div className="bar-labels">
                <span className="yes-label" style={{ fontSize: '1rem' }}>YES {yesPct}% · {bet.total_yes || 0} sl</span>
                <span className="total-pool" style={{ fontSize: '0.9rem' }}>{total} sl total</span>
                <span className="no-label" style={{ fontSize: '1rem' }}>{bet.total_no || 0} sl · {noPct}% NO</span>
              </div>
            </div>

            <div style={{ color: 'var(--text3)', fontSize: '0.8rem', marginBottom: 24 }}>
              {positions.length} participant{positions.length !== 1 ? 's' : ''}
            </div>

            {/* Positions list */}
            {positions.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>
                  Positions
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {positions.map((p, i) => {
                    const t = (bet.total_yes || 0) + (bet.total_no || 0);
                    let pnl = null;
                    if (bet.status === 'resolved' && bet.outcome) {
                      if (p.side === bet.outcome) {
                        const winnerPool = bet.outcome === 'yes' ? (bet.total_yes || 0) : (bet.total_no || 0);
                        const payout = winnerPool > 0 ? Math.round((p.amount / winnerPool) * t) : 0;
                        pnl = payout - p.amount;
                      } else {
                        pnl = -p.amount;
                      }
                    }
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < positions.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '0.88rem' }}>
                        <Link href={`/user/${encodeURIComponent(p.user_name)}`} style={{ color: 'var(--text)', fontWeight: 500 }}>
                          {p.user_name}
                        </Link>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 700 }}>{p.side.toUpperCase()}</span>
                          <span style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{p.amount} sl</span>
                          {bet.status === 'refunded'
                            ? <span style={{ color: 'var(--text3)', fontSize: '0.78rem' }}>refunded</span>
                            : pnl !== null && <span style={{ color: pnl >= 0 ? 'var(--yes)' : 'var(--no)', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem' }}>{pnl >= 0 ? '+' : ''}{pnl} sl</span>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Comments */}
            <CommentsSection betId={params.id} session={session} />
          </div>

          {/* Right sidebar */}
          <div className="sticky-sidebar">
            {isAdmin && <AdminSidebar bet={bet} onResolved={load} />}

            {!isAdmin && (myPosition ? (
              <div className="card">
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontWeight: 600 }}>
                  Your position
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: myPosition.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 700, fontSize: '1.1rem' }}>
                    {myPosition.side.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>{myPosition.amount} sl</span>
                </div>
                {bet.status === 'resolved' && (() => {
                  const t = (bet.total_yes || 0) + (bet.total_no || 0);
                  const winnerPool = bet.outcome === 'yes' ? (bet.total_yes || 0) : (bet.total_no || 0);
                  const won = myPosition.side === bet.outcome;
                  const payout = won && winnerPool > 0 ? Math.round((myPosition.amount / winnerPool) * t) : 0;
                  const pnl = won ? payout - myPosition.amount : -myPosition.amount;
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, padding: '8px 10px', background: won ? 'var(--yes-dim)' : 'var(--no-dim)', borderRadius: 6 }}>
                      <span style={{ color: won ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>{won ? 'Won' : 'Lost'}</span>
                      <span style={{ color: won ? 'var(--yes)' : 'var(--no)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{pnl >= 0 ? '+' : ''}{pnl} sl</span>
                    </div>
                  );
                })()}
                {bet.status === 'refunded' && (
                  <div style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--text2)' }}>Refunded</div>
                )}
              </div>
            ) : bet.status === 'open' && session ? (
              <div className="card">
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14, fontWeight: 600 }}>
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
                    <div style={{ marginTop: 5, fontSize: '0.75rem', color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Balance: {userCredits} sl</span>
                      <button onClick={() => setAmount(String(userCredits))} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}>
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
            ) : bet.status !== 'open' ? (
              <div className="card">
                <div style={{ fontSize: '0.9rem', color: 'var(--text2)' }}>This market is closed.</div>
              </div>
            ) : null)}
          </div>
        </div>
      </div>
    </>
  );
}
