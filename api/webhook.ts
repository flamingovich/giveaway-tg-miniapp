
import { kvGet, kvSet } from '../lib/storage';

const USERS_LIST_KEY = 'beef_registered_users_list_v1';
const ADMIN_STATE_KEY = 'beef_admin_broadcast_state';
const ADMIN_ID = 7946967720;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      chat_id: chatId, 
      text, 
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    }),
  });
}

async function sendDocument(chatId: number, htmlContent: string, filename: string, caption: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('caption', caption);
  formData.append('parse_mode', 'Markdown');
  
  const blob = new Blob([htmlContent], { type: 'text/html' });
  formData.append('document', blob, filename);

  return fetch(url, {
    method: 'POST',
    body: formData,
  });
}

async function registerUserId(userId: number) {
  const users: number[] = (await kvGet<number[]>(USERS_LIST_KEY)) || [];
  if (!users.includes(userId)) {
    users.push(userId);
    await kvSet(USERS_LIST_KEY, users);
  }
}

async function getChatInfo(userId: number) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${userId}`);
    const data = await res.json();
    if (data.ok) {
      const firstName = data.result.first_name || '';
      const lastName = data.result.last_name || '';
      return {
        name: `${firstName} ${lastName}`.trim(),
        username: data.result.username ? `@${data.result.username}` : '—'
      };
    }
  } catch (e) {}
  return { name: `User ${userId}`, username: '—' };
}

function getFormattedTimestamp() {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = pad(now.getDate());
  const m = pad(now.getMonth() + 1);
  const y = now.getFullYear().toString().slice(-2);
  const h = pad(now.getHours());
  const min = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  return `${d}${m}${y}${h}${min}${s}`;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });
  if (!BOT_TOKEN) return new Response('Bot Token Not Set', { status: 500 });

  try {
    const update = await req.json();

    if (update.callback_query) {
      const cb = update.callback_query;
      const userId = cb.from.id;

      if (userId === ADMIN_ID && cb.data === 'detailed_stats') {
        const userIds: number[] = await kvGet(USERS_LIST_KEY) || [];
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cb.id, text: "Генерирую отчет..." })
        });

        let rowsHtml = '';
        const limit = Math.min(userIds.length, 200); 
        const usersToProcess = userIds.slice(-limit).reverse();

        for (const id of usersToProcess) {
          const info = await getChatInfo(id);
          rowsHtml += `
            <tr>
              <td>${id}</td>
              <td class="user-name">${info.name}</td>
              <td class="user-link">${info.username}</td>
            </tr>`;
        }

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Отчет BEEF • LUDOVAR</title>
            <style>
              body { background-color: #0d0d0d; color: #e2e2e6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; margin: 0; }
              .container { max-width: 900px; margin: 0 auto; }
              h1 { color: #C5A059; text-transform: uppercase; letter-spacing: 4px; text-align: center; margin-bottom: 10px; font-weight: 900; }
              .subtitle { text-align: center; opacity: 0.5; font-size: 12px; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 1px; }
              table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-top: 20px; }
              th { padding: 15px; text-align: left; color: #C5A059; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; font-weight: 900; border-bottom: 2px solid #C5A059; }
              td { padding: 12px 15px; background: #1c1c1e; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(0,0,0,0.2); }
              tr td:first-child { border-radius: 12px 0 0 12px; font-family: monospace; color: #555; font-size: 12px; }
              tr td:last-child { border-radius: 0 12px 12px 0; }
              .user-name { font-weight: 700; color: #fff; }
              .user-link { color: #C5A059; font-weight: 500; }
              tr:hover td { background-color: #242426; cursor: default; }
              .footer { margin-top: 40px; font-size: 10px; color: #333; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>BEEF • LUDOVAR</h1>
              <div class="subtitle">Отчет по пользователям | База: ${userIds.length} | Выборка: ${limit}</div>
              <table>
                <thead>
                  <tr>
                    <th>Telegram ID</th>
                    <th>Имя</th>
                    <th>Username</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
              <div class="footer">
                &copy; 2024 BEEF LUDOVAR SYSTEM • PRIVATE REPORT
              </div>
            </div>
          </body>
          </html>`;

        const uniqueFilename = `ludovar_club_${getFormattedTimestamp()}.html`;
        await sendDocument(ADMIN_ID, html, uniqueFilename, `📊 *Подробная статистика*\n\nВ файле информация о последних ${limit} активных пользователях.`);
        return new Response('OK', { status: 200 });
      }
      return new Response('OK', { status: 200 });
    }

    const message = update.message;
    if (!message || !message.from) return new Response('OK', { status: 200 });

    const userId = message.from.id;
    const text = message.text || '';
    const chatType = message.chat?.type;

    if (chatType === 'private' && typeof text === 'string' && text.trim().startsWith('/start')) {
      await registerUserId(userId);
    }

    if (userId !== ADMIN_ID) return new Response('OK', { status: 200 });

    if (text === '/start') {
        await sendMessage(ADMIN_ID, "👋 *Бот Лудовара на связи!*\n\nКоманды:\n/send — рассылка\n/stats — статистика");
        return new Response('OK', { status: 200 });
    }

    if (text === '/stats') {
      const userIds: number[] = await kvGet(USERS_LIST_KEY) || [];
      const statsText = `📊 *Статистика проекта*\n\n👥 Всего пользователей: *${userIds.length}*`;
      
      const replyMarkup = {
        inline_keyboard: [
          [{ text: '📄 Подробный отчет (HTML)', callback_data: 'detailed_stats' }]
        ]
      };

      await sendMessage(ADMIN_ID, statsText, replyMarkup);
      return new Response('OK', { status: 200 });
    }

    if (text === '/send') {
      await kvSet(ADMIN_STATE_KEY, { active: true });
      await sendMessage(ADMIN_ID, "📝 *Режим рассылки!*\n\nПришлите сообщение для рассылки.");
      return new Response('OK', { status: 200 });
    }

    const broadcastState = await kvGet(ADMIN_STATE_KEY);
    if (broadcastState && broadcastState.active) {
      await kvSet(ADMIN_STATE_KEY, { active: false });
      const userIds: number[] = await kvGet(USERS_LIST_KEY) || [];
      
      if (userIds.length === 0) {
        await sendMessage(ADMIN_ID, "❌ Нет пользователей.");
        return new Response('OK', { status: 200 });
      }

      await sendMessage(ADMIN_ID, `⌛ *Рассылка на ${userIds.length} чел...*`);
      let successCount = 0;
      let failCount = 0;

      for (const targetId of userIds) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/copyMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetId,
              from_chat_id: ADMIN_ID,
              message_id: message.message_id
            }),
          });
          if (res.ok) successCount++; else failCount++;
        } catch (e) { failCount++; }
      }

      await sendMessage(ADMIN_ID, `✅ *Готово!*\n\nДоставлено: ${successCount}\nОшибок: ${failCount}`);
      return new Response('OK', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    return new Response('OK', { status: 200 });
  }
}
