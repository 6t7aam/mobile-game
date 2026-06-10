import { Skia, type SkCanvas, type SkFont, type SkPaint } from '@shopify/react-native-skia';

import type { BuildingType } from '@/types';
import type { EnemyEntity } from '@/engine/entities';
import { THEME } from '@/theme';

const C = THEME.colors;
const A = THEME.alpha;
const OUTLINE = THEME.outline;

const fill = Skia.Paint();
fill.setAntiAlias(true);
const stroke = Skia.Paint();
stroke.setAntiAlias(true);
stroke.setStyle(1);

function setFill(color: string, alpha = 1): SkPaint {
  fill.setColor(Skia.Color(color));
  fill.setAlphaf(alpha);
  fill.setStyle(0);
  return fill;
}

function setStroke(color: string, width: number, alpha = 1): SkPaint {
  stroke.setColor(Skia.Color(color));
  stroke.setAlphaf(alpha);
  stroke.setStrokeWidth(width);
  return stroke;
}

function rect(c: SkCanvas, x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
  c.drawRect(Skia.XYWHRect(x, y, w, h), setFill(color, alpha));
}

function outlinedRect(c: SkCanvas, x: number, y: number, w: number, h: number, color: string): void {
  rect(c, x, y, w, h, OUTLINE.color);
  rect(c, x + OUTLINE.width, y + OUTLINE.width, w - OUTLINE.width * 2, h - OUTLINE.width * 2, color);
}

function outlinedCircle(c: SkCanvas, x: number, y: number, r: number, color: string): void {
  c.drawCircle(x, y, r, setFill(OUTLINE.color));
  c.drawCircle(x, y, Math.max(0, r - OUTLINE.width), setFill(color));
}

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function drawTile(c: SkCanvas, col: number, row: number, size: number, built: boolean): void {
  const x = col * size;
  const y = row * size;
  const n = hash2(col + 1, row + 1);
  const base = built ? (n > 0.5 ? C.path : C.dirtLight) : n > 0.72 ? C.grassLight : n > 0.42 ? C.grass : C.grassDark;
  rect(c, x, y, size, size, base);
  if (built) {
    rect(c, x + 4, y + 4, size - 8, size - 8, C.pathDark, 0.12);
  } else {
    rect(c, x + 2, y + 2, size - 4, size - 4, n > 0.6 ? C.grassLight : C.grass, 0.18);
  }
  for (let i = 0; i < 3; i++) {
    const px = x + 7 + Math.floor(hash2(col * 7 + i, row * 3) * (size - 14) / 3) * 3;
    const py = y + 7 + Math.floor(hash2(col * 3, row * 7 + i) * (size - 14) / 3) * 3;
    if (built) {
      rect(c, px, py, 3, 3, i % 2 ? C.dirtDark : C.dirt, 0.45);
    } else {
      rect(c, px, py, 3, 3, i % 2 ? C.grassShade : C.grassDark, 0.48);
    }
  }
  c.drawRect(Skia.XYWHRect(x, y, size, size), setStroke(A.grid, 1));
}

export function drawText(c: SkCanvas, text: string, x: number, y: number, font: SkFont, color: string, alpha = 1, center = true): void {
  // A font whose typeface failed to load (can happen on web) throws inside
  // measureText/drawText — that's exactly the "crash when shooting a zombie"
  // (a damage number is drawn on the first hit). Guard so a bad font is a no-op
  // and the renderer falls back gracefully rather than killing the frame.
  try {
    const w = center ? font.measureText(text).width : 0;
    const tx = x - w / 2;
    for (const [dx, dy] of [[-1.4, 0], [1.4, 0], [0, -1.4], [0, 1.4]] as const) {
      c.drawText(text, tx + dx, y + dy, setFill(OUTLINE.color, alpha * 0.9), font);
    }
    c.drawText(text, tx, y, setFill(color, alpha), font);
  } catch {
    /* font not ready / unsupported — skip this label */
  }
}

