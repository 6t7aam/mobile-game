/**
 * Skia font holder for the imperative battle renderer.
 *
 * `renderBattle` records an SkPicture outside the React tree, so it can't call
 * the `useFont` hook itself. Instead a React component (mounted by the battle
 * screen) loads the faces via `useFont` and publishes them here through
 * `setBattleFonts`; the renderer reads `getBattleFonts()` each frame. Until the
 * faces resolve, the renderer falls back to drawing pips (no crash).
 *
 * One SkFont per size we actually draw at — SkFont carries its point size, so we
 * keep a small fixed set rather than calling setSize() (cheaper, allocation-free
 * on the hot path).
 */

import { useEffect } from 'react';
import { useFont } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';

// Cyrillic-capable faces (the previous Cinzel set was Latin-only, so Russian
// boss names fell back to nothing/system). Both OFL, bundled in assets/fonts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CINZEL = require('../../../assets/fonts/AlegreyaSC-Bold.ttf');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DISPLAY = require('../../../assets/fonts/RuslanDisplay-Regular.ttf');

export interface BattleFonts {
  /** floating damage numbers / small in-world labels */
  small: SkFont;
  /** medium labels (resource gains, screamer warnings) */
  medium: SkFont;
  /** boss name plate */
  large: SkFont;
}

let fonts: BattleFonts | null = null;

export function getBattleFonts(): BattleFonts | null {
  return fonts;
}

function setBattleFonts(f: BattleFonts | null): void {
  fonts = f;
}

/**
 * Mount this once inside the battle screen. It loads the Skia faces and keeps
 * the module-level holder in sync for the imperative renderer.
 */
export function useBattleFonts(): void {
  const small = useFont(CINZEL, 13);
  const medium = useFont(DISPLAY, 16);
  const large = useFont(DISPLAY, 26);

  useEffect(() => {
    if (small && medium && large) {
      setBattleFonts({ small, medium, large });
    }
    return () => setBattleFonts(null);
  }, [small, medium, large]);
}
