import { handleTelegramUpdate } from './handlers.js';
import { tgApi } from './telegram.js';

export async function deleteWebhook() {
  await tgApi('deleteWebhook', { drop_pending_updates: true });
}

export function startTelegramPolling() {
  let offset = 0;
  let running = true;

  const tick = async () => {
    while (running) {
      try {
        const updates = await tgApi<Array<Record<string, unknown>>>('getUpdates', {
          offset,
          timeout: 25,
          allowed_updates: ['message', 'callback_query'],
        });
        for (const update of updates) {
          const id = Number(update.update_id);
          if (Number.isFinite(id)) offset = id + 1;
          await handleTelegramUpdate(update);
        }
      } catch (e) {
        console.error('polling error', e);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  };

  void tick();

  return () => {
    running = false;
  };
}
