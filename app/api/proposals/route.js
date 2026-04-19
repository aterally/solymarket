import { getServerSession } from 'next-auth';
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { rateLimit, getIP } from '../../../lib/rateLimit';

export async function GET(req) {
  const betId = req.nextUrl.searchParams.get('betId');
  if (!betId || !/^\d+$/.test(betId)) return NextResponse.json({ error: 'betId required' }, { status: 400 });

  const session = await getServerSession();

  const { rows: agg } = await sql`
    SELECT proposed_outcome, COUNT(*) as count
    FROM market_proposals
    WHERE bet_id = ${betId}
    GROUP BY proposed_outcome
  `;

  let myProposal = null;
  if (session?.user?.email) {
    const { rows: userRows } = await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
    if (userRows[0]) {
      const { rows: propRows } = await sql`
        SELECT proposed_outcome FROM market_proposals
        WHERE bet_id = ${betId} AND user_id = ${userRows[0].id}
      `;
      myProposal = propRows[0]?.proposed_outcome || null;
    }
  }

  const yesCount = agg.find(r => r.proposed_outcome === 'yes')?.count || 0;
  const noCount = agg.find(r => r.proposed_outcome === 'no')?.count || 0;
  return NextResponse.json({ yes: parseInt(yesCount), no: parseInt(noCount), myProposal });
}

export async function POST(req) {
  const ip = getIP(req);
  const rl = rateLimit(`propose:${ip}`, { max: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { betId, outcome } = body;
  if (!betId || !['yes', 'no'].includes(outcome)) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const { rows: userRows } = await sql`
    SELECT id, is_muted_proposing FROM users WHERE email = ${session.user.email}
  `;
  if (!userRows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (userRows[0].is_muted_proposing) return NextResponse.json({ error: 'You are muted from proposing' }, { status: 403 });

  await sql`
    INSERT INTO market_proposals (bet_id, user_id, proposed_outcome)
    VALUES (${betId}, ${userRows[0].id}, ${outcome})
    ON CONFLICT (bet_id, user_id) DO UPDATE SET proposed_outcome = ${outcome}
  `;
  return NextResponse.json({ ok: true, outcome });
}

export async function DELETE(req) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { betId } = body;
  const { rows: userRows } = await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
  if (!userRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await sql`DELETE FROM market_proposals WHERE bet_id = ${betId} AND user_id = ${userRows[0].id}`;
  return NextResponse.json({ ok: true });
}