export function drawShadow(c: SkCanvas, x: number, y: number, rx: number, ry = rx * 0.45): void {
  c.drawOval(Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2), setFill(A.shadowSoft));
}

interface CharStyle {
  jacket: string;
  jacketDark: string;
  pants: string;
  skin: string;
  hair: string;
}

const PLAYER_STYLE: CharStyle = {
  jacket: C.cloth,
  jacketDark: C.clothDark,
  pants: C.metalSide,
  skin: C.skin,
  hair: C.hair,
};

const SOLDIER_STYLE: CharStyle = {
  jacket: C.stoneSide,
  jacketDark: C.metalSide,
  pants: C.metal,
  skin: C.skin,
  hair: C.hair,
};

function drawHumanoid(c: SkCanvas, x: number, y: number, facing: number, walk: number, style: CharStyle, scale: number, flash = 0): void {
  const u = scale;
  const bob = Math.sin(walk * Math.PI * 2) * 1.6 * u;
  const leg = Math.sin(walk * Math.PI * 2) * 3 * u;
  drawShadow(c, x, y + 10 * u, 12 * u, 5 * u);
  outlinedRect(c, x - 5 * u, y + 4 * u + leg + bob, 4 * u, 8 * u, style.pants);
  outlinedRect(c, x + 1 * u, y + 4 * u - leg + bob, 4 * u, 8 * u, style.pants);
  outlinedRect(c, x - 7 * u, y - 6 * u + bob, 14 * u, 13 * u, style.jacket);
  rect(c, x - 5 * u, y + bob, 10 * u, 4 * u, style.jacketDark);
  const ax = Math.cos(facing);
  const ay = Math.sin(facing);
  outlinedRect(c, x - 9 * u + ax * 3 * u, y - 4 * u + ay * 3 * u + bob, 4 * u, 8 * u, style.jacketDark);
  outlinedRect(c, x + 5 * u + ax * 3 * u, y - 4 * u + ay * 3 * u + bob, 4 * u, 8 * u, style.jacketDark);
  const hy = y - 9 * u + bob;
  outlinedCircle(c, x, hy, 7 * u, style.skin);
  c.drawOval(Skia.XYWHRect(x - 6 * u, hy - 7 * u, 12 * u, 7 * u), setFill(style.hair));
  if (Math.sin(facing) > -0.65) {
    c.drawCircle(x - 2.4 * u + ax * 1.3 * u, hy + 1.2 * u + ay * 1.2 * u, 1.2 * u, setFill(OUTLINE.color));
    c.drawCircle(x + 2.4 * u + ax * 1.3 * u, hy + 1.2 * u + ay * 1.2 * u, 1.2 * u, setFill(OUTLINE.color));
  }
  if (flash > 0) c.drawCircle(x, y, 14 * u, setFill(C.danger, 0.5 * flash));
}

export function drawPlayer(
  c: SkCanvas,
  x: number,
  y: number,
  facing: number,
  moving: boolean,
  clock: number,
  flash = 0,
  swing = 0, // 0..1 axe-swing progress
  carrying = 0, // logs held over the shoulder
): void {
  const walk = moving ? clock * 2.2 : Math.sin(clock * 3) * 0.02 + 0.5;
  drawHumanoid(c, x, y, facing, walk % 1, PLAYER_STYLE, 1.7, flash);
  if (swing > 0) drawAxeSwing(c, x, y, facing, swing);
  if (carrying > 0) drawCarriedLogs(c, x, y, carrying);
}

/** An axe arcing down over the swing window (1 → 0). */
function drawAxeSwing(c: SkCanvas, x: number, y: number, facing: number, t: number): void {
  const ax = Math.cos(facing);
  const ay = Math.sin(facing);
  const hx = x + ax * 12;
  const hy = y + ay * 12 - 6;
  // swing arc: raised at t=1, struck down at t=0
  const angle = facing + (-1.2 + (1 - t) * 1.8);
  c.save();
  c.translate(hx, hy);
  c.rotate(deg(angle), 0, 0);
  outlinedRect(c, 0, -1.6, 15, 3.2, C.woodSide); // handle
  outlinedRect(c, 13, -5, 6, 10, C.metalTop); // head
  c.restore();
}

