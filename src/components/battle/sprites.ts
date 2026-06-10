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

export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function drawTile(c: SkCanvas, col: number, row: number, size: number, built: boolean): void {
  const x = col * size;
  const y = row * size;
  const n = hash2(col + 1, row + 1);
  // organic meadow: one uniform base with soft, sparse patches instead of the
  // old high-contrast checkerboard (which read as a chessboard from the air)
  const base = built ? (n > 0.5 ? C.path : C.dirtLight) : C.grass;
  rect(c, x, y, size, size, base);
  if (built) {
    rect(c, x + 4, y + 4, size - 8, size - 8, C.pathDark, 0.12);
    c.drawRect(Skia.XYWHRect(x, y, size, size), setStroke(A.grid, 1));
  } else if (n > 0.86) {
    rect(c, x, y, size, size, C.grassLight, 0.35);
  } else if (n < 0.14) {
    rect(c, x, y, size, size, C.grassDark, 0.3);
  }
  for (let i = 0; i < 3; i++) {
    const px = x + 7 + Math.floor(hash2(col * 7 + i, row * 3) * (size - 14) / 3) * 3;
    const py = y + 7 + Math.floor(hash2(col * 3, row * 7 + i) * (size - 14) / 3) * 3;
    if (built) {
      c.drawCircle(px + 1.5, py + 1.5, 1.6, setFill(i % 2 ? C.dirtDark : C.dirt, 0.45));
    } else {
      const d = hash2(col * 13 + i, row * 11);
      if (d > 0.55) {
        // soft round grass tufts: two leaning blades read as a tuft, not a pixel
        const tuft = d > 0.9 ? C.grassLight : i % 2 ? C.grassShade : C.grassDark;
        c.drawLine(px, py + 3, px - 1.2, py - 1.5, setStroke(tuft, 1.6, 0.55));
        c.drawLine(px + 2, py + 3, px + 3.4, py - 1, setStroke(tuft, 1.6, 0.45));
      } else if (d < 0.04) {
        // tiny cartoon flower: petals + warm core
        const fc = d < 0.02 ? '#e8d56a' : '#d9e9f2';
        for (const [ox, oy] of [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6]] as const) {
          c.drawCircle(px + 1.5 + ox, py + 1.5 + oy, 1.3, setFill(fc, 0.9));
        }
        c.drawCircle(px + 1.5, py + 1.5, 1, setFill('#e8a23c', 0.95));
      }
    }
  }
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
  /** Small color accent (beanie band / armband) that makes the silhouette pop. */
  accent: string;
}

const PLAYER_STYLE: CharStyle = {
  jacket: C.cloth,
  jacketDark: C.clothDark,
  pants: C.metalSide,
  skin: C.skin,
  hair: C.hair,
  accent: C.accent,
};

const SOLDIER_STYLE: CharStyle = {
  jacket: C.stoneSide,
  jacketDark: C.metalSide,
  pants: C.metal,
  skin: C.skin,
  hair: C.hair,
  accent: C.danger,
};

function rrect(c: SkCanvas, x: number, y: number, w: number, h: number, r: number, color: string): void {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), setFill(color));
}

function outlinedRRect(c: SkCanvas, x: number, y: number, w: number, h: number, r: number, color: string): void {
  rrect(c, x, y, w, h, r + OUTLINE.width, OUTLINE.color);
  rrect(c, x + OUTLINE.width, y + OUTLINE.width, w - OUTLINE.width * 2, h - OUTLINE.width * 2, r, color);
}

/**
 * Cartoon chibi survivor (The Escapists 2 vibe): oversized head, big readable
 * eyes that track the facing direction, stubby swinging arms/legs and
 * squash-and-stretch on the walk bounce. `phase` is the walk cycle in cycles
 * (continuous, distance-driven), `clock` drives idle breathing and blinking.
 */
