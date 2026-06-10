/**
 * Ashen Dominion — core type system.
 *
 * Every gameplay subsystem (data constants, stores, combat, UI) draws its
 * shapes from this file. Keep it free of runtime values — pure types only,
 * with the small exception of a few `as const` tuples used for iteration.
 */

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** A point in continuous world space (pixels). */
export interface Vec2 {
  x: number;
  y: number;
}

/** A position on the discrete base grid (column/row, 0-indexed). */
export interface GridCoord {
  col: number;
  row: number;
}

/** Footprint of a building, measured in grid tiles. */
export interface GridSize {
  w: number;
  h: number;
}

export type TileType = 'grass' | 'dirt_path' | 'forest_floor' | 'stump';

// ---------------------------------------------------------------------------
// Resources & production chains (HoI4 DNA)
// ---------------------------------------------------------------------------

/** The five base resources produced directly by buildings. */
export type ResourceType = 'wood' | 'stone' | 'scrap' | 'fuel' | 'food' | 'energy';

export const RESOURCE_TYPES = ['wood', 'stone', 'scrap', 'fuel', 'food', 'energy'] as const;

/** A bag of base resources. */
export type ResourceBag = Record<ResourceType, number>;

/** Intermediate goods crafted from base resources via production chains. */
export type IntermediateType =
  | 'ammo'
  | 'advancedComponents'
  | 'rations'
  | 'explosives'
  | 'rockets';

export const INTERMEDIATE_TYPES = [
  'ammo',
  'advancedComponents',
  'rations',
  'explosives',
  'rockets',
] as const;

export type IntermediateBag = Record<IntermediateType, number>;

