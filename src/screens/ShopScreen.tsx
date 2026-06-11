/**
 * Shop: crystal packs (IAP via App Store / Google Play), the daily freebie,
 * premium shop-exclusive weapons and meme character skins. Tabbed layout
 * (crystals / premium / skins) tuned for landscape. All texts are localized;
 * purchases run through services/iap.ts (mocked outside store builds) and the
 * meta store.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/RootNavigator';
import { DarkButton } from '@/components/ui/DarkButton';
import { useT, useTn } from '@/i18n/useT';
import { useMetaStore, PREMIUM_WEAPON_PRICES, PREMIUM_WEAPON_IDS, dailyRewardAmount } from '@/store/metaStore';
import { CRYSTAL_PACKS, purchasePack, type CrystalPack } from '@/services/iap';
import { SKIN_LIST } from '@/constants/skins';
import { WEAPONS } from '@/constants/weapons';
import { playSfx } from '@/audio/AudioManager';
import { hapticSelect, hapticSuccess } from '@/systems/haptics';
import { THEME } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Shop'>;

const C = THEME.colors;
const F = THEME.fonts;
const CRYSTAL = '#7fd6e8';
const GOLD = '#e8c84a';

type Tab = 'crystals' | 'premium' | 'skins';

/** Bonus % vs the smallest pack's crystals-per-dollar rate (numeric → locale-safe). */
function packBonus(pack: CrystalPack): number {
  const base = CRYSTAL_PACKS[0];
  if (!base) return 0;
  const baseRate = base.crystals / parseFloat(base.priceLabel.replace('$', ''));
  const rate = pack.crystals / parseFloat(pack.priceLabel.replace('$', ''));
  return Math.round((rate / baseRate - 1) * 100);
}

