import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { toUsername, amount } = await req.json();
  const n = parseInt(amount);
  if (!n || n < 1) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  if (!toUsername?.trim()) return NextResponse.json({ error: 'Recipient required' }, { status: 400 });

  const { rows: fromRows } = await sql`SELECT id, credits FROM users WHERE email = ${session.user.email}`;
  if (!fromRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (fromRows[0].credits < n) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });

  const { rows: toRows } = await sql`
    SELECT id FROM users WHERE username = ${toUsername.trim()} OR (username IS NULL AND name = ${toUsername.trim()})
  `;
  if (!toRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (toRows[0].id === fromRows[0].id) return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 });

  await sql`UPDATE users SET credits = credits - ${n} WHERE id = ${fromRows[0].id}`;
  await sql`UPDATE users SET credits = credits + ${n} WHERE id = ${toRows[0].id}`;

  const { rows: updated } = await sql`SELECT credits FROM users WHERE id = ${fromRows[0].id}`;
  return NextResponse.json({ ok: true, newBalance: updated[0].credits });
}
