'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '../../Navbar';

// ── Live probability chart ─────────────────────────────
function YesNoChart({ history }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (W === 0 || H === 0) return;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = 'rgba(50,50,50,0.7)';
      ctx.lineWidth = 1;
      [25, 50, 75].forEach(pct => {
        const y = H - (pct / 100) * H;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      });
      ctx.fillStyle = '#333';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      [25, 50, 75].forEach(pct => {
        ctx.fillText(pct + '%', W - 4, H - (pct / 100) * H - 3);
      });

      if (!history || history.length === 0) return;

      // Draw flat line if only one point
      if (history.length === 1) {
        const y = H - (history[0] / 100) * H;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y);
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.5; ctx.stroke();
        // Dot
        ctx.beginPath(); ctx.arc(W, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e'; ctx.fill();
        return;
      }

      const stepX = W / (history.length - 1);

      // Gradient fill
      ctx.beginPath();
      history.forEach((v, i) => {
        const x = i * stepX;
        const y = H - (v / 100) * H;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      const lastX2 = (history.length - 1) * stepX;
      ctx.lineTo(lastX2, H); ctx.lineTo(0, H); ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(34,197,94,0.18)');
      grad.addColorStop(1, 'rgba(34,197,94,0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      history.forEach((v, i) => {
        const x = i * stepX;
        const y = H - (v / 100) * H;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // End dot
      const lastX = (history.length - 1) * stepX;
      const lastY = H - (history[history.length - 1] / 100) * H;
      ctx.beginPath(); ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e'; ctx.fill();

      // Tooltip line
      if (tooltip !== null && history.length > 1) {
        const idx = tooltip;
        const tx = (idx / (history.length - 1)) * W;
        const ty = H - (history[idx] / 100) * H;
        ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(tx, H);
        ctx.strokeStyle = 'rgba(34,197,94,0.3)'; ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e'; ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }

    draw();
    const ro = new ResizeObserver(draw);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [history, tooltip]);

  function handleMouseMove(e) {
    if (!history || history.length < 2) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = Math.max(0, Math.min(history.length - 1, Math.round((mx / rect.width) * (history.length - 1))));
    setTooltip(idx);
  }

  const tooltipPct = tooltip !== null && history ? history[tooltip] : null;

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 10 }}>
        YES probability
      </div>
      <div
        ref={wrapRef}
        style={{ position: 'relative', height: 150, background: 'var(--surface2)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />
        {tooltipPct !== null && (
          <div style={{
            position: 'absolute', top: 10, left: Math.min(((tooltip / (history.length - 1)) * 100), 80) + '%',
            transform: 'translateX(-50%)',
            background: 'var(--surface3)', border: '1px solid var(--border2)',
            borderRadius: 'var(--radius)', padding: '3px 8px', pointerEvents: 'none',
            fontSize: '0.78rem', color: 'var(--yes)', fontFamily: 'var(--font-mono)', fontWeight: 700,
          }}>
            {tooltipPct}%
          </div>
        )}
      </div>
    </div>
  );
}

// ── Proposal widget ────────────────────────────────────
function ProposalWidget({ betId, betStatus, session }) {
  const [data, setData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    const res = await fetch(`/api/proposals?betId=${betId}`);
    const d = await res.json();
    if (res.ok) setData(d);
  }

  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv); }, [betId]);

  async function propose(outcome) {
    setSubmitting(true); setErr('');
    const res = await fetch('/api/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ betId: parseInt(betId), outcome }) });
    const d = await res.json();
    setSubmitting(false);
    if (!res.ok) return setErr(d.error);
    load();
  }

  async function retract() {
    setSubmitting(true);
    await fetch('/api/proposals', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ betId: parseInt(betId) }) });
    setSubmitting(false); load();
  }

  if (!session || betStatus !== 'open' || !data) return null;
  const total = (data.yes || 0) + (data.no || 0);

  return (
    <div className="card">
      <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 10 }}>Propose outcome</div>
      <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 12, lineHeight: 1.55 }}>Think you know the answer? Propose how this market should resolve.</p>
      {data.myProposal ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 12px', borderRadius: 'var(--radius)', background: data.myProposal === 'yes' ? 'var(--yes-dim)' : 'var(--no-dim)', border: `1px solid ${data.myProposal === 'yes' ? '#166534' : '#7f1d1d'}` }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>Your proposal:</span>
            <span style={{ fontWeight: 700, color: data.myProposal === 'yes' ? 'var(--yes)' : 'var(--no)' }}>{data.myProposal.toUpperCase()}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={retract} disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>Retract</button>
        </div>
      ) : (
        <div className="side-btns">
          <button className="btn btn-yes" onClick={() => propose('yes')} disabled={submitting}>YES</button>
          <button className="btn btn-no" onClick={() => propose('no')} disabled={submitting}>NO</button>
        </div>
      )}
      {total > 0 && (
        <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text3)', display: 'flex', gap: 12 }}>
          <span style={{ color: 'var(--yes)' }}>✓ {data.yes} yes</span>
          <span style={{ color: 'var(--no)' }}>✗ {data.no} no</span>
        </div>
      )}
      {err && <div className="error-msg" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

// ── Comment ────────────────────────────────────────────
function Comment({ comment, allComments, session, betId, onReplyPosted, onDeleted, depth = 0, isAdmin }) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const [likes, setLikes] = useState(parseInt(comment.likes) || 0);
  const [liked, setLiked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const replies = allComments.filter(c => c.parent_id === comment.id);

  async function toggleLike() {
    if (!session) return;
    const res = await fetch('/api/comments/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentId: comment.id }) });
    const d = await res.json();
    if (res.ok) { setLiked(d.liked); setLikes(d.count); }
  }

  async function postReply() {
    if (!replyText.trim()) return;
    setPosting(true);
    const res = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ betId, content: replyText, parentId: comment.id }) });
    const d = await res.json();
    setPosting(false);
    if (res.ok) { onReplyPosted(d); setReplyText(''); setReplying(false); }
  }

  async function deleteComment() {
    if (!confirm('Delete this comment?')) return;
    setDeleting(true);
    const res = await fetch('/api/comments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentId: comment.id }) });
    setDeleting(false);
    if (res.ok) onDeleted(comment.id);
  }

  const timeAgo = ts => {
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
          : <div className="comment-avatar" style={{ background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', color: 'var(--text3)' }}>{comment.author_name?.[0]?.toUpperCase()}</div>
        }
        <Link href={`/user/${encodeURIComponent(comment.author_name)}`} className="comment-author" style={{ textDecoration: 'none' }}>{comment.author_name}</Link>
        <span className="comment-time">{timeAgo(comment.created_at)}</span>
      </div>
      <div className="comment-body">{comment.content}</div>
      {comment.image_url && (
        <div style={{ paddingLeft: 38, marginTop: 8 }}>
          <img src={comment.image_url} alt="" style={{ maxHeight: 240, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => window.open(comment.image_url, '_blank')} />
        </div>
      )}
      <div className="comment-actions">
        <button className={`comment-action-btn${liked ? ' liked' : ''}`} onClick={toggleLike}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          {likes > 0 && <span>{likes}</span>}
        </button>
        {session && depth < 2 && (
          <button className="comment-action-btn" onClick={() => setReplying(!replying)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Reply
          </button>
        )}
        {isAdmin && (
          <button className="comment-action-btn" onClick={deleteComment} disabled={deleting} style={{ color: 'var(--no)', marginLeft: 'auto' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            {deleting ? '...' : 'Delete'}
          </button>
        )}
      </div>
      {replying && (
        <div style={{ paddingLeft: 38, marginTop: 10 }}>
          <textarea placeholder={`Reply to ${comment.author_name}...`} value={replyText} onChange={e => setReplyText(e.target.value)} style={{ minHeight: 60, fontSize: '0.87rem' }} autoFocus />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setReplying(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={postReply} disabled={posting || !replyText.trim()}>{posting ? '...' : 'Reply'}</button>
          </div>
        </div>
      )}
      {replies.length > 0 && (
        <div className="reply-list">
          {replies.map(r => <Comment key={r.id} comment={r} allComments={allComments} session={session} betId={betId} onReplyPosted={onReplyPosted} onDeleted={onDeleted} depth={depth + 1} isAdmin={isAdmin} />)}
        </div>
      )}
    </div>
  );
}

function CommentsSection({ betId, session, isAdmin }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch(`/api/comments?betId=${betId}`).then(r => r.json()).then(d => { setComments(Array.isArray(d) ? d : []); setLoading(false); });
    const iv = setInterval(() => {
      fetch(`/api/comments?betId=${betId}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setComments(d); });
    }, 8000);
    return () => clearInterval(iv);
  }, [betId]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErr('Only images allowed');
    const reader = new FileReader();
    reader.onload = ev => setPendingImage(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function postComment() {
    if (!newComment.trim() && !pendingImage) return;
    setPosting(true); setErr('');
    const res = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ betId, content: newComment, imageUrl: pendingImage || undefined }) });
    const d = await res.json();
    setPosting(false);
    if (!res.ok) return setErr(d.error);
    setComments(prev => [...prev, d]);
    setNewComment(''); setPendingImage(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const topLevel = comments.filter(c => !c.parent_id);

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 28 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20 }}>
          Comments {comments.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '0.88rem' }}>({comments.length})</span>}
        </h3>
        {session && (
          <div style={{ marginBottom: 22 }}>
            <textarea placeholder="Add a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} style={{ marginBottom: 8, fontSize: '0.9rem' }} />
            {pendingImage && (
              <div style={{ position: 'relative', marginBottom: 10, display: 'inline-block' }}>
                <img src={pendingImage} alt="preview" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
                <button onClick={() => { setPendingImage(null); if (fileRef.current) fileRef.current.value = ''; }} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 22, height: 22, color: '#fff', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            )}
            {err && <div className="error-msg" style={{ marginBottom: 8 }}>{err}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: '0.82rem' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Photo
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
              <button className="btn btn-primary btn-sm" onClick={postComment} disabled={posting || (!newComment.trim() && !pendingImage)}>{posting ? '...' : 'Comment'}</button>
            </div>
          </div>
        )}
        {loading ? (
          <div style={{ color: 'var(--text3)', padding: '20px 0', fontSize: '0.9rem' }}>Loading comments...</div>
        ) : topLevel.length === 0 ? (
          <div style={{ color: 'var(--text3)', padding: '20px 0', fontSize: '0.9rem' }}>No comments yet.</div>
        ) : (
          <div className="comment-list">
            {topLevel.map(c => <Comment key={c.id} comment={c} allComments={comments} session={session} betId={betId} onReplyPosted={reply => setComments(prev => [...prev, reply])} onDeleted={id => setComments(prev => prev.filter(c => c.id !== id && c.parent_id !== id))} isAdmin={isAdmin} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin sidebar ──────────────────────────────────────
function AdminSidebar({ bet, onResolved, betId }) {
  const [outcome, setOutcome] = useState('yes');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [proposals, setProposals] = useState(null);

  useEffect(() => {
    if (bet.status !== 'open') return;
    const load = async () => {
      const res = await fetch(`/api/proposals?betId=${betId}`);
      const d = await res.json();
      if (res.ok) setProposals(d);
    };
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [betId, bet.status]);

  async function resolve() {
    setLoading(true); setErr(''); setMsg('');
    const res = await fetch('/api/admin/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ betId: bet.id, outcome }) });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    setMsg(`Resolved ${outcome.toUpperCase()}.`);
    onResolved();
  }

  async function refund() {
    setLoading(true); setErr(''); setMsg('');
    const res = await fetch('/api/admin/refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ betId: bet.id }) });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    setMsg(`Refunded ${d.refunded} participants.`);
    onResolved();
  }

  async function deleteBet() {
    setLoading(true); setErr('');
    const res = await fetch('/api/admin/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ betId: bet.id }) });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    window.location.href = '/';
  }

  if (bet.status !== 'open') return (
    <div className="card" style={{ borderColor: 'var(--border2)' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 10 }}>Admin</div>
      <div style={{ fontSize: '0.84rem', color: 'var(--text2)', marginBottom: 14 }}>Market is closed.</div>
      {!confirmDelete
        ? <button className="btn btn-danger btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setConfirmDelete(true)}>Delete market</button>
        : <>
            <div style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 10 }}>Permanently delete?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-danger btn-sm" style={{ flex: 2, justifyContent: 'center' }} onClick={deleteBet} disabled={loading}>{loading ? '...' : 'Delete'}</button>
            </div>
          </>
      }
      {err && <div className="error-msg" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );

  return (
    <div className="card" style={{ borderColor: 'var(--border2)' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 14 }}>Admin controls</div>
      {proposals && ((proposals.yes + proposals.no) > 0) && (
        <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 8 }}>User proposals</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--yes)' }}>{proposals.yes}</span>
            <span style={{ fontSize: '0.77rem', color: 'var(--text3)', alignSelf: 'center' }}>YES</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--no)' }}>{proposals.no}</span>
            <span style={{ fontSize: '0.77rem', color: 'var(--text3)', alignSelf: 'center' }}>NO</span>
          </div>
        </div>
      )}
      <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: 10 }}>Resolve outcome</div>
      <div className="side-btns">
        <button className={`btn btn-yes${outcome === 'yes' ? ' active' : ''}`} onClick={() => setOutcome('yes')}>YES</button>
        <button className={`btn btn-no${outcome === 'no' ? ' active' : ''}`} onClick={() => setOutcome('no')}>NO</button>
      </div>
      <button className={`btn ${outcome === 'yes' ? 'btn-yes' : 'btn-no'}`} style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={resolve} disabled={loading}>
        {loading ? '...' : `Resolve ${outcome.toUpperCase()}`}
      </button>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={refund} disabled={loading}>Refund all</button>
      </div>
      {err && <div className="error-msg">{err}</div>}
      {msg && <div className="success-msg">{msg}</div>}
    </div>
  );
}

// ── Manager sidebar ────────────────────────────────────
function ManagerSidebar({ bet, betId }) {
  const [outcome, setOutcome] = useState('yes');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submitProposal() {
    setLoading(true); setErr(''); setMsg('');
    const res = await fetch('/api/manager', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ betId: parseInt(betId), outcome }) });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) return setErr(d.error);
    setMsg('Proposal submitted for admin review.');
  }

  if (bet.status !== 'open') return (
    <div className="card" style={{ borderColor: 'var(--border2)' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 8 }}>Manager</div>
      <div style={{ fontSize: '0.84rem', color: 'var(--text2)' }}>Market is closed.</div>
    </div>
  );

  return (
    <div className="card" style={{ borderColor: '#5a3e00' }}>
      <div style={{ fontSize: '0.68rem', color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 10 }}>Manager — propose resolution</div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: 12, lineHeight: 1.55 }}>Your proposal will be sent to admin for confirmation.</p>
      <div className="side-btns">
        <button className={`btn btn-yes${outcome === 'yes' ? ' active' : ''}`} onClick={() => setOutcome('yes')}>YES</button>
        <button className={`btn btn-no${outcome === 'no' ? ' active' : ''}`} onClick={() => setOutcome('no')}>NO</button>
      </div>
      <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', background: '#1f1200', color: '#d97706', border: '1px solid #78350f' }} onClick={submitProposal} disabled={loading}>
        {loading ? '...' : `Propose ${outcome.toUpperCase()}`}
      </button>
      {err && <div className="error-msg" style={{ marginTop: 8 }}>{err}</div>}
      {msg && <div className="success-msg" style={{ marginTop: 8 }}>{msg}</div>}
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
  // History of yesPct snapshots for chart
  const [probHistory, setProbHistory] = useState([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/bets/${params.id}`);
    const d = await res.json();
    if (d.bet) {
      setData(d);
      // Compute yesPct and add to history
      const total = (d.bet.total_yes || 0) + (d.bet.total_no || 0);
      const pct = total > 0 ? Math.round((d.bet.total_yes / total) * 100) : 50;
      setProbHistory(prev => {
        if (prev.length === 0) return [pct];
        if (prev[prev.length - 1] === pct) return prev;
        const next = [...prev, pct];
        return next.length > 200 ? next.slice(-200) : next;
      });

      if (session?.user?.email) {
        const meRes = await fetch('/api/user/me');
        const me = await meRes.json();
        if (me.user) setUserCredits(me.user.credits);
        if (me.positions) {
          const betPositions = me.positions.filter(p => p.bet_id === parseInt(params.id));
          if (betPositions.length > 0) {
            const yesTotal = betPositions.filter(p => p.side === 'yes').reduce((s, p) => s + parseInt(p.amount), 0);
            const noTotal = betPositions.filter(p => p.side === 'no').reduce((s, p) => s + parseInt(p.amount), 0);
            if (yesTotal > 0 || noTotal > 0) setMyPosition({ side: yesTotal >= noTotal ? 'yes' : 'no', amount: yesTotal + noTotal, yes_amount: yesTotal, no_amount: noTotal });
          }
        }
      }
    }
    setLoading(false);
  }, [session, params.id]);

  useEffect(() => {
    if (session !== undefined) {
      load();
      const iv = setInterval(load, 5000); // live refresh every 5s
      return () => clearInterval(iv);
    }
  }, [load]);

  async function placeBet() {
    const credits = parseInt(amount);
    if (!credits || credits < 1) return setErr('Enter a valid amount');
    setPlacing(true); setErr('');
    const res = await fetch(`/api/bets/${params.id}/place`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side, amount: credits }) });
    const d = await res.json();
    setPlacing(false);
    if (!res.ok) return setErr(d.error);
    setSuccess(`Placed ${credits} sl on ${side.toUpperCase()}`);
    setUserCredits(d.credits);
    setAmount('');
    load();
    setTimeout(() => setSuccess(''), 4000);
  }

  if (loading) return <><Navbar /><div className="loading"><span style={{ color: 'var(--yes)' }}>●</span> Loading market...</div></>;
  if (!data) return <><Navbar /><div className="page"><p style={{ color: 'var(--text2)' }}>Market not found or deleted.</p></div></>;

  const { bet, positions } = data;
  const total = (bet.total_yes || 0) + (bet.total_no || 0);
  const hasVotes = total > 0;
  const yesPct = hasVotes ? Math.round((bet.total_yes / total) * 100) : 50;
  const noPct = 100 - yesPct;
  const isAdmin = session?.user?.isAdmin;
  const isManager = session?.user?.isManager;

  return (
    <>
      <Navbar />
      <div className="page">
        <Link href="/" style={{ color: 'var(--text3)', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 24 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to markets
        </Link>

        <div className="two-col">
          {/* Left column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span className={`status-badge status-${bet.status}`}>{bet.status}</span>
              {bet.status === 'resolved' && bet.outcome && <span className={`outcome-badge outcome-${bet.outcome}`}>resolved {bet.outcome.toUpperCase()}</span>}
              {bet.status === 'refunded' && <span className="status-badge status-refunded">all bets refunded</span>}
              <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>by {bet.creator_name || 'anon'}</span>
            </div>

            <h1 className="market-title">{bet.title}</h1>
            {bet.description && <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 22, lineHeight: 1.65 }}>{bet.description}</p>}

            {/* Live chart — starts at 50% if no votes, jumps correctly with votes */}
            <YesNoChart history={probHistory.length > 0 ? probHistory : [yesPct]} />

            {/* Probability bar */}
            <div style={{ marginBottom: 22 }}>
              <div className="bar-container" style={{ height: 7, marginBottom: 10 }}>
                <div className="bar-yes" style={{ width: (hasVotes ? yesPct : 50) + '%' }} />
                <div className="bar-no" style={{ width: (hasVotes ? noPct : 50) + '%' }} />
              </div>
              <div className="bar-labels">
                <span className="yes-label">YES {hasVotes ? yesPct : 50}% · {bet.total_yes || 0} sl</span>
                <span className="total-pool">{total.toLocaleString()} sl total</span>
                <span className="no-label">{bet.total_no || 0} sl · {hasVotes ? noPct : 50}% NO</span>
              </div>
            </div>

            <div style={{ color: 'var(--text3)', fontSize: '0.8rem', marginBottom: 22 }}>
              {positions.length} participant{positions.length !== 1 ? 's' : ''}
            </div>

            {/* Positions list */}
            {positions.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 700 }}>Positions</div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  {positions.map((p, i) => {
                    let pnl = null;
                    if (bet.status === 'resolved' && bet.outcome) {
                      if (p.side === bet.outcome) {
                        const winnerPool = bet.outcome === 'yes' ? (bet.total_yes || 0) : (bet.total_no || 0);
                        const payout = winnerPool > 0 ? Math.round((p.amount / winnerPool) * total) : 0;
                        pnl = payout - p.amount;
                      } else { pnl = -p.amount; }
                    }
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: i < positions.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '0.88rem' }}>
                        <Link href={`/user/${encodeURIComponent(p.user_name)}`} style={{ color: 'var(--text)', fontWeight: 500 }}>{p.user_name}</Link>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span style={{ color: p.side === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 700 }}>{p.side.toUpperCase()}</span>
                          <span style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{p.amount} sl</span>
                          {bet.status === 'refunded'
                            ? <span style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>refunded</span>
                            : pnl !== null && <span style={{ color: pnl >= 0 ? 'var(--yes)' : 'var(--no)', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem' }}>{pnl >= 0 ? '+' : ''}{pnl} sl</span>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <CommentsSection betId={params.id} session={session} isAdmin={isAdmin} />
          </div>

          {/* Right sidebar */}
          <div className="sticky-sidebar">
            {isAdmin && <AdminSidebar bet={bet} onResolved={load} betId={params.id} />}
            {isManager && !isAdmin && <ManagerSidebar bet={bet} betId={params.id} />}

            {!isAdmin && myPosition && (
              <div className="card">
                <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, fontWeight: 700 }}>Your position</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {myPosition.yes_amount > 0 && (
                    <div style={{ flex: 1, padding: '8px 10px', background: 'var(--yes-dim)', border: '1px solid #166534', borderRadius: 'var(--radius)' }}>
                      <div style={{ color: 'var(--yes)', fontWeight: 700, fontSize: '0.84rem' }}>YES</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>{myPosition.yes_amount} sl</div>
                    </div>
                  )}
                  {myPosition.no_amount > 0 && (
                    <div style={{ flex: 1, padding: '8px 10px', background: 'var(--no-dim)', border: '1px solid #7f1d1d', borderRadius: 'var(--radius)' }}>
                      <div style={{ color: 'var(--no)', fontWeight: 700, fontSize: '0.84rem' }}>NO</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>{myPosition.no_amount} sl</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Buy widget */}
            {!isAdmin && bet.status === 'open' && session ? (
              <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <button onClick={() => setSide('yes')} style={{ padding: '12px', borderRadius: 'var(--radius)', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer', transition: 'all 0.15s', background: side === 'yes' ? 'var(--yes)' : 'var(--yes-dim)', color: side === 'yes' ? '#000' : 'var(--yes)', border: `1px solid ${side === 'yes' ? 'var(--yes)' : '#166534'}` }}>
                    Yes {hasVotes ? `${yesPct}¢` : '—'}
                  </button>
                  <button onClick={() => setSide('no')} style={{ padding: '12px', borderRadius: 'var(--radius)', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer', transition: 'all 0.15s', background: side === 'no' ? 'var(--no)' : 'var(--no-dim)', color: side === 'no' ? '#fff' : 'var(--no)', border: `1px solid ${side === 'no' ? 'var(--no)' : '#7f1d1d'}` }}>
                    No {hasVotes ? `${noPct}¢` : '—'}
                  </button>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>Amount</span>
                    {userCredits !== null && <span style={{ fontSize: '0.73rem', color: 'var(--text3)' }}>Bal: <strong style={{ color: 'var(--text2)' }}>{userCredits.toLocaleString()} sl</strong></span>}
                  </div>
                  <input type="number" min="1" max={userCredits || 100} placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && placeBet()} style={{ textAlign: 'right', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }} />
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                  {[1, 5, 10, 100].map(v => (
                    <button key={v} onClick={() => setAmount(a => String((parseInt(a) || 0) + v))} style={{ flex: 1, padding: '5px 0', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: '0.77rem', cursor: 'pointer', fontWeight: 500 }}>+{v}</button>
                  ))}
                  <button onClick={() => setAmount(String(userCredits || ''))} style={{ flex: 1, padding: '5px 0', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: '0.77rem', cursor: 'pointer', fontWeight: 500 }}>Max</button>
                </div>
                {err && <div className="error-msg" style={{ marginBottom: 10 }}>{err}</div>}
                {success && <div className="success-msg" style={{ marginBottom: 10 }}>{success}</div>}
                <button onClick={placeBet} disabled={placing} style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius)', fontWeight: 700, fontSize: '0.92rem', cursor: placing ? 'not-allowed' : 'pointer', background: side === 'yes' ? '#16a34a' : '#dc2626', border: 'none', color: '#fff', opacity: placing ? 0.5 : 1 }}>
                  {placing ? '...' : `Buy ${side.toUpperCase()}`}
                </button>
                <div style={{ marginTop: 10, fontSize: '0.68rem', color: 'var(--text3)', textAlign: 'center' }}>By trading, you agree to the Terms of Use.</div>
              </div>
            ) : bet.status !== 'open' ? (
              <div className="card">
                <div style={{ fontSize: '0.9rem', color: 'var(--text2)' }}>This market is closed.</div>
              </div>
            ) : null}

            <ProposalWidget betId={params.id} betStatus={bet.status} session={session} />
          </div>
        </div>
      </div>
    </>
  );
}
