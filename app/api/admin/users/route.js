import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

async function requireAdmin(session) {
  if (!session?.user?.email) return false;
  const { rows } = await sql`SELECT is_admin FROM users WHERE email = ${session.user.email}`;
  return rows[0]?.is_admin === true;
}

export async function GET(req) {
  const session = await getServerSession();
  if (!await requireAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = req.nextUrl.searchParams.get('userId');
  const createdBy = req.nextUrl.searchParams.get('createdBy');

  if (createdBy) {
    const { rows } = await sql`
      SELECT id, title, status, outcome, created_at,
             (SELECT COUNT(*) FROM bet_positions WHERE bet_id = bets.id) as participant_count
      FROM bets WHERE creator_id = ${createdBy} ORDER BY created_at DESC
    `;
    return NextResponse.json(rows);
  }

  if (userId) {
    const { rows } = await sql`
      SELECT bp.id, bp.side, bp.amount, bp.created_at,
             b.id as bet_id, b.title, b.status, b.outcome
      FROM bet_positions bp
      JOIN bets b ON bp.bet_id = b.id
      WHERE bp.user_id = ${userId}
      ORDER BY bp.created_at DESC
    `;
    return NextResponse.json(rows);
  }

  const { rows } = await sql`
    SELECT id, email, COALESCE(username, name) as display_name, name, username,
           credits, is_admin, is_banned, last_ip, created_at
    FROM users ORDER BY credits DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const session = await getServerSession();
  if (!await requireAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { action, userId, amount } = await req.json();

  if (action === 'adjust_credits') {
    const delta = parseInt(amount);
    if (isNaN(delta)) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    const { rows } = await sql`
      UPDATE users SET credits = GREATEST(0, credits + ${delta}) WHERE id = ${userId} RETURNING credits
    `;
    return NextResponse.json({ ok: true, credits: rows[0]?.credits });
  }

  if (action === 'ban') {
    await sql`UPDATE users SET is_banned = TRUE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'unban') {
    await sql`UPDATE users SET is_banned = FALSE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