/** A single production-chain recipe: inputs (per-tick) → one output unit. */
export interface ProductionRecipe {
  id: string;
  output: IntermediateType;
  /** Base resources consumed to produce one output unit. */
  inputs: Partial<ResourceBag>;
  /** Intermediates consumed to produce one output unit (e.g. rockets). */
  intermediateInputs?: Partial<IntermediateBag>;
  /** Seconds of in-game day-time to produce one output unit. */
  secondsPerUnit: number;
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

export type BuildingType =
  | 'shelter'
  | 'tower'
  | 'wall'
  | 'gate'
  | 'workshop'
  | 'trainingGround'
  | 'storage'
  | 'fuelDepot'
  | 'garden'
  | 'barracks'
  | 'researchCenter'
  | 'generator'
  | 'medbay'
  | 'sniperNest'
  | 'mortar'
  | 'electricFence';

/** Broad behavioural category, used by combat & production systems. */
export type BuildingCategory =
  | 'core' // shelter — losing it ends the run
  | 'defense' // towers / sniper / mortar / fence
  | 'barrier' // walls / gates
  | 'production' // workshop / fuel depot / garden / generator
  | 'support'; // barracks / research / medbay

/** Per-level scaling applied on top of a building's base stats. */
export interface BuildingLevelScaling {
  /** Multiplier on max HP per level above 1 (e.g. 0.25 = +25%/level). */
  hpPerLevel: number;
  /** Multiplier on the primary output (damage or production) per level. */
  outputPerLevel: number;
  /** Resource cost to upgrade from level L to L+1, scaled by `costGrowth^L`. */
  upgradeBaseCost: Partial<ResourceBag>;
  costGrowth: number;
}

/** Static definition of a building type (lives in constants/buildings.ts). */
export interface BuildingDef {
  type: BuildingType;
  name: string;
  category: BuildingCategory;
  size: GridSize;
  maxLevel: number;
  baseHp: number;
  /** Cost to first place the building. */
  buildCost: Partial<ResourceBag>;
  /** Combat: base damage per shot (defense buildings only). */
  baseDamage?: number;
  /** Combat: shots per second (defense buildings only). */
  fireRate?: number;
  /** Combat: range in pixels (defense buildings only). */
  range?: number;
  /** Combat: area-of-effect radius in pixels (mortar / fence). */
  aoeRadius?: number;
  /** Production: which resource/intermediate it yields per second at L1. */
  produces?: ResourceType;
  /** Production: base units per second at level 1. */
  productionRate?: number;
  scaling: BuildingLevelScaling;
  /** Short flavour line shown in the upgrade panel. */
  description: string;
}

/** A building instance placed on the base grid. */
export interface PlacedBuilding {
  id: string;
  type: BuildingType;
  origin: GridCoord; // top-left tile of its footprint
  level: number;
  hp: number;
  /** For gates: whether it is currently open (passable). */
  open?: boolean;
  /** For barracks: trained defenders assigned to this building. */
  garrison?: number;
  /** For barracks: wall-clock ms when the current trainee finishes. */
  trainingUntil?: number | null;
  /**
   * Clash-of-Clans-style construction: while `buildUntil` is in the future the
   * building is scaffolding — it doesn't shoot/produce and renders a progress
   * bar. Also reused for upgrade timers.
   */
  buildUntil?: number | null;
}

export interface Tree {
  id: string;
  tileX: number;
  tileY: number;
  hp: number;
  maxHp: number;
  state: 'alive' | 'falling' | 'stump';
  fallAngle: number;
  fallStartedAt: number | null;
  woodDropped: boolean;
  /** When the tree became a stump (ms epoch); used for regrowth. */
  stumpAt?: number | null;
}

/** A mineable world node: stone boulder or scrap-metal pile. */
export interface Rock {
  id: string;
  tileX: number;
  tileY: number;
  kind: 'boulder' | 'scrapPile';
  hp: number;
  maxHp: number;
  state: 'alive' | 'depleted';
  /** When depleted (ms epoch); respawns after a delay. */
  depletedAt?: number | null;
}

// ---------------------------------------------------------------------------
// Weapons (shared by player & towers)
// ---------------------------------------------------------------------------

export type WeaponBranch = 'primitive' | 'firearm' | 'heavy';

export type WeaponId =
  // primitive — melee/bow
  | 'sharpenedStick'
  | 'spear'
  | 'compositeSpear'
  | 'makeshiftBow'
  | 'reinforcedBow'
  | 'crossbow'
  | 'compositeCrossbow'
  // firearm
  | 'makeshiftPistol'
  | 'pistol9mm'
  | 'dualPistols'
  | 'smg'
  | 'sawnoff'
  | 'pumpShotgun'
  | 'autoShotgun'
  | 'tacticalShotgun'
  | 'ak'
  | 'm4'
  | 'battleRifle'
  | 'makeshiftSniper'
  | 'sniperRifle'
  | 'fiftyCal'
  // heavy
  | 'rpg7'
  | 'antiTankLauncher'
  | 'minigun'
  | 'aircraftMinigun'
  | 'flamethrower'
  | 'thermobaricFlamethrower'
  | 'electricCannon'
  | 'plasmaCannon';

/** How a weapon's projectiles behave on impact. */
export type ProjectileBehavior =
  | 'single' // hits one target
  | 'piercing' // passes through N targets
  | 'cone' // shotgun spread
  | 'explosive' // AoE on impact
  | 'chain' // arcs between nearby targets
  | 'beam'; // continuous (flamethrower)

/** An activatable ability tied to a weapon (e.g. AK suppressing fire). */
export interface WeaponAbility {
  id: string;
  name: string;
  description: string;
  /** Cooldown in seconds. */
  cooldown: number;
  /** Active duration in seconds (0 = instantaneous). */
  duration: number;
}

/** Static definition of a weapon (lives in constants/weapons.ts). */
export interface WeaponDef {
  id: WeaponId;
  name: string;
  branch: WeaponBranch;
  /** Weapons that must be owned before this one can be purchased. */
  prerequisites: WeaponId[];
  behavior: ProjectileBehavior;
  /** Base combat stats at weapon level 1. */
  damage: number;
  fireRate: number; // shots per second
  range: number; // pixels
  projectileSpeed: number; // pixels per second (0 = hitscan/beam)
  magazine: number;
  reloadTime: number; // seconds
  /** For piercing: how many enemies a shot passes through. */
  pierceCount?: number;
  /** For cone: half-angle of spread in radians. */
  spread?: number;
  /** For explosive/chain: effect radius or chain count. */
  effectRadius?: number;
  chainCount?: number;
  /** Resource cost to first purchase. */
  purchaseCost: Partial<ResourceBag>;
  /** Per-level (1→5) upgrade cost base, scaled by costGrowth^level. */
  upgradeBaseCost: Partial<ResourceBag>;
  costGrowth: number;
  maxLevel: number;
  ability: WeaponAbility;
  /** Intermediate consumed per shot, if any (ammo / rockets / etc). */
  consumes?: IntermediateType;
}

/** Player-owned weapon progress. */
export interface OwnedWeapon {
  id: WeaponId;
  level: number; // 1..maxLevel
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

export type EnemyType =
  | 'walker'
  | 'runner'
  | 'brute'
  | 'suicide'
  | 'toxic'
  | 'armored'
  | 'screamer'
  | 'tank';

export type BossType = 'patientZero' | 'swarm' | 'ironGuardian' | 'hiveMother';

/** Damage-type resistances/weaknesses, as multipliers (1 = neutral). */
export interface DamageResist {
  bullet: number;
  explosive: number;
  electric: number;
  fire: number;
}

export type EnemyBehaviorTag =
  | 'directToShelter'
  | 'seeksGaps'
  | 'breaksWalls'
  | 'explodesOnContact'
  | 'leavesAcid'
  | 'summons'
  | 'miniBoss';

/** Static definition of an enemy type (lives in constants/enemies.ts). */
export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number; // pixels per second
  damage: number;
  /** Damage dealt to barriers per hit (often differs from `damage`). */
  structureDamage: number;
  threat: 1 | 2 | 3 | 4 | 5;
  resist: DamageResist;
  behaviors: EnemyBehaviorTag[];
  /** Reward granted to the player when killed. */
  bounty: Partial<ResourceBag>;
  /** For summoners: type & count spawned per interval. */
  summon?: { type: EnemyType; count: number; intervalSec: number };
  /** Codex lore flavour, shown once the enemy has been encountered. */
  lore?: string;
}

export type BossPhaseTrigger = { hpPercent: number };

export interface BossPhase {
  trigger: BossPhaseTrigger;
  /** Free-form tag for the combat system to branch on. */
  pattern: string;
  description: string;
}

/** Static definition of a boss (lives in constants/enemies.ts). */
export interface BossDef {
  type: BossType;
  name: string;
  appearsOnNight: number;
  hp: number;
  speed: number;
  damage: number;
  resist: DamageResist;
  phases: BossPhase[];
  /** Codex lore entry unlocked on death. */
  lore: string;
}

/** A live enemy instance during a night battle. */
export interface ActiveEnemy {
  id: string;
  type: EnemyType;
  pos: Vec2;
  hp: number;
  /** Current path of grid coords toward a target, if computed. */
  path?: GridCoord[];
  targetId?: string; // building/player currently attacked
  statuses: EnemyStatus[];
}

export interface EnemyStatus {
  kind: 'burning' | 'slowed' | 'shocked' | 'poisoned';
  /** Remaining seconds. */
  ttl: number;
  /** Magnitude (e.g. dps for burning, slow factor for slowed). */
  magnitude: number;
}

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------

/** One spawn group inside a wave. */
export interface SpawnGroup {
  type: EnemyType;
  count: number;
  /** Seconds after wave start before this group begins spawning. */
  delaySec: number;
  /** Seconds between individual spawns within the group. */
  intervalSec: number;
  /** Which edges of the map they enter from. */
  edges: MapEdge[];
}

export type MapEdge = 'north' | 'south' | 'east' | 'west';

export interface WaveDef {
  /** 1-indexed wave within the night. */
  index: number;
  groups: SpawnGroup[];
}

export interface NightDef {
  night: number;
  waves: WaveDef[];
  /** Boss fought this night, if any. */
  boss?: BossType;
}

// ---------------------------------------------------------------------------
// Research / tech tree (HoI4 DNA)
// ---------------------------------------------------------------------------

export type ResearchBranch = 'weapons' | 'fortification' | 'survival';

export type ResearchEffect =
  // generic stat modifiers, interpreted by the relevant system
  | { kind: 'unlockWeaponBranch'; branch: WeaponBranch }
  | { kind: 'unlockBuilding'; building: BuildingType }
  | { kind: 'modifier'; stat: string; mult: number }
  | { kind: 'doctrine'; name: string; description: string };

export interface ResearchNode {
  id: string;
  branch: ResearchBranch;
  tier: number; // 1..6, doctrine is tier 7
  name: string;
  description: string;
  prerequisites: string[]; // research node ids
  /** Resource cost to research. */
  cost: Partial<ResourceBag>;
  /** In-game days required to complete. */
  days: number;
  effects: ResearchEffect[];
  /** True for the branch-capstone doctrine. */
  isDoctrine?: boolean;
}

// ---------------------------------------------------------------------------
// Player & soldiers
// ---------------------------------------------------------------------------

export interface PlayerState {
  pos: Vec2;
  hp: number;
  maxHp: number;
  /** Currently equipped weapon. */
  equipped: WeaponId;
  /** Whether the once-per-night revive has been used. */
  revivedThisNight: boolean;
  /** Where the player died this night (loot drop), if applicable. */
  deathDrop?: { pos: Vec2; scrap: number; fuel: number };
}

export interface Soldier {
  id: string;
  pos: Vec2;
  hp: number;
  maxHp: number;
  weapon: WeaponId;
}

// ---------------------------------------------------------------------------
// Top-level game flow
// ---------------------------------------------------------------------------

export type GamePhase = 'splash' | 'menu' | 'day' | 'night' | 'dawn' | 'gameover';

export interface NightResult {
  night: number;
  survived: boolean;
  enemiesKilled: number;
  resourcesLost: Partial<ResourceBag>;
}

export interface GameStats {
  totalZombiesKilled: number;
  totalNightsSurvived: number;
  bestNight: number;
  totalDeaths: number;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** Codex entries unlocked (boss/enemy lore). */
export type CodexEntryId = BossType | EnemyType;
