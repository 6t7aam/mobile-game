/**
 * Imperative Skia renderer for the battle sim. Draws the whole battlefield onto
 * a single SkCanvas (recorded into one SkPicture per frame) so entity count
 * doesn't inflate the React tree.
 *
 * All art is procedural (see ./sprites): textured floor tiles, faux-iso
 * level-driven buildings, top-down chibi characters, per-type zombie
 * silhouettes, weapons, particles and a night lighting pass. A module-level
 * monotonic clock (wall time) drives idle/walk/glow animation so phases stay in
 * sync without threading time through the React tree.
 */

import { Skia, BlendMode, TileMode, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';

import type { BattleSim } from '@/engine/sim';
import type { PlacedBuilding, Rock, Tree } from '@/types';
import { GRID, WORLD } from '@/constants/gameConfig';
import { BUILDINGS } from '@/constants/buildings';
import { BOSSES } from '@/constants/enemies';
import { THEME } from '@/theme';
import {
  drawTile,
  drawBuilding,
  drawEnemy,
  drawPlayer,
  drawSoldier,
  drawWeapon,
  drawMuzzleFlash,
  drawText,
} from './sprites';
import { getBattleFonts } from './fonts';

const TILE = GRID.tileSize;
const C = THEME.colors;

// ---- module animation clock (seconds, wall time) --------------------------
const startMs = Date.now();
function now(): number {
  return (Date.now() - startMs) / 1000;
}

// ---- cached paints --------------------------------------------------------
const paints = {
  void: solid(C.void),
  blood: solid(C.bloodDark),
  acid: solid(C.acid),
  scorch: solid(C.scorch),
  proj: solid(C.projectile),
  projElectric: solid(C.electric),
  projFire: solid(C.projectileFire),
  particle: solid(C.white),
  hpBack: solid(C.hpBack),
  hpFill: solid(C.blood),
  hpFlash: solid(C.hpFlash),
  text: solid(C.offWhite),
  crit: solid(C.crit),
};

function solid(color: string): SkPaint {
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  p.setAntiAlias(true);
  return p;
}

const darkOverlay = (() => {
  const p = Skia.Paint();
  p.setColor(Skia.Color(C.nightOverlay));
  p.setBlendMode(BlendMode.Multiply);
  return p;
})();

const lightPaint = (() => {
  const p = Skia.Paint();
  p.setBlendMode(BlendMode.Plus);
  return p;
})();

// reusable occupancy grid (built tiles) — avoids per-frame Set allocation
const occupied = new Uint8Array(GRID.cols * GRID.rows);

// reusable Skia.Path — reset() + reuse instead of allocating per entity/frame.
// The renderer is single-threaded per frame, so one shared scratch path is safe
// as long as each use is self-contained (build → draw → next reset).
const scratchPath = Skia.Path.Make();

// cached Skia.Color objects keyed by hex string — particle colours repeat
// heavily across frames; Skia.Color() parsing is not free at hundreds/frame.
const colorCache = new Map<string, ReturnType<typeof Skia.Color>>();
function cachedColor(hex: string): ReturnType<typeof Skia.Color> {
  let c = colorCache.get(hex);
  if (!c) {
    c = Skia.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

// ---------------------------------------------------------------------------

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  shakeX: number;
  shakeY: number;
}

/** A carryable item dropped in the world (felled log, mined ore). */
export interface GroundItem {
  id: string;
  x: number;
  y: number;
  kind: 'log' | 'stone' | 'scrap';
}

/** Placement ghost for Clash-of-Clans style building. */
export interface PlacementGhost {
  type: import('@/types').BuildingType;
  col: number;
  row: number;
  valid: boolean;
}

/**
 * Everything the unified world needs beyond the combat sim: the forest,
 * mineable nodes, dropped items, the build ghost, the player's harvest
 * action, and the ambient light level (1 = noon, 0.15 = midnight).
 */
export interface WorldView {
  trees?: Tree[];
  rocks?: Rock[];
  items?: GroundItem[];
  ghost?: PlacementGhost | null;
  ambient?: number;
  /** 0..1 axe/pick swing progress (1 = just swung). */
  playerSwing?: number;
  playerCarrying?: number;
  /** 0..1 dodge-roll progress (1 = roll start). */
  playerRoll?: number;
}

export function renderBattle(
  canvas: SkCanvas,
  sim: BattleSim,
  cam: Camera,
  viewW: number,
  viewH: number,
  world?: WorldView,
): void {
  const t = now();
  const ambient = world?.ambient ?? (sim.worldMode ? sim.lightLevel : 0.15);

  canvas.save();
  canvas.translate(viewW / 2 + cam.shakeX, viewH / 2 + cam.shakeY);
  canvas.scale(cam.zoom, cam.zoom);
  canvas.translate(-cam.x, -cam.y);

  // view-culling bounds in world px (only draw what the camera sees)
  const cullL = cam.x - viewW / 2 / cam.zoom - TILE;
  const cullR = cam.x + viewW / 2 / cam.zoom + TILE;
  const cullT = cam.y - viewH / 2 / cam.zoom - TILE * 2;
  const cullB = cam.y + viewH / 2 / cam.zoom + TILE;

  drawGround(canvas, sim, cullL, cullR, cullT, cullB);
  drawDecals(canvas, sim);
  if (world?.items) for (const it of world.items) drawGroundItem(canvas, it);

  // depth-sorted scene: trees + rocks + buildings + actors, back to front
  drawWorldScene(canvas, sim, t, world, cullL, cullR, cullT, cullB);

  drawProjectiles(canvas, sim);
  drawParticles(canvas, sim);

  if (world?.ghost) drawGhost(canvas, world.ghost, t);

  drawLighting(canvas, sim, ambient);

  drawDamageNumbers(canvas, sim);

  canvas.restore();
}

/**
 * Unified depth-sorted draw of trees, rocks, buildings, soldiers, enemies and
 * the player so tall sprites overlap correctly in the continuous world.
 */
function drawWorldScene(
  canvas: SkCanvas,
  sim: BattleSim,
  t: number,
  world: WorldView | undefined,
  cullL: number,
  cullR: number,
  cullT: number,
  cullB: number,
): void {
  const scene: { y: number; draw: () => void }[] = [];

  if (world?.trees) {
    for (const tree of world.trees) {
      if (tree.state === 'stump') continue;
      const x = tree.tileX * TILE;
      const y = tree.tileY * TILE;
      if (x < cullL || x > cullR || y < cullT - TILE * 2 || y > cullB) continue;
      scene.push({ y: y + TILE, draw: () => drawWorldTree(canvas, tree, t) });
    }
  }
  if (world?.rocks) {
    for (const rock of world.rocks) {
      if (rock.state !== 'alive') continue;
      const x = rock.tileX * TILE;
      const y = rock.tileY * TILE;
      if (x < cullL || x > cullR || y < cullT || y > cullB) continue;
      scene.push({ y: y + TILE * 0.8, draw: () => drawRock(canvas, rock) });
    }
  }
  for (const b of sim.buildings) {
    const def = BUILDINGS[b.type];
    const bx = b.origin.col * TILE;
    const by = b.origin.row * TILE;
    if (bx > cullR || bx + def.size.w * TILE < cullL || by > cullB || by + def.size.h * TILE < cullT - TILE * 2) continue;
    scene.push({ y: (b.origin.row + def.size.h) * TILE, draw: () => drawOneBuilding(canvas, sim, b, t) });
  }
  sim.enemies.forEachActive((e) => {
    if (e.x < cullL || e.x > cullR || e.y < cullT || e.y > cullB) return;
    scene.push({ y: e.y + 12, draw: () => drawOneEnemy(canvas, sim, e, t) });
  });
  sim.soldiers.forEachActive((s) => {
    scene.push({
      y: s.y + 10,
      draw: () => {
        const moving = Math.abs(s.x - s.px) + Math.abs(s.y - s.py) > 0.3;
        drawSoldier(canvas, s.x, s.y, s.facing, moving, t);
        drawWeapon(canvas, s.x + Math.cos(s.facing) * 8, s.y + Math.sin(s.facing) * 8 - 4, s.facing, 'rifle', 0);
        if (s.hp < s.maxHp) drawBar(canvas, s.x - 9, s.y - 18, 18, 3, s.hp / s.maxHp);
      },
    });
  });
  scene.push({ y: sim.player.y + 14, draw: () => drawPlayer_(canvas, sim, t, world) });

  scene.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
}

// ---------------------------------------------------------------------------

function computeOccupancy(sim: BattleSim): void {
  occupied.fill(0);
  for (const b of sim.buildings) {
    const def = BUILDINGS[b.type];
    for (let r = 0; r < def.size.h; r++) {
      for (let c = 0; c < def.size.w; c++) {
        const col = b.origin.col + c;
        const row = b.origin.row + r;
        if (col >= 0 && col < GRID.cols && row >= 0 && row < GRID.rows) {
          occupied[row * GRID.cols + col] = 1;
        }
      }
    }
  }
}

/**
 * Full-quality world tree: banded trunk, layered swaying canopy with a lit
 * side, chop marks while being harvested, and a tipping animation when felled.
 */
function drawWorldTree(canvas: SkCanvas, tree: Tree, t: number): void {
  const x = tree.tileX * TILE + TILE / 2;
  const y = tree.tileY * TILE + TILE / 2;
  const fall =
    tree.state === 'falling' && tree.fallStartedAt
      ? Math.min(1, (Date.now() - tree.fallStartedAt) / 800)
      : 0;
  const sway = Math.sin(t * 1.2 + tree.tileX * 1.3 + tree.tileY) * 0.7;

  canvas.save();
  canvas.translate(x, y);
  if (fall > 0) canvas.rotate(tree.fallAngle * fall, 0, 0);

  canvas.drawOval(Skia.XYWHRect(-14, 10, 28, 8), setSolid(C.black, 0.18));

  // straighter pixel trunk
  canvas.drawRect(Skia.XYWHRect(-6, -20, 12, 29), setSolid(THEME.outline.color));
  canvas.drawRect(Skia.XYWHRect(-4, -18, 8, 27), setSolid(C.woodSide));
  canvas.drawRect(Skia.XYWHRect(-1, -18, 3, 27), setSolid(C.woodTop, 0.85));
  for (let i = 0; i < 3; i++) canvas.drawRect(Skia.XYWHRect(-4, -12 + i * 8, 8, 2), setSolid(C.woodDark, 0.75));

  // flatter blocky canopy inspired by top-down prison-yard trees.
  canvas.save();
  canvas.translate(sway, 0);
  for (const [rx, ry, rw, rh] of [
    [-22, -43, 44, 26],
    [-18, -54, 36, 24],
    [-28, -36, 24, 22],
    [4, -36, 24, 22],
  ] as const) {
    canvas.drawRect(Skia.XYWHRect(rx - 2, ry - 2, rw + 4, rh + 4), setSolid(THEME.outline.color));
    canvas.drawRect(Skia.XYWHRect(rx, ry, rw, rh), setSolid(C.forestDark));
  }
  canvas.drawRect(Skia.XYWHRect(-17, -49, 34, 18), setSolid(C.forest));
  canvas.drawRect(Skia.XYWHRect(-20, -42, 20, 12), setSolid(C.leaf));
  canvas.drawRect(Skia.XYWHRect(2, -42, 18, 12), setSolid(C.leaf));
  canvas.drawRect(Skia.XYWHRect(-12, -50, 8, 5), setSolid(C.grassLight, 0.75));
  canvas.drawRect(Skia.XYWHRect(5, -45, 7, 4), setSolid(C.grassLight, 0.65));
  canvas.drawRect(Skia.XYWHRect(-18, -33, 4, 4), setSolid(C.leafDark, 0.8));
  canvas.drawRect(Skia.XYWHRect(15, -35, 4, 4), setSolid(C.leafDark, 0.8));
  canvas.restore();

  // chop wedges on the trunk while being harvested
  if (tree.hp < tree.maxHp && tree.state === 'alive') {
    for (let i = 0; i < tree.maxHp - tree.hp; i++) {
      const cm = Skia.Path.Make();
      cm.moveTo(-4, -14 + i * 6);
      cm.lineTo(2, -11 + i * 6);
      cm.lineTo(-4, -8 + i * 6);
      cm.close();
      canvas.drawPath(cm, setSolid(C.woodDark));
    }
  }
  canvas.restore();
}

/** Mineable node: a grey boulder or a rusty scrap pile with crack stages. */
function drawRock(canvas: SkCanvas, rock: Rock): void {
  const x = rock.tileX * TILE + TILE / 2;
  const y = rock.tileY * TILE + TILE / 2;
  canvas.drawOval(Skia.XYWHRect(x - 14, y + 5, 28, 9), setSolid(C.black, 0.25));
  if (rock.kind === 'boulder') {
    // clustered grey stones with a lit top
    canvas.drawCircle(x, y - 3, 14, setSolid(THEME.outline.color));
    canvas.drawCircle(x, y - 3, 12.5, setSolid(C.stone));
    canvas.drawCircle(x - 9, y + 3, 8, setSolid(THEME.outline.color));
    canvas.drawCircle(x - 9, y + 3, 6.8, setSolid(C.stoneSide));
    canvas.drawCircle(x + 9, y + 4, 6.5, setSolid(THEME.outline.color));
    canvas.drawCircle(x + 9, y + 4, 5.3, setSolid(C.stoneSide));
    canvas.drawCircle(x - 3, y - 8, 5, setSolid(C.stoneTop));
  } else {
    // scrap pile: stacked rusty plates + a gear
    canvas.drawRect(Skia.XYWHRect(x - 13, y - 2, 26, 9), setSolid(THEME.outline.color));
    canvas.drawRect(Skia.XYWHRect(x - 12, y - 1, 24, 7), setSolid(C.metalSide));
    canvas.drawRect(Skia.XYWHRect(x - 9, y - 8, 18, 7), setSolid(THEME.outline.color));
    canvas.drawRect(Skia.XYWHRect(x - 8, y - 7, 16, 5), setSolid('#8a5a3a'));
    canvas.drawCircle(x + 6, y - 10, 5, setSolid(C.metalTop));
    canvas.drawCircle(x + 6, y - 10, 2, setSolid(C.metalSide));
  }
  // crack stages as it's mined down
  const dmg = rock.maxHp - rock.hp;
  for (let i = 0; i < dmg; i++) {
    const ck = Skia.Path.Make();
    ck.moveTo(x - 6 + i * 6, y - 10);
    ck.lineTo(x - 3 + i * 6, y - 4);
    ck.lineTo(x - 7 + i * 6, y + 2);
    canvas.drawPath(ck, strokeSolid(THEME.outline.color, 1.6));
  }
}

/** Dropped carryable: log / stone chunk / scrap gear. */
function drawGroundItem(canvas: SkCanvas, it: { x: number; y: number; kind: string }): void {
  canvas.drawOval(Skia.XYWHRect(it.x - 10, it.y + 3, 20, 7), setSolid(C.black, 0.25));
  if (it.kind === 'log') {
    canvas.drawRect(Skia.XYWHRect(it.x - 12, it.y - 5, 24, 10), setSolid(THEME.outline.color));
    canvas.drawRect(Skia.XYWHRect(it.x - 11, it.y - 4, 22, 8), setSolid(C.woodSide));
    canvas.drawCircle(it.x - 8, it.y, 2.8, setSolid(C.woodTop));
    canvas.drawCircle(it.x + 8, it.y, 2.8, setSolid(C.woodTop));
  } else if (it.kind === 'stone') {
    canvas.drawCircle(it.x, it.y, 8, setSolid(THEME.outline.color));
    canvas.drawCircle(it.x, it.y, 6.8, setSolid(C.stone));
    canvas.drawCircle(it.x - 2, it.y - 2, 3, setSolid(C.stoneTop));
  } else {
    canvas.drawCircle(it.x, it.y, 8, setSolid(THEME.outline.color));
    canvas.drawCircle(it.x, it.y, 6.6, setSolid(C.metalTop));
    canvas.drawCircle(it.x, it.y, 2.4, setSolid(C.metalSide));
  }
}

/** CoC-style placement ghost: tinted footprint + pulsing outline. */
function drawGhost(canvas: SkCanvas, ghost: { type: PlacedBuilding['type']; col: number; row: number; valid: boolean }, t: number): void {
  const def = BUILDINGS[ghost.type];
  const x = ghost.col * TILE;
  const y = ghost.row * TILE;
  const w = def.size.w * TILE;
  const h = def.size.h * TILE;
  const pulse = 0.5 + Math.sin(t * 5) * 0.2;
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), setSolid(ghost.valid ? C.buildable : C.blocked, 0.3));
  const stroke = strokeSolid(ghost.valid ? C.buildable : C.blocked, 2.5);
  stroke.setAlphaf(pulse + 0.3);
  canvas.drawRect(Skia.XYWHRect(x + 1, y + 1, w - 2, h - 2), stroke);
  // semi-transparent preview of the structure itself
  canvas.save();
  // (cheap: draw the building at 55% alpha via layer-less alpha on each paint
  // is complex; a tinted block keeps it readable)
  canvas.restore();
  drawBuilding(canvas, ghost.type, 1, x, y, w, h, t);
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), setSolid(ghost.valid ? C.buildable : C.blocked, 0.18));
}

