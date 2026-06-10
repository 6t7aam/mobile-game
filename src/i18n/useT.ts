/**
 * `useT()` — reactive translator bound to the current language setting.
 * Re-renders the calling component when the language changes.
 */

import { useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { translate, type StringKey } from './strings';

export function useT(): (key: StringKey) => string {
  const lang = useSettingsStore((s) => s.language);
  return useCallback((key: StringKey) => translate(lang, key), [lang]);
}

/** Non-reactive translate for call sites outside React (reads current setting). */
export function t(key: StringKey): string {
  return translate(useSettingsStore.getState().language, key);
}
