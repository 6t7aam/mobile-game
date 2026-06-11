/**
 * Monetization / account meta state: premium crystals, owned meme skins,
 * shop-exclusive weapons and the daily freebie. Persisted separately from run
 * progress so a wipe of game progress never touches paid content.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SkinId } from '@/constants/skins';
import { SKINS } from '@/constants/skins';
import type { WeaponId } from '@/types';
import { WEAPONS } from '@/constants/weapons';
import { useProgressStore } from '@/store/progressStore';

/** Crystal price of each premium weapon. */
export const PREMIUM_WEAPON_PRICES: Partial<Record<WeaponId, number>> = {
  goldenMinigun: 900,
  infernoMinigun: 750,
};

export const PREMIUM_WEAPON_IDS = Object.keys(PREMIUM_WEAPON_PRICES) as WeaponId[];

/** Rotating daily freebie (crystals), indexed by day-of-epoch so it varies. */
const DAILY_REWARDS = [30, 45, 25, 60, 35, 50, 80];

export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function dailyRewardAmount(): number {
  const dayOfEpoch = Math.floor(Date.now() / 86_400_000);
  return DAILY_REWARDS[dayOfEpoch % DAILY_REWARDS.length] ?? 30;
}

interface MetaState {
  crystals: number;
  ownedSkins: SkinId[];
  equippedSkin: SkinId;
  ownedPremium: WeaponId[];
  lastDailyClaim: string; // todayStamp() of the last claim

  addCrystals: (n: number) => void;
  /** Returns false if the balance is too low. */
  spendCrystals: (n: number) => boolean;
  buySkin: (id: SkinId) => boolean;
  equipSkin: (id: SkinId) => void;
  buyPremiumWeapon: (id: WeaponId) => boolean;
  canClaimDaily: () => boolean;
  /** Claims the daily freebie; returns the crystal amount or null. */
  claimDaily: () => number | null;
}

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      crystals: 50, // welcome gift
      ownedSkins: ['default'],
      equippedSkin: 'default',
      ownedPremium: [],
      lastDailyClaim: '',

      addCrystals: (n) => set((s) => ({ crystals: Math.max(0, s.crystals + Math.round(n)) })),

      spendCrystals: (n) => {
        if (get().crystals < n) return false;
        set((s) => ({ crystals: s.crystals - n }));
        return true;
      },

      buySkin: (id) => {
        const s = get();
        if (s.ownedSkins.includes(id)) return true;
        if (!s.spendCrystals(SKINS[id].cost)) return false;
        set((st) => ({ ownedSkins: [...st.ownedSkins, id], equippedSkin: id }));
        return true;
      },

      equipSkin: (id) => {
        if (get().ownedSkins.includes(id)) set({ equippedSkin: id });
      },

      buyPremiumWeapon: (id) => {
        const s = get();
        if (s.ownedPremium.includes(id)) return true;
        const price = PREMIUM_WEAPON_PRICES[id];
        if (price == null || !WEAPONS[id]?.premium) return false;
        if (!s.spendCrystals(price)) return false;
        set((st) => ({ ownedPremium: [...st.ownedPremium, id] }));
        // also grant it in the run progress so the Arsenal can equip it
        useProgressStore.getState().buyWeapon(id);
        return true;
      },

      canClaimDaily: () => get().lastDailyClaim !== todayStamp(),

      claimDaily: () => {
        if (!get().canClaimDaily()) return null;
        const amount = dailyRewardAmount();
        set((s) => ({ crystals: s.crystals + amount, lastDailyClaim: todayStamp() }));
        return amount;
      },
    }),
    {
      name: 'ashen-meta',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
