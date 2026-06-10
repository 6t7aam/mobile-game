import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

import type { IntermediateType, ResourceType } from '@/types';
import { COLORS, FONTS, RESOURCE_LABEL, INTERMEDIATE_LABEL, PRODUCTION_RECIPES } from '@/constants/gameConfig';
import { THEME } from '@/theme';

interface CraftBarProps {
  intermediates: Record<IntermediateType, number>;
  onCraft: (output: IntermediateType, count: number) => void;
}

/** Horizontal crafting strip: turn base resources into ammo, components, etc. */
export function CraftBar({ intermediates, onCraft }: CraftBarProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {PRODUCTION_RECIPES.map((r) => {
        const inputs = [
          ...(Object.entries(r.inputs) as [ResourceType, number][]).map(
            ([k, v]) => `${RESOURCE_LABEL[k]}${v}`,
          ),
          ...(r.intermediateInputs
            ? (Object.entries(r.intermediateInputs) as [IntermediateType, number][]).map(
                ([k, v]) => `${INTERMEDIATE_LABEL[k]}${v}`,
              )
            : []),
        ].join(' ');
        return (
          <View key={r.id} style={styles.item}>
            <Text style={styles.have}>
              {INTERMEDIATE_LABEL[r.output]} {Math.floor(intermediates[r.output])}
            </Text>
            <Text style={styles.recipe}>{inputs}</Text>
            <View style={styles.btns}>
              <Pressable style={styles.btn} onPress={() => onCraft(r.output, 1)}>
                <Text style={styles.btnText}>+1</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => onCraft(r.output, 10)}>
                <Text style={styles.btnText}>+10</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 10, paddingVertical: 6, gap: 8 },
  item: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 6,
    minWidth: 110,
  },
  have: { fontFamily: FONTS.body, color: COLORS.resource, fontSize: 13 },
  recipe: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 11, marginVertical: 2 },
  btns: { flexDirection: 'row', gap: 6 },
  btn: {
    flex: 1,
    backgroundColor: THEME.colors.accentDark,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    paddingVertical: 2,
  },
  btnText: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 12 },
});
