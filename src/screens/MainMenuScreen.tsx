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
import { useT } from '@/i18n/useT';
import { useMetaStore } from '@/store/metaStore';

type Props = NativeStackScreenProps<RootStackParamList, 'MainMenu'>;

const C = THEME.colors;
const F = THEME.fonts;

export function MainMenuScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const t = useT();
  const crystals = useMetaStore((s) => s.crystals);
  const canClaimDaily = useMetaStore((s) => s.lastDailyClaim) !== todayStamp();
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
        {/* top-right: crystals + account */}
        <View style={styles.topRight} pointerEvents="box-none">
          <Pressable style={styles.crystalChip} onPress={() => navigation.navigate('Shop')}>
            <Text style={styles.crystalText}>💎 {crystals}</Text>
            {canClaimDaily && <View style={styles.dot} />}
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Account')}>
            <Text style={styles.iconBtnText}>👤</Text>
          </Pressable>
        </View>

        {/* hero */}
        <Text style={styles.title}>{t('game.title')}</Text>
        <Text style={styles.tagline}>{t('menu.tagline')}</Text>

        {/* world slots */}
        <View style={styles.slotsRow}>
          {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((id) => {
            const meta = slots.find((s) => s.id === id);
            return (
              <View key={id} style={[styles.slot, meta && styles.slotFilled]}>
                <Text style={styles.slotTitle}>{meta ? t('menu.world', { n: id }) : t('menu.emptySlot')}</Text>
                {meta ? (
                  <>
                    <Text style={styles.slotNight}>{t('menu.night', { n: meta.night })}</Text>
                    <Text style={styles.slotMeta}>
                      {t('menu.record', { b: meta.bestNight, k: meta.zombiesKilled })}
                    </Text>
                    <Text style={styles.slotDate}>{fmtDate(meta.updatedAt)}</Text>
                    <Pressable style={styles.slotPlay} onPress={() => void enterSlot(id)}>
                      <Text style={styles.slotPlayText}>{t('menu.continue')}</Text>
                    </Pressable>
                    <Pressable style={styles.slotDelete} onPress={() => void removeSlot(id)} hitSlop={6}>
                      <Text style={[styles.slotDeleteText, confirmDelete === id && styles.slotDeleteConfirm]}>
                        {confirmDelete === id ? t('menu.confirmDelete') : t('menu.delete')}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.slotEmptyHint}>{t('menu.startNew')}</Text>
                    <Pressable style={[styles.slotPlay, styles.slotNew]} onPress={() => void enterSlot(id)}>
                      <Text style={styles.slotPlayText}>{t('menu.newWorld')}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
        </View>

        {/* meta row */}
        <View style={styles.metaRow}>
          <Pressable style={[styles.metaBtn, styles.shopBtn]} onPress={() => navigation.navigate('Shop')}>
            <Text style={[styles.metaBtnText, styles.shopBtnText]}>🛒 {t('menu.shop')}</Text>
            {canClaimDaily && <Text style={styles.giftTag}>🎁</Text>}
          </Pressable>
          <Pressable style={styles.metaBtn} onPress={() => navigation.navigate('Arsenal')}>
            <Text style={styles.metaBtnText}>{t('menu.arsenal')}</Text>
          </Pressable>
          <Pressable style={styles.metaBtn} onPress={() => navigation.navigate('Codex')}>
            <Text style={styles.metaBtnText}>{t('menu.codex')}</Text>
          </Pressable>
          <Pressable style={styles.metaBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.metaBtnText}>{t('menu.settings')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const styles = StyleSheet.create({
  topRight: {
    position: 'absolute',
    top: 14,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
  },
  crystalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#7fd6e8',
    backgroundColor: 'rgba(10,12,18,0.75)',
  },
  crystalText: { fontFamily: F.heading, color: '#7fd6e8', fontSize: 14 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent,
    marginLeft: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.panelBorder,
    backgroundColor: 'rgba(10,12,18,0.75)',
  },
  iconBtnText: { fontSize: 15 },
  shopBtn: { borderColor: '#e8c84a' },
  shopBtnText: { color: '#e8c84a' },
  giftTag: { fontSize: 12, marginLeft: 4 },
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
