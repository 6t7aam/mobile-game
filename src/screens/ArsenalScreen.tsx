import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/RootNavigator';
import type { WeaponBranch, WeaponDef, ResourceType } from '@/types';
import { COLORS, FONTS, RESOURCE_LABEL } from '@/constants/gameConfig';
import { DarkButton } from '@/components/ui/DarkButton';
import { ResourceIcon } from '@/components/ui/ResourceIcon';
import { WEAPON_LIST, weaponUpgradeCost, weaponStatsAtLevel } from '@/constants/weapons';
import { resolveModifiers } from '@/systems/modifiers';
import { useProgressStore } from '@/store/progressStore';
import { usePlayerStore } from '@/store/playerStore';
import { useGameStore } from '@/store/gameStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Arsenal'>;

const BRANCH_LABEL: Record<WeaponBranch, string> = {
  primitive: '🪓 Примитивное',
  firearm: '🔫 Огнестрел',
  heavy: '💣 Тяжёлое',
};

const BRANCHES: WeaponBranch[] = ['primitive', 'firearm', 'heavy'];

/** Research that unlocks each branch (см. дерево технологий). */
const BRANCH_RESEARCH: Partial<Record<WeaponBranch, string>> = {
  firearm: 'Порох',
  heavy: 'Тяжёлое Вооружение',
};

