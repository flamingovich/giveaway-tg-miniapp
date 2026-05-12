import { validateAdminToken } from '../lib/admin-sessions';
import { kvGet, removeContestById } from '../lib/storage';

const USERS_LIST_KEY = 'beef_registered_users_list_v1';
const CONTESTS_KEY = 'beef_contests_v7_final';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getBearer(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

async function broadcastPlainText(text: string): Promise<{ sent: number; failed: number; total: number }> {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN не задан');
  const userIds: number[] = (await kvGet<number[]>(USERS_LIST_KEY)) || [];
  let sent = 0;
  let failed = 0;
  for (const chatId of userIds) {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (r.ok) sent++;
    else failed++;
    await new Promise((res) => setTimeout(res, 40));
  }
  return { sent, failed, total: userIds.length };
}

export default async function handler(req: Request): Promise<Response> {
  const token = getBearer(req);
  if (!validateAdminToken(token)) return unauthorized();

  const url = new URL(req.url);
  const op = url.searchParams.get('op') || '';

  if (req.method === 'GET' && op === 'users') {
    const ids: number[] = (await kvGet<number[]>(USERS_LIST_KEY)) || [];
    return new Response(JSON.stringify({ users: ids }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'GET' && op === 'contests') {
    const contests = (await kvGet<any[]>(CONTESTS_KEY)) || [];
    return new Response(JSON.stringify({ contests }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST' && op === 'broadcast') {
    try {
      const body = await req.json();
      const text = typeof body?.text === 'string' ? body.text.trim() : '';
      if (!text) {
        return new Response(JSON.stringify({ error: 'Пустое сообщение' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const result = await broadcastPlainText(text);
      return new Response(JSON.stringify({ ok: true, ...result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || 'Ошибка рассылки' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (req.method === 'POST' && op === 'delete-contest') {
    try {
      const body = await req.json();
      const id = typeof body?.id === 'string' ? body.id : '';
      if (!id) {
        return new Response(JSON.stringify({ error: 'Нет id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      await removeContestById(id);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Не удалось удалить' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Bad Request' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
