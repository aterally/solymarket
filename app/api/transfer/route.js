import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '../../../lib/rateLimit';
import { sanitizeText, sanitizeInt } from '../../../lib/sanitize';

export async function POST(req) {
  const ip = getIP(req);
  const rl = rateLimit(`transfer:${ip}`, { max: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many transfers. Please slow down.' }, { status: 429 });

  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const toUsername = sanitizeText(body.toUsername, 64);
  const n = sanitizeInt(body.amount, 1, 100_000);
  if (!n) return NextResponse.json({ error: 'Invalid amount (1–100,000)' }, { status: 400 });
  if (!toUsername) return NextResponse.json({ error: 'Recipient required' }, { status: 400 });

  const { rows: fromRows } = await sql`SELECT id, credits, is_banned FROM users WHERE email = ${session.user.email}`;
  if (!fromRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (fromRows[0].is_banned) return NextResponse.json({ error: 'Account banned' }, { status: 403 });
  if (fromRows[0].credits < n) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });

  const { rows: toRows } = await sql`
    SELECT id FROM users WHERE username = ${toUsername} OR (username IS NULL AND name = ${toUsername})
  `;
  if (!toRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (toRows[0].id === fromRows[0].id) return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 });

  await sql`UPDATE users SET credits = credits - ${n} WHERE id = ${fromRows[0].id}`;
  await sql`UPDATE users SET credits = credits + ${n} WHERE id = ${toRows[0].id}`;

  const { rows: updated } = await sql`SELECT credits FROM users WHERE id = ${fromRows[0].id}`;
  return NextResponse.json({ ok: true, newBalance: updated[0].credits });
}
