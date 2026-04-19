import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '@/lib/rateLimit';
import { sanitizeText, sanitizeInt } from '@/lib/sanitize';

export async function GET(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: me } = await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
  if (!me[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows } = await sql`
    SELECT cr.*,
      COALESCE(fu.username, fu.name) as from_name,
      COALESCE(tu.username, tu.name) as to_name,
      COALESCE(fu.custom_image, fu.image) as from_image,
      COALESCE(tu.custom_image, tu.image) as to_image
    FROM credit_requests cr
    JOIN users fu ON cr.from_user_id = fu.id
    JOIN users tu ON cr.to_user_id = tu.id
    WHERE (cr.from_user_id = ${me[0].id} OR cr.to_user_id = ${me[0].id})
      AND cr.status = 'pending'
    ORDER BY cr.created_at DESC
  `;
  return NextResponse.json({ requests: rows, myId: me[0].id });
}

export async function POST(req) {
  const ip = getIP(req);
  const rl = rateLimit(`credits:${ip}`, { max: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action } = body;
  const { rows: me } = await sql`SELECT id, credits FROM users WHERE email = ${session.user.email}`;
  if (!me[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'send' || action === 'request') {
    const toUsername = sanitizeText(body.toUsername, 64);
    const n = sanitizeInt(body.amount, 1, 100_000);
    if (!n) return NextResponse.json({ error: 'Invalid amount (1–100,000)' }, { status: 400 });
    if (!toUsername) return NextResponse.json({ error: 'Invalid username' }, { status: 400 });

    const { rows: other } = await sql`SELECT id FROM users WHERE username = ${toUsername} OR (username IS NULL AND name = ${toUsername})`;
    if (!other[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (other[0].id === me[0].id) return NextResponse.json({ error: 'Cannot send to yourself' }, { status: 400 });

    if (action === 'send') {
      if (me[0].credits < n) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    const note = sanitizeText(body.note || '', 200);
    await sql`
      INSERT INTO credit_requests (from_user_id, to_user_id, amount, type, note)
      VALUES (${me[0].id}, ${other[0].id}, ${n}, ${action}, ${note || null})
    `;
    return NextResponse.json({ ok: true });
  }

  if (action === 'accept' || action === 'decline') {
    const requestId = sanitizeInt(body.requestId, 1);
    if (!requestId) return NextResponse.json({ error: 'Invalid requestId' }, { status: 400 });

    const { rows: req2 } = await sql`SELECT * FROM credit_requests WHERE id = ${requestId} AND status = 'pending'`;
    if (!req2[0]) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    const r = req2[0];

    if (r.to_user_id !== me[0].id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (action === 'decline') {
      await sql`UPDATE credit_requests SET status = 'declined' WHERE id = ${requestId}`;
      return NextResponse.json({ ok: true, message: 'Offer Declined' });
    }

    // Accept
    if (r.type === 'send') {
      const { rows: sender } = await sql`SELECT credits FROM users WHERE id = ${r.from_user_id}`;
      if (sender[0].credits < r.amount) return NextResponse.json({ error: 'Sender has insufficient balance' }, { status: 400 });
      await sql`UPDATE users SET credits = credits - ${r.amount} WHERE id = ${r.from_user_id}`;
      await sql`UPDATE users SET credits = credits + ${r.amount} WHERE id = ${r.to_user_id}`;
    } else {
      // Request: me pays from_user
      const { rows: fresh } = await sql`SELECT credits FROM users WHERE id = ${me[0].id}`;
      if (fresh[0].credits < r.amount) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
      await sql`UPDATE users SET credits = credits - ${r.amount} WHERE id = ${r.to_user_id}`;
      await sql`UPDATE users SET credits = credits + ${r.amount} WHERE id = ${r.from_user_id}`;
    }

    await sql`UPDATE credit_requests SET status = 'accepted' WHERE id = ${requestId}`;
    return NextResponse.json({ ok: true, message: 'Offer Accepted' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
