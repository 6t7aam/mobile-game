import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { COLORS, FONTS } from '@/constants/gameConfig';
import { THEME } from '@/theme';
import { useT } from '@/i18n/useT';
import type { StringKey } from '@/i18n/strings';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * First-run coaching. Shows a short sequence of tips over the Day screen on the
 * very first run, then sets `tutorialDone` so it never reappears. Non-blocking:
 * the player can build/skip at any time.
 */
const STEPS: StringKey[] = [
  'tutorial.welcome',
  'tutorial.build',
  'tutorial.craft',
  'tutorial.startNight',
];

export function TutorialOverlay({ onFinish }: { onFinish?: () => void }) {
  const t = useT();
  const markDone = useSettingsStore((s) => s.markTutorialDone);
  const [step, setStep] = useState(0);

  const finish = () => {
    markDone();
    onFinish?.();
  };

  const next = () => {
    if (step >= STEPS.length - 1) finish();
    else setStep(step + 1);
  };

  const last = step === STEPS.length - 1;

  return (
    <View style={styles.scrim} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.step}>{step + 1}/{STEPS.length}</Text>
        <Text style={styles.text}>{t(STEPS[step]!)}</Text>
        <View style={styles.actions}>
          {!last && (
            <Pressable onPress={finish} hitSlop={8}>
              <Text style={styles.skip}>{t('tutorial.skip')}</Text>
            </Pressable>
          )}
          <Pressable style={styles.nextBtn} onPress={next}>
            <Text style={styles.nextText}>{last ? t('tutorial.done') : t('tutorial.next')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 110,
  },
  card: {
    backgroundColor: THEME.alpha.panel95,
    borderWidth: 2,
    borderColor: COLORS.accent,
    padding: 18,
    maxWidth: 460,
    width: '86%',
    gap: 10,
  },
  step: { fontFamily: FONTS.heading, color: COLORS.accent, fontSize: 13 },
  text: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 17, lineHeight: 23 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 20, marginTop: 4 },
  skip: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 15 },
  nextBtn: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: COLORS.accent,
    backgroundColor: THEME.colors.accentDark,
  },
  nextText: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 15, letterSpacing: 1 },
});
