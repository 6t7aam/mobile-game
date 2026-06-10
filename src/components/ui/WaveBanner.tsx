/**
 * Slide-down wave-announcement banner. Watches the sim's wave index and, on
 * each change, slides in from the top, holds, then retracts. Boss waves pulse
 * red and stay longer. Driven purely by props the HUD already reads.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { COLORS, FONTS } from '@/constants/gameConfig';
import { THEME } from '@/theme';

interface Props {
  wave: number;
  waves: number;
  night: number;
  isBoss: boolean;
  bossName?: string;
}

export function WaveBanner({ wave, waves, night, isBoss, bossName }: Props) {
  const y = useSharedValue(-120);
  const prevWave = useRef(0);

  useEffect(() => {
    if (wave === prevWave.current || wave < 1) return;
    prevWave.current = wave;
    const hold = isBoss ? 3000 : 1800;
    cancelAnimation(y);
    y.value = withSequence(
      withTiming(0, { duration: 350 }),
      withDelay(hold, withTiming(-120, { duration: 350 })),
    );
  }, [wave, isBoss, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View style={[styles.banner, isBoss && styles.bossBanner, style]} pointerEvents="none">
      <Text style={[styles.title, isBoss && styles.bossTitle]}>
        {isBoss ? '⚠ ЭЛИТНАЯ УГРОЗА' : `ВОЛНА ${wave} / ${waves}`}
      </Text>
      <Text style={styles.sub}>{isBoss && bossName ? bossName : `Ночь ${night}`}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    paddingHorizontal: 34,
    paddingVertical: 12,
    backgroundColor: THEME.alpha.panel95,
    borderBottomWidth: 2,
    borderColor: COLORS.panelBorder,
    alignItems: 'center',
  },
  bossBanner: { borderColor: COLORS.danger, borderBottomWidth: 3 },
  title: { fontFamily: FONTS.display, color: COLORS.resource, fontSize: 22, letterSpacing: 2 },
  bossTitle: { color: COLORS.danger },
  sub: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 13, marginTop: 2 },
});
