import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Picture, Skia, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { BuildingType, GridCoord, PlacedBuilding, TileType, Tree } from '@/types';
import { GRID } from '@/constants/gameConfig';
import { BUILDINGS } from '@/constants/buildings';
import { drawPlayer, drawLog } from '@/components/battle/sprites';
import { canBuildOnTile } from '@/store/baseStore';
import { deterministicPoints, seededNoise, tileTypeAt } from '@/utils/terrain';
import { THEME } from '@/theme';

const TILE = GRID.tileSize;
const C = THEME.colors;
const A = THEME.alpha;
const OUTLINE = THEME.outline;

interface DayParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: 'circle' | 'rect';
}

interface BaseGridProps {
  buildings: PlacedBuilding[];
  trees: Tree[];
  placing: BuildingType | null;
  selectedId: string | null;
  canPlaceAt?: (type: BuildingType, coord: GridCoord) => boolean;
  onTapTile: (coord: GridCoord) => void;
  onTapBuilding: (id: string) => void;
  player?: { x: number; y: number; facing: number; moving: boolean; swingUntil?: number; carrying?: number };
  particles?: DayParticle[];
  logs?: { id: string; x: number; y: number }[];
  width: number;
  height: number;
}

type TileCache = Record<string, SkPicture>;

function paint(color: string, style: 'fill' | 'stroke' = 'fill', width: number = OUTLINE.width) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (style === 'stroke') {
    p.setStyle(1);
    p.setStrokeWidth(width);
  }
  return p;
}