function drawHumanoid(
  c: SkCanvas,
  x: number,
  y: number,
  facing: number,
  phase: number,
  moving: boolean,
  clock: number,
  style: CharStyle,
  scale: number,
  flash = 0,
): void {
  const u = scale;
  const ax = Math.cos(facing);
  const ay = Math.sin(facing);
  const stride = moving ? Math.sin(phase * Math.PI * 2) : 0;
  // double-frequency bounce: the body hops once per step (cartoon run feel)
  const bob = moving ? -Math.abs(Math.sin(phase * Math.PI * 2)) * 2.2 * u : Math.sin(clock * 2.4) * 0.7 * u;
  const squash = moving ? 1 + Math.sin(phase * Math.PI * 4) * 0.045 : 1 + Math.sin(clock * 2.4) * 0.02;

  drawShadow(c, x, y + 10 * u, (10.5 - (moving ? Math.abs(stride) * 1.5 : 0)) * u, 4.4 * u);

  // legs — stubby, striding along screen-y with a lift on the swing leg
  const lift = moving ? Math.max(0, Math.cos(phase * Math.PI * 2)) * 1.6 * u : 0;
  const lift2 = moving ? Math.max(0, -Math.cos(phase * Math.PI * 2)) * 1.6 * u : 0;
  outlinedRRect(c, x - 4.6 * u, y + 3.4 * u + stride * 2.6 * u - lift, 4 * u, (7.4 * u - lift) as number, 1.8 * u, style.pants);
  outlinedRRect(c, x + 0.6 * u, y + 3.4 * u - stride * 2.6 * u - lift2, 4 * u, (7.4 * u - lift2) as number, 1.8 * u, style.pants);

  // torso — rounded jacket with belt + zipper, squashing with the bounce
  const bw = 13 * u;
  const bh = 11.5 * u * squash;
  const by = y + 6.5 * u - bh + bob;
  outlinedRRect(c, x - bw / 2, by, bw, bh, 3.4 * u, style.jacket);
  rrect(c, x - bw / 2 + OUTLINE.width, by + bh * 0.62, bw - OUTLINE.width * 2, bh * 0.16, 1.2 * u, style.jacketDark);
  c.drawLine(x, by + 2 * u, x, by + bh * 0.6, setStroke(style.jacketDark, 1.4 * u, 0.8));

  // arms — capsules swinging counter to the legs, hands as skin dots
  const armSwing = moving ? stride * 0.7 : Math.sin(clock * 2.4) * 0.07;
  for (const side of [-1, 1] as const) {
    c.save();
    c.translate(x + side * 6.6 * u, by + 3 * u);
    c.rotate(deg(armSwing * side), 0, 0);
    outlinedRRect(c, -1.8 * u, -1 * u, 3.6 * u, 8.2 * u, 1.8 * u, style.jacketDark);
    c.drawCircle(0, 6.6 * u, 1.7 * u, setFill(style.skin));
    c.restore();
  }

  // head — oversized, slightly squircle, with hair cap + fringe
  const hr = 8 * u;
  const hy = y - 9.5 * u + bob * 1.15;
  outlinedRRect(c, x - hr, hy - hr, hr * 2, hr * 2, hr * 0.62, style.skin);
  const facingAway = ay < -0.65;
  // hair: cap over the crown; covers most of the head when facing away
  const hairH = facingAway ? hr * 1.5 : hr * 0.95;
  rrect(c, x - hr + OUTLINE.width, hy - hr + OUTLINE.width, hr * 2 - OUTLINE.width * 2, hairH, hr * 0.6, style.hair);
  if (!facingAway) {
    // fringe notches + accent band keep the face lively
    for (const fx of [-0.55, 0, 0.55]) {
      c.drawCircle(x + fx * hr, hy - hr + hairH, 1.5 * u, setFill(style.hair));
    }
    rect(c, x - hr + OUTLINE.width, hy - hr + hairH - 1.4 * u, hr * 2 - OUTLINE.width * 2, 1.4 * u, style.accent, 0.9);

    // eyes: white sclera, pupils tracking the facing, periodic blink
    const blinkT = (clock * 0.31 + 0.15) % 1;
    const blink = blinkT < 0.045 ? Math.max(0.12, Math.abs(Math.sin((blinkT / 0.045) * Math.PI))) : 1;
    const ey = hy + 1.6 * u + ay * 1.4 * u;
    for (const side of [-1, 1] as const) {
      const ex = x + side * 3.1 * u + ax * 1.5 * u;
      c.drawOval(Skia.XYWHRect(ex - 2 * u, ey - 2.5 * u * blink, 4 * u, 5 * u * blink), setFill(C.white));
      if (blink > 0.3) {
        c.drawCircle(ex + ax * 0.9 * u, ey + ay * 0.9 * u, 1.25 * u, setFill(OUTLINE.color));
        c.drawCircle(ex + ax * 0.9 * u - 0.4 * u, ey + ay * 0.9 * u - 0.5 * u, 0.4 * u, setFill(C.white));
      }
    }
    // small mouth — open when running (panting), neutral when idle
    if (moving) {
      c.drawOval(Skia.XYWHRect(x + ax * 1.6 * u - 1.3 * u, hy + 5 * u - 0.9 * u, 2.6 * u, 2.2 * u), setFill(OUTLINE.color, 0.85));
    } else {
      c.drawLine(x + ax * 1.6 * u - 1.4 * u, hy + 5.2 * u, x + ax * 1.6 * u + 1.4 * u, hy + 5.2 * u, setStroke(OUTLINE.color, 1 * u, 0.8));
    }
    // rosy cheeks
    for (const side of [-1, 1] as const) {
      c.drawCircle(x + side * 5 * u + ax * u, hy + 3.4 * u, 1.2 * u, setFill(C.danger, 0.16));
    }
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
  phase?: number, // distance-driven walk cycle; falls back to clock cadence
): void {
  drawHumanoid(c, x, y, facing, phase ?? clock * 2.2, moving, clock, PLAYER_STYLE, 1.55, flash);
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
  drawHumanoid(c, x, y, facing, clock * 2.4 + x * 0.13, moving, clock + x * 0.7, SOLDIER_STYLE, 0.82);
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
  const th = big ? 8 : long ? 5 : 4.5;
  // chunky cartoon gun: rounded barrel with a fat muzzle, wooden stock + grip
  outlinedRRect(c, 6 - recoil * 3, -th / 2, len, th, th * 0.45, C.metal);
  rrect(c, 7 - recoil * 3, -th / 2 + 1, len - 3, th * 0.32, th * 0.3, C.metalTop);
  outlinedRRect(c, 6 + len - 3 - recoil * 3, -th / 2 - 0.8, 4, th + 1.6, 1.6, C.metalSide);
  outlinedRRect(c, 1 - recoil * 3, -2.2, 8, 5.4, 2, C.woodSide);
  outlinedRRect(c, 9 - recoil * 3, th * 0.3, 3.4, 5, 1.4, C.woodDark);
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
  const phase = clock * (3 + speed * 0.05) + e.x * 0.1;
  const stride = Math.sin(phase) * (t === 'runner' ? 5 : 3);
  const bob = -Math.abs(Math.sin(phase)) * r * 0.12;
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

  // stubby rounded legs shuffling along
  outlinedRRect(c, e.x + px * r * 0.34 - r * 0.18 - ax * 2 + stride * 0.1, e.y + py * r * 0.34 + r * 0.3 + stride, r * 0.36, r * 0.62, r * 0.18, skinDark);
  outlinedRRect(c, e.x - px * r * 0.34 - r * 0.18 - ax * 2 - stride * 0.1, e.y - py * r * 0.34 + r * 0.3 - stride, r * 0.36, r * 0.62, r * 0.18, skinDark);

  // torso — tattered rounded shirt with a ragged hem
  outlinedRRect(c, e.x - r * 0.78, e.y - r * 0.62 + bob, r * 1.56, r * 1.26, r * 0.5, skin);
  rrect(c, e.x - r * 0.78 + OUTLINE.width, e.y + r * 0.3 + bob, r * 1.56 - OUTLINE.width * 2, r * 0.26, r * 0.12, skinDark);
  if (t === 'armored' || t === 'tank') {
    // rounded armor plate with rivets
    outlinedRRect(c, e.x - r * 0.6, e.y - r * 0.34 + bob, r * 1.2, r * 0.74, r * 0.2, C.metalSide);
    c.drawCircle(e.x - r * 0.4, e.y - r * 0.14 + bob, r * 0.07, setFill(C.metalTop));
    c.drawCircle(e.x + r * 0.4, e.y - r * 0.14 + bob, r * 0.07, setFill(C.metalTop));
  }

  // arms reaching toward the target — rounded capsules with grabby hands
  const reach = t === 'runner' ? 1.15 : 0.95;
  for (const s of [1, -1]) {
    const grab = Math.sin(phase * 2 + s) * r * 0.08;
    const sx = e.x + px * s * r * 0.5;
    const sy = e.y + py * s * r * 0.5 + bob;
    const hx = e.x + ax * r * reach + px * s * r * 0.5 + grab;
    const hy = e.y + ay * r * reach + py * s * r * 0.5 + bob;
    c.drawLine(sx, sy, hx, hy, setStroke(OUTLINE.color, r * (big ? 0.46 : 0.36)));
    c.drawLine(sx, sy, hx, hy, setStroke(skinDark, r * (big ? 0.36 : 0.26)));
    outlinedCircle(c, hx, hy, r * 0.24, skin); // hand
  }

  // oversized chibi head with a cartoon zombie face
  const hr = r * 0.78;
  const hX = e.x + ax * r * 0.35;
  const hY = e.y + ay * r * 0.35 - r * 0.72 + bob;
  outlinedRRect(c, hX - hr, hY - hr, hr * 2, hr * 2, hr * 0.62, skin);
  // scruffy hair patches on the crown
  rrect(c, hX - hr + OUTLINE.width, hY - hr + OUTLINE.width, hr * 2 - OUTLINE.width * 2, hr * 0.5, hr * 0.5, skinDark);
  c.drawCircle(hX - hr * 0.45, hY - hr * 0.5, hr * 0.16, setFill(skinDark));
  c.drawCircle(hX + hr * 0.4, hY - hr * 0.55, hr * 0.14, setFill(skinDark));

  // big mismatched cartoon eyes (one wide, one squinting)
  const eyeColor = t === 'screamer' ? C.window : shocked ? C.electric : C.danger;
  const eyL = { x: hX - hr * 0.38 + ax * hr * 0.18, y: hY + hr * 0.05 + ay * hr * 0.15 };
  const eyR = { x: hX + hr * 0.38 + ax * hr * 0.18, y: hY + hr * 0.05 + ay * hr * 0.15 };
  c.drawOval(Skia.XYWHRect(eyL.x - hr * 0.26, eyL.y - hr * 0.3, hr * 0.52, hr * 0.6), setFill(C.white));
  c.drawCircle(eyL.x + ax * hr * 0.08, eyL.y + ay * hr * 0.08, hr * 0.14, setFill(eyeColor));
  c.drawOval(Skia.XYWHRect(eyR.x - hr * 0.2, eyR.y - hr * 0.16, hr * 0.4, hr * 0.32), setFill(C.white));
  c.drawCircle(eyR.x + ax * hr * 0.06, eyR.y + ay * hr * 0.06, hr * 0.11, setFill(eyeColor));

  // crooked mouth with a snaggletooth (gaping maw for screamers)
  const mY = hY + hr * 0.52 + ay * hr * 0.12;
  if (t === 'screamer') {
    c.drawOval(Skia.XYWHRect(hX + ax * hr * 0.2 - hr * 0.26, mY - hr * 0.24, hr * 0.52, hr * 0.5), setFill(OUTLINE.color));
    c.drawCircle(e.x, e.y, r + 3 + Math.sin(clock * 8) * 2, setStroke(C.crit, 1.5, 0.5));
  } else {
    c.drawLine(hX - hr * 0.3, mY, hX + hr * 0.34, mY - hr * 0.12, setStroke(OUTLINE.color, hr * 0.1, 0.9));
    rect(c, hX + hr * 0.05, mY - hr * 0.08, hr * 0.14, hr * 0.18, C.white, 0.95);
  }
  // stitches on the cheek
  c.drawLine(hX - hr * 0.62, hY + hr * 0.3, hX - hr * 0.3, hY + hr * 0.46, setStroke(skinDark, hr * 0.07, 0.9));

  if (t === 'suicide') {
    // pulsing red core
    c.drawCircle(e.x, e.y + bob, r * 0.5, setFill(C.danger, 0.5 + Math.sin(clock * 10) * 0.4));
  }
  if (e.boss) {
    // crown of spikes
    for (let i = 0; i < 5; i++) {
      const a = e.facing - 0.8 + (i / 4) * 1.6;
      const spike = Skia.Path.Make();
      spike.moveTo(hX + Math.cos(a) * hr * 0.7, hY + Math.sin(a) * hr * 0.7);
      spike.lineTo(hX + Math.cos(a) * hr * 1.4, hY + Math.sin(a) * hr * 1.4);
      spike.lineTo(hX + Math.cos(a + 0.18) * hr * 0.7, hY + Math.sin(a + 0.18) * hr * 0.7);
      spike.close();
      c.drawPath(spike, setFill(C.danger));
      c.drawPath(spike, setStroke(OUTLINE.color, OUTLINE.thin));
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
  // soft charred patch under the fire (the tile beneath is already dirt)
  c.drawOval(Skia.XYWHRect(cx - r * 1.5, cy - r * 0.7, r * 3, r * 1.5), setFill(C.dirtDark, 0.3));
  c.drawOval(Skia.XYWHRect(cx - r * 1.1, cy - r * 0.5, r * 2.2, r * 1.05), setFill(A.shadowSoft, 0.3));

  // two cosy sitting logs flanking the fire
  outlinedRRect(c, cx - r * 2.25, cy + r * 0.4, r * 1.05, r * 0.36, r * 0.18, C.woodSide);
  outlinedRRect(c, cx + r * 1.2, cy + r * 0.4, r * 1.05, r * 0.36, r * 0.18, C.woodSide);

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
  drawShadow(c, x + w / 2, y + h * 0.84, w * 0.36, h * 0.08);
  if (stone) {
    // chunky rounded stone rampart with a brick pattern
    outlinedRRect(c, x + w * 0.06, y + h * 0.3, w * 0.88, h * 0.54, w * 0.07, C.stone);
    rrect(c, x + w * 0.06 + OUTLINE.width, y + h * 0.3 + OUTLINE.width, w * 0.88 - OUTLINE.width * 2, h * 0.12, w * 0.06, C.stoneTop);
    for (let r = 0; r < 2; r++) {
      const yy = y + h * (0.48 + r * 0.16);
      c.drawLine(x + w * 0.1, yy, x + w * 0.9, yy, setStroke(C.stoneSide, 1.4, 0.6));
      for (let i = 0; i < 3; i++) {
        c.drawLine(x + w * (0.2 + i * 0.25 + r * 0.12), yy - h * 0.16, x + w * (0.2 + i * 0.25 + r * 0.12), yy, setStroke(C.stoneSide, 1.4, 0.5));
      }
    }
  } else {
    // palisade: a row of round-topped logs lashed together
    const logs = 4;
    const lw = (w * 0.88) / logs;
    for (let i = 0; i < logs; i++) {
      const lx = x + w * 0.06 + i * lw;
      const tall = i % 2 ? h * 0.3 : h * 0.34;
      outlinedRRect(c, lx + 1, y + tall, lw - 2, y + h * 0.84 - (y + tall), lw * 0.42, i % 2 ? C.wood : C.woodSide);
      c.drawOval(Skia.XYWHRect(lx + lw * 0.22, y + tall + 2, lw * 0.55, lw * 0.35), setFill(C.woodTop, 0.9));
    }
    // rope lashing across the logs
    c.drawLine(x + w * 0.06, y + h * 0.52, x + w * 0.94, y + h * 0.5, setStroke(C.resource, 2.2, 0.8));
    c.drawLine(x + w * 0.06, y + h * 0.68, x + w * 0.94, y + h * 0.66, setStroke(C.resource, 2.2, 0.7));
  }
  if (gate) {
    outlinedRRect(c, x + w * 0.34, y + h * 0.4, w * 0.32, h * 0.42, w * 0.1, C.woodDark);
    c.drawLine(x + w * 0.5, y + h * 0.42, x + w * 0.5, y + h * 0.8, setStroke(OUTLINE.color, 1.4, 0.7));
    c.drawCircle(x + w * 0.57, y + h * 0.62, 2.2, setFill(C.resource));
  }
}

function drawDefense(c: SkCanvas, type: BuildingType, x: number, y: number, w: number, h: number, level: number, clock: number): void {
  const stone = level >= 4;
  const front = stone ? C.stone : C.wood;
  const dark = stone ? C.stoneSide : C.woodSide;

  // tapered base — wider at the ground like a real watchtower
  const base = Skia.Path.Make();
  base.moveTo(x + w * 0.14, y + h * 0.86);
  base.lineTo(x + w * 0.24, y + h * 0.3);
  base.lineTo(x + w * 0.76, y + h * 0.3);
  base.lineTo(x + w * 0.86, y + h * 0.86);
  base.close();
  c.drawPath(base, setFill(front));
  c.drawPath(base, setStroke(OUTLINE.color, OUTLINE.width));
  // cross-brace + block courses
  c.drawLine(x + w * 0.24, y + h * 0.32, x + w * 0.82, y + h * 0.82, setStroke(dark, 2, 0.6));
  c.drawLine(x + w * 0.76, y + h * 0.32, x + w * 0.18, y + h * 0.82, setStroke(dark, 2, 0.6));
  c.drawLine(x + w * 0.21, y + h * 0.56, x + w * 0.79, y + h * 0.56, setStroke(dark, 1.4, 0.5));

  // overhanging fighting platform with merlons
  outlinedRect(c, x + w * 0.14, y + h * 0.22, w * 0.72, h * 0.1, dark);
  if (type !== 'mortar') {
    for (let i = 0; i < 4; i++) {
      outlinedRect(c, x + w * (0.15 + i * 0.19), y + h * 0.13, w * 0.11, h * 0.1, stone ? C.stoneTop : C.woodTop);
    }
  } else {
    // sandbag ring for the mortar pit
    for (let i = 0; i < 5; i++) {
      outlinedCircle(c, x + w * (0.2 + i * 0.15), y + h * 0.21, w * 0.055, i % 2 ? C.path : C.dirtLight);
    }
  }

  // armament
  c.save();
  c.translate(x + w / 2, y + h * 0.22);
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

// ---- Cossacks-style facility architecture ----------------------------------
// Real little houses instead of flat boxes: stone foundation, timber-framed
// walls, a big overhanging roof with tile rows, framed glowing windows, doors
// and smoking chimneys. Each facility keeps a signature prop so it stays
// readable at a glance.

interface HouseOpts {
  wall: string;
  wallDark: string;
  roofColor: string;
  /** Timber-frame beams over the walls (fachwerk). */
  beams?: boolean;
  chimney?: boolean;
  windows?: number;
  door?: boolean;
  /** 'gable' = trapezoid roof with a ridge, 'flat' = industrial slab. */
  roofStyle?: 'gable' | 'flat';
}

/** Key vertical lines of the house so props can anchor to them. */
interface HouseFrame {
  eaveY: number;
  wallY: number;
  groundY: number;
  ridgeY: number;
}

function house(c: SkCanvas, x: number, y: number, w: number, h: number, clock: number, o: HouseOpts): HouseFrame {
  const ridgeY = y + h * 0.1;
  const eaveY = y + h * 0.42;
  const groundY = y + h * 0.88;
  const baseY = groundY - h * 0.07;
  const wx = x + w * 0.1;
  const ww = w * 0.8;

  // foundation — rough stone strip
  outlinedRect(c, wx - w * 0.02, baseY, ww + w * 0.04, groundY - baseY, C.stoneSide);
  for (let i = 0; i < 4; i++) {
    rect(c, wx + ww * (0.06 + i * 0.24), baseY + 2, ww * 0.13, groundY - baseY - 4, C.stone, 0.8);
  }

  // walls
  outlinedRect(c, wx, eaveY, ww, baseY - eaveY, o.wall);
  if (o.beams) {
    const bw = Math.max(2, w * 0.022);
    rect(c, wx, eaveY, bw, baseY - eaveY, o.wallDark);
    rect(c, wx + ww - bw, eaveY, bw, baseY - eaveY, o.wallDark);
    rect(c, wx, eaveY, ww, bw, o.wallDark);
    // diagonal braces
    c.drawLine(wx + bw, baseY, wx + ww * 0.3, eaveY + bw, setStroke(o.wallDark, bw, 0.9));
    c.drawLine(wx + ww - bw, baseY, wx + ww * 0.7, eaveY + bw, setStroke(o.wallDark, bw, 0.9));
  } else {
    // plank/board shading
    for (let i = 1; i < 3; i++) {
      c.drawLine(wx + 2, eaveY + ((baseY - eaveY) / 3) * i, wx + ww - 2, eaveY + ((baseY - eaveY) / 3) * i, setStroke(o.wallDark, 1, 0.4));
    }
  }

  // roof
  if (o.roofStyle === 'flat') {
    outlinedRect(c, x + w * 0.06, eaveY - h * 0.1, w * 0.88, h * 0.12, o.roofColor);
    rect(c, x + w * 0.06, eaveY - h * 0.1, w * 0.88, h * 0.035, C.metalTop, 0.7);
  } else {
    const rl = x + w * 0.04;
    const rr = x + w * 0.96;
    const roofPath = Skia.Path.Make();
    roofPath.moveTo(rl, eaveY + 1);
    roofPath.lineTo(x + w * 0.26, ridgeY);
    roofPath.lineTo(x + w * 0.74, ridgeY);
    roofPath.lineTo(rr, eaveY + 1);
    roofPath.close();
    c.drawPath(roofPath, setFill(o.roofColor));
    // tile rows following the eave
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      const yy = eaveY + (ridgeY - eaveY) * t;
      const inset = w * 0.22 * t;
      c.drawLine(rl + inset, yy, rr - inset, yy, setStroke(C.roofSide, 1.3, 0.55));
    }
    // ridge highlight + outline
    c.drawLine(x + w * 0.26, ridgeY, x + w * 0.74, ridgeY, setStroke(C.roofTop, 2.4, 0.9));
    c.drawPath(roofPath, setStroke(OUTLINE.color, OUTLINE.width));
    // eave shadow on the wall
    rect(c, wx, eaveY, ww, h * 0.045, OUTLINE.color, 0.25);
  }

  // chimney + drifting smoke
  if (o.chimney) {
    const cx = x + w * 0.7;
    const cy = ridgeY - h * 0.085;
    outlinedRect(c, cx, cy, w * 0.085, h * 0.13, C.stoneSide);
    rect(c, cx - w * 0.008, cy - h * 0.018, w * 0.1, h * 0.025, C.stone);
    for (let i = 0; i < 3; i++) {
      const t = (clock * 0.45 + i * 0.33) % 1;
      const px = cx + w * 0.045 + Math.sin((clock + i * 2) * 1.7) * w * 0.04 * t;
      const py = cy - h * 0.03 - t * h * 0.22;
      c.drawCircle(px, py, (2.2 + t * 3.2) * (w / 96), setFill(C.smoke, 0.34 * (1 - t)));
    }
  }

  // windows — framed, warm glow
  const wins = o.windows ?? 2;
  for (let i = 0; i < wins; i++) {
    const fx = wx + ww * ((i + 1) / (wins + 1)) - w * 0.055;
    const fy = eaveY + (baseY - eaveY) * 0.28;
    outlinedRect(c, fx, fy, w * 0.11, h * 0.13, C.woodDark);
    rect(c, fx + 1.5, fy + 1.5, w * 0.11 - 3, h * 0.13 - 3, C.window, 0.92);
    c.drawLine(fx + w * 0.055, fy + 1, fx + w * 0.055, fy + h * 0.13 - 1, setStroke(C.woodDark, 1.2));
  }

  // door — arched, planked
  if (o.door) {
    const dw = w * 0.13;
    const dh = h * 0.2;
    const dx = wx + ww * 0.5 - dw / 2;
    const dy = baseY - dh;
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(dx, dy, dw, dh + h * 0.02), dw * 0.4, dw * 0.4), setFill(OUTLINE.color));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(dx + 1.5, dy + 1.5, dw - 3, dh + h * 0.02), dw * 0.36, dw * 0.36), setFill(C.woodDark));
    c.drawCircle(dx + dw * 0.75, dy + dh * 0.55, 1.6, setFill(C.resource));
  }

  return { eaveY, wallY: eaveY, groundY: baseY, ridgeY };
}

