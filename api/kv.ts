import { clearContests, kvGet, kvSet } from '../lib/storage';

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const key = url.searchParams.get('key');

  if (req.method === 'GET' && action === 'get' && key) {
    const value = await kvGet(key);
    return new Response(JSON.stringify({ result: value }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST' && action === 'set' && key) {
    const body = await req.json();
    await kvSet(key, body?.value);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST' && action === 'clear-contests') {
    // Explicit admin action only.
    await clearContests();
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Bad Request', { status: 400 });
}
