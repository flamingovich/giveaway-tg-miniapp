/**
 * Ответ KV при опросе + локальный React state: сервер — источник правды по id,
 * но розыгрыши, созданные недавно и ещё не попавшие в ответ (гонка записи/чтения),
 * сохраняются из `local`.
 */
export function mergeServerWithOptimisticLocal<T extends { id: string; createdAt?: number }>(
  local: T[],
  server: T[],
  optimisticMaxAgeMs = 300_000
): T[] {
  const now = Date.now();
  const byId = new Map<string, T>();

  for (const c of server) {
    if (c && typeof c.id === 'string') byId.set(c.id, c);
  }

  for (const c of local) {
    if (!c || typeof c.id !== 'string') continue;
    if (byId.has(c.id)) continue;
    const age = now - Number(c.createdAt || 0);
    if (age >= 0 && age < optimisticMaxAgeMs) {
      byId.set(c.id, c);
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
  return merged;
}

/** Объединяет два списка розыгрышей по id без удаления: второй список накладывается поверх первого. */
export function mergeContestsNoDelete(current: any[], incoming: any[]): any[] {
  const byId = new Map<string, any>();

  for (const contest of current) {
    if (contest && typeof contest.id === 'string') {
      byId.set(contest.id, contest);
    }
  }

  for (const contest of incoming) {
    if (contest && typeof contest.id === 'string') {
      const prev = byId.get(contest.id) ?? {};
      const prevHasFrozenWinners =
        prev?.isCompleted === true &&
        Array.isArray(prev?.winners) &&
        prev.winners.length > 0;
      const nextHasWinners =
        Array.isArray(contest?.winners) && contest.winners.length > 0;

      // Победители завершённого розыгрыша фиксируются после первого сохранения:
      // не позволяем последующим конкурентным клиентским записям их перезаписывать.
      if (prevHasFrozenWinners && contest?.isCompleted === true && nextHasWinners) {
        byId.set(contest.id, {
          ...prev,
          ...contest,
          isCompleted: true,
          winners: prev.winners,
          seed: prev.seed ?? contest.seed,
        });
        continue;
      }

      byId.set(contest.id, { ...prev, ...contest });
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
  return merged;
}
