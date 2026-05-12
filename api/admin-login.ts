import { createAdminSession } from '../lib/admin-sessions';

const ADMIN_USER = process.env.ADMIN_PANEL_USER ?? 'pidor';
const ADMIN_PASS = process.env.ADMIN_PANEL_PASSWORD ?? 'pizdauzka';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (username !== ADMIN_USER || password !== ADMIN_PASS) {
      return new Response(JSON.stringify({ ok: false, error: 'Неверный логин или пароль' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = createAdminSession();
    return new Response(JSON.stringify({ ok: true, token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Bad Request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
