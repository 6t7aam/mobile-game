import { Image } from 'react-native';
import { Skia, drawAsImageFromPicture, type SkCanvas } from '@shopify/react-native-skia';

import type { BuildingType } from '@/types';
import { THEME } from '@/theme';

const C = THEME.colors;
const OUTLINE = THEME.outline;
const U = 72; // icons authored on a 72px grid

// Rasterized once per (type, level, size) and cached: a live Skia <Canvas> per
// icon would each hold a WebGL context (browsers cap ~16) and waste GPU memory.
const RASTER_SCALE = 3;
const cache = new Map<string, string>();

function rasterIcon(type: BuildingType, level: number, size: number, plate: boolean): string {
  const key = `${type}-${level}-${size}-${plate}`;
  let uri = cache.get(key);
  if (!uri) {
    const px = size * RASTER_SCALE;
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, px, px));
    c.scale(px / U, px / U);
    if (plate) drawPlate(c, type);
    drawIcon(c, type, level);
    const img = drawAsImageFromPicture(rec.finishRecordingAsPicture(), { width: px, height: px });
    uri = `data:image/png;base64,${img.encodeToBase64()}`;
    cache.set(key, uri);
  }
  return uri;
}

/**
 * Crisp, instantly-readable building icons. Every type has a distinct
 * silhouette + accent so the build dock is legible at a glance. Drawn on a
 * rounded tinted plate with a consistent faux-3D shading direction.
 */
export function BuildingIcon({ type, level, size = 72, plate = true }: { type: BuildingType; level: number; size?: number; plate?: boolean }) {
  return (
    <Image
      source={{ uri: rasterIcon(type, level, size, plate) }}
      style={{ width: size, height: size }}
    />
  );
}

// ---------------------------------------------------------------------------

function p(color: string, stroke = false, width: number = OUTLINE.width) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  if (stroke) {
    paint.setStyle(1);
    paint.setStrokeWidth(width);
  }
  return paint;
}

/** Subtle category-tinted rounded backdrop. */
function drawPlate(c: SkCanvas, type: BuildingType): void {
  const tint = CATEGORY_TINT[type] ?? C.panel;
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(2, 2, U - 4, U - 4), 12, 12), p(tint));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(2, 2, U - 4, U - 4), 12, 12), p(OUTLINE.color, true, OUTLINE.width));
}

const CATEGORY_TINT: Partial<Record<BuildingType, string>> = {
  shelter: '#3a2a1c',
  wall: '#2c2f38',
  gate: '#2c2f38',
  tower: '#3a1f1f',
  sniperNest: '#3a1f1f',
  mortar: '#3a1f1f',
  electricFence: '#1f3340',
  barracks: '#332a3a',
  trainingGround: '#332a3a',
  storage: '#2f2a22',
  workshop: '#2f2a22',
  fuelDepot: '#3a2420',
  garden: '#23381f',
  generator: '#1f3340',
  researchCenter: '#26314a',
  medbay: '#3a2222',
};

function block(c: SkCanvas, x: number, y: number, w: number, h: number, color: string, topColor?: string): void {
  c.drawRect(Skia.XYWHRect(x, y, w, h), p(OUTLINE.color));
  c.drawRect(Skia.XYWHRect(x + OUTLINE.width, y + OUTLINE.width, w - OUTLINE.width * 2, h - OUTLINE.width * 2), p(color));
  if (topColor) c.drawRect(Skia.XYWHRect(x + OUTLINE.width, y + OUTLINE.width, w - OUTLINE.width * 2, 4), p(topColor));
}

function roof(c: SkCanvas, x: number, y: number, w: number, h: number, color: string = C.roofTop): void {
  const path = Skia.Path.Make();
  path.moveTo(x, y + h);
  path.lineTo(x + w / 2, y);
  path.lineTo(x + w, y + h);
  path.close();
  c.drawPath(path, p(color));
  c.drawPath(path, p(OUTLINE.color, true, OUTLINE.width));
}

function circle(c: SkCanvas, x: number, y: number, r: number, color: string): void {
  c.drawCircle(x, y, r, p(OUTLINE.color));
  c.drawCircle(x, y, r - OUTLINE.width, p(color));
}