export function BaseGrid({
  buildings,
  trees,
  placing,
  selectedId,
  canPlaceAt,
  onTapTile,
  onTapBuilding,
  player,
  particles = [],
  logs = [],
  width,
  height,
}: BaseGridProps) {
  const gridW = GRID.cols * TILE;
  const gridH = GRID.rows * TILE;
  // The zoom is fixed to a constant visible window (≈ VIEW_TILES across), so the
  // "дальность" stays the same no matter how large the map is. The camera center
  // follows the player and is clamped to the world, so near an edge it pans to
  // keep them on screen, and the player can roam the bigger forest beyond the view.
  const VIEW_TILES = 16; // how many tiles fit across the screen (the old feel)
  const scale = Math.max(width, height) / (VIEW_TILES * TILE);
  const viewW = width / scale;
  const viewH = height / scale;
  const clampCam = (v: number, view: number, world: number) => {
    if (view >= world) return world / 2; // world smaller than view → center it
    return Math.max(view / 2, Math.min(world - view / 2, v));
  };
  const camX = player ? clampCam(player.x, viewW, gridW) : gridW / 2;
  const camY = player ? clampCam(player.y, viewH, gridH) : gridH / 2;
  const offX = width / 2 - camX * scale;
  const offY = height / 2 - camY * scale;

  const [ghost, setGhost] = useState<GridCoord | null>(null);
  const [clock, setClock] = useState(0);
  const startRef = useRef(Date.now());
  const tileCacheRef = useRef<TileCache | null>(null);
  if (!tileCacheRef.current) tileCacheRef.current = createTileCache();

  useEffect(() => {
    const id = setInterval(() => setClock((Date.now() - startRef.current) / 1000), 1000 / 30);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!placing) setGhost(null);
  }, [placing]);

  const picture = (() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    c.save();
    c.translate(offX, offY);
    c.scale(scale, scale);

    // view-culling bounds (world px) — only draw what the camera can see, with a
    // 1-tile margin. This is what keeps a big map cheap: ~16² visible tiles
    // instead of the whole 28² grid every frame.
    const cullL = camX - viewW / 2 - TILE;
    const cullR = camX + viewW / 2 + TILE;
    const cullT = camY - viewH / 2 - TILE * 2; // extra top margin for tall sprites
    const cullB = camY + viewH / 2 + TILE;
    const colFrom = Math.max(0, Math.floor(cullL / TILE));
    const colTo = Math.min(GRID.cols - 1, Math.floor(cullR / TILE));
    const rowFrom = Math.max(0, Math.floor(cullT / TILE));
    const rowTo = Math.min(GRID.rows - 1, Math.floor(cullB / TILE));

    const occupied = occupiedTiles(buildings);
    drawFloor(c, tileCacheRef.current!, trees, occupied, colFrom, colTo, rowFrom, rowTo);
    if (placing) drawBuildableGrid(c, trees, occupied);

    const scene: { bottomY: number; draw: () => void }[] = [];
    trees.forEach((tree) => {
      if (tree.state === 'stump') return;
      const tx = tree.tileX * TILE;
      const ty = tree.tileY * TILE;
      if (tx < cullL || tx > cullR || ty < cullT - TILE * 2 || ty > cullB) return;
      scene.push({
        bottomY: ty + TILE,
        draw: () => drawTree(c, tree),
      });
    });
    buildings.forEach((building) => {
      const def = BUILDINGS[building.type];
      const bx = building.origin.col * TILE;
      const by = building.origin.row * TILE;
      if (bx > cullR || bx + def.size.w * TILE < cullL || by > cullB || by + def.size.h * TILE < cullT - TILE * 2) return;
      scene.push({
        bottomY: (building.origin.row + def.size.h) * TILE,
        draw: () => drawBuildingSprite(c, building, clock, buildings),
      });
    });
    logs.forEach((log) => {
      scene.push({ bottomY: log.y + 4, draw: () => drawLog(c, log.x, log.y) });
    });
    if (player) {
      const swing = player.swingUntil && player.swingUntil > Date.now()
        ? (player.swingUntil - Date.now()) / 280
        : 0;
      scene.push({
        bottomY: player.y + TILE * 0.28,
        draw: () =>
          drawPlayer(c, player.x, player.y, player.facing, player.moving, clock, 0, swing, player.carrying ?? 0),
      });
    }
    scene.sort((a, b) => a.bottomY - b.bottomY).forEach((item) => item.draw());

    if (selectedId) drawSelection(c, buildings, selectedId);
    if (placing && ghost) drawPlacementGhost(c, placing, ghost, canPlaceAt ? canPlaceAt(placing, ghost) : true, clock, buildings);
    drawParticles(c, particles);

    c.restore();
    return rec.finishRecordingAsPicture();
  })();

  const screenToTile = (sx: number, sy: number): GridCoord => {
    const gx = (sx - offX) / scale;
    const gy = (sy - offY) / scale;
    return { col: Math.floor(gx / TILE), row: Math.floor(gy / TILE) };
  };

  const inBounds = (coord: GridCoord) => coord.col >= 0 && coord.row >= 0 && coord.col < GRID.cols && coord.row < GRID.rows;

  const handleTap = (sx: number, sy: number) => {
    const coord = screenToTile(sx, sy);
    if (!inBounds(coord)) return;
    const hit = buildings.find((building) => {
      const def = BUILDINGS[building.type];
      return coord.col >= building.origin.col && coord.col < building.origin.col + def.size.w && coord.row >= building.origin.row && coord.row < building.origin.row + def.size.h;
    });
    if (hit && !placing) onTapBuilding(hit.id);
    else onTapTile(coord);
  };

  const moveGhost = (sx: number, sy: number) => {
    const coord = screenToTile(sx, sy);
    if (inBounds(coord)) setGhost(coord);
  };

  const tap = Gesture.Tap().onEnd((event) => {
    'worklet';
    runOnJS(handleTap)(event.x, event.y);
  });
  const pan = Gesture.Pan()
    .enabled(placing !== null)
    .onBegin((event) => {
      'worklet';
      runOnJS(moveGhost)(event.x, event.y);
    })
    .onUpdate((event) => {
      'worklet';
      runOnJS(moveGhost)(event.x, event.y);
    });

  return (
    <GestureDetector gesture={Gesture.Simultaneous(tap, pan)}>
      <View style={[styles.wrap, { width, height }]}>
        <Canvas style={{ width, height }}>
          <Picture picture={picture} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

function createTileCache(): TileCache {
  const out: TileCache = {};
  const types: TileType[] = ['grass', 'dirt_path', 'forest_floor', 'stump'];
  types.forEach((type) => {
    const variants = type === 'grass' ? 4 : type === 'dirt_path' ? 3 : 2;
    for (let variant = 0; variant < variants; variant++) {
      const rec = Skia.PictureRecorder();
      const c = rec.beginRecording(Skia.XYWHRect(0, 0, TILE, TILE));
      drawCachedTile(c, type, variant);
      out[`${type}_${variant}`] = rec.finishRecordingAsPicture();
    }
  });
  return out;
}

function occupiedTiles(buildings: PlacedBuilding[]): Set<string> {
  const occupied = new Set<string>();
  buildings.forEach((building) => {
    const def = BUILDINGS[building.type];
    for (let row = 0; row < def.size.h; row++) {
      for (let col = 0; col < def.size.w; col++) occupied.add(`${building.origin.col + col},${building.origin.row + row}`);
    }
  });
  return occupied;
}

function drawFloor(
  c: SkCanvas,
  cache: TileCache,
  trees: Tree[],
  occupied: Set<string>,
  colFrom = 0,
  colTo = GRID.cols - 1,
  rowFrom = 0,
  rowTo = GRID.rows - 1,
): void {
  c.drawRect(Skia.XYWHRect(-4, -4, GRID.cols * TILE + 8, GRID.rows * TILE + 8), paint(C.forestDark));
  const stumpSet = new Set(trees.filter((tree) => tree.state === 'stump').map((tree) => `${tree.tileX},${tree.tileY}`));
  for (let row = rowFrom; row <= rowTo; row++) {
    for (let col = colFrom; col <= colTo; col++) {
      const built = occupied.has(`${col},${row}`);
      const type = tileTypeAt(col, row, stumpSet.has(`${col},${row}`), built);
      const variant = Math.floor(seededNoise(col, row, 33) * (type === 'grass' ? 4 : type === 'dirt_path' ? 3 : 2));
      const picture = cache[`${type}_${variant}`] ?? cache[`${type}_0`]!;
      c.save();
      c.translate(col * TILE, row * TILE);
      c.drawPicture(picture);
      c.restore();
    }
  }
}

function drawCachedTile(c: SkCanvas, type: TileType, variant: number): void {
  const base =
    type === 'grass'
      ? [C.grass, C.grassLight, C.grass, C.grassDark][variant] ?? C.grass
      : type === 'dirt_path'
        ? [C.dirt, C.path, C.dirtLight][variant] ?? C.dirt
        : C.forest;
  c.drawRect(Skia.XYWHRect(0, 0, TILE, TILE), paint(base));

  if (type === 'grass') {
    drawGrassDetails(c, variant);
  } else if (type === 'dirt_path') {
    drawDirtDetails(c, variant);
  } else {
    drawForestDetails(c, variant);
    if (type === 'stump') drawStump(c, TILE / 2, TILE / 2);
  }

  c.drawRect(Skia.XYWHRect(0, 0, TILE, TILE), paint(A.grid, 'stroke', THEME.outline.thin));
}

function drawGrassDetails(c: SkCanvas, variant: number): void {
  c.drawCircle(TILE * 0.25, TILE * 0.32, 5 + variant, paint(A.grassPatch));
  c.drawCircle(TILE * 0.72, TILE * 0.68, 4, paint(A.grassPatch));
  for (let i = 0; i < 5; i++) {
    const x = 8 + ((i * 11 + variant * 7) % 34);
    const y = 10 + ((i * 17 + variant * 5) % 28);
    const p = Skia.Path.Make();
    p.moveTo(x, y);
    p.lineTo(x - 2, y - 5);
    p.moveTo(x + 1, y);
    p.lineTo(x + 4, y - 6);
    c.drawPath(p, paint(C.grassShade, 'stroke', 1.2));
  }
  if (variant === 2) c.drawCircle(TILE * 0.56, TILE * 0.42, 2, paint(C.pathDark));
}

function drawDirtDetails(c: SkCanvas, variant: number): void {
  for (let i = 0; i < 4; i++) {
    const x = 8 + ((i * 13 + variant * 9) % 34);
    const y = 7 + ((i * 19 + variant * 3) % 34);
    c.drawOval(Skia.XYWHRect(x, y, 5, 3), paint(i % 2 === 0 ? C.dirtDark : C.dirtLight));
  }
  const crack = Skia.Path.Make();
  crack.moveTo(TILE * 0.35, TILE * 0.28);
  crack.lineTo(TILE * 0.5, TILE * 0.45);
  crack.lineTo(TILE * 0.45, TILE * 0.62);
  c.drawPath(crack, paint(C.dirtDark, 'stroke', 1.2));
}

function drawForestDetails(c: SkCanvas, variant: number): void {
  c.drawCircle(TILE * 0.22, TILE * 0.74, 7, paint(C.forestDark));
  c.drawCircle(TILE * 0.74, TILE * 0.28, 5, paint(C.forestDark));
  for (let i = 0; i < 5; i++) {
    const x = 7 + ((i * 9 + variant * 11) % 35);
    const y = 8 + ((i * 15 + variant * 7) % 32);
    c.drawOval(Skia.XYWHRect(x, y, 7, 4), paint(i % 2 === 0 ? C.leaf : C.leafDark));
  }
}

function drawBuildableGrid(c: SkCanvas, trees: Tree[], occupied: Set<string>): void {
  for (let row = 0; row < GRID.rows; row++) {
    for (let col = 0; col < GRID.cols; col++) {
      const coord = { col, row };
      if (!canBuildOnTile(coord, trees) || occupied.has(`${col},${row}`)) continue;
      c.drawRect(Skia.XYWHRect(col * TILE + 2, row * TILE + 2, TILE - 4, TILE - 4), paint(A.buildable));
      c.drawRect(Skia.XYWHRect(col * TILE + 2, row * TILE + 2, TILE - 4, TILE - 4), paint(C.buildable, 'stroke', THEME.outline.thin));
    }
  }
}

function drawParticles(c: SkCanvas, particles: DayParticle[]): void {
  particles.forEach((particle) => {
    const p = paint(particle.color);
    p.setAlphaf(Math.max(0, particle.life / particle.maxLife));
    if (particle.shape === 'rect') c.drawRect(Skia.XYWHRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size), p);
    else c.drawCircle(particle.x, particle.y, particle.size / 2, p);
  });
}

