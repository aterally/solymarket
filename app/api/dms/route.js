import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '../../../lib/rateLimit';
import { sanitizeText } from '../../../lib/sanitize';

export async function GET(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: me } = await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
  if (!me[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const myId = me[0].id;

  const withUser = req.nextUrl.searchParams.get('with');

  if (withUser) {
    // Validate user exists
    const { rows: other } = await sql`
      SELECT id FROM users WHERE username = ${withUser} OR (username IS NULL AND name = ${withUser})
    `;
    if (!other[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const otherId = other[0].id;

    const { rows: msgs } = await sql`
      SELECT dm.id, dm.content, dm.created_at,
        COALESCE(su.username, su.name) as sender_name,
        COALESCE(su.custom_image, su.image) as sender_image
      FROM direct_messages dm
      JOIN users su ON dm.sender_id = su.id
      WHERE (dm.sender_id = ${myId} AND dm.recipient_id = ${otherId})
         OR (dm.sender_id = ${otherId} AND dm.recipient_id = ${myId})
      ORDER BY dm.created_at ASC
    `;
    return NextResponse.json(msgs);
  }

  // Return conversation list
  const { rows: convos } = await sql`
    SELECT DISTINCT ON (partner_id)
      partner_id,
      partner_name,
      partner_image,
      content,
      created_at
    FROM (
      SELECT
        CASE WHEN dm.sender_id = ${myId} THEN dm.recipient_id ELSE dm.sender_id END as partner_id,
        CASE WHEN dm.sender_id = ${myId} THEN COALESCE(ru.username, ru.name) ELSE COALESCE(su.username, su.name) END as partner_name,
        CASE WHEN dm.sender_id = ${myId} THEN COALESCE(ru.custom_image, ru.image) ELSE COALESCE(su.custom_image, su.image) END as partner_image,
        dm.content,
        dm.created_at
      FROM direct_messages dm
      JOIN users su ON dm.sender_id = su.id
      JOIN users ru ON dm.recipient_id = ru.id
      WHERE dm.sender_id = ${myId} OR dm.recipient_id = ${myId}
      ORDER BY dm.created_at DESC
    ) sub
    ORDER BY partner_id, created_at DESC
  `;
  return NextResponse.json(convos);
}

export async function POST(req) {
  const ip = getIP(req);
  const rl = rateLimit(`dm:${ip}`, { max: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many messages. Slow down.' }, { status: 429 });

  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const content = sanitizeText(body.content, 2000);
  const toUsername = sanitizeText(body.toUsername, 64);
  if (!content || !toUsername) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const { rows: me } = await sql`
    SELECT id, is_banned FROM users WHERE email = ${session.user.email}
  `;
  if (!me[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (me[0].is_banned) return NextResponse.json({ error: 'Account banned' }, { status: 403 });

  const { rows: other } = await sql`
    SELECT id FROM users WHERE username = ${toUsername} OR (username IS NULL AND name = ${toUsername})
  `;
  if (!other[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (other[0].id === me[0].id) return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });

  const { rows } = await sql`
    INSERT INTO direct_messages (sender_id, recipient_id, content)
    VALUES (${me[0].id}, ${other[0].id}, ${content})
    RETURNING id, content, created_at
  `;

  const { rows: senderInfo } = await sql`
    SELECT COALESCE(username, name) as sender_name, COALESCE(custom_image, image) as sender_image
    FROM users WHERE id = ${me[0].id}
  `;

  return NextResponse.json({
    ...rows[0],
    sender_name: senderInfo[0].sender_name,
    sender_image: senderInfo[0].sender_image,
  });
}
