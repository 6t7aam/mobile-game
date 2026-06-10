/**
 * Compact battlefield minimap. Re-records a tiny SkPicture each `frame`,
 * scaling world → minimap space, plotting the shelter, all buildings, the
 * player, and enemy blips (boss bigger / red). Reads the live sim pools.
 */

import { Canvas, Picture, Skia, type SkCanvas } from '@shopify/react-native-skia';

import type { BattleSim } from '@/engine/sim';
import { WORLD, GRID } from '@/constants/gameConfig';
import { BUILDINGS } from '@/constants/buildings';
import { THEME } from '@/theme';

const MAP_W = 88;
const MAP_H = Math.round(MAP_W * (WORLD.height / WORLD.width));
const TILE = GRID.tileSize;

function paint(color: string, a = 1) {
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  p.setAlphaf(a);
  return p;
}

export function Minimap({ sim, frame }: { sim: BattleSim; frame: number }) {
  void frame; // re-render trigger
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;

  const picture = (() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, MAP_W, MAP_H));
    draw(c, sim, sx, sy);
    return rec.finishRecordingAsPicture();
  })();

  return (
    <Canvas style={{ width: MAP_W, height: MAP_H }}>
      <Picture picture={picture} />
    </Canvas>
  );
}

function draw(c: SkCanvas, sim: BattleSim, sx: number, sy: number): void {
  c.drawRect(Skia.XYWHRect(0, 0, MAP_W, MAP_H), paint(THEME.colors.void, 0.85));

  // buildings
  for (const b of sim.buildings) {
    const def = BUILDINGS[b.type];
    const col = def.category === 'core' ? THEME.colors.resource : def.category === 'defense' ? THEME.colors.accent : THEME.colors.metal;
    c.drawRect(
      Skia.XYWHRect(
        b.origin.col * TILE * sx,
        b.origin.row * TILE * sy,
        def.size.w * TILE * sx,
        def.size.h * TILE * sy,
      ),
      paint(col, 0.9),
    );
  }

  // enemies
  sim.enemies.forEachActive((e) => {
    if (e.boss) c.drawCircle(e.x * sx, e.y * sy, 3, paint(THEME.colors.danger));
    else c.drawCircle(e.x * sx, e.y * sy, 1.4, paint(THEME.colors.wood));
  });

  // player
  c.drawCircle(sim.player.x * sx, sim.player.y * sy, 2.2, paint(THEME.colors.moon));

  // border
  const border = paint(THEME.colors.panelBorder);
  border.setStyle(1);
  border.setStrokeWidth(1);
  c.drawRect(Skia.XYWHRect(0.5, 0.5, MAP_W - 1, MAP_H - 1), border);
}
