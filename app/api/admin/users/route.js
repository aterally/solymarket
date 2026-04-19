import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { rows: me } = await sql`SELECT is_admin FROM users WHERE email = ${session.user.email}`;
  if (!me[0]?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { rows } = await sql`
    SELECT id, COALESCE(username, name) as display_name, email, credits,
           is_admin, is_manager, is_banned, is_frozen, is_muted_comments, is_muted_markets, is_muted_proposing,
           created_at, COALESCE(custom_image, image) as avatar
    FROM users ORDER BY created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { rows: me } = await sql`SELECT is_admin FROM users WHERE email = ${session.user.email}`;
  if (!me[0]?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { userId, action, value } = body;
  if (!userId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const ALLOWED_ACTIONS = ['is_banned','is_frozen','is_muted_comments','is_muted_markets','is_muted_proposing','is_manager'];
  if (!ALLOWED_ACTIONS.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  // Use dynamic column — safe because we whitelist above
  if (action === 'is_banned') {
    await sql`UPDATE users SET is_banned = ${!!value} WHERE id = ${userId}`;
  } else if (action === 'is_frozen') {
    await sql`UPDATE users SET is_frozen = ${!!value} WHERE id = ${userId}`;
  } else if (action === 'is_muted_comments') {
    await sql`UPDATE users SET is_muted_comments = ${!!value} WHERE id = ${userId}`;
  } else if (action === 'is_muted_markets') {
    await sql`UPDATE users SET is_muted_markets = ${!!value} WHERE id = ${userId}`;
  } else if (action === 'is_muted_proposing') {
    await sql`UPDATE users SET is_muted_proposing = ${!!value} WHERE id = ${userId}`;
  } else if (action === 'is_manager') {
    await sql`UPDATE users SET is_manager = ${!!value} WHERE id = ${userId}`;
  }

  return NextResponse.json({ ok: true });
}
