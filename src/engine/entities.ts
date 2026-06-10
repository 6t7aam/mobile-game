/**
 * Runtime battle entities — plain mutable structs driven by the simulation.
 * These are deliberately separate from the design-data types in `@/types`:
 * those describe *definitions* (static), these describe *live instances*.
 *
 * We keep them as flat objects (not classes) so they serialize cheaply and so
 * pools can reuse them without GC churn.
 */

import type {
  BossType,
  EnemyStatus,
  EnemyType,
  ProjectileBehavior,
  ResourceType,
  WeaponId,
} from '@/types';

export type EntityId = number;

/** A live enemy on the battlefield. */
export interface EnemyEntity {
  id: EntityId;
  active: boolean;
  type: EnemyType;
  boss?: BossType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  facing: number;
  /** Current attack target id (a building id, or -1 = shelter, -2 = player). */
  targetId: number;
  /** Seconds until this entity may attack again. */
  attackCd: number;
  statuses: EnemyStatus[];
  /** Summoner timer (screamer / hive). */
  summonCd: number;
  /** Per-frame interpolation snapshot for smooth rendering. */
  px: number;
  py: number;
}

/** A friendly soldier spawned by a barracks; patrols the base and fires. */
export interface SoldierEntity {
  id: EntityId;
  active: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facing: number;
  /** Seconds until it may fire again. */
  fireCd: number;
  /** Anchor point it patrols around (its barracks centre). */
  homeX: number;
  homeY: number;
  /** Damage per shot (scaled by barracks level + research). */
  damage: number;
  /** Per-frame interpolation snapshot. */
  px: number;
  py: number;
}

/** A live projectile / tracer. */
export interface ProjectileEntity {
  id: EntityId;
  active: boolean;
  behavior: ProjectileBehavior;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  range: number;
  traveled: number;
  /** Damage type for resistance lookup. */
  dmgType: 'bullet' | 'explosive' | 'electric' | 'fire';
  /** Remaining pierces / chain hops. */
  pierce: number;
  effectRadius: number;
  /** true = fired by player/tower (hits enemies); reserved for future enemy shots. */
  friendly: boolean;
  /** Owner kind for FX coloring. */
  weapon: WeaponId;
  px: number;
  py: number;
}

/** A particle (spark, ember, blood, smoke, debris). */
export interface ParticleEntity {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  /** gravity / drag applied per second. */
  gravity: number;
  drag: number;
  kind: 'spark' | 'ember' | 'blood' | 'smoke' | 'debris' | 'flash' | 'dust' | 'ice' | 'confetti' | 'shock';
  /** optional rotation (confetti / ice shards), radians. */
  rot?: number;
  rotVel?: number;
}

/** A floating damage number. */
export interface DamageNumber {
  active: boolean;
  x: number;
  y: number;
  value: number;
  life: number;
  crit: boolean;
}

/** A ground decal (blood, acid pool, fire patch, scorch). */
export interface Decal {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  life: number; // -1 = permanent (blood/scorch)
  kind: 'blood' | 'acid' | 'fire' | 'scorch';
}

/** A dropped resource pickup (player death loot). */
export interface Pickup {
  active: boolean;
  x: number;
  y: number;
  resource: ResourceType;
  amount: number;
}

/** Transient light source for the night lighting pass. */
export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
  /** ttl < 0 = persistent (torches); otherwise fades. */
  ttl: number;
  maxTtl: number;
}

// ---------------------------------------------------------------------------
// Object pool — recycles inactive entities to avoid per-frame allocation
// ---------------------------------------------------------------------------

export class Pool<T extends { active: boolean }> {
  readonly items: T[] = [];
  private factory: () => T;

  constructor(factory: () => T, initial = 0) {
    this.factory = factory;
    for (let i = 0; i < initial; i++) {
      const it = factory();
      it.active = false;
      this.items.push(it);
    }
  }

  /** Grab an inactive slot (or grow the pool), mark it active, and return it. */
  spawn(): T {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i]!;
      if (!it.active) {
        it.active = true;
        return it;
      }
    }
    const it = this.factory();
    it.active = true;
    this.items.push(it);
    return it;
  }

  /** Number of currently active items. */
  get activeCount(): number {
    let n = 0;
    for (let i = 0; i < this.items.length; i++) if (this.items[i]!.active) n++;
    return n;
  }

  forEachActive(fn: (item: T) => void): void {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i]!;
      if (it.active) fn(it);
    }
  }

  clear(): void {
    for (let i = 0; i < this.items.length; i++) this.items[i]!.active = false;
  }
}
