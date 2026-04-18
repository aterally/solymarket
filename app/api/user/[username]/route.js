import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { username } = params;

  try {
    // Find user by username or name
    const { rows: userRows } = await sql`
      SELECT id, COALESCE(username, name) as display_name, username, name, image, credits, created_at
      FROM users
      WHERE (username = ${username} OR (username IS NULL AND name = ${username}))
        AND is_banned = FALSE
    `;
    if (!userRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const user = userRows[0];

    // Get their public bet history
    const { rows: positions } = await sql`
      SELECT bp.side, bp.amount, bp.created_at,
             b.id as bet_id, b.title, b.status, b.outcome
      FROM bet_positions bp
      JOIN bets b ON bp.bet_id = b.id
      WHERE bp.user_id = ${user.id}
      ORDER BY bp.created_at DESC
    `;

    // Leaderboard rank
    const { rows: rankRows } = await sql`
      SELECT COUNT(*) + 1 as rank
      FROM users
      WHERE credits > ${user.credits} AND is_banned = FALSE
    `;

    return NextResponse.json({ user, positions, rank: parseInt(rankRows[0]?.rank || 1) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