/** A small stack of logs carried over the head. */
function drawCarriedLogs(c: SkCanvas, x: number, y: number, count: number): void {
  const n = Math.min(3, count);
  const top = y - 22;
  for (let i = 0; i < n; i++) {
    const ly = top - i * 4;
    outlinedRect(c, x - 9, ly, 18, 4.5, i % 2 ? C.woodTop : C.wood);
  }
  if (count > 3) {
    // tiny "+N" dot cluster to imply more
    c.drawCircle(x + 11, top - 2, 2.2, setFill(C.woodTop));
  }
}

/** A felled log lying on the ground (carryable pickup). */
export function drawLog(c: SkCanvas, x: number, y: number): void {
  drawShadow(c, x, y + 3, 11, 4);
  outlinedRect(c, x - 11, y - 4, 22, 8, C.woodSide);
  c.drawCircle(x - 8, y, 2.6, setFill(C.woodTop));
  c.drawCircle(x + 8, y, 2.6, setFill(C.woodTop));
}

export function drawSoldier(c: SkCanvas, x: number, y: number, facing: number, moving: boolean, clock: number): void {
  drawHumanoid(c, x, y, facing, (moving ? clock * 2.4 + x : 0.5) % 1, SOLDIER_STYLE, 0.88);
}

function deg(angle: number): number {
  return (angle * 180) / Math.PI;
}

export function drawWeapon(c: SkCanvas, x: number, y: number, facing: number, weapon: string, recoil: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(deg(facing), 0, 0);
  const big = /rpg|mortar|minigun|launcher/.test(weapon);
  const long = /sniper|rifle|ak|m4|carbine/.test(weapon);
  const len = big ? 24 : long ? 22 : 14;
  const th = big ? 7 : long ? 4 : 3.5;
  outlinedRect(c, 6 - recoil * 3, -th / 2, len, th, C.metal);
  outlinedRect(c, 2 - recoil * 3, -1.5, 7, 5, C.woodSide);
  c.restore();
}

export function drawMuzzleFlash(c: SkCanvas, x: number, y: number, facing: number, size: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(deg(facing), 0, 0);
  const path = Skia.Path.Make();
  path.moveTo(0, -size);
  path.lineTo(size * 2.2, 0);
  path.lineTo(0, size);
  path.lineTo(size * 0.6, 0);
  path.close();
  c.drawPath(path, setFill(C.fireLight, 0.95));
  c.drawCircle(0, 0, size * 0.8, setFill(C.window, 0.9));
  c.restore();
}

/**
 * Top-down zombie with a readable body: legs that stride, a torso, swinging
 * arms reaching toward its facing, and a head with glowing eyes. Each type has
 * distinct proportions/accents so threats are recognizable at a glance.
 */
