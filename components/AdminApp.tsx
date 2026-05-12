import React, { useCallback, useEffect, useState } from 'react';
import { TrashIcon, ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

const TOKEN_KEY = 'ludovar_web_admin_token';

type ContestRow = { id?: string; title?: string; createdAt?: number };

export function AdminApp() {
  const [token, setTokenState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [users, setUsers] = useState<number[]>([]);
  const [contests, setContests] = useState<ContestRow[]>([]);
  const [loadErr, setLoadErr] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState('');
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  const persistToken = (t: string | null) => {
    setTokenState(t);
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  };

  const authHeaders = useCallback(
    (): HeadersInit => ({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    }),
    [token]
  );

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoadingData(true);
    setLoadErr('');
    try {
      const [uRes, cRes] = await Promise.all([
        fetch('/api/admin?op=users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin?op=contests', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (uRes.status === 401 || cRes.status === 401) {
        persistToken(null);
        setLoadErr('Сессия истекла. Войдите снова.');
        return;
      }
      if (!uRes.ok || !cRes.ok) {
        setLoadErr('Не удалось загрузить данные');
        return;
      }
      const uJson = await uRes.json();
      const cJson = await cRes.json();
      setUsers(Array.isArray(uJson.users) ? uJson.users : []);
      setContests(Array.isArray(cJson.contests) ? cJson.contests : []);
    } catch {
      setLoadErr('Ошибка сети');
    } finally {
      setLoadingData(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        setLoginError(typeof data.error === 'string' ? data.error : 'Ошибка входа');
        return;
      }
      persistToken(data.token);
      setPassword('');
    } catch {
      setLoginError('Ошибка сети');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleBroadcast = async () => {
    if (!token || !broadcastText.trim()) return;
    setBroadcastLoading(true);
    setBroadcastStatus('');
    try {
      const res = await fetch('/api/admin?op=broadcast', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ text: broadcastText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        persistToken(null);
        setBroadcastStatus('Сессия истекла');
        return;
      }
      if (!res.ok) {
        setBroadcastStatus(typeof data.error === 'string' ? data.error : 'Ошибка');
        return;
      }
      setBroadcastStatus(`Отправлено: ${data.sent}, ошибок: ${data.failed} (в базе: ${data.total})`);
      setBroadcastText('');
    } catch {
      setBroadcastStatus('Ошибка сети');
    } finally {
      setBroadcastLoading(false);
    }
  };

  const deleteContest = async (id: string) => {
    if (!token || !confirm('Удалить этот розыгрыш?')) return;
    try {
      const res = await fetch('/api/admin?op=delete-contest', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ id }),
      });
      if (res.status === 401) {
        persistToken(null);
        return;
      }
      if (!res.ok) return;
      setContests((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* ignore */
    }
  };

  const webhookUrl = `${window.location.origin}/api/webhook`;

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-[#e2e2e6] flex items-center justify-center p-4 font-sans">
        <form
          onSubmit={(e) => void handleLogin(e)}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-[#1c1c1e] p-6 shadow-xl"
        >
          <h1 className="text-center text-lg font-black uppercase tracking-widest text-[#C5A059]">Админка</h1>
          <p className="text-center text-[11px] uppercase tracking-wide text-white/40">Вход</p>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Логин"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#C5A059]/50"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-[#C5A059]/50"
          />
          {loginError ? <p className="text-center text-xs text-red-400">{loginError}</p> : null}
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full rounded-xl bg-[#C5A059] py-3 text-xs font-black uppercase tracking-wide text-[#0d0d0d] disabled:opacity-40"
          >
            {loginLoading ? '…' : 'Войти'}
          </button>
          <p className="text-center text-[10px] text-white/30">Webhook бота (для Telegram):</p>
          <code className="block break-all rounded-lg bg-black/50 px-2 py-2 text-[10px] text-[#C5A059]/90">{webhookUrl}</code>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#e2e2e6] font-sans pb-10">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0d0d0d]/95 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-[#C5A059]">Ludovar • админ</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loadingData}
              className="rounded-lg border border-white/15 p-2 text-white/70 hover:bg-white/5 disabled:opacity-40"
              aria-label="Обновить"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loadingData ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => persistToken(null)}
              className="rounded-lg border border-white/15 px-3 py-2 text-[11px] font-bold uppercase text-white/60 hover:bg-white/5"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 pt-6">
        <section className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-4">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-[#C5A059]">Webhook Telegram</h2>
          <p className="mb-2 text-[11px] text-white/45">
            Укажи в BotFather / setWebhook этот URL — тогда бот будет получать /start и команды админа на сервер.
          </p>
          <code className="block break-all rounded-lg bg-black/50 px-3 py-2 text-[11px] text-emerald-300/90">{webhookUrl}</code>
        </section>

        {loadErr ? <p className="text-center text-sm text-amber-400">{loadErr}</p> : null}

        <section className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-4">
          <h2 className="mb-3 text-xs font-black uppercase tracking-wider text-[#C5A059]">
            Пользователи ({users.length})
          </h2>
          <p className="mb-2 text-[11px] text-white/45">
            ID из мини-приложения и из лички бота (/start через webhook).
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg bg-black/40 p-2 text-[11px] font-mono text-white/70 custom-admin-scroll">
            {users.length === 0 ? (
              <span className="text-white/35">Пока пусто</span>
            ) : (
              users.map((id) => <div key={id}>{id}</div>)
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#C5A059]">
            <PaperAirplaneIcon className="h-4 w-4" />
            Рассылка в личку
          </h2>
          <textarea
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            rows={4}
            placeholder="Текст сообщения всем из списка…"
            className="mb-3 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#C5A059]/40"
          />
          <button
            type="button"
            disabled={broadcastLoading || !broadcastText.trim()}
            onClick={() => void handleBroadcast()}
            className="w-full rounded-xl bg-[#C5A059] py-3 text-xs font-black uppercase text-[#0d0d0d] disabled:opacity-40"
          >
            {broadcastLoading ? 'Отправка…' : 'Отправить всем'}
          </button>
          {broadcastStatus ? <p className="mt-2 text-center text-[11px] text-emerald-400/90">{broadcastStatus}</p> : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-4">
          <h2 className="mb-3 text-xs font-black uppercase tracking-wider text-[#C5A059]">Розыгрыши</h2>
          <div className="space-y-2">
            {contests.length === 0 ? (
              <p className="text-[11px] text-white/35">Нет розыгрышей</p>
            ) : (
              contests.map((c, idx) => (
                <div
                  key={c.id ?? `row-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/30 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white/90">{c.title || 'Без названия'}</div>
                    <div className="font-mono text-[10px] text-white/40">{c.id}</div>
                  </div>
                  {c.id ? (
                    <button
                      type="button"
                      onClick={() => void deleteContest(c.id!)}
                      className="shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                      aria-label="Удалить"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </main>
      <style>{`
        .custom-admin-scroll::-webkit-scrollbar { width: 6px; }
        .custom-admin-scroll::-webkit-scrollbar-thumb { background: rgba(197, 160, 89, 0.3); border-radius: 6px; }
      `}</style>
    </div>
  );
}
