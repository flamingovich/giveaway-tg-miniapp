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
};

export type CampaignBinding = {
  tgId: number;
  ftdRate: number;
};

export type BotState = {
  /** campaign -> привязки */
  links: Record<string, CampaignBinding[]>;
  fullAccessIds: number[];
  daily: Record<string, Record<string, DayStats>>;
  dedup: string[];
};

const emptyState = (): BotState => ({
  links: {},
  fullAccessIds: [],
  daily: {},
  dedup: [],
});

let state: BotState = emptyState();
let writeChain: Promise<void> = Promise.resolve();

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

function migrateLegacy(raw: Record<string, unknown>): BotState {
  const base = emptyState();
  if (raw.fullAccessIds && Array.isArray(raw.fullAccessIds)) {
    base.fullAccessIds = raw.fullAccessIds.map(Number).filter((n) => Number.isFinite(n));
  }
  if (raw.dedup && Array.isArray(raw.dedup)) base.dedup = raw.dedup as string[];

  if (raw.daily && typeof raw.daily === 'object') {
    for (const [camp, days] of Object.entries(raw.daily as Record<string, Record<string, { reg?: number; ftd?: number }>>)) {
      base.daily[camp] = {};
      for (const [day, s] of Object.entries(days)) {
        base.daily[camp][day] = { reg: s.reg ?? 0, ftd: s.ftd ?? 0 };
      }
    }
  }

  if (raw.links && typeof raw.links === 'object') {
    for (const [camp, list] of Object.entries(raw.links as Record<string, CampaignBinding[]>)) {
      base.links[camp.toUpperCase()] = (list || []).map((b) => ({
        tgId: Number(b.tgId),
        ftdRate: Number(b.ftdRate) || 0,
      }));
    }
    return base;
  }

  // legacy: bindings[tgId] = string[]
  const legacy = raw.bindings as Record<string, string[]> | undefined;
  if (legacy) {
    for (const [tgIdStr, campaigns] of Object.entries(legacy)) {
      const tgId = Number(tgIdStr);
      for (const c of campaigns || []) {
        const camp = c.toUpperCase();
        if (!base.links[camp]) base.links[camp] = [];
        if (!base.links[camp].some((b) => b.tgId === tgId)) {
          base.links[camp].push({ tgId, ftdRate: 0 });
        }
      }
    }
  }

  return base;
}

function seedInitialBindings(target: BotState) {
  for (const [tgId, campaigns] of Object.entries(config.initialBindings)) {
    for (const c of campaigns) {
      const camp = c.toUpperCase();
      if (!target.links[camp]) target.links[camp] = [];
      const id = Number(tgId);
      if (!target.links[camp].some((b) => b.tgId === id)) {
        target.links[camp].push({ tgId: id, ftdRate: 0 });
      }
    }
  }
}