export function drawEnemy(c: SkCanvas, e: EnemyEntity, clock: number): void {
  const t = e.type;
  const big = t === 'brute' || t === 'tank';
  const r = e.boss ? 22 : t === 'tank' ? 19 : t === 'brute' ? 16 : t === 'runner' ? 9 : t === 'armored' ? 13 : 12;
  const speed = Math.hypot(e.vx, e.vy);
  const stride = Math.sin(clock * (3 + speed * 0.05) + e.x * 0.1) * (t === 'runner' ? 5 : 3);
  const burning = e.statuses.some((s) => s.kind === 'burning');
  const poisoned = e.statuses.some((s) => s.kind === 'poisoned');
  const shocked = e.statuses.some((s) => s.kind === 'shocked');

  const ax = Math.cos(e.facing);
  const ay = Math.sin(e.facing);
  // perpendicular (for left/right limb offset)
  const px = -ay;
  const py = ax;

  const skin = burning ? C.fire : t === 'toxic' ? C.acid : t === 'armored' || t === 'tank' ? C.zombieDark : C.zombie;
  const skinDark = C.zombieDark;

  drawShadow(c, e.x, e.y + r * 0.7, r * 0.95, r * 0.45);

  // legs (stride opposite phase)
  outlinedRect(c, e.x + px * r * 0.34 - r * 0.18 - ax * 2 + stride * 0.1, e.y + py * r * 0.34 + r * 0.35 + stride, r * 0.34, r * 0.6, skinDark);
  outlinedRect(c, e.x - px * r * 0.34 - r * 0.18 - ax * 2 - stride * 0.1, e.y - py * r * 0.34 + r * 0.35 - stride, r * 0.34, r * 0.6, skinDark);

  // torso
  outlinedCircle(c, e.x, e.y, r, skin);
  if (t === 'armored' || t === 'tank') {
    // armor plate across the chest
    outlinedRect(c, e.x - r * 0.6, e.y - r * 0.3, r * 1.2, r * 0.7, C.metalSide);
    c.drawRect(Skia.XYWHRect(e.x - r * 0.6, e.y - r * 0.3, r * 1.2, r * 0.18), setFill(C.metalTop));
  }

  // arms reaching toward the target
  const reach = t === 'runner' ? 1.15 : 0.95;
  for (const s of [1, -1]) {
    const hx = e.x + ax * r * reach + px * s * r * 0.5;
    const hy = e.y + ay * r * reach + py * s * r * 0.5;
    c.drawLine(e.x + px * s * r * 0.5, e.y + py * s * r * 0.5, hx, hy, setStroke(skinDark, r * (big ? 0.42 : 0.32)));
    c.drawCircle(hx, hy, r * 0.22, setFill(skin)); // hand
  }

  // head (offset toward facing), with glowing eyes
  const hX = e.x + ax * r * 0.5;
  const hY = e.y + ay * r * 0.5 - r * 0.5;
  outlinedCircle(c, hX, hY, r * 0.6, skin);
  const eyeColor = t === 'screamer' ? C.window : shocked ? C.electric : C.danger;
  c.drawCircle(hX - px * r * 0.22 + ax * r * 0.2, hY - py * r * 0.22 + ay * r * 0.2, r * 0.13, setFill(eyeColor));
  c.drawCircle(hX + px * r * 0.22 + ax * r * 0.2, hY + py * r * 0.22 + ay * r * 0.2, r * 0.13, setFill(eyeColor));

  // type accents
  if (t === 'screamer') {
    // gaping maw + sound rings
    c.drawCircle(hX + ax * r * 0.4, hY + ay * r * 0.4, r * 0.22, setFill(C.danger));
    c.drawCircle(e.x, e.y, r + 3 + Math.sin(clock * 8) * 2, setStroke(C.crit, 1.5, 0.5));
  }
  if (t === 'suicide') {
    // pulsing red core
    c.drawCircle(e.x, e.y, r * 0.5, setFill(C.danger, 0.5 + Math.sin(clock * 10) * 0.4));
  }
  if (e.boss) {
    // crown of spikes
    for (let i = 0; i < 5; i++) {
      const a = e.facing - 0.8 + (i / 4) * 1.6;
      const spike = Skia.Path.Make();
      spike.moveTo(hX + Math.cos(a) * r * 0.5, hY + Math.sin(a) * r * 0.5);
      spike.lineTo(hX + Math.cos(a) * r * 1.1, hY + Math.sin(a) * r * 1.1);
      spike.lineTo(hX + Math.cos(a + 0.18) * r * 0.5, hY + Math.sin(a + 0.18) * r * 0.5);
      spike.close();
      c.drawPath(spike, setFill(C.danger));
    }
  }

  if (poisoned) c.drawCircle(e.x, e.y, r + 3, setFill(C.grassLight, 0.2));
  if (burning) {
    for (let i = 0; i < 3; i++) {
      const fa = clock * 6 + i * 2;
      c.drawCircle(e.x + Math.cos(fa) * r * 0.5, e.y - r - Math.abs(Math.sin(fa)) * r * 0.6, r * 0.2, setFill(C.fireLight, 0.8));
    }
  }
}

