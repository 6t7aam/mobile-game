import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { THEME } from '@/theme';

// Bigger stick for a chunkier, easier-to-use control.
const SIZE = 180;
const KNOB = 80;
const MAX = (SIZE - KNOB) / 2;
const C = THEME.colors;

interface JoystickProps {
  onChange: (x: number, y: number) => void;
  /**
   * Dynamic mode: the stick base springs up centered wherever the player first
   * touches inside the active zone, then the knob tracks the drag from there.
   * Released → hidden. When false, the stick is a fixed pad.
   */
  dynamic?: boolean;
}

export function Joystick({ onChange, dynamic = false }: JoystickProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // base origin (dynamic mode) — where the finger went down
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  const visible = useSharedValue(dynamic ? 0 : 1);

  const emit = (x: number, y: number) => onChange(x, y);

  const pan = Gesture.Pan()
    .onBegin((event) => {
      'worklet';
      if (dynamic) {
        baseX.value = event.x;
        baseY.value = event.y;
        visible.value = 1;
      }
      tx.value = 0;
      ty.value = 0;
    })
    .onUpdate((event) => {
      'worklet';
      const dx = clampW(event.translationX, MAX);
      const dy = clampW(event.translationY, MAX);
      tx.value = dx;
      ty.value = dy;
      runOnJS(emit)(dx / MAX, dy / MAX);
    })
    .onFinalize(() => {
      'worklet';
      tx.value = 0;
      ty.value = 0;
      if (dynamic) visible.value = 0;
      runOnJS(emit)(0, 0);
    });

  // base follows the touch origin in dynamic mode; fixed otherwise
  const baseStyle = useAnimatedStyle(() =>
    dynamic
      ? {
          opacity: visible.value,
          transform: [{ translateX: baseX.value - SIZE / 2 }, { translateY: baseY.value - SIZE / 2 }],
        }
      : { opacity: 1 },
  );

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  // In dynamic mode the gesture must cover a large active zone so a touch
  // anywhere on the left half springs the stick up there.
  return (
    <GestureDetector gesture={pan}>
      <View style={dynamic ? styles.zone : styles.fixedWrap}>
        <Animated.View style={[styles.base, baseStyle]} pointerEvents="none">
          <View style={styles.outer} />
          <View style={styles.crossH} />
          <View style={styles.crossV} />
          <Animated.View style={[styles.knob, knobStyle]} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function clampW(v: number, max: number): number {
  'worklet';
  return v < -max ? -max : v > max ? max : v;
}

const styles = StyleSheet.create({
  // dynamic: the whole left zone is touch-active; base is absolutely placed
  zone: { width: '100%', height: '100%' },
  fixedWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  base: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outer: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: THEME.outline.width + 1,
    borderColor: THEME.outline.color,
    backgroundColor: THEME.alpha.darkPanel,
    shadowColor: THEME.shadow.color,
    shadowOpacity: THEME.shadow.hardAlpha,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  crossH: {
    position: 'absolute',
    width: SIZE - 48,
    height: 4,
    backgroundColor: C.panelBorder,
    borderRadius: THEME.radius.xs,
  },
  crossV: {
    position: 'absolute',
    width: 4,
    height: SIZE - 48,
    backgroundColor: C.panelBorder,
    borderRadius: THEME.radius.xs,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: C.accent,
    borderWidth: THEME.outline.width + 1,
    borderColor: THEME.outline.color,
  },
});
