/**
 * Day-phase production: converts standing buildings into resources over time,
 * clamped to caps that scale with shelter level. Pure function of the current
 * base + resources → resource deltas, so it's trivially testable and the store
 * just applies the result.
 */

import type { PlacedBuilding, ResourceBag, ResourceType } from '@/types';
import { BUILDINGS } from '@/constants/buildings';
import { BASE_RESOURCE_CAP, resourceCap } from '@/constants/gameConfig';

/** Per-second production for each resource from the current buildings. */
export function productionRates(buildings: PlacedBuilding[]): ResourceBag {
  const rates: ResourceBag = { wood: 0, stone: 0, scrap: 0, fuel: 0, food: 0, energy: 0 };
  for (const b of buildings) {
    const def = BUILDINGS[b.type];
    if (!def.produces || !def.productionRate) continue;
    if (b.buildUntil && b.buildUntil > Date.now()) continue; // still under construction
    if (b.hp <= 0) continue;
    const scaled = def.productionRate * (1 + def.scaling.outputPerLevel * (b.level - 1));
    rates[def.produces] += scaled;
  }
  return rates;
}

/**
 * Effective caps for the current shelter level (+ optional research multiplier
 * and warehouses: each storage level adds +15% to all caps).
 */
export function currentCaps(shelterLevel: number, capMult = 1, storageLevels = 0): ResourceBag {
  const mult = capMult * (1 + storageLevels * 0.15);
  return {
    wood: Math.round(resourceCap(BASE_RESOURCE_CAP.wood, shelterLevel) * mult),
    stone: Math.round(resourceCap(BASE_RESOURCE_CAP.stone, shelterLevel) * mult),
    scrap: Math.round(resourceCap(BASE_RESOURCE_CAP.scrap, shelterLevel) * mult),
    fuel: Math.round(resourceCap(BASE_RESOURCE_CAP.fuel, shelterLevel) * mult),
    food: Math.round(resourceCap(BASE_RESOURCE_CAP.food, shelterLevel) * mult),
    energy: Math.round(resourceCap(BASE_RESOURCE_CAP.energy, shelterLevel) * mult),
  };
}

/** Total levels of standing storages (cap bonus source). */
export function storageLevels(buildings: PlacedBuilding[]): number {
  return buildings.reduce((acc, b) => (b.type === 'storage' ? acc + b.level : acc), 0);
}

/**
 * Advance production by `dt` seconds. Returns the new resource bag (capped).
 * `prodMult` lets research ("Organized Production") scale all output.
 */
export function tickProduction(
  resources: ResourceBag,
  buildings: PlacedBuilding[],
  dt: number,
  shelterLevel: number,
  prodMult = 1,
  capMult = 1,
): ResourceBag {
  const rates = productionRates(buildings);
  const caps = currentCaps(shelterLevel, capMult, storageLevels(buildings));
  const next: ResourceBag = { ...resources };
  (Object.keys(next) as ResourceType[]).forEach((r) => {
    next[r] = Math.min(caps[r], next[r] + rates[r] * prodMult * dt);
  });
  return next;
}