let _stroke: SkPaint | null = null;
function strokeSolid(color: string, width: number): SkPaint {
  if (!_stroke) {
    _stroke = Skia.Paint();
    _stroke.setAntiAlias(true);
    _stroke.setStyle(1);
  }
  _stroke.setColor(Skia.Color(color));
  _stroke.setStrokeWidth(width);
  _stroke.setAlphaf(1);
  return _stroke;
}

/** One building, with construction scaffolding + progress while building. */
function drawOneBuilding(canvas: SkCanvas, sim: BattleSim, b: PlacedBuilding, t: number): void {
  const def = BUILDINGS[b.type];
  const x = b.origin.col * TILE;
  const y = b.origin.row * TILE;
  const w = def.size.w * TILE;
  const h = def.size.h * TILE;
  const hp = sim.getBuildingHp(b.id);
  const maxHp = sim.buildingMaxHp(b);

  const underConstruction = !!b.buildUntil && b.buildUntil > Date.now();
  if (underConstruction) {
    // scaffolding: wooden frame + crossbeams + progress bar
    canvas.drawRect(Skia.XYWHRect(x + 4, y + 6, w - 8, h - 10), setSolid(C.dirt, 0.5));
    for (const [lx1, ly1, lx2, ly2] of [
      [x + 6, y + h - 6, x + 6, y + 8],
      [x + w - 6, y + h - 6, x + w - 6, y + 8],
      [x + 6, y + 8, x + w - 6, y + 8],
      [x + 6, y + h - 6, x + w - 6, y + 8],
    ] as const) {
      canvas.drawLine(lx1, ly1, lx2, ly2, strokeSolid(C.woodSide, 4));
    }
    // build progress
    const total = buildDurationOf(b);
    const left = Math.max(0, (b.buildUntil ?? 0) - Date.now());
    const pct = total > 0 ? 1 - left / total : 1;
    drawBar(canvas, x + 4, y - 8, w - 8, 5, pct);
    // hammer bounce
    const hb = Math.abs(Math.sin(t * 6)) * 6;
    canvas.drawRect(Skia.XYWHRect(x + w / 2 - 2, y + h / 2 - 14 - hb, 4, 10), setSolid(C.woodSide));
    canvas.drawRect(Skia.XYWHRect(x + w / 2 - 6, y + h / 2 - 18 - hb, 12, 6), setSolid(C.metalTop));
    return;
  }

  let ox = 0;
  if (hp < maxHp * 0.4 && hp > 0) ox = Math.sin(t * 30 + x) * 0.8;
  canvas.save();
  canvas.translate(ox, 0);
  drawBuilding(canvas, b.type, b.level, x, y, w, h, t);
  canvas.restore();
  if (hp < maxHp && hp > 0) drawBar(canvas, x + 4, y - 7, w - 8, 4, hp / maxHp);
}

