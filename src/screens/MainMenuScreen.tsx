/**
 * Main menu — Minecraft-style: living backdrop, big logo with a pulsing yellow
 * splash line, a centered stack of wide bevelled stone buttons, and a separate
 * world-select view (3 slots). Version tag bottom-left, crystals top-right.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Animated, Easing } from 'react-native';
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
const VERSION = 'v1.0.0';
const SPLASH_KEYS = ['menu.tagline', 'splash.1', 'splash.2', 'splash.3', 'splash.4', 'splash.5'] as const;

/** Minecraft-style bevelled stone button. */
function McButton({
  label,
  onPress,
  small,
  gold,
  tag,
}: {
  label: string;
  onPress: () => void;
  small?: boolean;
  gold?: boolean;
  tag?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.mcBtn,
        small && styles.mcBtnSmall,
        gold && styles.mcBtnGold,
        pressed && styles.mcBtnPressed,
      ]}
    >
      <Text style={[styles.mcBtnText, gold && styles.mcBtnTextGold]} numberOfLines={1}>
        {label}
        {tag ? `  ${tag}` : ''}
      </Text>
    </Pressable>
  );
}

export function MainMenuScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const t = useT();
  const crystals = useMetaStore((s) => s.crystals);
  const canClaimDaily = useMetaStore((s) => s.lastDailyClaim) !== todayStamp();
  const [slots, setSlots] = useState<SlotMeta[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [view, setView] = useState<'main' | 'worlds'>('main');

  // Pulsing yellow splash, Minecraft-style. New line on every mount.
  const splashKey = useMemo(() => SPLASH_KEYS[Math.floor(Math.random() * SPLASH_KEYS.length)] ?? 'menu.tagline', []);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const splashScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

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

  const go = (screen: 'Shop' | 'Arsenal' | 'Codex' | 'Settings' | 'Account') => {
    hapticSelect();
    playSfx('ui_click');
    navigation.navigate(screen);
  };

  return (
    <View style={styles.container}>
      <MenuScene width={width} height={height} mood="menu" />

      <View style={styles.content} pointerEvents="box-none">
        {/* top-right: crystals */}
        <View style={styles.topRight} pointerEvents="box-none">
          <Pressable style={styles.crystalChip} onPress={() => go('Shop')}>
            <Text style={styles.crystalText}>💎 {crystals}</Text>
            {canClaimDaily && <View style={styles.dot} />}
          </Pressable>
        </View>

        {view === 'main' ? (
          <>
            {/* logo + splash */}
            <View style={styles.logoWrap} pointerEvents="none">
              <Text style={styles.title}>{t('game.title')}</Text>
              <Animated.Text style={[styles.splash, { transform: [{ rotate: '-6deg' }, { scale: splashScale }] }]}>
                {t(splashKey)}
              </Animated.Text>
            </View>

            {/* Minecraft-style button stack */}
            <View style={styles.stack}>
              <McButton label={`▶  ${t('menu.play')}`} onPress={() => setView('worlds')} />
              <McButton
                label={`🛒  ${t('menu.shop')}`}
                gold
                tag={canClaimDaily ? '🎁' : undefined}
                onPress={() => go('Shop')}
              />
              <View style={styles.row}>
                <McButton small label={t('menu.arsenal')} onPress={() => go('Arsenal')} />
                <McButton small label={t('menu.codex')} onPress={() => go('Codex')} />
              </View>
              <View style={styles.row}>
                <McButton small label={t('menu.settings')} onPress={() => go('Settings')} />
                <McButton small label={t('menu.account')} onPress={() => go('Account')} />
              </View>
            </View>
          </>
        ) : (
          <>
            {/* world select, Minecraft server-list style */}
            <Text style={styles.worldsTitle}>{t('menu.selectWorld')}</Text>
            <View style={styles.worldList}>
              {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((id) => {
                const meta = slots.find((s) => s.id === id);
                return (
                  <View key={id} style={[styles.worldRow, meta && styles.worldRowFilled]}>
                    <View style={styles.worldInfo}>
                      <Text style={styles.worldName}>
                        {meta ? t('menu.world', { n: id }) : t('menu.emptySlot')}
                      </Text>
                      <Text style={styles.worldMeta} numberOfLines={1}>
                        {meta
                          ? `${t('menu.night', { n: meta.night })} · ${t('menu.record', { b: meta.bestNight, k: meta.zombiesKilled })} · ${fmtDate(meta.updatedAt)}`
                          : t('menu.startNew')}
                      </Text>
                    </View>
                    <Pressable style={[styles.worldBtn, !meta && styles.worldBtnNew]} onPress={() => void enterSlot(id)}>
                      <Text style={styles.worldBtnText}>{meta ? t('menu.continue') : t('menu.newWorld')}</Text>
                    </Pressable>
                    {meta && (
                      <Pressable style={styles.worldDelete} onPress={() => void removeSlot(id)} hitSlop={6}>
                        <Text style={[styles.worldDeleteText, confirmDelete === id && styles.worldDeleteConfirm]}>
                          {confirmDelete === id ? t('menu.confirmDelete') : '🗑'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
            <View style={styles.worldsBack}>
              <McButton small label={t('common.back')} onPress={() => setView('main')} />
            </View>
          </>
        )}

        {/* version, Minecraft corner text */}
        <Text style={styles.version}>
          {t('game.title')} {VERSION}
        </Text>
      </View>
    </View>
  );
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const BTN_W = 340;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },

  topRight: {
    position: 'absolute',
    top: 12,
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
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.55)',
    backgroundColor: 'rgba(20,24,32,0.85)',
    borderTopColor: 'rgba(160,200,220,0.5)',
  },
  crystalText: { fontFamily: F.heading, color: '#7fd6e8', fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, marginLeft: 6 },

  logoWrap: { alignItems: 'center', marginBottom: 14 },
  title: {
    fontFamily: F.display,
    color: C.accent,
    fontSize: 46,
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 2,
    textShadowOffset: { width: 3, height: 3 },
  },
  splash: {
    position: 'absolute',
    right: -54,
    bottom: -4,
    fontFamily: F.heading,
    fontStyle: 'italic',
    color: '#ffff55',
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 1,
    textShadowOffset: { width: 2, height: 2 },
  },

  stack: { gap: 8, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 8, width: BTN_W },

  mcBtn: {
    width: BTN_W,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6e6e6e',
    borderWidth: 2,
    borderColor: '#000',
    borderTopColor: '#a8a8a8',
    borderLeftColor: '#8a8a8a',
    borderRadius: 2,
  },
  mcBtnSmall: { flex: 1, width: undefined },
  mcBtnGold: {
    backgroundColor: '#8a6d2f',
    borderTopColor: '#d9b95c',
    borderLeftColor: '#b8973f',
  },
  mcBtnPressed: { backgroundColor: '#565656', borderTopColor: '#6e6e6e' },
  mcBtnText: {
    fontFamily: F.heading,
    color: '#fff',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 0,
    textShadowOffset: { width: 2, height: 2 },
  },
  mcBtnTextGold: { color: '#ffe9a8' },

  worldsTitle: {
    fontFamily: F.heading,
    color: C.text,
    fontSize: 22,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  worldList: { gap: 6, width: 560 },
  worldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(12,14,18,0.96)',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.6)',
    borderRadius: 2,
  },
  worldRowFilled: { borderColor: '#888' },
  worldInfo: { flex: 1 },
  worldName: { fontFamily: F.heading, color: C.text, fontSize: 16 },
  worldMeta: { fontFamily: F.body, color: C.textMuted, fontSize: 12 },
  worldBtn: {
    paddingHorizontal: 16,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6e6e6e',
    borderWidth: 2,
    borderColor: '#000',
    borderTopColor: '#a8a8a8',
    borderLeftColor: '#8a8a8a',
    borderRadius: 2,
  },
  worldBtnNew: { backgroundColor: '#3f6d3a', borderTopColor: '#7fae6f' },
  worldBtnText: { fontFamily: F.heading, color: '#fff', fontSize: 13 },
  worldDelete: { paddingHorizontal: 4 },
  worldDeleteText: { fontSize: 16, color: C.inactive },
  worldDeleteConfirm: { color: C.danger, fontFamily: F.heading, fontSize: 12 },
  worldsBack: { marginTop: 12, width: 200 },

  version: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    fontFamily: F.body,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
});
