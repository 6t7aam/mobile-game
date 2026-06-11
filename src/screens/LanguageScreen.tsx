/**
 * Language picker — the very first screen on a fresh install (and reachable
 * from Settings). 20 most spoken languages, each with its flag and native
 * name. Picking one persists it and drops the player into the main menu.
 */

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/RootNavigator';
import { LANGS, type Language } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { useSettingsStore } from '@/store/settingsStore';
import { playSfx } from '@/audio/AudioManager';
import { hapticSelect } from '@/systems/haptics';
import { THEME } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Language'>;

const C = THEME.colors;
const F = THEME.fonts;

export function LanguageScreen({ navigation }: Props) {
  const t = useT();
  const current = useSettingsStore((s) => s.language);
  const chosen = useSettingsStore((s) => s.languageChosen);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const pick = (code: Language) => {
    hapticSelect();
    playSfx('ui_click');
    setLanguage(code);
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('MainMenu');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('lang.title')}</Text>
      <Text style={styles.subtitle}>{t('lang.subtitle')}</Text>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {LANGS.map((l) => {
          const active = chosen && l.code === current;
          return (
            <Pressable
              key={l.code}
              style={[styles.cell, active && styles.cellActive]}
              onPress={() => pick(l.code)}
            >
              <Text style={styles.flag}>{l.flag}</Text>
              <Text style={[styles.name, active && styles.nameActive]}>{l.native}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, alignItems: 'center', paddingTop: 26 },
  title: { fontFamily: F.display, color: C.accent, fontSize: 30, letterSpacing: 1 },
  subtitle: { fontFamily: F.body, color: C.textMuted, fontSize: 14, marginTop: 2, marginBottom: 14 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingBottom: 30,
    maxWidth: 860,
  },
  cell: {
    width: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.md,
    borderWidth: THEME.outline.thin,
    borderColor: C.panelBorder,
    backgroundColor: THEME.alpha.darkPanel,
  },
  cellActive: { borderColor: C.accent, backgroundColor: C.panelRaised },
  flag: { fontSize: 26 },
  name: { fontFamily: F.heading, color: C.text, fontSize: 15 },
  nameActive: { color: C.accent },
});
