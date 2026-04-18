import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rows } = await sql`
    SELECT id, email, name, username, image, custom_image, credits, is_admin, is_manager,
           is_banned, is_muted_comments, is_muted_proposing, is_muted_markets, is_frozen
    FROM users WHERE email = ${session.user.email}
  `;
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Aggregate positions per bet per side
  const { rows: positions } = await sql`
    SELECT b.id as bet_id, b.title, b.status, b.outcome,
           bp.side, SUM(bp.amount) as amount
    FROM bet_positions bp
    JOIN bets b ON bp.bet_id = b.id
    WHERE bp.user_id = ${rows[0].id}
    GROUP BY b.id, b.title, b.status, b.outcome, bp.side
    ORDER BY MAX(bp.created_at) DESC
  `;

  return NextResponse.json({ user: rows[0], positions });
}
