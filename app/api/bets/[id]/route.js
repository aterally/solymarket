import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { id } = params;
  // Validate id is numeric
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const { rows: betRows } = await sql`
      SELECT b.*, COALESCE(u.username, u.name) as creator_name
      FROM bets b LEFT JOIN users u ON b.creator_id = u.id
      WHERE b.id = ${id} AND b.deleted_at IS NULL
    `;
    if (!betRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { rows: positions } = await sql`
      SELECT bp.side, SUM(bp.amount) as amount, COALESCE(u.username, u.name) as user_name, u.id as user_id
      FROM bet_positions bp JOIN users u ON bp.user_id = u.id
      WHERE bp.bet_id = ${id}
      GROUP BY bp.side, u.id, COALESCE(u.username, u.name)
      ORDER BY SUM(bp.amount) DESC
    `;

    return NextResponse.json({ bet: betRows[0], positions });
  } catch (err) {
    console.error('[GET /api/bets/[id]]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
