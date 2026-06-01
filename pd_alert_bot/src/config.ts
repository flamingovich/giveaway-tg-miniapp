import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parseAdminIds(): Set<number> {
  const raw = required('ADMIN_IDS');
  return new Set(
    raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n)),
  );
}

function parseInitialBindings(): Record<number, string[]> {
  const raw = process.env.INITIAL_BINDINGS?.trim();
  if (!raw) return {};
  const out: Record<number, string[]> = {};
  for (const part of raw.split(',')) {
    const [idStr, ...campaignParts] = part.split(':');
    const tgId = Number(idStr?.trim());
    const campaign = normalizeCampaign(campaignParts.join(':'));
    if (!Number.isFinite(tgId) || !campaign) continue;
    out[tgId] = [...(out[tgId] || []), campaign];
  }
  return out;
}

export function normalizeCampaign(name: string): string {
  return name.trim().toUpperCase();
}

export type ConversionKind = 'reg' | 'ftd' | 'other';

export function classifyStatus(status: string): ConversionKind {
  const s = status.trim().toLowerCase();
  if (['registration', 'reg', 'lead', 'register'].includes(s)) return 'reg';
  if (['sale', 'deposit', 'dep', 'fdt', 'ftd', 'approved', 'confirm', 'done'].includes(s)) return 'ftd';
  return 'other';
}

export const HTTP_PREFIX = '/pd_alert_bot';

export const config = {
  botToken: required('TELEGRAM_BOT_TOKEN'),
  adminIds: parseAdminIds(),
  webhookSecret: required('WEBHOOK_SECRET'),
  port: Number(process.env.PORT || 8787),
  publicUrl: (process.env.PUBLIC_URL?.trim() || `http://localhost:${process.env.PORT || 8787}`).replace(/\/$/, ''),
  timezone: process.env.TIMEZONE?.trim() || 'Europe/Moscow',
  initialBindings: parseInitialBindings(),
  usePolling: process.env.USE_POLLING === '1',
  /** В dev (polling) дедуп выключен — можно гонять curl с одним subid */
  dedupEnabled: process.env.DISABLE_DEDUP === '1' ? false : process.env.USE_POLLING !== '1',
  adminPanelPassword: (process.env.ADMIN_PANEL_PASSWORD || process.env.WEBHOOK_SECRET || '').trim(),
  adminUsername: (process.env.ADMIN_USERNAME || 'admin').trim(),
  internalHost: process.env.INTERNAL_HOST?.trim() || '10.89.0.1',
};

export function telegramWebhookUrl(): string {
  return `${config.publicUrl}${HTTP_PREFIX}/telegram?secret=${encodeURIComponent(config.webhookSecret)}`;
}

export function s2sWebhookUrl(): string {
  const base = `${config.publicUrl}${HTTP_PREFIX}/s2s?secret=${encodeURIComponent(config.webhookSecret)}`;
  return `${base}&campaign={campaign_name}&status={status}&revenue={conversion_revenue}&subid={subid}`;
}

export function isAdmin(userId: number): boolean {
  return config.adminIds.has(userId);
}
