/**
 * BattleSim — the authoritative night-battle simulation.
 *
 * Owns all live entities (via pools), the spatial hash, the flow-field, the
 * spawn director, and the player/tower combat. It is a plain class advanced by
 * a fixed-timestep loop (see `hooks/useGameLoop`). Rendering reads its public
 * pools each frame; it never touches React.
 */

import type {
  MapEdge,
  NightDef,
  PlacedBuilding,
  ResourceType,
  WeaponDef,
  WeaponId,
} from '@/types';
import { GRID, WORLD, DIFFICULTY, TIMING, CYCLE } from '@/constants/gameConfig';
import { ENEMIES, bossForNight } from '@/constants/enemies';
import { BUILDINGS } from '@/constants/buildings';
import { WEAPONS, weaponStatsAtLevel } from '@/constants/weapons';
import { nightDef } from '@/constants/waves';

import {
  Pool,
  type EnemyEntity,
  type SoldierEntity,
  type ProjectileEntity,
  type ParticleEntity,
  type DamageNumber,
  type Decal,
  type Pickup,
  type LightSource,
} from './entities';
import { SpatialHash } from './spatial';
import { Rng, angleBetween, dist2 } from './math';
import { buildFlowField, directionAt, type FlowField } from '@/utils/pathfinding';
import { resolveModifiers, type Modifiers } from '@/systems/modifiers';
import { THEME } from '@/theme';
import {
  applyDamage,
  resolveProjectileHit,
  speedMultiplier,
  tickStatus,
  weaponDamageType,
  addStatus,
  type DamageType,
  type HitCallbacks,
} from '@/utils/combat';
import {
  spawnBurst,
  spawnMuzzleFlash,
  spawnDamageNumber,
  spawnDecal,
  spawnExplosion,
  spawnConfetti,
  spawnDust,
  spawnLight,
  updateParticles,
  updateDamageNumbers,
  updateDecals,
} from '@/utils/particles';

const SHELTER_TARGET = -1;
const PLAYER_TARGET = -2;
const SOLDIER_TARGET = -3;

export interface PlayerView {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facing: number;
  weapon: WeaponId;
  weaponLevel: number;
}

export type BattleOutcome = 'running' | 'won' | 'lost';

/** Phase of the automatic world cycle (Minecraft-style continuous day/night). */
export type WorldPhase = 'day' | 'dusk' | 'night' | 'dawn';

interface SpawnTask {
  type: EnemyEntity['type'];
  remaining: number;
  intervalSec: number;
  timer: number;
  edges: MapEdge[];
  delaySec: number;
  isBoss?: boolean;
}

let nextEntityId = 1;

export class BattleSim {
  readonly enemies = new Pool<EnemyEntity>(makeEnemy, 64);
  readonly soldiers = new Pool<SoldierEntity>(makeSoldier, 8);
  readonly projectiles = new Pool<ProjectileEntity>(makeProjectile, 64);
  readonly particles = new Pool<ParticleEntity>(makeParticle, 256);
  readonly damageNumbers = new Pool<DamageNumber>(makeDamageNumber, 32);
  readonly decals = new Pool<Decal>(makeDecal, 64);
  readonly pickups = new Pool<Pickup>(makePickup, 8);
  readonly lights = new Pool<LightSource & { active: boolean }>(makeLight, 32);

  private hash = new SpatialHash(96, WORLD.width + WORLD.spawnMargin * 2);
  private rng: Rng;
  private field: FlowField;

  readonly player: PlayerView;
  buildings: PlacedBuilding[];
  private night: number;
  private nightDef: NightDef;

  // spawn director
  private waveIndex = 0;
  private waveTasks: SpawnTask[] = [];
  private interWaveTimer = 0;
  private spawnedTotal = 0;
  private killedTotal = 0;
  private totalToSpawn = 0;

  // player weapon state
  private fireCd = 0;
  private mag: number;
  private reloadTimer = 0;
  private firing = false;
  private aimDir = 0;
  abilityCd = 0;
  private abilityActive = 0;

  outcome: BattleOutcome = 'running';
  shakeTrauma = 0;
  /** Decays to 0 after the player fires; drives the muzzle-flash sprite. */
  muzzleFlash = 0;
  /**
   * Hit-stop: seconds of near-frozen time after a heavy kill (boss/tank/brute).
   * Gives big hits a satisfying "punch". The step loop scales dt while > 0 so
   * the whole sim crawls for a few frames without desyncing the fixed timestep.
   */
  hitStop = 0;
  private reducedMotion = false;

  /** Trigger hit-stop unless reduced-motion is on. */
  private punch(seconds: number): void {
    if (!this.reducedMotion) this.hitStop = Math.max(this.hitStop, seconds);
  }
  /** Resource bounties earned this night (applied at dawn). */
  readonly earned: Record<ResourceType, number> = { wood: 0, stone: 0, scrap: 0, fuel: 0, food: 0, energy: 0 };
  /** Enemy/boss types encountered or killed this night (for the codex). */
  readonly encountered = new Set<string>();

  // building hp tracked live; mirrored back to the store at dawn
  private buildingHp = new Map<string, number>();

  private mods: Modifiers;
  private ammo: number;
  private rockets: number;
  private components: number;
  private playerRevived = false;
  private medbayHealAcc = 0;
  /** Spent intermediates to reconcile against the store at dawn. */
  readonly spent = { ammo: 0, rockets: 0, components: 0 };
  /** Live boss handle (for phase logic / UI), if any. */
  boss: EnemyEntity | null = null;
  bossPhase = 0;
  private barracksRosterKey = '';

  // ---- world mode: continuous automatic day/night cycle --------------------
  /** When true the sim runs a full day→dusk→night→dawn loop instead of a single night battle. */
  readonly worldMode: boolean;
  /** Seconds into the current full cycle (0..CYCLE.fullSec). */
  worldClock = 0;
  /** Current phase derived from worldClock. */
  phase: WorldPhase = 'day';
  /**
   * Ambient light 0..1 (1 = full day). The renderer drives the darkness overlay
   * and torch visibility from this, giving smooth sunset/sunrise grading.
   */
  lightLevel = 1;
  /** Fired once at each dawn with that night's summary. */
  onDawn: ((summary: { night: number; killed: number }) => void) | null = null;
  /** Fired when a building is destroyed mid-play (world mode syncs the store). */
  onBuildingDestroyed: ((id: string) => void) | null = null;
  /** Kills accumulated during the current night (reset at dawn). */
  private nightKills = 0;
  private nightStarted = false;

