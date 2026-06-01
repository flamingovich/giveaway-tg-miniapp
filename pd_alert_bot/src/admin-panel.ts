import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type http from 'node:http';
import { config, HTTP_PREFIX, normalizeCampaign } from './config.js';
import {
  addUserToCampaign,
  listByCampaign,
  unbindUserFromCampaign,
} from './db.js';

const ADMIN_BASE = `${HTTP_PREFIX}/admin`;
const sessions = new Set<string>();
const SESSION_COOKIE = 'pd_admin_session';

function hashPassword(password: string): string {
  return createHash('sha256').update(`${password}:${config.webhookSecret}`).digest('hex');
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [k, ...v] = part.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    }),
  );
}

function isAuthed(req: http.IncomingMessage): boolean {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  return Boolean(token && sessions.has(token));
}

function setSessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=${ADMIN_BASE}; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=${ADMIN_BASE}; HttpOnly; Max-Age=0`;
}

function htmlPage(body: string, title = 'PD Alerts Admin'): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f1115; color: #e8eaed; min-height: 100vh; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { font-size: 1.35rem; margin: 0 0 8px; }
    .sub { color: #9aa0a6; font-size: 0.9rem; margin-bottom: 28px; }
    .card { background: #1a1d24; border: 1px solid #2a2f3a; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    label { display: block; font-size: 0.8rem; color: #9aa0a6; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #3c4454; background: #0f1115; color: #fff; font-size: 1rem; }
    input:focus { outline: 2px solid #4f8cff; border-color: transparent; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 560px) { .row { grid-template-columns: 1fr; } }
    button, .btn { appearance: none; border: 0; border-radius: 8px; padding: 10px 16px; font-size: 0.95rem; cursor: pointer; }
    .primary { background: #4f8cff; color: #fff; font-weight: 600; }
    .danger { background: #3a2228; color: #ff8a8a; border: 1px solid #5c3038; padding: 6px 10px; font-size: 0.85rem; }
    .ghost { background: transparent; color: #9aa0a6; border: 1px solid #3c4454; }
    .camp { font-family: ui-monospace, monospace; font-weight: 600; color: #8ab4ff; margin-bottom: 10px; }
    .user { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid #2a2f3a; }
    .user:first-of-type { border-top: 0; }
    code { background: #0f1115; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; word-break: break-all; }
    .msg { padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; background: #152515; color: #8fd18f; border: 1px solid #254525; }
    .err { background: #251515; color: #ff9a9a; border-color: #452525; }
    .hint { font-size: 0.85rem; color: #9aa0a6; line-height: 1.5; }
    .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  </style>
</head>
<body><div class="wrap">${body}</div></body></html>`;
}

function loginPage(error = ''): string {
  return htmlPage(`
    <h1>PD Alerts</h1>
    <p class="sub">Админка привязок кампаний</p>
    ${error ? `<div class="err msg">${error}</div>` : ''}
    <div class="card">
      <form method="post" action="${ADMIN_BASE}/login">
        <label>Логин</label>
        <input name="username" value="admin" autocomplete="username" required autofocus>
        <div style="margin-top:12px">
          <label>Пароль</label>
          <input type="password" name="password" autocomplete="current-password" required>
        </div>
        <div style="margin-top:16px">
          <button class="primary" type="submit">Войти</button>
        </div>
      </form>
    </div>
  `);
}

