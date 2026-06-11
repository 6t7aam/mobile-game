import type { GridCoord, Rock, TileType, Tree } from '@/types';
import { GRID } from '@/constants/gameConfig';

// Wider band: with the enlarged 28×28 grid this keeps a ~12×12 buildable
// clearing in the middle while filling the rest with deep, walkable forest.
export const FOREST_BAND = 8;

export function seededNoise(x: number, y: number, salt = 0): number {
  const s = Math.sin((x * 374.1 + y * 591.3 + salt * 127.4) * 0.1) * 10000;
  return s - Math.floor(s);
}

export function deterministicPoints(tx: number, ty: number, count: number, salt = 0): number[][] {
  return Array.from({ length: count }, (_, i) => {
    const s1 = Math.sin((tx * 374.1 + ty * 591.3 + i * 127.4 + salt) * 0.1) * 10000;
    const s2 = Math.sin((tx * 591.3 + ty * 374.1 + i * 253.7 + salt) * 0.1) * 10000;
    const s3 = Math.sin((tx * 127.4 + ty * 253.7 + i * 374.1 + salt) * 0.1) * 10000;
    return [s1 - Math.floor(s1), s2 - Math.floor(s2), s3 - Math.floor(s3)];
  });
}

export function isForestZone(col: number, row: number, cols = GRID.cols, rows = GRID.rows): boolean {
  return col < FOREST_BAND || col >= cols - FOREST_BAND || row < FOREST_BAND || row >= rows - FOREST_BAND;
}

/** Keep a clear camp radius around the central shelter — no trees on spawn. */
export function isSpawnClearing(col: number, row: number): boolean {
  const cc = GRID.cols / 2;
  const cr = GRID.rows / 2;
  return Math.abs(col - cc) < 5 && Math.abs(row - cr) < 5;
}

export function isInnerTreeCluster(col: number, row: number): boolean {
  if (isForestZone(col, row) || isSpawnClearing(col, row)) return false;
  const inNorthWestGrove = col >= 5 && col <= 6 && row >= 5 && row <= 6;
  const inSouthEastGrove = col >= 20 && col <= 21 && row >= 19 && row <= 20;
  return inNorthWestGrove || inSouthEastGrove || seededNoise(col, row, 77) > 0.965;
}

export function isBuildZone(coord: GridCoord): boolean {
  return !isForestZone(coord.col, coord.row);
}

export function tileTypeAt(col: number, row: number, stump = false, hasBuilding = false): TileType {
  if (stump) return 'stump';
  if (hasBuilding) return 'dirt_path';
  if (isForestZone(col, row) || isInnerTreeCluster(col, row)) return 'forest_floor';
  return seededNoise(col, row, 11) < 0.09 ? 'dirt_path' : 'grass';
}

export function spawnInitialTrees(): Tree[] {
  const trees: Tree[] = [];
  for (let row = 0; row < GRID.rows; row++) {
    for (let col = 0; col < GRID.cols; col++) {
      const perimeter = isForestZone(col, row);
      const cluster = isInnerTreeCluster(col, row);
      if (!perimeter && !cluster) continue;

      const chance = seededNoise(col, row, 42);
      if (perimeter && chance <= 0.28) continue;
      if (cluster && chance <= 0.12) continue;

      trees.push({
        id: `tree_${col}_${row}`,
        tileX: col,
        tileY: row,
        hp: 3,
        maxHp: 3,
        state: 'alive',
        fallAngle: seededNoise(col, row, 99) > 0.5 ? 90 : -90,
        fallStartedAt: null,
        woodDropped: false,
      });
    }
  }
  return trees;
}

/**
 * Mineable nodes: stone boulders scattered through the forest band and a few
 * scrap-metal piles (wrecks) nearer the clearing edge. Deterministic placement
 * (seeded), skipping tiles that already grow a tree.
 */
export function spawnInitialRocks(trees: Tree[]): Rock[] {
  const taken = new Set(trees.map((t) => `${t.tileX},${t.tileY}`));
  const rocks: Rock[] = [];
  for (let row = 1; row < GRID.rows - 1; row++) {
    for (let col = 1; col < GRID.cols - 1; col++) {
      if (taken.has(`${col},${row}`)) continue;
      const inForest = isForestZone(col, row);
      const n = seededNoise(col, row, 1337);
      if (inForest && n > 0.9) {
        rocks.push(makeRock(col, row, 'boulder'));
      } else if (!inForest && !isBuildZoneCenter(col, row) && n > 0.96) {
        rocks.push(makeRock(col, row, 'scrapPile'));
      }
    }
  }
  return rocks;
}

/** Keep the very center (shelter area) clear of nodes. */
function isBuildZoneCenter(col: number, row: number): boolean {
  const c = GRID.cols / 2;
  const r = GRID.rows / 2;
  return Math.abs(col - c) < 4 && Math.abs(row - r) < 4;
}

function makeRock(col: number, row: number, kind: Rock['kind']): Rock {
  return {
    id: `rock_${col}_${row}`,
    tileX: col,
    tileY: row,
    kind,
    hp: kind === 'boulder' ? 4 : 3,
    maxHp: kind === 'boulder' ? 4 : 3,
    state: 'alive',
    depletedAt: null,
  };
}
