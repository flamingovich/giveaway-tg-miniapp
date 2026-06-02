import { adminPanelUrl } from './admin-panel.js';
import { hasBotAdmin, isSuperAdmin } from './access.js';
import { classifyStatus, config, normalizeCampaign, s2sWebhookUrl } from './config.js';
import {
  addFullAccess,
  addUserToCampaign,
  aggregateStats,
  bindUser,
  bindingOutstanding,
  getBinding,
  getBindingsForCampaign,
  getFullAccessIds,
  getKnownCampaigns,
  getUserCampaigns,
  listAllBindings,
  listByCampaign,
  recordConversion,
  removeFullAccess,
  replaceUserCampaigns,
  setFtdRate,
  sumAllDays,
  unbindUser,
  unbindUserFromCampaign,
} from './db.js';
import {
  alertMessage,
  dayKeyNow,
  formatStatsBlock,
  periodLabel,
  periodRange,
  statsKeyboard,
  type PeriodKey,
} from './stats.js';
import { answerCallback, sendMessage } from './telegram.js';

type TgUser = { id: number; first_name?: string; username?: string };
type TgMessage = { message_id: number; chat: { id: number }; from?: TgUser; text?: string };
type TgCallback = { id: string; from: TgUser; message?: { chat: { id: number }; message_id: number }; data?: string };

function parseArgs(text: string): string[] {
  return text.trim().split(/\s+/).slice(1);
}

function statsForCampaign(campaign: string, period: PeriodKey) {
  const range = periodRange(period);
  if (!range) return sumAllDays(campaign);
  return aggregateStats(campaign, range.from, range.to);
}

async function sendCampaignStats(
  chatId: number,
  campaign: string,
  period: PeriodKey,
  scope: 'user' | 'admin',
  viewerId?: number,
) {
  const stats = statsForCampaign(campaign, period);
  const binding = viewerId !== undefined ? getBinding(campaign, viewerId) : undefined;
  const outstanding =
    binding && binding.ftdRate > 0 ? bindingOutstanding(campaign, viewerId!) : undefined;
  await sendMessage(
    chatId,
    formatStatsBlock(campaign, period, stats, {
      ftdRate: binding?.ftdRate,
      outstanding,
    }),
    statsKeyboard(scope, campaign),
  );
}

async function sendUserStatsMenu(chatId: number, userId: number) {
  const campaigns = getUserCampaigns(userId);
  if (campaigns.length === 0) {
    await sendMessage(chatId, 'У вас пока нет привязанных кампаний. Обратитесь к админу.');
    return;
  }
  if (campaigns.length === 1) {
    await sendCampaignStats(chatId, campaigns[0], 'today', 'user', userId);
    return;
  }
  const lines = campaigns.map((c) => {
    const b = getBinding(c, userId);
    const rate = b?.ftdRate ? ` ($${b.ftdRate}/FTD)` : '';
    return `• ${c}${rate}`;
  }).join('\n');
  await sendMessage(
    chatId,
    `<b>📊 Ваши кампании</b>\n\n${lines}\n\n/stats PD_TANK — по кампании`,
    statsKeyboard('user', campaigns[0]),
  );
}

async function sendAdminOverview(chatId: number, period: PeriodKey) {
  const campaigns = getKnownCampaigns();
  if (campaigns.length === 0) {
    await sendMessage(chatId, 'Пока нет данных. Добавь привязку в админке.');
    return;
  }
  const blocks = campaigns.map((c) => {
    const stats = statsForCampaign(c, period);
    return `${c}: REG <b>${stats.reg}</b> | FTD <b>${stats.ftd}</b>`;
  });
  await sendMessage(
    chatId,
    `<b>📊 Все кампании — ${periodLabel(period)}</b>\n\n${blocks.join('\n')}`,
    statsKeyboard('admin'),
  );
}

function alertRecipients(campaign: string): number[] {
  const ids = new Set(getBindingsForCampaign(campaign));
  for (const id of config.adminIds) ids.add(id);
  for (const id of getFullAccessIds()) ids.add(id);
  return [...ids];
}

export async function handleTelegramUpdate(update: Record<string, unknown>) {
  if (update.callback_query) {
    await handleCallback(update.callback_query as TgCallback);
    return;
  }
  const message = update.message as TgMessage | undefined;
  if (!message?.from || typeof message.text !== 'string') return;
  await handleMessage(message);
}

