import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@/constants/gameConfig';
import { WEAPONS } from '@/constants/weapons';
import type { WeaponId } from '@/types';
import { THEME } from '@/theme';

interface WeaponHUDProps {
  weapon: WeaponId;
  magCurrent: number;
  magSize: number;
  reloadProgress: number; // 0..1 (1 = ready)
  abilityCdLeft: number;
  abilityCdTotal: number;
  abilityActiveLeft?: number;
  outOfSupply?: boolean;
}

/** Bottom-center weapon readout: name, magazine, reload, ability cooldown. */
export function WeaponHUD({
  weapon,
  magCurrent,
  magSize,
  reloadProgress,
  abilityCdLeft,
  abilityCdTotal,
  abilityActiveLeft = 0,
  outOfSupply = false,
}: WeaponHUDProps) {
  const def = WEAPONS[weapon];
  const reloading = reloadProgress < 1;
  const abilityActive = abilityActiveLeft > 0;
  const abilityReady = !abilityActive && abilityCdLeft <= 0;
  const abilityPct = abilityCdTotal > 0 ? 1 - abilityCdLeft / abilityCdTotal : 1;

  return (
    <View style={[styles.wrap, abilityActive && styles.wrapActive]}>
      <Text style={styles.name}>{def.name}</Text>
      {outOfSupply && <Text style={styles.warn}>⚠ НЕТ БОЕПРИПАСОВ</Text>}
      {magSize > 0 ? (
        <View style={styles.row}>
          <View style={styles.barBack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${reloading ? reloadProgress * 100 : (magCurrent / magSize) * 100}%`,
                  backgroundColor: reloading ? COLORS.inactive : COLORS.accent,
                },
              ]}
            />
          </View>
          <Text style={styles.mag}>
            {reloading ? 'ПЕРЕЗАРЯДКА' : `${magCurrent}/${magSize}`}
          </Text>
        </View>
      ) : (
        <Text style={styles.mag}>ближний бой</Text>
      )}
      <View style={styles.abilityRow}>
        <View style={styles.abilityBack}>
          <View
            style={[
              styles.abilityFill,
              { width: `${abilityPct * 100}%`, backgroundColor: abilityReady ? COLORS.resource : COLORS.inactive },
            ]}
          />
        </View>
        <Text
          style={[
            styles.ability,
            { color: abilityActive ? COLORS.accent : abilityReady ? COLORS.resource : COLORS.inactive },
          ]}
        >
          {abilityActive ? `▶ ${def.ability.name} ${abilityActiveLeft.toFixed(1)}с` : def.ability.name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: THEME.alpha.panel60,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
    minWidth: 200,
  },
  wrapActive: { borderColor: COLORS.accent },
  warn: { fontFamily: FONTS.body, color: COLORS.danger, fontSize: 11, marginTop: 2 },
  name: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 14, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  barBack: { width: 120, height: 10, backgroundColor: THEME.colors.black, borderWidth: 1, borderColor: COLORS.panelBorder },
  barFill: { height: '100%' },
  mag: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 12, minWidth: 56 },
  abilityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  abilityBack: { width: 120, height: 5, backgroundColor: THEME.colors.black },
  abilityFill: { height: '100%' },
  ability: { fontFamily: FONTS.body, fontSize: 11 },
});