export function ArsenalScreen({ navigation }: Props) {
  const completedResearch = useProgressStore((s) => s.completedResearch);
  const owned = useProgressStore((s) => s.ownedWeapons);
  const buyWeapon = useProgressStore((s) => s.buyWeapon);
  const upgradeWeapon = useProgressStore((s) => s.upgradeWeapon);
  const equipped = usePlayerStore((s) => s.equipped);
  const equip = usePlayerStore((s) => s.equip);
  const resources = useGameStore((s) => s.resources);
  const canAfford = useGameStore((s) => s.canAfford);
  const spendResources = useGameStore((s) => s.spendResources);

  const mods = resolveModifiers(completedResearch);

  const ownsId = (id: string) => owned.some((w) => w.id === id);
  const levelOf = (id: string) => owned.find((w) => w.id === id)?.level ?? 0;

  const buy = (w: WeaponDef) => {
    if (spendResources(w.purchaseCost)) buyWeapon(w.id);
  };

  const upgrade = (w: WeaponDef) => {
    const cost = weaponUpgradeCost(w, levelOf(w.id));
    if (cost && spendResources(cost)) upgradeWeapon(w.id);
  };

  const costLabel = (cost: Partial<Record<ResourceType, number>>) =>
    (Object.entries(cost) as [ResourceType, number][])
      .map(([k, v]) => `${RESOURCE_LABEL[k]}${v}`)
      .join(' ') || 'беспл.';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DarkButton label="‹ Назад" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Арсенал</Text>
        <View style={styles.resBar}>
          {(Object.entries(resources) as [ResourceType, number][]).map(([k, v]) => (
            <View key={k} style={styles.resChip}>
              <ResourceIcon type={k} size={18} />
              <Text style={styles.resItem}>{Math.floor(v)}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {BRANCHES.map((branch) => {
          const branchLocked = !mods.unlockedBranches.has(branch);
          return (
          <View key={branch} style={styles.branch}>
            <View style={styles.branchHeader}>
              <Text style={styles.branchTitle}>{BRANCH_LABEL[branch]}</Text>
              <Text style={styles.branchCount}>
                {WEAPON_LIST.filter((w) => w.branch === branch && ownsId(w.id)).length}/
                {WEAPON_LIST.filter((w) => w.branch === branch).length}
              </Text>
            </View>
            {branchLocked && (
              <Text style={styles.branchLockNote}>
                🔒 Ветка закрыта — изучите «{BRANCH_RESEARCH[branch]}» в Дереве Технологий
              </Text>
            )}
            {WEAPON_LIST.filter((w) => w.branch === branch).map((w) => {
              const isOwned = ownsId(w.id);
              const isEquipped = equipped === w.id;
              const prereqMet = !branchLocked && w.prerequisites.every(ownsId);
              const affordable = canAfford(w.purchaseCost);
              const level = levelOf(w.id);
              const upCost = isOwned ? weaponUpgradeCost(w, level) : null;
              const maxed = isOwned && level >= w.maxLevel;
              const stats = weaponStatsAtLevel(w, Math.max(1, level));
              const nextStats = upCost ? weaponStatsAtLevel(w, level + 1) : null;
              const canUp = !!upCost && canAfford(upCost);
              return (
                <View key={w.id} style={[styles.weapon, isEquipped && styles.weaponEquipped]}>
                  <View style={styles.weaponText}>
                    <View style={styles.nameRow}>
                      <Text style={styles.weaponName}>{w.name}</Text>
                      {isEquipped && <Text style={styles.equippedBadge}>В РУКАХ</Text>}
                      {isOwned && (
                        <View style={styles.pips}>
                          {Array.from({ length: w.maxLevel }).map((_, i) => (
                            <View
                              key={i}
                              style={[styles.pip, i < level && styles.pipOn]}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                    <View style={styles.statRow}>
                      <Text style={styles.statChip}>
                        💥 {Math.round(isOwned ? stats.damage : w.damage)}
                        {nextStats && ` → ${Math.round(nextStats.damage)}`}
                      </Text>
                      <Text style={styles.statChip}>⏱ {w.fireRate}/с</Text>
                      <Text style={styles.statChip}>📏 {w.range}</Text>
                    </View>
                    <Text style={styles.ability}>⚡ {w.ability.name}: {w.ability.description}</Text>
                    {isOwned && !maxed && upCost && (
                      <Text style={styles.upCost}>Улучшение: {costLabel(upCost)}</Text>
                    )}
                    {!isOwned && prereqMet && (
                      <Text style={styles.upCost}>Цена: {costLabel(w.purchaseCost)}</Text>
                    )}
                  </View>

                  <View style={styles.actions}>
                    {isOwned ? (
                      <>
                        <DarkButton
                          label={isEquipped ? 'В руках' : 'Взять'}
                          variant={isEquipped ? 'ghost' : 'primary'}
                          disabled={isEquipped}
                          onPress={() => equip(w.id)}
                        />
                        {maxed ? (
                          <Text style={styles.maxed}>MAX</Text>
                        ) : (
                          <DarkButton
                            label={`Ур. ${level + 1}`}
                            variant="ghost"
                            disabled={!canUp}
                            onPress={() => upgrade(w)}
                          />
                        )}
                      </>
                    ) : prereqMet ? (
                      <DarkButton
                        label="Купить"
                        disabled={!affordable}
                        onPress={() => buy(w)}
                      />
                    ) : (
                      <Text style={styles.locked}>🔒</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  title: { fontFamily: FONTS.heading, color: COLORS.accent, fontSize: 20 },
  resBar: { flexDirection: 'row', gap: 10, marginLeft: 'auto', alignItems: 'center' },
  resChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  resItem: { fontFamily: FONTS.body, color: COLORS.resource, fontSize: 14 },
  body: { padding: 16, gap: 24 },
  branch: { gap: 8 },
  branchTitle: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 18, marginBottom: 4 },
  branchLockNote: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 13, marginBottom: 6 },
  weapon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.inactive,
    borderRadius: 10,
    gap: 12,
  },
  weaponEquipped: { borderLeftColor: COLORS.accent, borderColor: COLORS.accent },
  equippedBadge: {
    fontFamily: FONTS.heading,
    color: COLORS.background,
    backgroundColor: COLORS.accent,
    fontSize: 9,
    letterSpacing: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  branchHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  branchCount: { fontFamily: FONTS.heading, color: COLORS.resource, fontSize: 14 },
  statRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  statChip: {
    fontFamily: FONTS.body,
    color: COLORS.text,
    fontSize: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  weaponText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weaponName: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 15 },
  pips: { flexDirection: 'row', gap: 3 },
  pip: {
    width: 7,
    height: 7,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    backgroundColor: 'transparent',
  },
  pipOn: { backgroundColor: COLORS.resource, borderColor: COLORS.resource },
  ability: { fontFamily: FONTS.body, color: COLORS.accent, fontSize: 11, marginTop: 3 },
  upCost: { fontFamily: FONTS.body, color: COLORS.resource, fontSize: 12, marginTop: 3 },
  actions: { gap: 6, alignItems: 'stretch', minWidth: 110 },
  maxed: {
    fontFamily: FONTS.heading,
    color: COLORS.resource,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 6,
  },
  locked: { fontSize: 18, color: COLORS.inactive, paddingHorizontal: 12 },
});