export function drawBuilding(c: SkCanvas, type: BuildingType, level: number, x: number, y: number, w: number, h: number, clock: number): void {
  if (type !== 'wall' && type !== 'gate' && type !== 'electricFence' && type !== 'shelter') {
    drawShadow(c, x + w / 2, y + h - 6, w * 0.34, Math.max(5, h * 0.08));
  }
  if (type === 'wall' || type === 'gate') {
    drawWallBlock(c, x, y, w, h, level, type === 'gate');
    return;
  }
  if (type === 'electricFence') {
    drawFence(c, x, y, w, h, clock);
    return;
  }
  if (type === 'tower' || type === 'sniperNest' || type === 'mortar') {
    drawDefense(c, type, x, y, w, h, level, clock);
    return;
  }
  if (type === 'shelter') {
    drawCampfire(c, x + w / 2, y + h * 0.6, Math.min(w, h) * 0.16, level, clock);
    return;
  }
  drawFacility(c, type, x, y, w, h, level, clock);
}

/**
 * The survivor camp that replaces the old "house" shelter. A ring of stones, a
 * stack of crossed logs and a living flame. Higher levels add a lean-to tent and
 * a taller, brighter fire — so it still reads as "the heart of the base" whose
 * death ends the run, but fits the wilderness-survival setting.
 */
function drawCampfire(c: SkCanvas, cx: number, cy: number, r: number, level: number, clock: number): void {
  c.drawOval(Skia.XYWHRect(cx - r * 1.85, cy - r * 0.88, r * 3.7, r * 1.85), setFill(A.shadowSoft, 0.35));

  c.drawOval(Skia.XYWHRect(cx - r * 2.15, cy - r * 1.05, r * 4.3, r * 2.25), setFill(C.dirtDark, 0.24));
  c.drawOval(Skia.XYWHRect(cx - r * 1.9, cy - r * 0.92, r * 3.8, r * 1.92), setFill(C.path, 0.68));
  c.save();
  c.translate(cx - r * 1.35, cy + r * 0.82);
  c.rotate(-12, 0, 0);
  outlinedRect(c, -r * 0.72, -r * 0.13, r * 1.44, r * 0.26, C.woodSide);
  c.restore();
  c.save();
  c.translate(cx + r * 1.36, cy + r * 0.72);
  c.rotate(12, 0, 0);
  outlinedRect(c, -r * 0.72, -r * 0.13, r * 1.44, r * 0.26, C.woodSide);
  c.restore();
  outlinedRect(c, cx + r * 1.1, cy - r * 0.88, r * 0.74, r * 0.34, level >= 3 ? C.cloth : C.metalSide);

  // lean-to tent appears from level 2 (behind the fire)
  if (level >= 2) {
    const tx = cx - r * 2.1;
    const ty = cy - r * 1.0;
    const tent = Skia.Path.Make();
    tent.moveTo(tx, ty + r * 0.9);
    tent.lineTo(tx + r * 0.7, ty - r * 0.5);
    tent.lineTo(tx + r * 1.4, ty + r * 0.9);
    tent.close();
    c.drawPath(tent, setFill(level >= 4 ? C.cloth : C.woodSide));
    c.drawPath(tent, setStroke(OUTLINE.color, OUTLINE.width));
  }

  // ring of stones
  const stones = 9;
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2;
    const sx = cx + Math.cos(a) * r;
    const sy = cy + Math.sin(a) * r * 0.55;
    outlinedCircle(c, sx, sy, r * 0.2, i % 2 ? C.stone : C.stoneTop);
  }

  // crossed logs
  for (const ang of [-0.5, 0.5]) {
    c.save();
    c.translate(cx, cy);
    c.rotate(deg(ang), 0, 0);
    outlinedRect(c, -r * 0.75, -r * 0.16, r * 1.5, r * 0.3, C.wood);
    rect(c, -r * 0.75, -r * 0.05, r * 1.5, r * 0.1, C.woodDark);
    c.restore();
  }

  // flame — layered, flickering with the clock
  const flick = 0.82 + Math.sin(clock * 9) * 0.12 + Math.sin(clock * 21) * 0.06;
  const fh = r * (1.04 + level * 0.05) * flick;
  for (const [col, scale] of [
    [C.fire, 1],
    [C.fireLight, 0.62],
    [C.window, 0.32],
  ] as const) {
    const flame = Skia.Path.Make();
    const fw = r * 0.66 * scale;
    flame.moveTo(cx, cy - fh * scale);
    flame.cubicTo(cx + fw, cy - fh * scale * 0.4, cx + fw * 0.7, cy + r * 0.1, cx, cy + r * 0.1);
    flame.cubicTo(cx - fw * 0.7, cy + r * 0.1, cx - fw, cy - fh * scale * 0.4, cx, cy - fh * scale);
    flame.close();
    c.drawPath(flame, setFill(col));
  }

  // rising embers
  for (let i = 0; i < 5; i++) {
    const t = (clock * 0.8 + i * 0.2) % 1;
    const ex = cx + Math.sin((i + clock) * 3) * r * 0.4;
    const ey = cy - fh * 0.45 - t * r * 1.15;
    c.drawCircle(ex, ey, (1 - t) * 1.45 + 0.35, setFill(C.fireLight, 1 - t));
  }
}

