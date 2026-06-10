import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/RootNavigator';
import { COLORS, FONTS } from '@/constants/gameConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace('MainMenu'), 1800);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ASHEN DOMINION</Text>
      <Text style={styles.tagline}>How many nights can you hold?</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.heading,
    color: COLORS.accent,
    fontSize: 40,
    letterSpacing: 4,
  },
  tagline: {
    fontFamily: FONTS.body,
    color: COLORS.inactive,
    fontSize: 16,
    marginTop: 12,
    fontStyle: 'italic',
  },
});
