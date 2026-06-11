import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/RootNavigator';
import { COLORS, FONTS } from '@/constants/gameConfig';
import { DarkButton } from '@/components/ui/DarkButton';
import { ENEMY_LIST, BOSS_LIST } from '@/constants/enemies';
import { useProgressStore } from '@/store/progressStore';
import { useT, useTn } from '@/i18n/useT';

type Props = NativeStackScreenProps<RootStackParamList, 'Codex'>;

const THREAT_DOTS = (n: number) => '⬛'.repeat(n);

export function CodexScreen({ navigation }: Props) {
  const t = useT();
  const tn = useTn();
  const codex = useProgressStore((s) => s.codex);
  const stats = useProgressStore((s) => s.stats);

  const known = (id: string) => codex.includes(id as never);

  const totalEntries = ENEMY_LIST.length + BOSS_LIST.length;
  const unlocked = codex.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DarkButton label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{t('codex.title')}</Text>
        <Text style={styles.progress}>
          {unlocked}/{totalEntries}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* lifetime statistics */}
        <View style={styles.statPanel}>
          <Text style={styles.sectionTitle}>{t('codex.chronicle')}</Text>
          <View style={styles.statGrid}>
            <Stat label={t('codex.bestNight')} value={stats.bestNight} highlight />
            <Stat label={t('codex.nights')} value={stats.totalNightsSurvived} />
            <Stat label={t('codex.kills')} value={stats.totalZombiesKilled} />
            <Stat label={t('codex.deaths')} value={stats.totalDeaths} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('codex.bosses')}</Text>
        {BOSS_LIST.map((b) => {
          const seen = known(b.type);
          return (
            <View key={b.type} style={[styles.entry, styles.bossEntry, !seen && styles.locked]}>
              <View style={styles.entryHead}>
                <Text style={[styles.entryName, styles.bossName]}>
                  {seen ? tn('boss', b.type, b.name) : '???'}
                </Text>
                <Text style={styles.nightTag}>{t('codex.night', { n: b.appearsOnNight })}</Text>
              </View>
              <Text style={styles.lore}>
                {seen ? b.lore : t('codex.lockedEntry')}
              </Text>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>{t('codex.horde')}</Text>
        {ENEMY_LIST.map((e) => {
          const seen = known(e.type);
          return (
            <View key={e.type} style={[styles.entry, !seen && styles.locked]}>
              <View style={styles.entryHead}>
                <Text style={styles.entryName}>{seen ? tn('e', e.type, e.name) : '???'}</Text>
                <Text style={styles.threat}>{THREAT_DOTS(e.threat)}</Text>
              </View>
              {seen ? (
                <>
                  <Text style={styles.statsLine}>
                    {t('codex.stats', { hp: e.hp, dmg: e.damage, spd: e.speed })}
                  </Text>
                  {e.lore && <Text style={styles.lore}>{e.lore}</Text>}
                </>
              ) : (
                <Text style={styles.lore}>{t('codex.unknown')}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, highlight && styles.statHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  title: { fontFamily: FONTS.heading, color: COLORS.accent, fontSize: 20 },
  progress: { fontFamily: FONTS.body, color: COLORS.resource, fontSize: 15, marginLeft: 'auto' },
  body: { padding: 16, gap: 12 },
  sectionTitle: {
    fontFamily: FONTS.heading,
    color: COLORS.text,
    fontSize: 18,
    marginTop: 12,
    marginBottom: 2,
  },
  statPanel: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    padding: 16,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  statCell: { width: '50%', paddingVertical: 6 },
  statValue: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 26 },
  statHighlight: { color: COLORS.accent },
  statLabel: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 13 },
  entry: {
    backgroundColor: COLORS.panel,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.inactive,
    padding: 12,
  },
  bossEntry: { borderLeftColor: COLORS.danger },
  locked: { opacity: 0.5 },
  entryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryName: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 16 },
  bossName: { fontFamily: FONTS.heading, color: COLORS.danger },
  nightTag: { fontFamily: FONTS.body, color: COLORS.resource, fontSize: 12 },
  threat: { fontSize: 10, letterSpacing: 2 },
  statsLine: { fontFamily: FONTS.body, color: COLORS.inactive, fontSize: 12, marginTop: 4 },
  lore: {
    fontFamily: FONTS.body,
    color: COLORS.text,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 18,
    opacity: 0.85,
  },
});