  // ---- stamina & dodge roll (souls-feel) ------------------------------------
  readonly maxStamina = 100;
  stamina = 100;
  /** Seconds remaining of the active roll (i-frames + dash). */
  rollTime = 0;
  private rollDirX = 0;
  private rollDirY = 0;
  private static readonly ROLL_DURATION = 0.38;
  private static readonly ROLL_SPEED = 420;
  private static readonly ROLL_COST = 30;

  private hitCb: HitCallbacks;

  constructor(opts: {
    night: number;
    buildings: PlacedBuilding[];
    player: PlayerView;
    seed?: number;
    completedResearch?: string[];
    ammo?: number;
    rockets?: number;
    components?: number;
    /** Accessibility: when true, suppress hit-stop and dampen screen shake. */
    reducedMotion?: boolean;
    /** Continuous world cycle mode (auto day/night). */
    worldMode?: boolean;
    /** Resume mid-cycle (e.g. loading a save that was mid-day). */
    worldClock?: number;
  }) {
    this.worldMode = opts.worldMode ?? false;
    this.worldClock = opts.worldClock ?? 0;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.night = opts.night;
    this.buildings = opts.buildings;
    this.player = { ...opts.player };
    this.rng = new Rng(opts.seed ?? (Math.random() * 2 ** 32) >>> 0);
    this.nightDef = resolveNightDef(opts.night);
    this.field = buildFlowField(this.buildings, this.shelter());
    this.mods = resolveModifiers(opts.completedResearch ?? []);
    this.ammo = opts.ammo ?? 0;
    this.rockets = opts.rockets ?? 0;
    this.components = opts.components ?? 0;
    const wdef = this.weaponDef();
    this.mag = weaponStatsAtLevel(wdef, this.player.weaponLevel).magazine;

    for (const b of this.buildings) {
      const def = BUILDINGS[b.type];
      let maxHp = Math.round(def.baseHp * (1 + def.scaling.hpPerLevel * (b.level - 1)));
      if (def.category === 'barrier') maxHp = Math.round(maxHp * this.mods.wallHp);
      this.buildingHp.set(b.id, b.hp > 0 ? Math.min(b.hp, maxHp) : maxHp);
    }

    this.placeTorchLights();
    this.spawnSoldiers();
    this.barracksRosterKey = this.makeBarracksRosterKey(this.buildings);
    this.queueWave(0);
    this.totalToSpawn = this.countTotalEnemies();

    this.hitCb = {
      onDamage: (e, dealt, x, y) => {
        if (dealt > 0) spawnDamageNumber(this.damageNumbers, x, y, dealt, dealt > 80);
        spawnBurst(this.particles, this.rng, x, y, 3, 'blood');
      },
      onKill: (e) => this.onEnemyKilled(e),
      onExplosion: (x, y, radius) => {
        spawnExplosion(this.particles, this.rng, x, y, radius);
        spawnBurst(this.particles, this.rng, x, y, 8, 'smoke');
        spawnDecal(this.decals, x, y, radius * 0.6, 'scorch');
        spawnLight(this.lights, x, y, radius * 2.2, THEME.colors.fireLight, 1.1, 0.35);
        this.addShake(0.5);
      },
    };
  }

  // ---- public accessors ----------------------------------------------------

  shelter(): PlacedBuilding | undefined {
    return this.buildings.find((b) => b.type === 'shelter');
  }

  getBuildingHp(id: string): number {
    return this.buildingHp.get(id) ?? 0;
  }

  buildingMaxHp(b: PlacedBuilding): number {
    const def = BUILDINGS[b.type];
    let hp = Math.round(def.baseHp * (1 + def.scaling.hpPerLevel * (b.level - 1)));
    if (def.category === 'barrier') hp = Math.round(hp * this.mods.wallHp);
    return hp;
  }

  /** Remaining battle ammo (for HUD / supply warnings). */
  get supplies(): { ammo: number; rockets: number; components: number } {
    return { ammo: this.ammo, rockets: this.rockets, components: this.components };
  }

  get progress(): { killed: number; total: number; wave: number; waves: number } {
    return {
      killed: this.killedTotal,
      total: this.totalToSpawn,
      wave: this.waveIndex + 1,
      waves: this.nightDef.waves.length,
    };
  }

  // ---- input from controls -------------------------------------------------

  setFiring(on: boolean): void {
    this.firing = on;
  }

  setAim(dir: number): void {
    this.aimDir = dir;
    this.player.facing = dir;
  }

  moveBy(dx: number, dy: number, dt: number): void {
    const speed = 150;
    const nextX = clampWorld(this.player.x + dx * speed * dt, WORLD.width);
    if (!this.playerHitsBuilding(nextX, this.player.y)) this.player.x = nextX;
    const nextY = clampWorld(this.player.y + dy * speed * dt, WORLD.height);
    if (!this.playerHitsBuilding(this.player.x, nextY)) this.player.y = nextY;
    if (dx !== 0 || dy !== 0) this.player.facing = Math.atan2(dy, dx);
  }

  private playerHitsBuilding(x: number, y: number): boolean {
    const r = 11;
    for (const b of this.buildings) {
      if (b.type === 'shelter') continue;
      if (b.buildUntil && b.buildUntil > Date.now()) continue;
      if ((this.buildingHp.get(b.id) ?? b.hp) <= 0) continue;
      const def = BUILDINGS[b.type];
      const pad = def.category === 'barrier' ? 2 : 8;
      const left = b.origin.col * GRID.tileSize + pad;
      const top = b.origin.row * GRID.tileSize + pad;
      const right = (b.origin.col + def.size.w) * GRID.tileSize - pad;
      const bottom = (b.origin.row + def.size.h) * GRID.tileSize - pad;
      const cx = Math.max(left, Math.min(x, right));
      const cy = Math.max(top, Math.min(y, bottom));
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
    }
    return false;
  }

  triggerAbility(): void {
    if (this.abilityCd > 0) return;
    const def = this.weaponDef();
    this.abilityCd = def.ability.cooldown;
    this.abilityActive = def.ability.duration;
  }

  // ---- main step -----------------------------------------------------------

  step(dt: number): void {
    if (this.outcome !== 'running') return;

    // hit-stop: crawl time for a few frames after a heavy kill. We never fully
    // freeze (would stall input feel); 0.12× keeps it responsive but weighty.
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      dt *= 0.12;
    }

    if (this.worldMode) this.updateWorldCycle(dt);
    this.updateStamina(dt);

    const combatActive = !this.worldMode || this.phase === 'night' || this.phase === 'dusk';