function drawSelection(c: SkCanvas, buildings: PlacedBuilding[], selectedId: string): void {
  const building = buildings.find((item) => item.id === selectedId);
  if (!building) return;
  const def = BUILDINGS[building.type];
  c.drawRect(
    Skia.XYWHRect(building.origin.col * TILE + 2, building.origin.row * TILE + 2, def.size.w * TILE - 4, def.size.h * TILE - 4),
    paint(C.resource, 'stroke', OUTLINE.width),
  );
}

function drawPlacementGhost(c: SkCanvas, type: BuildingType, coord: GridCoord, ok: boolean, clock: number, buildings: PlacedBuilding[]): void {
  const def = BUILDINGS[type];
  const x = coord.col * TILE;
  const y = coord.row * TILE;
  drawBuildingSprite(c, { id: 'ghost', type, origin: coord, level: 1, hp: def.baseHp }, clock, buildings);
  c.drawRect(Skia.XYWHRect(x, y, def.size.w * TILE, def.size.h * TILE), paint(ok ? A.buildable : A.blocked));
}

/**
 * Tree in the Escapists-inspired look (original art): a short banded brown
 * trunk, a chunky outlined canopy built from a few overlapping rounds with a
 * darker base, lighter top and a couple of highlight + fruit dabs. Sways gently
 * and tips over when felled. A little tree shake plays while being chopped.
 */
