import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type http from 'node:http';
import { config, HTTP_PREFIX, normalizeCampaign } from './config.js';
import {
  addFullAccess,
  addUserToCampaign,
  bindingEarningsAllTime,
  bindingOutstanding,
  getFullAccessIds,
  listByCampaign,
  removeFullAccess,
  setFtdRate,
  setPaidTotal,
  sumAllDays,
  unbindUserFromCampaign,
} from './db.js';
import { formatMoney } from './stats.js';

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
    .wrap { max-width: 800px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { font-size: 1.35rem; margin: 0 0 8px; }
    h2 { font-size: 1rem; margin: 24px 0 12px; color: #9aa0a6; font-weight: 600; }
    .sub { color: #9aa0a6; font-size: 0.9rem; margin-bottom: 28px; }
    .card { background: #1a1d24; border: 1px solid #2a2f3a; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    label { display: block; font-size: 0.8rem; color: #9aa0a6; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #3c4454; background: #0f1115; color: #fff; font-size: 1rem; }
    input:focus { outline: 2px solid #4f8cff; border-color: transparent; }
    .row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    @media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
    button, .btn { appearance: none; border: 0; border-radius: 8px; padding: 10px 16px; font-size: 0.95rem; cursor: pointer; }
    .primary { background: #4f8cff; color: #fff; font-weight: 600; }
    .danger { background: #3a2228; color: #ff8a8a; border: 1px solid #5c3038; padding: 6px 10px; font-size: 0.85rem; }
    .ghost { background: transparent; color: #9aa0a6; border: 1px solid #3c4454; }
    .small { padding: 6px 10px; font-size: 0.85rem; }
    .camp { font-family: ui-monospace, monospace; font-weight: 600; color: #8ab4ff; margin-bottom: 10px; }
    .user { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid #2a2f3a; flex-wrap: wrap; }
    .user:first-of-type { border-top: 0; }
    .user-meta { flex: 1; min-width: 140px; }
    .user-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .inline-form { display: flex; gap: 6px; align-items: center; margin: 0; }
    .inline-form input { width: 72px; padding: 6px 8px; }
    code { background: #0f1115; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; word-break: break-all; }
    .msg { padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; background: #152515; color: #8fd18f; border: 1px solid #254525; }
    .err { background: #251515; color: #ff9a9a; border-color: #452525; }
    .hint { font-size: 0.85rem; color: #9aa0a6; line-height: 1.5; }
    .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .badge { color: #8fd18f; font-size: 0.85rem; }
    .payout { font-size: 0.85rem; color: #9aa0a6; margin-top: 4px; line-height: 1.5; }
    .payout strong { color: #e8eaed; }
    .payout .due { color: #ffb74d; }
  </style>
</head>
<body><div class="wrap">${body}</div></body></html>`;
}

function loginPage(error = ''): string {
  return htmlPage(`
    <h1>PD Alerts</h1>
    <p class="sub">Админка привязок</p>
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
  const fullIds = getFullAccessIds();

  const campaignsHtml =
    rows.length === 0
      ? '<p class="hint">Пока пусто.</p>'
      : rows
          .map(
            (r) => `
      <div class="card">
        <div class="camp">${r.campaign}</div>
        ${r.entries
          .map((e) => {
            const allFtd = sumAllDays(r.campaign).ftd;
            const earned = bindingEarningsAllTime(r.campaign, e.tgId);
            const paid = e.paidTotal ?? 0;
            const due = bindingOutstanding(r.campaign, e.tgId);
            return `
          <div class="user">
            <div class="user-meta">
              <code>${e.tgId}</code>
              <span class="badge">${e.ftdRate > 0 ? `$${e.ftdRate}/FTD` : 'ставка не задана'}</span>
              <div class="payout">
                FTD всего: <strong>${allFtd}</strong>
                ${e.ftdRate > 0 ? ` · заработано: <strong>${formatMoney(earned)}</strong>` : ''}
                <br>
                Выплачено: <strong>${formatMoney(paid)}</strong>
                ${e.ftdRate > 0 ? ` · <span class="due">к выплате: <strong>${formatMoney(due)}</strong></span>` : ''}
              </div>
            </div>
            <div class="user-actions">
              <form class="inline-form" method="post" action="${ADMIN_BASE}/set-rate">
                <input type="hidden" name="campaign" value="${r.campaign}">
                <input type="hidden" name="tgId" value="${e.tgId}">
                <input name="ftdRate" type="number" step="0.01" min="0" placeholder="$" value="${e.ftdRate || ''}">
                <button class="ghost small" type="submit">Ставка</button>
              </form>
              <form class="inline-form" method="post" action="${ADMIN_BASE}/set-paid">
                <input type="hidden" name="campaign" value="${r.campaign}">
                <input type="hidden" name="tgId" value="${e.tgId}">
                <input name="paidTotal" type="number" step="0.01" min="0" placeholder="выплачено" value="${paid || ''}">
                <button class="ghost small" type="submit">Выплачено</button>
              </form>
              <form method="post" action="${ADMIN_BASE}/remove" style="margin:0">
                <input type="hidden" name="campaign" value="${r.campaign}">
                <input type="hidden" name="tgId" value="${e.tgId}">
                <button class="danger" type="submit">Убрать</button>
              </form>
            </div>
          </div>`;
          })
          .join('')}
      </div>`,
          )
          .join('');

  const fullHtml =
    fullIds.length === 0
      ? '<p class="hint">Нет пользователей с полным доступом в боте.</p>'
      : fullIds
          .map(
            (id) => `
        <div class="user">
          <code>${id}</code>
          <form method="post" action="${ADMIN_BASE}/fullaccess-remove" style="margin:0">
            <input type="hidden" name="tgId" value="${id}">
            <button class="danger" type="submit">Снять доступ</button>
          </form>
        </div>`,
          )
          .join('');

  const s2sInternal = `http://${config.internalHost}:${config.port}${HTTP_PREFIX}/s2s?secret=${encodeURIComponent(config.webhookSecret)}&campaign={campaign_name}&status={status}&revenue={conversion_revenue}&subid={subid}`;

  return htmlPage(`
    <div class="topbar">
      <div>
        <h1>PD Alerts</h1>
        <p class="sub" style="margin:0">Привязки · ставки · полный доступ в боте</p>
      </div>
      <form method="post" action="${ADMIN_BASE}/logout"><button class="ghost" type="submit">Выйти</button></form>
    </div>
    ${message ? `<div class="msg">${message}</div>` : ''}
    <p class="hint">Revenue из Keitaro в отчёты <b>не попадает</b>. Заработано = FTD за всё время × ставка. <b>К выплате</b> = заработано − уже выплачено (поле «Выплачено»).</p>

    <div class="card">
      <form method="post" action="${ADMIN_BASE}/add">
        <div class="row">
          <div>
            <label>Кампания</label>
            <input name="campaign" placeholder="PD_TANK" required>
          </div>
          <div>
            <label>Telegram ID</label>
            <input name="tgId" placeholder="7946967720" required inputmode="numeric">
          </div>
          <div>
            <label>Ставка $/FTD</label>
            <input name="ftdRate" type="number" step="0.01" min="0" placeholder="28">
          </div>
        </div>
        <div style="margin-top:16px">
          <button class="primary" type="submit">Добавить привязку</button>
        </div>
      </form>
    </div>

    <h2>Привязки кампаний</h2>
    ${campaignsHtml}

    <h2>Полный доступ в Telegram-боте</h2>
    <p class="hint">Как у вас: /stats по всем кампаниям, /add, /who. Веб-админка только у супер-админа.</p>
    <div class="card">
      <form method="post" action="${ADMIN_BASE}/fullaccess-add" class="row" style="align-items:end">
        <div style="grid-column: span 2">
          <label>Telegram ID</label>
          <input name="tgId" placeholder="123456789" required inputmode="numeric">
        </div>
        <div>
          <button class="primary" type="submit">Выдать доступ</button>
        </div>
      </form>
      <div style="margin-top:16px">${fullHtml}</div>
    </div>

    <h2>S2S URL для Keitaro</h2>
    <div class="card hint">
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
    res.writeHead(303, { Location: ADMIN_BASE, 'Set-Cookie': setSessionCookie(token) });
    res.end();
    return true;
  }

  if (sub === '/logout' && req.method === 'POST') {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    if (token) sessions.delete(token);
    res.writeHead(303, { Location: ADMIN_BASE, 'Set-Cookie': clearSessionCookie() });
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
    const ftdRate = Number(body.ftdRate) || 0;
    if (campaign && Number.isFinite(tgId)) {
      await addUserToCampaign(campaign, tgId, ftdRate);
      res.writeHead(303, { Location: `${ADMIN_BASE}?ok=added` });
    } else {
      res.writeHead(303, { Location: `${ADMIN_BASE}?err=invalid` });
    }
    res.end();
    return true;
  }

  if (sub === '/set-rate' && req.method === 'POST') {
    const body = parseFormBody(await readBody());
    const campaign = normalizeCampaign(body.campaign || '');
    const tgId = Number(body.tgId);
    const ftdRate = Number(body.ftdRate);
    if (campaign && Number.isFinite(tgId) && Number.isFinite(ftdRate)) {
      await setFtdRate(campaign, tgId, ftdRate);
    }
    res.writeHead(303, { Location: `${ADMIN_BASE}?ok=rate` });
    res.end();
    return true;
  }

  if (sub === '/set-paid' && req.method === 'POST') {
    const body = parseFormBody(await readBody());
    const campaign = normalizeCampaign(body.campaign || '');
    const tgId = Number(body.tgId);
    const paidTotal = Number(body.paidTotal);
    if (campaign && Number.isFinite(tgId) && Number.isFinite(paidTotal)) {
      await setPaidTotal(campaign, tgId, paidTotal);
    }
    res.writeHead(303, { Location: `${ADMIN_BASE}?ok=paid` });
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

  if (sub === '/fullaccess-add' && req.method === 'POST') {
    const tgId = Number(parseFormBody(await readBody()).tgId);
    if (Number.isFinite(tgId)) await addFullAccess(tgId);
    res.writeHead(303, { Location: `${ADMIN_BASE}?ok=full` });
    res.end();
    return true;
  }

  if (sub === '/fullaccess-remove' && req.method === 'POST') {
    const tgId = Number(parseFormBody(await readBody()).tgId);
    if (Number.isFinite(tgId)) await removeFullAccess(tgId);
    res.writeHead(303, { Location: ADMIN_BASE });
    res.end();
    return true;
  }

  if (sub === '/' && req.method === 'GET') {
    const ok = url.searchParams.get('ok');
    const msgs: Record<string, string> = {
      added: 'Привязка добавлена',
      rate: 'Ставка обновлена',
      paid: 'Выплачено обновлено',
      full: 'Полный доступ выдан',
      invalid: 'Проверь поля',
    };
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(dashboardPage(ok ? msgs[ok] || '' : ''));
    return true;
  }

  res.writeHead(404).end('not found');
  return true;
}

export function adminPanelUrl(): string {
  return `${config.publicUrl}${ADMIN_BASE}`;
}
