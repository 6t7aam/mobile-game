/**
 * Procedural SFX generator — every sound in the game is synthesized here
 * (zero licensed binaries). Run `node scripts/gensfx.js` to (re)build
 * assets/audio/sfx/*.wav, then wire new ids in src/audio/registry.ts.
 */
const fs = require('fs');
const SR = 22050;

function wav(samples) {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { let s = Math.max(-1, Math.min(1, samples[i])); buf.writeInt16LE(s * 32767 | 0, 44 + i * 2); }
  return buf;
}

// ---- building blocks -------------------------------------------------------
function tone(dur, f, type = 'sine', decay = 1) {
  const n = dur * SR | 0, o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR; const ph = 2 * Math.PI * f * t;
    const v = type === 'sine' ? Math.sin(ph) : type === 'square' ? Math.sign(Math.sin(ph)) : type === 'saw' ? 2 * ((f * t) % 1) - 1 : (Math.random() * 2 - 1);
    o[i] = v * Math.pow(1 - i / n, decay) * 0.5;
  }
  return o;
}
/** Frequency sweep f0→f1. */
function sweep(dur, f0, f1, type = 'sine', decay = 1) {
  const n = dur * SR | 0, o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n; const f = f0 + (f1 - f0) * k; ph += 2 * Math.PI * f / SR;
    const v = type === 'sine' ? Math.sin(ph) : type === 'square' ? Math.sign(Math.sin(ph)) : 2 * ((ph / (2 * Math.PI)) % 1) - 1;
    o[i] = v * Math.pow(1 - k, decay) * 0.5;
  }
  return o;
}
function noise(dur, decay = 3) {
  const n = dur * SR | 0, o = new Float32Array(n);
  for (let i = 0; i < n; i++) o[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * 0.5;
  return o;
}
/** Cheap one-pole lowpass — softens noise into a whoosh. */
function lowpass(arr, k = 0.15) {
  const o = new Float32Array(arr.length); let y = 0;
  for (let i = 0; i < arr.length; i++) { y += k * (arr[i] - y); o[i] = y * 2.2; }
  return o;
}
function gain(arr, g) { return arr.map((v) => v * g); }
function mix(...arrs) {
  const n = Math.max(...arrs.map((a) => a.length)); const o = new Float32Array(n);
  for (const a of arrs) for (let i = 0; i < a.length; i++) o[i] += a[i];
  return o;
}
function seq(...arrs) {
  const n = arrs.reduce((s, a) => s + a.length, 0); const o = new Float32Array(n); let at = 0;
  for (const a of arrs) { o.set(a, at); at += a.length; }
  return o;
}
/** Amplitude vibrato — gives organic growls. */
function wobble(arr, hz, depth = 0.5) {
  return arr.map((v, i) => v * (1 - depth + depth * Math.sin(2 * Math.PI * hz * i / SR)));
}

// ---- world / ui ------------------------------------------------------------
const chop = () => mix(tone(0.12, 120, 'sine', 2), gain(noise(0.08, 5), 0.4));
const click = () => tone(0.05, 880, 'square', 3);
const build = () => seq(tone(0.1, 440, 'sine', 1), tone(0.12, 660, 'sine', 1));
const err = () => tone(0.18, 140, 'square', 1);
const hurt = () => tone(0.15, 200, 'saw', 2);
const buy = () => seq(tone(0.04, 700, 'square', 4), tone(0.04, 900, 'square', 4), tone(0.14, 1320, 'sine', 2));
const crystal = () => seq(tone(0.07, 1175, 'sine', 2), tone(0.07, 1568, 'sine', 2), gain(tone(0.16, 2093, 'sine', 1.6), 0.8));

// ---- weapons (one voice per class so every gun feels different) ------------
const shootPistol = () => mix(noise(0.06, 8), tone(0.04, 500, 'square', 5));
const shootSmg = () => mix(noise(0.045, 9), tone(0.03, 430, 'square', 6));
const shootAk = () => mix(noise(0.08, 6), tone(0.05, 320, 'saw', 4));
const shootShotgun = () => mix(gain(noise(0.22, 3), 0.95), tone(0.13, 90, 'sine', 2));
const shootSniper = () => mix(gain(noise(0.3, 2.2), 0.9), tone(0.2, 70, 'sine', 1.4));
const shootMinigun = () => mix(noise(0.04, 10), tone(0.025, 360, 'square', 6));
const shootRpg = () => mix(lowpass(noise(0.4, 1.4), 0.2), sweep(0.35, 220, 70, 'saw', 1.2));
const shootFlame = () => gain(lowpass(noise(0.28, 1.1), 0.1), 0.8);
const shootBow = () => mix(tone(0.1, 230, 'saw', 3.5), gain(tone(0.2, 115, 'sine', 2), 0.6));
const shootMelee = () => gain(lowpass(noise(0.12, 2.4), 0.32), 0.7);
const shootPlasma = () => sweep(0.16, 1250, 300, 'saw', 2);
const shootElectric = () => wobble(mix(noise(0.16, 3), sweep(0.16, 900, 500, 'square', 2)), 38, 0.85);

// ---- combat feedback ------------------------------------------------------
const explosionSmall = () => mix(gain(noise(0.4, 2), 0.9), tone(0.3, 60, 'sine', 1.2));
const explosionLarge = () => mix(noise(0.8, 1.6), tone(0.6, 45, 'sine', 1));
const zombieGrunt = () => wobble(sweep(0.28, 110, 80, 'saw', 1), 9, 0.6);
const zombieDeath = () => mix(wobble(sweep(0.38, 150, 55, 'saw', 1.2), 11, 0.5), gain(noise(0.2, 3), 0.25));
const nightStart = () => gain(mix(tone(0.9, 98, 'saw', 0.9), tone(0.9, 147, 'saw', 0.9), tone(0.9, 49, 'sine', 0.8)), 0.55);
const nightEnd = () => seq(tone(0.16, 660, 'sine', 1.2), tone(0.3, 880, 'sine', 1));
const playerDeath = () => mix(sweep(0.7, 300, 70, 'saw', 1), gain(noise(0.5, 2), 0.3));
const bossWarning = () => seq(gain(tone(0.22, 73, 'saw', 0.8), 0.8), gain(tone(0.22, 73, 'saw', 0.8), 0.8), gain(tone(0.5, 62, 'saw', 0.7), 0.9));

const map = {
  chop, ui_click: click, building_upgrade: build, ui_error: err, building_hit: chop,
  player_hurt: hurt, ui_buy: buy, crystal,
  shoot_pistol: shootPistol, shoot_smg: shootSmg, shoot_ak: shootAk, shoot_shotgun: shootShotgun,
  shoot_sniper: shootSniper, shoot_minigun: shootMinigun, shoot_rpg: shootRpg, shoot_flame: shootFlame,
  shoot_bow: shootBow, shoot_melee: shootMelee, shoot_plasma: shootPlasma, shoot_electric: shootElectric,
  explosion_small: explosionSmall, explosion_large: explosionLarge,
  zombie_grunt: zombieGrunt, zombie_death: zombieDeath,
  night_start: nightStart, night_end: nightEnd, player_death: playerDeath, boss_warning: bossWarning,
};
for (const [name, fn] of Object.entries(map)) {
  fs.writeFileSync(`assets/audio/sfx/${name}.wav`, wav(fn()));
  console.log('wrote', name);
}
