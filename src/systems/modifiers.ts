/**
 * Research → gameplay bridge.
 *
 * Research nodes carry `effects` (see constants/research.ts), but nothing
 * applied them. This module aggregates the player's *completed* research into a
 * single typed `Modifiers` bundle that combat, production, fortification and the
 * revive system read. One place to resolve "what do my techs actually do".
 */

import type { BuildingType, ResearchEffect, WeaponBranch } from '@/types';
import { RESEARCH } from '@/constants/research';

export interface Modifiers {
  // weapons / towers
  towerDamage: number; // multiplier
  towerFireRate: number;
  ammoCost: number; // multiplier on ammo consumption cost
  // fortification
  wallHp: number; // multiplier on barrier max HP
  wallSlow: boolean; // walls slow attackers
  shelterArmor: number; // incoming-damage multiplier for shelter (<1 = armored)
  buildingRegen: number; // fraction/sec out of combat (doctrine)
  // production / economy
  production: number; // multiplier on all production
  resourceCap: number; // multiplier on caps
  nightBonus: number; // multiplier on dawn resource rewards
  soldierDamage: number;
  soldierHp: number;
  // survival doctrine
  freeRevive: boolean; // revive at 50% with no penalty, while shelter stands
  medbayNight: boolean; // medbay heals during the night
  // unlocks
  unlockedBranches: Set<WeaponBranch>;
  unlockedBuildings: Set<BuildingType>;
  doctrines: string[];
}

function base(): Modifiers {
  return {
    towerDamage: 1,
    towerFireRate: 1,
    ammoCost: 1,
    wallHp: 1,
    wallSlow: false,
    shelterArmor: 1,
    buildingRegen: 0,
    production: 1,
    resourceCap: 1,
    nightBonus: 1,
    soldierDamage: 1,
    soldierHp: 1,
    freeRevive: false,
    medbayNight: false,
    unlockedBranches: new Set<WeaponBranch>(['primitive']),
    unlockedBuildings: new Set<BuildingType>(),
    doctrines: [],
  };
}

function applyEffect(m: Modifiers, e: ResearchEffect): void {
  switch (e.kind) {
    case 'unlockWeaponBranch':
      m.unlockedBranches.add(e.branch);
      break;
    case 'unlockBuilding':
      m.unlockedBuildings.add(e.building);
      break;
    case 'doctrine':
      m.doctrines.push(e.name);
      break;
    case 'modifier':
      switch (e.stat) {
        case 'towerDamage':
          m.towerDamage *= e.mult;
          break;
        case 'towerFireRate':
          m.towerFireRate *= e.mult;
          break;
        case 'ammoCost':
          m.ammoCost *= e.mult;
          break;
        case 'wallHp':
          m.wallHp *= e.mult;
          break;
        case 'wallSlow':
          m.wallSlow = true;
          break;
        case 'shelterArmor':
          m.shelterArmor *= e.mult;
          break;
        case 'buildingRegen':
          m.buildingRegen += e.mult;
          break;
        case 'production':
          m.production *= e.mult;
          break;
        case 'resourceCap':
          m.resourceCap *= e.mult;
          break;
        case 'nightBonus':
          m.nightBonus *= e.mult;
          break;
        case 'soldierDamage':
          m.soldierDamage *= e.mult;
          break;
        case 'soldierHp':
          m.soldierHp *= e.mult;
          break;
        case 'freeRevive':
          m.freeRevive = true;
          break;
        case 'medbayNight':
          m.medbayNight = true;
          break;
        // 'gathering', 'mines', 'autoWeapons', 'experimentalWeapons' are
        // unlock flags consumed elsewhere (weapon availability); no stat change.
        default:
          break;
      }
      break;
  }
}

/** Resolve the effective modifier bundle from a set of completed research ids. */
export function resolveModifiers(completedResearch: string[]): Modifiers {
  const m = base();
  const done = new Set(completedResearch);
  for (const node of RESEARCH) {
    if (!done.has(node.id)) continue;
    for (const e of node.effects) applyEffect(m, e);
  }
  return m;
}

/** A weapon branch is buyable only once its unlocking research is done. */
export function isBranchUnlocked(m: Modifiers, branch: WeaponBranch): boolean {
  return m.unlockedBranches.has(branch);
}
