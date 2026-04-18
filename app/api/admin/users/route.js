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
           credits, is_admin, is_manager, is_banned, is_muted_comments, is_muted_proposing,
           is_muted_markets, is_frozen, last_ip, banned_ips, created_at
    FROM users ORDER BY credits DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const session = await getServerSession();
  if (!await requireAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { action, userId, amount } = body;

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

  if (action === 'mute_comments') {
    await sql`UPDATE users SET is_muted_comments = TRUE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'unmute_comments') {
    await sql`UPDATE users SET is_muted_comments = FALSE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'mute_proposing') {
    await sql`UPDATE users SET is_muted_proposing = TRUE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'unmute_proposing') {
    await sql`UPDATE users SET is_muted_proposing = FALSE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'mute_markets') {
    await sql`UPDATE users SET is_muted_markets = TRUE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'unmute_markets') {
    await sql`UPDATE users SET is_muted_markets = FALSE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'freeze') {
    await sql`UPDATE users SET is_frozen = TRUE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'unfreeze') {
    await sql`UPDATE users SET is_frozen = FALSE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'ban_ip') {
    const { ip } = body;
    if (!ip) return NextResponse.json({ error: 'IP required' }, { status: 400 });
    await sql`UPDATE users SET banned_ips = array_append(COALESCE(banned_ips, '{}'), ${ip}) WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'make_admin') {
    await sql`UPDATE users SET is_admin = TRUE, is_manager = FALSE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'revoke_admin') {
    await sql`UPDATE users SET is_admin = FALSE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'make_manager') {
    await sql`UPDATE users SET is_manager = TRUE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'revoke_manager') {
    await sql`UPDATE users SET is_manager = FALSE WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete_comment') {
    const { commentId } = body;
    await sql`DELETE FROM comments WHERE id = ${commentId}`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
