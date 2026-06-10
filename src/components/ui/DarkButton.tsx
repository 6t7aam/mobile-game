import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { playSfx } from '@/audio/AudioManager';
import { THEME } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const C = THEME.colors;

interface DarkButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}

export function DarkButton({ label, onPress, variant = 'primary', disabled = false, style }: DarkButtonProps) {
  const borderColor = variant === 'danger' ? C.danger : variant === 'ghost' ? C.panelBorder : THEME.outline.color;
  const backgroundColor = variant === 'danger' ? C.danger : variant === 'ghost' ? C.panelRaised : C.accent;

  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={() => {
        playSfx(disabled ? 'ui_error' : 'ui_click');
        if (!disabled) onPress();
      }}
      onPressIn={() => (scale.value = withSpring(0.96, { damping: 14 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 14 }))}
      disabled={disabled}
      style={[styles.base, { borderColor, backgroundColor, opacity: disabled ? 0.45 : 1 }, anim, style]}
    >
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderWidth: THEME.outline.width,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.shadow.color,
    shadowOpacity: THEME.shadow.softAlpha,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  label: {
    fontFamily: THEME.fonts.heading,
    fontSize: 16,
    color: C.text,
    textTransform: 'uppercase',
  },
});
