import { View, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS, FONTS } from '@/constants/gameConfig';
import { THEME } from '@/theme';

/** A labelled settings row with arbitrary control on the right. */
export function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.control}>{children}</View>
    </View>
  );
}

/** Tap-segmented volume bar (0..1 in 10 steps) — no external slider dep. */
export function VolumeBar({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const steps = 10;
  const filled = Math.round(value * steps);
  return (
    <View style={styles.bar}>
      {Array.from({ length: steps }).map((_, i) => (
        <Pressable key={i} style={styles.segWrap} onPress={() => onChange((i + 1) / steps)} hitSlop={6}>
          <View style={[styles.seg, i < filled && styles.segOn]} />
        </Pressable>
      ))}
    </View>
  );
}

/** On/off toggle. */
export function Toggle({ value, on, off, onPress }: { value: boolean; on: string; off: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.toggle, value && styles.toggleOn]} onPress={onPress}>
      <Text style={[styles.toggleText, value && styles.toggleTextOn]}>{value ? on : off}</Text>
    </Pressable>
  );
}

/** Multi-choice segmented selector. */
export function Choice<T extends string>({
  options,
  value,
  labels,
  onPick,
}: {
  options: readonly T[];
  value: T;
  labels: Record<T, string>;
  onPick: (v: T) => void;
}) {
  return (
    <View style={styles.choice}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          style={[styles.choiceItem, opt === value && styles.choiceItemOn]}
          onPress={() => onPick(opt)}
        >
          <Text style={[styles.choiceText, opt === value && styles.choiceTextOn]}>{labels[opt]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.panelBorder,
  },
  label: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 16 },
  control: { flexDirection: 'row', alignItems: 'center' },
  bar: { flexDirection: 'row', gap: 3 },
  segWrap: { paddingVertical: 4 },
  seg: { width: 12, height: 18, backgroundColor: THEME.colors.black, borderWidth: 1, borderColor: COLORS.panelBorder },
  segOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  toggle: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: COLORS.inactive,
    backgroundColor: COLORS.panel,
  },
  toggleOn: { borderColor: COLORS.accent, backgroundColor: THEME.colors.accentDark },
  toggleText: { fontFamily: FONTS.heading, color: COLORS.inactive, fontSize: 13, letterSpacing: 1 },
  toggleTextOn: { color: COLORS.text },
  choice: { flexDirection: 'row', gap: 6 },
  choiceItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    backgroundColor: COLORS.panel,
  },
  choiceItemOn: { borderColor: COLORS.accent, backgroundColor: THEME.colors.accentDark },
  choiceText: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 14 },
  choiceTextOn: { color: COLORS.text },
});
