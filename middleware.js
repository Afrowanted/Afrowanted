import { NextResponse } from 'next/server';

// Rate limiting in-memory (si resetta ad ogni cold start di Vercel)
// Per produzione scalabile usare Upstash Redis, ma questo è sufficiente per piccoli volumi
const rateLimitMap = new Map();

// Configurazione limiti per endpoint
const RATE_LIMITS = {
  '/api/send-contact-email':    { max: 5,  windowMs: 60_000 },  // 5 al minuto
  '/api/send-order-email':      { max: 10, windowMs: 60_000 },  // 10 al minuto
  '/api/send-reservation-email':{ max: 10, windowMs: 60_000 },
  '/api/send-shipping-email':   { max: 10, windowMs: 60_000 },
  '/api/send-welcome-email':    { max: 10, windowMs: 60_000 },
  '/api/create-payment-intent': { max: 20, windowMs: 60_000 },  // 20 al minuto
  '/api/delete-account':        { max: 3,  windowMs: 60_000 },  // 3 al minuto
};

// Pulizia periodica della mappa (ogni 5 minuti)
const CLEANUP_INTERVAL = 5 * 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  for (const [key, data] of rateLimitMap.entries()) {
    if (now > data.resetAt) rateLimitMap.delete(key);
  }
  lastCleanup = now;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Solo per le API
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Pulizia periodica
  cleanup();

  // Trova il limite per questo endpoint
  const limit = RATE_LIMITS[pathname];
  if (!limit) return NextResponse.next();

  // Ottieni IP del client
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const key = `${ip}:${pathname}`;
  const now = Date.now();

  // Recupera o inizializza il contatore
  let data = rateLimitMap.get(key);
  if (!data || now > data.resetAt) {
    data = { count: 0, resetAt: now + limit.windowMs };
    rateLimitMap.set(key, data);
  }

  data.count++;

  // Aggiungi headers rate limit alla risposta
  const headers = {
    'X-RateLimit-Limit': String(limit.max),
    'X-RateLimit-Remaining': String(Math.max(0, limit.max - data.count)),
    'X-RateLimit-Reset': String(Math.ceil(data.resetAt / 1000)),
  };

  // Blocca se supera il limite
  if (data.count > limit.max) {
    const retryAfter = Math.ceil((data.resetAt - now) / 1000);
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter,
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          ...headers,
        },
      }
    );
  }

  // Prosegui normalmente con headers informativi
  const response = NextResponse.next();
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
