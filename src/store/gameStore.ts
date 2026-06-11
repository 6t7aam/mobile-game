/**
 * Current-run flow state: phase, night counter, resources & intermediates,
 * and per-night research progress. Persisted so a run resumes after the app
 * is backgrounded (autosave at day↔night transitions).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  GamePhase,
  IntermediateBag,
  IntermediateType,
  ResourceBag,
  ResourceType,
} from '@/types';
import { STARTING_RESOURCES, PRODUCTION_RECIPES } from '@/constants/gameConfig';

const ZERO_INTERMEDIATES: IntermediateBag = {
  ammo: 0,
  advancedComponents: 0,
  rations: 0,
  explosives: 0,
  rockets: 0,
};

interface GameState {
  phase: GamePhase;
  night: number;
  resources: ResourceBag;
  intermediates: IntermediateBag;
  /** Research currently in progress: node id → days remaining. */
  activeResearch: { id: string; daysLeft: number } | null;

  // actions
  setPhase: (phase: GamePhase) => void;
  startNewRun: () => void;
  advanceToNight: () => void;
  advanceToDawn: () => void;
  beginNextDay: () => void;

  addResource: (type: ResourceType, amount: number) => void;
  setResources: (bag: ResourceBag) => void;
  spendResources: (cost: Partial<ResourceBag>) => boolean;
  canAfford: (cost: Partial<ResourceBag>) => boolean;
  loseResourceFraction: (fraction: number) => void;

  addIntermediate: (type: IntermediateType, amount: number) => void;
  /**
   * Run a production recipe `count` times if inputs are available. Returns
   * crafted units. `inputScale` discounts base-resource inputs (research).
   */
  craft: (output: IntermediateType, count: number, inputScale?: number) => number;

  setActiveResearch: (id: string, days: number) => void;
  tickResearch: (days: number) => string | null;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'splash',
      night: 1,
      resources: { ...STARTING_RESOURCES },
      intermediates: { ...ZERO_INTERMEDIATES },
      activeResearch: null,

      setPhase: (phase) => set({ phase }),

      startNewRun: () =>
        set({
          phase: 'day',
          night: 1,
          resources: { ...STARTING_RESOURCES },
          intermediates: { ...ZERO_INTERMEDIATES },
          activeResearch: null,
        }),

      advanceToNight: () => set({ phase: 'night' }),
      advanceToDawn: () => set({ phase: 'dawn' }),

      beginNextDay: () => set((s) => ({ phase: 'day', night: s.night + 1 })),

      addResource: (type, amount) =>
        set((s) => ({
          resources: { ...s.resources, [type]: Math.max(0, s.resources[type] + amount) },
        })),

      setResources: (bag) => set({ resources: { ...bag } }),

      canAfford: (cost) => {
        const r = get().resources;
        return (Object.entries(cost) as [ResourceType, number][]).every(
          ([k, v]) => r[k] >= v,
        );
      },

      spendResources: (cost) => {
        if (!get().canAfford(cost)) return false;
        set((s) => {
          const next = { ...s.resources };
          for (const [k, v] of Object.entries(cost) as [ResourceType, number][]) {
            next[k] -= v;
          }
          return { resources: next };
        });
        return true;
      },

      loseResourceFraction: (fraction) =>
        set((s) => {
          const next = { ...s.resources };
          (Object.keys(next) as ResourceType[]).forEach((k) => {
            next[k] = Math.floor(next[k] * (1 - fraction));
          });
          return { resources: next };
        }),

      addIntermediate: (type, amount) =>
        set((s) => ({
          intermediates: {
            ...s.intermediates,
            [type]: Math.max(0, s.intermediates[type] + amount),
          },
        })),

      craft: (output, count, inputScale = 1) => {
        const recipe = PRODUCTION_RECIPES.find((r) => r.output === output);
        if (!recipe) return 0;
        const scaled = (v: number) => Math.max(1, Math.ceil(v * inputScale));
        let made = 0;
        for (let i = 0; i < count; i++) {
          const s = get();
          // check base-resource inputs
          const okRes = (Object.entries(recipe.inputs) as [ResourceType, number][]).every(
            ([k, v]) => s.resources[k] >= scaled(v),
          );
          // check intermediate inputs (e.g. rockets need components + explosives)
          const okInt = recipe.intermediateInputs
            ? (Object.entries(recipe.intermediateInputs) as [IntermediateType, number][]).every(
                ([k, v]) => s.intermediates[k] >= v,
              )
            : true;
          if (!okRes || !okInt) break;
          set((st) => {
            const res = { ...st.resources };
            (Object.entries(recipe.inputs) as [ResourceType, number][]).forEach(([k, v]) => {
              res[k] -= scaled(v);
            });
            const inter = { ...st.intermediates };
            if (recipe.intermediateInputs) {
              (Object.entries(recipe.intermediateInputs) as [IntermediateType, number][]).forEach(
                ([k, v]) => {
                  inter[k] -= v;
                },
              );
            }
            inter[output] += 1;
            return { resources: res, intermediates: inter };
          });
          made++;
        }
        return made;
      },

      setActiveResearch: (id, days) => set({ activeResearch: { id, daysLeft: days } }),

      tickResearch: (days) => {
        const active = get().activeResearch;
        if (!active) return null;
        const daysLeft = active.daysLeft - days;
        if (daysLeft <= 0) {
          set({ activeResearch: null });
          return active.id; // completed
        }
        set({ activeResearch: { ...active, daysLeft } });
        return null;
      },
    }),
    {
      name: 'holdouts-game',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
