import { adminPanelUrl } from './admin-panel.js';
import { classifyStatus, config, isAdmin, normalizeCampaign, s2sWebhookUrl } from './config.js';
import {
  aggregateStats,
  addUserToCampaign,
  bindUser,
  getBindingsForCampaign,
  getKnownCampaigns,
  getUserCampaigns,
  listAllBindings,
  listByCampaign,
  recordConversion,
  replaceUserCampaigns,
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

async function sendCampaignStats(chatId: number, campaign: string, period: PeriodKey, scope: 'user' | 'admin') {
  const stats = statsForCampaign(campaign, period);
  await sendMessage(chatId, formatStatsBlock(campaign, period, stats), statsKeyboard(scope, campaign));
}

async function sendUserStatsMenu(chatId: number, userId: number) {
  const campaigns = getUserCampaigns(userId);
  if (campaigns.length === 0) {
    await sendMessage(chatId, 'У вас пока нет привязанных кампаний. Обратитесь к админу.');
    return;
  }
  if (campaigns.length === 1) {
    await sendCampaignStats(chatId, campaigns[0], 'today', 'user');
    return;
  }
  const lines = campaigns.map((c) => `• ${c}`).join('\n');
  await sendMessage(
    chatId,
    `<b>📊 Ваши кампании</b>\n\n${lines}\n\nВыберите период для первой кампании или напишите:\n<code>/stats PD_TANK</code>`,
    statsKeyboard('user', campaigns[0]),
  );
}

async function sendAdminOverview(chatId: number, period: PeriodKey) {
  const campaigns = getKnownCampaigns();
  if (campaigns.length === 0) {
    await sendMessage(chatId, 'Пока нет данных. Настройте /bind или дождитесь первого алерта.');
    return;
  }
  const blocks = campaigns.map((c) => {
    const stats = statsForCampaign(c, period);
    return `${c}: REG ${stats.reg} | FTD ${stats.ftd} | ${stats.revenue > 0 ? '$' + stats.revenue.toFixed(0) : '$0'}`;
  });
  await sendMessage(
    chatId,
    `<b>📊 Все кампании — ${periodLabel(period)}</b>\n\n${blocks.join('\n')}`,
    statsKeyboard('admin'),
  );
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
    await sendCampaignStats(chatId, normalizeCampaign(target), period, 'user');
    return;
  }

  if (parts[0] === 'adm' && parts[1] === 'stats' && isAdmin(cb.from.id)) {
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

  if (text.startsWith('/start')) {
    if (isAdmin(userId)) {
      await sendMessage(
        chatId,
        [
          '<b>PokerDom Alerts — админка</b>',
          '',
          '<b>Кампания → кому слать:</b>',
          '<code>/add PD_BIODEP 7946967720</code> — добавить',
          '<code>/del PD_BIODEP 7946967720</code> — убрать с кампании',
          '<code>/who PD_BIODEP</code> — кто получает алерты',
          '<code>/campaigns</code> — все кампании и люди',
          '',
          '<b>Прочее:</b>',
          `/admin — веб-админка (${adminPanelUrl()})`,
          '/stats — статистика',
          '/s2s — URL для Keitaro',
        ].join('\n'),
      );
    } else {
      const campaigns = getUserCampaigns(userId);
      if (campaigns.length) {
        await sendMessage(chatId, `Привет! Ваши кампании: <b>${campaigns.join(', ')}</b>\n\n/stats — статистика`);
      } else {
        await sendMessage(chatId, 'Привет! Кампания ещё не привязана. Напишите админу ваш Telegram ID.');
      }
    }
    return;
  }

  if (text.startsWith('/stats')) {
    const arg = parseArgs(text)[0];
    if (isAdmin(userId) && !arg) {
      await sendAdminOverview(chatId, 'today');
      return;
    }
    if (isAdmin(userId) && arg) {
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
      await sendCampaignStats(chatId, target, 'today', 'user');
      return;
    }
    await sendUserStatsMenu(chatId, userId);
    return;
  }

  if (!isAdmin(userId)) return;

  if (text.startsWith('/add')) {
    const args = parseArgs(text);
    if (args.length < 2) {
      await sendMessage(
        chatId,
        'Формат: <code>/add КАМПАНИЯ tg_id</code>\nПример: <code>/add PD_BIODEP 7946967720</code>',
      );
      return;
    }
    const campaign = normalizeCampaign(args[0]);
    const tgIds = args.slice(1).map(Number).filter((n) => Number.isFinite(n));
    if (!tgIds.length) {
      await sendMessage(chatId, 'Укажи tg_id после названия кампании');
      return;
    }
    for (const tgId of tgIds) await addUserToCampaign(campaign, tgId);
    await sendMessage(chatId, `✅ <b>${campaign}</b> → ${tgIds.map((id) => `<code>${id}</code>`).join(', ')}`);
    for (const tgId of tgIds) {
      try {
        await sendMessage(tgId, `Вам назначена кампания <b>${campaign}</b>\n\n/stats — статистика`);
      } catch {
        /* user must /start bot */
      }
    }
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
    const tgIds = getBindingsForCampaign(campaign);
    if (!tgIds.length) {
      await sendMessage(chatId, `<b>${campaign}</b>\n\nНикому не назначена. Добавь: <code>/add ${campaign} tg_id</code>`);
      return;
    }
    await sendMessage(
      chatId,
      `<b>${campaign}</b>\n\nАлерты получают:\n${tgIds.map((id) => `• <code>${id}</code>`).join('\n')}`,
    );
    return;
  }

  if (text.startsWith('/campaigns')) {
    const rows = listByCampaign();
    if (!rows.length) {
      await sendMessage(chatId, 'Кампаний нет. Добавь: <code>/add PD_BIODEP tg_id</code>');
      return;
    }
    const body = rows
      .map((r) => `<b>${r.campaign}</b>\n${r.tgIds.map((id) => `  • <code>${id}</code>`).join('\n')}`)
      .join('\n\n');
    await sendMessage(chatId, `<b>📋 Кампании</b>\n\n${body}`);
    return;
  }

  if (text.startsWith('/bind')) {
    const args = parseArgs(text);
    if (args.length < 2) {
      await sendMessage(chatId, 'Формат: <code>/bind tg_id CAMPAIGN [CAMPAIGN2]</code>\nПример: <code>/bind 7946967720 PD_BIODEP</code>');
      return;
    }
    const tgId = Number(args[0]);
    const campaigns = args.slice(1).map(normalizeCampaign);
    if (!Number.isFinite(tgId)) {
      await sendMessage(chatId, 'Неверный tg_id');
      return;
    }
    await bindUser(tgId, campaigns);
    await sendMessage(chatId, `✅ Привязано: <code>${tgId}</code> → <b>${campaigns.join(', ')}</b>`);
    try {
      await sendMessage(tgId, `Вам назначены кампании: <b>${campaigns.join(', ')}</b>\n\n/stats — статистика\nАлерты REG/FTD будут приходить сюда.`);
    } catch {
      await sendMessage(chatId, 'Привязка сохранена. Пользователь должен нажать /start в боте.');
    }
    return;
  }

  if (text.startsWith('/setbind')) {
    const args = parseArgs(text);
    if (args.length < 2) {
      await sendMessage(chatId, 'Формат: <code>/setbind tg_id CAMPAIGN [CAMPAIGN2]</code> — заменить список кампаний');
      return;
    }
    const tgId = Number(args[0]);
    const campaigns = args.slice(1).map(normalizeCampaign);
    if (!Number.isFinite(tgId)) {
      await sendMessage(chatId, 'Неверный tg_id');
      return;
    }
    await replaceUserCampaigns(tgId, campaigns);
    await sendMessage(chatId, `✅ Обновлено: <code>${tgId}</code> → <b>${campaigns.join(', ') || '—'}</b>`);
    return;
  }

  if (text.startsWith('/unbind')) {
    const args = parseArgs(text);
    const tgId = Number(args[0]);
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
    const body = rows.map((r) => `<code>${r.tgId}</code> → ${r.campaigns.join(', ')}`).join('\n');
    await sendMessage(chatId, `<b>👥 Привязки</b>\n\n${body}`);
    return;
  }

  if (text.startsWith('/s2s')) {
    await sendMessage(
      chatId,
      `<b>S2S URL для Keitaro</b>\n\nВставь в каждую кампанию → S2S postbacks:\n\n<code>${s2sWebhookUrl()}</code>\n\nСтатусы: registration, sale\nМетод: GET`,
    );
    return;
  }

  if (text.startsWith('/ping')) {
    await sendMessage(chatId, `OK · ${dayKeyNow()} · ${config.timezone}`);
  }
}

export async function handleKeitaroS2s(searchParams: URLSearchParams): Promise<{ ok: boolean; message: string }> {
  const campaign = normalizeCampaign(searchParams.get('campaign') || searchParams.get('campaign_name') || '');
  const status = (searchParams.get('status') || '').trim();
  const subid = (searchParams.get('subid') || '').trim();
  const revenueRaw = searchParams.get('revenue') || searchParams.get('payout') || '0';
  const revenue = Number(revenueRaw) || 0;

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
    revenue: kind === 'ftd' ? revenue : 0,
    dedupKey,
  });

  if (!recorded) {
    return {
      ok: true,
      message:
        'duplicate — этот subid уже был. Для теста: другой subid (test2) или npm run dev (дедуп выкл) или rm data/state.json',
    };
  }

  const text = alertMessage(kind, campaign);
  const recipients = getBindingsForCampaign(campaign);
  for (const adminId of config.adminIds) {
    if (!recipients.includes(adminId)) recipients.push(adminId);
  }

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
