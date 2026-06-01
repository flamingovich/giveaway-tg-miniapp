import { config } from './config.js';

export async function tgApi<T = unknown>(method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!data.ok) throw new Error(data.description || `Telegram API error: ${method}`);
  return data.result as T;
}

export async function sendMessage(chatId: number, text: string, replyMarkup?: unknown) {
  return tgApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function answerCallback(callbackQueryId: string, text?: string) {
  return tgApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

export async function setWebhook(url: string) {
  return tgApi('setWebhook', {
    url,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
}

export async function getWebhookInfo() {
  return tgApi<{ url?: string }>('getWebhookInfo');
}
