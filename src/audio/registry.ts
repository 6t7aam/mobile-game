/**
 * Audio asset registry. Every WAV is an original synthesized sound — see
 * `scripts/gensfx.js` (run `node scripts/gensfx.js` to rebuild). Each weapon
 * CLASS has its own voice; `sfxForWeapon` maps a weapon id to its shot sound.
 */

import type { WeaponDef } from '@/types';

export type SoundSource = number | null; // number = a require()'d module id

export type SfxId =
  | 'shoot_pistol'
  | 'shoot_smg'
  | 'shoot_ak'
  | 'shoot_shotgun'
  | 'shoot_sniper'
  | 'shoot_minigun'
  | 'shoot_rpg'
  | 'shoot_flame'
  | 'shoot_bow'
  | 'shoot_melee'
  | 'shoot_plasma'
  | 'shoot_electric'
  | 'reload'
  | 'empty'
  | 'zombie_grunt'
  | 'zombie_death'
  | 'brute_step'
  | 'screamer'
  | 'explosion_small'
  | 'explosion_large'
  | 'building_hit'
  | 'building_destroy'
  | 'building_upgrade'
  | 'player_hurt'
  | 'player_death'
  | 'ui_click'
  | 'ui_upgrade'
  | 'ui_error'
  | 'ui_buy'
  | 'crystal'
  | 'night_start'
  | 'night_end'
  | 'boss_warning';

export type MusicId = 'menu' | 'day' | 'battle_low' | 'battle_high' | 'boss';

export const SFX: Record<SfxId, SoundSource> = {
  shoot_pistol: require('../../assets/audio/sfx/shoot_pistol.wav'),
  shoot_smg: require('../../assets/audio/sfx/shoot_smg.wav'),
  shoot_ak: require('../../assets/audio/sfx/shoot_ak.wav'),
  shoot_shotgun: require('../../assets/audio/sfx/shoot_shotgun.wav'),
  shoot_sniper: require('../../assets/audio/sfx/shoot_sniper.wav'),
  shoot_minigun: require('../../assets/audio/sfx/shoot_minigun.wav'),
  shoot_rpg: require('../../assets/audio/sfx/shoot_rpg.wav'),
  shoot_flame: require('../../assets/audio/sfx/shoot_flame.wav'),
  shoot_bow: require('../../assets/audio/sfx/shoot_bow.wav'),
  shoot_melee: require('../../assets/audio/sfx/shoot_melee.wav'),
  shoot_plasma: require('../../assets/audio/sfx/shoot_plasma.wav'),
  shoot_electric: require('../../assets/audio/sfx/shoot_electric.wav'),
  reload: require('../../assets/audio/sfx/ui_click.wav'),
  empty: require('../../assets/audio/sfx/ui_error.wav'),
  zombie_grunt: require('../../assets/audio/sfx/zombie_grunt.wav'),
  zombie_death: require('../../assets/audio/sfx/zombie_death.wav'),
  brute_step: null,
  screamer: null,
  explosion_small: require('../../assets/audio/sfx/explosion_small.wav'),
  explosion_large: require('../../assets/audio/sfx/explosion_large.wav'),
  building_hit: require('../../assets/audio/sfx/building_hit.wav'),
  building_destroy: require('../../assets/audio/sfx/explosion_small.wav'),
  building_upgrade: require('../../assets/audio/sfx/building_upgrade.wav'),
  player_hurt: require('../../assets/audio/sfx/player_hurt.wav'),
  player_death: require('../../assets/audio/sfx/player_death.wav'),
  ui_click: require('../../assets/audio/sfx/ui_click.wav'),
  ui_upgrade: require('../../assets/audio/sfx/building_upgrade.wav'),
  ui_error: require('../../assets/audio/sfx/ui_error.wav'),
  ui_buy: require('../../assets/audio/sfx/ui_buy.wav'),
  crystal: require('../../assets/audio/sfx/crystal.wav'),
  night_start: require('../../assets/audio/sfx/night_start.wav'),
  night_end: require('../../assets/audio/sfx/night_end.wav'),
  boss_warning: require('../../assets/audio/sfx/boss_warning.wav'),
};

export const MUSIC: Record<MusicId, SoundSource> = {
  menu: null,
  day: null,
  battle_low: null,
  battle_high: null,
  boss: null,
};

export function hasSound(src: SoundSource): src is number {
  return typeof src === 'number';
}

/** Which shot sound a weapon makes — resolved by id/branch/behavior. */
export function sfxForWeapon(def: WeaponDef): SfxId {
  const id = def.id as string;
  if (id.includes('inigun')) return 'shoot_minigun';
  if (id.includes('lamethrower')) return 'shoot_flame';
  if (id.includes('lasma')) return 'shoot_plasma';
  if (id.includes('lectric')) return 'shoot_electric';
  if (id.includes('rpg') || id.includes('Launcher')) return 'shoot_rpg';
  if (id.includes('niper') || id === 'fiftyCal' || id === 'battleRifle') return 'shoot_sniper';
  if (id.includes('hotgun') || id === 'sawnoff') return 'shoot_shotgun';
  if (id === 'smg') return 'shoot_smg';
  if (id === 'ak' || id === 'm4') return 'shoot_ak';
  if (id.includes('istol')) return 'shoot_pistol';
  if (id.includes('ow') && def.branch === 'primitive') return 'shoot_bow';
  if (def.branch === 'primitive' && def.projectileSpeed === 0) return 'shoot_melee';
  if (def.branch === 'primitive') return 'shoot_bow';
  return 'shoot_ak';
}
