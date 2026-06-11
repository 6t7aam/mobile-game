/**
 * `useT()` — reactive translator bound to the current language setting.
 * Re-renders the calling component when the language changes.
 * `tn(kind, id, fallback)` translates content names (weapons/buildings/...).
 */

import { useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { translate, translateName, type StringKey } from './strings';

export type TFunc = (key: StringKey, vars?: Record<string, string | number>) => string;

export function useT(): TFunc {
  const lang = useSettingsStore((s) => s.language);
  return useCallback<TFunc>((key, vars) => translate(lang, key, vars), [lang]);
}

export function useTn(): (kind: string, id: string, fallback: string) => string {
  const lang = useSettingsStore((s) => s.language);
  return useCallback((kind: string, id: string, fallback: string) => translateName(lang, kind, id, fallback), [lang]);
}

/** Non-reactive translate for call sites outside React (reads current setting). */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  return translate(useSettingsStore.getState().language, key, vars);
}

/** Non-reactive content-name translate. */
export function tn(kind: string, id: string, fallback: string): string {
  return translateName(useSettingsStore.getState().language, kind, id, fallback);
}
