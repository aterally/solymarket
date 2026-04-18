import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { username } = await req.json();
  const trimmed = username?.trim();

  if (!trimmed || trimmed.length < 2 || trimmed.length > 24) {
    return NextResponse.json({ error: 'Username must be 2–24 characters' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed)) {
    return NextResponse.json({ error: 'Only letters, numbers, spaces, _ - . allowed' }, { status: 400 });
  }

  // Check uniqueness
  const { rows: existing } = await sql`
    SELECT id FROM users WHERE username = ${trimmed} AND email != ${session.user.email}
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
  }

  await sql`UPDATE users SET username = ${trimmed} WHERE email = ${session.user.email}`;
  return NextResponse.json({ ok: true, username: trimmed });
}
