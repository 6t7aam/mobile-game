/**
 * Global balance constants. Visual primitives live in src/theme.ts.
 */

import type { IntermediateType, ProductionRecipe, ResourceBag, ResourceType } from '@/types';
import { THEME, TILE } from '@/theme';

export const COLORS = {
  background: THEME.colors.background,
  panel: THEME.colors.panel,
  accent: THEME.colors.accent,
  danger: THEME.colors.danger,
  resource: THEME.colors.resource,
  text: THEME.colors.text,
  inactive: THEME.colors.inactive,
  panelBorder: THEME.colors.panelBorder,
  hpFill: THEME.colors.danger,
  hpBack: THEME.colors.woodDark,
} as const;

export const FONTS = THEME.fonts;

export const RESOURCE_LABEL: Record<ResourceType, string> = {
  wood: '🪵',
  stone: '🪨',
  scrap: '⚙️',
  fuel: '⛽',
  food: '🌿',
  energy: '⚡',
};

export const INTERMEDIATE_LABEL: Record<IntermediateType, string> = {
  ammo: '🔩',
  advancedComponents: '🔧',
  rations: '🍖',
  explosives: '🧨',
  rockets: '🚀',
};

export const GRID = {
  // Enlarged map: a wider forest the player can roam into. The buildable
  // clearing stays a similar size (see FOREST_BAND); the extra tiles are deep
  // forest around it. The camera shows a fixed ~16-tile window and pans.
  cols: 28,
  rows: 28,
  tileSize: TILE,
} as const;

export const WORLD = {
  width: GRID.cols * GRID.tileSize,
  height: GRID.rows * GRID.tileSize,
  spawnMargin: TILE * 4,
} as const;

export const TIMING = {
  dayDurationSec: 90,
  interWaveSec: 6,
  targetFps: 60,
} as const;

/**
 * Automatic Minecraft-style day/night cycle (the world never "switches
 * screens"): a full cycle is day → dusk → night → dawn, then the night
 * counter increments. Dusk/dawn are visual transition windows inside the
 * day/night spans (sky grade shifts, shadows stretch, zombies start crawling
 * out during dusk).
 */
export const CYCLE = {
  daySec: 240, // building / harvesting
  duskSec: 30, // last part of day: sky reddens, warning
  nightSec: 120, // combat waves
  dawnSec: 10, // sunrise flash; leftover zombies burn off
  get fullSec() {
    return this.daySec + this.nightSec;
  },
} as const;

export const BASE_RESOURCE_CAP: ResourceBag = {
  wood: 500,
  stone: 400,
  scrap: 500,
  fuel: 300,
  food: 300,
  energy: 200,
};

export const CAP_PER_SHELTER_LEVEL = 0.2;

export function resourceCap(base: number, shelterLevel: number): number {
  return Math.round(base * (1 + CAP_PER_SHELTER_LEVEL * (shelterLevel - 1)));
}

export const STARTING_RESOURCES: ResourceBag = {
  wood: 80,
  stone: 10,
  scrap: 20,
  fuel: 0,
  food: 50,
  energy: 0,
};

export const DEATH = {
  playerDropFraction: 0.15,
  shelterLossFraction: 0.3,
  reviveHpFraction: 0.5,
} as const;

export const PRODUCTION_RECIPES: ProductionRecipe[] = [
  {
    id: 'ammo',
    output: 'ammo',
    inputs: { scrap: 3, fuel: 1 },
    secondsPerUnit: 2,
  },
  {
    id: 'advancedComponents',
    output: 'advancedComponents',
    inputs: { scrap: 5, energy: 2 },
    secondsPerUnit: 4,
  },
  {
    id: 'rations',
    output: 'rations',
    inputs: { food: 2 },
    secondsPerUnit: 3,
  },
  {
    id: 'explosives',
    output: 'explosives',
    inputs: { fuel: 2, scrap: 1 },
    secondsPerUnit: 3,
  },
  {
    id: 'rockets',
    output: 'rockets',
    inputs: {},
    intermediateInputs: { advancedComponents: 3, explosives: 2 },
    secondsPerUnit: 6,
  },
];

export const DIFFICULTY = {
  countGrowth: 1.12,
  hpGrowth: 1.06,
  bossInterval: 5,
} as const;