function drawTree(c: SkCanvas, tree: Tree): void {
  const x = tree.tileX * TILE + TILE / 2;
  const y = tree.tileY * TILE + TILE / 2;
  const now = Date.now();
  const progress = tree.state === 'falling' && tree.fallStartedAt ? Math.min(1, (now - tree.fallStartedAt) / 800) : 0;
  // idle sway (deterministic per tree so the forest doesn't pulse in unison)
  const sway = Math.sin(now / 700 + tree.tileX * 1.3 + tree.tileY) * 1.4;
  // chop shake: jitter for ~0.25s after each hit (more chips as hp drops)
  const chopped = tree.hp < tree.maxHp;

  c.save();
  c.translate(x, y);
  if (tree.state === 'falling') c.rotate(tree.fallAngle * progress, 0, 0);

  drawShadow(c, 0, 14, 17, 6);

  // trunk — banded
  drawOutlinedRect(c, -4, -20, 8, 26, C.wood);
  c.drawRect(Skia.XYWHRect(-4, -14, 8, 3), paint(C.woodDark));
  c.drawRect(Skia.XYWHRect(-4, -6, 8, 3), paint(C.woodDark));
  c.drawRect(Skia.XYWHRect(-2, -20, 2, 26), paint(C.woodTop, 'fill'));

  // canopy with sway
  c.save();
  c.translate(sway, 0);
  // dark base mass
  drawOutlinedCircle(c, -11, -30, 15, C.forestDark);
  drawOutlinedCircle(c, 11, -30, 15, C.forestDark);
  drawOutlinedCircle(c, 0, -40, 18, C.forestDark);
  // lighter top layer (offset up-left, the "lit" side)
  c.drawCircle(-7, -34, 12, paint(C.forest));
  c.drawCircle(6, -36, 11, paint(C.forest));
  c.drawCircle(-2, -44, 12, paint(C.forest));
  c.drawCircle(-4, -46, 7, paint(C.grass));
  // highlight + fruit dabs
  c.drawCircle(-8, -47, 4, paint(A.highlight));
  c.drawCircle(8, -32, 2.2, paint(C.leaf));
  c.drawCircle(-3, -28, 2.2, paint(C.leaf));
  c.restore();

  // chop marks on the trunk
  if (chopped) {
    for (let i = 0; i < tree.maxHp - tree.hp; i++) {
      const cm = Skia.Path.Make();
      cm.moveTo(-3, -14 + i * 6);
      cm.lineTo(2, -11 + i * 6);
      cm.lineTo(-3, -8 + i * 6);
      c.drawPath(cm, paint(C.woodDark, 'fill'));
    }
  }
  c.restore();
}

