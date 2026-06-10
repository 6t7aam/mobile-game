/**
 * WorldScreen — the unified, continuous game world.
 *
 * Day and night are no longer separate screens: an automatic Minecraft-style
 * cycle (CYCLE in gameConfig) turns inside one living scene. By day you harvest
 * (chop trees, mine boulders/scrap), carry resources to the campfire and build
 * Clash-of-Clans-style (tap a dock slot → drag the ghost → confirm; construction
 * takes time). At dusk the sky reddens and the first crawlers emerge; at night
 * the horde attacks and the player fights with stamina + dodge-roll (souls
 * rules); at dawn survivors burn off, rewards land, and the next day begins.
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/RootNavigator';
import type { BuildingType, IntermediateType, PlacedBuilding, ResourceBag, ResourceType, Rock, Tree } from '@/types';
import { RESOURCE_TYPES } from '@/types';
import { GRID, CYCLE, INTERMEDIATE_LABEL, PRODUCTION_RECIPES } from '@/constants/gameConfig';
import { BUILDINGS } from '@/constants/buildings';
import { tickProduction, currentCaps, storageLevels } from '@/systems/production';
import { resolveModifiers } from '@/systems/modifiers';
import { BattleSim, type PlayerView } from '@/engine/sim';
import { useGameLoop } from '@/hooks/useGameLoop';
import { GameCanvas } from '@/components/battle/GameCanvas';
import type { Camera, GroundItem, PlacementGhost } from '@/components/battle/renderSim';
import { useBattleFonts } from '@/components/battle/fonts';
import { Joystick } from '@/components/battle/Joystick';
import { WeaponHUD } from '@/components/ui/WeaponHUD';
import { Minimap } from '@/components/ui/Minimap';
import { ResourceIcon } from '@/components/ui/ResourceIcon';
import { BuildingIcon } from '@/components/base/BuildingIcon';
import { BuildingUpgradePanel, sellRefund, upgradeCost } from '@/components/base/BuildingUpgradePanel';
import { DayTutorial, type TutorialStep } from '@/components/ui/DayTutorial';
import { playSfx, setMusic, stopMusic } from '@/audio/AudioManager';
import { getActiveSlot, saveToSlot } from '@/save/slots';
import { hapticLight, hapticMedium, hapticHeavy, hapticSelect, hapticError } from '@/systems/haptics';
import { useGameStore } from '@/store/gameStore';
import { useBaseStore } from '@/store/baseStore';
import { usePlayerStore } from '@/store/playerStore';
import { useProgressStore } from '@/store/progressStore';
import { useSettingsStore } from '@/store/settingsStore';
import { THEME } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'World'>;

const TILE = GRID.tileSize;
const FIXED_DT = 1 / 60;
const C = THEME.colors;
const F = THEME.fonts;
// The full construction catalogue (everything except the campfire itself).
// Ordered: defense → economy → support. electricFence is research-gated.
const BUILD_MENU: BuildingType[] = [
  'wall',
  'gate',
  'tower',
  'sniperNest',
  'mortar',
  'electricFence',
  'barracks',
  'trainingGround',
  'workshop',
  'garden',
  'generator',
  'fuelDepot',
  'storage',
  'medbay',
  'researchCenter',
];
/** Research id that unlocks a building, if it is gated. */
const BUILDING_RESEARCH_GATE: Partial<Record<BuildingType, { id: string; name: string }>> = {
  electricFence: { id: 'fort5', name: 'Электрифицированные Заграждения' },
};
/** Which production recipes each work building can run. */
const BUILDING_RECIPES: Partial<Record<BuildingType, IntermediateType[]>> = {
  workshop: ['ammo', 'advancedComponents', 'explosives', 'rockets'],
  garden: ['rations'],
};
const INTERMEDIATE_NAME: Record<IntermediateType, string> = {
  ammo: 'Патроны',
  advancedComponents: 'Компоненты',
  rations: 'Пайки',
  explosives: 'Взрывчатка',
  rockets: 'Ракеты',
};
const BARRACKS_TRAIN_BASE: Partial<ResourceBag> = { food: 20, scrap: 10 };
const TRAINING_SEC = 18;

const PHASE_LABEL: Record<string, string> = {
  day: 'День',
  dusk: 'Сумерки',
  night: 'Ночь',
  dawn: 'Рассвет',
};

