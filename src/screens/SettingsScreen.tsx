import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/RootNavigator';
import { COLORS, FONTS } from '@/constants/gameConfig';
import { DarkButton } from '@/components/ui/DarkButton';
import { SettingRow, VolumeBar, Toggle, Choice } from '@/components/ui/SettingRow';
import { useProgressStore } from '@/store/progressStore';
import { useBaseStore } from '@/store/baseStore';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore, type Quality } from '@/store/settingsStore';
import { LANGS } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { hapticSelect } from '@/systems/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const t = useT();
  const stats = useProgressStore((s) => s.stats);
  const resetMeta = useProgressStore((s) => s.resetMeta);
  const resetLayout = useBaseStore((s) => s.resetLayout);
  const startNewRun = useGameStore((s) => s.startNewRun);

  const s = useSettingsStore();

  const wipeProgress = () => {
    resetMeta();
    resetLayout();
    startNewRun();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DarkButton label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionTitle}>{t('settings.audio')}</Text>
        <SettingRow label={t('settings.music')}>
          <VolumeBar value={s.musicVolume} onChange={s.setMusic} />
        </SettingRow>
        <SettingRow label={t('settings.sfx')}>
          <VolumeBar value={s.sfxVolume} onChange={s.setSfx} />
        </SettingRow>

        <Text style={styles.sectionTitle}>{t('settings.title')}</Text>
        <SettingRow label={t('settings.haptics')}>
          <Toggle
            value={s.haptics}
            on={t('settings.on')}
            off={t('settings.off')}
            onPress={() => {
              s.toggleHaptics();
              hapticSelect();
            }}
          />
        </SettingRow>
        <SettingRow label={t('settings.reducedMotion')}>
          <Toggle value={s.reducedMotion} on={t('settings.on')} off={t('settings.off')} onPress={s.toggleReducedMotion} />
        </SettingRow>
        <SettingRow label={t('settings.quality')}>
          <Choice<Quality>
            options={['low', 'high']}
            value={s.quality}
            labels={{ low: t('settings.qualityLow'), high: t('settings.qualityHigh') }}
            onPick={s.setQuality}
          />
        </SettingRow>
        <SettingRow label={t('settings.language')}>
          <Pressable style={styles.langBtn} onPress={() => navigation.navigate('Language')}>
            <Text style={styles.langBtnText}>
              {LANGS.find((l) => l.code === s.language)?.flag} {LANGS.find((l) => l.code === s.language)?.native}
            </Text>
          </Pressable>
        </SettingRow>

        <Text style={styles.sectionTitle}>{t('settings.statsTitle')}</Text>
        <Text style={styles.stat}>{t('settings.bestNight')}: {stats.bestNight}</Text>
        <Text style={styles.stat}>{t('settings.nightsSurvived')}: {stats.totalNightsSurvived}</Text>
        <Text style={styles.stat}>{t('settings.zombiesKilled')}: {stats.totalZombiesKilled}</Text>
        <Text style={styles.stat}>{t('settings.deaths')}: {stats.totalDeaths}</Text>

        <View style={styles.danger}>
          <DarkButton label={t('settings.wipe')} variant="danger" onPress={wipeProgress} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  title: { fontFamily: FONTS.heading, color: COLORS.accent, fontSize: 20 },
  body: { padding: 24, paddingTop: 8 },
  sectionTitle: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 18, marginTop: 20, marginBottom: 4 },
  stat: { fontFamily: FONTS.body, color: COLORS.resource, fontSize: 16, marginTop: 4 },
  danger: { marginTop: 32 },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.panel,
  },
  langBtnText: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 15 },
});
