/**
 * Strip HTML tags and dangerous characters from a string
 */
export function sanitizeText(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')        // strip HTML
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .slice(0, maxLen)
    .trim();
}

export function sanitizeInt(val, min = 1, max = 1_000_000) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

export function sanitizeUsername(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[^a-zA-Z0-9_\-. ]/g, '').slice(0, 64).trim();
}
