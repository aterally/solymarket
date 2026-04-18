import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: userRows } = await sql`SELECT is_admin FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0]?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { betId } = await req.json();
  const { rows: betRows } = await sql`SELECT * FROM bets WHERE id = ${betId}`;
  const bet = betRows[0];
  if (!bet) return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
  if (bet.status !== 'open') return NextResponse.json({ error: 'Bet already closed' }, { status: 400 });

  const { rows: positions } = await sql`SELECT * FROM bet_positions WHERE bet_id = ${betId}`;

  for (const pos of positions) {
    await sql`UPDATE users SET credits = credits + ${pos.amount} WHERE id = ${pos.user_id}`;
  }

  await sql`UPDATE bets SET status = 'refunded', closed_at = NOW() WHERE id = ${betId}`;

  return NextResponse.json({ ok: true, refunded: positions.length });
}
