/**
 * Wave composition. Rather than hand-authoring every night, we procedurally
 * generate them from a per-night budget and a difficulty curve, with bosses
 * slotted in on the 5-night cadence. The first few nights are hand-tuned for
 * a deliberate onboarding ramp.
 */

import type { EnemyType, MapEdge, NightDef, SpawnGroup, WaveDef } from '@/types';
import { DIFFICULTY } from './gameConfig';
import { bossForNight } from './enemies';

const ALL_EDGES: MapEdge[] = ['north', 'south', 'east', 'west'];

/** Hand-tuned opening nights for a controlled difficulty ramp. */
const SCRIPTED_NIGHTS: Record<number, NightDef> = {
  1: {
    night: 1,
    waves: [
      { index: 1, groups: [grp('walker', 6, 0, 1.2, ['south'])] },
      { index: 2, groups: [grp('walker', 8, 0, 1.0, ['south', 'east'])] },
    ],
  },
  2: {
    night: 2,
    waves: [
      { index: 1, groups: [grp('walker', 8, 0, 1.0, ['south'])] },
      { index: 2, groups: [grp('walker', 6, 0, 1.0, ['east']), grp('runner', 4, 2, 0.8, ['west'])] },
      { index: 3, groups: [grp('runner', 8, 0, 0.6, ['north', 'south'])] },
    ],
  },
  3: {
    night: 3,
    waves: [
      { index: 1, groups: [grp('walker', 10, 0, 0.9, ['south', 'east'])] },
      { index: 2, groups: [grp('runner', 8, 0, 0.6, ['west']), grp('toxic', 3, 3, 1.5, ['north'])] },
      { index: 3, groups: [grp('walker', 8, 0, 0.8, ['south']), grp('brute', 1, 5, 0, ['east'])] },
    ],
  },
};

/** Relative spawn weights — how the horde's flavour shifts as nights grow. */
function enemyBudgetMix(night: number): Array<{ type: EnemyType; weight: number }> {
  const mix: Array<{ type: EnemyType; weight: number }> = [
    { type: 'walker', weight: 10 },
    { type: 'runner', weight: night >= 2 ? 7 : 0 },
    { type: 'toxic', weight: night >= 3 ? 4 : 0 },
    { type: 'brute', weight: night >= 4 ? 3 : 0 },
    { type: 'armored', weight: night >= 6 ? 3 : 0 },
    { type: 'suicide', weight: night >= 7 ? 3 : 0 },
    { type: 'screamer', weight: night >= 8 ? 2 : 0 },
    { type: 'tank', weight: night >= 10 ? 1 : 0 },
  ];
  return mix.filter((e) => e.weight > 0);
}

function grp(
  type: EnemyType,
  count: number,
  delaySec: number,
  intervalSec: number,
  edges: MapEdge[],
): SpawnGroup {
  return { type, count, delaySec, intervalSec, edges };
}

/** Total enemy "points" budgeted for a night, scaled by difficulty. */
function nightBudget(night: number): number {
  return Math.round(12 * Math.pow(DIFFICULTY.countGrowth, night - 1));
}

function wavesForNight(night: number): WaveDef[] {
  const mix = enemyBudgetMix(night);
  const totalWeight = mix.reduce((s, m) => s + m.weight, 0);
  const budget = nightBudget(night);
  const waveCount = Math.min(3 + Math.floor(night / 4), 6);

  const waves: WaveDef[] = [];
  for (let w = 0; w < waveCount; w++) {
    // later waves are denser
    const waveShare = (w + 1) / ((waveCount * (waveCount + 1)) / 2);
    const waveBudget = Math.max(4, Math.round(budget * waveShare));
    const groups: SpawnGroup[] = mix.map((m, i) => {
      const count = Math.max(0, Math.round((waveBudget * m.weight) / totalWeight));
      const edges = pickEdges(w, i);
      return grp(m.type, count, (i % 2) * 2, intervalFor(m.type), edges);
    }).filter((g) => g.count > 0);
    waves.push({ index: w + 1, groups });
  }
  return waves;
}

function intervalFor(type: EnemyType): number {
  switch (type) {
    case 'runner':
    case 'suicide':
      return 0.5;
    case 'brute':
    case 'tank':
    case 'armored':
      return 2.5;
    default:
      return 0.9;
  }
}

function pickEdges(waveIdx: number, groupIdx: number): MapEdge[] {
  // Spread pressure around the base as nights progress.
  const start = (waveIdx + groupIdx) % ALL_EDGES.length;
  const edge = ALL_EDGES[start] ?? 'south';
  return [edge];
}

/** Public: resolve the full definition for a given night (scripted or generated). */
export function nightDef(night: number): NightDef {
  const scripted = SCRIPTED_NIGHTS[night];
  const boss = bossForNight(night)?.type;
  if (scripted) {
    return boss ? { ...scripted, boss } : scripted;
  }
  return { night, waves: wavesForNight(night), ...(boss ? { boss } : {}) };
}
