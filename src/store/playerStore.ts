/**
 * The player character's live combat state. This is mostly transient (reset at
 * the start of each night) but the equipped weapon persists across the run.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Vec2, WeaponId } from '@/types';
import { STARTING_WEAPON } from '@/constants/weapons';
import { WORLD } from '@/constants/gameConfig';

const PLAYER_BASE_HP = 100;

interface PlayerStoreState {
  pos: Vec2;
  hp: number;
  maxHp: number;
  equipped: WeaponId;
  revivedThisNight: boolean;
  deathDrop: { pos: Vec2; scrap: number; fuel: number } | null;

  // actions
  setPos: (pos: Vec2) => void;
  takeDamage: (amount: number) => number; // returns remaining hp
  heal: (amount: number) => void;
  equip: (id: WeaponId) => void;
  setMaxHp: (maxHp: number) => void;
  resetForNight: () => void;
  markRevived: () => void;
  setDeathDrop: (drop: { pos: Vec2; scrap: number; fuel: number } | null) => void;
}

const CENTER: Vec2 = { x: WORLD.width / 2, y: WORLD.height / 2 };

export const usePlayerStore = create<PlayerStoreState>()(
  persist(
    (set, get) => ({
      pos: { ...CENTER },
      hp: PLAYER_BASE_HP,
      maxHp: PLAYER_BASE_HP,
      equipped: STARTING_WEAPON,
      revivedThisNight: false,
      deathDrop: null,

      setPos: (pos) => set({ pos }),

      takeDamage: (amount) => {
        const hp = Math.max(0, get().hp - amount);
        set({ hp });
        return hp;
      },

      heal: (amount) => set((s) => ({ hp: Math.min(s.maxHp, s.hp + amount) })),

      equip: (id) => set({ equipped: id }),

      setMaxHp: (maxHp) => set((s) => ({ maxHp, hp: Math.min(s.hp, maxHp) })),

      resetForNight: () =>
        set((s) => ({
          pos: { ...CENTER },
          hp: s.maxHp,
          revivedThisNight: false,
          deathDrop: null,
        })),

      markRevived: () => set({ revivedThisNight: true }),

      setDeathDrop: (deathDrop) => set({ deathDrop }),
    }),
    {
      name: 'holdouts-player',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // only the equipped weapon needs to survive a cold start
      partialize: (s) => ({ equipped: s.equipped, maxHp: s.maxHp }) as PlayerStoreState,
    },
  ),
);
