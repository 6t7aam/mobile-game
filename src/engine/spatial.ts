/**
 * Uniform spatial hash grid for fast neighbour / target queries.
 * Rebuilt once per simulation step from the active enemy list; combat & tower
 * targeting query it instead of scanning every enemy (O(n) → ~O(1) average).
 */

import type { EnemyEntity } from './entities';

export class SpatialHash {
  private cellSize: number;
  private cells = new Map<number, EnemyEntity[]>();
  private cols: number;

  constructor(cellSize = 96, worldWidth = 4096) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldWidth / cellSize) + 64; // pad for off-map spawns
  }

  private key(cx: number, cy: number): number {
    // offset so negative (off-map) coords stay positive
    return (cy + 64) * this.cols + (cx + 64);
  }

  clear(): void {
    this.cells.clear();
  }

  rebuild(enemies: EnemyEntity[]): void {
    this.cells.clear();
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]!;
      if (!e.active) continue;
      this.insert(e);
    }
  }

  insert(e: EnemyEntity): void {
    const cx = Math.floor(e.x / this.cellSize);
    const cy = Math.floor(e.y / this.cellSize);
    const k = this.key(cx, cy);
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = [];
      this.cells.set(k, bucket);
    }
    bucket.push(e);
  }

  /** Invoke `fn` for every enemy within `radius` of (x,y). */
  queryRadius(x: number, y: number, radius: number, fn: (e: EnemyEntity) => void): void {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);
    const r2 = radius * radius;
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const e = bucket[i]!;
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= r2) fn(e);
        }
      }
    }
  }

  /** Nearest active enemy to (x,y) within `radius`, or null. */
  nearest(x: number, y: number, radius: number): EnemyEntity | null {
    let best: EnemyEntity | null = null;
    let bestD2 = radius * radius;
    this.queryRadius(x, y, radius, (e) => {
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = e;
      }
    });
    return best;
  }
}
