// In-memory rate limiter (works per-instance; for multi-instance use Redis)
const store = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, data] of store.entries()) {
    if (data.resetAt < now) store.delete(key);
  }
}
setInterval(cleanup, 60_000);

/**
 * @param {string} key  - unique per (ip + route)
 * @param {object} opts - { max, windowMs }
 * @returns {{ ok: boolean, remaining: number, resetIn: number }}
 */
export function rateLimit(key, { max = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  let data = store.get(key);
  if (!data || data.resetAt < now) {
    data = { count: 0, resetAt: now + windowMs };
    store.set(key, data);
  }
  data.count++;
  const ok = data.count <= max;
  return { ok, remaining: Math.max(0, max - data.count), resetIn: data.resetAt - now };
}

export function getIP(req) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function rateLimitResponse(resetIn) {
  const { NextResponse } = require('next/server');
  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } }
  );
}
