/**
 * Tactical minimap. Re-records a tiny SkPicture each `frame`, scaling
 * world → minimap space: terrain (grass clearing + forest band + tree dots),
 * buildings colour-coded by category, enemy blips (boss pulses), barracks
 * soldiers, the player wedge and the current camera viewport rectangle.
 */

import { Canvas, Picture, Skia, type SkCanvas } from '@shopify/react-native-skia';

import type { BattleSim } from '@/engine/sim';
import type { Camera } from '@/components/battle/renderSim';
import type { Rock, Tree } from '@/types';
import { WORLD, GRID } from '@/constants/gameConfig';
import { BUILDINGS } from '@/constants/buildings';
import { THEME } from '@/theme';

const MAP_W = 112;
const MAP_H = Math.round(MAP_W * (WORLD.height / WORLD.width));
const TILE = GRID.tileSize;
const T = THEME.colors;

function paint(color: string, a = 1) {
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  p.setAlphaf(a);
  return p;
}

function stroke(color: string, w: number, a = 1) {
  const p = paint(color, a);
  p.setStyle(1);
  p.setStrokeWidth(w);
  return p;
}

interface MinimapProps {
  sim: BattleSim;
  frame: number;
  trees?: Tree[];
  rocks?: Rock[];
  cam?: Camera | null;
  viewW?: number;
  viewH?: number;
}

export function Minimap({ sim, frame, trees, rocks, cam, viewW, viewH }: MinimapProps) {
  void frame; // re-render trigger
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;

  const picture = (() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, MAP_W, MAP_H));
    draw(c, sim, sx, sy, trees, rocks, cam, viewW, viewH);
    return rec.finishRecordingAsPicture();
  })();

  return (
    <Canvas style={{ width: MAP_W, height: MAP_H }}>
      <Picture picture={picture} />
    </Canvas>
  );
}

function draw(
  c: SkCanvas,
  sim: BattleSim,
  sx: number,
  sy: number,
  trees?: Tree[],
  rocks?: Rock[],
  cam?: Camera | null,
  viewW?: number,
  viewH?: number,
): void {
  // terrain: dark forest base with a lighter central clearing
  c.drawRect(Skia.XYWHRect(0, 0, MAP_W, MAP_H), paint(T.forestDark, 0.92));
  const band = 8 * TILE; // FOREST_BAND tiles
  c.drawRect(
    Skia.XYWHRect(band * sx, band * sy, (WORLD.width - band * 2) * sx, (WORLD.height - band * 2) * sy),
    paint(T.grassDark, 0.9),
  );

  // living trees / mineable rocks as terrain specks
  if (trees) {
    const tp = paint(T.forest, 0.95);
    for (const t of trees) {
      if (t.state !== 'alive') continue;
      c.drawCircle((t.tileX + 0.5) * TILE * sx, (t.tileY + 0.5) * TILE * sy, 1.1, tp);
    }
  }
  if (rocks) {
    const rp = paint(T.stone, 0.9);
    for (const r of rocks) {
      if (r.state !== 'alive') continue;
      c.drawCircle((r.tileX + 0.5) * TILE * sx, (r.tileY + 0.5) * TILE * sy, 1.1, rp);
    }
  }

  // buildings, colour-coded by category
  for (const b of sim.buildings) {
    const def = BUILDINGS[b.type];
    const col =
      def.category === 'core' ? T.resource : def.category === 'defense' ? T.accent : T.metal;
    c.drawRect(
      Skia.XYWHRect(
        b.origin.col * TILE * sx,
        b.origin.row * TILE * sy,
        Math.max(2, def.size.w * TILE * sx),
        Math.max(2, def.size.h * TILE * sy),
      ),
      paint(col, 0.95),
    );
  }

  // barracks soldiers (friendly blips)
  sim.soldiers.forEachActive((s) => {
    c.drawCircle(s.x * sx, s.y * sy, 1.5, paint('#7fb6e0'));
  });

  // enemies — boss pulses
  const pulse = 2.6 + Math.sin(sim.worldClock * 6) * 0.8;
  sim.enemies.forEachActive((e) => {
    if (e.boss) c.drawCircle(e.x * sx, e.y * sy, pulse, paint(T.danger));
    else c.drawCircle(e.x * sx, e.y * sy, 1.5, paint(T.danger, 0.85));
  });

  // camera viewport rectangle
  if (cam && viewW && viewH && cam.zoom > 0) {
    const vw = (viewW / cam.zoom) * sx;
    const vh = (viewH / cam.zoom) * sy;
    c.drawRect(
      Skia.XYWHRect(cam.x * sx - vw / 2, cam.y * sy - vh / 2, vw, vh),
      stroke(T.text, 1, 0.55),
    );
  }

  // player: white dot + facing wedge
  const px = sim.player.x * sx;
  const py = sim.player.y * sy;
  const f = sim.player.facing;
  const wedge = Skia.Path.Make();
  wedge.moveTo(px + Math.cos(f) * 6, py + Math.sin(f) * 6);
  wedge.lineTo(px + Math.cos(f + 2.5) * 3.4, py + Math.sin(f + 2.5) * 3.4);
  wedge.lineTo(px + Math.cos(f - 2.5) * 3.4, py + Math.sin(f - 2.5) * 3.4);
  wedge.close();
  c.drawPath(wedge, paint(T.moon, 0.85));
  c.drawCircle(px, py, 2.4, paint(T.moon));

  // border
  c.drawRect(Skia.XYWHRect(0.5, 0.5, MAP_W - 1, MAP_H - 1), stroke(T.panelBorder, 1));
}
