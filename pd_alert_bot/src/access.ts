import { config } from './config.js';
import { getFullAccessIds } from './db.js';

export function isSuperAdmin(userId: number): boolean {
  return config.adminIds.has(userId);
}

/** Полный доступ в Telegram-боте (как супер-админ), без веб-админки */
export function hasBotAdmin(userId: number): boolean {
  if (isSuperAdmin(userId)) return true;
  return getFullAccessIds().includes(userId);
}
