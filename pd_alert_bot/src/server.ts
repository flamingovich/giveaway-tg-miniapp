import http from 'node:http';
import { config, HTTP_PREFIX, telegramWebhookUrl } from './config.js';
import { loadState } from './db.js';
import { handleKeitaroS2s, handleTelegramUpdate } from './handlers.js';
import { deleteWebhook, startTelegramPolling } from './polling.js';
import { getWebhookInfo, setWebhook } from './telegram.js';

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function checkSecret(url: URL): boolean {
  return url.searchParams.get('secret') === config.webhookSecret;
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname === `${HTTP_PREFIX}/telegram` && req.method === 'POST') {
      if (!checkSecret(url)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      try {
        const body = await readBody(req);
        const update = JSON.parse(body);
        await handleTelegramUpdate(update);
        res.writeHead(200).end('ok');
      } catch (e) {
        console.error('telegram webhook error', e);
        res.writeHead(200).end('ok');
      }
      return;
    }

    if (url.pathname === `${HTTP_PREFIX}/s2s` && (req.method === 'GET' || req.method === 'POST')) {
      if (!checkSecret(url)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      try {
        const result = await handleKeitaroS2s(url.searchParams);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        console.error('s2s error', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: 'error' }));
      }
      return;
    }

    res.writeHead(404).end('not found');
  });
}

export async function bootstrap() {
  await loadState();
  const server = createServer();
  server.listen(config.port, () => {
    console.log(`pd_alert_bot listening on :${config.port}`);
    if (config.usePolling) {
      console.log('telegram: polling mode (local dev)');
    } else {
      console.log(`telegram webhook: ${telegramWebhookUrl()}`);
    }
    console.log(`s2s test: ${config.publicUrl}${HTTP_PREFIX}/s2s?secret=...`);
  });

  if (config.usePolling) {
    await deleteWebhook();
    startTelegramPolling();
  } else if (process.env.AUTO_SET_WEBHOOK === '1') {
    try {
      await setWebhook(telegramWebhookUrl());
      const info = await getWebhookInfo();
      console.log('webhook set:', info.url);
    } catch (e) {
      console.error('failed to set webhook', e);
    }
  }
}
