import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        username TEXT UNIQUE,
        image TEXT,
        credits INTEGER DEFAULT 100,
        is_admin BOOLEAN DEFAULT FALSE,
        is_banned BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Add columns if upgrading existing DB
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE`;

    await sql`
      CREATE TABLE IF NOT EXISTS bets (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        creator_id TEXT REFERENCES users(id),
        status TEXT DEFAULT 'open',
        outcome TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        closed_at TIMESTAMPTZ,
        total_yes INTEGER DEFAULT 0,
        total_no INTEGER DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS bet_positions (
        id SERIAL PRIMARY KEY,
        bet_id INTEGER REFERENCES bets(id),
        user_id TEXT REFERENCES users(id),
        side TEXT NOT NULL,
        amount INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(bet_id, user_id)
      )
    `;

    return NextResponse.json({ ok: true, message: 'Migration complete' });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
