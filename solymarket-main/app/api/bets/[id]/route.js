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

    // Compute totals from bet_positions (tracks individual trades)
    const { rows: totalsRows } = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN side = 'yes' THEN amount ELSE 0 END), 0) as pos_yes,
        COALESCE(SUM(CASE WHEN side = 'no'  THEN amount ELSE 0 END), 0) as pos_no
      FROM bet_positions
      WHERE bet_id = ${id}
    `;
    const posYes   = parseInt(totalsRows[0].pos_yes);
    const posNo    = parseInt(totalsRows[0].pos_no);

    // Use the HIGHER of bet_positions sum vs bets table value.
    // This preserves totals for markets where total_yes/total_no was set directly
    // (e.g. before bet_positions tracking existed), while still reflecting new trades.
    const tableYes = parseInt(betRows[0].total_yes) || 0;
    const tableNo  = parseInt(betRows[0].total_no)  || 0;
    const realYes  = Math.max(posYes, tableYes);
    const realNo   = Math.max(posNo,  tableNo);

    // Only write back if bet_positions has MORE — never overwrite a higher value with 0
    if (posYes > tableYes || posNo > tableNo) {
      await sql`
        UPDATE bets SET total_yes = ${realYes}, total_no = ${realNo}
        WHERE id = ${id}
      `;
    }

    const bet = {
      ...betRows[0],
      total_yes: realYes,
      total_no:  realNo,
    };

    // Positions: one row per unique user showing both sides
    const { rows: positions } = await sql`
      SELECT
        COALESCE(u.username, u.name) as user_name,
        u.id as user_id,
        COALESCE(SUM(CASE WHEN bp.side = 'yes' THEN bp.amount ELSE 0 END), 0) as yes_amount,
        COALESCE(SUM(CASE WHEN bp.side = 'no'  THEN bp.amount ELSE 0 END), 0) as no_amount,
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

    // Probability history: 5-min buckets from actual trades (running total)
    const { rows: trades } = await sql`
      SELECT side, amount, created_at,
        date_trunc('hour', created_at) +
          INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM created_at) / 5) as bucket
      FROM bet_positions
      WHERE bet_id = ${id}
      ORDER BY created_at ASC
    `;

    const buckets = new Map();
    let runningYes = 0;
    let runningNo  = 0;
    for (const t of trades) {
      if (t.side === 'yes') runningYes += parseInt(t.amount);
      else                  runningNo  += parseInt(t.amount);
      const total = runningYes + runningNo;
      const pct   = total > 0 ? Math.round((runningYes / total) * 100) : 50;
      buckets.set(new Date(t.bucket).toISOString(), pct);
    }

    // If no bet_positions history at all, synthesise a single point from the bets table
    // so the chart and probability bar show the correct current value.
    if (buckets.size === 0 && (realYes > 0 || realNo > 0)) {
      const total = realYes + realNo;
      const pct   = Math.round((realYes / total) * 100);
      buckets.set(new Date().toISOString(), pct);
    }

    const history = Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([t, pct]) => ({ t, pct }));

    return NextResponse.json({ bet, positions, history });
  } catch (err) {
    console.error('[GET /api/bets/[id]]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
