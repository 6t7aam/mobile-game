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
    const scaled = def.productionRate * (1 + def.scaling.outputPerLevel * (b.level - 1));
    rates[def.produces] += scaled;
  }
  return rates;
}

/** Effective caps for the current shelter level (+ optional research multiplier). */
export function currentCaps(shelterLevel: number, capMult = 1): ResourceBag {
  return {
    wood: Math.round(resourceCap(BASE_RESOURCE_CAP.wood, shelterLevel) * capMult),
    stone: Math.round(resourceCap(BASE_RESOURCE_CAP.stone, shelterLevel) * capMult),
    scrap: Math.round(resourceCap(BASE_RESOURCE_CAP.scrap, shelterLevel) * capMult),
    fuel: Math.round(resourceCap(BASE_RESOURCE_CAP.fuel, shelterLevel) * capMult),
    food: Math.round(resourceCap(BASE_RESOURCE_CAP.food, shelterLevel) * capMult),
    energy: Math.round(resourceCap(BASE_RESOURCE_CAP.energy, shelterLevel) * capMult),
  };
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
  const caps = currentCaps(shelterLevel, capMult);
  const next: ResourceBag = { ...resources };
  (Object.keys(next) as ResourceType[]).forEach((r) => {
    next[r] = Math.min(caps[r], next[r] + rates[r] * prodMult * dt);
  });
  return next;
}
