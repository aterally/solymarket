import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rows } = await sql`
    SELECT id, email, name, username, image, credits, is_admin, is_manager,
           is_banned, is_muted_comments, is_muted_proposing, is_muted_markets, is_frozen
    FROM users WHERE email = ${session.user.email}
  `;
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows: positions } = await sql`
    SELECT bp.*, b.title, b.status, b.outcome
    FROM bet_positions bp JOIN bets b ON bp.bet_id = b.id
    WHERE bp.user_id = ${rows[0].id}
    ORDER BY bp.created_at DESC
  `;

  return NextResponse.json({ user: rows[0], positions });
}