function drawFacility(c: SkCanvas, type: BuildingType, x: number, y: number, w: number, h: number, level: number, clock: number): void {
  // open-air facilities keep their field look (fenced, with props)
  if (type === 'trainingGround' || type === 'garden') {
    drawYard(c, type, x, y, w, h, level, clock);
    return;
  }

  const opts: HouseOpts =
    type === 'barracks'
      ? { wall: C.wood, wallDark: C.woodDark, roofColor: C.roof, windows: 2, door: true, chimney: true }
      : type === 'storage'
        ? { wall: C.woodTop, wallDark: C.woodSide, roofColor: C.roofTop, windows: 1, door: true }
        : type === 'workshop'
          ? { wall: C.stone, wallDark: C.stoneSide, roofColor: C.roofSide, windows: 1, door: true, chimney: true }
          : type === 'generator' || type === 'fuelDepot'
            ? { wall: C.metalSide, wallDark: C.metal, roofColor: C.metalTop, windows: 1, roofStyle: 'flat' }
            : { wall: C.offWhite, wallDark: C.woodDark, roofColor: C.roof, beams: true, windows: 2, door: true, chimney: type === 'researchCenter' };

  const f = house(c, x, y, w, h, clock, opts);

  // signature props per facility
  if (type === 'barracks') {
    flag(c, x + w * 0.85, y + h * 0.04);
    outlinedRect(c, x + w * 0.13, f.groundY - h * 0.1, w * 0.16, h * 0.1, C.clothDark); // bedroll outside
  } else if (type === 'storage') {
    for (let i = 0; i < 3; i++) {
      outlinedRect(c, x + w * (0.06 + i * 0.11), f.groundY - h * (0.09 + (i % 2) * 0.03), w * 0.1, h * 0.1, i < level / 2 ? C.woodTop : C.woodSide);
    }
  } else if (type === 'workshop') {
    // forge glow + anvil by the door
    const gl = 0.6 + Math.sin(clock * 6) * 0.25;
    c.drawCircle(x + w * 0.22, f.groundY - h * 0.06, w * 0.07, setFill(C.fire, gl));
    c.drawCircle(x + w * 0.22, f.groundY - h * 0.06, w * 0.035, setFill(C.fireLight, gl));
    outlinedRect(c, x + w * 0.74, f.groundY - h * 0.07, w * 0.15, h * 0.045, C.metal);
    outlinedRect(c, x + w * 0.78, f.groundY - h * 0.03, w * 0.07, h * 0.03, C.metalSide);
  } else if (type === 'fuelDepot') {
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + w * 0.6, f.wallY + h * 0.06, w * 0.3, h * 0.3), w * 0.05, w * 0.05), setFill(OUTLINE.color));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + w * 0.612, f.wallY + h * 0.072, w * 0.276, h * 0.276), w * 0.045, w * 0.045), setFill(C.danger));
    rect(c, x + w * 0.63, f.wallY + h * 0.1, w * 0.23, h * 0.05, C.fireLight, 0.35);
  } else if (type === 'generator') {
    const bolt = Skia.Path.Make();
    bolt.moveTo(x + w * 0.5, f.wallY + h * 0.04);
    bolt.lineTo(x + w * 0.38, f.wallY + h * 0.22);
    bolt.lineTo(x + w * 0.47, f.wallY + h * 0.22);
    bolt.lineTo(x + w * 0.41, f.wallY + h * 0.37);
    bolt.lineTo(x + w * 0.58, f.wallY + h * 0.16);
    bolt.lineTo(x + w * 0.48, f.wallY + h * 0.16);
    bolt.close();
    c.drawPath(bolt, setFill(C.window));
    c.drawPath(bolt, setStroke(OUTLINE.color, OUTLINE.thin));
    // antenna with blinking light
    c.drawLine(x + w * 0.82, f.eaveY - h * 0.1, x + w * 0.82, f.eaveY - h * 0.3, setStroke(C.metal, 2));
    c.drawCircle(x + w * 0.82, f.eaveY - h * 0.3, 2.4, setFill(clock % 1.2 > 0.6 ? C.danger : C.metalSide));
  } else if (type === 'researchCenter') {
    window(c, x + w * 0.44, y + h * 0.2, clock);
  } else if (type === 'medbay') {
    rect(c, x + w * 0.455, y + h * 0.16, w * 0.09, h * 0.2, C.danger);
    rect(c, x + w * 0.38, y + h * 0.225, w * 0.24, h * 0.07, C.danger);
  }
}

