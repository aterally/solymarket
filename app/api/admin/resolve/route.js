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

  const { betId, outcome } = body;
  if (!betId || !['yes', 'no'].includes(outcome)) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const { rows: betRows } = await sql`SELECT * FROM bets WHERE id = ${betId} AND deleted_at IS NULL`;
  if (!betRows[0] || betRows[0].status !== 'open') return NextResponse.json({ error: 'Bet not open' }, { status: 400 });

  await sql`UPDATE bets SET status = 'resolved', outcome = ${outcome}, closed_at = NOW() WHERE id = ${betId}`;

  const bet = betRows[0];
  const total = (bet.total_yes || 0) + (bet.total_no || 0);
  const winnerPool = outcome === 'yes' ? (bet.total_yes || 0) : (bet.total_no || 0);
  if (winnerPool > 0) {
    const { rows: winners } = await sql`SELECT * FROM bet_positions WHERE bet_id = ${betId} AND side = ${outcome}`;
    for (const w of winners) {
      const payout = Math.round((w.amount / winnerPool) * total);
      await sql`UPDATE users SET credits = credits + ${payout} WHERE id = ${w.user_id}`;
    }
  }

  return NextResponse.json({ ok: true });
}
