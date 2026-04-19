import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: userRows } = await sql`SELECT id, is_admin FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0]?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { betId } = body;
  if (!betId) return NextResponse.json({ error: 'betId required' }, { status: 400 });

  const { rows: betRows } = await sql`SELECT * FROM bets WHERE id = ${betId} AND deleted_at IS NULL`;
  if (!betRows[0]) return NextResponse.json({ error: 'Bet not found' }, { status: 404 });

  await sql`UPDATE bets SET status = 'refunded', closed_at = NOW() WHERE id = ${betId}`;

  const { rows: positions } = await sql`SELECT * FROM bet_positions WHERE bet_id = ${betId}`;
  for (const p of positions) {
    await sql`UPDATE users SET credits = credits + ${p.amount} WHERE id = ${p.user_id}`;
  }

  return NextResponse.json({ ok: true, refunded: positions.length });
}