const buildDurations = new Map<string, number>();
/** Total construction duration; cached per building from first sighting. */
function buildDurationOf(b: PlacedBuilding): number {
  if (!b.buildUntil) return 0;
  let d = buildDurations.get(b.id);
  if (!d) {
    d = Math.max(1000, b.buildUntil - Date.now());
    buildDurations.set(b.id, d);
  }
  return d;
}

/** One enemy + its health bar / name plate (used by the depth-sorted scene). */
function drawOneEnemy(canvas: SkCanvas, sim: BattleSim, e: import('@/engine/entities').EnemyEntity, t: number): void {
  drawEnemy(canvas, e, t);
  const r = e.boss ? 30 : 12;
  if (e.hp < e.maxHp) {
    drawBar(canvas, e.x - r, e.y - r - (e.boss ? 14 : 9), r * 2, e.boss ? 5 : 3, e.hp / e.maxHp);
  }
  if (e.boss) {
    const fonts = getBattleFonts();
    if (fonts) {
      const name = BOSSES[e.boss]?.name ?? 'БОСС';
      drawText(canvas, name.toUpperCase(), e.x, e.y - r - 18, fonts.large, C.offWhite);
    }
  }
}

let _solid: SkPaint | null = null;
function setSolid(color: string, alpha = 1): SkPaint {
  if (!_solid) {
    _solid = Skia.Paint();
    _solid.setAntiAlias(true);
  }
  _solid.setColor(Skia.Color(color));
  _solid.setAlphaf(alpha);
  return _solid;
}