export function ShopScreen({ navigation }: Props) {
  const t = useT();
  const tn = useTn();
  const meta = useMetaStore();
  const [tab, setTab] = useState<Tab>('crystals');
  const [pendingPack, setPendingPack] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const buyPack = async (pack: CrystalPack) => {
    if (pendingPack) return;
    hapticSelect();
    setPendingPack(pack.productId);
    const res = await purchasePack(pack);
    setPendingPack(null);
    if (res.ok) {
      meta.addCrystals(res.crystals);
      playSfx('crystal');
      hapticSuccess();
      flash(`${t('shop.purchased')} +${res.crystals} 💎`);
    }
  };

  const claimDaily = () => {
    const amount = meta.claimDaily();
    if (amount != null) {
      playSfx('crystal');
      hapticSuccess();
      flash(`+${amount} 💎`);
    }
  };

  const buyPremium = (id: (typeof PREMIUM_WEAPON_IDS)[number]) => {
    hapticSelect();
    if (meta.buyPremiumWeapon(id)) {
      playSfx('ui_buy');
      hapticSuccess();
      flash(t('shop.purchased'));
    } else {
      flash(t('shop.notEnough'));
    }
  };

  const canClaim = meta.lastDailyClaim !== todayStampLocal();

  const tabs: { id: Tab; label: string; emoji: string; alert?: boolean }[] = [
    { id: 'crystals', label: t('shop.crystals'), emoji: '💎', alert: canClaim },
    { id: 'premium', label: t('shop.premium'), emoji: '🔥' },
    { id: 'skins', label: t('shop.skins'), emoji: '🎭' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DarkButton label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{t('shop.title')}</Text>
        <View style={styles.tabBar}>
          {tabs.map(({ id, label, emoji, alert }) => (
            <Pressable
              key={id}
              style={[styles.tab, tab === id && styles.tabActive]}
              onPress={() => {
                hapticSelect();
                setTab(id);
              }}
            >
              <Text style={[styles.tabText, tab === id && styles.tabTextActive]} numberOfLines={1}>
                {emoji} {label}
              </Text>
              {alert && <View style={styles.tabDot} />}
            </Pressable>
          ))}
        </View>
        <View style={styles.balance}>
          <Text style={styles.balanceText}>💎 {meta.crystals}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {tab === 'crystals' && (
          <>
            {/* ----- daily freebie ----- */}
            <View style={[styles.dailyCard, !canClaim && styles.cardDim]}>
              <Text style={styles.dailyEmoji}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dailyTitle}>{t('shop.daily')}</Text>
                <Text style={styles.dailyAmount}>+{dailyRewardAmount()} 💎</Text>
                <Text style={styles.cardDesc}>{canClaim ? t('shop.dailyDesc') : t('shop.claimed')}</Text>
              </View>
              {canClaim ? (
                <Pressable style={styles.claimBtn} onPress={claimDaily}>
                  <Text style={styles.claimBtnText}>{t('shop.claim')}</Text>
                </Pressable>
              ) : (
                <Text style={styles.claimedMark}>✓</Text>
              )}
            </View>

            {/* ----- crystal packs ----- */}
            <View style={styles.row}>
              {CRYSTAL_PACKS.map((pack) => {
                const bonus = packBonus(pack);
                return (
                  <Pressable
                    key={pack.productId}
                    style={[styles.packCard, pack.bestValue && styles.packBest]}
                    onPress={() => void buyPack(pack)}
                  >
                    {pack.bestValue && (
                      <View style={styles.bestRibbon}>
                        <Text style={styles.bestRibbonText}>{t('shop.bestValue')}</Text>
                      </View>
                    )}
                    <Text style={styles.packEmoji}>{pack.emoji}</Text>
                    <Text style={styles.packCrystals}>{pack.crystals} 💎</Text>
                    <Text style={styles.packName} numberOfLines={1}>
                      {t(pack.nameKey)}
                    </Text>
                    {bonus > 0 ? (
                      <View style={styles.bonusChip}>
                        <Text style={styles.bonusChipText}>+{bonus}%</Text>
                      </View>
                    ) : (
                      <View style={styles.bonusSpacer} />
                    )}
                    <View style={[styles.priceTag, pack.bestValue && styles.priceTagBest]}>
                      <Text style={styles.priceText}>{pendingPack === pack.productId ? '…' : pack.priceLabel}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.note}>{t('shop.iapNote')}</Text>
          </>
        )}

        {tab === 'premium' && (
          <>
            {PREMIUM_WEAPON_IDS.map((id) => {
              const def = WEAPONS[id];
              const owned = meta.ownedPremium.includes(id);
              const price = PREMIUM_WEAPON_PRICES[id] ?? 0;
              return (
                <View key={id} style={[styles.weaponCard, owned && styles.cardOwned]}>
                  <View style={styles.weaponIcon}>
                    <Text style={styles.weaponEmoji}>{id === 'goldenMinigun' ? '✨' : '🔥'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.weaponName}>{tn('w', id, def.name)}</Text>
                    <View style={styles.statChips}>
                      <View style={styles.statChip}>
                        <Text style={styles.statChipText}>⚔️ {def.damage}</Text>
                      </View>
                      <View style={styles.statChip}>
                        <Text style={styles.statChipText}>⚡ {def.fireRate}/s</Text>
                      </View>
                      <View style={[styles.statChip, styles.statChipGold]}>
                        <Text style={[styles.statChipText, { color: GOLD }]} numberOfLines={1}>
                          {tn('a', def.ability.id, def.ability.name)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {owned ? (
                    <Text style={styles.ownedBadge}>✓ {t('shop.owned')}</Text>
                  ) : (
                    <Pressable style={styles.buyBtn} onPress={() => buyPremium(id)}>
                      <Text style={styles.buyBtnText}>{price} 💎</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </>
        )}

        {tab === 'skins' && (
          <>
            <Text style={styles.note}>{t('shop.skinNote')}</Text>
            <View style={styles.row}>
              {SKIN_LIST.map((skin) => {
                const owned = meta.ownedSkins.includes(skin.id);
                const equipped = meta.equippedSkin === skin.id;
                return (
                  <Pressable
                    key={skin.id}
                    style={[styles.skinCard, equipped && styles.skinEquipped]}
                    onPress={() => {
                      hapticSelect();
                      if (owned) {
                        meta.equipSkin(skin.id);
                        playSfx('ui_click');
                      } else if (meta.buySkin(skin.id)) {
                        playSfx('ui_buy');
                        hapticSuccess();
                        flash(t('shop.purchased'));
                      } else {
                        flash(t('shop.notEnough'));
                      }
                    }}
                  >
                    <View style={[styles.skinSwatch, { backgroundColor: skin.palette.skin }, owned && styles.skinSwatchOwned]}>
                      <Text style={styles.skinEmoji}>{skin.emoji}</Text>
                      {equipped && (
                        <View style={styles.equippedMark}>
                          <Text style={styles.equippedMarkText}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.skinName} numberOfLines={1}>
                      {t(`skin.${skin.id}`)}
                    </Text>
                    <View style={[styles.skinAction, equipped && styles.skinActionEquipped]}>
                      <Text style={[styles.skinActionText, equipped && { color: '#1b1207' }]} numberOfLines={1}>
                        {equipped
                          ? t('shop.equipped')
                          : owned
                            ? t('shop.equip')
                            : skin.cost === 0
                              ? t('shop.owned')
                              : `${skin.cost} 💎`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function todayStampLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontFamily: F.display, color: C.accent, fontSize: 24 },

  tabBar: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.panelBorder,
    backgroundColor: THEME.alpha.darkPanel,
  },
  tabActive: { borderColor: C.accent, backgroundColor: C.panelRaised },
  tabText: { fontFamily: F.heading, color: C.textMuted, fontSize: 13 },
  tabTextActive: { color: C.text },
  tabDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent, marginLeft: 5 },

  balance: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CRYSTAL,
    backgroundColor: THEME.alpha.darkPanel,
  },
  balanceText: { fontFamily: F.heading, color: CRYSTAL, fontSize: 16 },
  body: { padding: 16, paddingBottom: 40 },
  note: { fontFamily: F.body, color: C.textMuted, fontSize: 12, marginTop: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  dailyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    marginBottom: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: C.panelRaised,
  },
  cardDim: { opacity: 0.6, borderColor: C.panelBorder },
  dailyEmoji: { fontSize: 34 },
  dailyTitle: { fontFamily: F.heading, color: GOLD, fontSize: 14 },
  dailyAmount: { fontFamily: F.heading, color: CRYSTAL, fontSize: 22 },
  cardDesc: { fontFamily: F.body, color: C.textMuted, fontSize: 13, marginTop: 2 },
  claimBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: THEME.radius.sm,
    backgroundColor: C.accent,
    borderWidth: THEME.outline.width,
    borderColor: THEME.outline.color,
  },
  claimBtnText: { fontFamily: F.heading, color: '#1b1207', fontSize: 15 },
  claimedMark: { fontFamily: F.heading, color: C.accent, fontSize: 24, paddingHorizontal: 10 },

  packCard: {
    width: 134,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: C.panelBorder,
    backgroundColor: THEME.alpha.darkPanel,
    overflow: 'hidden',
  },
  packBest: { borderColor: GOLD, backgroundColor: 'rgba(60,48,18,0.45)' },
  bestRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: GOLD,
    paddingVertical: 2,
    alignItems: 'center',
  },
  bestRibbonText: { fontFamily: F.heading, color: '#1b1207', fontSize: 10, letterSpacing: 1 },
  packEmoji: { fontSize: 30, marginTop: 10 },
  packCrystals: { fontFamily: F.heading, color: CRYSTAL, fontSize: 17, marginTop: 4 },
  packName: { fontFamily: F.body, color: C.textMuted, fontSize: 11, marginTop: 2, textAlign: 'center' },
  bonusChip: {
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(127,214,232,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(127,214,232,0.45)',
  },
  bonusChipText: { fontFamily: F.heading, color: CRYSTAL, fontSize: 11 },
  bonusSpacer: { height: 21, marginTop: 5 },
  priceTag: {
    marginTop: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
    backgroundColor: C.accent,
    borderWidth: THEME.outline.width,
    borderColor: THEME.outline.color,
  },
  priceTagBest: { backgroundColor: GOLD },
  priceText: { fontFamily: F.heading, color: '#1b1207', fontSize: 14 },

  weaponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 10,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: C.panelRaised,
  },
  cardOwned: { borderColor: C.panelBorder, opacity: 0.85 },
  weaponIcon: {
    width: 52,
    height: 52,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,200,74,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232,200,74,0.4)',
  },
  weaponEmoji: { fontSize: 28 },
  weaponName: { fontFamily: F.heading, color: GOLD, fontSize: 16 },
  statChips: { flexDirection: 'row', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  statChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: C.panelBorder,
  },
  statChipGold: { borderColor: 'rgba(232,200,74,0.45)', backgroundColor: 'rgba(232,200,74,0.08)' },
  statChipText: { fontFamily: F.body, color: C.textMuted, fontSize: 11 },
  ownedBadge: { fontFamily: F.heading, color: C.accent, fontSize: 13, paddingHorizontal: 6 },
  buyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: THEME.radius.sm,
    backgroundColor: GOLD,
    borderWidth: THEME.outline.width,
    borderColor: THEME.outline.color,
  },
  buyBtnText: { fontFamily: F.heading, color: '#1b1207', fontSize: 14 },

  skinCard: {
    width: 108,
    alignItems: 'center',
    padding: 10,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: C.panelBorder,
    backgroundColor: THEME.alpha.darkPanel,
  },
  skinEquipped: { borderColor: C.accent, backgroundColor: C.panelRaised },
  skinSwatch: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.4)',
  },
  skinSwatchOwned: { borderColor: 'rgba(255,255,255,0.35)' },
  skinEmoji: { fontSize: 26 },
  equippedMark: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderWidth: 1,
    borderColor: THEME.outline.color,
  },
  equippedMarkText: { fontFamily: F.heading, color: '#1b1207', fontSize: 12 },
  skinName: { fontFamily: F.heading, color: C.text, fontSize: 12, marginTop: 6 },
  skinAction: {
    marginTop: 5,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.panelBorder,
  },
  skinActionEquipped: { backgroundColor: C.accent, borderColor: THEME.outline.color },
  skinActionText: { fontFamily: F.body, color: CRYSTAL, fontSize: 11 },

  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(20,22,28,0.95)',
    borderWidth: 1,
    borderColor: C.accent,
  },
  toastText: { fontFamily: F.heading, color: C.text, fontSize: 14 },
});
