/**
 * The base layout: placed buildings plus terrain-aware helpers for placement
 * and tree harvesting during the day phase.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BuildingType, GridCoord, PlacedBuilding, Rock, Tree } from '@/types';
import { BUILDINGS } from '@/constants/buildings';
import { GRID } from '@/constants/gameConfig';
import { isBuildZone, isForestZone, spawnInitialRocks, spawnInitialTrees, tileTypeAt } from '@/utils/terrain';

let idCounter = 0;
const nextId = () => `b${Date.now().toString(36)}_${idCounter++}`;

/** A felled stump regrows into a full tree after this long (renewable forest). */
const REGROW_MS = 90_000; // 90 seconds
/** A depleted rock/scrap node respawns after this long. */
const ROCK_RESPAWN_MS = 150_000; // 2.5 minutes
const BARRACKS_TRAIN_MS = 18_000;

/**
 * Clash-of-Clans-style build times per building (seconds). Placing a building
 * starts a construction timer; while building it's scaffolding (no function).
 */
export function buildTimeSec(type: BuildingType): number {
  const def = BUILDINGS[type];
  if (def.category === 'barrier') return 4; // walls go up fast
  if (def.category === 'core') return 0;
  if (def.category === 'defense') return 15;
  return 10; // production / support
}

function defaultLayout(): PlacedBuilding[] {
  const shelter = BUILDINGS.shelter;
  const origin: GridCoord = {
    col: Math.floor((GRID.cols - shelter.size.w) / 2),
    row: Math.floor((GRID.rows - shelter.size.h) / 2),
  };
  return [
    {
      id: nextId(),
      type: 'shelter',
      origin,
      level: 1,
      hp: shelter.baseHp,
    },
  ];
}

function footprintTiles(type: BuildingType, origin: GridCoord): GridCoord[] {
  const { w, h } = BUILDINGS[type].size;
  const tiles: GridCoord[] = [];
  for (let dc = 0; dc < w; dc++) {
    for (let dr = 0; dr < h; dr++) {
      tiles.push({ col: origin.col + dc, row: origin.row + dr });
    }
  }
  return tiles;
}

function tilesOf(b: PlacedBuilding): GridCoord[] {
  return footprintTiles(b.type, b.origin);
}

function canBuildOnTile(coord: GridCoord, trees: Tree[]): boolean {
  if (isBuildZone(coord)) return true;
  if (!isForestZone(coord.col, coord.row)) return false;
  const tree = trees.find((candidate) => candidate.tileX === coord.col && candidate.tileY === coord.row);
  return tree?.state === 'stump';
}

interface BaseState {
  buildings: PlacedBuilding[];
  trees: Tree[];
  rocks: Rock[];

  isAreaFree: (type: BuildingType, origin: GridCoord, ignoreId?: string) => boolean;
  buildingAt: (coord: GridCoord) => PlacedBuilding | undefined;
  treeAt: (coord: GridCoord) => Tree | undefined;
  shelter: () => PlacedBuilding | undefined;

  place: (type: BuildingType, origin: GridCoord) => string | null;
  remove: (id: string) => void;
  upgrade: (id: string) => void;
  startBarracksTraining: (id: string) => boolean;
  damage: (id: string, amount: number) => void;
  healAll: (fraction: number) => void;
  toggleGate: (id: string) => void;
  startTreeFall: (id: string) => Tree | null;
  finishTreeFall: (id: string) => void;
  /** Hit a rock with the pick. Returns the updated rock (null = invalid). */
  mineRock: (id: string) => Rock | null;
  tickRegrow: () => void;
  applyBattleResult: (hpById: Record<string, number>) => void;
  resetLayout: () => void;
}

