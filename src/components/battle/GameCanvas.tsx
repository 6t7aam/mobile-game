import { useMemo, useRef } from 'react';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';

import type { BattleSim } from '@/engine/sim';
import { WORLD } from '@/constants/gameConfig';
import { clamp, damp } from '@/engine/math';
import { renderBattle, type Camera, type WorldView } from './renderSim';

interface GameCanvasProps {
  sim: BattleSim;
  frame: number;
  width: number;
  height: number;
  /** Seconds since the previous frame, for camera smoothing. */
  dt: number;
  /** World extras: forest, rocks, dropped items, build ghost, ambient light. */
  world?: WorldView;
  /**
   * Optional out-param: the live camera, so the parent can convert
   * screen ↔ world coordinates (CoC ghost dragging, tap-to-select).
   */
  cameraOut?: { current: Camera | null };
}

/**
 * Single-element Skia surface. On every `frame` bump it records one SkPicture
 * of the whole battlefield (via `renderBattle`) and paints it — so hundreds of
 * entities never touch the React tree.
 */
export function GameCanvas({ sim, frame, width, height, dt, world, cameraOut }: GameCanvasProps) {
  const camRef = useRef<Camera>({ x: WORLD.width / 2, y: WORLD.height / 2, zoom: 1, shakeX: 0, shakeY: 0 });

  const picture = useMemo(() => {
    const cam = camRef.current;

    // auto-zoom: pull back when the player nears an edge or a boss is present
    const baseZoom = clamp(height / 520, 0.85, 1.5);
    const p = sim.player;
    const edgeProx = Math.min(
      p.x,
      WORLD.width - p.x,
      p.y,
      WORLD.height - p.y,
    );
    const targetZoom = edgeProx < 140 ? baseZoom * 0.82 : baseZoom;
    cam.zoom = damp(cam.zoom, targetZoom, 4, dt || 0.016);

    // follow with lookahead, clamped so we don't show too much void
    const halfW = width / 2 / cam.zoom;
    const halfH = height / 2 / cam.zoom;
    const minX = Math.min(WORLD.width / 2, halfW - 80);
    const maxX = Math.max(WORLD.width / 2, WORLD.width - halfW + 80);
    const minY = Math.min(WORLD.height / 2, halfH - 80);
    const maxY = Math.max(WORLD.height / 2, WORLD.height - halfH + 80);
    const tx = clamp(p.x, minX, maxX);
    const ty = clamp(p.y, minY, maxY);
    cam.x = damp(cam.x, tx, 6, dt || 0.016);
    cam.y = damp(cam.y, ty, 6, dt || 0.016);

    // screen shake from trauma
    const trauma = sim.shakeTrauma;
    const amp = trauma * trauma * 14;
    cam.shakeX = (Math.random() * 2 - 1) * amp;
    cam.shakeY = (Math.random() * 2 - 1) * amp;

    const recorder = Skia.PictureRecorder();
    const c = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
    renderBattle(c, sim, cam, width, height, world);
    if (cameraOut) cameraOut.current = cam;
    return recorder.finishRecordingAsPicture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, width, height, world]);

  return (
    <Canvas style={{ width, height }}>
      <Picture picture={picture} />
    </Canvas>
  );
}
