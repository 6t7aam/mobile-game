/**
 * Central asset registry. For now every entry is `null` (procedural Skia art is
 * used as the fallback). When AI-generated sprites/backgrounds are added under
 * `assets/images/...`, wire their `require(...)` here and the renderer can swap
 * from procedural drawing to textures without touching call sites.
 *
 * Keeping this indirection means the game runs with ZERO binary assets today
 * and gains art incrementally.
 */

import type { BuildingType, EnemyType, WeaponId } from '@/types';

export type ImageSource = number | null; // `number` = a require()'d module id

export const ENEMY_SPRITES: Partial<Record<EnemyType, ImageSource>> = {};
export const BUILDING_SPRITES: Partial<Record<BuildingType, ImageSource>> = {};
export const WEAPON_ICONS: Partial<Record<WeaponId, ImageSource>> = {};

export const BACKGROUNDS = {
  menu: null as ImageSource,
  dayForest: null as ImageSource,
  nightForest: null as ImageSource,
  bloodMoon: null as ImageSource,
};

/** True once real art exists for a key; renderer checks this to pick a path. */
export function hasSprite(src: ImageSource): src is number {
  return typeof src === 'number';
}
