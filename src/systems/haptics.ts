/**
 * Settings-aware haptics wrapper. Every call is a no-op when haptics are
 * disabled in settings or the platform doesn't support them, so call sites
 * (fire button, big kills, building destroyed, game over) stay clean.
 */

import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store/settingsStore';

function on(): boolean {
  return useSettingsStore.getState().haptics;
}

export function hapticLight(): void {
  if (!on()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticMedium(): void {
  if (!on()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function hapticHeavy(): void {
  if (!on()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

export function hapticSuccess(): void {
  if (!on()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticError(): void {
  if (!on()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** Selection tick — for toggles / placement. */
export function hapticSelect(): void {
  if (!on()) return;
  Haptics.selectionAsync().catch(() => {});
}