function drawWallBlock(c: SkCanvas, x: number, y: number, w: number, h: number, level: number, gate: boolean): void {
  const stone = level >= 4;
  const front = stone ? C.stone : C.wood;
  const top = stone ? C.stoneTop : C.woodTop;
  const side = stone ? C.stoneSide : C.woodSide;
  const bx = x + w * 0.08;
  const by = y + h * 0.42;
  const bw = w * 0.84;
  const bh = h * 0.42;
  drawShadow(c, x + w / 2, y + h * 0.84, w * 0.34, h * 0.08);
  prism(c, bx, by, bw, bh, front, top, side);
  for (let i = 0; i < 3; i++) rect(c, bx + 5 + i * bw * 0.3, by + bh * 0.38, bw * 0.18, 2, stone ? C.stoneSide : C.woodDark, 0.75);
  if (gate) {
    outlinedRect(c, x + w * 0.38, y + h * 0.44, w * 0.24, h * 0.36, C.woodDark);
    c.drawCircle(x + w * 0.57, y + h * 0.62, 2.2, setFill(C.resource));
  }
}

function drawDefense(c: SkCanvas, type: BuildingType, x: number, y: number, w: number, h: number, level: number, clock: number): void {
  const stone = level >= 4;
  const front = stone ? C.stone : C.wood;
  prism(c, x + w * 0.17, y + h * 0.25, w * 0.66, h * 0.58, front, stone ? C.stoneTop : C.woodTop, stone ? C.stoneSide : C.woodSide);
  drawBlockTexture(c, x + w * 0.2, y + h * 0.4, w * 0.48, h * 0.34, stone ? C.stoneSide : C.woodDark, 0.45);
  rect(c, x + w * 0.23, y + h * 0.48, w * 0.48, h * 0.07, stone ? C.stoneSide : C.woodDark, 0.55);
  if (type !== 'mortar') {
    for (let i = 0; i < 3; i++) outlinedRect(c, x + w * (0.21 + i * 0.2), y + h * 0.16, w * 0.12, h * 0.13, stone ? C.stoneTop : C.woodTop);
  }
  c.save();
  c.translate(x + w / 2, y + h * 0.34);
  c.rotate(deg(type === 'mortar' ? -Math.PI / 2.6 : clock * 0.6), 0, 0);
  outlinedRect(c, -w * 0.04, -h * 0.035, type === 'sniperNest' ? w * 0.52 : w * 0.36, h * 0.07, C.metal);
  if (type === 'sniperNest') c.drawCircle(w * 0.12, -h * 0.045, h * 0.035, setFill(C.electric));
  c.restore();
}

