/**
 * Particle, decal, damage-number and light spawners. These operate on pools
 * owned by the battle simulation so there's no per-frame allocation. Colours
 * use the game palette for a coherent ash-grim look.
 */

import type { DamageNumber, Decal, LightSource, ParticleEntity, Pool } from '@/engine/entities';
import { Rng, TAU } from '@/engine/math';
import { THEME } from '@/theme';

const C = THEME.colors;
const BLOOD = [C.bloodDark, C.blood, C.woodDark];
const EMBER = [C.accent, C.fireLight, C.resource];
const SMOKE = [C.smoke, C.panelBorder, C.panel];

export function spawnBurst(
  pool: Pool<ParticleEntity>,
  rng: Rng,
  x: number,
  y: number,
  count: number,
  kind: ParticleEntity['kind'],
): void {
  const palette = kind === 'blood' ? BLOOD : kind === 'smoke' ? SMOKE : EMBER;
  for (let i = 0; i < count; i++) {
    const p = pool.spawn();
    const a = rng.angle();
    const speed = rng.range(kind === 'smoke' ? 8 : 40, kind === 'smoke' ? 30 : 220);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.maxLife = rng.range(0.3, kind === 'smoke' ? 1.4 : 0.8);
    p.life = p.maxLife;
    p.size = rng.range(1.5, kind === 'debris' ? 5 : 3.5);
    p.color = palette[rng.int(0, palette.length - 1)]!;
    p.gravity = kind === 'smoke' ? -20 : 60;
    p.drag = kind === 'spark' ? 3 : 1.5;
    p.kind = kind;
  }
}

const EXPLOSION = [C.fire, C.fireLight, C.resource, C.smoke, C.metal];
const DUST = [C.dirtLight, C.dirt, C.dirtDark];
const ICE = [C.electric, C.ice, C.moon];
const CONFETTI = [C.danger, C.resource, C.grassLight, C.cloth, C.accent, C.fireLight];

/** Big radial blast with a one-shot expanding shockwave ring particle. */
export function spawnExplosion(
  pool: Pool<ParticleEntity>,
  rng: Rng,
  x: number,
  y: number,
  radius: number,
): void {
  const count = Math.min(40, 22 + Math.round(radius / 6));
  for (let i = 0; i < count; i++) {
    const p = pool.spawn();
    const a = rng.angle();
    const speed = rng.range(80, 320);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.maxLife = rng.range(0.4, 1.0);
    p.life = p.maxLife;
    p.size = rng.range(2.5, 7);
    p.color = EXPLOSION[rng.int(0, EXPLOSION.length - 1)]!;
    p.gravity = 30;
    p.drag = 2;
    p.kind = 'ember';
  }
  // shockwave ring: size encodes the target radius; grows over its life
  const s = pool.spawn();
  s.x = x;
  s.y = y;
  s.vx = 0;
  s.vy = 0;
  s.maxLife = 0.4;
  s.life = 0.4;
  s.size = radius;
  s.color = C.window;
  s.gravity = 0;
  s.drag = 0;
  s.kind = 'shock';
}

/** Ground dust kick (brute stomp, wall break). */
export function spawnDust(pool: Pool<ParticleEntity>, rng: Rng, x: number, y: number, count = 10): void {
  for (let i = 0; i < count; i++) {
    const p = pool.spawn();
    const a = -Math.PI / 2 + rng.range(-1, 1);
    const speed = rng.range(20, 90);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.maxLife = rng.range(0.5, 1.0);
    p.life = p.maxLife;
    p.size = rng.range(3, 6);
    p.color = DUST[rng.int(0, DUST.length - 1)]!;
    p.gravity = 40;
    p.drag = 2.5;
    p.kind = 'dust';
  }
}

