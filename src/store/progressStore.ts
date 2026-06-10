/**
 * Meta-progression that survives Game Over (soft NG+): unlocked research &
 * weapons, codex entries, lifetime stats and the night record.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CodexEntryId, GameStats, OwnedWeapon, WeaponId } from '@/types';
import { STARTING_WEAPON } from '@/constants/weapons';
import { STARTER_RESEARCH } from '@/constants/research';

interface ProgressState {
  /** Completed research node ids. */
  completedResearch: string[];
  /** Weapons the player owns (persists across runs). */
  ownedWeapons: OwnedWeapon[];
  /** Unlocked codex (boss/enemy lore) entries. */
  codex: CodexEntryId[];
  stats: GameStats;

  // actions
  completeResearch: (id: string) => void;
  isResearched: (id: string) => boolean;
  buyWeapon: (id: WeaponId) => void;
  upgradeWeapon: (id: WeaponId) => void;
  ownsWeapon: (id: WeaponId) => boolean;
  weaponLevel: (id: WeaponId) => number;
  unlockCodex: (id: CodexEntryId) => void;
  recordNightSurvived: (night: number, kills: number) => void;
  recordDeath: () => void;
  resetMeta: () => void;
}

const INITIAL_STATS: GameStats = {
  totalZombiesKilled: 0,
  totalNightsSurvived: 0,
  bestNight: 0,
  totalDeaths: 0,
};

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      completedResearch: [...STARTER_RESEARCH],
      ownedWeapons: [{ id: STARTING_WEAPON, level: 1 }],
      codex: [],
      stats: { ...INITIAL_STATS },

      completeResearch: (id) =>
        set((s) =>
          s.completedResearch.includes(id)
            ? s
            : { completedResearch: [...s.completedResearch, id] },
        ),

      isResearched: (id) => get().completedResearch.includes(id),

      buyWeapon: (id) =>
        set((s) =>
          s.ownedWeapons.some((w) => w.id === id)
            ? s
            : { ownedWeapons: [...s.ownedWeapons, { id, level: 1 }] },
        ),

      upgradeWeapon: (id) =>
        set((s) => ({
          ownedWeapons: s.ownedWeapons.map((w) =>
            w.id === id ? { ...w, level: w.level + 1 } : w,
          ),
        })),

      ownsWeapon: (id) => get().ownedWeapons.some((w) => w.id === id),

      weaponLevel: (id) => get().ownedWeapons.find((w) => w.id === id)?.level ?? 0,

      unlockCodex: (id) =>
        set((s) => (s.codex.includes(id) ? s : { codex: [...s.codex, id] })),

      recordNightSurvived: (night, kills) =>
        set((s) => ({
          stats: {
            ...s.stats,
            totalNightsSurvived: s.stats.totalNightsSurvived + 1,
            totalZombiesKilled: s.stats.totalZombiesKilled + kills,
            bestNight: Math.max(s.stats.bestNight, night),
          },
        })),

      recordDeath: () =>
        set((s) => ({ stats: { ...s.stats, totalDeaths: s.stats.totalDeaths + 1 } })),

      resetMeta: () =>
        set({
          completedResearch: [...STARTER_RESEARCH],
          ownedWeapons: [{ id: STARTING_WEAPON, level: 1 }],
          codex: [],
          stats: { ...INITIAL_STATS },
        }),
    }),
    {
      name: 'ashen-progress',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
