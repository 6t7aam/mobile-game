import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/RootNavigator';
import type { ResearchBranch, ResourceType } from '@/types';
import { RESOURCE_TYPES } from '@/types';
import { COLORS, FONTS, RESOURCE_LABEL } from '@/constants/gameConfig';
import { DarkButton } from '@/components/ui/DarkButton';
import { ResourceIcon } from '@/components/ui/ResourceIcon';
import { RESEARCH } from '@/constants/research';
import { useProgressStore } from '@/store/progressStore';
import { useGameStore } from '@/store/gameStore';
import { useBaseStore } from '@/store/baseStore';
import { useT, useTn } from '@/i18n/useT';

type Props = NativeStackScreenProps<RootStackParamList, 'Research'>;

const BRANCH_KEY: Record<ResearchBranch, string> = {
  weapons: 'research.weapons',
  fortification: 'research.fort',
  survival: 'research.survival',
};

const BRANCHES: ResearchBranch[] = ['weapons', 'fortification', 'survival'];

export function ResearchScreen({ navigation }: Props) {
  const t = useT();
  const tn = useTn();
  const completed = useProgressStore((s) => s.completedResearch);
  const completeResearch = useProgressStore((s) => s.completeResearch);
  const resources = useGameStore((s) => s.resources);
  const canAfford = useGameStore((s) => s.canAfford);
  const spendResources = useGameStore((s) => s.spendResources);
  const activeResearch = useGameStore((s) => s.activeResearch);
  const setActiveResearch = useGameStore((s) => s.setActiveResearch);
  // multi-day research needs a standing Council (research centre) at the base
  const hasCouncil = useBaseStore((s) =>
    s.buildings.some((b) => b.type === 'researchCenter' && b.hp > 0),
  );

  const isAvailable = (id: string) => {
    const node = RESEARCH.find((r) => r.id === id);
    if (!node || completed.includes(id)) return false;
    return node.prerequisites.every((p) => completed.includes(p));
  };

  const research = (id: string) => {
    const node = RESEARCH.find((r) => r.id === id);
    if (!node || !isAvailable(id) || activeResearch) return;
    if (node.days <= 0) {
      // tier-1 starters are instant
      if (spendResources(node.cost)) completeResearch(id);
      return;
    }
    if (!hasCouncil) return;
    if (spendResources(node.cost)) {
      setActiveResearch(id, node.days); // completes over `days` (advances each dawn)
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DarkButton label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{t('research.title')}</Text>
        <View style={styles.resBar}>
          {RESOURCE_TYPES.map((r) => (
            <View key={r} style={styles.resChip}>
              <ResourceIcon type={r} size={20} />
              <Text style={styles.resVal}>{Math.floor(resources[r])}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {!hasCouncil && (
          <Text style={styles.councilNote}>
            ⚠ {t('research.needCouncil')}
          </Text>
        )}
        {activeResearch && (
          <View style={styles.activeBanner}>
            <Text style={styles.activeBannerText}>
              {t('research.active', {
                name: tn('r', activeResearch.id, RESEARCH.find((r) => r.id === activeResearch.id)?.name ?? ''),
                n: activeResearch.daysLeft,
              })}
            </Text>
          </View>
        )}
        {BRANCHES.map((branch) => (
          <View key={branch} style={styles.branch}>
            <View style={styles.branchHeader}>
              <Text style={styles.branchTitle}>{t(BRANCH_KEY[branch])}</Text>
              <Text style={styles.branchCount}>
                {RESEARCH.filter((r) => r.branch === branch && completed.includes(r.id)).length}/
                {RESEARCH.filter((r) => r.branch === branch).length}
              </Text>
            </View>
            {RESEARCH.filter((r) => r.branch === branch).map((node) => {
              const done = completed.includes(node.id);
              const available = isAvailable(node.id);
              const affordable = canAfford(node.cost);
              return (
                <View
                  key={node.id}
                  style={[
                    styles.node,
                    done && styles.nodeDone,
                    node.isDoctrine && styles.nodeDoctrine,
                  ]}
                >
                  <View style={styles.nodeText}>
                    <Text style={styles.nodeName}>
                      {tn('r', node.id, node.name)} {done ? '✓' : ''}
                    </Text>
                    <Text style={styles.nodeDesc}>{tn('rd', node.id, node.description)}</Text>
                    {!done && !available && (
                      <Text style={styles.nodeLockHint}>
                        {t('research.requires', {
                          names: node.prerequisites
                            .filter((pr) => !completed.includes(pr))
                            .map((pr) => tn('r', pr, RESEARCH.find((r) => r.id === pr)?.name ?? pr))
                            .join(', '),
                        })}
                      </Text>
                    )}
                    {!done && Object.keys(node.cost).length > 0 && (
                      <Text style={[styles.nodeCost, !affordable && styles.nodeCostBad]}>
                        {(Object.entries(node.cost) as [ResourceType, number][])
                          .map(([k, v]) => `${RESOURCE_LABEL[k]}${v}`)
                          .join('  ')}
                      </Text>
                    )}
                  </View>
                  {!done && available && activeResearch?.id === node.id && (
                    <Text style={styles.researching}>{activeResearch.daysLeft}</Text>
                  )}
                  {!done && available && activeResearch?.id !== node.id && (
                    <DarkButton
                      label={node.days > 0 ? t('research.learnDays', { n: node.days }) : t('research.learn')}
                      disabled={!affordable || !!activeResearch || (node.days > 0 && !hasCouncil)}
                      onPress={() => research(node.id)}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  title: { fontFamily: FONTS.heading, color: COLORS.accent, fontSize: 20 },
  resBar: { flexDirection: 'row', gap: 12, marginLeft: 'auto', alignItems: 'center' },
  resChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resVal: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 15 },
  nodeCost: { fontFamily: FONTS.body, color: COLORS.resource, fontSize: 13, marginTop: 3 },
  nodeCostBad: { color: COLORS.danger },
  body: { padding: 16, gap: 24 },
  councilNote: {
    fontFamily: FONTS.body,
    color: COLORS.resource,
    fontSize: 14,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.accent,
    padding: 10,
  },
  branch: { gap: 8 },
  branchTitle: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 18, marginBottom: 4 },
  node: {
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
  branchHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  branchCount: { fontFamily: FONTS.heading, color: COLORS.resource, fontSize: 14 },
  activeBanner: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 10,
    padding: 10,
  },
  activeBannerText: { fontFamily: FONTS.body, color: COLORS.accent, fontSize: 14 },
  nodeLockHint: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 12, marginTop: 3 },
  nodeDone: { borderLeftColor: COLORS.resource, opacity: 0.7 },
  nodeDoctrine: { borderLeftColor: COLORS.accent },
  researching: { fontFamily: FONTS.body, color: COLORS.accent, fontSize: 14 },
  nodeText: { flex: 1 },
  nodeName: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 15 },
  nodeDesc: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 13, marginTop: 2 },
});
