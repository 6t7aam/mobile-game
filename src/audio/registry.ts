/**
 * Audio asset registry. Mirrors `src/assets/registry.ts`: every entry is `null`
 * today so the game runs silently with ZERO binary audio. Dropping a real file
 * into `assets/audio/...` and wiring its `require(...)` here makes that sound
 * play — no call-site changes. The AudioManager treats `null` as a no-op.
 */

export type SoundSource = number | null; // number = a require()'d module id

export type SfxId =
  | 'shoot_pistol'
  | 'shoot_shotgun'
  | 'shoot_ak'
  | 'shoot_sniper'
  | 'shoot_rpg'
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
  | 'night_start'
  | 'night_end'
  | 'boss_warning';

export type MusicId = 'menu' | 'day' | 'battle_low' | 'battle_high' | 'boss';

// Original synthesized WAVs live in assets/audio/sfx (see scripts/gensfx.js).
// Entries left null have no file yet and stay silent no-ops.
export const SFX: Record<SfxId, SoundSource> = {
  shoot_pistol: require('../../assets/audio/sfx/shoot_ak.wav'),
  shoot_shotgun: require('../../assets/audio/sfx/shoot_ak.wav'),
  shoot_ak: require('../../assets/audio/sfx/shoot_ak.wav'),
  shoot_sniper: require('../../assets/audio/sfx/shoot_ak.wav'),
  shoot_rpg: require('../../assets/audio/sfx/shoot_ak.wav'),
  reload: require('../../assets/audio/sfx/ui_click.wav'),
  empty: require('../../assets/audio/sfx/ui_error.wav'),
  zombie_grunt: null,
  zombie_death: require('../../assets/audio/sfx/player_hurt.wav'),
  brute_step: null,
  screamer: null,
  explosion_small: require('../../assets/audio/sfx/building_hit.wav'),
  explosion_large: require('../../assets/audio/sfx/building_hit.wav'),
  building_hit: require('../../assets/audio/sfx/building_hit.wav'),
  building_destroy: require('../../assets/audio/sfx/building_hit.wav'),
  building_upgrade: require('../../assets/audio/sfx/building_upgrade.wav'),
  player_hurt: require('../../assets/audio/sfx/player_hurt.wav'),
  player_death: require('../../assets/audio/sfx/player_hurt.wav'),
  ui_click: require('../../assets/audio/sfx/ui_click.wav'),
  ui_upgrade: require('../../assets/audio/sfx/building_upgrade.wav'),
  ui_error: require('../../assets/audio/sfx/ui_error.wav'),
  night_start: require('../../assets/audio/sfx/building_hit.wav'),
  night_end: require('../../assets/audio/sfx/building_upgrade.wav'),
  boss_warning: require('../../assets/audio/sfx/ui_error.wav'),
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
