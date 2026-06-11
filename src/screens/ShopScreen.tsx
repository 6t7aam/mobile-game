/**
 * Shop: crystal packs (IAP via App Store / Google Play), the daily freebie,
 * premium shop-exclusive weapons and meme character skins. All texts are
 * localized; purchases run through services/iap.ts (mocked outside store
 * builds) and the meta store.
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

export function ShopScreen({ navigation }: Props) {
  const t = useT();
  const tn = useTn();
  const meta = useMetaStore();
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DarkButton label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{t('shop.title')}</Text>
        <View style={styles.balance}>
          <Text style={styles.balanceText}>💎 {meta.crystals}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* ----- daily freebie ----- */}
        <Text style={styles.section}>🎁 {t('shop.daily')}</Text>
        <View style={[styles.dailyCard, !canClaim && styles.cardDim]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dailyAmount}>+{dailyRewardAmount()} 💎</Text>
            <Text style={styles.cardDesc}>{canClaim ? t('shop.dailyDesc') : t('shop.claimed')}</Text>
          </View>
          {canClaim && <DarkButton label={t('shop.claim')} onPress={claimDaily} />}
        </View>

        {/* ----- crystal packs ----- */}
        <Text style={styles.section}>💎 {t('shop.crystals')}</Text>
        <View style={styles.row}>
          {CRYSTAL_PACKS.map((pack) => (
            <Pressable
              key={pack.productId}
              style={[styles.packCard, pack.bestValue && styles.packBest]}
              onPress={() => void buyPack(pack)}
            >
              {pack.bestValue && <Text style={styles.bestBadge}>{t('shop.bestValue')}</Text>}
              <Text style={styles.packEmoji}>{pack.emoji}</Text>
              <Text style={styles.packCrystals}>{pack.crystals} 💎</Text>
              <Text style={styles.packName}>{t(pack.nameKey)}</Text>
              <View style={styles.priceTag}>
                <Text style={styles.priceText}>{pendingPack === pack.productId ? '…' : pack.priceLabel}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>{t('shop.iapNote')}</Text>

        {/* ----- premium weapons ----- */}
        <Text style={styles.section}>🔥 {t('shop.premium')}</Text>
        {PREMIUM_WEAPON_IDS.map((id) => {
          const def = WEAPONS[id];
          const owned = meta.ownedPremium.includes(id);
          const price = PREMIUM_WEAPON_PRICES[id] ?? 0;
          return (
            <View key={id} style={[styles.weaponCard, owned && styles.cardOwned]}>
              <Text style={styles.weaponEmoji}>{id === 'goldenMinigun' ? '✨' : '🔥'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.weaponName}>{tn('w', id, def.name)}</Text>
                <Text style={styles.cardDesc}>
                  ⚔️ {def.damage} · {def.fireRate}/s · {tn('a', def.ability.id, def.ability.name)}
                </Text>
              </View>
              {owned ? (
                <Text style={styles.ownedBadge}>{t('shop.owned')}</Text>
              ) : (
                <DarkButton label={`${price} 💎`} onPress={() => buyPremium(id)} />
              )}
            </View>
          );
        })}

        {/* ----- meme skins ----- */}
        <Text style={styles.section}>🎭 {t('shop.skins')}</Text>
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
                <View style={[styles.skinSwatch, { backgroundColor: skin.palette.skin }]}>
                  <Text style={styles.skinEmoji}>{skin.emoji}</Text>
                </View>
                <Text style={styles.skinName} numberOfLines={1}>
                  {t(`skin.${skin.id}`)}
                </Text>
                <Text style={[styles.skinPrice, equipped && { color: C.accent }]}>
                  {equipped ? t('shop.equipped') : owned ? t('shop.equip') : skin.cost === 0 ? t('shop.owned') : `${skin.cost} 💎`}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontFamily: F.display, color: C.accent, fontSize: 24, flex: 1 },
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
  section: { fontFamily: F.heading, color: C.text, fontSize: 18, marginTop: 18, marginBottom: 8 },
  note: { fontFamily: F.body, color: C.textMuted, fontSize: 12, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  dailyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: C.accent,
    backgroundColor: C.panelRaised,
  },
  cardDim: { opacity: 0.6, borderColor: C.panelBorder },
  dailyAmount: { fontFamily: F.heading, color: CRYSTAL, fontSize: 22 },
  cardDesc: { fontFamily: F.body, color: C.textMuted, fontSize: 13, marginTop: 2 },

  packCard: {
    width: 132,
    alignItems: 'center',
    padding: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: C.panelBorder,
    backgroundColor: THEME.alpha.darkPanel,
  },
  packBest: { borderColor: '#e8c84a' },
  bestBadge: { fontFamily: F.heading, color: '#e8c84a', fontSize: 10, marginBottom: 2 },
  packEmoji: { fontSize: 30 },
  packCrystals: { fontFamily: F.heading, color: CRYSTAL, fontSize: 17, marginTop: 4 },
  packName: { fontFamily: F.body, color: C.textMuted, fontSize: 11, marginTop: 2, textAlign: 'center' },
  priceTag: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: C.accent,
  },
  priceText: { fontFamily: F.heading, color: '#1b1207', fontSize: 14 },

  weaponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 8,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: '#e8c84a',
    backgroundColor: C.panelRaised,
  },
  cardOwned: { borderColor: C.panelBorder, opacity: 0.85 },
  weaponEmoji: { fontSize: 30 },
  weaponName: { fontFamily: F.heading, color: '#e8c84a', fontSize: 16 },
  ownedBadge: { fontFamily: F.heading, color: C.accent, fontSize: 13 },

  skinCard: {
    width: 104,
    alignItems: 'center',
    padding: 10,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: C.panelBorder,
    backgroundColor: THEME.alpha.darkPanel,
  },
  skinEquipped: { borderColor: C.accent, backgroundColor: C.panelRaised },
  skinSwatch: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.4)',
  },
  skinEmoji: { fontSize: 26 },
  skinName: { fontFamily: F.heading, color: C.text, fontSize: 12, marginTop: 6 },
  skinPrice: { fontFamily: F.body, color: CRYSTAL, fontSize: 12, marginTop: 2 },

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