function drawBuildingSprite(c: SkCanvas, building: PlacedBuilding, clock: number, buildings: PlacedBuilding[]): void {
  const def = BUILDINGS[building.type];
  const x = building.origin.col * TILE;
  const y = building.origin.row * TILE;
  const w = def.size.w * TILE;
  const h = def.size.h * TILE;

  if (building.type === 'wall' || building.type === 'gate') {
    drawWall(c, building, x, y, buildings);
    return;
  }

  drawShadow(c, x + w / 2, y + h - 6, w * 0.38, Math.max(7, h * 0.1));

  switch (building.type) {
    case 'shelter':
      drawTownHall(c, x, y, w, h, building.level, clock);
      break;
    case 'barracks':
      drawBarracks(c, x, y, w, h, building.level);
      break;
    case 'trainingGround':
      drawTrainingGround(c, x, y, w, h, building.level);
      break;
    case 'storage':
      drawStorage(c, x, y, w, h, building.level);
      break;
    case 'tower':
    case 'sniperNest':
    case 'mortar':
      drawTower(c, x, y, w, h, building.level, clock);
      break;
    case 'workshop':
      drawForge(c, x, y, w, h, building.level, clock);
      break;
    default:
      drawPrism(c, x + 4, y + 8, w - 8, h - 12, C.stone, C.stoneTop, C.stoneSide);
      break;
  }
}

/**
 * The shelter is a survivor's CAMPFIRE, not a house: a ring of stones, crossed
 * logs and a living flame, with a lean-to that grows by level. Its death still
 * ends the run — it's the heart of the base — but it fits the wilderness theme.
 */
