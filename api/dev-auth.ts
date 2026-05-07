import { timingSafeEqual } from 'node:crypto';

const SESSION_MS = 8 * 60 * 60 * 1000;

function equalsSecret(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Локальный вход в админку только при явном секрете на сервере и не в проде на Vercel */
export default async function handler(req: Request): Promise<Response> {
  const onVercelProduction = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production';
  if (onVercelProduction) {
    return new Response('Not Found', { status: 404 });
  }

  const secret = process.env.LOCAL_ADMIN_SECRET;
  if (!secret || secret.length < 16) {
    return new Response(JSON.stringify({ error: 'LOCAL_ADMIN_SECRET not configured (min 16 chars)' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (!equalsSecret(body?.secret, secret)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const until = Date.now() + SESSION_MS;
      return new Response(JSON.stringify({ ok: true, until }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Bad Request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}