    this.hash.rebuild(this.enemies.items);
    if (combatActive) {
      this.updateSpawning(dt);
      this.updateBoss(dt);
    }
    this.updatePlayerWeapon(dt);
    this.updateTowers(dt);
    this.updateSoldiers(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    updateParticles(this.particles, dt);
    updateDamageNumbers(this.damageNumbers, dt);
    updateDecals(this.decals, dt);
    this.updateMedbay(dt);
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.5);
    if (this.abilityCd > 0) this.abilityCd -= dt;
    if (this.abilityActive > 0) this.abilityActive -= dt;

    this.tryRevive();
    this.checkOutcome();
  }

  /**
   * Advance the automatic day/night cycle: derive phase + ambient light from
   * the clock, start the night's spawn waves at dusk, and at dawn burn off any
   * leftover zombies, report the survived night, and roll the counter forward.
   */
  private updateWorldCycle(dt: number): void {
    this.worldClock += dt;
    const { daySec, duskSec, nightSec, dawnSec, fullSec } = CYCLE;
    if (this.worldClock >= fullSec) {
      // ---- dawn: a new day ----
      this.worldClock -= fullSec;
      this.burnLeftoverEnemies();
      this.onDawn?.({ night: this.night, killed: this.nightKills });
      this.night += 1;
      this.nightKills = 0;
      this.nightStarted = false;
      this.nightDef = resolveNightDef(this.night);
      this.bossSpawned = false;
      this.playerRevived = false;
    }

    const t = this.worldClock;
    if (t < daySec - duskSec) {
      this.phase = 'day';
    } else if (t < daySec) {
      this.phase = 'dusk';
      // first crawlers emerge during dusk
      if (!this.nightStarted) {
        this.nightStarted = true;
        this.waveIndex = 0;
        this.queueWave(0);
        this.totalToSpawn = this.countTotalEnemies();
      }
    } else if (t < daySec + dawnSec) {
      this.phase = 'night';
    } else {
      this.phase = 'night';
    }

    // ambient light: smooth grade across dusk and dawn windows
    if (t < daySec - duskSec) {
      // full day, with a soft sunrise ramp at the very start
      this.lightLevel = Math.min(1, 0.35 + (t / dawnSec) * 0.65);
      if (t > dawnSec) this.lightLevel = 1;
    } else if (t < daySec) {
      // dusk: 1 → 0.15
      const k = (t - (daySec - duskSec)) / duskSec;
      this.lightLevel = 1 - k * 0.85;
    } else {
      // night: hold dark, slight moonlight
      this.lightLevel = 0.15;
    }
    void nightSec;
  }

  /** At dawn surviving zombies catch fire and die (the sun burns them off). */
  private burnLeftoverEnemies(): void {
    this.enemies.forEachActive((e) => {
      spawnBurst(this.particles, this.rng, e.x, e.y, 6, 'ember');
      e.active = false;
    });
    this.boss = null;
  }

  /** Stamina regen + roll timer. */
  private updateStamina(dt: number): void {
    if (this.rollTime > 0) {
      this.rollTime = Math.max(0, this.rollTime - dt);
      // dash movement during the roll
      const sp = BattleSim.ROLL_SPEED * (this.rollTime / BattleSim.ROLL_DURATION + 0.4);
      this.player.x = clampWorld(this.player.x + this.rollDirX * sp * dt, WORLD.width);
      this.player.y = clampWorld(this.player.y + this.rollDirY * sp * dt, WORLD.height);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + 22 * dt);
    }
  }

  /**
   * Dodge roll (Dark Souls): a short dash with i-frames. Costs stamina; rolls
   * in the current movement direction (or facing if standing still).
   */
  roll(dirX: number, dirY: number): boolean {
    if (this.rollTime > 0 || this.stamina < BattleSim.ROLL_COST) return false;
    const mag = Math.hypot(dirX, dirY);
    if (mag < 0.2) {
      this.rollDirX = Math.cos(this.player.facing);
      this.rollDirY = Math.sin(this.player.facing);
    } else {
      this.rollDirX = dirX / mag;
      this.rollDirY = dirY / mag;
    }
    this.stamina -= BattleSim.ROLL_COST;
    this.rollTime = BattleSim.ROLL_DURATION;
    spawnDust(this.particles, this.rng, this.player.x, this.player.y, 5);
    return true;
  }

  /** True while the player has roll i-frames. */
  get invulnerable(): boolean {
    return this.rollTime > 0;
  }

  /**
   * Sync the sim's building view after the player builds/sells during play
   * (CoC-style construction happens inside the live world). Rebuilds the
   * flow-field and registers HP for new structures.
   */
  syncBuildings(buildings: PlacedBuilding[]): void {
    this.buildings = buildings;
    for (const b of buildings) {
      if (!this.buildingHp.has(b.id)) {
        const def = BUILDINGS[b.type];
        let maxHp = Math.round(def.baseHp * (1 + def.scaling.hpPerLevel * (b.level - 1)));
        if (def.category === 'barrier') maxHp = Math.round(maxHp * this.mods.wallHp);
        this.buildingHp.set(b.id, Math.min(b.hp > 0 ? b.hp : maxHp, maxHp));
      }
    }
    this.field = buildFlowField(this.buildings, this.shelter());
    const rosterKey = this.makeBarracksRosterKey(buildings);
    if (rosterKey !== this.barracksRosterKey) {
      this.barracksRosterKey = rosterKey;
      this.soldiers.clear();
      this.spawnSoldiers();
    }
  }

  private makeBarracksRosterKey(buildings: PlacedBuilding[]): string {
    return buildings
      .filter((b) => b.type === 'barracks')
      .map((b) => `${b.id}:${b.garrison ?? 0}:${b.buildUntil && b.buildUntil > Date.now() ? 1 : 0}`)
      .join('|');
  }

  private hasMedbay(): boolean {
    return this.buildings.some(
      (b) => b.type === 'medbay' && (this.buildingHp.get(b.id) ?? 0) > 0,
    );
  }

  /** Medbay heals the player slowly during the night (survival research). */
  private updateMedbay(dt: number): void {
    if (!this.mods.medbayNight || !this.hasMedbay()) return;
    if (this.player.hp <= 0 || this.player.hp >= this.player.maxHp) return;
    this.medbayHealAcc += dt;
    if (this.medbayHealAcc >= 1) {
      this.medbayHealAcc -= 1;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.03);
    }
  }

  // ---- soldiers (barracks defenders) --------------------------------------

  /** Spawn trained defenders assigned to each barracks. */
  private spawnSoldiers(): void {
    const wdef = this.weaponDef();
    const baseStats = weaponStatsAtLevel(wdef, this.player.weaponLevel);
    for (const b of this.buildings) {
      if (b.type !== 'barracks') continue;
      if (b.buildUntil && b.buildUntil > Date.now()) continue;
      const bdef = BUILDINGS[b.type];
      const count = Math.max(0, Math.min(BUILDINGS.barracks.maxLevel, b.garrison ?? 0));
      if (count <= 0) continue;
      const cx = (b.origin.col + bdef.size.w / 2) * GRID.tileSize;
      const cy = (b.origin.row + bdef.size.h / 2) * GRID.tileSize;
      const patrolRadius = Math.max(bdef.size.w, bdef.size.h) * GRID.tileSize * 0.82;
      for (let i = 0; i < count; i++) {
        const s = this.soldiers.spawn();
        s.id = nextEntityId++;
        s.homeX = cx;
        s.homeY = cy;
        const ang = (i / count) * Math.PI * 2;
        s.x = clampWorld(cx + Math.cos(ang) * patrolRadius, WORLD.width);
        s.y = clampWorld(cy + Math.sin(ang) * patrolRadius, WORLD.height);
        s.px = s.x;
        s.py = s.y;
        s.maxHp = Math.round(70 * this.mods.soldierHp);
        s.hp = s.maxHp;
        s.facing = ang;
        s.fireCd = this.rng.range(0, 0.5);
        s.damage = baseStats.damage * 0.7 * this.mods.soldierDamage;
      }
    }
  }

  /** Soldiers hold a loose perimeter, engage the nearest enemy in range. */
  private updateSoldiers(dt: number): void {
    const wdef = this.weaponDef();
    const range = Math.max(220, wdef.range);
    this.soldiers.forEachActive((s) => {
      s.px = s.x;
      s.py = s.y;
      const target = this.hash.nearest(s.x, s.y, range);
      if (target) {
        s.facing = angleBetween(s.x, s.y, target.x, target.y);
        // keep some distance: advance if far, back off if too close
        const d = Math.hypot(target.x - s.x, target.y - s.y);
        const desired = Math.min(140, range * 0.6);
        const step = 60 * dt;
        if (d > desired + 20) {
          s.x += Math.cos(s.facing) * step;
          s.y += Math.sin(s.facing) * step;
        } else if (d < desired - 20) {
          s.x -= Math.cos(s.facing) * step;
          s.y -= Math.sin(s.facing) * step;
        }
        s.fireCd -= dt;
        if (s.fireCd <= 0) {
          s.fireCd = 1 / wdef.fireRate;
          this.fireWeapon(wdef, s.damage, s.x, s.y, s.facing, true);
        }
      } else {
        // patrol back toward home anchor
        const dx = s.homeX - s.x;
        const dy = s.homeY - s.y;
        const d = Math.hypot(dx, dy);
        if (d > 30) {
          s.facing = Math.atan2(dy, dx);
          s.x += (dx / d) * 50 * dt;
          s.y += (dy / d) * 50 * dt;
        }
      }
      s.x = clampWorld(s.x, WORLD.width);
      s.y = clampWorld(s.y, WORLD.height);
    });
  }

  /** Damage the nearest soldier to (x,y) within `radius`; returns true if one was hit. */
  private damageNearestSoldier(x: number, y: number, radius: number, amount: number): boolean {
    let best: SoldierEntity | null = null;
    let bestD = radius * radius;
    this.soldiers.forEachActive((s) => {
      const d = dist2(x, y, s.x, s.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    });
    if (!best) return false;
    const hit = best as SoldierEntity;
    hit.hp -= amount;
    spawnBurst(this.particles, this.rng, hit.x, hit.y, 4, 'blood');
    if (hit.hp <= 0) {
      hit.active = false;
      spawnBurst(this.particles, this.rng, hit.x, hit.y, 10, 'blood');
      spawnDecal(this.decals, hit.x, hit.y, 14, 'blood');
    }
    return true;
  }

  /**
   * On player death, attempt a revive: the survival doctrine ("freeRevive")
   * gives a penalty-free 50% revive while the shelter stands; otherwise a
   * medbay grants one revive per night. Returns nothing; sets outcome if no
   * revive is possible.
   */
  private tryRevive(): void {
    if (this.player.hp > 0) return;
    const shelterAlive = !!this.shelter() && (this.buildingHp.get(this.shelter()!.id) ?? 0) > 0;
    if (!shelterAlive) return; // shelter gone → genuine loss, handled in checkOutcome
    const canFree = this.mods.freeRevive;
    const canMedbay = !this.playerRevived && this.hasMedbay();
    if (canFree || canMedbay) {
      if (!canFree) this.playerRevived = true;
      this.player.hp = this.player.maxHp * 0.5;
      const s = this.shelter()!;
      this.player.x = (s.origin.col + 1) * GRID.tileSize;
      this.player.y = (s.origin.row + 1) * GRID.tileSize;
      spawnBurst(this.particles, this.rng, this.player.x, this.player.y, 16, 'ember');
      this.addShake(0.4);
    }
  }

  get revivePenaltyFree(): boolean {
    return this.mods.freeRevive;
  }

  // ---- spawn director ------------------------------------------------------

  private countTotalEnemies(): number {
    let n = 0;
    for (const w of this.nightDef.waves) for (const g of w.groups) n += g.count;
    if (this.nightDef.boss) n += 1;
    return n;
  }

  private queueWave(index: number): void {
    const wave = this.nightDef.waves[index];
    this.waveTasks = [];
    if (!wave) return;
    for (const g of wave.groups) {
      this.waveTasks.push({
        type: g.type,
        remaining: g.count,
        intervalSec: g.intervalSec,
        timer: g.delaySec,
        edges: g.edges,
        delaySec: g.delaySec,
      });
    }
  }

  private updateSpawning(dt: number): void {
    const anyLeft = this.waveTasks.some((t) => t.remaining > 0);
    if (!anyLeft) {
      // wave cleared of spawns — advance once living enemies are also gone
      if (this.enemies.activeCount === 0) {
        if (this.waveIndex < this.nightDef.waves.length - 1) {
          this.interWaveTimer += dt;
          if (this.interWaveTimer >= TIMING.interWaveSec) {
            this.interWaveTimer = 0;
            this.waveIndex++;
            this.queueWave(this.waveIndex);
          }
        } else if (this.nightDef.boss && !this.bossSpawned) {
          this.spawnBoss();
        }
      }
      return;
    }
    for (const t of this.waveTasks) {
      if (t.remaining <= 0) continue;
      t.timer -= dt;
      while (t.timer <= 0 && t.remaining > 0) {
        this.spawnEnemyAtEdge(t.type, t.edges);
        t.remaining--;
        t.timer += t.intervalSec;
      }
    }
  }

  private bossSpawned = false;

  private bossSpawnAcc = 0;

  private spawnBoss(): void {
    const boss = bossForNight(this.night);
    if (!boss) return;
    this.bossSpawned = true;

    // "Рой" is not a single entity but a synchronized 200-runner assault.
    if (boss.type === 'swarm') {
      const edges: MapEdge[] = ['north', 'south', 'east', 'west'];
      for (let i = 0; i < 200; i++) {
        const e = this.enemies.spawn();
        initEnemy(e, 'runner');
        e.hp = scaledHp('runner', this.night);
        e.maxHp = e.hp;
        this.positionAtEdge(e, edges[i % edges.length]!);
        // stagger slightly so they don't perfectly overlap
        e.x += this.rng.range(-30, 30);
        e.y += this.rng.range(-30, 30);
        e.px = e.x;
        e.py = e.y;
      }
      this.addShake(1);
      return;
    }

    const e = this.enemies.spawn();
    initEnemy(e, 'brute'); // base movement profile; boss flag drives behaviour/visuals
    e.boss = boss.type;
    e.hp = boss.hp;
    e.maxHp = boss.hp;
    // Hive Mother is stationary, far off the map.
    if (boss.type === 'hiveMother') {
      e.x = WORLD.width / 2;
      e.y = -WORLD.spawnMargin;
    } else {
      this.positionAtEdge(e, 'north');
    }
    e.px = e.x;
    e.py = e.y;
    this.boss = e;
    this.bossPhase = 0;
    this.addShake(1);
  }

  /** Drive the active boss's phase-based pattern (called each step). */
  private updateBoss(dt: number): void {
    const e = this.boss;
    if (!e || !e.active) {
      this.boss = null;
      return;
    }
    const def = bossForNight(this.night);
    if (!def) return;
    const pct = (e.hp / e.maxHp) * 100;
    // advance phase index as HP thresholds are crossed
    let phase = 0;
    for (let i = 0; i < def.phases.length; i++) {
      if (pct <= def.phases[i]!.trigger.hpPercent) phase = i;
    }
    this.bossPhase = phase;
    const pattern = def.phases[phase]?.pattern ?? '';

    this.bossSpawnAcc += dt;
    const spawnInterval = pattern === 'endlessSpawn' ? 1.2 : pattern === 'enrage' ? 0.6 : pattern === 'spawnRunners' ? 2 : 0;
    if (spawnInterval > 0 && this.bossSpawnAcc >= spawnInterval) {
      this.bossSpawnAcc = 0;
      const addType: EnemyEntity['type'] = pattern === 'enrage' ? 'brute' : 'runner';
      const s = this.enemies.spawn();
      initEnemy(s, addType);
      s.hp = scaledHp(addType, this.night);
      s.maxHp = s.hp;
      s.x = e.x + this.rng.range(-40, 40);
      s.y = Math.max(0, e.y + this.rng.range(-10, 40));
      s.px = s.x;
      s.py = s.y;
    }

    // Iron Guardian lobs rockets at random buildings.
    if (pattern === 'rocketSalvo' || pattern === 'overcharge') {
      this.bossRocketAcc += dt;
      if (this.bossRocketAcc >= 2.5) {
        this.bossRocketAcc = 0;
        const targets = this.buildings.filter((b) => (this.buildingHp.get(b.id) ?? 0) > 0);
        const tgt = targets[this.rng.int(0, targets.length - 1)];
        if (tgt) {
          const tx = (tgt.origin.col + 0.5) * GRID.tileSize;
          const ty = (tgt.origin.row + 0.5) * GRID.tileSize;
          this.hitCb.onExplosion?.(tx, ty, 90);
          this.damageBuilding(tgt.id, 200);
        }
      }
    }
  }

  private bossRocketAcc = 0;

  private spawnEnemyAtEdge(type: EnemyEntity['type'], edges: MapEdge[]): void {
    const e = this.enemies.spawn();
    initEnemy(e, type);
    e.hp = scaledHp(type, this.night);
    e.maxHp = e.hp;
    const edge = edges[this.rng.int(0, edges.length - 1)] ?? 'south';
    this.positionAtEdge(e, edge);
    this.encountered.add(type);
    this.spawnedTotal++;
  }

  private positionAtEdge(e: EnemyEntity, edge: MapEdge): void {
    const m = WORLD.spawnMargin * 0.5;
    switch (edge) {
      case 'north':
        e.x = this.rng.range(0, WORLD.width);
        e.y = -m;
        break;
      case 'south':
        e.x = this.rng.range(0, WORLD.width);
        e.y = WORLD.height + m;
        break;
      case 'west':
        e.x = -m;
        e.y = this.rng.range(0, WORLD.height);
        break;
      case 'east':
        e.x = WORLD.width + m;
        e.y = this.rng.range(0, WORLD.height);
        break;
    }
    e.px = e.x;
    e.py = e.y;
  }

  // ---- enemies -------------------------------------------------------------

  private steerOut = { x: 0, y: 0 };

  private updateEnemies(dt: number): void {
    const shelter = this.shelter();
    this.enemies.forEachActive((e) => {
      tickStatus(e, dt, this.hitCb);
      if (!e.active) return;
      const def = ENEMIES[e.type];
      const speedMul = speedMultiplier(e);
      const speed = def.speed * (e.boss ? 0.8 : 1) * speedMul;

      e.px = e.x;
      e.py = e.y;

      // summoners
      if (def.summon) {
        e.summonCd -= dt;
        if (e.summonCd <= 0) {
          e.summonCd = def.summon.intervalSec;
          for (let i = 0; i < def.summon.count; i++) {
            const s = this.enemies.spawn();
            initEnemy(s, def.summon.type);
            s.hp = scaledHp(def.summon.type, this.night);
            s.maxHp = s.hp;
            s.x = e.x + this.rng.range(-20, 20);
            s.y = e.y + this.rng.range(-20, 20);
            s.px = s.x;
            s.py = s.y;
          }
        }
      }

      // engage a soldier if one is adjacent (they screen the base)
      let nearSoldier: SoldierEntity | null = null;
      let nearSoldierD = 52 * 52;
      this.soldiers.forEachActive((s) => {
        const d = dist2(e.x, e.y, s.x, s.y);
        if (d < nearSoldierD) {
          nearSoldierD = d;
          nearSoldier = s;
        }
      });
      if (nearSoldier) {
        const sol = nearSoldier as SoldierEntity;
        e.targetId = SOLDIER_TARGET;
        e.facing = angleBetween(e.x, e.y, sol.x, sol.y);
        this.attack(e, sol.x, sol.y, dt, def, SOLDIER_TARGET);
        return;
      }

      // target the player if very close, else flow toward shelter
      const toPlayer2 = dist2(e.x, e.y, this.player.x, this.player.y);
      if (toPlayer2 < 60 * 60) {
        e.targetId = PLAYER_TARGET;
        this.attack(e, this.player.x, this.player.y, dt, def, PLAYER_TARGET);
        e.facing = angleBetween(e.x, e.y, this.player.x, this.player.y);
        return;
      }

      // check building collision in front (attack walls/buildings)
      const blocking = this.buildingBlocking(e);
      if (blocking) {
        e.targetId = SHELTER_TARGET;
        if (this.mods.wallSlow) addStatus(e, 'slowed', 0.5, 0.4);
        this.attack(e, e.x, e.y, dt, def, blocking.id);
        return;
      }

      directionAt(this.field, e.x, e.y, this.steerOut);
      e.facing = Math.atan2(this.steerOut.y, this.steerOut.x);
      e.x += this.steerOut.x * speed * dt;
      e.y += this.steerOut.y * speed * dt;

      // reached shelter?
      if (shelter) {
        const sx = (shelter.origin.col + 1) * GRID.tileSize;
        const sy = (shelter.origin.row + 1) * GRID.tileSize;
        if (dist2(e.x, e.y, sx, sy) < 70 * 70) {
          this.attack(e, sx, sy, dt, def, shelter.id);
        }
      }
    });
  }

  private buildingBlocking(e: EnemyEntity): PlacedBuilding | null {
    const col = Math.floor(e.x / GRID.tileSize);
    const row = Math.floor(e.y / GRID.tileSize);
    for (const b of this.buildings) {
      if (b.type === 'shelter') continue;
      const def = BUILDINGS[b.type];
      if (def.category !== 'barrier') continue;
      if (b.type === 'gate' && b.open) continue;
      if (
        col >= b.origin.col &&
        col < b.origin.col + def.size.w &&
        row >= b.origin.row &&
        row < b.origin.row + def.size.h &&
        (this.buildingHp.get(b.id) ?? 0) > 0
      ) {
        return b;
      }
    }
    return null;
  }

  private attack(
    e: EnemyEntity,
    tx: number,
    ty: number,
    dt: number,
    def: (typeof ENEMIES)[keyof typeof ENEMIES],
    targetId: number | string,
  ): void {
    e.attackCd -= dt;
    if (e.attackCd > 0) return;
    e.attackCd = 1; // 1 hit/sec

    // suicide bombers detonate
    if (e.type === 'suicide') {
      this.hitCb.onExplosion?.(e.x, e.y, 70);
      this.hash.queryRadius(e.x, e.y, 70, (other) => {
        if (other.id === e.id || !other.active) return;
        applyDamage(other, 40, 'explosive');
        if (other.hp <= 0) this.onEnemyKilled(other);
      });
      if (typeof targetId === 'string') this.damageBuilding(targetId, def.structureDamage * 4);
      if (targetId === PLAYER_TARGET) this.damagePlayer(def.damage);
      if (targetId === SOLDIER_TARGET) this.damageNearestSoldier(tx, ty, 60, def.damage * 2);
      e.active = false;
      return;
    }

    if (targetId === PLAYER_TARGET) {
      this.damagePlayer(def.damage);
    } else if (targetId === SOLDIER_TARGET) {
      this.damageNearestSoldier(tx, ty, 60, def.damage);
    } else if (typeof targetId === 'string') {
      this.damageBuilding(targetId, def.structureDamage);
    }
  }

  private damageBuilding(id: string, amount: number): void {
    const hp = this.buildingHp.get(id);
    if (hp === undefined) return;
    const b0 = this.buildings.find((x) => x.id === id);
    // bunker doctrine armors the shelter
    const armored = b0?.type === 'shelter' ? this.mods.shelterArmor : 1;
    const next = hp - amount * armored;
    this.buildingHp.set(id, next);
    if (next <= 0) {
      const b = this.buildings.find((x) => x.id === id);
      if (b) {
        const bx = (b.origin.col + 0.5) * GRID.tileSize;
        const by = (b.origin.row + 0.5) * GRID.tileSize;
        spawnBurst(this.particles, this.rng, bx, by, 20, 'debris');
        spawnBurst(this.particles, this.rng, bx, by, 8, 'smoke');
        this.addShake(0.4);
        if (b.type !== 'shelter') {
          this.buildings = this.buildings.filter((x) => x.id !== id);
          this.field = buildFlowField(this.buildings, this.shelter());
          this.onBuildingDestroyed?.(id);
        }
      }
    }
  }

  private damagePlayer(amount: number): void {
    if (this.rollTime > 0) return; // dodge-roll i-frames (souls rule: roll through hits)
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.addShake(0.3);
    spawnBurst(this.particles, this.rng, this.player.x, this.player.y, 4, 'blood');
  }

  private onEnemyKilled(e: EnemyEntity): void {
    this.killedTotal++;
    this.nightKills++;
    this.encountered.add(e.boss ?? e.type);
    if (e.boss && this.boss && e.id === this.boss.id) {
      this.boss = null;
      // victory burst when a boss falls — big punch
      spawnConfetti(this.particles, this.rng, e.x, e.y, 50);
      this.addShake(0.6);
      this.punch(0.32);
    }
    const def = ENEMIES[e.type];
    spawnBurst(this.particles, this.rng, e.x, e.y, 10, 'blood');
    spawnDecal(this.decals, e.x, e.y, 14, 'blood');
    // armored chunks fly off — heavy units get a brief hit-stop for weight
    if (e.type === 'armored' || e.type === 'tank') {
      spawnDust(this.particles, this.rng, e.x, e.y, 6);
      this.punch(0.07);
    } else if (e.type === 'brute') {
      this.punch(0.05);
    }
    if (def.behaviors.includes('leavesAcid')) {
      spawnDecal(this.decals, e.x, e.y, 26, 'acid', 6);
    }
    for (const [res, amt] of Object.entries(def.bounty) as [ResourceType, number][]) {
      this.earned[res] += amt;
    }
  }

  // ---- player & tower weapons ---------------------------------------------

  private weaponDef(): WeaponDef {
    return WEAPONS[this.player.weapon];
  }

  private updatePlayerWeapon(dt: number): void {
    const def = this.weaponDef();
    const stats = weaponStatsAtLevel(def, this.player.weaponLevel);
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt * 12);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.mag = stats.magazine;
      return;
    }
    if (!this.firing) return;

    const abilityRateMul = this.abilityActive > 0 ? 3 : 1;
    if (this.fireCd <= 0) {
      this.fireWeapon(def, stats.damage, this.player.x, this.player.y, this.aimDir, true);
      this.muzzleFlash = 1;
      this.fireCd = 1 / (def.fireRate * abilityRateMul);
      if (def.magazine > 0) {
        this.mag--;
        if (this.mag <= 0) this.reloadTimer = stats.reloadTime;
      }
    }
  }

  private updateTowers(dt: number): void {
    const def = this.weaponDef();
    const stats = weaponStatsAtLevel(def, this.player.weaponLevel);
    for (const b of this.buildings) {
      const bdef = BUILDINGS[b.type];
      if (bdef.category !== 'defense') continue;
      if ((this.buildingHp.get(b.id) ?? 0) <= 0) continue;
      // scaffolding doesn't shoot (CoC-style construction in progress)
      if (b.buildUntil && b.buildUntil > Date.now()) continue;
      const cx = (b.origin.col + bdef.size.w / 2) * GRID.tileSize;
      const cy = (b.origin.row + bdef.size.h / 2) * GRID.tileSize;
      const range = bdef.range ?? def.range;
      // tower-local cooldown stored on the building via a side map
      const cd = (this.towerCd.get(b.id) ?? 0) - dt;
      if (cd > 0) {
        this.towerCd.set(b.id, cd);
        continue;
      }
      const target = this.hash.nearest(cx, cy, range);
      if (!target) {
        this.towerCd.set(b.id, 0);
        continue;
      }
      const dir = angleBetween(cx, cy, target.x, target.y);
      // research doctrine buffs apply to all towers
      const dmgMul = this.mods.towerDamage;
      const rateMul = this.mods.towerFireRate;
      // towers with their own damage (sniper/mortar/fence) use it; plain tower copies the weapon
      if (bdef.baseDamage && bdef.baseDamage > 0) {
        this.fireTowerShot(b.type, bdef, cx, cy, dir, dmgMul);
        this.towerCd.set(b.id, 1 / ((bdef.fireRate ?? 1) * rateMul));
      } else {
        this.fireWeapon(def, stats.damage * dmgMul, cx, cy, dir, true);
        this.towerCd.set(b.id, 1 / (def.fireRate * rateMul));
      }
    }
  }

  private towerCd = new Map<string, number>();

  private fireTowerShot(
    type: PlacedBuilding['type'],
    bdef: (typeof BUILDINGS)[keyof typeof BUILDINGS],
    x: number,
    y: number,
    dir: number,
    dmgMul: number,
  ): void {
    const p = this.projectiles.spawn();
    p.behavior = bdef.aoeRadius ? 'explosive' : 'single';
    p.x = x;
    p.y = y;
    p.px = x;
    p.py = y;
    const speed = 900;
    p.vx = Math.cos(dir) * speed;
    p.vy = Math.sin(dir) * speed;
    p.damage = (bdef.baseDamage ?? 50) * dmgMul;
    p.range = bdef.range ?? 300;
    p.traveled = 0;
    p.dmgType = type === 'electricFence' ? 'electric' : 'bullet';
    p.pierce = 0;
    p.effectRadius = bdef.aoeRadius ?? 0;
    p.friendly = true;
    p.weapon = 'ak';
    spawnMuzzleFlash(this.particles, this.rng, x, y, dir);
  }

  /**
   * Try to pay a weapon's per-shot supply cost. Returns true if it may fire.
   * Firearms need ammo; rocket launchers need rockets; electric/plasma need
   * advanced components. When supply is exhausted, firearms/heavy simply can't
   * fire (the player/towers fall silent until resupplied) — the strategic
   * pressure the production chains are meant to create.
   */
  private paySupply(def: WeaponDef): boolean {
    switch (def.consumes) {
      case 'ammo':
        if (this.ammo <= 0) return false;
        this.ammo--;
        this.spent.ammo++;
        return true;
      case 'rockets':
        if (this.rockets <= 0) return false;
        this.rockets--;
        this.spent.rockets++;
        return true;
      case 'advancedComponents':
        if (this.components <= 0) return false;
        this.components--;
        this.spent.components++;
        return true;
      default:
        return true; // primitive weapons are free
    }
  }

  private fireWeapon(
    def: WeaponDef,
    damage: number,
    x: number,
    y: number,
    dir: number,
    friendly: boolean,
  ): void {
    if (!this.paySupply(def)) return;
    spawnMuzzleFlash(this.particles, this.rng, x, y, dir);
    const dmgType: DamageType = weaponDamageType(def);

    if (def.behavior === 'beam') {
      // flamethrower: instantaneous cone, applies burning
      this.applyBeam(def, damage, x, y, dir, dmgType);
      return;
    }

    const pellets = def.behavior === 'cone' ? 6 : 1;
    for (let i = 0; i < pellets; i++) {
      const spread = def.spread ?? 0;
      const a = dir + (pellets > 1 ? this.rng.range(-spread, spread) : this.rng.range(-spread, spread) * 0.3);
      const p = this.projectiles.spawn();
      p.behavior = def.behavior;
      p.x = x;
      p.y = y;
      p.px = x;
      p.py = y;
      const speed = def.projectileSpeed || 900;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.damage = damage;
      p.range = def.range;
      p.traveled = 0;
      p.dmgType = dmgType;
      p.pierce = def.behavior === 'piercing' ? def.pierceCount ?? 1 : def.behavior === 'chain' ? def.chainCount ?? 4 : 0;
      p.effectRadius = def.effectRadius ?? 0;
      p.friendly = friendly;
      p.weapon = def.id;
    }
  }

  private applyBeam(
    def: WeaponDef,
    damage: number,
    x: number,
    y: number,
    dir: number,
    dmgType: DamageType,
  ): void {
    const half = def.spread ?? 0.3;
    const range = def.range;
    this.hash.queryRadius(x, y, range, (e) => {
      if (!e.active) return;
      const a = angleBetween(x, y, e.x, e.y);
      let d = a - dir;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) > half) return;
      const dealt = applyDamage(e, damage * (1 / 8), dmgType); // per-shot tick
      this.hitCb.onDamage(e, dealt, e.x, e.y, dmgType);
      addStatus(e, 'burning', 3, 12);
      if (e.hp <= 0 && e.active) {
        e.active = false;
        this.onEnemyKilled(e);
      }
    });
  }

  private updateProjectiles(dt: number): void {
    this.projectiles.forEachActive((p) => {
      p.px = p.x;
      p.py = p.y;
      const stepX = p.vx * dt;
      const stepY = p.vy * dt;
      p.x += stepX;
      p.y += stepY;
      p.traveled += Math.hypot(stepX, stepY);
      if (p.traveled > p.range) {
        if (p.behavior === 'explosive') this.hitCb.onExplosion?.(p.x, p.y, p.effectRadius);
        p.active = false;
        return;
      }
      // collision with nearest enemy along the step
      let consumed = false;
      this.hash.queryRadius(p.x, p.y, 18, (e) => {
        if (consumed || !e.active) return;
        if (dist2(p.x, p.y, e.x, e.y) <= 20 * 20) {
          consumed = resolveProjectileHit(p, e, this.hash, this.hitCb);
        }
      });
      if (consumed) p.active = false;
    });
  }

  // ---- lighting & shake ----------------------------------------------------

  private placeTorchLights(): void {
    // torches at base corners + shelter glow
    const s = this.shelter();
    if (s) {
      const sx = (s.origin.col + 1) * GRID.tileSize;
      const sy = (s.origin.row + 1) * GRID.tileSize;
      const l = this.lights.spawn();
      l.x = sx;
      l.y = sy;
      l.radius = 220;
      l.color = THEME.colors.accent;
      l.intensity = 0.9;
      l.ttl = -1;
      l.maxTtl = -1;
    }
  }

  private addShake(amount: number): void {
    if (this.reducedMotion) amount *= 0.3;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + amount);
  }

  // ---- outcome -------------------------------------------------------------

  private checkOutcome(): void {
    const shelter = this.shelter();
    if (!shelter || (this.buildingHp.get(shelter.id) ?? 0) <= 0) {
      this.outcome = 'lost';
      return;
    }
    if (this.player.hp <= 0) {
      this.outcome = 'lost'; // M1: death = loss; revive handled in M2
      return;
    }
    // In continuous world mode there is no per-night "won": the cycle keeps
    // turning until the shelter falls or the player dies without a revive.
    if (this.worldMode) return;
    const allWavesDone =
      this.waveIndex >= this.nightDef.waves.length - 1 &&
      this.waveTasks.every((t) => t.remaining <= 0) &&
      this.enemies.activeCount === 0 &&
      (!this.nightDef.boss || this.bossSpawned);
    if (allWavesDone) this.outcome = 'won';
  }

  /** Mirror live building HP back into a plain map for the store at dawn. */
  snapshotBuildingHp(): Record<string, number> {
    const out: Record<string, number> = {};
    this.buildingHp.forEach((hp, id) => (out[id] = Math.max(0, hp)));
    return out;
  }

  get reloadProgress(): number {
    const stats = weaponStatsAtLevel(this.weaponDef(), this.player.weaponLevel);
    return this.reloadTimer > 0 ? 1 - this.reloadTimer / stats.reloadTime : 1;
  }

  get magazine(): { current: number; size: number } {
    return { current: Math.max(0, this.mag), size: weaponStatsAtLevel(this.weaponDef(), this.player.weaponLevel).magazine };
  }

  /** Seconds of weapon-ability boost still active (0 = inactive). */
  get abilityActiveLeft(): number {
    return Math.max(0, this.abilityActive);
  }

  /** True when the equipped firearm/heavy is out of its required supply. */
  get outOfSupply(): boolean {
    const c = this.weaponDef().consumes;
    if (c === 'ammo') return this.ammo <= 0;
    if (c === 'rockets') return this.rockets <= 0;
    if (c === 'advancedComponents') return this.components <= 0;
    return false;
  }

  /** Number of living defenders, for the HUD. */
  get soldierCount(): number {
    return this.soldiers.activeCount;
  }
}