function drawGround(
  canvas: SkCanvas,
  sim: BattleSim,
  cullL = -Infinity,
  cullR = Infinity,
  cullT = -Infinity,
  cullB = Infinity,
): void {
  // dead-zone void beyond the base
  canvas.drawRect(
    Skia.XYWHRect(
      -WORLD.spawnMargin,
      -WORLD.spawnMargin,
      WORLD.width + WORLD.spawnMargin * 2,
      WORLD.height + WORLD.spawnMargin * 2,
    ),
    paints.void,
  );

  computeOccupancy(sim);
  const colFrom = Math.max(0, Math.floor(cullL / TILE));
  const colTo = Math.min(GRID.cols - 1, Math.floor(cullR / TILE));
  const rowFrom = Math.max(0, Math.floor(cullT / TILE));
  const rowTo = Math.min(GRID.rows - 1, Math.floor(cullB / TILE));
  for (let row = rowFrom; row <= rowTo; row++) {
    for (let col = colFrom; col <= colTo; col++) {
      drawTile(canvas, col, row, TILE, occupied[row * GRID.cols + col] === 1);
    }
  }
}

function drawDecals(canvas: SkCanvas, sim: BattleSim): void {
  sim.decals.forEachActive((d) => {
    const paint = d.kind === 'acid' ? paints.acid : d.kind === 'scorch' ? paints.scorch : paints.blood;
    const alpha = d.life < 0 ? 0.5 : Math.min(0.6, d.life / 6);
    paint.setAlphaf(alpha);
    canvas.drawCircle(d.x, d.y, d.radius, paint);
    paint.setAlphaf(1);
  });
}

