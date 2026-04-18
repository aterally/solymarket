import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { commentId } = await req.json();
  if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 });

  const { rows: userRows } = await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Toggle like
  const { rows: existing } = await sql`
    SELECT id FROM comment_likes WHERE comment_id = ${commentId} AND user_id = ${userRows[0].id}
  `;

  if (existing.length > 0) {
    await sql`DELETE FROM comment_likes WHERE comment_id = ${commentId} AND user_id = ${userRows[0].id}`;
  } else {
    await sql`INSERT INTO comment_likes (comment_id, user_id) VALUES (${commentId}, ${userRows[0].id})`;
  }

  const { rows: countRows } = await sql`SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ${commentId}`;
  return NextResponse.json({ liked: existing.length === 0, count: parseInt(countRows[0].count) });
}
