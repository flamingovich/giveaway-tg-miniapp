import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

const PORT = Number(process.env.API_PORT || 8787);

async function incomingToRequest(req: IncomingMessage, baseUrl: string): Promise<Request> {
  const url = new URL(req.url || '/', baseUrl);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else headers.set(k, v);
  }

  let body: BodyInit | undefined;
  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = chunks.length ? Buffer.concat(chunks) : undefined;
  }

  return new Request(url, { method: req.method, headers, body });
}

async function sendWebResponse(webRes: Response, res: ServerResponse) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });

  if (!webRes.body) {
    res.end();
    return;
  }

  Readable.fromWeb(webRes.body as import('node:stream/web').ReadableStream).pipe(res);
}

const routeLoaders: Record<string, () => Promise<{ default: (req: Request) => Promise<Response> }>> = {
  '/api/kv': () => import('../api/kv.ts'),
  '/api/participate': () => import('../api/participate.ts'),
  '/api/notify': () => import('../api/notify.ts'),
  '/api/webhook': () => import('../api/webhook.ts'),
  '/api/dev-auth': () => import('../api/dev-auth.ts'),
  '/api/admin-login': () => import('../api/admin-login.ts'),
  '/api/admin': () => import('../api/admin.ts'),
};

createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || '/', `http://127.0.0.1`).pathname;
    const loader = routeLoaders[pathname];

    if (!loader) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    const baseUrl = `http://127.0.0.1:${PORT}`;
    const webReq = await incomingToRequest(req, baseUrl);
    const mod = await loader();
    const webRes = await mod.default(webReq);
    await sendWebResponse(webRes, res);
  } catch (e) {
    console.error('API server error:', e);
    if (!res.headersSent) res.statusCode = 500;
    res.end('Internal Server Error');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[api] http://127.0.0.1:${PORT}`);
});