function drawBuildings(canvas: SkCanvas, sim: BattleSim, t: number): void {
  for (const b of sim.buildings) {
    const def = BUILDINGS[b.type];
    const x = b.origin.col * TILE;
    const y = b.origin.row * TILE;
    const w = def.size.w * TILE;
    const h = def.size.h * TILE;
    const hp = sim.getBuildingHp(b.id);
    const maxHp = sim.buildingMaxHp(b);

    // damage shake when recently hit (low hp wobble)
    let ox = 0;
    if (hp < maxHp * 0.4 && hp > 0) ox = Math.sin(t * 30 + x) * 0.8;

    canvas.save();
    canvas.translate(ox, 0);
    drawBuilding(canvas, b.type, b.level, x, y, w, h, t);
    canvas.restore();

    if (hp < maxHp && hp > 0) {
      drawBar(canvas, x + 4, y - 7, w - 8, 4, hp / maxHp);
    }
  }
}

function drawEnemies(canvas: SkCanvas, sim: BattleSim, t: number): void {
  sim.enemies.forEachActive((e) => {
    drawEnemy(canvas, e, t);
    const r = e.boss ? 30 : 12;
    if (e.hp < e.maxHp) {
      drawBar(canvas, e.x - r, e.y - r - (e.boss ? 14 : 9), r * 2, e.boss ? 5 : 3, e.hp / e.maxHp);
    }
    if (e.type === 'screamer') {
      // ⚠ priority marker (small triangle)
      scratchPath.reset();
      scratchPath.moveTo(e.x, e.y - r - 14);
      scratchPath.lineTo(e.x - 5, e.y - r - 6);
      scratchPath.lineTo(e.x + 5, e.y - r - 6);
      scratchPath.close();
      canvas.drawPath(scratchPath, paints.crit);
    }
    // boss name plate
    if (e.boss) {
      const fonts = getBattleFonts();
      if (fonts) {
        const name = BOSSES[e.boss]?.name ?? 'БОСС';
        drawText(canvas, name.toUpperCase(), e.x, e.y - r - 18, fonts.large, C.offWhite);
      }
    }
  });
}

