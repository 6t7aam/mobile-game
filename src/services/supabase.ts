/**
 * Supabase client for accounts + cloud saves.
 *
 * Configuration comes from env (inlined by Expo at build time):
 *   EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
 * Put them in `.env` (gitignored) or EAS secrets. Without keys the game runs
 * in guest mode — everything still works, saves stay local.
 *
 * Schema + setup walkthrough: docs/supabase.md
 */

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export type AuthResult = { ok: true; user: User | null; needsConfirm?: boolean } | { ok: false; error: string };

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'not-configured' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false, error: error.message } : { ok: true, user: data.user };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'not-configured' };
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };
  // Without an active session the project requires email confirmation.
  return { ok: true, user: data.user, needsConfirm: !data.session };
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
}

export async function currentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Push the local meta + progress snapshot to the `saves` table (upsert by
 * user id). Called fire-and-forget after sign-in; failures are non-fatal.
 */
export async function uploadSave(snapshot: Record<string, unknown>): Promise<boolean> {
  if (!supabase) return false;
  const user = await currentUser();
  if (!user) return false;
  const { error } = await supabase
    .from('saves')
    .upsert({ user_id: user.id, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return !error;
}

/** Fetch the cloud save for the signed-in user (null if none). */
export async function downloadSave(): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await supabase.from('saves').select('data').eq('user_id', user.id).maybeSingle();
  if (error || !data) return null;
  return (data.data as Record<string, unknown>) ?? null;
}