export function WorldScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  useBattleFonts();

  // ---- stores ---------------------------------------------------------------
  const night = useGameStore((s) => s.night);
  const resources = useGameStore((s) => s.resources);
  const addResource = useGameStore((s) => s.addResource);
  const canAfford = useGameStore((s) => s.canAfford);
  const spendResources = useGameStore((s) => s.spendResources);
  const beginNextDay = useGameStore((s) => s.beginNextDay);
  const startNewRun = useGameStore((s) => s.startNewRun);
  const intermediates = useGameStore((s) => s.intermediates);
  const craft = useGameStore((s) => s.craft);
  const addIntermediate = useGameStore((s) => s.addIntermediate);
  const tickResearch = useGameStore((s) => s.tickResearch);

  const buildings = useBaseStore((s) => s.buildings);
  const trees = useBaseStore((s) => s.trees);
  const rocks = useBaseStore((s) => s.rocks);
  const place = useBaseStore((s) => s.place);
  const removeBuilding = useBaseStore((s) => s.remove);
  const upgradeBuilding = useBaseStore((s) => s.upgrade);
  const startBarracksTraining = useBaseStore((s) => s.startBarracksTraining);
  const toggleGate = useBaseStore((s) => s.toggleGate);
  const isAreaFree = useBaseStore((s) => s.isAreaFree);
  const startTreeFall = useBaseStore((s) => s.startTreeFall);
  const finishTreeFall = useBaseStore((s) => s.finishTreeFall);
  const mineRock = useBaseStore((s) => s.mineRock);
  const tickRegrow = useBaseStore((s) => s.tickRegrow);
  const applyBattleResult = useBaseStore((s) => s.applyBattleResult);
  const resetLayout = useBaseStore((s) => s.resetLayout);
  const shelter = useBaseStore((s) => s.shelter);

  const equipped = usePlayerStore((s) => s.equipped);
  const maxHp = usePlayerStore((s) => s.maxHp);
  const weaponLevel = useProgressStore((s) => s.weaponLevel(equipped));
  const completedResearch = useProgressStore((s) => s.completedResearch);
  const completeResearch = useProgressStore((s) => s.completeResearch);
  const recordNightSurvived = useProgressStore((s) => s.recordNightSurvived);
  const recordDeath = useProgressStore((s) => s.recordDeath);
  const unlockCodex = useProgressStore((s) => s.unlockCodex);
  const loseFraction = useGameStore((s) => s.loseResourceFraction);

  const tutorialDone = useSettingsStore((s) => s.tutorialDone);
  const markTutorialDone = useSettingsStore((s) => s.markTutorialDone);

  // ---- research → gameplay modifiers + effective resource caps --------------
  const mods = useMemo(() => resolveModifiers(completedResearch), [completedResearch]);
  const shelterLevel = buildings.find((b) => b.type === 'shelter')?.level ?? 1;
  const caps = useMemo(
    () => currentCaps(shelterLevel, mods.resourceCap, storageLevels(buildings)),
    [shelterLevel, mods, buildings],
  );
  const modsRef = useRef(mods);
  modsRef.current = mods;
  const capsRef = useRef(caps);
  capsRef.current = caps;
  const shelterLevelRef = useRef(shelterLevel);
  shelterLevelRef.current = shelterLevel;

  // ---- the sim (one continuous world) ---------------------------------------
  const sim = useMemo(() => {
    const sh = buildings.find((b) => b.type === 'shelter');
    // spawn the player just BELOW the 2×2 campfire footprint (not inside the fire)
    const player: PlayerView = {
      x: sh ? (sh.origin.col + 1) * TILE : (GRID.cols / 2) * TILE,
      y: sh ? (sh.origin.row + 2) * TILE + TILE * 0.9 : (GRID.rows / 2) * TILE,
      hp: maxHp,
      maxHp,
      facing: Math.PI / 2,
      weapon: equipped,
      weaponLevel: Math.max(1, weaponLevel),
    };
    return new BattleSim({
      night,
      buildings,
      player,
      worldMode: true,
      completedResearch,
      ammo: intermediates.ammo,
      rockets: intermediates.rockets,
      components: intermediates.advancedComponents,
      reducedMotion: useSettingsStore.getState().reducedMotion,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the sim's weapon in sync with the arsenal
  useEffect(() => {
    sim.player.weapon = equipped;
    sim.player.weaponLevel = Math.max(1, weaponLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipped, weaponLevel]);

  // ---- input / interaction state --------------------------------------------
  const input = useRef({ mx: 0, my: 0, firing: false });
  const keys = useRef<Record<string, boolean>>({});
  const cameraRef = useRef<Camera | null>(null);
  const itemsRef = useRef<GroundItem[]>([]);
  const carryingRef = useRef<{ wood: number; stone: number; scrap: number }>({ wood: 0, stone: 0, scrap: 0 });
  const swingUntilRef = useRef(0);
  const harvestCdRef = useRef(0);
  const earnedSnap = useRef<Record<ResourceType, number>>({ wood: 0, stone: 0, scrap: 0, fuel: 0, food: 0, energy: 0 });
  const spentSnap = useRef({ ammo: 0, rockets: 0, components: 0 });
  const prodAccRef = useRef(0);
  const [gameOver, setGameOver] = useState<null | { night: number; cause: 'player' | 'shelter' }>(null);
  const [dawnBanner, setDawnBanner] = useState<null | { night: number; killed: number }>(null);
  const [placing, setPlacing] = useState<BuildingType | null>(null);
  const [ghost, setGhost] = useState<PlacementGhost | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [tutStep, setTutStep] = useState<TutorialStep>('chop');
  const [showTutorial, setShowTutorial] = useState(!tutorialDone && night === 1);

  // refs to fresh store data for use inside the loop
  const treesRef = useRef(trees);
  treesRef.current = trees;
  const rocksRef = useRef(rocks);
  rocksRef.current = rocks;
  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;

  // ---- sim callbacks ---------------------------------------------------------
  useEffect(() => {
    sim.onBuildingDestroyed = (id) => removeBuilding(id);
    sim.onDawn = ({ night: survivedNight, killed }) => {
      // rewards: apply the delta of bounties earned this night
      (Object.keys(sim.earned) as ResourceType[]).forEach((r) => {
        const delta = sim.earned[r] - earnedSnap.current[r];
        if (delta > 0) addResource(r, delta);
        earnedSnap.current[r] = sim.earned[r];
      });
      // deduct supplies actually consumed during the night from the stockpile
      const sp = sim.spent;
      const usedAmmo = sp.ammo - spentSnap.current.ammo;
      const usedRockets = sp.rockets - spentSnap.current.rockets;
      const usedComponents = sp.components - spentSnap.current.components;
      if (usedAmmo > 0) addIntermediate('ammo', -usedAmmo);
      if (usedRockets > 0) addIntermediate('rockets', -usedRockets);
      if (usedComponents > 0) addIntermediate('advancedComponents', -usedComponents);
      spentSnap.current = { ammo: sp.ammo, rockets: sp.rockets, components: sp.components };
      // field medicine: a standing medbay patches the survivor up at dawn
      const hasMedbay = buildingsRef.current.some((b) => b.type === 'medbay' && b.hp > 0);
      if (hasMedbay) {
        sim.player.hp = Math.min(sim.player.maxHp, sim.player.hp + sim.player.maxHp * 0.4);
      }
      sim.encountered.forEach((id) => unlockCodex(id as Parameters<typeof unlockCodex>[0]));
      recordNightSurvived(survivedNight, killed);
      applyBattleResult(sim.snapshotBuildingHp());
      const done = tickResearch(1);
      if (done) completeResearch(done);
      beginNextDay();
      setDawnBanner({ night: survivedNight, killed });
      playSfx('night_end');
      hapticHeavy();
      setTimeout(() => setDawnBanner(null), 4000);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync sim's building view whenever the store layout changes (build/sell/destroy)
  useEffect(() => {
    sim.syncBuildings(buildings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings]);

  // crafted supplies flow into the night sim (only while it's safe to do so —
  // at night the sim tracks its own consumption and must not be overwritten)
  useEffect(() => {
    if (sim.phase === 'day' || sim.phase === 'dawn') {
      sim.setSupplies({
        ammo: intermediates.ammo,
        rockets: intermediates.rockets,
        components: intermediates.advancedComponents,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intermediates]);

  // regrowth + music + periodic world autosave (the world persists fully —
  // leaving and re-entering resumes exactly where you left off)
  const phaseRef = useRef<string>('');
  useEffect(() => {
    const id = setInterval(() => tickRegrow(), 2000);
    const saveId = setInterval(() => {
      void getActiveSlot().then((slot) => {
        if (slot !== null) void saveToSlot(slot);
      });
    }, 30_000);
    void setMusic('day');
    return () => {
      clearInterval(id);
      clearInterval(saveId);
      // final snapshot on the way out
      void getActiveSlot().then((slot) => {
        if (slot !== null) void saveToSlot(slot);
      });
      void stopMusic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- harvest: nearest node -------------------------------------------------
  const nearestNode = (): { tree?: Tree; rock?: Rock } => {
    const px = sim.player.x;
    const py = sim.player.y;
    let bestTree: Tree | undefined;
    let bestRock: Rock | undefined;
    let bestD = TILE * 1.5;
    for (const t of treesRef.current) {
      if (t.state !== 'alive') continue;
      const d = Math.hypot(px - (t.tileX * TILE + TILE / 2), py - (t.tileY * TILE + TILE / 2));
      if (d < bestD) {
        bestD = d;
        bestTree = t;
        bestRock = undefined;
      }
    }
    for (const r of rocksRef.current) {
      if (r.state !== 'alive') continue;
      const d = Math.hypot(px - (r.tileX * TILE + TILE / 2), py - (r.tileY * TILE + TILE / 2));
      if (d < bestD) {
        bestD = d;
        bestRock = r;
        bestTree = undefined;
      }
    }
    return { tree: bestTree, rock: bestRock };
  };

  const harvest = () => {
    const now = Date.now();
    if (now - harvestCdRef.current < 360) return;
    const { tree, rock } = nearestNode();
    if (!tree && !rock) return;
    harvestCdRef.current = now;
    swingUntilRef.current = now + 280;

    if (tree) {
      const cx = tree.tileX * TILE + TILE / 2;
      const cy = tree.tileY * TILE + TILE / 2;
      sim.player.facing = Math.atan2(cy - sim.player.y, cx - sim.player.x);
      const next = startTreeFall(tree.id);
      playSfx('building_hit');
      hapticLight();
      if (next?.state === 'falling') {
        setTimeout(() => {
          finishTreeFall(tree.id);
          itemsRef.current.push({ id: `log_${tree.id}_${now}`, x: cx + (Math.random() - 0.5) * 10, y: cy + 8, kind: 'log' });
          if (showTutorial) setTutStep((s) => (s === 'chop' ? 'carry' : s));
        }, 700);
      }
    } else if (rock) {
      const cx = rock.tileX * TILE + TILE / 2;
      const cy = rock.tileY * TILE + TILE / 2;
      sim.player.facing = Math.atan2(cy - sim.player.y, cx - sim.player.x);
      const next = mineRock(rock.id);
      playSfx('building_hit');
      hapticLight();
      if (next?.state === 'depleted') {
        itemsRef.current.push({
          id: `ore_${rock.id}_${now}`,
          x: cx,
          y: cy + 6,
          kind: rock.kind === 'boulder' ? 'stone' : 'scrap',
        });
      }
    }
  };

  /** Pick up nearby items; deliver carried load at the campfire. */
  const updateCarry = () => {
    const p = sim.player;
    const carrying = carryingRef.current;
    if (itemsRef.current.length) {
      const rest: GroundItem[] = [];
      let picked = false;
      for (const it of itemsRef.current) {
        if (Math.hypot(p.x - it.x, p.y - it.y) < TILE * 0.7) {
          if (it.kind === 'log') carrying.wood += 1;
          else if (it.kind === 'stone') carrying.stone += 1;
          else carrying.scrap += 1;
          picked = true;
        } else rest.push(it);
      }
      if (picked) {
        itemsRef.current = rest;
        playSfx('ui_click');
        if (showTutorial) setTutStep((s) => (s === 'carry' ? 'deliver' : s));
      }
    }
    const total = carrying.wood + carrying.stone + carrying.scrap;
    if (total > 0) {
      const camp = shelter();
      if (camp) {
        const cx = (camp.origin.col + 1) * TILE;
        const cy = (camp.origin.row + 1) * TILE;
        if (Math.hypot(p.x - cx, p.y - cy) < TILE * 1.7) {
          const addCapped = (type: ResourceType, amount: number) => {
            const cur = useGameStore.getState().resources[type];
            const room = Math.max(0, capsRef.current[type] - cur);
            if (room > 0) addResource(type, Math.min(amount, room));
          };
          if (carrying.wood) addCapped('wood', carrying.wood * 3);
          if (carrying.stone) addCapped('stone', carrying.stone * 3);
          if (carrying.scrap) addCapped('scrap', carrying.scrap * 2);
          carryingRef.current = { wood: 0, stone: 0, scrap: 0 };
          playSfx('building_upgrade');
          hapticMedium();
          if (showTutorial) setTutStep((s) => (s === 'deliver' ? 'build' : s));
        }
      }
    }
  };

  // ---- CoC placement ---------------------------------------------------------
  const startPlacing = (type: BuildingType) => {
    const p = sim.player;
    const col = Math.min(GRID.cols - BUILDINGS[type].size.w, Math.max(0, Math.floor(p.x / TILE)));
    const row = Math.min(GRID.rows - BUILDINGS[type].size.h, Math.max(0, Math.floor(p.y / TILE) - 1));
    setSelectedBuildingId(null);
    setPlacing(type);
    setGhost({ type, col, row, valid: isAreaFree(type, { col, row }) && canAfford(BUILDINGS[type].buildCost) });
    hapticSelect();
  };

  const moveGhostTo = (sx: number, sy: number) => {
    const cam = cameraRef.current;
    if (!cam || !placing) return;
    const wx = cam.x + (sx - width / 2) / cam.zoom;
    const wy = cam.y + (sy - height / 2) / cam.zoom;
    const def = BUILDINGS[placing];
    const col = Math.min(GRID.cols - def.size.w, Math.max(0, Math.floor(wx / TILE)));
    const row = Math.min(GRID.rows - def.size.h, Math.max(0, Math.floor(wy / TILE)));
    setGhost({ type: placing, col, row, valid: isAreaFree(placing, { col, row }) && canAfford(def.buildCost) });
  };

  const confirmPlace = () => {
    if (!placing || !ghost?.valid) {
      playSfx('ui_error');
      hapticError();
      return;
    }
    const def = BUILDINGS[placing];
    if (spendResources(def.buildCost)) {
      place(placing, { col: ghost.col, row: ghost.row });
      playSfx('building_upgrade');
      hapticMedium();
      if (showTutorial && tutStep === 'build') {
        setTutStep('done');
        markTutorialDone();
        setShowTutorial(false);
      }
    }
    setPlacing(null);
    setGhost(null);
  };

  const cancelPlace = () => {
    setPlacing(null);
    setGhost(null);
  };

  const screenToWorld = (sx: number, sy: number) => {
    const cam = cameraRef.current;
    if (!cam) return null;
    return {
      x: cam.x + (sx - width / 2) / cam.zoom,
      y: cam.y + (sy - height / 2) / cam.zoom,
    };
  };

  const buildingAtWorld = (wx: number, wy: number): PlacedBuilding | undefined =>
    buildingsRef.current.find((b) => {
      const def = BUILDINGS[b.type];
      const bx = b.origin.col * TILE;
      const by = b.origin.row * TILE;
      return wx >= bx && wx <= bx + def.size.w * TILE && wy >= by && wy <= by + def.size.h * TILE;
    });

  const tapWorld = (sx: number, sy: number) => {
    if (placing) return;
    const worldPos = screenToWorld(sx, sy);
    if (!worldPos) return;
    const hit = buildingAtWorld(worldPos.x, worldPos.y);
    setSelectedBuildingId(hit?.id ?? null);
    if (hit) {
      playSfx('ui_click');
      hapticSelect();
    }
  };

  const worldTap = Gesture.Tap().onEnd((event) => {
    'worklet';
    runOnJS(tapWorld)(event.x, event.y);
  });

  const addBag = (bag: Partial<ResourceBag>) => {
    (Object.entries(bag) as [ResourceType, number][]).forEach(([type, amount]) => {
      if (amount > 0) addResource(type, amount);
    });
  };

  const ghostDrag = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      runOnJS(moveGhostTo)(e.x, e.y);
    })
    .onEnd((e) => {
      'worklet';
      runOnJS(moveGhostTo)(e.x, e.y);
    });

  // ---- keyboard (web) --------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current[k] = true;
      if (k === 'e') harvest();
      if (k === ' ') {
        e.preventDefault();
        sim.roll(input.current.mx, input.current.my);
      }
    };
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- the loop ----------------------------------------------------------------
  const handled = useRef(false);
  const step = (dt: number) => {
    const inp = input.current;
    const k = keys.current;
    let dx = inp.mx;
    let dy = inp.my;
    if (k.w || k.arrowup) dy -= 1;
    if (k.s || k.arrowdown) dy += 1;
    if (k.a || k.arrowleft) dx -= 1;
    if (k.d || k.arrowright) dx += 1;
    const mag = Math.hypot(dx, dy);
    if (mag > 0.15 && sim.rollTime <= 0) {
      sim.moveBy(dx / Math.max(1, mag), dy / Math.max(1, mag), dt);
    }
    // auto-aim while firing
    if (inp.firing) {
      let bx = 0;
      let by = 0;
      let best = Infinity;
      sim.enemies.forEachActive((e) => {
        const d = (e.x - sim.player.x) ** 2 + (e.y - sim.player.y) ** 2;
        if (d < best) {
          best = d;
          bx = e.x;
          by = e.y;
        }
      });
      if (best < Infinity) sim.setAim(Math.atan2(by - sim.player.y, bx - sim.player.x));
    }
    sim.setFiring(inp.firing);
    sim.step(dt);
    updateCarry();

    // HoI4-style production chains: work buildings generate resources during
    // daylight (batched ~1/s so the store isn't hammered every frame)
    if (sim.phase === 'day' || sim.phase === 'dusk') {
      prodAccRef.current += dt;
      if (prodAccRef.current >= 1) {
        const st = useGameStore.getState();
        st.setResources(
          tickProduction(
            st.resources,
            buildingsRef.current,
            prodAccRef.current,
            shelterLevelRef.current,
            modsRef.current.production,
            modsRef.current.resourceCap,
          ),
        );
        prodAccRef.current = 0;
      }
    }

    // adaptive music on phase change
    if (sim.phase !== phaseRef.current) {
      phaseRef.current = sim.phase;
      if (sim.phase === 'night') void setMusic('battle_low');
      else if (sim.phase === 'dusk') playSfx('night_start');
      else if (sim.phase === 'day') void setMusic('day');
    }

    if (sim.outcome === 'lost' && !handled.current) {
      handled.current = true;
      playSfx('player_death');
      hapticHeavy();
      recordDeath();
      loseFraction(0.3);
      setGameOver({ night, cause: sim.player.hp <= 0 ? 'player' : 'shelter' });
    }
  };

  const frame = useGameLoop(step, !gameOver);

  const restartRun = () => {
    startNewRun();
    resetLayout();
    navigation.replace('World');
  };

  // ---- derived HUD values ------------------------------------------------------
  const mag = sim.magazine;
  const prog = sim.progress;
  // a compact key that only changes when per-resource affordability or research
  // locks flip, so the memoized BuildDock doesn't rebuild its Skia icons every frame
  const affordKey = BUILD_MENU.map((t) => {
    const gate = BUILDING_RESEARCH_GATE[t];
    if (gate && !mods.unlockedBuildings.has(t)) return 'L';
    return (Object.entries(BUILDINGS[t].buildCost) as [ResourceType, number][])
      .map(([k, v]) => (resources[k] >= v ? '1' : '0'))
      .join('');
  }).join('|');
  const isNight = sim.phase === 'night' || sim.phase === 'dusk';
  const carrying = carryingRef.current.wood + carryingRef.current.stone + carryingRef.current.scrap;
  const { tree: nearTree, rock: nearRock } = nearestNode();
  const swing = swingUntilRef.current > Date.now() ? (swingUntilRef.current - Date.now()) / 280 : 0;
  const selectedBuilding = selectedBuildingId ? buildings.find((b) => b.id === selectedBuildingId) : null;
  const selectedMaxHp = selectedBuilding
    ? Math.round(BUILDINGS[selectedBuilding.type].baseHp * (1 + BUILDINGS[selectedBuilding.type].scaling.hpPerLevel * (selectedBuilding.level - 1)))
    : 0;
  const barracksGarrison = selectedBuilding?.type === 'barracks' ? selectedBuilding.garrison ?? 0 : 0;
  const barracksTrainingLeft =
    selectedBuilding?.type === 'barracks' && selectedBuilding.trainingUntil
      ? Math.max(0, Math.ceil((selectedBuilding.trainingUntil - Date.now()) / 1000))
      : 0;
  const barracksTrainCost: Partial<ResourceBag> =
    selectedBuilding?.type === 'barracks'
      ? {
          food: Math.round((BARRACKS_TRAIN_BASE.food ?? 0) * Math.pow(1.28, barracksGarrison)),
          scrap: Math.round((BARRACKS_TRAIN_BASE.scrap ?? 0) * Math.pow(1.28, barracksGarrison)),
        }
      : {};

  const cycleT = sim.worldClock / CYCLE.fullSec;

  const upgradeSelectedBuilding = () => {
    if (!selectedBuilding) return;
    const cost = upgradeCost(selectedBuilding);
    if (!spendResources(cost)) {
      playSfx('ui_error');
      hapticError();
      return;
    }
    upgradeBuilding(selectedBuilding.id);
    playSfx('building_upgrade');
    hapticMedium();
  };

  const sellSelectedBuilding = () => {
    if (!selectedBuilding || selectedBuilding.type === 'shelter') return;
    addBag(sellRefund(selectedBuilding));
    removeBuilding(selectedBuilding.id);
    setSelectedBuildingId(null);
    playSfx('building_hit');
    hapticMedium();
  };

  const toggleSelectedGate = () => {
    if (!selectedBuilding || selectedBuilding.type !== 'gate') return;
    toggleGate(selectedBuilding.id);
    playSfx('ui_click');
    hapticLight();
  };

  const trainBarracks = () => {
    if (!selectedBuilding || selectedBuilding.type !== 'barracks') return;
    if (barracksGarrison >= BUILDINGS.barracks.maxLevel || barracksTrainingLeft > 0) {
      playSfx('ui_error');
      hapticError();
      return;
    }
    if (!spendResources(barracksTrainCost)) {
      playSfx('ui_error');
      hapticError();
      return;
    }
    if (!startBarracksTraining(selectedBuilding.id)) {
      playSfx('ui_error');
      hapticError();
      return;
    }
    playSfx('building_upgrade');
    hapticMedium();
  };

  const tutorialTarget = (): { x: number; y: number } | null => {
    const cam = cameraRef.current;
    if (!cam) return null;
    const toScreen = (wx: number, wy: number) => ({
      x: width / 2 + (wx - cam.x) * cam.zoom,
      y: height / 2 + (wy - cam.y) * cam.zoom,
    });
    if (tutStep === 'chop') {
      const t = nearTree ?? treesRef.current.find((tr) => tr.state === 'alive');
      return t ? toScreen(t.tileX * TILE + TILE / 2, t.tileY * TILE + TILE / 2) : null;
    }
    if (tutStep === 'carry') {
      const it = itemsRef.current[0];
      return it ? toScreen(it.x, it.y) : null;
    }
    if (tutStep === 'deliver') {
      const camp = shelter();
      return camp ? toScreen((camp.origin.col + 1) * TILE, (camp.origin.row + 1) * TILE) : null;
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <GestureDetector gesture={worldTap}>
        <View style={StyleSheet.absoluteFill}>
          <GameCanvas
            sim={sim}
            frame={frame}
            width={width}
            height={height}
            dt={FIXED_DT}
            cameraOut={cameraRef}
            world={{
              trees,
              rocks,
              items: itemsRef.current,
              ghost,
              ambient: sim.lightLevel,
              playerSwing: swing,
              playerCarrying: carrying,
              playerRoll: sim.rollProgress,
            }}
          />
        </View>
      </GestureDetector>

      {/* ghost drag catcher (over everything while placing) */}
      {placing && (
        <GestureDetector gesture={ghostDrag}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      )}

      {/* ---- top HUD: clock + resources + menu ---- */}
      <View style={styles.hudTop} pointerEvents="box-none">
        <View style={styles.clockPill}>
          <View
            style={[
              styles.phaseDot,
              {
                backgroundColor:
                  sim.phase === 'day' ? '#ffd76a' : sim.phase === 'dusk' ? '#ff8a3c' : '#7a8ecf',
              },
            ]}
          />
          <View>
            <Text style={styles.clockDay}>День {night}</Text>
            <Text style={styles.clockPhase}>{PHASE_LABEL[sim.phase]}</Text>
          </View>
          {/* cycle progress arc (thin bar) */}
          <View style={styles.cycleBack}>
            <View style={[styles.cycleFill, { width: `${cycleT * 100}%` }]} />
          </View>
        </View>

        <View style={styles.resourceStrip}>
          {RESOURCE_TYPES.map((r) => {
            const atCap = Math.floor(resources[r]) >= caps[r];
            return (
              <View key={r} style={styles.resChip}>
                <ResourceIcon type={r} size={22} />
                <Text style={[styles.resValue, atCap && styles.resValueCap]}>
                  {Math.floor(resources[r])}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.menuButtons} pointerEvents="box-none">
          <Pressable style={styles.menuBtn} onPress={() => navigation.navigate('Arsenal')}>
            <Text style={styles.menuBtnIcon}>⚔</Text>
            <Text style={styles.menuBtnLabel}>Оружие</Text>
          </Pressable>
          <Pressable style={styles.menuBtn} onPress={() => navigation.navigate('Research')}>
            <Text style={styles.menuBtnIcon}>⚗</Text>
            <Text style={styles.menuBtnLabel}>Наука</Text>
          </Pressable>
          <Pressable style={styles.menuBtn} onPress={() => navigation.navigate('MainMenu')}>
            <Text style={styles.menuBtnIcon}>☰</Text>
            <Text style={styles.menuBtnLabel}>Меню</Text>
          </Pressable>
        </View>
      </View>

      {/* ---- left: HP + stamina + minimap ---- */}
      <View style={styles.statusCol} pointerEvents="none">
        <View style={styles.hpBack}>
          <View
            style={[
              styles.hpFill,
              {
                width: `${(sim.player.hp / sim.player.maxHp) * 100}%`,
                backgroundColor:
                  sim.player.hp / sim.player.maxHp > 0.5
                    ? '#5fae54'
                    : sim.player.hp / sim.player.maxHp > 0.25
                      ? C.accent
                      : C.danger,
              },
            ]}
          />
        </View>
        <View style={styles.stamBack}>
          <View style={[styles.stamFill, { width: `${(sim.stamina / sim.maxStamina) * 100}%` }]} />
        </View>
        {isNight && (
          <Text style={styles.killText}>
            Волна {Math.min(prog.wave, prog.waves)}/{prog.waves} · убито {prog.killed}
          </Text>
        )}
        <View style={styles.minimap}>
          <Minimap sim={sim} frame={frame} />
        </View>
      </View>

      {/* ---- dynamic joystick (left half) ---- */}
      {!placing && (
        <View style={styles.joyZone} pointerEvents="box-none">
          <Joystick dynamic onChange={(x, y) => ((input.current.mx = x), (input.current.my = y))} />
        </View>
      )}

      {/* ---- bottom-center: weapon HUD at night ---- */}
      {isNight && (
        <View style={styles.weaponWrap} pointerEvents="none">
          <WeaponHUD
            weapon={equipped}
            magCurrent={mag.current}
            magSize={mag.size}
            reloadProgress={sim.reloadProgress}
            abilityCdLeft={Math.max(0, sim.abilityCd)}
            abilityCdTotal={30}
            abilityActiveLeft={sim.abilityActiveLeft}
            outOfSupply={sim.outOfSupply}
            reserve={sim.supplies.ammo}
          />
        </View>
      )}

      {/* ---- build dock (hidden while placing; memoized so the 6 Skia icons
           don't rebuild every frame — only when affordability changes) ---- */}
      {!placing && !isNight && (
        <BuildDock
          affordKey={affordKey}
          onPick={startPlacing}
          resources={resources}
          unlocked={mods.unlockedBuildings}
        />
      )}

      {/* ---- placement confirm / cancel ---- */}
      {placing && (
        <View style={styles.placeBar} pointerEvents="box-none">
          <Text style={styles.placeHint}>Перетащи здание на место</Text>
          <View style={styles.placeBtns}>
            <Pressable style={[styles.placeBtn, styles.placeCancel]} onPress={cancelPlace}>
              <Text style={styles.placeBtnText}>✕</Text>
            </Pressable>
            <Pressable
              style={[styles.placeBtn, ghost?.valid ? styles.placeOk : styles.placeBtnDisabled]}
              onPress={confirmPlace}
            >
              <Text style={styles.placeBtnText}>✓</Text>
            </Pressable>
          </View>
        </View>
      )}

      {selectedBuilding && !placing && (
        <View style={styles.upgradePanel}>
          <BuildingUpgradePanel
            building={selectedBuilding}
            hpMax={selectedMaxHp}
            canAfford={canAfford}
            onUpgrade={upgradeSelectedBuilding}
            onSell={sellSelectedBuilding}
            onToggleGate={toggleSelectedGate}
            onClose={() => setSelectedBuildingId(null)}
          />
          {selectedBuilding.type === 'barracks' && (
            <View style={styles.productionPanel}>
              <Text style={styles.productionTitle}>Производство казармы</Text>
              <Text style={styles.productionText}>
                Защитники: {barracksGarrison} / {BUILDINGS.barracks.maxLevel}
              </Text>
              {barracksTrainingLeft > 0 && (
                <View style={styles.productionProgressBack}>
                  <View style={[styles.productionProgressFill, { width: `${Math.max(0, Math.min(1, 1 - barracksTrainingLeft / TRAINING_SEC)) * 100}%` }]} />
                  <Text style={styles.productionProgressText}>{barracksTrainingLeft}с</Text>
                </View>
              )}
              <Pressable
                style={[
                  styles.productionBtn,
                  (!canAfford(barracksTrainCost) || barracksGarrison >= BUILDINGS.barracks.maxLevel || barracksTrainingLeft > 0) &&
                    styles.productionBtnDisabled,
                ]}
                onPress={trainBarracks}
              >
                <Text style={styles.productionBtnText}>
                  {barracksGarrison >= BUILDINGS.barracks.maxLevel
                    ? 'Отряд укомплектован'
                    : barracksTrainingLeft > 0
                      ? 'Идёт тренировка'
                    : `Тренировать: 🌿${barracksTrainCost.food ?? 0} ⚙️${barracksTrainCost.scrap ?? 0}`}
                </Text>
              </Pressable>
            </View>
          )}
          {!isNight && (BUILDING_RECIPES[selectedBuilding.type] ?? []).length > 0 && (
            <View style={styles.productionPanel}>
              <Text style={styles.productionTitle}>
                Производство — {BUILDINGS[selectedBuilding.type].name}
              </Text>
              {(BUILDING_RECIPES[selectedBuilding.type] ?? []).map((out) => {
                const recipe = PRODUCTION_RECIPES.find((r) => r.output === out);
                if (!recipe) return null;
                const scale = out === 'ammo' ? mods.ammoCost : 1;
                const resCosts = (Object.entries(recipe.inputs) as [ResourceType, number][]).map(
                  ([k, v]) => [k, Math.max(1, Math.ceil(v * scale))] as const,
                );
                const intCosts = recipe.intermediateInputs
                  ? (Object.entries(recipe.intermediateInputs) as [IntermediateType, number][])
                  : [];
                const okOne =
                  resCosts.every(([k, v]) => resources[k] >= v) &&
                  intCosts.every(([k, v]) => intermediates[k] >= v);
                const doCraft = (count: number) => {
                  const made = craft(out, count, scale);
                  if (made > 0) {
                    playSfx('building_upgrade');
                    hapticLight();
                  } else {
                    playSfx('ui_error');
                    hapticError();
                  }
                };
                return (
                  <View key={out} style={styles.craftRow}>
                    <View style={styles.craftInfo}>
                      <Text style={styles.craftName}>
                        {INTERMEDIATE_NAME[out]} · {Math.floor(intermediates[out])}
                      </Text>
                      <View style={styles.costRow}>
                        {resCosts.map(([k, v]) => (
                          <View key={k} style={styles.costItem}>
                            <ResourceIcon type={k} size={13} />
                            <Text style={[styles.costText, resources[k] < v && styles.costTextBad]}>
                              {v}
                            </Text>
                          </View>
                        ))}
                        {intCosts.map(([k, v]) => (
                          <View key={k} style={styles.costItem}>
                            <Text style={styles.costText}>{INTERMEDIATE_LABEL[k]}</Text>
                            <Text
                              style={[styles.costText, intermediates[k] < v && styles.costTextBad]}
                            >
                              {v}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <Pressable
                      style={[styles.craftBtn, !okOne && styles.productionBtnDisabled]}
                      onPress={() => doCraft(1)}
                    >
                      <Text style={styles.productionBtnText}>+1</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.craftBtn, !okOne && styles.productionBtnDisabled]}
                      onPress={() => doCraft(5)}
                    >
                      <Text style={styles.productionBtnText}>+5</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ---- right action cluster ---- */}
      <View style={styles.actionCol} pointerEvents="box-none">
        {isNight && (
          <Pressable
            style={styles.abilityBtn}
            onPress={() => {
              sim.triggerAbility();
              hapticMedium();
            }}
          >
            <Text style={styles.abilityText}>СПОС.</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.rollBtn, sim.stamina < 30 && styles.btnDim]}
          onPress={() => {
            if (sim.roll(input.current.mx, input.current.my)) hapticLight();
          }}
        >
          <Text style={styles.rollText}>КУВЫРОК</Text>
        </Pressable>
        {isNight ? (
          <Pressable
            style={styles.fireBtn}
            onPressIn={() => {
              input.current.firing = true;
              hapticLight();
            }}
            onPressOut={() => (input.current.firing = false)}
          >
            <Text style={styles.fireText}>ОГОНЬ</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.harvestBtn, !nearTree && !nearRock && styles.btnDim]}
            onPress={harvest}
          >
            <Text style={styles.fireText}>{nearRock ? 'ДОБЫТЬ' : 'РУБИТЬ'}</Text>
          </Pressable>
        )}
      </View>

      {/* ---- dawn banner ---- */}
      {dawnBanner && (
        <View style={styles.dawnWrap} pointerEvents="none">
          <Text style={styles.dawnTitle}>РАССВЕТ</Text>
          <Text style={styles.dawnSub}>
            Ночь {dawnBanner.night} пережита · убито {dawnBanner.killed}
          </Text>
        </View>
      )}

      {/* ---- game over ---- */}
      {gameOver && (
        <View style={styles.overWrap}>
          <Text style={styles.overTitle}>ТЫ ПАЛ</Text>
          <Text style={styles.overSub}>
            {gameOver.cause === 'shelter' ? 'Костёр погас. Лагерь пал.' : 'Тьма забрала тебя.'}
            {'\n'}Продержался ночей: {night - 1}. Потеряно 30% ресурсов.
            {'\n'}Технологии и оружие сохранены.
          </Text>
          <Pressable style={styles.overBtn} onPress={restartRun}>
            <Text style={styles.overBtnText}>Начать заново (NG+)</Text>
          </Pressable>
          <Pressable style={[styles.overBtn, styles.overGhostBtn]} onPress={() => navigation.replace('MainMenu')}>
            <Text style={styles.overBtnText}>В меню</Text>
          </Pressable>
        </View>
      )}

      {showTutorial && !gameOver && (
        <DayTutorial
          step={tutStep}
          target={tutorialTarget()}
          onSkip={() => {
            markTutorialDone();
            setShowTutorial(false);
          }}
        />
      )}
    </View>
  );
}

/**
 * Memoized build dock. Re-renders only when the affordability key changes, so
 * its 6 Skia `BuildingIcon` canvases aren't rebuilt on every game frame.
 */
const BuildDock = memo(function BuildDock({
  affordKey,
  onPick,
  resources,
  unlocked,
}: {
  affordKey: string;
  onPick: (t: BuildingType) => void;
  resources: ResourceBag;
  unlocked: Set<BuildingType>;
}) {
  void affordKey;
  return (
    <View style={styles.buildDock} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.buildCards}
      >
        {BUILD_MENU.map((type) => {
          const def = BUILDINGS[type];
          const gate = BUILDING_RESEARCH_GATE[type];
          const locked = !!gate && !unlocked.has(type);
          const costs = Object.entries(def.buildCost) as [ResourceType, number][];
          const affordable = costs.every(([k, v]) => resources[k] >= v);
          return (
            <Pressable
              key={type}
              onPress={() => {
                if (locked) {
                  playSfx('ui_error');
                  hapticError();
                } else {
                  onPick(type);
                }
              }}
              style={[
                styles.buildSlot,
                !affordable && !locked && styles.buildSlotDisabled,
                locked && styles.buildSlotLocked,
              ]}
            >
              <BuildingIcon type={type} level={1} size={40} />
              <Text style={styles.slotName} numberOfLines={1}>
                {def.name}
              </Text>
              {locked && gate ? (
                <Text style={styles.slotLockText} numberOfLines={1}>
                  🔒 {gate.name}
                </Text>
              ) : (
                <View style={styles.costRow}>
                  {costs.map(([k, v]) => (
                    <View key={k} style={styles.costItem}>
                      <ResourceIcon type={k} size={11} />
                      <Text style={[styles.costText, resources[k] < v && styles.costTextBad]}>
                        {v}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}, (prev, next) => prev.affordKey === next.affordKey);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.night },

  // top hud
  hudTop: { position: 'absolute', top: 10, left: 12, right: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  clockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.alpha.darkPanel,
    borderWidth: THEME.outline.thin,
    borderColor: C.panelBorder,
  },
  phaseDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: THEME.outline.color },
  clockDay: { fontFamily: F.heading, color: C.text, fontSize: 17, lineHeight: 19 },
  clockPhase: { fontFamily: F.body, color: C.textMuted, fontSize: 12, lineHeight: 14 },
  cycleBack: { width: 56, height: 5, backgroundColor: C.black, borderRadius: 3, overflow: 'hidden' },
  cycleFill: { height: '100%', backgroundColor: C.accent },
  resourceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.alpha.darkPanel,
    borderWidth: THEME.outline.thin,
    borderColor: C.panelBorder,
  },
  resChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 3 },
  resValue: { fontFamily: F.heading, color: C.text, fontSize: 16, minWidth: 20 },
  resValueCap: { color: C.resource },
  menuButtons: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  menuBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 64,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.alpha.darkPanel,
    borderWidth: THEME.outline.width,
    borderColor: C.accent,
  },
  menuBtnIcon: { color: C.resource, fontSize: 18, lineHeight: 20 },
  menuBtnLabel: { fontFamily: F.heading, color: C.text, fontSize: 12, marginTop: 1 },

  // left status
  statusCol: { position: 'absolute', top: 78, left: 12, gap: 6 },
  hpBack: {
    width: 190,
    height: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: THEME.outline.color,
    borderRadius: 7,
    overflow: 'hidden',
  },
  hpFill: { height: '100%', backgroundColor: '#5fae54', borderRadius: 5 },
  stamBack: {
    width: 150,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: THEME.outline.color,
    borderRadius: 4,
    overflow: 'hidden',
  },
  stamFill: { height: '100%', backgroundColor: C.resource, borderRadius: 3 },
  killText: { fontFamily: F.body, color: C.textMuted, fontSize: 13 },
  minimap: { marginTop: 6, borderWidth: 1, borderColor: C.panelBorder, alignSelf: 'flex-start' },

  joyZone: { position: 'absolute', left: 0, top: 120, bottom: 0, width: '42%' },

  weaponWrap: { position: 'absolute', bottom: 16, alignSelf: 'center' },

  // build dock
  buildDock: { position: 'absolute', left: 14, right: 166, bottom: 10 },
  buildCards: { gap: 8, alignItems: 'center', flexGrow: 1, paddingHorizontal: 4 },
  buildSlot: {
    width: 78,
    height: 96,
    borderRadius: THEME.radius.md,
    borderWidth: THEME.outline.width,
    borderColor: C.panelBorder,
    backgroundColor: THEME.alpha.darkPanel,
    alignItems: 'center',
    paddingTop: 5,
    gap: 2,
  },
  buildSlotDisabled: { opacity: 0.55 },
  buildSlotLocked: { opacity: 0.6, borderColor: C.inactive, borderStyle: 'dashed' },
  slotName: { fontFamily: F.heading, color: C.text, fontSize: 10, width: '94%', textAlign: 'center', flexShrink: 0 },
  slotLockText: { fontFamily: F.body, color: C.inactive, fontSize: 9, width: '94%', textAlign: 'center' },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center', flexShrink: 0 },
  costItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  costText: { fontFamily: F.heading, color: C.resource, fontSize: 11 },
  costTextBad: { color: '#e25b50' },

  // craft rows (workshop / garden production)
  craftRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  craftInfo: { flex: 1, gap: 2 },
  craftName: { fontFamily: F.body, color: C.text, fontSize: 13 },
  craftBtn: {
    width: 44,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderWidth: THEME.outline.width,
    borderColor: THEME.outline.color,
    borderRadius: THEME.radius.xs,
  },

  // placement
  placeBar: { position: 'absolute', bottom: 18, alignSelf: 'center', alignItems: 'center', gap: 10 },
  placeHint: {
    fontFamily: F.heading,
    color: C.text,
    fontSize: 15,
    backgroundColor: THEME.alpha.panel95,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
  },
  placeBtns: { flexDirection: 'row', gap: 22 },
  placeBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: THEME.outline.color,
  },
  placeOk: { backgroundColor: '#3f8a3a' },
  placeCancel: { backgroundColor: C.danger },
  placeBtnDisabled: { backgroundColor: C.inactive },
  placeBtnText: { color: C.white, fontSize: 30, fontFamily: F.heading },
  upgradePanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 124,
    alignItems: 'center',
  },
  productionPanel: {
    marginTop: 8,
    width: 280,
    padding: 10,
    gap: 6,
    backgroundColor: THEME.alpha.panel95,
    borderWidth: THEME.outline.thin,
    borderColor: C.accent,
  },
  productionTitle: { fontFamily: F.heading, color: C.text, fontSize: 14, textAlign: 'center' },
  productionText: { fontFamily: F.body, color: C.textMuted, fontSize: 13, textAlign: 'center' },
  productionProgressBack: {
    height: 18,
    justifyContent: 'center',
    backgroundColor: C.black,
    borderWidth: THEME.outline.thin,
    borderColor: THEME.outline.color,
    overflow: 'hidden',
  },
  productionProgressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: C.accent,
  },
  productionProgressText: { fontFamily: F.heading, color: C.text, fontSize: 11, textAlign: 'center' },
  productionBtn: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: C.accent,
    borderWidth: THEME.outline.width,
    borderColor: THEME.outline.color,
  },
  productionBtnDisabled: { opacity: 0.45 },
  productionBtnText: { fontFamily: F.heading, color: C.text, fontSize: 13, textAlign: 'center' },

  // right actions
  actionCol: { position: 'absolute', right: 18, bottom: 18, alignItems: 'center', gap: 14 },
  fireBtn: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: THEME.alpha.danger55,
    borderWidth: 4,
    borderColor: C.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harvestBtn: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: C.accent,
    borderWidth: 4,
    borderColor: THEME.outline.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fireText: { fontFamily: F.heading, color: C.text, fontSize: 19, letterSpacing: 1 },
  rollBtn: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: THEME.alpha.resource25,
    borderWidth: 3,
    borderColor: C.resource,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rollText: { fontFamily: F.heading, color: C.resource, fontSize: 13 },
  abilityBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.alpha.resource25,
    borderWidth: 2,
    borderColor: C.resource,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abilityText: { fontFamily: F.heading, color: C.resource, fontSize: 13 },
  btnDim: { opacity: 0.45 },

  // dawn banner
  dawnWrap: { position: 'absolute', top: '26%', alignSelf: 'center', alignItems: 'center' },
  dawnTitle: {
    fontFamily: F.display,
    color: C.resource,
    fontSize: 56,
    letterSpacing: 4,
    textShadowColor: THEME.alpha.black80,
    textShadowRadius: 16,
  },
  dawnSub: { fontFamily: F.body, color: C.text, fontSize: 18, marginTop: 6 },

  // game over
  overWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.alpha.black80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  overTitle: {
    fontFamily: F.display,
    color: C.danger,
    fontSize: 64,
    letterSpacing: 6,
    textShadowColor: C.black,
    textShadowRadius: 20,
  },
  overSub: { fontFamily: F.body, color: C.text, fontSize: 17, textAlign: 'center', lineHeight: 24 },
  overBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: C.accent,
    borderRadius: THEME.radius.md,
    borderWidth: THEME.outline.width,
    borderColor: THEME.outline.color,
    minWidth: 280,
    alignItems: 'center',
  },
  overGhostBtn: { backgroundColor: C.panel },
  overBtnText: { fontFamily: F.heading, color: C.text, fontSize: 17 },
});
