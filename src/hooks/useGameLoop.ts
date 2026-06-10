/**
 * Fixed-timestep game loop driven by requestAnimationFrame.
 *
 * Steps the simulation at a constant 60 Hz (accumulator pattern) regardless of
 * frame rate, then bumps a React state `frame` counter so the Skia canvas
 * re-reads the sim's pools and repaints. The sim mutates in place.
 *
 * IMPORTANT for perf: the `frame` state bump re-renders the whole screen
 * (HUD, build dock, etc.). Re-rendering React 60×/s is what tanked FPS, so we
 * throttle the React render to ~30 Hz while the SIM still steps at 60 Hz. The
 * sim stays smooth/deterministic; the canvas repaints at 30 fps (plenty).
 */

import { useEffect, useRef, useState } from 'react';

const STEP = 1 / 60; // simulation tick (seconds)
const MAX_FRAME = 0.1; // clamp huge stalls (tab switch etc.)
const RENDER_EVERY = 2; // bump React state every Nth RAF (60 → ~30 fps render)

export interface GameLoopHandle {
  /** Monotonic frame counter — depend on this to trigger renders. */
  frame: number;
  /** True while the loop is running. */
  running: boolean;
}

export function useGameLoop(
  step: (dt: number) => void,
  active: boolean,
  onTick?: (elapsed: number) => void,
): number {
  const [frame, setFrame] = useState(0);
  const accRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const rafCountRef = useRef(0);
  const stepRef = useRef(step);
  const tickRef = useRef(onTick);
  stepRef.current = step;
  tickRef.current = onTick;

  useEffect(() => {
    if (!active) {
      lastRef.current = null;
      accRef.current = 0;
      return;
    }

    const tick = (now: number) => {
      const t = now / 1000;
      if (lastRef.current === null) lastRef.current = t;
      let delta = t - lastRef.current;
      lastRef.current = t;
      if (delta > MAX_FRAME) delta = MAX_FRAME;
      accRef.current += delta;
      elapsedRef.current += delta;

      let steps = 0;
      while (accRef.current >= STEP && steps < 6) {
        stepRef.current(STEP);
        accRef.current -= STEP;
        steps++;
      }
      tickRef.current?.(elapsedRef.current);
      // throttle the React re-render (HUD/canvas) to every Nth RAF
      rafCountRef.current += 1;
      if (rafCountRef.current >= RENDER_EVERY) {
        rafCountRef.current = 0;
        setFrame((f) => (f + 1) % 1_000_000);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active]);

  return frame;
}
