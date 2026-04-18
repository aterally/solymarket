import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const betId = req.nextUrl.searchParams.get('betId');
  if (!betId) return NextResponse.json({ error: 'betId required' }, { status: 400 });

  const { rows } = await sql`
    SELECT c.id, c.content, c.parent_id, c.created_at, c.image_url,
           COALESCE(u.username, u.name) as author_name,
           COALESCE(u.custom_image, u.image) as author_image,
           u.id as user_id,
           (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as likes
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

  const { betId, content, parentId, imageUrl } = await req.json();
  if (!betId || (!content?.trim() && !imageUrl)) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (content?.trim().length > 1000) return NextResponse.json({ error: 'Too long' }, { status: 400 });

  const { rows: userRows } = await sql`
    SELECT id, username, name, is_banned, is_muted_comments, COALESCE(custom_image, image) as avatar
    FROM users WHERE email = ${session.user.email}
  `;
  if (!userRows[0] || userRows[0].is_banned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (userRows[0].is_muted_comments) return NextResponse.json({ error: 'You are muted from commenting' }, { status: 403 });

  const { rows } = await sql`
    INSERT INTO comments (bet_id, user_id, content, parent_id, image_url)
    VALUES (${betId}, ${userRows[0].id}, ${content?.trim() || ''}, ${parentId || null}, ${imageUrl || null})
    RETURNING id, content, parent_id, created_at, image_url
  `;

  const authorName = userRows[0].username || userRows[0].name;
  const result = { ...rows[0], author_name: authorName, author_image: userRows[0].avatar, likes: 0 };
  return NextResponse.json(result);
}

export async function DELETE(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { commentId } = await req.json();
  const { rows: userRows } = await sql`SELECT id, is_admin FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0]?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await sql`DELETE FROM comments WHERE id = ${commentId}`;
  return NextResponse.json({ ok: true });
}