function dashboardPage(message = ''): string {
  const rows = listByCampaign();
  const campaignsHtml =
    rows.length === 0
      ? '<p class="hint">Пока пусто. Добавь кампанию и Telegram ID ниже.</p>'
      : rows
          .map(
            (r) => `
      <div class="card">
        <div class="camp">${r.campaign}</div>
        ${r.tgIds
          .map(
            (id) => `
          <div class="user">
            <span><code>${id}</code></span>
            <form method="post" action="${ADMIN_BASE}/remove" style="margin:0">
              <input type="hidden" name="campaign" value="${r.campaign}">
              <input type="hidden" name="tgId" value="${id}">
              <button class="danger" type="submit">Убрать</button>
            </form>
          </div>`,
          )
          .join('')}
      </div>`,
          )
          .join('');

  const s2sInternal = `http://${config.internalHost}:${config.port}${HTTP_PREFIX}/s2s?secret=${encodeURIComponent(config.webhookSecret)}&campaign={campaign_name}&status={status}&revenue={conversion_revenue}&subid={subid}`;

  return htmlPage(`
    <div class="topbar">
      <div>
        <h1>PD Alerts</h1>
        <p class="sub" style="margin:0">Кампания → кому слать алерты</p>
      </div>
      <form method="post" action="${ADMIN_BASE}/logout"><button class="ghost" type="submit">Выйти</button></form>
    </div>
    ${message ? `<div class="msg">${message}</div>` : ''}

    <div class="card">
      <form method="post" action="${ADMIN_BASE}/add">
        <div class="row">
          <div>
            <label>Кампания Keitaro</label>
            <input name="campaign" placeholder="PD_BIODEP" required>
          </div>
          <div>
            <label>Telegram ID</label>
            <input name="tgId" placeholder="7946967720" required inputmode="numeric">
          </div>
        </div>
        <div style="margin-top:16px">
          <button class="primary" type="submit">Добавить</button>
        </div>
      </form>
    </div>

    <h2 style="font-size:1rem;margin:24px 0 12px;color:#9aa0a6">Привязки</h2>
    ${campaignsHtml}

    <h2 style="font-size:1rem;margin:24px 0 12px;color:#9aa0a6">S2S URL для Keitaro</h2>
    <div class="card hint">
      <p style="margin:0 0 8px">Вставь в каждую кампанию → S2S postbacks (GET, Registration + Sale):</p>
      <code>${s2sInternal}</code>
    </div>
  `);
}

function parseFormBody(body: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(body));
}

export async function handleAdminPanel(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  readBody: () => Promise<string>,
): Promise<boolean> {
  if (!url.pathname.startsWith(ADMIN_BASE)) return false;

  const sub = url.pathname.slice(ADMIN_BASE.length) || '/';

  if (sub === '/login' && req.method === 'POST') {
    const body = parseFormBody(await readBody());
    const username = (body.username || '').trim();
    const given = hashPassword(body.password || '');
    const expected = hashPassword(config.adminPanelPassword);
    const userOk = username === config.adminUsername;
    const passOk =
      given.length === expected.length &&
      timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!userOk || !passOk) {
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage('Неверный логин или пароль'));
      return true;
    }
    const token = randomBytes(24).toString('hex');
    sessions.add(token);
    res.writeHead(303, {
      Location: ADMIN_BASE,
      'Set-Cookie': setSessionCookie(token),
    });
    res.end();
    return true;
  }

  if (sub === '/logout' && req.method === 'POST') {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    if (token) sessions.delete(token);
    res.writeHead(303, {
      Location: ADMIN_BASE,
      'Set-Cookie': clearSessionCookie(),
    });
    res.end();
    return true;
  }

  if (!isAuthed(req)) {
    if (sub === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage());
      return true;
    }
    res.writeHead(303, { Location: ADMIN_BASE });
    res.end();
    return true;
  }

  if (sub === '/add' && req.method === 'POST') {
    const body = parseFormBody(await readBody());
    const campaign = normalizeCampaign(body.campaign || '');
    const tgId = Number(body.tgId);
    if (campaign && Number.isFinite(tgId)) {
      await addUserToCampaign(campaign, tgId);
      res.writeHead(303, { Location: `${ADMIN_BASE}?ok=added` });
    } else {
      res.writeHead(303, { Location: `${ADMIN_BASE}?err=invalid` });
    }
    res.end();
    return true;
  }

  if (sub === '/remove' && req.method === 'POST') {
    const body = parseFormBody(await readBody());
    const campaign = normalizeCampaign(body.campaign || '');
    const tgId = Number(body.tgId);
    if (campaign && Number.isFinite(tgId)) {
      await unbindUserFromCampaign(tgId, campaign);
    }
    res.writeHead(303, { Location: ADMIN_BASE });
    res.end();
    return true;
  }

  if (sub === '/' && req.method === 'GET') {
    let msg = '';
    if (url.searchParams.get('ok') === 'added') msg = 'Привязка добавлена';
    if (url.searchParams.get('err') === 'invalid') msg = 'Проверь кампанию и Telegram ID';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(dashboardPage(msg));
    return true;
  }

  res.writeHead(404).end('not found');
  return true;
}

export function adminPanelUrl(): string {
  return `${config.publicUrl}${ADMIN_BASE}`;
}
