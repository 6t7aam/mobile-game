/**
 * Player preferences: audio levels, haptics, visual quality, language.
 * Persisted independently of game progress.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Quality = 'low' | 'high';
export type Language = 'ru' | 'en';

interface SettingsState {
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  haptics: boolean;
  reducedMotion: boolean;
  quality: Quality;
  language: Language;
  tutorialDone: boolean;

  setMusic: (v: number) => void;
  setSfx: (v: number) => void;
  toggleHaptics: () => void;
  toggleReducedMotion: () => void;
  setQuality: (q: Quality) => void;
  setLanguage: (l: Language) => void;
  markTutorialDone: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      musicVolume: 0.7,
      sfxVolume: 0.9,
      haptics: true,
      reducedMotion: false,
      quality: 'high',
      language: 'ru',
      tutorialDone: false,

      setMusic: (v) => set({ musicVolume: clamp01(v) }),
      setSfx: (v) => set({ sfxVolume: clamp01(v) }),
      toggleHaptics: () => set((s) => ({ haptics: !s.haptics })),
      toggleReducedMotion: () => set((s) => ({ reducedMotion: !s.reducedMotion })),
      setQuality: (quality) => set({ quality }),
      setLanguage: (language) => set({ language }),
      markTutorialDone: () => set({ tutorialDone: true }),
    }),
    {
      name: 'ashen-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