async function handleCallback(cb: TgCallback) {
  const data = cb.data || '';
  const chatId = cb.message?.chat.id;
  if (!chatId) return;

  const parts = data.split(':');
  if (parts[0] === 'usr' && parts[1] === 'stats') {
    const period = parts[2] as PeriodKey;
    const campaign = parts[3];
    const userCampaigns = getUserCampaigns(cb.from.id);
    const target = campaign || userCampaigns[0];
    if (!target || !userCampaigns.some((c) => c.toUpperCase() === target.toUpperCase())) {
      await answerCallback(cb.id, 'Нет доступа');
      return;
    }
    await answerCallback(cb.id);
    await sendCampaignStats(chatId, normalizeCampaign(target), period, 'user', cb.from.id);
    return;
  }

  if (parts[0] === 'adm' && parts[1] === 'stats' && hasBotAdmin(cb.from.id)) {
    const period = parts[2] as PeriodKey;
    const campaign = parts[3];
    await answerCallback(cb.id);
    if (campaign) {
      await sendCampaignStats(chatId, normalizeCampaign(campaign), period, 'admin');
    } else {
      await sendAdminOverview(chatId, period);
    }
  }
}

async function handleMessage(message: TgMessage) {
  const userId = message.from!.id;
  const chatId = message.chat.id;
  const text = message.text!.trim();
  const botAdmin = hasBotAdmin(userId);
  const superAdmin = isSuperAdmin(userId);

  if (text.startsWith('/start')) {
    if (botAdmin) {
      const lines = [
        '<b>PokerDom Alerts</b>',
        '',
        '<b>Кампания → кому слать:</b>',
        '<code>/add PD_BIODEP 7946967720</code>',
        '<code>/del PD_BIODEP 7946967720</code>',
        '<code>/who PD_BIODEP</code>',
        '<code>/campaigns</code>',
        '',
        '/stats — статистика (REG/FTD, без revenue Keitaro)',
        '/s2s — URL для Keitaro',
      ];
      if (superAdmin) {
        lines.push('', `<b>Веб-админка:</b> ${adminPanelUrl()}`);
        lines.push('<code>/fullaccess tg_id</code> — полный доступ в боте');
        lines.push('<code>/revoke tg_id</code> — убрать полный доступ');
      }
      await sendMessage(chatId, lines.join('\n'));
    } else {
      const campaigns = getUserCampaigns(userId);
      if (campaigns.length) {
        await sendMessage(chatId, `Привет! Кампании: <b>${campaigns.join(', ')}</b>\n\n/stats — статистика`);
      } else {
        await sendMessage(chatId, 'Привет! Кампания не привязана. Напишите админу ваш Telegram ID.');
      }
    }
    return;
  }

  if (text.startsWith('/stats')) {
    const arg = parseArgs(text)[0];
    if (botAdmin && !arg) {
      await sendAdminOverview(chatId, 'today');
      return;
    }
    if (botAdmin && arg) {
      await sendCampaignStats(chatId, normalizeCampaign(arg), 'today', 'admin');
      return;
    }
    if (arg) {
      const campaigns = getUserCampaigns(userId);
      const target = normalizeCampaign(arg);
      if (!campaigns.some((c) => c.toUpperCase() === target)) {
        await sendMessage(chatId, 'Эта кампания вам не назначена.');
        return;
      }
      await sendCampaignStats(chatId, target, 'today', 'user', userId);
      return;
    }
    await sendUserStatsMenu(chatId, userId);
    return;
  }

  if (!botAdmin) return;

  if (text.startsWith('/fullaccess') && superAdmin) {
    const tgId = Number(parseArgs(text)[0]);
    if (!Number.isFinite(tgId)) {
      await sendMessage(chatId, 'Формат: <code>/fullaccess tg_id</code>');
      return;
    }
    await addFullAccess(tgId);
    await sendMessage(chatId, `✅ Полный доступ в боте: <code>${tgId}</code>`);
    try {
      await sendMessage(tgId, 'Вам выдан <b>полный доступ</b> в боте (как у админа).\n\n/stats — все кампании');
    } catch {
      /* need /start */
    }
    return;
  }

  if (text.startsWith('/revoke') && superAdmin) {
    const tgId = Number(parseArgs(text)[0]);
    if (!Number.isFinite(tgId)) {
      await sendMessage(chatId, 'Формат: <code>/revoke tg_id</code>');
      return;
    }
    await removeFullAccess(tgId);
    await sendMessage(chatId, `✅ Полный доступ снят: <code>${tgId}</code>`);
    return;
  }

  if (text.startsWith('/add')) {
    const args = parseArgs(text);
    if (args.length < 2) {
      await sendMessage(chatId, 'Формат: <code>/add КАМПАНИЯ tg_id [ставка]</code>');
      return;
    }
    const campaign = normalizeCampaign(args[0]);
    const tgId = Number(args[1]);
    const rate = args[2] !== undefined ? Number(args[2]) : 0;
    if (!Number.isFinite(tgId)) {
      await sendMessage(chatId, 'Неверный tg_id');
      return;
    }
    await addUserToCampaign(campaign, tgId, Number.isFinite(rate) ? rate : 0);
    const rateMsg = rate > 0 ? `, ставка $${rate}/FTD` : '';
    await sendMessage(chatId, `✅ <b>${campaign}</b> → <code>${tgId}</code>${rateMsg}`);
    try {
      await sendMessage(tgId, `Кампания <b>${campaign}</b>${rateMsg}\n\n/stats — статистика`);
    } catch {
      /* */
    }
    return;
  }

  if (text.startsWith('/rate')) {
    const args = parseArgs(text);
    if (args.length < 3) {
      await sendMessage(chatId, 'Формат: <code>/rate КАМПАНИЯ tg_id 28</code>');
      return;
    }
    const campaign = normalizeCampaign(args[0]);
    const tgId = Number(args[1]);
    const rate = Number(args[2]);
    if (!Number.isFinite(tgId) || !Number.isFinite(rate)) {
      await sendMessage(chatId, 'Неверные параметры');
      return;
    }
    const ok = await setFtdRate(campaign, tgId, rate);
    await sendMessage(chatId, ok ? `✅ Ставка <b>${campaign}</b> → <code>${tgId}</code>: $${rate}/FTD` : 'Привязка не найдена');
    return;
  }

  if (text.startsWith('/del')) {
    const args = parseArgs(text);
    if (args.length < 2) {
      await sendMessage(chatId, 'Формат: <code>/del КАМПАНИЯ tg_id</code>');
      return;
    }
    const campaign = normalizeCampaign(args[0]);
    const tgId = Number(args[1]);
    if (!Number.isFinite(tgId)) {
      await sendMessage(chatId, 'Неверный tg_id');
      return;
    }
    await unbindUserFromCampaign(tgId, campaign);
    await sendMessage(chatId, `✅ Убрано: <code>${tgId}</code> с <b>${campaign}</b>`);
    return;
  }

  if (text.startsWith('/who')) {
    const campaign = normalizeCampaign(parseArgs(text)[0] || '');
    if (!campaign) {
      await sendMessage(chatId, 'Формат: <code>/who PD_BIODEP</code>');
      return;
    }
    const rows = listByCampaign().find((r) => r.campaign === campaign);
    if (!rows?.entries.length) {
      await sendMessage(chatId, `<b>${campaign}</b>\n\nНикому не назначена.`);
      return;
    }
    const body = rows.entries
      .map((e) => `• <code>${e.tgId}</code>${e.ftdRate > 0 ? ` — $${e.ftdRate}/FTD` : ''}`)
      .join('\n');
    await sendMessage(chatId, `<b>${campaign}</b>\n\n${body}`);
    return;
  }

  if (text.startsWith('/campaigns')) {
    const rows = listByCampaign();
    if (!rows.length) {
      await sendMessage(chatId, 'Кампаний нет.');
      return;
    }
    const body = rows
      .map((r) => {
        const users = r.entries
          .map((e) => `  • <code>${e.tgId}</code>${e.ftdRate > 0 ? ` $${e.ftdRate}/FTD` : ''}`)
          .join('\n');
        return `<b>${r.campaign}</b>\n${users}`;
      })
      .join('\n\n');
    await sendMessage(chatId, `<b>📋 Кампании</b>\n\n${body}`);
    return;
  }

  if (text.startsWith('/fullusers') && superAdmin) {
    const ids = getFullAccessIds();
    await sendMessage(
      chatId,
      ids.length ? `<b>Полный доступ:</b>\n${ids.map((id) => `• <code>${id}</code>`).join('\n')}` : 'Список пуст.',
    );
    return;
  }

  if (text.startsWith('/bind')) {
    const args = parseArgs(text);
    if (args.length < 2) {
      await sendMessage(chatId, 'Формат: <code>/bind tg_id CAMPAIGN</code>');
      return;
    }
    const tgId = Number(args[0]);
    const campaigns = args.slice(1).map(normalizeCampaign);
    if (!Number.isFinite(tgId)) {
      await sendMessage(chatId, 'Неверный tg_id');
      return;
    }
    await bindUser(tgId, campaigns);
    await sendMessage(chatId, `✅ <code>${tgId}</code> → <b>${campaigns.join(', ')}</b>`);
    return;
  }

  if (text.startsWith('/setbind')) {
    const args = parseArgs(text);
    if (args.length < 2) {
      await sendMessage(chatId, 'Формат: <code>/setbind tg_id CAMPAIGN</code>');
      return;
    }
    const tgId = Number(args[0]);
    const campaigns = args.slice(1).map(normalizeCampaign);
    if (!Number.isFinite(tgId)) {
      await sendMessage(chatId, 'Неверный tg_id');
      return;
    }
    await replaceUserCampaigns(tgId, campaigns);
    await sendMessage(chatId, `✅ Обновлено: <code>${tgId}</code>`);
    return;
  }

  if (text.startsWith('/unbind')) {
    const tgId = Number(parseArgs(text)[0]);
    if (!Number.isFinite(tgId)) {
      await sendMessage(chatId, 'Формат: <code>/unbind tg_id</code>');
      return;
    }
    await unbindUser(tgId);
    await sendMessage(chatId, `✅ Привязка удалена: <code>${tgId}</code>`);
    return;
  }

  if (text.startsWith('/users')) {
    const rows = listAllBindings();
    if (!rows.length) {
      await sendMessage(chatId, 'Привязок нет.');
      return;
    }
    const body = rows
      .map((r) => {
        const camps = r.campaigns.map((c) => `${c.name}${c.ftdRate > 0 ? ` $${c.ftdRate}` : ''}`).join(', ');
        return `<code>${r.tgId}</code> → ${camps}`;
      })
      .join('\n');
    await sendMessage(chatId, `<b>👥 Привязки</b>\n\n${body}`);
    return;
  }

  if (text.startsWith('/s2s')) {
    await sendMessage(
      chatId,
      `<b>S2S URL</b>\n\n<code>${s2sWebhookUrl()}</code>\n\nRevenue из Keitaro в отчёты не попадает.`,
    );
    return;
  }

  if (text.startsWith('/ping')) {
    await sendMessage(chatId, `OK · ${dayKeyNow()}`);
  }
}

export async function handleKeitaroS2s(searchParams: URLSearchParams): Promise<{ ok: boolean; message: string }> {
  const campaign = normalizeCampaign(searchParams.get('campaign') || searchParams.get('campaign_name') || '');
  const status = (searchParams.get('status') || '').trim();
  const subid = (searchParams.get('subid') || '').trim();

  if (!campaign || !status) {
    return { ok: false, message: 'missing campaign or status' };
  }

  const kind = classifyStatus(status);
  if (kind === 'other') {
    return { ok: true, message: `ignored status: ${status}` };
  }

  const dayKey = dayKeyNow();
  const dedupKey = `${subid || 'nosub'}:${status.toLowerCase()}:${campaign}`;
  const recorded = await recordConversion({
    campaign,
    dayKey,
    kind,
    dedupKey,
  });

  if (!recorded) {
    return { ok: true, message: 'duplicate' };
  }

  const text = alertMessage(kind, campaign);
  const recipients = alertRecipients(campaign);

  let sent = 0;
  for (const tgId of recipients) {
    try {
      await sendMessage(tgId, text);
      sent++;
    } catch (e) {
      console.error('send alert failed', tgId, e);
    }
  }

  return { ok: true, message: `recorded ${kind}, sent ${sent}` };
}
