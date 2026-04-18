import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: me } = await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
  if (!me[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const withUser = req.nextUrl.searchParams.get('with');

  if (withUser) {
    // Get conversation with a specific user
    const { rows: other } = await sql`SELECT id FROM users WHERE username = ${withUser} OR (username IS NULL AND name = ${withUser})`;
    if (!other[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { rows } = await sql`
      SELECT d.id, d.content, d.created_at,
             COALESCE(u.username, u.name) as sender_name,
             COALESCE(u.custom_image, u.image) as sender_image,
             u.id as sender_id
      FROM dms d JOIN users u ON d.from_user_id = u.id
      WHERE (d.from_user_id = ${me[0].id} AND d.to_user_id = ${other[0].id})
         OR (d.from_user_id = ${other[0].id} AND d.to_user_id = ${me[0].id})
      ORDER BY d.created_at ASC
    `;
    return NextResponse.json(rows);
  }

  // Get list of all conversations (latest message per user)
  const { rows } = await sql`
    SELECT DISTINCT ON (partner_id)
      partner_id,
      partner_name,
      partner_image,
      content,
      created_at,
      is_me
    FROM (
      SELECT 
        d.to_user_id as partner_id,
        COALESCE(u.username, u.name) as partner_name,
        COALESCE(u.custom_image, u.image) as partner_image,
        d.content,
        d.created_at,
        true as is_me
      FROM dms d JOIN users u ON d.to_user_id = u.id
      WHERE d.from_user_id = ${me[0].id}
      UNION ALL
      SELECT
        d.from_user_id as partner_id,
        COALESCE(u.username, u.name) as partner_name,
        COALESCE(u.custom_image, u.image) as partner_image,
        d.content,
        d.created_at,
        false as is_me
      FROM dms d JOIN users u ON d.from_user_id = u.id
      WHERE d.to_user_id = ${me[0].id}
    ) convos
    ORDER BY partner_id, created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { toUsername, content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });

  const { rows: me } = await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
  const { rows: other } = await sql`SELECT id FROM users WHERE username = ${toUsername} OR (username IS NULL AND name = ${toUsername})`;
  if (!me[0] || !other[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (me[0].id === other[0].id) return NextResponse.json({ error: 'Cannot DM yourself' }, { status: 400 });

  const { rows } = await sql`
    INSERT INTO dms (from_user_id, to_user_id, content)
    VALUES (${me[0].id}, ${other[0].id}, ${content.trim()})
    RETURNING id, content, created_at
  `;

  const { rows: meUser } = await sql`SELECT COALESCE(username, name) as name, COALESCE(custom_image, image) as image FROM users WHERE id = ${me[0].id}`;
  return NextResponse.json({ ...rows[0], sender_name: meUser[0].name, sender_image: meUser[0].image, sender_id: me[0].id });
}
