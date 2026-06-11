/**
 * Account screen: email sign-in / sign-up via Supabase. Without configured
 * Supabase keys the game runs in guest mode and says so honestly — local
 * saves keep working either way.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { User } from '@supabase/supabase-js';

import type { RootStackParamList } from '@/navigation/RootNavigator';
import { DarkButton } from '@/components/ui/DarkButton';
import { useT } from '@/i18n/useT';
import { supabaseConfigured, signIn, signUp, signOut, currentUser } from '@/services/supabase';
import { hapticSelect, hapticSuccess } from '@/systems/haptics';
import { THEME } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

const C = THEME.colors;
const F = THEME.fonts;

export function AccountScreen({ navigation }: Props) {
  const t = useT();
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void currentUser().then(setUser);
  }, []);

  const submit = async () => {
    if (busy || !email || !password) return;
    hapticSelect();
    setBusy(true);
    setMessage(null);
    const res = mode === 'signIn' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (!res.ok) {
      setMessage(t('acc.error', { msg: res.error }));
      return;
    }
    hapticSuccess();
    if (res.needsConfirm) setMessage(t('acc.checkEmail'));
    else setUser(res.user);
  };

  const logout = async () => {
    hapticSelect();
    await signOut();
    setUser(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DarkButton label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{t('acc.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t('acc.subtitle')}</Text>

        {!supabaseConfigured ? (
          <View style={styles.card}>
            <Text style={styles.guestTitle}>☁️ {t('acc.cloudOff')}</Text>
            <Text style={styles.muted}>{t('acc.notConfigured')}</Text>
          </View>
        ) : user ? (
          <View style={styles.card}>
            <Text style={styles.muted}>{t('acc.signedInAs')}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <View style={{ marginTop: 16 }}>
              <DarkButton label={t('acc.signOut')} variant="danger" onPress={() => void logout()} />
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder={t('acc.email')}
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder={t('acc.password')}
              placeholderTextColor={C.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <DarkButton
              label={busy ? '…' : mode === 'signIn' ? t('acc.signIn') : t('acc.signUp')}
              onPress={() => void submit()}
            />
            <Text
              style={styles.switchMode}
              onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
            >
              {mode === 'signIn' ? t('acc.noAccount') : t('acc.haveAccount')}
            </Text>
          </View>
        )}

        {message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.card}>
          <Text style={styles.guestTitle}>💾 {t('acc.guest')}</Text>
          <Text style={styles.muted}>{t('acc.guestDesc')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontFamily: F.display, color: C.accent, fontSize: 24 },
  body: { padding: 20, gap: 14, alignItems: 'center' },
  subtitle: { fontFamily: F.body, color: C.textMuted, fontSize: 14 },
  card: {
    width: 360,
    maxWidth: '100%',
    padding: 16,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: C.panelBorder,
    backgroundColor: THEME.alpha.darkPanel,
    gap: 10,
  },
  guestTitle: { fontFamily: F.heading, color: C.text, fontSize: 16 },
  muted: { fontFamily: F.body, color: C.textMuted, fontSize: 13, lineHeight: 18 },
  email: { fontFamily: F.heading, color: C.accent, fontSize: 16 },
  input: {
    fontFamily: F.body,
    color: C.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.panelBorder,
    backgroundColor: C.panelRaised,
  },
  switchMode: { fontFamily: F.body, color: C.accent, fontSize: 13, textAlign: 'center', marginTop: 4 },
  message: { fontFamily: F.body, color: C.accent, fontSize: 13, textAlign: 'center' },
});