/** Ice shard burst (frost weapons / towers). */
export function spawnIce(pool: Pool<ParticleEntity>, rng: Rng, x: number, y: number, count = 8): void {
  for (let i = 0; i < count; i++) {
    const p = pool.spawn();
    const a = rng.angle();
    const speed = rng.range(60, 200);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.maxLife = rng.range(0.4, 0.7);
    p.life = p.maxLife;
    p.size = rng.range(2, 4);
    p.color = ICE[rng.int(0, ICE.length - 1)]!;
    p.gravity = 20;
    p.drag = 2;
    p.kind = 'ice';
    p.rot = rng.angle();
    p.rotVel = rng.range(-8, 8);
  }
}

/** Victory confetti (boss kill). */
export function spawnConfetti(pool: Pool<ParticleEntity>, rng: Rng, x: number, y: number, count = 50): void {
  for (let i = 0; i < count; i++) {
    const p = pool.spawn();
    const a = -Math.PI / 2 + rng.range(-1, 1);
    const speed = rng.range(120, 360);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.maxLife = rng.range(1.5, 3);
    p.life = p.maxLife;
    p.size = rng.range(3, 6);
    p.color = CONFETTI[rng.int(0, CONFETTI.length - 1)]!;
    p.gravity = 90;
    p.drag = 0.8;
    p.kind = 'confetti';
    p.rot = rng.angle();
    p.rotVel = rng.range(-12, 12);
  }
}

export function spawnMuzzleFlash(
  pool: Pool<ParticleEntity>,
  rng: Rng,
  x: number,
  y: number,
  dir: number,
): void {
  for (let i = 0; i < 4; i++) {
    const p = pool.spawn();
    const a = dir + rng.range(-0.3, 0.3);
    const speed = rng.range(120, 300);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.maxLife = rng.range(0.05, 0.14);
    p.life = p.maxLife;
    p.size = rng.range(2, 4);
    p.color = C.window;
    p.gravity = 0;
    p.drag = 6;
    p.kind = 'flash';
  }
}

export function updateParticles(pool: Pool<ParticleEntity>, dt: number): void {
  pool.forEachActive((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      return;
    }
    if (p.kind === 'shock') return; // ring expands purely by life in the renderer
    p.vy += p.gravity * dt;
    const dragF = 1 - Math.min(1, p.drag * dt);
    p.vx *= dragF;
    p.vy *= dragF;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.rotVel) p.rot = (p.rot ?? 0) + p.rotVel * dt;
  });
}

export function spawnDamageNumber(
  pool: Pool<DamageNumber>,
  x: number,
  y: number,
  value: number,
  crit: boolean,
): void {
  const d = pool.spawn();
  d.x = x + (Math.random() - 0.5) * 12;
  d.y = y - 8;
  d.value = Math.round(value);
  d.life = 0.8;
  d.crit = crit;
}

export function updateDamageNumbers(pool: Pool<DamageNumber>, dt: number): void {
  pool.forEachActive((d) => {
    d.life -= dt;
    d.y -= 30 * dt;
    if (d.life <= 0) d.active = false;
  });
}

export function spawnDecal(
  pool: Pool<Decal>,
  x: number,
  y: number,
  radius: number,
  kind: Decal['kind'],
  life = -1,
): Decal {
  const d = pool.spawn();
  d.x = x;
  d.y = y;
  d.radius = radius;
  d.kind = kind;
  d.life = life;
  return d;
}

export function updateDecals(pool: Pool<Decal>, dt: number): void {
  pool.forEachActive((d) => {
    if (d.life < 0) return; // permanent
    d.life -= dt;
    if (d.life <= 0) d.active = false;
  });
}

export function spawnLight(
  pool: Pool<LightSource & { active: boolean }>,
  x: number,
  y: number,
  radius: number,
  color: string,
  intensity: number,
  ttl: number,
): void {
  const l = pool.spawn();
  l.x = x;
  l.y = y;
  l.radius = radius;
  l.color = color;
  l.intensity = intensity;
  l.ttl = ttl;
  l.maxTtl = ttl;
}

export function updateLights(pool: Pool<LightSource & { active: boolean }>, dt: number): void {
  pool.forEachActive((l) => {
    if (l.ttl < 0) return; // persistent torch
    l.ttl -= dt;
    if (l.ttl <= 0) l.active = false;
  });
}

export const PARTICLE_TAU = TAU;