function drawSoldiers(canvas: SkCanvas, sim: BattleSim, t: number): void {
  sim.soldiers.forEachActive((s) => {
    const moving = Math.abs(s.x - s.px) + Math.abs(s.y - s.py) > 0.3;
    drawSoldier(canvas, s.x, s.y, s.facing, moving, t);
    drawWeapon(canvas, s.x + Math.cos(s.facing) * 8, s.y + Math.sin(s.facing) * 8 - 4, s.facing, 'rifle', 0);
    if (s.hp < s.maxHp) drawBar(canvas, s.x - 9, s.y - 18, 18, 3, s.hp / s.maxHp);
  });
}

function drawProjectiles(canvas: SkCanvas, sim: BattleSim): void {
  sim.projectiles.forEachActive((p) => {
    if (p.dmgType === 'electric') {
      drawLightningBolt(canvas, p.px, p.py, p.x, p.y);
      return;
    }
    const paint = p.dmgType === 'fire' ? paints.projFire : paints.proj;
    // tracer (reuse scratch path)
    scratchPath.reset();
    scratchPath.moveTo(p.px, p.py);
    scratchPath.lineTo(p.x, p.y);
    paint.setStyle(1);
    paint.setStrokeWidth(p.behavior === 'explosive' ? 4 : 2);
    paint.setAlphaf(0.7);
    canvas.drawPath(scratchPath, paint);
    paint.setStyle(0);
    paint.setAlphaf(1);
    const head = p.behavior === 'explosive' ? 4 : 2.4;
    canvas.drawCircle(p.x, p.y, head, paint);
    // glow head
    paint.setAlphaf(0.3);
    canvas.drawCircle(p.x, p.y, head * 1.9, paint);
    paint.setAlphaf(1);
    // rocket smoke puff trail
    if (p.behavior === 'explosive') {
      paints.particle.setColor(Skia.Color(C.smokeTrail));
      paints.particle.setAlphaf(0.25);
      canvas.drawCircle(p.px, p.py, 4, paints.particle);
      paints.particle.setAlphaf(1);
    }
  });
}

/** Jagged, branching electric arc between two points. */
function drawLightningBolt(canvas: SkCanvas, x0: number, y0: number, x1: number, y1: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const segs = 5;
  scratchPath.reset();
  scratchPath.moveTo(x0, y0);
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const jitter = (Math.random() - 0.5) * 10;
    scratchPath.lineTo(x0 + dx * t + nx * jitter, y0 + dy * t + ny * jitter);
  }
  scratchPath.lineTo(x1, y1);
  const paint = paints.projElectric;
  paint.setStyle(1);
  paint.setStrokeWidth(2.4);
  paint.setAlphaf(0.95);
  canvas.drawPath(scratchPath, paint);
  paint.setStrokeWidth(5);
  paint.setAlphaf(0.25);
  canvas.drawPath(scratchPath, paint);
  paint.setStyle(0);
  paint.setAlphaf(1);
  canvas.drawCircle(x1, y1, 3, paint);
}

