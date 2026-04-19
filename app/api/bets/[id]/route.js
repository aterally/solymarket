import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { id } = params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const { rows: betRows } = await sql`
      SELECT b.*, COALESCE(u.username, u.name) as creator_name
      FROM bets b LEFT JOIN users u ON b.creator_id = u.id
      WHERE b.id = ${id} AND b.deleted_at IS NULL
    `;
    if (!betRows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Positions: one row per user (sum across both sides)
    const { rows: positions } = await sql`
      SELECT
        COALESCE(u.username, u.name) as user_name,
        u.id as user_id,
        SUM(CASE WHEN bp.side = 'yes' THEN bp.amount ELSE 0 END) as yes_amount,
        SUM(CASE WHEN bp.side = 'no'  THEN bp.amount ELSE 0 END) as no_amount,
        SUM(bp.amount) as amount,
        CASE
          WHEN SUM(CASE WHEN bp.side='yes' THEN bp.amount ELSE 0 END) >=
               SUM(CASE WHEN bp.side='no'  THEN bp.amount ELSE 0 END)
          THEN 'yes' ELSE 'no'
        END as side
      FROM bet_positions bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.bet_id = ${id}
      GROUP BY u.id, COALESCE(u.username, u.name)
      ORDER BY SUM(bp.amount) DESC
    `;

    // Probability history: one snapshot per 5-minute bucket from actual trades
    // Compute running yes_pct after each trade chronologically
    const { rows: trades } = await sql`
      SELECT
        side,
        amount,
        created_at,
        date_trunc('hour', created_at) +
          INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM created_at) / 5) as bucket
      FROM bet_positions
      WHERE bet_id = ${id}
      ORDER BY created_at ASC
    `;

    // Build 5-min bucket snapshots
    const buckets = new Map();
    let runningYes = 0;
    let runningNo = 0;
    for (const t of trades) {
      if (t.side === 'yes') runningYes += parseInt(t.amount);
      else runningNo += parseInt(t.amount);
      const total = runningYes + runningNo;
      const pct = total > 0 ? Math.round((runningYes / total) * 100) : 50;
      const key = new Date(t.bucket).toISOString();
      buckets.set(key, pct);
    }

    // Convert to sorted array of { t, pct }
    const history = Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([t, pct]) => ({ t, pct }));

    return NextResponse.json({ bet: betRows[0], positions, history });
  } catch (err) {
    console.error('[GET /api/bets/[id]]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
