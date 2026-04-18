const { sql } = require('@vercel/postgres');
async function migrate() {
  if (!process.env.POSTGRES_URL) { console.log('No POSTGRES_URL, skipping'); return; }
  try {
    await sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, username TEXT UNIQUE, image TEXT, custom_image TEXT, credits INTEGER DEFAULT 100, is_admin BOOLEAN DEFAULT FALSE, is_manager BOOLEAN DEFAULT FALSE, is_banned BOOLEAN DEFAULT FALSE, is_muted_comments BOOLEAN DEFAULT FALSE, is_muted_proposing BOOLEAN DEFAULT FALSE, is_muted_markets BOOLEAN DEFAULT FALSE, is_frozen BOOLEAN DEFAULT FALSE, banned_ips TEXT[], last_ip TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS bets (id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT, creator_id TEXT REFERENCES users(id), status TEXT DEFAULT 'open', outcome TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), closed_at TIMESTAMPTZ, total_yes INTEGER DEFAULT 0, total_no INTEGER DEFAULT 0)`;
    await sql`CREATE TABLE IF NOT EXISTS bet_positions (id SERIAL PRIMARY KEY, bet_id INTEGER REFERENCES bets(id), user_id TEXT REFERENCES users(id), side TEXT NOT NULL, amount INTEGER NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, bet_id INTEGER REFERENCES bets(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id), parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE, content TEXT NOT NULL, image_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS comment_likes (id SERIAL PRIMARY KEY, comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id), UNIQUE(comment_id, user_id))`;
    await sql`CREATE TABLE IF NOT EXISTS market_proposals (id SERIAL PRIMARY KEY, bet_id INTEGER REFERENCES bets(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id), proposed_outcome TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(bet_id, user_id))`;
    await sql`CREATE TABLE IF NOT EXISTS manager_proposals (id SERIAL PRIMARY KEY, bet_id INTEGER REFERENCES bets(id) ON DELETE CASCADE, manager_id TEXT REFERENCES users(id), proposed_outcome TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS credit_requests (id SERIAL PRIMARY KEY, from_user_id TEXT REFERENCES users(id), to_user_id TEXT REFERENCES users(id), amount INTEGER NOT NULL, type TEXT NOT NULL, note TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS dms (id SERIAL PRIMARY KEY, from_user_id TEXT REFERENCES users(id), to_user_id TEXT REFERENCES users(id), content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`;
    // Add missing columns
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_manager BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_muted_comments BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_muted_proposing BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_muted_markets BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_ips TEXT[]`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_image TEXT`;
    await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS image_url TEXT`;
    // Drop old UNIQUE constraint on bet_positions to allow multiple bets per user per market
    await sql`ALTER TABLE bet_positions DROP CONSTRAINT IF EXISTS bet_positions_bet_id_user_id_key`;
    console.log('Migration complete');
  } catch (err) { console.error('Migration error:', err.message); }
}
migrate();
