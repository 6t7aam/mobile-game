/**
 * Main menu — hero title over the living ash backdrop, three world slots
 * (continue / new world / delete), and the meta screens. Worlds persist fully:
 * leaving and re-entering a slot resumes exactly where you left off.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/RootNavigator';
import { MenuScene } from '@/components/ui/MenuScene';
import { playSfx } from '@/audio/AudioManager';
import { hapticSelect, hapticError } from '@/systems/haptics';
import {
  SLOT_COUNT,
  type SlotMeta,
  listSlots,
  loadSlot,
  newWorldInSlot,
  deleteSlot,
  saveToSlot,
  getActiveSlot,
} from '@/save/slots';
import { THEME } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MainMenu'>;

const C = THEME.colors;
const F = THEME.fonts;

export function MainMenuScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const [slots, setSlots] = useState<SlotMeta[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const refresh = useCallback(() => {
    void listSlots().then(setSlots);
  }, []);

  useFocusEffect(refresh);

  // Returning to the menu from a world snapshots that world so nothing is lost.
  useEffect(() => {
    void (async () => {
      const active = await getActiveSlot();
      if (active !== null) {
        await saveToSlot(active);
        refresh();
      }
    })();
  }, [refresh]);

  const enterSlot = async (id: number) => {
    hapticSelect();
    playSfx('ui_click');
    const existing = slots.find((s) => s.id === id);
    if (existing) {
      const ok = await loadSlot(id);
      if (!ok) {
        await newWorldInSlot(id);
      }
    } else {
      await newWorldInSlot(id);
    }
    navigation.navigate('World');
  };

  const removeSlot = async (id: number) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      hapticError();
      setTimeout(() => setConfirmDelete((c) => (c === id ? null : c)), 2500);
      return;
    }
    await deleteSlot(id);
    setConfirmDelete(null);
    refresh();
  };

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')} ${d
      .getHours()
      .toString()
      .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <MenuScene width={width} height={height} mood="menu" />

      <View style={styles.content} pointerEvents="box-none">
        {/* hero */}
        <Text style={styles.title}>ПЕПЕЛЬНЫЙ ПРЕДЕЛ</Text>
        <Text style={styles.tagline}>Сколько ночей ты продержишься?</Text>

        {/* world slots */}
        <View style={styles.slotsRow}>
          {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((id) => {
            const meta = slots.find((s) => s.id === id);
            return (
              <View key={id} style={[styles.slot, meta && styles.slotFilled]}>
                <Text style={styles.slotTitle}>{meta ? `Мир ${id}` : 'Пустой слот'}</Text>
                {meta ? (
                  <>
                    <Text style={styles.slotNight}>Ночь {meta.night}</Text>
                    <Text style={styles.slotMeta}>
                      Рекорд: {meta.bestNight} · убито {meta.zombiesKilled}
                    </Text>
                    <Text style={styles.slotDate}>{fmtDate(meta.updatedAt)}</Text>
                    <Pressable style={styles.slotPlay} onPress={() => void enterSlot(id)}>
                      <Text style={styles.slotPlayText}>Продолжить</Text>
                    </Pressable>
                    <Pressable style={styles.slotDelete} onPress={() => void removeSlot(id)} hitSlop={6}>
                      <Text style={[styles.slotDeleteText, confirmDelete === id && styles.slotDeleteConfirm]}>
                        {confirmDelete === id ? 'Точно удалить?' : 'Удалить'}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.slotEmptyHint}>Начни новое выживание</Text>
                    <Pressable style={[styles.slotPlay, styles.slotNew]} onPress={() => void enterSlot(id)}>
                      <Text style={styles.slotPlayText}>Новый мир</Text>
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
        </View>

        {/* meta row */}
        <View style={styles.metaRow}>
          <Pressable style={styles.metaBtn} onPress={() => navigation.navigate('Arsenal')}>
            <Text style={styles.metaBtnText}>Арсенал</Text>
          </Pressable>
          <Pressable style={styles.metaBtn} onPress={() => navigation.navigate('Codex')}>
            <Text style={styles.metaBtnText}>Кодекс</Text>
          </Pressable>
          <Pressable style={styles.metaBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.metaBtnText}>Настройки</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: {
    fontFamily: F.display,
    color: C.accent,
    fontSize: 52,
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: THEME.alpha.black80,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 4 },
  },
  tagline: { fontFamily: F.body, color: C.textMuted, fontSize: 17, fontStyle: 'italic', marginTop: 2 },

  slotsRow: { flexDirection: 'row', gap: 16, marginTop: 26 },
  slot: {
    width: 218,
    minHeight: 178,
    borderRadius: THEME.radius.md,
    borderWidth: THEME.outline.width,
    borderColor: C.panelBorder,
    backgroundColor: THEME.alpha.darkPanel,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  slotFilled: { borderColor: C.accent },
  slotTitle: { fontFamily: F.heading, color: C.text, fontSize: 18 },
  slotNight: { fontFamily: F.display, color: C.resource, fontSize: 26, lineHeight: 30 },
  slotMeta: { fontFamily: F.body, color: C.textMuted, fontSize: 13 },
  slotDate: { fontFamily: F.body, color: C.inactive, fontSize: 12 },
  slotEmptyHint: { fontFamily: F.body, color: C.inactive, fontSize: 14, marginTop: 14 },
  slotPlay: {
    marginTop: 10,
    width: '100%',
    paddingVertical: 10,
    borderRadius: THEME.radius.sm,
    backgroundColor: C.accent,
    borderWidth: THEME.outline.width,
    borderColor: THEME.outline.color,
    alignItems: 'center',
  },
  slotNew: { backgroundColor: C.panelRaised, borderColor: C.accent },
  slotPlayText: { fontFamily: F.heading, color: C.text, fontSize: 15 },
  slotDelete: { marginTop: 6 },
  slotDeleteText: { fontFamily: F.body, color: C.inactive, fontSize: 13 },
  slotDeleteConfirm: { color: C.danger },

  metaRow: { flexDirection: 'row', gap: 14, marginTop: 24 },
  metaBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.alpha.darkPanel,
    borderWidth: THEME.outline.thin,
    borderColor: C.panelBorder,
  },
  metaBtnText: { fontFamily: F.heading, color: C.text, fontSize: 15 },
});
