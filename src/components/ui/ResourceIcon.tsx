/**
 * Skia-drawn resource icons. Emoji glyphs (🪵 ⚙️ ⛽ 🌿 ⚡) don't render on every
 * platform/browser (notably web/Opera GX, where the wood log showed blank), so
 * we draw crisp little vector icons that look identical everywhere and match the
 * Escapists-inspired chunky-outline art direction.
 */

import { Canvas, Path, Group, Circle, Rect, Skia } from '@shopify/react-native-skia';
import type { ResourceType } from '@/types';
import { THEME } from '@/theme';

const C = THEME.colors;

export function ResourceIcon({ type, size = 22 }: { type: ResourceType; size?: number }) {
  return (
    <Canvas style={{ width: size, height: size }}>
      <Group>{renderIcon(type, size)}</Group>
    </Canvas>
  );
}

function renderIcon(type: ResourceType, s: number) {
  const u = s / 24; // icons authored on a 24px grid
  switch (type) {
    case 'wood':
      return woodIcon(u);
    case 'scrap':
      return scrapIcon(u);
    case 'fuel':
      return fuelIcon(u);
    case 'food':
      return foodIcon(u);
    case 'energy':
      return energyIcon(u);
  }
}

// a stacked log bundle (end-grain rings)
function woodIcon(u: number) {
  const logs = [
    { x: 6, y: 13 },
    { x: 13, y: 13 },
    { x: 9.5, y: 7.5 },
  ];
  return (
    <Group>
      {logs.map((l, i) => (
        <Group key={i}>
          <Circle cx={l.x * u} cy={l.y * u} r={4.4 * u} color={THEME.outline.color} />
          <Circle cx={l.x * u} cy={l.y * u} r={3.4 * u} color={C.woodSide} />
          <Circle cx={l.x * u} cy={l.y * u} r={2 * u} color={C.woodTop} />
          <Circle cx={l.x * u} cy={l.y * u} r={0.8 * u} color={C.woodDark} />
        </Group>
      ))}
    </Group>
  );
}

// a bolt / cog for scrap
function scrapIcon(u: number) {
  const teeth = [];
  const cx = 12 * u;
  const cy = 12 * u;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    teeth.push(
      <Rect
        key={i}
        x={cx + Math.cos(a) * 7 * u - 1.6 * u}
        y={cy + Math.sin(a) * 7 * u - 1.6 * u}
        width={3.2 * u}
        height={3.2 * u}
        color={C.metalSide}
      />,
    );
  }
  return (
    <Group>
      {teeth}
      <Circle cx={cx} cy={cy} r={6 * u} color={THEME.outline.color} />
      <Circle cx={cx} cy={cy} r={5 * u} color={C.metalTop} />
      <Circle cx={cx} cy={cy} r={2 * u} color={C.metalSide} />
    </Group>
  );
}

// a fuel canister
function fuelIcon(u: number) {
  return (
    <Group>
      <Rect x={5 * u} y={6 * u} width={12 * u} height={14 * u} color={THEME.outline.color} />
      <Rect x={6 * u} y={7 * u} width={10 * u} height={12 * u} color={C.danger} />
      <Rect x={8 * u} y={4 * u} width={4 * u} height={3 * u} color={C.metalSide} />
      <Rect x={13 * u} y={9 * u} width={4 * u} height={2 * u} color={C.metalSide} />
      <Path
        path={fuelDrop(u)}
        color={C.window}
      />
    </Group>
  );
}

function fuelDrop(u: number) {
  const p = Skia.Path.Make();
  p.moveTo(10.5 * u, 10 * u);
  p.lineTo(12.5 * u, 13 * u);
  p.lineTo(8.5 * u, 13 * u);
  p.close();
  return p;
}

// a leaf for food
function foodIcon(u: number) {
  const p = Skia.Path.Make();
  p.moveTo(12 * u, 4 * u);
  p.cubicTo(20 * u, 7 * u, 20 * u, 17 * u, 12 * u, 20 * u);
  p.cubicTo(4 * u, 17 * u, 4 * u, 7 * u, 12 * u, 4 * u);
  p.close();
  const vein = Skia.Path.Make();
  vein.moveTo(12 * u, 5 * u);
  vein.lineTo(12 * u, 19 * u);
  return (
    <Group>
      <Path path={p} color={C.grassDark} />
      <Path path={p} color={C.grass} style="stroke" strokeWidth={0} />
      <Path path={vein} color={C.grassShade} style="stroke" strokeWidth={1.4 * u} />
    </Group>
  );
}

// a lightning bolt for energy
function energyIcon(u: number) {
  const p = Skia.Path.Make();
  p.moveTo(13 * u, 3 * u);
  p.lineTo(6 * u, 13 * u);
  p.lineTo(11 * u, 13 * u);
  p.lineTo(10 * u, 21 * u);
  p.lineTo(18 * u, 10 * u);
  p.lineTo(12.5 * u, 10 * u);
  p.close();
  return (
    <Group>
      <Path path={p} color={THEME.outline.color} style="stroke" strokeWidth={2.4 * u} />
      <Path path={p} color={C.window} />
    </Group>
  );
}
