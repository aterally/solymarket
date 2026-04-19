import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: userRows } = await sql`SELECT id, is_admin FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0]?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { betId } = body;
  if (!betId) return NextResponse.json({ error: 'betId required' }, { status: 400 });

  // Soft-delete: set deleted_at timestamp so the bet is invisible but data is preserved
  await sql`UPDATE bets SET deleted_at = NOW() WHERE id = ${betId}`;

  return NextResponse.json({ ok: true });
}
