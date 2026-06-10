/**
 * Flow-field pathfinding over the 12×9 base grid.
 *
 * A single BFS from the shelter produces a per-tile direction field that every
 * enemy can follow in O(1) — far cheaper than per-enemy A* with hundreds of
 * units. Walls/gates raise tile cost (enemies prefer to route around, but will
 * smash through if that's the only way). Rebuilt whenever the layout changes
 * (wall destroyed, gate toggled).
 */

import type { GridCoord, PlacedBuilding } from '@/types';
import { GRID } from '@/constants/gameConfig';
import { BUILDINGS } from '@/constants/buildings';

const { cols, rows, tileSize } = GRID;

/** Cost added for entering a barrier tile (enemies route around if cheaper). */
const BARRIER_COST = 40;
const BLOCKED = Number.POSITIVE_INFINITY;

export interface FlowField {
  /** For each tile: index of the next tile toward the goal (-1 = goal/none). */
  next: Int32Array;
  /** Integrated cost to the goal per tile (for debug / steering blend). */
  cost: Float32Array;
  cols: number;
  rows: number;
}

function idx(col: number, row: number): number {
  return row * cols + col;
}

/** Build a per-tile entry cost grid from the current buildings. */
function buildCostGrid(buildings: PlacedBuilding[]): Float32Array {
  const cost = new Float32Array(cols * rows).fill(1);
  for (const b of buildings) {
    const def = BUILDINGS[b.type];
    const isBarrier = def.category === 'barrier';
    const open = b.type === 'gate' && b.open === true;
    for (let dc = 0; dc < def.size.w; dc++) {
      for (let dr = 0; dr < def.size.h; dr++) {
        const c = b.origin.col + dc;
        const r = b.origin.row + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        if (isBarrier && !open) {
          cost[idx(c, r)] = BARRIER_COST;
        } else if (def.category === 'core' || def.category === 'production' || def.category === 'support' || def.category === 'defense') {
          // solid footprints are impassable except the shelter (the goal)
          if (def.category !== 'core') cost[idx(c, r)] = BLOCKED;
        }
      }
    }
  }
  return cost;
}

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Dijkstra flow-field toward every tile of the shelter footprint.
 * Returns a field enemies follow with `directionAt`.
 */
export function buildFlowField(
  buildings: PlacedBuilding[],
  shelter: PlacedBuilding | undefined,
): FlowField {
  const cost = buildCostGrid(buildings);
  const integrated = new Float32Array(cols * rows).fill(BLOCKED);
  const next = new Int32Array(cols * rows).fill(-1);

  if (!shelter) {
    return { next, cost: integrated, cols, rows };
  }

  // Seed the queue with all shelter tiles at cost 0.
  const def = BUILDINGS[shelter.type];
  const queue: number[] = [];
  for (let dc = 0; dc < def.size.w; dc++) {
    for (let dr = 0; dr < def.size.h; dr++) {
      const c = shelter.origin.col + dc;
      const r = shelter.origin.row + dr;
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const i = idx(c, r);
      integrated[i] = 0;
      queue.push(i);
    }
  }

  // Simple Dijkstra with a sorted-insert frontier (grid is tiny: 108 tiles).
  while (queue.length) {
    // pop the lowest-cost node
    let bestPos = 0;
    for (let q = 1; q < queue.length; q++) {
      if (integrated[queue[q]!]! < integrated[queue[bestPos]!]!) bestPos = q;
    }
    const cur = queue.splice(bestPos, 1)[0]!;
    const cc = cur % cols;
    const cr = Math.floor(cur / cols);
    const baseCost = integrated[cur]!;

    for (const [dx, dy] of NEIGHBORS) {
      const nc = cc + dx;
      const nr = cr + dy;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = idx(nc, nr);
      const entry = cost[ni]!;
      if (entry === BLOCKED) continue;
      const nd = baseCost + entry;
      if (nd < integrated[ni]!) {
        integrated[ni] = nd;
        next[ni] = cur; // step toward the goal
        queue.push(ni);
      }
    }
  }

  return { next, cost: integrated, cols, rows };
}

/** World-space steering direction (unit vector) for an enemy at (x,y). */
export function directionAt(
  field: FlowField,
  x: number,
  y: number,
  out: { x: number; y: number },
): boolean {
  const col = Math.floor(x / tileSize);
  const row = Math.floor(y / tileSize);
  if (col < 0 || row < 0 || col >= cols || row >= rows) {
    // off-map: steer toward grid centre
    const cx = (cols * tileSize) / 2;
    const cy = (rows * tileSize) / 2;
    const len = Math.hypot(cx - x, cy - y) || 1;
    out.x = (cx - x) / len;
    out.y = (cy - y) / len;
    return true;
  }
  const i = row * cols + col;
  const n = field.next[i]!;
  if (n < 0) {
    out.x = 0;
    out.y = 0;
    return false; // at goal or unreachable
  }
  const ncol = n % cols;
  const nrow = Math.floor(n / cols);
  const tx = (ncol + 0.5) * tileSize;
  const ty = (nrow + 0.5) * tileSize;
  const len = Math.hypot(tx - x, ty - y) || 1;
  out.x = (tx - x) / len;
  out.y = (ty - y) / len;
  return true;
}

export function tileOf(x: number, y: number): GridCoord {
  return { col: Math.floor(x / tileSize), row: Math.floor(y / tileSize) };
}
