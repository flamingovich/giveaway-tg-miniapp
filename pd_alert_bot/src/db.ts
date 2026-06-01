import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

export type DayStats = {
  reg: number;
  ftd: number;
  revenue: number;
};

export type BotState = {
  bindings: Record<string, string[]>;
  daily: Record<string, Record<string, DayStats>>;
  dedup: string[];
};

const emptyState = (): BotState => ({
  bindings: {},
  daily: {},
  dedup: [],
});

let state: BotState = emptyState();
let writeChain: Promise<void> = Promise.resolve();

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

function seedInitialBindings(target: BotState) {
  for (const [tgId, campaigns] of Object.entries(config.initialBindings)) {
    const key = String(tgId);
    const existing = new Set(target.bindings[key] || []);
    for (const c of campaigns) existing.add(c);
    target.bindings[key] = [...existing];
  }
}

export async function loadState() {
  await ensureDataDir();
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    state = { ...emptyState(), ...(JSON.parse(raw) as BotState) };
  } catch {
    state = emptyState();
  }
  seedInitialBindings(state);
  await persistState();
}

async function persistState() {
  await ensureDataDir();
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function queuePersist() {
  writeChain = writeChain.then(() => persistState()).catch(console.error);
  return writeChain;
}

export function getBindingsForCampaign(campaign: string): number[] {
  const normalized = campaign.toUpperCase();
  const ids: number[] = [];
  for (const [tgId, campaigns] of Object.entries(state.bindings)) {
    if (campaigns.some((c) => c.toUpperCase() === normalized)) {
      ids.push(Number(tgId));
    }
  }
  return ids;
}

export function getUserCampaigns(tgId: number): string[] {
  return state.bindings[String(tgId)] || [];
}

export function listAllBindings(): Array<{ tgId: number; campaigns: string[] }> {
  return Object.entries(state.bindings)
    .map(([tgId, campaigns]) => ({ tgId: Number(tgId), campaigns: [...campaigns].sort() }))
    .sort((a, b) => a.tgId - b.tgId);
}

export async function bindUser(tgId: number, campaigns: string[]) {
  const key = String(tgId);
  const merged = new Set([...(state.bindings[key] || []), ...campaigns]);
  state.bindings[key] = [...merged].sort();
  await queuePersist();
}

export async function unbindUser(tgId: number) {
  delete state.bindings[String(tgId)];
  await queuePersist();
}

export async function unbindUserFromCampaign(tgId: number, campaign: string) {
  const key = String(tgId);
  const normalized = campaign.toUpperCase();
  const next = (state.bindings[key] || []).filter((c) => c.toUpperCase() !== normalized);
  if (next.length === 0) delete state.bindings[key];
  else state.bindings[key] = next.sort();
  await queuePersist();
}

export async function addUserToCampaign(campaign: string, tgId: number) {
  await bindUser(tgId, [campaign]);
}

export function listByCampaign(): Array<{ campaign: string; tgIds: number[] }> {
  const map = new Map<string, Set<number>>();
  for (const [tgId, campaigns] of Object.entries(state.bindings)) {
    for (const c of campaigns) {
      const key = c.toUpperCase();
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(Number(tgId));
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([campaign, ids]) => ({ campaign, tgIds: [...ids].sort((a, b) => a - b) }));
}

export async function replaceUserCampaigns(tgId: number, campaigns: string[]) {
  const key = String(tgId);
  if (campaigns.length === 0) {
    delete state.bindings[key];
  } else {
    state.bindings[key] = [...new Set(campaigns)].sort();
  }
  await queuePersist();
}

function ensureDayBucket(campaign: string, dayKey: string): DayStats {
  if (!state.daily[campaign]) state.daily[campaign] = {};
  if (!state.daily[campaign][dayKey]) {
    state.daily[campaign][dayKey] = { reg: 0, ftd: 0, revenue: 0 };
  }
  return state.daily[campaign][dayKey];
}

export function isDuplicate(dedupKey: string): boolean {
  return state.dedup.includes(dedupKey);
}

export async function recordConversion(params: {
  campaign: string;
  dayKey: string;
  kind: 'reg' | 'ftd';
  revenue: number;
  dedupKey: string;
}) {
  if (config.dedupEnabled && isDuplicate(params.dedupKey)) return false;

  const bucket = ensureDayBucket(params.campaign, params.dayKey);
  if (params.kind === 'reg') bucket.reg += 1;
  if (params.kind === 'ftd') {
    bucket.ftd += 1;
    bucket.revenue += params.revenue;
  }

  if (config.dedupEnabled) {
    state.dedup.push(params.dedupKey);
    if (state.dedup.length > 20000) {
      state.dedup = state.dedup.slice(-15000);
    }
  }

  await queuePersist();
  return true;
}

export function getKnownCampaigns(): string[] {
  const set = new Set<string>();
  for (const campaigns of Object.values(state.bindings)) {
    for (const c of campaigns) set.add(c);
  }
  for (const campaign of Object.keys(state.daily)) set.add(campaign);
  return [...set].sort();
}

export function aggregateStats(campaign: string, fromDay: string, toDay: string): DayStats {
  const days = state.daily[campaign] || {};
  const out: DayStats = { reg: 0, ftd: 0, revenue: 0 };
  for (const [day, stats] of Object.entries(days)) {
    if (day >= fromDay && day <= toDay) {
      out.reg += stats.reg;
      out.ftd += stats.ftd;
      out.revenue += stats.revenue;
    }
  }
  return out;
}

export function sumAllDays(campaign: string): DayStats {
  const days = state.daily[campaign] || {};
  const out: DayStats = { reg: 0, ftd: 0, revenue: 0 };
  for (const stats of Object.values(days)) {
    out.reg += stats.reg;
    out.ftd += stats.ftd;
    out.revenue += stats.revenue;
  }
  return out;
}
