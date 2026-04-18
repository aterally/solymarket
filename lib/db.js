// lib/db.js
import { sql } from '@vercel/postgres';

export { sql };

export async function getUser(email) {
  const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] || null;
}

export async function createUser({ id, email, name, image }) {
  const { rows } = await sql`
    INSERT INTO users (id, email, name, image, credits, is_admin)
    VALUES (${id}, ${email}, ${name}, ${image}, 100, FALSE)
    ON CONFLICT (email) DO UPDATE SET name = ${name}, image = ${image}
    RETURNING *
  `;
  return rows[0];
}

export async function ensureAdmin(email) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (email === adminEmail) {
    await sql`UPDATE users SET is_admin = TRUE WHERE email = ${email}`;
  }
}

export async function getAllBets() {
  const { rows } = await sql`
    SELECT b.*, u.name as creator_name
    FROM bets b
    LEFT JOIN users u ON b.creator_id = u.id
    ORDER BY b.created_at DESC
  `;
  return rows;
}

export async function getBet(id) {
  const { rows } = await sql`
    SELECT b.*, u.name as creator_name
    FROM bets b
    LEFT JOIN users u ON b.creator_id = u.id
    WHERE b.id = ${id}
  `;
  return rows[0] || null;
}

export async function getUserPositions(userId) {
  const { rows } = await sql`
    SELECT bp.*, b.title, b.status, b.outcome
    FROM bet_positions bp
    JOIN bets b ON bp.bet_id = b.id
    WHERE bp.user_id = ${userId}
    ORDER BY bp.created_at DESC
  `;
  return rows;
}

export async function getBetPositions(betId) {
  const { rows } = await sql`
    SELECT bp.*, u.name as user_name
    FROM bet_positions bp
    JOIN users u ON bp.user_id = u.id
    WHERE bp.bet_id = ${betId}
  `;
  return rows;
}
