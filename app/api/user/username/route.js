import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '@/lib/rateLimit';

export async function POST(req) {
  const ip = getIP(req);
  const rl = rateLimit(`username:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });

  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const raw = (body.username || '').trim();
  if (!raw || raw.length < 2 || raw.length > 24) {
    return NextResponse.json({ error: 'Username must be 2–24 characters' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(raw)) {
    return NextResponse.json({ error: 'Only letters, numbers, spaces, _ - . allowed' }, { status: 400 });
  }

  // Check uniqueness
  const { rows: existing } = await sql`SELECT id FROM users WHERE username = ${raw} AND email != ${session.user.email}`;
  if (existing.length > 0) return NextResponse.json({ error: 'Username already taken' }, { status: 409 });

  await sql`UPDATE users SET username = ${raw} WHERE email = ${session.user.email}`;
  return NextResponse.json({ ok: true, username: raw });
}