function drawPlayer_(canvas: SkCanvas, sim: BattleSim, t: number, world?: WorldView): void {
  const p = sim.player;
  // movement detected via velocity proxy: compare to last position cache
  const moving = playerMoving(p.x, p.y);
  const hurtFlash = p.hp < p.maxHp * 0.3 ? 0.3 + Math.sin(t * 8) * 0.3 : 0;

  // dodge roll: tucked spin along the dash (souls-style)
  const rollT = world?.playerRoll ?? (sim.rollTime > 0 ? sim.rollTime / 0.38 : 0);
  if (rollT > 0) {
    canvas.save();
    canvas.translate(p.x, p.y);
    canvas.rotate((1 - rollT) * 360 * Math.sign(Math.cos(p.facing) || 1), 0, 0);
    canvas.scale(0.85, 0.85);
    drawPlayer(canvas, 0, 0, p.facing, true, t, 0);
    canvas.restore();
    return;
  }

  const swing = world?.playerSwing ?? 0;
  const carrying = world?.playerCarrying ?? 0;
  drawPlayer(canvas, p.x, p.y, p.facing, moving, t, hurtFlash, swing, carrying);

  // weapon in hands (hidden mid-harvest-swing — the axe is drawn by the swing)
  if (swing <= 0) {
    const gx = p.x + Math.cos(p.facing) * 9;
    const gy = p.y + Math.sin(p.facing) * 9 - 4;
    drawWeapon(canvas, gx, gy, p.facing, p.weapon, 0);
    if (sim.muzzleFlash > 0) {
      const mx = gx + Math.cos(p.facing) * 18;
      const my = gy + Math.sin(p.facing) * 18;
      drawMuzzleFlash(canvas, mx, my, p.facing, 4 + sim.muzzleFlash * 4);
    }
  }
}

let lastPX = 0;
let lastPY = 0;
function playerMoving(x: number, y: number): boolean {
  const m = Math.abs(x - lastPX) + Math.abs(y - lastPY) > 0.25;
  lastPX = x;
  lastPY = y;
  return m;
}

function drawParticles(canvas: SkCanvas, sim: BattleSim): void {
  const paint = paints.particle;
  sim.particles.forEachActive((p) => {
    const a = Math.max(0, p.life / p.maxLife);
    paint.setColor(cachedColor(p.color));

    if (p.kind === 'shock') {
      // expanding ring outline; p.size is the target radius
      const t = 1 - a;
      paint.setAlphaf(a * 0.7);
      paint.setStyle(1);
      paint.setStrokeWidth(3);
      canvas.drawCircle(p.x, p.y, p.size * t, paint);
      paint.setStyle(0);
      return;
    }
    if (p.kind === 'confetti') {
      canvas.save();
      canvas.translate(p.x, p.y);
      canvas.rotate(((p.rot ?? 0) * 180) / Math.PI, 0, 0);
      paint.setAlphaf(a);
      canvas.drawRect(Skia.XYWHRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6), paint);
      canvas.restore();
      return;
    }
    if (p.kind === 'ice') {
      // diamond shard
      canvas.save();
      canvas.translate(p.x, p.y);
      canvas.rotate(((p.rot ?? 0) * 180) / Math.PI, 0, 0);
      paint.setAlphaf(a);
      scratchPath.reset();
      scratchPath.moveTo(0, -p.size * 1.6);
      scratchPath.lineTo(p.size, 0);
      scratchPath.lineTo(0, p.size * 1.6);
      scratchPath.lineTo(-p.size, 0);
      scratchPath.close();
      canvas.drawPath(scratchPath, paint);
      canvas.restore();
      return;
    }

    paint.setAlphaf(p.kind === 'smoke' || p.kind === 'dust' ? a * 0.55 : a);
    const grow = p.kind === 'smoke' ? 1 + (1 - a) * 2.2 : p.kind === 'dust' ? 1 + (1 - a) * 1.3 : 1;
    canvas.drawCircle(p.x, p.y, p.size * grow, paint);
  });
  paint.setAlphaf(1);
  paint.setStyle(0);
}

/**
 * Time-of-day lighting. `ambient` 1 = noon (no overlay), ~0.5 = dusk (warm
 * orange grade), 0.15 = night (deep dark + torches/spotlights). Light sources
 * fade in as the world darkens for a smooth Minecraft-style sunset.
 */
