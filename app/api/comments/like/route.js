import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '@/lib/rateLimit';

export async function POST(req) {
  const ip = getIP(req);
  const rl = rateLimit(`like:${ip}`, { max: 60, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const commentId = parseInt(body.commentId);
  if (!commentId) return NextResponse.json({ error: 'Invalid commentId' }, { status: 400 });

  const { rows: userRows } = await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const userId = userRows[0].id;

  const { rows: existing } = await sql`SELECT id FROM comment_likes WHERE comment_id = ${commentId} AND user_id = ${userId}`;

  let liked;
  if (existing[0]) {
    await sql`DELETE FROM comment_likes WHERE comment_id = ${commentId} AND user_id = ${userId}`;
    liked = false;
  } else {
    await sql`INSERT INTO comment_likes (comment_id, user_id) VALUES (${commentId}, ${userId}) ON CONFLICT DO NOTHING`;
    liked = true;
  }

  const { rows: countRows } = await sql`SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ${commentId}`;
  return NextResponse.json({ liked, count: parseInt(countRows[0].count) });
}
