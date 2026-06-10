/**
 * Optional raster backdrop. When a Higgsfield-generated image is registered in
 * `assets/registry.ts` (BACKGROUNDS.*), this draws it cover-scaled. When the
 * entry is still `null`, it renders nothing and the caller's procedural
 * `MenuScene` shows through — so the swap from procedural → AI art is a one-line
 * change in the registry with zero call-site edits.
 *
 * Usage: render <SpriteBackground source={BACKGROUNDS.menu} .../> *behind* the
 * procedural scene; it's a no-op until art exists.
 */

import { Canvas, Image, useImage } from '@shopify/react-native-skia';
import { hasSprite, type ImageSource } from '@/assets/registry';

interface SpriteBackgroundProps {
  source: ImageSource;
  width: number;
  height: number;
  opacity?: number;
}

export function SpriteBackground({ source, width, height, opacity = 1 }: SpriteBackgroundProps) {
  // `useImage` accepts a require()'d module id or URI; null short-circuits.
  const img = useImage(hasSprite(source) ? source : null);
  if (!img) return null;
  return (
    <Canvas style={{ position: 'absolute', width, height }}>
      <Image image={img} x={0} y={0} width={width} height={height} fit="cover" opacity={opacity} />
    </Canvas>
  );
}
