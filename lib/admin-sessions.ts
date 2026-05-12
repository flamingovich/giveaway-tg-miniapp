import { randomBytes } from 'node:crypto';

const sessions = new Map<string, number>();

function pruneSessions() {
  const now = Date.now();
  for (const [t, exp] of sessions) {
    if (exp < now) sessions.delete(t);
  }
}

export function createAdminSession(): string {
  pruneSessions();
  const token = randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + 7 * 24 * 3600 * 1000);
  return token;
}

export function validateAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;
  pruneSessions();
  const exp = sessions.get(token);
  if (!exp || exp < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}
