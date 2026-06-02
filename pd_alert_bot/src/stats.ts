import { config } from './config.js';

export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'all';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: 'Сегодня',
  yesterday: 'Вчера',
  week: '7 дней',
  month: '30 дней',
  all: 'Всё время',
};

export function periodLabel(key: PeriodKey): string {
  return PERIOD_LABELS[key];
}

function formatDayInTz(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

function shiftDay(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function dayKeyNow(): string {
  return formatDayInTz(new Date());
}

export function periodRange(key: PeriodKey): { from: string; to: string } | null {
  const today = dayKeyNow();
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = shiftDay(today, -1);
      return { from: y, to: y };
    }
    case 'week':
      return { from: shiftDay(today, -6), to: today };
    case 'month':
      return { from: shiftDay(today, -29), to: today };
    case 'all':
      return null;
  }
}

export function formatMoney(value: number): string {
  return `$${value.toFixed(value % 1 === 0 ? 0 : 2)}`;
}

export function formatStatsBlock(
  campaign: string,
  period: PeriodKey,
  stats: { reg: number; ftd: number },
  opts?: { ftdRate?: number; outstanding?: number },
): string {
  const cr = stats.reg > 0 ? ((stats.ftd / stats.reg) * 100).toFixed(1) : '0.0';
  const lines = [
    `<b>📊 ${campaign}</b>`,
    `<i>${periodLabel(period)}</i>`,
    '',
    `REG: <b>${stats.reg}</b>`,
    `FTD: <b>${stats.ftd}</b>`,
    `Reg→Dep: <b>${cr}%</b>`,
  ];
  if (opts?.ftdRate !== undefined && opts.ftdRate > 0) {
    lines.push(`Ставка: <b>${formatMoney(opts.ftdRate)}</b>/FTD`);
    if (opts.outstanding !== undefined) {
      lines.push(`К выплате: <b>${formatMoney(opts.outstanding)}</b>`);
    }
  }
  return lines.join('\n');
}

export function statsKeyboard(scope: 'user' | 'admin', campaign?: string) {
  const prefix = scope === 'admin' ? 'adm' : 'usr';
  const camp = campaign ? `:${campaign}` : '';
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [
      { text: 'Сегодня', callback_data: `${prefix}:stats:today${camp}` },
      { text: 'Вчера', callback_data: `${prefix}:stats:yesterday${camp}` },
    ],
    [
      { text: '7 дней', callback_data: `${prefix}:stats:week${camp}` },
      { text: '30 дней', callback_data: `${prefix}:stats:month${camp}` },
    ],
    [{ text: 'Всё время', callback_data: `${prefix}:stats:all${camp}` }],
  ];
  return { inline_keyboard: rows };
}

function formatAlertDateTime(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: config.timezone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  let month = (parts.find((p) => p.type === 'month')?.value ?? '').replace(/\s*г\.?\s*$/i, '').trim();
  if (month && !month.endsWith('.')) month += '.';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
  return `${day} ${month} ${year}, ${hour}:${minute}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function alertMessage(kind: 'reg' | 'ftd', campaign: string): string {
  const title = kind === 'reg' ? '<b>➕Регистрация</b>' : '<b>🚨 ➕ФД</b>';
  const when = formatAlertDateTime();
  return [title, `<code>${escapeHtml(campaign)}</code>`, '', `<i>${when}</i>`].join('\n');
}