function drawTownHall(c: SkCanvas, x: number, y: number, w: number, h: number, level: number, clock: number): void {
  const cx = x + w / 2;
  const cy = y + h * 0.62;
  const r = Math.min(w, h) * 0.22; // compact: a tidy campfire, not a bonfire

  // lean-to tent behind the fire from level 2
  if (level >= 2) {
    const tx = cx - r * 1.5;
    const ty = cy - r * 0.4;
    const tent = Skia.Path.Make();
    tent.moveTo(tx, ty + r * 1.1);
    tent.lineTo(tx + r * 0.7, ty - r * 0.7);
    tent.lineTo(tx + r * 1.4, ty + r * 1.1);
    tent.close();
    c.drawPath(tent, paint(level >= 4 ? C.cloth : C.woodSide));
    c.drawPath(tent, paint(OUTLINE.color, 'stroke'));
  }

  // ring of stones (oval, fake-perspective)
  const stones = 8;
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2;
    const sx = cx + Math.cos(a) * r;
    const sy = cy + Math.sin(a) * r * 0.5;
    c.drawCircle(sx, sy, r * 0.26, paint(OUTLINE.color));
    c.drawCircle(sx, sy, r * 0.26 - OUTLINE.width, paint(i % 2 ? C.stone : C.stoneTop));
  }

  // crossed logs
  for (const ang of [-26, 26]) {
    c.save();
    c.translate(cx, cy);
    c.rotate(ang, 0, 0);
    c.drawRect(Skia.XYWHRect(-r * 0.75, -r * 0.16, r * 1.5, r * 0.3), paint(OUTLINE.color));
    c.drawRect(Skia.XYWHRect(-r * 0.75 + OUTLINE.width, -r * 0.16 + OUTLINE.width, r * 1.5 - OUTLINE.width * 2, r * 0.3 - OUTLINE.width * 2), paint(C.wood));
    c.restore();
  }

  // flame — small, layered & flickering
  const flick = 0.85 + Math.sin(clock * 9) * 0.1 + Math.sin(clock * 21) * 0.05;
  const fh = r * (0.95 + level * 0.06) * flick;
  for (const [col, fscale] of [[C.fire, 1], [C.fireLight, 0.6], [C.window, 0.3]] as const) {
    const fw = r * 0.6 * fscale;
    const flame = Skia.Path.Make();
    flame.moveTo(cx, cy - fh * fscale);
    flame.cubicTo(cx + fw, cy - fh * fscale * 0.4, cx + fw * 0.7, cy + r * 0.1, cx, cy + r * 0.1);
    flame.cubicTo(cx - fw * 0.7, cy + r * 0.1, cx - fw, cy - fh * fscale * 0.4, cx, cy - fh * fscale);
    flame.close();
    c.drawPath(flame, paint(col));
  }

  // a few rising embers
  for (let i = 0; i < 4; i++) {
    const t = (clock * 0.8 + i * 0.25) % 1;
    const ex = cx + Math.sin((i + clock) * 3) * r * 0.35;
    const ey = cy - fh * 0.5 - t * r * 1.2;
    const p = paint(C.fireLight);
    p.setAlphaf(1 - t);
    c.drawCircle(ex, ey, (1 - t) * 1.6 + 0.4, p);
  }
}

function drawBarracks(c: SkCanvas, x: number, y: number, w: number, h: number, level: number): void {
  drawPrism(c, x + 8, y + 28, w - 16, h - 34, C.wood, C.woodTop, C.woodSide);
  drawRoof(c, x + 4, y + 22, w - 8, 30);
  drawDoor(c, x + w / 2 - 10, y + h - 36, 20, 28);
  drawWindow(c, x + 20, y + 46, 0);
  drawWindow(c, x + w - 34, y + 46, 0);
  if (level >= 3) drawFlag(c, x + w - 24, y + 10);
}

