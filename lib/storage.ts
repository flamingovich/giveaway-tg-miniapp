import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeContestsNoDelete } from './merge-contests';

type StorageState = {
  beef_contests_v7_final: any[];
  beef_project_presets_v7: any[];
  beef_avatars_pool: string[];
  beef_registered_users_list_v1: number[];
  beef_admin_broadcast_state: { active: boolean };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STORAGE_PATH = resolve(__dirname, '../data/storage.json');

const DEFAULT_STATE: StorageState = {
  beef_contests_v7_final: [],
  beef_project_presets_v7: [],
  beef_avatars_pool: [],
  beef_registered_users_list_v1: [],
  beef_admin_broadcast_state: { active: false },
};

let writeChain: Promise<void> = Promise.resolve();

async function ensureStorageFile() {
  try {
    await readFile(STORAGE_PATH, 'utf8');
  } catch {
    await mkdir(dirname(STORAGE_PATH), { recursive: true });
    await writeFile(STORAGE_PATH, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
  }
}

async function readState(): Promise<StorageState> {
  await ensureStorageFile();
  const raw = await readFile(STORAGE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(state: StorageState) {
  const tempPath = `${STORAGE_PATH}.tmp`;
  await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
  await rename(tempPath, STORAGE_PATH);
}

export async function kvGet<T = any>(key: keyof StorageState | string): Promise<T | null> {
  await writeChain;
  const state = await readState();
  const value = (state as Record<string, unknown>)[key];
  return (value ?? null) as T | null;
}

export async function kvSet(key: keyof StorageState | string, value: any) {
  writeChain = writeChain.then(async () => {
    const state = await readState();
    const nextState = { ...state } as Record<string, any>;

    if (key === 'beef_contests_v7_final') {
      const current = Array.isArray(nextState[key]) ? nextState[key] : [];
      const incoming = Array.isArray(value) ? value : [];
      nextState[key] = mergeContestsNoDelete(current, incoming);
    } else {
      nextState[key] = value;
    }

    await writeState(nextState as StorageState);
  });

  await writeChain;
}

export async function clearContests() {
  writeChain = writeChain.then(async () => {
    const state = await readState();
    const nextState = { ...state, beef_contests_v7_final: [] };
    await writeState(nextState);
  });
  await writeChain;
}

export async function removeContestById(contestId: string) {
  writeChain = writeChain.then(async () => {
    const state = await readState();
    const list = Array.isArray(state.beef_contests_v7_final) ? state.beef_contests_v7_final : [];
    const next = list.filter((c: any) => c && c.id !== contestId);
    await writeState({ ...state, beef_contests_v7_final: next });
  });
  await writeChain;
}
