import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '@/lib/rateLimit';

export async function POST(req) {
  const ip = getIP(req);
  const rl = rateLimit(`manager:${ip}`, { max: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: userRows } = await sql`SELECT id, is_manager, is_admin FROM users WHERE email = ${session.user.email}`;
  const user = userRows[0];
  if (!user || (!user.is_manager && !user.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { betId, outcome, action } = body;

  if (user.is_admin && action === 'confirm') {
    const propId = parseInt(betId);
    if (!propId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const { rows: propRows } = await sql`SELECT * FROM manager_proposals WHERE id = ${propId}`;
    if (!propRows[0]) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    const prop = propRows[0];

    const { rows: betRows } = await sql`SELECT * FROM bets WHERE id = ${prop.bet_id} AND deleted_at IS NULL`;
    if (!betRows[0] || betRows[0].status !== 'open') return NextResponse.json({ error: 'Bet not open' }, { status: 400 });

    await sql`UPDATE bets SET status = 'resolved', outcome = ${prop.proposed_outcome}, closed_at = NOW() WHERE id = ${prop.bet_id}`;

    const bet = betRows[0];
    const total = (bet.total_yes || 0) + (bet.total_no || 0);
    const winnerPool = prop.proposed_outcome === 'yes' ? (bet.total_yes || 0) : (bet.total_no || 0);
    if (winnerPool > 0) {
      const { rows: winners } = await sql`SELECT * FROM bet_positions WHERE bet_id = ${prop.bet_id} AND side = ${prop.proposed_outcome}`;
      for (const w of winners) {
        const payout = Math.round((w.amount / winnerPool) * total);
        await sql`UPDATE users SET credits = credits + ${payout} WHERE id = ${w.user_id}`;
      }
    }
    await sql`UPDATE manager_proposals SET status = 'confirmed' WHERE id = ${propId}`;
    return NextResponse.json({ ok: true });
  }

  if (user.is_admin && action === 'reject') {
    const propId = parseInt(betId);
    if (!propId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    await sql`UPDATE manager_proposals SET status = 'rejected' WHERE id = ${propId}`;
    return NextResponse.json({ ok: true });
  }

  if (user.is_manager) {
    if (!['yes', 'no'].includes(outcome)) return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
    const bid = parseInt(betId);
    if (!bid) return NextResponse.json({ error: 'Invalid betId' }, { status: 400 });
    const { rows } = await sql`
      INSERT INTO manager_proposals (bet_id, manager_id, proposed_outcome)
      VALUES (${bid}, ${user.id}, ${outcome})
      RETURNING *
    `;
    return NextResponse.json({ ok: true, proposal: rows[0] });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function GET(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: userRows } = await sql`SELECT id, is_admin FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0]?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await sql`
    SELECT mp.*, b.title as bet_title, COALESCE(u.username, u.name) as manager_name
    FROM manager_proposals mp
    JOIN bets b ON mp.bet_id = b.id
    JOIN users u ON mp.manager_id = u.id
    WHERE mp.status = 'pending'
    ORDER BY mp.created_at DESC
  `;
  return NextResponse.json(rows);
}