export const useBaseStore = create<BaseState>()(
  persist(
    (set, get) => ({
      buildings: defaultLayout(),
      trees: spawnInitialTrees(),
      rocks: spawnInitialRocks(spawnInitialTrees()),

      isAreaFree: (type, origin, ignoreId) => {
        const tiles = footprintTiles(type, origin);
        const inBounds = tiles.every((t) => t.col >= 0 && t.row >= 0 && t.col < GRID.cols && t.row < GRID.rows);
        if (!inBounds) return false;
        if (!tiles.every((tile) => canBuildOnTile(tile, get().trees))) return false;

        const occupied = new Set(
          get()
            .buildings.filter((b) => b.id !== ignoreId)
            .flatMap((b) => tilesOf(b).map((t) => `${t.col},${t.row}`)),
        );
        if (!tiles.every((t) => !occupied.has(`${t.col},${t.row}`))) return false;

        return tiles.every((t) => {
          const tree = get().trees.find((candidate) => candidate.tileX === t.col && candidate.tileY === t.row);
          return !tree || tree.state === 'stump';
        });
      },

      buildingAt: (coord) =>
        get().buildings.find((b) => tilesOf(b).some((t) => t.col === coord.col && t.row === coord.row)),

      treeAt: (coord) => get().trees.find((t) => t.tileX === coord.col && t.tileY === coord.row),

      shelter: () => get().buildings.find((b) => b.type === 'shelter'),

      place: (type, origin) => {
        if (!get().isAreaFree(type, origin)) return null;
        const def = BUILDINGS[type];
        const id = nextId();
        const buildSec = buildTimeSec(type);
        set((s) => ({
          buildings: [
            ...s.buildings,
            {
              id,
              type,
              origin,
              level: 1,
              hp: def.baseHp,
              // CoC-style: construction takes time; scaffolding until done
              buildUntil: buildSec > 0 ? Date.now() + buildSec * 1000 : null,
              ...(type === 'gate' ? { open: false } : {}),
            },
          ],
        }));
        return id;
      },

      remove: (id) => set((s) => ({ buildings: s.buildings.filter((b) => b.id !== id) })),

      upgrade: (id) =>
        set((s) => ({
          buildings: s.buildings.map((b) => {
            if (b.id !== id) return b;
            const def = BUILDINGS[b.type];
            if (b.level >= def.maxLevel) return b;
            const newLevel = b.level + 1;
            const newMaxHp = Math.round(def.baseHp * (1 + def.scaling.hpPerLevel * (newLevel - 1)));
            return { ...b, level: newLevel, hp: newMaxHp };
          }),
        })),

      startBarracksTraining: (id) => {
        let started = false;
        set((s) => ({
          buildings: s.buildings.map((b) => {
            if (b.id !== id || b.type !== 'barracks') return b;
            if (b.buildUntil && b.buildUntil > Date.now()) return b;
            if (b.trainingUntil && b.trainingUntil > Date.now()) return b;
            const cap = BUILDINGS.barracks.maxLevel;
            const current = Math.max(0, Math.min(cap, b.garrison ?? 0));
            if (current >= cap) return b;
            started = true;
            return { ...b, garrison: current, trainingUntil: Date.now() + BARRACKS_TRAIN_MS };
          }),
        }));
        return started;
      },

      damage: (id, amount) =>
        set((s) => ({
          buildings: s.buildings
            .map((b) => (b.id === id ? { ...b, hp: b.hp - amount } : b))
            .filter((b) => b.hp > 0 || b.type === 'shelter'),
        })),

      healAll: (fraction) =>
        set((s) => ({
          buildings: s.buildings.map((b) => {
            const def = BUILDINGS[b.type];
            const maxHp = Math.round(def.baseHp * (1 + def.scaling.hpPerLevel * (b.level - 1)));
            return { ...b, hp: Math.min(maxHp, b.hp + maxHp * fraction) };
          }),
        })),

      toggleGate: (id) =>
        set((s) => ({
          buildings: s.buildings.map((b) => (b.id === id && b.type === 'gate' ? { ...b, open: !b.open } : b)),
        })),

      startTreeFall: (id) => {
        const tree = get().trees.find((item) => item.id === id);
        if (!tree || tree.state !== 'alive') return null;
        const next = {
          ...tree,
          hp: tree.hp - 1,
        };
        if (next.hp > 0) {
          set((s) => ({ trees: s.trees.map((item) => (item.id === id ? next : item)) }));
          return next;
        }
        const falling = {
          ...next,
          hp: 0,
          state: 'falling' as const,
          fallStartedAt: Date.now(),
        };
        set((s) => ({ trees: s.trees.map((item) => (item.id === id ? falling : item)) }));
        return falling;
      },

      finishTreeFall: (id) =>
        set((s) => ({
          trees: s.trees.map((tree) =>
            tree.id === id
              ? { ...tree, state: 'stump', fallStartedAt: null, woodDropped: true, stumpAt: Date.now() }
              : tree,
          ),
        })),

      mineRock: (id) => {
        const rock = get().rocks.find((r) => r.id === id);
        if (!rock || rock.state !== 'alive') return null;
        const next: Rock =
          rock.hp - 1 <= 0
            ? { ...rock, hp: 0, state: 'depleted', depletedAt: Date.now() }
            : { ...rock, hp: rock.hp - 1 };
        set((s) => ({ rocks: s.rocks.map((r) => (r.id === id ? next : r)) }));
        return next;
      },

      // Stumps regrow into trees and depleted rocks respawn after their delays,
      // so the world's resources are renewable. Ticked by the world loop.
      tickRegrow: () =>
        set((s) => {
          const now = Date.now();
          let changed = false;
          const buildings = s.buildings.map((building) => {
            if (building.type !== 'barracks' || !building.trainingUntil || building.trainingUntil > now) return building;
            changed = true;
            const cap = BUILDINGS.barracks.maxLevel;
            return {
              ...building,
              garrison: Math.min(cap, (building.garrison ?? 0) + 1),
              trainingUntil: null,
            };
          });
          const trees = s.trees.map((tree) => {
            if (tree.state === 'stump' && tree.stumpAt && now - tree.stumpAt >= REGROW_MS) {
              changed = true;
              return { ...tree, state: 'alive' as const, hp: tree.maxHp, woodDropped: false, stumpAt: null };
            }
            return tree;
          });
          const rocks = s.rocks.map((rock) => {
            if (rock.state === 'depleted' && rock.depletedAt && now - rock.depletedAt >= ROCK_RESPAWN_MS) {
              changed = true;
              return { ...rock, state: 'alive' as const, hp: rock.maxHp, depletedAt: null };
            }
            return rock;
          });
          return changed ? { buildings, trees, rocks } : s;
        }),

      applyBattleResult: (hpById) =>
        set((s) => ({
          buildings: s.buildings
            .map((b) => {
              const hp = hpById[b.id];
              return hp === undefined ? b : { ...b, hp: Math.max(0, hp) };
            })
            .filter((b) => b.type === 'shelter' || b.hp > 0),
        })),

      resetLayout: () => {
        const trees = spawnInitialTrees();
        set({ buildings: defaultLayout(), trees, rocks: spawnInitialRocks(trees) });
      },
    }),
    {
      name: 'ashen-base',
      storage: createJSONStorage(() => AsyncStorage),
      version: 4,
      migrate: (persisted) => {
        const state = persisted as BaseState | undefined;
        const freshTrees = spawnInitialTrees();
        const fresh = { buildings: defaultLayout(), trees: freshTrees, rocks: spawnInitialRocks(freshTrees) };
        if (!state) return fresh;
        const shelter = state.buildings?.find((building) => building.type === 'shelter');
        const freshShelter = defaultLayout()[0]!;
        if (
          !shelter ||
          shelter.origin.col !== freshShelter.origin.col ||
          shelter.origin.row !== freshShelter.origin.row
        ) {
          return fresh;
        }
        return {
          ...state,
          trees: state.trees && state.trees.length > 0 ? state.trees : freshTrees,
          rocks: state.rocks && state.rocks.length > 0 ? state.rocks : spawnInitialRocks(freshTrees),
          buildings:
            state.buildings && state.buildings.length > 0
              ? state.buildings.map((building) =>
                  building.type === 'barracks'
                    ? { ...building, garrison: building.garrison ?? 0, trainingUntil: building.trainingUntil ?? null }
                    : building,
                )
              : defaultLayout(),
        };
      },
      partialize: (state) => ({
        buildings: state.buildings,
        rocks: state.rocks,
        trees: state.trees.map((tree) => ({
          ...tree,
          fallStartedAt: tree.state === 'falling' ? null : tree.fallStartedAt,
        })),
      }),
    },
  ),
);

export { canBuildOnTile, isBuildZone, tileTypeAt };