// ---------------------------------------------------------------------------
// factories & helpers
// ---------------------------------------------------------------------------

function makeEnemy(): EnemyEntity {
  return {
    id: 0,
    active: false,
    type: 'walker',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    hp: 1,
    maxHp: 1,
    facing: 0,
    targetId: 0,
    attackCd: 0,
    statuses: [],
    summonCd: 0,
    px: 0,
    py: 0,
  };
}

function initEnemy(e: EnemyEntity, type: EnemyEntity['type']): void {
  e.id = nextEntityId++;
  e.type = type;
  e.boss = undefined;
  e.vx = 0;
  e.vy = 0;
  e.facing = 0;
  e.targetId = 0;
  e.attackCd = 0;
  e.statuses.length = 0;
  e.summonCd = ENEMIES[type].summon?.intervalSec ?? 0;
}

function makeSoldier(): SoldierEntity {
  return {
    id: 0,
    active: false,
    x: 0,
    y: 0,
    hp: 1,
    maxHp: 1,
    facing: 0,
    fireCd: 0,
    homeX: 0,
    homeY: 0,
    damage: 0,
    px: 0,
    py: 0,
  };
}

function makeProjectile(): ProjectileEntity {
  return {
    id: 0,
    active: false,
    behavior: 'single',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    damage: 0,
    range: 0,
    traveled: 0,
    dmgType: 'bullet',
    pierce: 0,
    effectRadius: 0,
    friendly: true,
    weapon: 'ak',
    px: 0,
    py: 0,
  };
}

function makeParticle(): ParticleEntity {
  return {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    size: 1,
    color: THEME.colors.white,
    gravity: 0,
    drag: 0,
    kind: 'spark',
  };
}

function makeDamageNumber(): DamageNumber {
  return { active: false, x: 0, y: 0, value: 0, life: 0, crit: false };
}

function makeDecal(): Decal {
  return { active: false, x: 0, y: 0, radius: 0, life: -1, kind: 'blood' };
}

function makePickup(): Pickup {
  return { active: false, x: 0, y: 0, resource: 'scrap', amount: 0 };
}

function makeLight(): LightSource & { active: boolean } {
  return { active: false, x: 0, y: 0, radius: 0, color: THEME.colors.white, intensity: 1, ttl: -1, maxTtl: -1 };
}

function scaledHp(type: EnemyEntity['type'], night: number): number {
  return Math.round(ENEMIES[type].hp * Math.pow(DIFFICULTY.hpGrowth, night - 1));
}

function clampWorld(v: number, max: number): number {
  return v < 0 ? 0 : v > max ? max : v;
}

function resolveNightDef(night: number): NightDef {
  return nightDef(night);
}
