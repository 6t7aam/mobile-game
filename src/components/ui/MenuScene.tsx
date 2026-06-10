/**
 * Living Skia backdrop for the main menu / game-over screens: gradient night
 * sky, a cratered moon, a fortress silhouette on the horizon, dead trees, and
 * 90 drifting ash particles. Pure procedural — no assets. Animated via a light
 * 30fps timer (menus don't need 60).
 */

import { useEffect, useRef, useState } from 'react';
import { Canvas, Picture, Skia, type SkCanvas } from '@shopify/react-native-skia';
import { THEME } from '@/theme';

interface Ash {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const ASH_COUNT = 90;

function makeAsh(w: number, h: number): Ash[] {
  const out: Ash[] = [];
  for (let i = 0; i < ASH_COUNT; i++) {
    out.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: -8 - Math.random() * 14,
      vy: 6 + Math.random() * 14,
      r: 0.6 + Math.random() * 1.8,
    });
  }
  return out;
}

export function MenuScene({ width, height, mood = 'menu' }: { width: number; height: number; mood?: 'menu' | 'fell' }) {
  const ashRef = useRef<Ash[]>(makeAsh(width, height));
  const [, setTick] = useState(0);
  const lastRef = useRef(Date.now());

  useEffect(() => {
    ashRef.current = makeAsh(width, height);
  }, [width, height]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - lastRef.current) / 1000);
      lastRef.current = now;
      for (const a of ashRef.current) {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (a.y > height + 4 || a.x < -4) {
          a.x = Math.random() * width + 20;
          a.y = -4;
        }
      }
      setTick((t) => (t + 1) % 1_000_000);
    }, 1000 / 30);
    return () => clearInterval(id);
  }, [width, height]);

  const picture = (() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    drawScene(c, width, height, ashRef.current, mood);
    return rec.finishRecordingAsPicture();
  })();

  return (
    <Canvas style={{ position: 'absolute', width, height }}>
      <Picture picture={picture} />
    </Canvas>
  );
}

function fill(color: string, a = 1) {
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  p.setAlphaf(a);
  p.setAntiAlias(true);
  return p;
}

function drawScene(c: SkCanvas, w: number, h: number, ash: Ash[], mood: 'menu' | 'fell'): void {
  // sky gradient (top dark violet → near-black bottom)
  const top = mood === 'fell' ? THEME.colors.skyFell : THEME.colors.skyMenu;
  const bottom = THEME.colors.skyBottom;
  const shader = Skia.Shader.MakeLinearGradient(
    { x: 0, y: 0 },
    { x: 0, y: h },
    [Skia.Color(top), Skia.Color(bottom)],
    [0, 1],
    0,
  );
  const sky = Skia.Paint();
  sky.setShader(shader);
  c.drawRect(Skia.XYWHRect(0, 0, w, h), sky);

  // moon (upper right) with craters
  const mx = w * 0.78;
  const my = h * 0.2;
  const mr = Math.min(w, h) * 0.09;
  c.drawCircle(mx, my, mr * 1.5, fill(mood === 'fell' ? THEME.colors.blood : THEME.colors.moon, 0.12)); // halo
  c.drawCircle(mx, my, mr, fill(mood === 'fell' ? THEME.colors.danger : THEME.colors.moon, 0.95));
  for (const [dx, dy, cr] of [
    [-0.3, -0.2, 0.22],
    [0.25, 0.1, 0.16],
    [-0.1, 0.35, 0.13],
    [0.4, -0.3, 0.1],
  ] as const) {
    c.drawCircle(mx + dx * mr, my + dy * mr, cr * mr, fill(THEME.colors.moonShade, 0.5));
  }

  // distant fortress silhouette on the horizon
  const horizon = h * 0.66;
  c.drawRect(Skia.XYWHRect(0, horizon, w, h - horizon), fill(THEME.colors.void));
  drawFortress(c, w, horizon);

  // dead trees flanking
  drawTree(c, w * 0.08, horizon + 8, h * 0.22);
  drawTree(c, w * 0.93, horizon + 4, h * 0.26);
  drawTree(c, w * 0.2, horizon + 14, h * 0.16);

  // ash
  for (const a of ash) c.drawCircle(a.x, a.y, a.r, fill(THEME.colors.moon, 0.5));
}

function drawFortress(c: SkCanvas, w: number, horizon: number): void {
  const base = fill(THEME.colors.panel);
  const winGlow = fill(THEME.colors.fireLight, 0.85);
  // central keep + towers
  const cx = w * 0.5;
  const keepW = w * 0.26;
  c.drawRect(Skia.XYWHRect(cx - keepW / 2, horizon - 70, keepW, 70), base);
  // crenellations
  for (let i = 0; i < 6; i++) {
    c.drawRect(Skia.XYWHRect(cx - keepW / 2 + (i * keepW) / 6, horizon - 80, keepW / 12, 10), base);
  }
  // flanking towers
  for (const tx of [cx - keepW * 0.85, cx + keepW * 0.7]) {
    c.drawRect(Skia.XYWHRect(tx, horizon - 90, w * 0.05, 90), base);
    c.drawRect(Skia.XYWHRect(tx - 2, horizon - 102, w * 0.05 + 4, 14), base);
  }
  // lit windows
  for (let i = 0; i < 7; i++) {
    const x = cx - keepW / 2 + 8 + (i * (keepW - 16)) / 6;
    if ((i * 7) % 3 !== 0) c.drawRect(Skia.XYWHRect(x, horizon - 50, 4, 7), winGlow);
  }
}

function drawTree(c: SkCanvas, x: number, baseY: number, height: number): void {
  const trunk = fill(THEME.colors.void);
  const p = Skia.Path.Make();
  p.moveTo(x - 3, baseY);
  p.lineTo(x - 2, baseY - height);
  p.lineTo(x + 2, baseY - height);
  p.lineTo(x + 3, baseY);
  p.close();
  c.drawPath(p, trunk);
  // crooked branches
  const stroke = Skia.Paint();
  stroke.setColor(Skia.Color(THEME.colors.void));
  stroke.setStyle(1);
  stroke.setStrokeWidth(2.5);
  stroke.setAntiAlias(true);
  for (const [t, len, ang] of [
    [0.6, 0.4, -0.9],
    [0.45, 0.5, 0.8],
    [0.75, 0.3, -0.5],
    [0.3, 0.35, 1.1],
  ] as const) {
    const by = baseY - height * t;
    const bp = Skia.Path.Make();
    bp.moveTo(x, by);
    bp.lineTo(x + Math.cos(ang) * height * len, by - Math.sin(Math.abs(ang)) * height * len * 0.6);
    c.drawPath(bp, stroke);
  }
}
