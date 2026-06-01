import 'dotenv/config';
import { telegramWebhookUrl } from '../src/config.js';
import { getWebhookInfo, setWebhook } from '../src/telegram.js';

const url = telegramWebhookUrl();
await setWebhook(url);
const info = await getWebhookInfo();
console.log('Webhook URL:', url);
console.log('Telegram reports:', info.url || '(empty)');
