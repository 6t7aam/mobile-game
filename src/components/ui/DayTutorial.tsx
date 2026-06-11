/**
 * World-aware first-run coach for the Day screen. Unlike the card-only
 * TutorialOverlay, this points an animated arrow at the current step's target
 * (a tree, the campfire, the build dock) and advances automatically as the
 * player performs each action. Sets `tutorialDone` when finished so it never
 * shows again.
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { COLORS, FONTS } from '@/constants/gameConfig';
import { THEME } from '@/theme';
import { useT } from '@/i18n/useT';

export type TutorialStep = 'chop' | 'carry' | 'deliver' | 'build' | 'done';

interface DayTutorialProps {
  step: TutorialStep;
  /** Screen-space position of the current target (px), or null for dock steps. */
  target: { x: number; y: number } | null;
  onSkip: () => void;
}

const TEXT_KEY: Record<TutorialStep, string> = {
  chop: 'tut.chop',
  carry: 'tut.pickup',
  deliver: 'tut.carry',
  build: 'tut.build',
  done: '',
};

export function DayTutorial({ step, target, onSkip }: DayTutorialProps) {
  const t = useT();
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [bob]);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -10 - bob.value * 10 }],
    opacity: 0.75 + bob.value * 0.25,
  }));

  if (step === 'done') return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* bouncing arrow over the live target */}
      {target && (
        <Animated.View style={[styles.arrowWrap, { left: target.x - 14, top: target.y - 54 }, arrowStyle]} pointerEvents="none">
          <Text style={styles.arrow}>▼</Text>
        </Animated.View>
      )}

      {/* instruction banner */}
      <View style={styles.banner} pointerEvents="box-none">
        <Text style={styles.title}>Обучение</Text>
        <Text style={styles.text}>{t(TEXT_KEY[step])}</Text>
        <Text style={styles.skip} onPress={onSkip}>
          {t('tutorial.skip')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  arrowWrap: { position: 'absolute' },
  arrow: { fontSize: 30, color: COLORS.accent, textShadowColor: THEME.outline.color, textShadowRadius: 4 },
  banner: {
    // compact strip above the build dock so it never covers the play area
    position: 'absolute',
    bottom: 112,
    alignSelf: 'center',
    maxWidth: 440,
    width: '70%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: THEME.alpha.panel95,
    borderWidth: THEME.outline.width,
    borderColor: COLORS.accent,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    gap: 4,
  },
  title: { fontFamily: FONTS.heading, color: COLORS.accent, fontSize: 12, letterSpacing: 1 },
  text: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 14, textAlign: 'center', lineHeight: 19 },
  skip: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 12, marginTop: 2, textDecorationLine: 'underline' },
});