function drawTrainingGround(c: SkCanvas, x: number, y: number, w: number, h: number, level: number): void {
  drawPrism(c, x + 8, y + 18, w - 16, h - 24, C.path, C.dirtLight, C.pathDark);
  for (let i = 0; i < 3; i++) {
    const px = x + 22 + i * 24;
    drawOutlinedRect(c, px, y + h - 48, 5, 28, C.wood);
    drawOutlinedCircle(c, px + 2, y + h - 52, 7, level >= 3 ? C.danger : C.woodTop);
  }
  drawOutlinedRect(c, x + w - 30, y + 28, 8, 38, C.wood);
  c.drawLine(x + w - 26, y + 30, x + w - 10, y + 46, paint(C.danger, 'stroke', 5));
}

function drawStorage(c: SkCanvas, x: number, y: number, w: number, h: number, level: number): void {
  drawPrism(c, x + 8, y + 24, w - 16, h - 30, C.wood, C.woodTop, C.woodSide);
  for (let i = 0; i < 3; i++) {
    const yy = y + h - 22 - i * 14;
    drawOutlinedRect(c, x + 18 + i * 8, yy, w - 44, 8, i < level / 2 ? C.woodTop : C.woodSide);
  }
  drawRoof(c, x + 8, y + 18, w - 16, 22);
}

function drawTower(c: SkCanvas, x: number, y: number, w: number, h: number, level: number, clock: number): void {
  const leg = level >= 4 ? C.stoneSide : C.woodSide;
  drawOutlinedRect(c, x + 8, y + 28, 7, h - 34, leg);
  drawOutlinedRect(c, x + w - 15, y + 28, 7, h - 34, leg);
  drawPrism(c, x + 6, y + 18, w - 12, 18, level >= 4 ? C.stone : C.wood, level >= 4 ? C.stoneTop : C.woodTop, level >= 4 ? C.stoneSide : C.woodSide);
  c.save();
  c.translate(x + w / 2, y + 27);
  c.rotate((clock * 42) % 360, 0, 0);
  drawOutlinedRect(c, 0, -3, 24, 6, C.metal);
  c.restore();
}

function drawForge(c: SkCanvas, x: number, y: number, w: number, h: number, level: number, clock: number): void {
  drawPrism(c, x + 8, y + 24, w - 16, h - 30, C.stone, C.stoneTop, C.stoneSide);
  drawOutlinedRect(c, x + w - 28, y + 2, 14, 34, C.metal);
  drawOutlinedRect(c, x + 24, y + h - 42, 34, 26, C.woodDark);
  c.drawCircle(x + 41, y + h - 29, 14, paint(clock % 1 > 0.5 ? C.fireLight : C.fire));
  if (level >= 3) c.drawCircle(x + w - 21, y - 6, 7, paint(A.smoke));
}

function drawWall(c: SkCanvas, building: PlacedBuilding, x: number, y: number, buildings: PlacedBuilding[]): void {
  const level = building.level;
  const color = level >= 4 ? C.stone : C.wood;
  const top = level >= 4 ? C.stoneTop : C.woodTop;
  const side = level >= 4 ? C.stoneSide : C.woodSide;
  const has = (dc: number, dr: number) =>
    buildings.some((other) => other.type === 'wall' && other.origin.col === building.origin.col + dc && other.origin.row === building.origin.row + dr);
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  drawShadow(c, cx, y + TILE - 4, 18, 5);
  drawPrism(c, x + 12, y + 18, TILE - 24, TILE - 24, color, top, side);
  if (has(-1, 0)) drawPrism(c, x, y + 20, 18, TILE - 28, color, top, side);
  if (has(1, 0)) drawPrism(c, x + TILE - 18, y + 20, 18, TILE - 28, color, top, side);
  if (has(0, -1)) drawPrism(c, x + 14, y, TILE - 28, 22, color, top, side);
  if (has(0, 1)) drawPrism(c, x + 14, y + TILE - 22, TILE - 28, 22, color, top, side);
}

