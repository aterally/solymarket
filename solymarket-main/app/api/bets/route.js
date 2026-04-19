import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '@/lib/rateLimit';
import { sanitizeText } from '@/lib/sanitize';

export async function GET(req) {
  try {
    // Compute live totals from bet_positions (source of truth).
    // Fall back to bets.total_yes / total_no when no positions exist yet
    // (preserves data for markets created before bet_positions tracking).
    const { rows } = await sql`
      SELECT
        b.*,
        COALESCE(u.username, u.name) as creator_name,
        COUNT(DISTINCT bp.user_id) as participant_count,
        CASE
          WHEN COALESCE(SUM(CASE WHEN bp.side = 'yes' THEN bp.amount END), 0) > 0
            OR COALESCE(SUM(CASE WHEN bp.side = 'no'  THEN bp.amount END), 0) > 0
          THEN COALESCE(SUM(CASE WHEN bp.side = 'yes' THEN bp.amount END), 0)
          ELSE b.total_yes
        END as total_yes,
        CASE
          WHEN COALESCE(SUM(CASE WHEN bp.side = 'yes' THEN bp.amount END), 0) > 0
            OR COALESCE(SUM(CASE WHEN bp.side = 'no'  THEN bp.amount END), 0) > 0
          THEN COALESCE(SUM(CASE WHEN bp.side = 'no'  THEN bp.amount END), 0)
          ELSE b.total_no
        END as total_no
      FROM bets b
      LEFT JOIN users u ON b.creator_id = u.id
      LEFT JOIN bet_positions bp ON bp.bet_id = b.id
      WHERE b.deleted_at IS NULL
      GROUP BY b.id, u.username, u.name
      ORDER BY b.created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[GET /api/bets]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req) {
  const ip = getIP(req);
  const rl = rateLimit(`create-bet:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });

  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const title = sanitizeText(body.title, 200);
  const description = sanitizeText(body.description, 1000);
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const { rows: userRows } = await sql`SELECT id, is_banned, is_muted_markets FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (userRows[0].is_banned) return NextResponse.json({ error: 'Account banned' }, { status: 403 });
  if (userRows[0].is_muted_markets) return NextResponse.json({ error: 'You are not allowed to create markets' }, { status: 403 });

  const { rows } = await sql`
    INSERT INTO bets (title, description, creator_id, status)
    VALUES (${title}, ${description || null}, ${userRows[0].id}, 'open')
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
