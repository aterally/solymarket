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

    // Get ALL raw bet_positions rows for this bet (no join, no filter issues)
    const { rows: rawPositions } = await sql`
      SELECT bp.id, bp.bet_id, bp.user_id, bp.side, bp.amount, bp.created_at
      FROM bet_positions bp
      WHERE bp.bet_id = ${id}
    `;

    // Compute totals directly from raw rows (no JOIN that could silently drop rows)
    let totalYesFromPos = 0;
    let totalNoFromPos  = 0;
    for (const row of rawPositions) {
      const amt = parseInt(row.amount) || 0;
      if (row.side === 'yes') totalYesFromPos += amt;
      else                    totalNoFromPos  += amt;
    }

    // Use bet_positions totals if they have data, otherwise fall back to bets table
    const tableYes = parseInt(betRows[0].total_yes) || 0;
    const tableNo  = parseInt(betRows[0].total_no)  || 0;
    const realYes  = totalYesFromPos > 0 || totalNoFromPos > 0 ? totalYesFromPos : tableYes;
    const realNo   = totalYesFromPos > 0 || totalNoFromPos > 0 ? totalNoFromPos  : tableNo;

    // If bet_positions has data but bets table is stale/zero, sync it up
    if ((totalYesFromPos !== tableYes || totalNoFromPos !== tableNo) &&
        (totalYesFromPos > 0 || totalNoFromPos > 0)) {
      await sql`
        UPDATE bets SET total_yes = ${totalYesFromPos}, total_no = ${totalNoFromPos}
        WHERE id = ${id}
      `;
    }

    const bet = { ...betRows[0], total_yes: realYes, total_no: realNo };

    // Positions per user: build from raw rows + lookup usernames separately
    const userIds = [...new Set(rawPositions.map(r => r.user_id))];
    let userMap = {};
    if (userIds.length > 0) {
      const { rows: users } = await sql`
        SELECT id, COALESCE(username, name) as user_name
        FROM users WHERE id = ANY(${userIds})
      `;
      userMap = Object.fromEntries(users.map(u => [u.id, u.user_name]));
    }

    // Aggregate per user
    const posMap = {};
    for (const row of rawPositions) {
      const uid = row.user_id;
      if (!posMap[uid]) posMap[uid] = { user_id: uid, user_name: userMap[uid] || uid, yes_amount: 0, no_amount: 0 };
      if (row.side === 'yes') posMap[uid].yes_amount += parseInt(row.amount) || 0;
      else                    posMap[uid].no_amount  += parseInt(row.amount) || 0;
    }
    const positions = Object.values(posMap).map(p => ({
      ...p,
      amount: p.yes_amount + p.no_amount,
      side: p.yes_amount >= p.no_amount ? 'yes' : 'no',
    })).sort((a, b) => b.amount - a.amount);

    // Probability history from raw rows
    const rawSorted = [...rawPositions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const buckets = new Map();
    let runningYes = 0, runningNo = 0;
    for (const t of rawSorted) {
      const bucket = (() => {
        const d = new Date(t.created_at);
        d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
        return d.toISOString();
      })();
      if (t.side === 'yes') runningYes += parseInt(t.amount) || 0;
      else                  runningNo  += parseInt(t.amount) || 0;
      const tot = runningYes + runningNo;
      buckets.set(bucket, tot > 0 ? Math.round((runningYes / tot) * 100) : 50);
    }

    // Synthesise history point if no trades but bets table has totals
    if (buckets.size === 0 && (realYes > 0 || realNo > 0)) {
      const tot = realYes + realNo;
      buckets.set(new Date().toISOString(), Math.round((realYes / tot) * 100));
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
