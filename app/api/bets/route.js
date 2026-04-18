// app/api/bets/route.js
import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT b.*, u.name as creator_name,
        (SELECT COUNT(*) FROM bet_positions WHERE bet_id = b.id) as participant_count
      FROM bets b
      LEFT JOIN users u ON b.creator_id = u.id
      ORDER BY b.created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title, description } = await req.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title required' }, { status: 400 });
  }

  const { rows: userRows } = await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { rows } = await sql`
    INSERT INTO bets (title, description, creator_id, status)
    VALUES (${title.trim()}, ${description?.trim() || null}, ${userRows[0].id}, 'open')
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
