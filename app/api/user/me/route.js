import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows } = await sql`
    SELECT id, COALESCE(username, name) as username, name, email, credits,
           COALESCE(custom_image, image) as image,
           is_admin, is_manager, is_banned, is_frozen,
           is_muted_comments, is_muted_markets, is_muted_proposing
    FROM users WHERE email = ${session.user.email}
  `;
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows: positions } = await sql`
    SELECT bp.bet_id, bp.side, bp.amount
    FROM bet_positions bp
    WHERE bp.user_id = ${rows[0].id}
  `;

  return NextResponse.json({ user: rows[0], positions });
}
