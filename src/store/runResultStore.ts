/**
 * Transient hand-off between the Night battle and the Dawn/GameOver screen.
 * Not persisted — it only carries the just-finished night's summary.
 */

import { create } from 'zustand';
import type { ResourceBag } from '@/types';

export interface NightSummary {
  night: number;
  survived: boolean;
  killed: number;
  earned: ResourceBag;
  /** Reason for loss, when not survived. */
  cause?: 'shelter' | 'player';
}

interface RunResultState {
  summary: NightSummary | null;
  setSummary: (s: NightSummary) => void;
  clear: () => void;
}

export const useRunResultStore = create<RunResultState>((set) => ({
  summary: null,
  setSummary: (summary) => set({ summary }),
  clear: () => set({ summary: null }),
}));
