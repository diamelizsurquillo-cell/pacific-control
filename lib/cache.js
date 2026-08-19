/**
 * In-memory cache with TTL for Vercel Serverless Functions.
 * Reduces calls to Google Sheets API.
 */

const _cache = new Map();

const DEFAULT_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '300', 10) * 1000;

function get(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function set(key, data, ttlMs = DEFAULT_TTL) {
  _cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
  });
}

function invalidate(key) {
  if (key) {
    _cache.delete(key);
  } else {
    _cache.clear();
  }
}

function getAge(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  return Math.round((Date.now() - entry.createdAt) / 1000);
}

module.exports = { get, set, invalidate, getAge };
