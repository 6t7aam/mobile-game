/**
 * Allocation-free 2D math helpers and a deterministic seeded RNG.
 * The combat loop runs hundreds of entities per frame, so these helpers
 * mutate-in-place or return scalars rather than allocating new objects.
 */

import type { Vec2 } from '@/types';

export const TAU = Math.PI * 2;

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth exponential approach, frame-rate independent. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function angleBetween(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function vecCopy(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}

/** Returns true if (px,py) lies within `half`-angle cone from origin facing `dir`. */
export function inCone(
  ox: number,
  oy: number,
  dir: number,
  half: number,
  range: number,
  px: number,
  py: number,
): boolean {
  if (dist2(ox, oy, px, py) > range * range) return false;
  const a = angleBetween(ox, oy, px, py);
  return Math.abs(angleDelta(dir, a)) <= half;
}

// ---------------------------------------------------------------------------
// Mulberry32 — fast, deterministic, seedable PRNG
// ---------------------------------------------------------------------------

export class Rng {
  private state: number;

  constructor(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.state = seed >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Random angle in [0, TAU). */
  angle(): number {
    return this.next() * TAU;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)] as T;
  }
}
