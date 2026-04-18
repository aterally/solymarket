import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT COALESCE(username, name) as display_name, credits, is_banned
      FROM users
      WHERE is_banned = FALSE
      ORDER BY credits DESC
      LIMIT 15
    `;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