function drawLighting(canvas: SkCanvas, sim: BattleSim, ambient = 0.15): void {
  const darkness = 1 - ambient; // 0 = day … 0.85 = night
  if (darkness <= 0.02) return; // full daylight: skip the whole pass

  // dusk warmth: an orange multiply grade that peaks mid-transition
  const duskness = Math.sin(Math.min(1, darkness / 0.85) * Math.PI); // 0→1→0
  if (duskness > 0.05) {
    const warm = Skia.Paint();
    warm.setColor(Skia.Color('#ff8a3c'));
    warm.setAlphaf(duskness * 0.16);
    canvas.drawRect(
      Skia.XYWHRect(-WORLD.spawnMargin, -WORLD.spawnMargin, WORLD.width + WORLD.spawnMargin * 2, WORLD.height + WORLD.spawnMargin * 2),
      warm,
    );
  }

  darkOverlay.setAlphaf(darkness * 0.92);
  canvas.drawRect(
    Skia.XYWHRect(
      -WORLD.spawnMargin,
      -WORLD.spawnMargin,
      WORLD.width + WORLD.spawnMargin * 2,
      WORLD.height + WORLD.spawnMargin * 2,
    ),
    darkOverlay,
  );

  // lights only matter once it's dark enough; fade them in with darkness
  const lightK = Math.max(0, (darkness - 0.25) / 0.6);
  if (lightK <= 0) return;

  sim.lights.forEachActive((l) => {
    const alpha = (l.ttl < 0 ? l.intensity : l.intensity * Math.max(0, l.ttl / l.maxTtl)) * lightK;
    drawRadialLight(canvas, l.x, l.y, l.radius, l.color, alpha);
  });

  // tower spotlight cones — sweep slowly, brighten the field of fire
  const t = now();
  for (const b of sim.buildings) {
    const def = BUILDINGS[b.type];
    if (def.category !== 'defense' || b.type === 'electricFence') continue;
    if (sim.getBuildingHp(b.id) <= 0) continue;
    if (b.buildUntil && b.buildUntil > Date.now()) continue;
    const cx = (b.origin.col + def.size.w / 2) * TILE;
    const cy = (b.origin.row + def.size.h / 2) * TILE;
    drawSpotlight(canvas, cx, cy, t * 0.6 + cx, 230, 0.5 * lightK);
  }

  // player torch
  drawRadialLight(canvas, sim.player.x, sim.player.y, 165, C.torch, 0.55 * lightK);
}

function drawSpotlight(canvas: SkCanvas, x: number, y: number, ang: number, len: number, alpha: number): void {
  const spread = 0.42;
  scratchPath.reset();
  scratchPath.moveTo(x, y);
  scratchPath.lineTo(x + Math.cos(ang - spread) * len, y + Math.sin(ang - spread) * len);
  scratchPath.lineTo(x + Math.cos(ang) * len * 1.08, y + Math.sin(ang) * len * 1.08);
  scratchPath.lineTo(x + Math.cos(ang + spread) * len, y + Math.sin(ang + spread) * len);
  scratchPath.close();
  const shader = Skia.Shader.MakeRadialGradient(
    { x, y },
    len,
    [Skia.Color(withAlpha(C.spotlight, alpha)), cachedColor(C.transparent)],
    [0, 1],
    TileMode.Clamp,
  );
  lightPaint.setShader(shader);
  canvas.drawPath(scratchPath, lightPaint);
}

function drawRadialLight(canvas: SkCanvas, x: number, y: number, radius: number, color: string, alpha: number): void {
  const shader = Skia.Shader.MakeRadialGradient(
    { x, y },
    radius,
    [Skia.Color(withAlpha(color, alpha)), cachedColor(C.transparent)],
    [0, 1],
    TileMode.Clamp,
  );
  lightPaint.setShader(shader);
  canvas.drawCircle(x, y, radius, lightPaint);
}

function drawDamageNumbers(canvas: SkCanvas, sim: BattleSim): void {
  const fonts = getBattleFonts();
  sim.damageNumbers.forEachActive((d) => {
    const alpha = Math.min(1, d.life / 0.5);
    // y is already floated up by updateDamageNumbers
    if (fonts) {
      const color = d.crit ? C.crit : C.offWhite;
      drawText(canvas, String(d.value), d.x, d.y, d.crit ? fonts.medium : fonts.small, color, alpha);
    } else {
      const paint = d.crit ? paints.crit : paints.text;
      paint.setAlphaf(alpha);
      canvas.drawCircle(d.x, d.y, d.crit ? 3.4 : 2.2, paint);
      paint.setAlphaf(1);
    }
  });
}

function drawBar(canvas: SkCanvas, x: number, y: number, w: number, h: number, pct: number): void {
  canvas.drawRect(Skia.XYWHRect(x - 1, y - 1, w + 2, h + 2), paints.scorch);
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), paints.hpBack);
  const fillPaint = pct < 0.25 ? paints.hpFlash : paints.hpFill;
  canvas.drawRect(Skia.XYWHRect(x, y, w * Math.max(0, Math.min(1, pct)), h), fillPaint);
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex.length === 7 ? `${hex}${a}` : hex;
}
