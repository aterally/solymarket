// app/api/admin/resolve/route.js
import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rows: userRows } = await sql`SELECT * FROM users WHERE email = ${session.user.email}`;
  const user = userRows[0];
  if (!user?.is_admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { betId, outcome } = await req.json();
  if (!['yes', 'no'].includes(outcome)) {
    return NextResponse.json({ error: 'Outcome must be yes or no' }, { status: 400 });
  }

  const { rows: betRows } = await sql`SELECT * FROM bets WHERE id = ${betId}`;
  const bet = betRows[0];
  if (!bet) return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
  if (bet.status !== 'open') return NextResponse.json({ error: 'Bet already resolved' }, { status: 400 });

  // Get all positions
  const { rows: positions } = await sql`SELECT * FROM bet_positions WHERE bet_id = ${betId}`;

  const winners = positions.filter(p => p.side === outcome);
  const losers = positions.filter(p => p.side !== outcome);

  const totalWinnerStake = winners.reduce((s, p) => s + p.amount, 0);
  const totalLoserStake = losers.reduce((s, p) => s + p.amount, 0);
  const totalPool = totalWinnerStake + totalLoserStake;

  // Pay out winners proportionally
  for (const pos of winners) {
    let payout;
    if (totalWinnerStake === 0) {
      payout = pos.amount; // refund if no contest
    } else {
      // Winner gets their stake back + proportional share of loser pool
      payout = pos.amount + Math.floor((pos.amount / totalWinnerStake) * totalLoserStake);
    }
    await sql`UPDATE users SET credits = credits + ${payout} WHERE id = ${pos.user_id}`;
  }

  // If no winners, refund everyone
  if (winners.length === 0) {
    for (const pos of positions) {
      await sql`UPDATE users SET credits = credits + ${pos.amount} WHERE id = ${pos.user_id}`;
    }
  }

  // Mark bet as resolved
  await sql`
    UPDATE bets SET status = 'resolved', outcome = ${outcome}, closed_at = NOW()
    WHERE id = ${betId}
  `;

  return NextResponse.json({ ok: true, winnersCount: winners.length, totalPool });
}
