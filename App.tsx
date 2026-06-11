import 'react-native-gesture-handler';
import { useEffect, useState, useCallback } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

import { RootNavigator } from '@/navigation/RootNavigator';
import { COLORS } from '@/constants/gameConfig';
import { initAudio } from '@/audio/AudioManager';
import { useSettingsStore } from '@/store/settingsStore';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app may trigger this — safe to ignore */
});

/**
 * Fonts: the display face (Cinzel Decorative) and body (Crimson) are loaded
 * here via expo-font. Keys match the `FONTS` constants so every RN `Text` that
 * sets `fontFamily: FONTS.heading/body` now renders the real face; the same
 * TTFs are handed to Skia (`useFont`) for in-world text. Boot is gated on the
 * fonts so we never flash the system fallback.
 */
export default function App() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    // Cyrillic-capable premium set (SIL OFL) — see THEME.fonts for usage map.
    'RuslanDisplay-Regular': require('./assets/fonts/RuslanDisplay-Regular.ttf'),
    'AlegreyaSC-Bold': require('./assets/fonts/AlegreyaSC-Bold.ttf'),
    'Alegreya-Regular': require('./assets/fonts/Alegreya-Regular.ttf'),
  });

  useEffect(() => {
    void initAudio();
    // Wait for the persisted settings (language choice!) before first render,
    // so returning players never see the language picker flash by.
    if (useSettingsStore.persist.hasHydrated()) setReady(true);
    else {
      const unsub = useSettingsStore.persist.onFinishHydration(() => setReady(true));
      setTimeout(() => setReady(true), 1500); // storage failure safety net
      void unsub;
    }

    // Web browsers block audio until the first user gesture. Resume the audio
    // context on the first interaction so SFX actually play in the browser.
    if (typeof window !== 'undefined' && window.addEventListener) {
      const unlock = () => {
        const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
        const AC = Ctx.AudioContext ?? Ctx.webkitAudioContext;
        if (AC) {
          try {
            const ctx = new AC();
            if (ctx.state === 'suspended') void ctx.resume();
          } catch {
            /* ignore */
          }
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      window.addEventListener('touchstart', unlock);
    }
  }, []);

  const booted = ready && fontsLoaded;

  const onLayoutRootView = useCallback(() => {
    if (booted) SplashScreen.hideAsync().catch(() => {});
  }, [booted]);

  if (!booted) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <StatusBar hidden />
        <RootNavigator />
      </View>
    </GestureHandlerRootView>
  );
}
