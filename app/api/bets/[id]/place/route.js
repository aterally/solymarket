import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '../../../../../lib/rateLimit';

export async function POST(req, { params }) {
  const ip = getIP(req);
  const rl = rateLimit(`place-bet:${ip}`, { max: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });

  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { side, amount } = body;
  const betId = parseInt(params.id);
  const credits = parseInt(amount);

  if (isNaN(betId)) return NextResponse.json({ error: 'Invalid bet id' }, { status: 400 });
  if (!['yes', 'no'].includes(side)) return NextResponse.json({ error: 'Side must be yes or no' }, { status: 400 });
  if (!credits || credits < 1 || credits > 1_000_000) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

  const { rows: userRows } = await sql`SELECT * FROM users WHERE email = ${session.user.email}`;
  const user = userRows[0];
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.is_banned) return NextResponse.json({ error: 'Account banned' }, { status: 403 });
  if (user.is_frozen) return NextResponse.json({ error: 'Your betting is frozen' }, { status: 403 });
  if (user.credits < credits) return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 });

  const { rows: betRows } = await sql`SELECT * FROM bets WHERE id = ${betId} AND deleted_at IS NULL`;
  const bet = betRows[0];
  if (!bet) return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
  if (bet.status !== 'open') return NextResponse.json({ error: 'Bet is not open' }, { status: 400 });

  await sql`UPDATE users SET credits = credits - ${credits} WHERE id = ${user.id}`;
  await sql`INSERT INTO bet_positions (bet_id, user_id, side, amount) VALUES (${betId}, ${user.id}, ${side}, ${credits})`;

  if (side === 'yes') {
    await sql`UPDATE bets SET total_yes = COALESCE(total_yes,0) + ${credits} WHERE id = ${betId}`;
  } else {
    await sql`UPDATE bets SET total_no = COALESCE(total_no,0) + ${credits} WHERE id = ${betId}`;
  }

  const { rows: updatedUser } = await sql`SELECT credits FROM users WHERE id = ${user.id}`;
  return NextResponse.json({ ok: true, credits: updatedUser[0].credits });
}
