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

export type TutorialStep = 'chop' | 'carry' | 'deliver' | 'build' | 'done';

interface DayTutorialProps {
  step: TutorialStep;
  /** Screen-space position of the current target (px), or null for dock steps. */
  target: { x: number; y: number } | null;
  onSkip: () => void;
}

const TEXT: Record<TutorialStep, string> = {
  chop: 'Подойди к дереву и руби его (кнопка «Рубить»), пока не упадёт.',
  carry: 'Подбери упавшее бревно — просто пройди по нему.',
  deliver: 'Отнеси брёвна к костру в центре, чтобы получить дерево.',
  build: 'Открой панель снизу и построй стену для защиты на ночь.',
  done: '',
};

export function DayTutorial({ step, target, onSkip }: DayTutorialProps) {
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
        <Text style={styles.text}>{TEXT[step]}</Text>
        <Text style={styles.skip} onPress={onSkip}>
          Пропустить обучение
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  arrowWrap: { position: 'absolute' },
  arrow: { fontSize: 30, color: COLORS.accent, textShadowColor: THEME.outline.color, textShadowRadius: 4 },
  banner: {
    position: 'absolute',
    top: 64,
    alignSelf: 'center',
    maxWidth: 520,
    width: '90%',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: THEME.alpha.panel95,
    borderWidth: THEME.outline.width,
    borderColor: COLORS.accent,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    gap: 4,
  },
  title: { fontFamily: FONTS.heading, color: COLORS.accent, fontSize: 13, letterSpacing: 1 },
  text: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 16, textAlign: 'center', lineHeight: 21 },
  skip: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 13, marginTop: 4 },
});
