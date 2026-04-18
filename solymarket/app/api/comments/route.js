import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const betId = req.nextUrl.searchParams.get('betId');
  if (!betId) return NextResponse.json({ error: 'betId required' }, { status: 400 });

  const { rows } = await sql`
    SELECT c.id, c.content, c.parent_id, c.created_at,
           COALESCE(u.username, u.name) as author_name,
           u.image as author_image,
           (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as likes,
           u.id as user_id
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.bet_id = ${betId}
    ORDER BY c.created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { betId, content, parentId } = await req.json();
  if (!betId || !content?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (content.trim().length > 1000) return NextResponse.json({ error: 'Too long' }, { status: 400 });

  const { rows: userRows } = await sql`SELECT id, is_banned FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0] || userRows[0].is_banned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await sql`
    INSERT INTO comments (bet_id, user_id, content, parent_id)
    VALUES (${betId}, ${userRows[0].id}, ${content.trim()}, ${parentId || null})
    RETURNING id, content, parent_id, created_at
  `;

  const result = { ...rows[0], author_name: session.user.username || session.user.name, author_image: session.user.image, likes: 0 };
  return NextResponse.json(result);
}
