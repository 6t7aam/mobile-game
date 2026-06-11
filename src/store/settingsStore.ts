/**
 * Player preferences: audio levels, haptics, visual quality, language.
 * Persisted independently of game progress.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Language } from '@/i18n/strings';

export type Quality = 'low' | 'high';
export type { Language };

interface SettingsState {
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  haptics: boolean;
  reducedMotion: boolean;
  quality: Quality;
  language: Language;
  /** False until the player picks a language on first launch. */
  languageChosen: boolean;
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
      languageChosen: false,
      tutorialDone: false,

      setMusic: (v) => set({ musicVolume: clamp01(v) }),
      setSfx: (v) => set({ sfxVolume: clamp01(v) }),
      toggleHaptics: () => set((s) => ({ haptics: !s.haptics })),
      toggleReducedMotion: () => set((s) => ({ reducedMotion: !s.reducedMotion })),
      setQuality: (quality) => set({ quality }),
      setLanguage: (language) => set({ language, languageChosen: true }),
      markTutorialDone: () => set({ tutorialDone: true }),
    }),
    {
      name: 'holdouts-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
