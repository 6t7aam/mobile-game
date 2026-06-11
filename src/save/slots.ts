/**
 * Save slots — three independent worlds, each stored as ONE serializable JSON
 * snapshot of every gameplay store. Designed cloud-ready: a slot blob can later
 * be pushed to / pulled from Supabase (or shared with friends' worlds) without
 * changing this format.
 *
 * The zustand stores keep persisting their own "active" state as the player
 * plays; slots are explicit snapshots of that state. Switching slots =
 * snapshot-current → restore-target → continue.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useGameStore } from '@/store/gameStore';
import { useBaseStore } from '@/store/baseStore';
import { usePlayerStore } from '@/store/playerStore';
import { useProgressStore } from '@/store/progressStore';

export const SLOT_COUNT = 3;
const SLOT_KEY = (id: number) => `holdouts-slot-${id}`;
const META_KEY = 'holdouts-slot-meta';
const ACTIVE_KEY = 'holdouts-slot-active';

export interface SlotMeta {
  id: number;
  /** Night counter when last saved. */
  night: number;
  bestNight: number;
  zombiesKilled: number;
  updatedAt: number;
}

interface SlotBlob {
  version: 1;
  meta: SlotMeta;
  game: unknown;
  base: unknown;
  player: unknown;
  progress: unknown;
}

/** Pick only data (non-function) fields of a store state — JSON-safe. */
function dataOf(state: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    if (typeof v !== 'function') out[k] = v;
  }
  return out;
}

/** Snapshot the live stores into the given slot. */
export async function saveToSlot(id: number): Promise<SlotMeta> {
  const game = dataOf(useGameStore.getState() as unknown as Record<string, unknown>);
  const base = dataOf(useBaseStore.getState() as unknown as Record<string, unknown>);
  const player = dataOf(usePlayerStore.getState() as unknown as Record<string, unknown>);
  const progress = dataOf(useProgressStore.getState() as unknown as Record<string, unknown>);

  const stats = useProgressStore.getState().stats;
  const meta: SlotMeta = {
    id,
    night: useGameStore.getState().night,
    bestNight: stats.bestNight,
    zombiesKilled: stats.totalZombiesKilled,
    updatedAt: Date.now(),
  };
  const blob: SlotBlob = { version: 1, meta, game, base, player, progress };
  await AsyncStorage.setItem(SLOT_KEY(id), JSON.stringify(blob));
  await upsertMeta(meta);
  return meta;
}

/** Restore a slot's snapshot into the live stores. Returns false if empty. */
export async function loadSlot(id: number): Promise<boolean> {
  const raw = await AsyncStorage.getItem(SLOT_KEY(id));
  if (!raw) return false;
  try {
    const blob = JSON.parse(raw) as SlotBlob;
    useGameStore.setState(blob.game as never);
    useBaseStore.setState(blob.base as never);
    usePlayerStore.setState(blob.player as never);
    useProgressStore.setState(blob.progress as never);
    await AsyncStorage.setItem(ACTIVE_KEY, String(id));
    return true;
  } catch {
    return false;
  }
}

/** Start a brand-new world in the given slot (resets run state, keeps nothing). */
export async function newWorldInSlot(id: number): Promise<void> {
  useGameStore.getState().startNewRun();
  useBaseStore.getState().resetLayout();
  usePlayerStore.getState().resetForNight();
  // meta progression (research/weapons/codex) intentionally persists across
  // worlds on this device — it's the player's account-level progress.
  await saveToSlot(id);
  await AsyncStorage.setItem(ACTIVE_KEY, String(id));
}

export async function deleteSlot(id: number): Promise<void> {
  await AsyncStorage.removeItem(SLOT_KEY(id));
  const metas = await listSlots();
  const rest = metas.filter((m) => m.id !== id);
  await AsyncStorage.setItem(META_KEY, JSON.stringify(rest));
}

export async function listSlots(): Promise<SlotMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as SlotMeta[]) : [];
  } catch {
    return [];
  }
}

export async function getActiveSlot(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_KEY);
  return raw ? Number(raw) : null;
}

async function upsertMeta(meta: SlotMeta): Promise<void> {
  const metas = await listSlots();
  const idx = metas.findIndex((m) => m.id === meta.id);
  if (idx >= 0) metas[idx] = meta;
  else metas.push(meta);
  await AsyncStorage.setItem(META_KEY, JSON.stringify(metas));
}
