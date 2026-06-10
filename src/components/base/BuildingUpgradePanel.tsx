import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { PlacedBuilding, ResourceBag, ResourceType } from '@/types';
import { COLORS, FONTS, RESOURCE_LABEL } from '@/constants/gameConfig';
import { BUILDINGS } from '@/constants/buildings';
import { DarkButton } from '@/components/ui/DarkButton';
import { BuildingIcon } from '@/components/base/BuildingIcon';
import { THEME } from '@/theme';

/** Resource cost to upgrade a building from its current level to the next. */
export function upgradeCost(b: PlacedBuilding): Partial<ResourceBag> {
  const def = BUILDINGS[b.type];
  const growth = Math.pow(def.scaling.costGrowth, b.level - 1);
  const out: Partial<ResourceBag> = {};
  (Object.entries(def.scaling.upgradeBaseCost) as [ResourceType, number][]).forEach(([k, v]) => {
    out[k] = Math.round(v * growth);
  });
  return out;
}

/** Half the build cost, refunded on sell. */
export function sellRefund(b: PlacedBuilding): Partial<ResourceBag> {
  const def = BUILDINGS[b.type];
  const out: Partial<ResourceBag> = {};
  (Object.entries(def.buildCost) as [ResourceType, number][]).forEach(([k, v]) => {
    out[k] = Math.floor(v * 0.5);
  });
  return out;
}

interface PanelProps {
  building: PlacedBuilding;
  hpMax: number;
  canAfford: (c: Partial<ResourceBag>) => boolean;
  onUpgrade: () => void;
  onSell: () => void;
  onToggleGate: () => void;
  onClose: () => void;
}

export function BuildingUpgradePanel({
  building,
  hpMax,
  canAfford,
  onUpgrade,
  onSell,
  onToggleGate,
  onClose,
}: PanelProps) {
  const def = BUILDINGS[building.type];
  const maxed = building.level >= def.maxLevel;
  const cost = upgradeCost(building);
  const affordable = canAfford(cost);

  const y = useSharedValue(40);
  const op = useSharedValue(0);
  useEffect(() => {
    y.value = withTiming(0, { duration: 220 });
    op.value = withTiming(1, { duration: 220 });
  }, [y, op]);
  const anim = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: y.value }] }));

  return (
    <Animated.View style={[styles.panel, anim]}>
      <View style={styles.topRow}>
        <View style={styles.icon}>
          <BuildingIcon type={building.type} level={building.level} size={64} />
        </View>
        <View style={styles.headInfo}>
          <View style={styles.header}>
            <Text style={styles.name}>{def.name}</Text>
            <Text style={[styles.level, maxed && styles.levelMax]}>
              {maxed ? 'МАКС' : `ур. ${building.level}/${def.maxLevel}`}
            </Text>
          </View>
          <Text style={styles.desc}>{def.description}</Text>
          <Text style={styles.hp}>HP: {Math.round(building.hp)}/{hpMax}</Text>
        </View>
      </View>

      {!maxed && (
        <Text style={[styles.cost, !affordable && styles.costBad]}>
          {affordable ? 'Улучшение: ' : 'Нужно ещё: '}
          {(Object.entries(cost) as [ResourceType, number][])
            .map(([k, v]) => `${RESOURCE_LABEL[k]}${v}`)
            .join('  ')}
        </Text>
      )}
      {maxed && <Text style={styles.maxNote}>★ Максимальный уровень ★</Text>}

      <View style={styles.actions}>
        {building.type === 'shelter' ? null : building.type === 'gate' ? (
          <DarkButton
            label={building.open ? 'Закрыть' : 'Открыть'}
            variant="ghost"
            onPress={onToggleGate}
          />
        ) : (
          <DarkButton label="Снести" variant="danger" onPress={onSell} />
        )}
        {!maxed && (
          <DarkButton
            label={affordable ? 'Улучшить' : 'Нет ресурсов'}
            disabled={!affordable}
            onPress={onUpgrade}
          />
        )}
        <DarkButton label="✕" variant="ghost" onPress={onClose} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.accent,
    padding: 14,
    gap: 6,
    minWidth: 280,
  },
  topRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  icon: { borderWidth: 1, borderColor: COLORS.panelBorder, backgroundColor: THEME.colors.background },
  headInfo: { flex: 1, gap: 3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 16 },
  level: { fontFamily: FONTS.body, color: COLORS.resource, fontSize: 14 },
  levelMax: { color: COLORS.resource, fontFamily: FONTS.heading },
  desc: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 12 },
  hp: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 13 },
  cost: { fontFamily: FONTS.body, color: COLORS.resource, fontSize: 13 },
  costBad: { color: COLORS.danger },
  maxNote: { fontFamily: FONTS.heading, color: COLORS.resource, fontSize: 13, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' },
});
