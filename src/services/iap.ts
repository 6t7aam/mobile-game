/**
 * In-app purchases: crystal packs sold for real money through the App Store /
 * Google Play.
 *
 * HOW IT WORKS
 * - Product catalog lives here (`CRYSTAL_PACKS`); the same product ids must be
 *   registered in App Store Connect and the Play Console.
 * - On native store builds, wire `purchasePack()` to `react-native-iap`
 *   (requestPurchase → validate receipt server-side → grant crystals). The
 *   integration points are marked with `TODO(iap)` below.
 * - On web / Expo Go / dev builds there is no store, so purchases resolve
 *   instantly as mock grants — perfect for testing the whole shop flow.
 *
 * TO SHIP REAL PAYMENTS
 * 1. `npx expo install react-native-iap` and build a dev client (EAS).
 * 2. Create the products below in both stores (consumable type).
 * 3. Replace `mockPurchase` with the real flow + server receipt validation
 *    (Supabase edge function is a good fit — see docs/supabase.md).
 */

import { Platform } from 'react-native';

export interface CrystalPack {
  /** Store product id (must match App Store Connect / Play Console). */
  productId: string;
  /** i18n key for the display name (`shop.packSmall`, …). */
  nameKey: string;
  crystals: number;
  /** Display price; on native builds replace with the localized store price. */
  priceLabel: string;
  emoji: string;
  bestValue?: boolean;
}

export const CRYSTAL_PACKS: CrystalPack[] = [
  { productId: 'ashen.crystals.100', nameKey: 'shop.packSmall', crystals: 100, priceLabel: '$0.99', emoji: '💎' },
  { productId: 'ashen.crystals.550', nameKey: 'shop.packMedium', crystals: 550, priceLabel: '$4.99', emoji: '💰' },
  { productId: 'ashen.crystals.1200', nameKey: 'shop.packLarge', crystals: 1200, priceLabel: '$9.99', emoji: '📦' },
  { productId: 'ashen.crystals.3000', nameKey: 'shop.packHuge', crystals: 3000, priceLabel: '$19.99', emoji: '👑', bestValue: true },
];

export type PurchaseResult =
  | { ok: true; crystals: number }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'error' };

/** True when a real store is available (native store build). */
export function storeAvailable(): boolean {
  // TODO(iap): return true once react-native-iap is initialized on ios/android.
  return false;
}

/**
 * Purchase a crystal pack. Resolves with the granted amount.
 * Mocked outside of store builds (web preview, Expo Go, e2e tests).
 */
export async function purchasePack(pack: CrystalPack): Promise<PurchaseResult> {
  if (Platform.OS === 'web' || !storeAvailable()) {
    return mockPurchase(pack);
  }
  // TODO(iap): real flow
  // const purchase = await requestPurchase({ sku: pack.productId });
  // await validateReceiptOnServer(purchase);   // never trust the client!
  // await finishTransaction({ purchase, isConsumable: true });
  return mockPurchase(pack);
}

async function mockPurchase(pack: CrystalPack): Promise<PurchaseResult> {
  // Simulate a short store round-trip so the UI shows its pending state.
  await new Promise((r) => setTimeout(r, 350));
  return { ok: true, crystals: pack.crystals };
}
