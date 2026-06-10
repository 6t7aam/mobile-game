/**
 * Combat resolution: damage application, resistances, status effects, and the
 * per-behaviour hit logic (single / pierce / cone / explosive / chain / beam).
 * Pure functions over entities + a small set of callbacks so the simulation
 * owns all mutation and FX spawning.
 */

import type { DamageResist, EnemyType, WeaponDef } from '@/types';
import { ENEMIES } from '@/constants/enemies';
import { weaponStatsAtLevel } from '@/constants/weapons';
import type { EnemyEntity, ProjectileEntity } from '@/engine/entities';
import type { SpatialHash } from '@/engine/spatial';
import { inCone } from '@/engine/math';

export type DamageType = 'bullet' | 'explosive' | 'electric' | 'fire';

/** Map a weapon's projectile behaviour to its damage type for resist lookup. */
export function weaponDamageType(def: WeaponDef): DamageType {
  if (def.behavior === 'explosive') return 'explosive';
  if (def.behavior === 'chain') return 'electric';
  if (def.behavior === 'beam') return 'fire';
  if (def.branch === 'primitive') return 'bullet'; // arrows/spears treated as physical
  return 'bullet';
}

function resistMult(resist: DamageResist, type: DamageType): number {
  return resist[type];
}

/** Apply raw damage to an enemy after resistances. Returns damage actually dealt. */
export function applyDamage(
  e: EnemyEntity,
  rawDamage: number,
  type: DamageType,
): number {
  const def = ENEMIES[e.type];
  const mult = resistMult(def.resist, type);
  const dealt = rawDamage * mult;
  e.hp -= dealt;
  return dealt;
}

export interface HitCallbacks {
  onDamage: (e: EnemyEntity, dealt: number, x: number, y: number, type: DamageType) => void;
  onKill: (e: EnemyEntity) => void;
  /** Spawn an explosion FX + AoE at a point. */
  onExplosion?: (x: number, y: number, radius: number) => void;
}

function killIfDead(e: EnemyEntity, cb: HitCallbacks): void {
  if (e.hp <= 0 && e.active) {
    e.active = false;
    cb.onKill(e);
  }
}

/**
 * Resolve a projectile that has reached / overlapped a target enemy.
 * Handles pierce, explosive AoE and chain hops. Returns true if the projectile
 * is consumed (should deactivate).
 */
export function resolveProjectileHit(
  p: ProjectileEntity,
  hit: EnemyEntity,
  hash: SpatialHash,
  cb: HitCallbacks,
): boolean {
  switch (p.behavior) {
    case 'explosive': {
      cb.onExplosion?.(hit.x, hit.y, p.effectRadius);
      hash.queryRadius(hit.x, hit.y, p.effectRadius, (e) => {
        if (!e.active) return;
        // linear falloff
        const d = Math.hypot(e.x - hit.x, e.y - hit.y);
        const fall = 1 - d / p.effectRadius;
        const dealt = applyDamage(e, p.damage * Math.max(0.25, fall), p.dmgType);
        cb.onDamage(e, dealt, e.x, e.y, p.dmgType);
        killIfDead(e, cb);
      });
      return true;
    }
    case 'chain': {
      let hops = p.pierce; // reuse pierce as remaining hops
      let cx = hit.x;
      let cy = hit.y;
      const struck = new Set<number>();
      const first = applyDamage(hit, p.damage, p.dmgType);
      cb.onDamage(hit, first, hit.x, hit.y, p.dmgType);
      killIfDead(hit, cb);
      struck.add(hit.id);
      while (hops > 0) {
        let nextE: EnemyEntity | null = null;
        let bestD = 140 * 140;
        hash.queryRadius(cx, cy, 140, (e) => {
          if (!e.active || struck.has(e.id)) return;
          const dd = (e.x - cx) ** 2 + (e.y - cy) ** 2;
          if (dd < bestD) {
            bestD = dd;
            nextE = e;
          }
        });
        if (!nextE) break;
        const ne: EnemyEntity = nextE;
        const dealt = applyDamage(ne, p.damage * 0.85, p.dmgType);
        cb.onDamage(ne, dealt, ne.x, ne.y, p.dmgType);
        killIfDead(ne, cb);
        struck.add(ne.id);
        cx = ne.x;
        cy = ne.y;
        hops--;
      }
      return true;
    }
    case 'piercing': {
      const dealt = applyDamage(hit, p.damage, p.dmgType);
      cb.onDamage(hit, dealt, hit.x, hit.y, p.dmgType);
      killIfDead(hit, cb);
      p.pierce -= 1;
      return p.pierce < 0;
    }
    default: {
      // single / cone pellets / beam ticks
      const dealt = applyDamage(hit, p.damage, p.dmgType);
      cb.onDamage(hit, dealt, hit.x, hit.y, p.dmgType);
      killIfDead(hit, cb);
      return true;
    }
  }
}

/** Beam/cone instantaneous damage (flamethrower) — hits everything in a cone. */
export function applyConeDamage(
  ox: number,
  oy: number,
  dir: number,
  halfAngle: number,
  range: number,
  damage: number,
  type: DamageType,
  hash: SpatialHash,
  cb: HitCallbacks,
): void {
  hash.queryRadius(ox, oy, range, (e) => {
    if (!e.active) return;
    if (!inCone(ox, oy, dir, halfAngle, range, e.x, e.y)) return;
    const dealt = applyDamage(e, damage, type);
    cb.onDamage(e, dealt, e.x, e.y, type);
    killIfDead(e, cb);
  });
}

/** Convenience: effective per-shot damage for a weapon at a level. */
export function effectiveWeaponDamage(def: WeaponDef, level: number): number {
  return weaponStatsAtLevel(def, level).damage;
}

/** Tick a status effect, applying its per-second consequence. Returns dps dealt. */
export function tickStatus(e: EnemyEntity, dt: number, cb: HitCallbacks): void {
  if (e.statuses.length === 0) return;
  for (let i = e.statuses.length - 1; i >= 0; i--) {
    const s = e.statuses[i]!;
    s.ttl -= dt;
    if (s.kind === 'burning' || s.kind === 'poisoned') {
      const dealt = s.magnitude * dt;
      e.hp -= dealt;
      if (e.hp <= 0) {
        killIfDead(e, cb);
        return;
      }
    }
    if (s.ttl <= 0) e.statuses.splice(i, 1);
  }
}

/** Current speed multiplier from slow/shock statuses (1 = unaffected). */
export function speedMultiplier(e: EnemyEntity): number {
  let m = 1;
  for (let i = 0; i < e.statuses.length; i++) {
    const s = e.statuses[i]!;
    if (s.kind === 'slowed') m *= 1 - s.magnitude;
    if (s.kind === 'shocked') m *= 0.1;
  }
  return m;
}

export function addStatus(
  e: EnemyEntity,
  kind: 'burning' | 'slowed' | 'shocked' | 'poisoned',
  ttl: number,
  magnitude: number,
): void {
  const existing = e.statuses.find((s) => s.kind === kind);
  if (existing) {
    existing.ttl = Math.max(existing.ttl, ttl);
    existing.magnitude = Math.max(existing.magnitude, magnitude);
  } else {
    e.statuses.push({ kind, ttl, magnitude });
  }
}

/** Scaled enemy HP/damage for a given night (difficulty ramp). */
export function scaledEnemyHp(type: EnemyType, night: number, hpGrowth: number): number {
  return Math.round(ENEMIES[type].hp * Math.pow(hpGrowth, night - 1));
}