function drawFence(c: SkCanvas, x: number, y: number, w: number, h: number, clock: number): void {
  drawShadow(c, x + w / 2, y + h * 0.82, w * 0.32, h * 0.07);
  outlinedRect(c, x + w * 0.24, y + h * 0.28, w * 0.12, h * 0.52, C.metalSide);
  outlinedRect(c, x + w * 0.64, y + h * 0.28, w * 0.12, h * 0.52, C.metalSide);
  for (let i = 0; i < 3; i++) {
    const yy = y + h * (0.36 + i * 0.14);
    c.drawLine(x + w * 0.36, yy, x + w * 0.64, yy - Math.sin(clock * 8 + i) * 3, setStroke(C.electric, 2.2, 0.85));
  }
}

function drawFacility(c: SkCanvas, type: BuildingType, x: number, y: number, w: number, h: number, level: number, clock: number): void {
  const front = type === 'barracks' ? C.cloth : type === 'storage' ? C.wood : type === 'workshop' ? C.stone : type === 'fuelDepot' || type === 'generator' ? C.metalSide : type === 'trainingGround' || type === 'garden' ? C.path : type === 'researchCenter' || type === 'medbay' ? C.offWhite : C.wood;
  const top = type === 'workshop' ? C.stoneTop : type === 'generator' || type === 'fuelDepot' ? C.metalTop : type === 'researchCenter' || type === 'medbay' ? C.white : C.woodTop;
  const side = type === 'barracks' ? C.clothDark : type === 'workshop' ? C.stoneSide : type === 'generator' || type === 'fuelDepot' ? C.metal : type === 'researchCenter' || type === 'medbay' ? C.stoneSide : C.woodSide;
  const bx = x + w * 0.12;
  const by = y + h * 0.32;
  const bw = w * 0.76;
  const bh = h * 0.58;
  prism(c, bx, by, bw, bh, front, top, side);
  drawBlockTexture(c, bx + bw * 0.08, by + bh * 0.28, bw * 0.68, bh * 0.58, side, type === 'barracks' ? 0.35 : 0.28);
  rect(c, bx + bw * 0.15, by + bh * 0.55, bw * 0.7, 2, side, 0.45);

  if (type === 'barracks' || type === 'storage' || type === 'researchCenter' || type === 'medbay') roof(c, x + w * 0.1, y + h * 0.19, w * 0.8, h * 0.23);
  if (type === 'barracks') {
    outlinedRect(c, x + w * 0.42, y + h * 0.6, w * 0.16, h * 0.28, C.woodDark);
    outlinedRect(c, x + w * 0.22, y + h * 0.47, w * 0.16, h * 0.1, C.window);
    outlinedRect(c, x + w * 0.62, y + h * 0.47, w * 0.16, h * 0.1, C.window);
    flag(c, x + w * 0.72, y + h * 0.16);
  } else if (type === 'trainingGround') {
    for (let i = 0; i < 3; i++) {
      const px = x + w * (0.26 + i * 0.22);
      outlinedRect(c, px, y + h * 0.48, w * 0.05, h * 0.26, C.woodSide);
      outlinedCircle(c, px + w * 0.025, y + h * 0.43, w * 0.065, i === 1 ? C.danger : C.woodTop);
    }
  } else if (type === 'storage') {
    for (let i = 0; i < 3; i++) outlinedRect(c, x + w * (0.2 + i * 0.2), y + h * 0.63, w * 0.15, h * 0.14, i < level / 2 ? C.woodTop : C.woodSide);
  } else if (type === 'workshop') {
    outlinedRect(c, x + w * 0.68, y + h * 0.1, w * 0.13, h * 0.28, C.metal);
    c.drawCircle(x + w * 0.36, y + h * 0.72, w * 0.085, setFill(clock % 1 > 0.5 ? C.fireLight : C.fire));
    outlinedRect(c, x + w * 0.22, y + h * 0.66, w * 0.2, h * 0.08, C.metalSide);
  } else if (type === 'fuelDepot') {
    outlinedRect(c, x + w * 0.25, y + h * 0.42, w * 0.5, h * 0.34, C.danger);
    outlinedRect(c, x + w * 0.67, y + h * 0.5, w * 0.14, h * 0.08, C.metal);
  } else if (type === 'garden') {
    for (let i = 0; i < 4; i++) {
      const gx = x + w * (0.22 + i * 0.15);
      c.drawLine(gx, y + h * 0.74, gx, y + h * 0.52, setStroke(C.grassDark, 2.2));
      c.drawCircle(gx - 3, y + h * 0.53, 4, setFill(C.grass));
      c.drawCircle(gx + 3, y + h * 0.56, 4, setFill(C.grassLight));
    }
  } else if (type === 'generator') {
    const bolt = Skia.Path.Make();
    bolt.moveTo(x + w * 0.54, y + h * 0.38);
    bolt.lineTo(x + w * 0.37, y + h * 0.62);
    bolt.lineTo(x + w * 0.5, y + h * 0.62);
    bolt.lineTo(x + w * 0.42, y + h * 0.82);
    bolt.lineTo(x + w * 0.66, y + h * 0.53);
    bolt.lineTo(x + w * 0.52, y + h * 0.53);
    bolt.close();
    c.drawPath(bolt, setFill(C.window));
    c.drawPath(bolt, setStroke(OUTLINE.color, OUTLINE.thin));
  } else if (type === 'researchCenter') {
    window(c, x + w * 0.42, y + h * 0.52, clock);
  } else if (type === 'medbay') {
    rect(c, x + w * 0.46, y + h * 0.5, w * 0.08, h * 0.28, C.danger);
    rect(c, x + w * 0.35, y + h * 0.6, w * 0.3, h * 0.08, C.danger);
  }
}

