/**
 * Meme character skins, sold for crystals in the Shop. Each skin recolors the
 * chibi survivor and may add a signature face feature (doge ears, the amogus
 * visor, …). Names are localized via the `skin.<id>` keys.
 */

export type SkinId = 'default' | 'gigachad' | 'doge' | 'shrek' | 'amogus' | 'pepe' | 'banana';

export interface SkinDef {
  id: SkinId;
  /** Russian fallback name; real name via i18n `skin.<id>`. */
  name: string;
  emoji: string;
  /** Crystal price; 0 = owned from the start. */
  cost: number;
  palette: {
    jacket: string;
    jacketDark: string;
    pants: string;
    skin: string;
    hair: string;
    accent: string;
  };
  /** Signature extra drawn on the head. */
  feature?: 'jaw' | 'dogeEars' | 'ogreEars' | 'visor' | 'frogMouth' | 'peel';
}

export const SKINS: Record<SkinId, SkinDef> = {
  default: {
    id: 'default',
    name: 'Выживший',
    emoji: '🧑',
    cost: 0,
    palette: { jacket: '#7a5a3a', jacketDark: '#5d4226', pants: '#4a4f57', skin: '#e8b88a', hair: '#3d2c1d', accent: '#d98f3e' },
  },
  gigachad: {
    id: 'gigachad',
    name: 'Гигачад',
    emoji: '🗿',
    cost: 300,
    palette: { jacket: '#2d2d33', jacketDark: '#1c1c21', pants: '#3a3a41', skin: '#c9c9cf', hair: '#17171b', accent: '#ffffff' },
    feature: 'jaw',
  },
  doge: {
    id: 'doge',
    name: 'Доге',
    emoji: '🐕',
    cost: 350,
    palette: { jacket: '#d9a44a', jacketDark: '#b8842f', pants: '#e8c98a', skin: '#f0d9a0', hair: '#e3bb6c', accent: '#fff3d6' },
    feature: 'dogeEars',
  },
  shrek: {
    id: 'shrek',
    name: 'Болотный Огр',
    emoji: '🧌',
    cost: 350,
    palette: { jacket: '#e8e4d4', jacketDark: '#c9c4b0', pants: '#6b4a2f', skin: '#9bc25b', hair: '#9bc25b', accent: '#7a9c41' },
    feature: 'ogreEars',
  },
  amogus: {
    id: 'amogus',
    name: 'Красный Подозреваемый',
    emoji: '🛸',
    cost: 400,
    palette: { jacket: '#d63a3a', jacketDark: '#a82626', pants: '#d63a3a', skin: '#d63a3a', hair: '#d63a3a', accent: '#8fd4e8' },
    feature: 'visor',
  },
  pepe: {
    id: 'pepe',
    name: 'Грустная Лягушка',
    emoji: '🐸',
    cost: 400,
    palette: { jacket: '#2f4a6b', jacketDark: '#22364f', pants: '#2f4a6b', skin: '#6fae4e', hair: '#6fae4e', accent: '#5a9440' },
    feature: 'frogMouth',
  },
  banana: {
    id: 'banana',
    name: 'Банан',
    emoji: '🍌',
    cost: 500,
    palette: { jacket: '#f2d23c', jacketDark: '#d4b322', pants: '#f2d23c', skin: '#fae98c', hair: '#f2d23c', accent: '#8a7a1e' },
    feature: 'peel',
  },
};

export const SKIN_LIST: SkinDef[] = Object.values(SKINS);