// ---------------------------------------------------------------------------

function drawIcon(c: SkCanvas, type: BuildingType, level: number): void {
  const stone = level >= 4;
  switch (type) {
    case 'shelter': {
      // campfire: stone ring + crossed logs + flame
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        circle(c, 36 + Math.cos(a) * 16, 50 + Math.sin(a) * 8, 5, i % 2 ? C.stone : C.stoneTop);
      }
      block(c, 22, 46, 28, 7, C.wood);
      const fl = Skia.Path.Make();
      fl.moveTo(36, 18);
      fl.cubicTo(52, 30, 46, 50, 36, 50);
      fl.cubicTo(26, 50, 20, 30, 36, 18);
      fl.close();
      c.drawPath(fl, p(C.fire));
      const fl2 = Skia.Path.Make();
      fl2.moveTo(36, 28);
      fl2.cubicTo(45, 36, 41, 50, 36, 50);
      fl2.cubicTo(31, 50, 27, 36, 36, 28);
      fl2.close();
      c.drawPath(fl2, p(C.fireLight));
      return;
    }
    case 'wall':
      block(c, 14, 26, 44, 30, stone ? C.stone : C.wood, stone ? C.stoneTop : C.woodTop);
      // brick lines
      c.drawLine(14, 40, 58, 40, p(OUTLINE.color, true, 1.5));
      c.drawLine(36, 26, 36, 40, p(OUTLINE.color, true, 1.5));
      c.drawLine(25, 40, 25, 56, p(OUTLINE.color, true, 1.5));
      c.drawLine(47, 40, 47, 56, p(OUTLINE.color, true, 1.5));
      return;
    case 'gate':
      block(c, 12, 24, 48, 32, stone ? C.stone : C.wood, stone ? C.stoneTop : C.woodTop);
      block(c, 28, 24, 16, 32, C.woodDark); // doorway
      circle(c, 40, 40, 2.5, C.metalTop); // handle
      return;
    case 'tower':
      block(c, 22, 30, 28, 26, stone ? C.stone : C.wood, stone ? C.stoneTop : C.woodTop);
      // crenellations
      for (let i = 0; i < 3; i++) block(c, 22 + i * 10, 24, 6, 8, stone ? C.stoneTop : C.woodTop);
      // gun barrel
      c.drawRect(Skia.XYWHRect(40, 36, 20, 6), p(C.metal));
      c.drawRect(Skia.XYWHRect(40, 36, 20, 6), p(OUTLINE.color, true, OUTLINE.width));
      return;
    case 'sniperNest':
      block(c, 24, 30, 24, 26, stone ? C.stone : C.wood, stone ? C.stoneTop : C.woodTop);
      // long thin barrel + scope
      c.drawRect(Skia.XYWHRect(34, 22, 28, 4), p(C.metal));
      c.drawRect(Skia.XYWHRect(34, 22, 28, 4), p(OUTLINE.color, true, OUTLINE.width));
      circle(c, 44, 20, 4, C.electric);
      c.drawCircle(44, 20, 1.5, p(C.danger));
      return;
    case 'mortar':
      block(c, 18, 38, 36, 18, stone ? C.stone : C.wood);
      // angled tube
      c.save();
      c.translate(36, 40);
      c.rotate(-40, 0, 0);
      block(c, -5, -24, 11, 26, C.metal, C.metalTop);
      c.restore();
      return;
    case 'electricFence':
      block(c, 24, 24, 8, 34, C.metalSide);
      block(c, 40, 24, 8, 34, C.metalSide);
      // arc
      for (let i = 0; i < 3; i++) c.drawLine(32, 30 + i * 9, 40, 26 + i * 9, p(C.electric, true, 3));
      circle(c, 28, 22, 4, C.electricLight);
      circle(c, 44, 22, 4, C.electricLight);
      return;
    case 'barracks':
      block(c, 14, 32, 44, 24, C.wood, C.woodTop);
      roof(c, 10, 20, 52, 16);
      block(c, 30, 42, 12, 14, C.woodDark);
      // shield emblem
      const sh = Skia.Path.Make();
      sh.moveTo(50, 24); sh.lineTo(56, 27); sh.lineTo(56, 33); sh.lineTo(50, 37); sh.lineTo(44, 33); sh.lineTo(44, 27); sh.close();
      c.drawPath(sh, p(C.danger));
      c.drawPath(sh, p(OUTLINE.color, true, OUTLINE.width));
      return;
    case 'trainingGround':
      block(c, 12, 30, 48, 26, C.dirt);
      // dummy + sword
      block(c, 22, 22, 7, 34, C.woodSide);
      circle(c, 25, 20, 6, C.skin);
      c.drawLine(40, 50, 52, 28, p(C.metalTop, true, 4));
      block(c, 48, 28, 6, 6, C.woodDark);
      return;
    case 'storage':
      block(c, 14, 28, 44, 28, C.wood, C.woodTop);
      roof(c, 12, 18, 48, 14);
      // crates
      block(c, 20, 40, 14, 14, C.woodSide);
      block(c, 38, 40, 14, 14, C.woodSide);
      c.drawLine(20, 47, 34, 47, p(OUTLINE.color, true, 1.5));
      return;
    case 'workshop':
      block(c, 14, 30, 44, 26, C.stone, C.stoneTop);
      block(c, 46, 14, 9, 20, C.metal); // chimney
      circle(c, 50, 14, 4, C.smoke);
      // anvil
      block(c, 22, 42, 18, 9, C.metalSide);
      circle(c, 31, 50, 7, C.fire); // forge glow
      return;
    case 'fuelDepot':
      // tank + drop
      block(c, 20, 28, 32, 28, C.danger, '#d4534a');
      circle(c, 26, 24, 5, C.metalSide);
      block(c, 44, 36, 8, 5, C.metalSide);
      const drop = Skia.Path.Make();
      drop.moveTo(36, 36); drop.lineTo(42, 46); drop.lineTo(30, 46); drop.close();
      c.drawPath(drop, p(C.window));
      return;
    case 'garden':
      block(c, 12, 42, 48, 14, C.dirt, C.dirtLight); // soil bed
      // sprouts
      for (let i = 0; i < 4; i++) {
        const gx = 20 + i * 11;
        c.drawLine(gx, 44, gx, 30, p(C.grassDark, true, 2.5));
        circle(c, gx - 3, 28, 4, C.grass);
        circle(c, gx + 3, 30, 4, C.grassLight);
      }
      return;
    case 'generator':
      block(c, 18, 30, 36, 26, C.metalSide, C.metalTop);
      // bolt
      const bolt = Skia.Path.Make();
      bolt.moveTo(38, 30); bolt.lineTo(28, 44); bolt.lineTo(35, 44); bolt.lineTo(32, 56); bolt.lineTo(46, 40); bolt.lineTo(38, 40); bolt.close();
      c.drawPath(bolt, p(OUTLINE.color, true, OUTLINE.width + 1));
      c.drawPath(bolt, p(C.window));
      return;
    case 'researchCenter':
      block(c, 16, 30, 40, 26, C.stone, C.stoneTop);
      roof(c, 12, 18, 48, 16, C.cloth);
      // flask
      const fk = Skia.Path.Make();
      fk.moveTo(33, 36); fk.lineTo(33, 44); fk.lineTo(27, 54); fk.lineTo(45, 54); fk.lineTo(39, 44); fk.lineTo(39, 36); fk.close();
      c.drawPath(fk, p(C.electricLight));
      c.drawPath(fk, p(OUTLINE.color, true, OUTLINE.width));
      c.drawRect(Skia.XYWHRect(31, 48, 10, 6), p(C.electric));
      return;
    case 'medbay':
      block(c, 16, 28, 40, 28, C.offWhite, C.white);
      roof(c, 12, 18, 48, 14, C.danger);
      // red cross
      c.drawRect(Skia.XYWHRect(33, 36, 6, 16), p(C.danger));
      c.drawRect(Skia.XYWHRect(28, 41, 16, 6), p(C.danger));
      return;
    default:
      block(c, 14, 28, 44, 28, C.stone, C.stoneTop);
      roof(c, 12, 18, 48, 16);
  }
}