export async function loadState() {
  await ensureDataDir();
  try {
    const raw = JSON.parse(await readFile(STATE_FILE, 'utf8')) as Record<string, unknown>;
    state = migrateLegacy(raw);
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

export function getFullAccessIds(): number[] {
  return [...state.fullAccessIds].sort((a, b) => a - b);
}

export async function addFullAccess(tgId: number) {
  if (!state.fullAccessIds.includes(tgId)) {
    state.fullAccessIds.push(tgId);
    state.fullAccessIds.sort((a, b) => a - b);
    await queuePersist();
  }
}

export async function removeFullAccess(tgId: number) {
  state.fullAccessIds = state.fullAccessIds.filter((id) => id !== tgId);
  await queuePersist();
}

export function getBinding(campaign: string, tgId: number): CampaignBinding | undefined {
  const camp = campaign.toUpperCase();
  return state.links[camp]?.find((b) => b.tgId === tgId);
}

export function getBindingsForCampaign(campaign: string): number[] {
  const camp = campaign.toUpperCase();
  return (state.links[camp] || []).map((b) => b.tgId);
}

export function getUserCampaigns(tgId: number): string[] {
  const out: string[] = [];
  for (const [camp, list] of Object.entries(state.links)) {
    if (list.some((b) => b.tgId === tgId)) out.push(camp);
  }
  return out.sort();
}

export function listByCampaign(): Array<{ campaign: string; entries: CampaignBinding[] }> {
  return Object.entries(state.links)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([campaign, entries]) => ({
      campaign,
      entries: [...entries].sort((a, b) => a.tgId - b.tgId),
    }));
}

export async function addUserToCampaign(campaign: string, tgId: number, ftdRate = 0) {
  const camp = campaign.toUpperCase();
  if (!state.links[camp]) state.links[camp] = [];
  const existing = state.links[camp].find((b) => b.tgId === tgId);
  if (existing) {
    if (ftdRate > 0) existing.ftdRate = ftdRate;
  } else {
    state.links[camp].push({ tgId, ftdRate });
    state.links[camp].sort((a, b) => a.tgId - b.tgId);
  }
  await queuePersist();
}

export async function setFtdRate(campaign: string, tgId: number, ftdRate: number) {
  const camp = campaign.toUpperCase();
  const entry = state.links[camp]?.find((b) => b.tgId === tgId);
  if (entry) {
    entry.ftdRate = Math.max(0, ftdRate);
    await queuePersist();
    return true;
  }
  return false;
}

export async function unbindUserFromCampaign(tgId: number, campaign: string) {
  const camp = campaign.toUpperCase();
  if (!state.links[camp]) return;
  state.links[camp] = state.links[camp].filter((b) => b.tgId !== tgId);
  if (state.links[camp].length === 0) delete state.links[camp];
  await queuePersist();
}

export async function unbindUser(tgId: number) {
  for (const camp of Object.keys(state.links)) {
    state.links[camp] = state.links[camp].filter((b) => b.tgId !== tgId);
    if (state.links[camp].length === 0) delete state.links[camp];
  }
  await queuePersist();
}

export async function bindUser(tgId: number, campaigns: string[]) {
  for (const c of campaigns) await addUserToCampaign(c, tgId);
}

export async function replaceUserCampaigns(tgId: number, campaigns: string[]) {
  await unbindUser(tgId);
  for (const c of campaigns) await addUserToCampaign(c, tgId);
}

export function listAllBindings(): Array<{ tgId: number; campaigns: Array<{ name: string; ftdRate: number }> }> {
  const map = new Map<number, Array<{ name: string; ftdRate: number }>>();
  for (const [camp, list] of Object.entries(state.links)) {
    for (const b of list) {
      if (!map.has(b.tgId)) map.set(b.tgId, []);
      map.get(b.tgId)!.push({ name: camp, ftdRate: b.ftdRate });
    }
  }
  return [...map.entries()]
    .map(([tgId, campaigns]) => ({ tgId, campaigns: campaigns.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.tgId - b.tgId);
}

function ensureDayBucket(campaign: string, dayKey: string): DayStats {
  if (!state.daily[campaign]) state.daily[campaign] = {};
  if (!state.daily[campaign][dayKey]) {
    state.daily[campaign][dayKey] = { reg: 0, ftd: 0 };
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
  dedupKey: string;
}) {
  if (config.dedupEnabled && isDuplicate(params.dedupKey)) return false;

  const bucket = ensureDayBucket(params.campaign, params.dayKey);
  if (params.kind === 'reg') bucket.reg += 1;
  if (params.kind === 'ftd') bucket.ftd += 1;

  if (config.dedupEnabled) {
    state.dedup.push(params.dedupKey);
    if (state.dedup.length > 20000) state.dedup = state.dedup.slice(-15000);
  }

  await queuePersist();
  return true;
}

export function getKnownCampaigns(): string[] {
  const set = new Set<string>(Object.keys(state.links));
  for (const c of Object.keys(state.daily)) set.add(c);
  return [...set].sort();
}

export function aggregateStats(campaign: string, fromDay: string, toDay: string): DayStats {
  const days = state.daily[campaign] || {};
  const out: DayStats = { reg: 0, ftd: 0 };
  for (const [day, stats] of Object.entries(days)) {
    if (day >= fromDay && day <= toDay) {
      out.reg += stats.reg;
      out.ftd += stats.ftd;
    }
  }
  return out;
}

export function sumAllDays(campaign: string): DayStats {
  const days = state.daily[campaign] || {};
  const out: DayStats = { reg: 0, ftd: 0 };
  for (const stats of Object.values(days)) {
    out.reg += stats.reg;
    out.ftd += stats.ftd;
  }
  return out;
}

/** Заработок по ставкам из привязок (не revenue из Keitaro) */
export function earningsForCampaign(campaign: string, ftdCount: number, tgId?: number): number {
  const camp = campaign.toUpperCase();
  const list = state.links[camp] || [];
  if (tgId !== undefined) {
    const b = list.find((x) => x.tgId === tgId);
    return (b?.ftdRate ?? 0) * ftdCount;
  }
  return list.reduce((sum, b) => sum + b.ftdRate * ftdCount, 0);
}