function drawBlockTexture(c: SkCanvas, x: number, y: number, w: number, h: number, color: string, alpha: number): void {
  const rows = 3;
  for (let i = 1; i < rows; i++) {
    const yy = y + (h / rows) * i;
    c.drawLine(x, yy, x + w, yy, setStroke(color, 1, alpha));
  }
  const cols = 3;
  for (let i = 0; i < cols; i++) {
    const xx = x + (w / cols) * i + (i % 2 ? w / cols / 2 : 0);
    c.drawLine(xx, y + 2, xx, y + h - 2, setStroke(color, 1, alpha * 0.75));
  }
}

function prism(c: SkCanvas, x: number, y: number, w: number, h: number, front: string, top: string, side: string): void {
  const lift = Math.min(12, h * 0.24);
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
  c.drawPath(topPath, setFill(top));
  c.drawPath(sidePath, setFill(side));
  rect(c, x, y + lift, w - lift, h - lift, front);
  c.drawPath(topPath, setStroke(OUTLINE.color, OUTLINE.width));
  c.drawPath(sidePath, setStroke(OUTLINE.color, OUTLINE.width));
  c.drawRect(Skia.XYWHRect(x, y + lift, w - lift, h - lift), setStroke(OUTLINE.color, OUTLINE.width));
}

function roof(c: SkCanvas, x: number, y: number, w: number, h: number): void {
  const path = Skia.Path.Make();
  path.moveTo(x, y + h);
  path.lineTo(x + w / 2, y);
  path.lineTo(x + w, y + h);
  path.close();
  c.drawPath(path, setFill(C.roofTop));
  c.drawPath(path, setStroke(OUTLINE.color, OUTLINE.width));
}

function window(c: SkCanvas, x: number, y: number, clock: number): void {
  c.drawCircle(x + 5, y + 5, 11, setFill(A.highlight));
  outlinedRect(c, x, y, 10, 10, clock % 1 > 0.5 ? C.window : C.fireLight);
}

function flag(c: SkCanvas, x: number, y: number): void {
  c.drawLine(x, y, x, y + 18, setStroke(C.woodDark, OUTLINE.width));
  const path = Skia.Path.Make();
  path.moveTo(x, y);
  path.lineTo(x + 16, y + 6);
  path.lineTo(x, y + 12);
  path.close();
  c.drawPath(path, setFill(C.danger));
  c.drawPath(path, setStroke(OUTLINE.color, OUTLINE.thin));
}
