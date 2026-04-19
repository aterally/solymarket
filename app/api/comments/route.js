import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '../../../../lib/rateLimit';
import { sanitizeText } from '../../../../lib/sanitize';

export async function GET(req) {
  const betId = req.nextUrl.searchParams.get('betId');
  if (!betId || !/^\d+$/.test(betId)) return NextResponse.json({ error: 'betId required' }, { status: 400 });

  try {
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
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req) {
  const ip = getIP(req);
  const rl = rateLimit(`comment:${ip}`, { max: 15, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many comments. Please slow down.' }, { status: 429 });

  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { betId, parentId, imageUrl } = body;
  const content = sanitizeText(body.content, 1000);
  if (!betId || (!content && !imageUrl)) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const { rows: userRows } = await sql`
    SELECT id, username, name, is_banned, is_muted_comments, COALESCE(custom_image, image) as avatar
    FROM users WHERE email = ${session.user.email}
  `;
  if (!userRows[0] || userRows[0].is_banned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (userRows[0].is_muted_comments) return NextResponse.json({ error: 'You are muted from commenting' }, { status: 403 });

  const { rows } = await sql`
    INSERT INTO comments (bet_id, user_id, content, parent_id, image_url)
    VALUES (${betId}, ${userRows[0].id}, ${content || ''}, ${parentId || null}, ${imageUrl || null})
    RETURNING id, content, parent_id, created_at, image_url
  `;

  const authorName = userRows[0].username || userRows[0].name;
  return NextResponse.json({ ...rows[0], author_name: authorName, author_image: userRows[0].avatar, likes: 0 });
}

export async function DELETE(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const commentId = parseInt(body.commentId);
  if (!commentId) return NextResponse.json({ error: 'Invalid commentId' }, { status: 400 });

  const { rows: userRows } = await sql`SELECT id, is_admin FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0]?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await sql`DELETE FROM comments WHERE id = ${commentId}`;
  return NextResponse.json({ ok: true });
}
