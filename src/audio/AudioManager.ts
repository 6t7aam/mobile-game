/**
 * Central audio manager (expo-av). Zero-asset-safe: every registry entry is
 * `null` today, so `play`/`setMusic` are no-ops until real files are wired in
 * `registry.ts`. No call site needs to know whether a sound exists.
 *
 * - SFX: each id is lazily loaded once and replayed (cheap, fire-and-forget).
 *   For overlapping shots we allow a tiny voice pool per id.
 * - Music: adaptive layers with a manual crossfade between the current and next
 *   track. `setMusicIntensity` maps the battle state to a layer.
 *
 * Volumes are pulled from the settings store at play time so changes apply live.
 */

import { Audio } from 'expo-av';

import { SFX, MUSIC, hasSound, type SfxId, type MusicId } from './registry';
import { useSettingsStore } from '@/store/settingsStore';

const VOICES_PER_SFX = 3;

interface Voice {
  sound: Audio.Sound;
  busy: boolean;
}

let enabled = false;
const sfxPool = new Map<SfxId, Voice[]>();
let currentMusic: MusicId | null = null;
let musicSound: Audio.Sound | null = null;

/**
 * Call once at app start. Sets the audio mode where supported. On web
 * `setAudioModeAsync` can reject (the option set isn't supported) — we must NOT
 * disable audio in that case, or every SFX silently no-ops (the "no sound on
 * web" bug). So we enable audio regardless and only treat a hard failure as off.
 */
export async function initAudio(): Promise<void> {
  enabled = true; // default on; playback itself is still guarded per-sound
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
  } catch {
    /* unsupported on this platform (e.g. web) — audio still works via play */
  }
}

function sfxVolume(): number {
  return useSettingsStore.getState().sfxVolume;
}
function musicVolume(): number {
  return useSettingsStore.getState().musicVolume;
}

/** Fire a one-shot SFX. No-op when the registry entry is null or audio is off. */
export function playSfx(id: SfxId): void {
  const src = SFX[id];
  if (!enabled || !hasSound(src)) return;
  void getFreeVoice(id, src).then((v) => {
    if (!v) return;
    v.busy = true;
    v.sound
      .setVolumeAsync(sfxVolume())
      .then(() => v.sound.replayAsync())
      .catch(() => {});
  });
}

async function getFreeVoice(id: SfxId, src: number): Promise<Voice | null> {
  let voices = sfxPool.get(id);
  if (!voices) {
    voices = [];
    sfxPool.set(id, voices);
  }
  const free = voices.find((v) => !v.busy);
  if (free) return free;
  if (voices.length < VOICES_PER_SFX) {
    try {
      const { sound } = await Audio.Sound.createAsync(src as never, { volume: sfxVolume() });
      const voice: Voice = { sound, busy: false };
      sound.setOnPlaybackStatusUpdate((s) => {
        if ('didJustFinish' in s && s.didJustFinish) voice.busy = false;
      });
      voices.push(voice);
      return voice;
    } catch {
      return null;
    }
  }
  // steal the oldest
  return voices[0] ?? null;
}

/** Cross-fade to a music track. No-op when the registry entry is null. */
export async function setMusic(id: MusicId): Promise<void> {
  if (currentMusic === id) return;
  currentMusic = id;
  const src = MUSIC[id];
  // fade out & unload the old track regardless
  const old = musicSound;
  musicSound = null;
  if (old) {
    void fadeOutAndUnload(old);
  }
  if (!enabled || !hasSound(src)) return;
  try {
    const { sound } = await Audio.Sound.createAsync(src as never, {
      isLooping: true,
      volume: 0,
    });
    musicSound = sound;
    await sound.playAsync();
    await fadeTo(sound, musicVolume(), 1500);
  } catch {
    musicSound = null;
  }
}

/** Map the live battle state to a music layer. */
export function setMusicIntensity(state: { boss: boolean; progress: number }): void {
  if (state.boss) void setMusic('boss');
  else if (state.progress > 0.5) void setMusic('battle_high');
  else void setMusic('battle_low');
}

async function fadeTo(sound: Audio.Sound, target: number, ms: number): Promise<void> {
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await sound.setVolumeAsync((target * i) / steps).catch(() => {});
    await delay(ms / steps);
  }
}

async function fadeOutAndUnload(sound: Audio.Sound): Promise<void> {
  try {
    for (let i = 10; i >= 0; i--) {
      await sound.setVolumeAsync((musicVolume() * i) / 10).catch(() => {});
      await delay(120);
    }
    await sound.stopAsync().catch(() => {});
    await sound.unloadAsync().catch(() => {});
  } catch {
    /* ignore */
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Unload everything (e.g. leaving a battle). */
export async function stopMusic(): Promise<void> {
  currentMusic = null;
  const old = musicSound;
  musicSound = null;
  if (old) await fadeOutAndUnload(old);
}