/** Open-air yards (garden / training ground): fenced plot with props. */
function drawYard(c: SkCanvas, type: BuildingType, x: number, y: number, w: number, h: number, level: number, clock: number): void {
  const gx = x + w * 0.08;
  const gy = y + h * 0.3;
  const gw = w * 0.84;
  const gh = h * 0.55;
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(gx, gy, gw, gh), w * 0.04, w * 0.04), setFill(type === 'garden' ? C.dirt : C.path, 0.9));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(gx, gy, gw, gh), w * 0.04, w * 0.04), setStroke(OUTLINE.color, OUTLINE.thin, 0.6));
  // fence posts with rails
  const posts = 5;
  for (let i = 0; i <= posts; i++) {
    const px = gx + (gw / posts) * i;
    outlinedRect(c, px - 1.5, gy - h * 0.06, 3.5, h * 0.09, C.woodSide);
  }
  c.drawLine(gx, gy - h * 0.025, gx + gw, gy - h * 0.025, setStroke(C.wood, 2, 0.9));

  if (type === 'garden') {
    // crop rows that sway
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 4; i++) {
        const px = gx + gw * (0.16 + i * 0.23);
        const py = gy + gh * (0.32 + r * 0.42);
        const sway = Math.sin(clock * 1.8 + i + r * 2) * 1.4;
        c.drawLine(px, py, px + sway, py - h * 0.1, setStroke(C.grassDark, 2.2));
        c.drawCircle(px + sway - 3, py - h * 0.1, 3.6, setFill(C.grass));
        c.drawCircle(px + sway + 3, py - h * 0.085, 3.6, setFill(C.grassLight));
        if (level >= 3) c.drawCircle(px + sway, py - h * 0.12, 2, setFill(C.resource));
      }
    }
    // water barrel
    outlinedRect(c, gx + gw * 0.86, gy + gh * 0.55, w * 0.09, h * 0.12, C.woodSide);
    rect(c, gx + gw * 0.875, gy + gh * 0.57, w * 0.06, h * 0.02, C.electric, 0.8);
  } else {
    // training dummies + target
    for (let i = 0; i < 3; i++) {
      const px = gx + gw * (0.2 + i * 0.3);
      const py = gy + gh * 0.65;
      outlinedRect(c, px - 2, py - h * 0.18, 4.5, h * 0.18, C.woodSide);
      outlinedCircle(c, px, py - h * 0.21, w * 0.05, i === 1 ? C.danger : C.woodTop);
      if (i === 1) {
        c.drawCircle(px, py - h * 0.21, w * 0.025, setFill(C.offWhite));
        c.drawCircle(px, py - h * 0.21, w * 0.01, setFill(C.danger));
      }
    }
    // weapon rack
    outlinedRect(c, gx + gw * 0.04, gy + gh * 0.3, w * 0.14, h * 0.05, C.wood);
    c.drawLine(gx + gw * 0.07, gy + gh * 0.32, gx + gw * 0.07 + w * 0.06, gy + gh * 0.16, setStroke(C.metal, 2));
    c.drawLine(gx + gw * 0.12, gy + gh * 0.32, gx + gw * 0.12 + w * 0.06, gy + gh * 0.16, setStroke(C.metal, 2));
  }
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
