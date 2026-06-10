/**
 * Enemy and boss definitions. Stats mirror the design-spec horde table.
 * Per-night scaling (HP/count) is applied at spawn time by the balancer.
 */

import type { BossDef, BossType, EnemyDef, EnemyType, DamageResist } from '@/types';

const NEUTRAL: DamageResist = { bullet: 1, explosive: 1, electric: 1, fire: 1 };

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  walker: {
    type: 'walker',
    name: 'Бродяга',
    hp: 80,
    speed: 28,
    damage: 8,
    structureDamage: 6,
    threat: 1,
    resist: { ...NEUTRAL },
    behaviors: ['directToShelter'],
    bounty: { scrap: 3 },
    lore: 'Был человеком. Идёт на свет убежища, не помня, зачем. Их всегда больше, чем кажется.',
  },

  runner: {
    type: 'runner',
    name: 'Бегун',
    hp: 50,
    speed: 70,
    damage: 5,
    structureDamage: 4,
    threat: 2,
    resist: { ...NEUTRAL },
    behaviors: ['seeksGaps'],
    bounty: { scrap: 2 },
    lore: 'Голод сделал их быстрыми. Они чуют щель в стене раньше, чем ты её заметишь.',
  },

  brute: {
    type: 'brute',
    name: 'Громила',
    hp: 500,
    speed: 22,
    damage: 40,
    structureDamage: 60, // breaks walls ~3x faster
    threat: 3,
    resist: { ...NEUTRAL, fire: 1.1 },
    behaviors: ['directToShelter', 'breaksWalls'],
    bounty: { scrap: 12, fuel: 2 },
    lore: 'Гора гниющих мышц. Стены для него — бумага. Молись, чтобы их было немного.',
  },

  suicide: {
    type: 'suicide',
    name: 'Самоубийца',
    hp: 100,
    speed: 75,
    damage: 120,
    structureDamage: 120,
    threat: 3,
    resist: { ...NEUTRAL },
    behaviors: ['explodesOnContact', 'seeksGaps'],
    bounty: { scrap: 5, fuel: 3 },
    lore: 'Раздут газами разложения. Бежит к стене, чтобы забрать её с собой. Стреляй издалека.',
  },

  toxic: {
    type: 'toxic',
    name: 'Ядовитый',
    hp: 120,
    speed: 45,
    damage: 12,
    structureDamage: 8,
    threat: 2,
    resist: { ...NEUTRAL, fire: 1.2 },
    behaviors: ['directToShelter', 'leavesAcid'],
    bounty: { scrap: 4 },
    lore: 'Кровь его — кислота. Даже мёртвый он отравляет землю, по которой ты ходишь.',
  },

  armored: {
    type: 'armored',
    name: 'Бронированный',
    hp: 300,
    speed: 24,
    damage: 20,
    structureDamage: 18,
    threat: 3,
    resist: { bullet: 0.3, explosive: 1.5, electric: 1, fire: 0.9 },
    behaviors: ['directToShelter'],
    bounty: { scrap: 10, fuel: 2 },
    lore: 'Обломки брони вросли в плоть. Пули вязнут — но взрыв находит щель в любой стали.',
  },

  screamer: {
    type: 'screamer',
    name: 'Визжащий',
    hp: 60,
    speed: 45,
    damage: 5,
    structureDamage: 3,
    threat: 4,
    resist: { ...NEUTRAL },
    behaviors: ['summons', 'seeksGaps'],
    bounty: { scrap: 8 },
    summon: { type: 'runner', count: 4, intervalSec: 6 },
    lore: 'Его визг — призыв. Каждая секунда его жизни стоит тебе четырёх новых врагов. Убей первым.',
  },

  tank: {
    type: 'tank',
    name: 'Танк',
    hp: 2000,
    speed: 14,
    damage: 80,
    structureDamage: 100,
    threat: 5,
    resist: { bullet: 0.6, explosive: 1.3, electric: 1.1, fire: 1 },
    behaviors: ['directToShelter', 'breaksWalls', 'miniBoss'],
    bounty: { scrap: 40, fuel: 10, energy: 5 },
    lore: 'Слились десятки тел в одну тушу. Медлителен, но неостановим. С ночи десятой — твой кошмар.',
  },
};

export const ENEMY_LIST: EnemyDef[] = Object.values(ENEMIES);

// ---------------------------------------------------------------------------
// Bosses (every 5th night)
// ---------------------------------------------------------------------------

export const BOSSES: Record<BossType, BossDef> = {
  patientZero: {
    type: 'patientZero',
    name: 'Нулевой Пациент',
    appearsOnNight: 5,
    hp: 6000,
    speed: 18,
    damage: 60,
    resist: { bullet: 0.8, explosive: 1.2, electric: 1, fire: 1 },
    phases: [
      { trigger: { hpPercent: 100 }, pattern: 'lumber', description: 'Медленно наступает, давит зданиями.' },
      { trigger: { hpPercent: 66 }, pattern: 'charge', description: 'Рывки к ближайшей стене.' },
      { trigger: { hpPercent: 33 }, pattern: 'spawnRunners', description: 'Непрерывно призывает Бегунов.' },
    ],
    lore: 'Первый, кто пал. Его кровь стала семенем тьмы. Имени уже никто не помнит.',
  },

  swarm: {
    type: 'swarm',
    name: 'Рой',
    appearsOnNight: 10,
    hp: 1, // the "boss" is the synchronized horde itself
    speed: 70,
    damage: 5,
    resist: { ...NEUTRAL },
    phases: [
      { trigger: { hpPercent: 100 }, pattern: 'allEdges', description: '200 Бегунов одновременно со всех сторон.' },
    ],
    lore: 'Не существо — воля. Двести тел движутся как одно. Стены решают всё.',
  },

  ironGuardian: {
    type: 'ironGuardian',
    name: 'Железный Страж',
    appearsOnNight: 15,
    hp: 9000,
    speed: 20,
    damage: 70,
    resist: { bullet: 0.1, explosive: 1.6, electric: 1.8, fire: 0.8 },
    phases: [
      { trigger: { hpPercent: 100 }, pattern: 'rocketSalvo', description: 'Ракеты по случайным зданиям.' },
      { trigger: { hpPercent: 50 }, pattern: 'overcharge', description: 'Экзоскелет перегружен — быстрее, но уязвим к электричеству.' },
    ],
    lore: 'Военный, что не сдался даже мёртвым. Сталь срослась с гнилой плотью.',
  },

  hiveMother: {
    type: 'hiveMother',
    name: 'Мать Улья',
    appearsOnNight: 20,
    hp: 15000,
    speed: 0, // stationary, far off the map
    damage: 0,
    resist: { bullet: 0.7, explosive: 1.1, electric: 1, fire: 1.2 },
    phases: [
      { trigger: { hpPercent: 100 }, pattern: 'endlessSpawn', description: 'Бесконечно плодит зомби, пока жива. Нужно дойти до неё.' },
      { trigger: { hpPercent: 40 }, pattern: 'enrage', description: 'Ускоряет спавн вдвое, выбрасывает Громил.' },
    ],
    lore: 'Где-то за мёртвым лесом бьётся огромное сердце. Всё это исходит из неё.',
  },
};

export const BOSS_LIST: BossDef[] = Object.values(BOSSES);

/** Returns the boss for a given night, if one is scheduled. */
export function bossForNight(night: number): BossDef | undefined {
  return BOSS_LIST.find((b) => b.appearsOnNight === night);
}
