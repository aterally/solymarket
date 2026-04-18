import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

async function requireAdmin(session) {
  if (!session?.user?.email) return false;
  const { rows } = await sql`SELECT is_admin FROM users WHERE email = ${session.user.email}`;
  return rows[0]?.is_admin === true;
}

export async function POST(req) {
  const session = await getServerSession();
  if (!await requireAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { betId } = await req.json();
  if (!betId) return NextResponse.json({ error: 'betId required' }, { status: 400 });

  // Check market is not open (only allow deleting closed/resolved/refunded)
  const { rows: betRows } = await sql`SELECT status FROM bets WHERE id = ${betId}`;
  if (!betRows[0]) return NextResponse.json({ error: 'Market not found' }, { status: 404 });

  // Delete positions first (FK constraint), then the bet
  await sql`DELETE FROM bet_positions WHERE bet_id = ${betId}`;
  await sql`DELETE FROM bets WHERE id = ${betId}`;

  return NextResponse.json({ ok: true });
}
