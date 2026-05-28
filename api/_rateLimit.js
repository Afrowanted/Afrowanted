// Modulo rate limiting condiviso per tutte le API Vercel
// In-memory: si resetta ad ogni cold start, sufficiente per piccoli volumi

const store = new Map();

export function rateLimit(req, { max = 10, windowMs = 60_000 } = {}) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    '127.0.0.1';

  const key = `${ip}:${req.url}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  // Pulizia periodica ogni 100 richieste
  if (store.size > 1000) {
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k);
    }
  }

  return {
    ok: entry.count <= max,
    remaining: Math.max(0, max - entry.count),
    retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    headers: {
      'X-RateLimit-Limit': String(max),
      'X-RateLimit-Remaining': String(Math.max(0, max - entry.count)),
      'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
    }
  };
}