function drawPrism(c: SkCanvas, x: number, y: number, w: number, h: number, front: string, top: string, side: string): void {
  const lift = Math.min(14, h * 0.22);
  const topPath = Skia.Path.Make();
  topPath.moveTo(x, y + lift);
  topPath.lineTo(x + lift, y);
  topPath.lineTo(x + w, y);
  topPath.lineTo(x + w - lift, y + lift);
  topPath.close();
  const sidePath = Skia.Path.Make();
  sidePath.moveTo(x + w - lift, y + lift);
  sidePath.lineTo(x + w, y);
  sidePath.lineTo(x + w, y + h - lift);
  sidePath.lineTo(x + w - lift, y + h);
  sidePath.close();
  c.drawPath(topPath, paint(top));
  c.drawPath(sidePath, paint(side));
  c.drawRect(Skia.XYWHRect(x, y + lift, w - lift, h - lift), paint(front));
  c.drawPath(topPath, paint(OUTLINE.color, 'stroke', OUTLINE.width));
  c.drawPath(sidePath, paint(OUTLINE.color, 'stroke', OUTLINE.width));
  c.drawRect(Skia.XYWHRect(x, y + lift, w - lift, h - lift), paint(OUTLINE.color, 'stroke', OUTLINE.width));
}

function drawRoof(c: SkCanvas, x: number, y: number, w: number, h: number): void {
  const roof = Skia.Path.Make();
  roof.moveTo(x, y + h);
  roof.lineTo(x + w / 2, y);
  roof.lineTo(x + w, y + h);
  roof.close();
  c.drawPath(roof, paint(C.roofTop));
  c.drawPath(roof, paint(OUTLINE.color, 'stroke', OUTLINE.width));
}

function drawDoor(c: SkCanvas, x: number, y: number, w: number, h: number): void {
  drawOutlinedRect(c, x, y, w, h, C.woodDark);
  c.drawCircle(x + w - 7, y + h / 2, 2, paint(C.resource));
}

function drawWindow(c: SkCanvas, x: number, y: number, clock: number): void {
  c.drawCircle(x + 6, y + 6, 12, paint(A.highlight));
  drawOutlinedRect(c, x, y, 12, 12, clock % 1 > 0.5 ? C.window : C.fireLight);
}

function drawFlag(c: SkCanvas, x: number, y: number): void {
  c.drawLine(x, y, x, y + 24, paint(C.woodDark, 'stroke', OUTLINE.width));
  const flag = Skia.Path.Make();
  flag.moveTo(x, y);
  flag.lineTo(x + 18, y + 7);
  flag.lineTo(x, y + 14);
  flag.close();
  c.drawPath(flag, paint(C.danger));
  c.drawPath(flag, paint(OUTLINE.color, 'stroke', OUTLINE.thin));
}

function drawBattlement(c: SkCanvas, x: number, y: number, color: string): void {
  drawOutlinedRect(c, x, y, 14, 12, color);
}

function drawStump(c: SkCanvas, x: number, y: number): void {
  drawOutlinedCircle(c, x, y, 13, C.woodSide);
  c.drawCircle(x, y, 9, paint(C.woodTop));
  c.drawCircle(x, y, 5, paint(C.woodDark, 'stroke', 1));
}

function drawShadow(c: SkCanvas, x: number, y: number, rx: number, ry: number): void {
  c.drawOval(Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2), paint(A.shadowSoft));
}

function drawOutlinedRect(c: SkCanvas, x: number, y: number, w: number, h: number, color: string): void {
  c.drawRect(Skia.XYWHRect(x, y, w, h), paint(OUTLINE.color));
  c.drawRect(Skia.XYWHRect(x + OUTLINE.width, y + OUTLINE.width, w - OUTLINE.width * 2, h - OUTLINE.width * 2), paint(color));
}

function drawOutlinedCircle(c: SkCanvas, x: number, y: number, r: number, color: string): void {
  c.drawCircle(x, y, r, paint(OUTLINE.color));
  c.drawCircle(x, y, Math.max(0, r - OUTLINE.width), paint(color));
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: C.background },
});
