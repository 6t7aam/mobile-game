/**
 * Localization string table. The game ships RU-first (the design spec is in
 * Russian) with an EN mirror so it's store-ready for both markets. Access via
 * the `useT()` hook (reactive to the language setting) or `t()` for non-React
 * call sites. Missing EN keys gracefully fall back to RU.
 */

import type { Language } from '@/store/settingsStore';

export type StringKey =
  // common
  | 'common.back'
  | 'common.close'
  | 'common.cancel'
  | 'common.max'
  // menu
  | 'menu.play'
  | 'menu.arsenal'
  | 'menu.codex'
  | 'menu.settings'
  | 'menu.bestNight'
  // settings
  | 'settings.title'
  | 'settings.audio'
  | 'settings.music'
  | 'settings.sfx'
  | 'settings.haptics'
  | 'settings.reducedMotion'
  | 'settings.quality'
  | 'settings.language'
  | 'settings.statsTitle'
  | 'settings.bestNight'
  | 'settings.nightsSurvived'
  | 'settings.zombiesKilled'
  | 'settings.deaths'
  | 'settings.wipe'
  | 'settings.on'
  | 'settings.off'
  | 'settings.qualityLow'
  | 'settings.qualityHigh'
  // day
  | 'day.phase'
  | 'day.startNight'
  | 'day.research'
  | 'day.arsenal'
  // tutorial
  | 'tutorial.welcome'
  | 'tutorial.build'
  | 'tutorial.craft'
  | 'tutorial.startNight'
  | 'tutorial.move'
  | 'tutorial.fire'
  | 'tutorial.skip'
  | 'tutorial.next'
  | 'tutorial.done';

type Table = Record<StringKey, string>;

const ru: Table = {
  'common.back': '‹ Назад',
  'common.close': 'Закрыть',
  'common.cancel': 'Отмена',
  'common.max': 'МАКС',

  'menu.play': 'Начать выживание',
  'menu.arsenal': 'Арсенал',
  'menu.codex': 'Кодекс',
  'menu.settings': 'Настройки',
  'menu.bestNight': 'Лучший результат: Ночь',

  'settings.title': 'Настройки',
  'settings.audio': 'Звук',
  'settings.music': 'Музыка',
  'settings.sfx': 'Эффекты',
  'settings.haptics': 'Вибрация',
  'settings.reducedMotion': 'Меньше анимаций',
  'settings.quality': 'Качество',
  'settings.language': 'Язык',
  'settings.statsTitle': 'Статистика',
  'settings.bestNight': 'Лучшая ночь',
  'settings.nightsSurvived': 'Ночей пережито',
  'settings.zombiesKilled': 'Зомби убито',
  'settings.deaths': 'Падений',
  'settings.wipe': 'Сбросить весь прогресс',
  'settings.on': 'Вкл',
  'settings.off': 'Выкл',
  'settings.qualityLow': 'Низкое',
  'settings.qualityHigh': 'Высокое',

  'day.phase': 'ДЕНЬ · Ночь',
  'day.startNight': 'Начать Ночь',
  'day.research': 'Исследования',
  'day.arsenal': 'Арсенал',

  'tutorial.welcome': 'Мир пал. Держи базу столько ночей, сколько сможешь.',
  'tutorial.build': 'Выбери здание внизу и тапни по сетке, чтобы построить. Ставь стены вокруг Убежища.',
  'tutorial.craft': 'Крафти патроны из ресурсов — без них огнестрел молчит ночью.',
  'tutorial.startNight': 'Готов? Жми «Начать Ночь».',
  'tutorial.move': 'Двигайся джойстиком слева.',
  'tutorial.fire': 'Жми ОГОНЬ — авто-прицел сам найдёт ближайшего.',
  'tutorial.skip': 'Пропустить',
  'tutorial.next': 'Дальше',
  'tutorial.done': 'Понятно',
};

const en: Partial<Table> = {
  'common.back': '‹ Back',
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.max': 'MAX',

  'menu.play': 'Start Surviving',
  'menu.arsenal': 'Arsenal',
  'menu.codex': 'Codex',
  'menu.settings': 'Settings',
  'menu.bestNight': 'Best run: Night',

  'settings.title': 'Settings',
  'settings.audio': 'Audio',
  'settings.music': 'Music',
  'settings.sfx': 'SFX',
  'settings.haptics': 'Haptics',
  'settings.reducedMotion': 'Reduced motion',
  'settings.quality': 'Quality',
  'settings.language': 'Language',
  'settings.statsTitle': 'Statistics',
  'settings.bestNight': 'Best night',
  'settings.nightsSurvived': 'Nights survived',
  'settings.zombiesKilled': 'Zombies killed',
  'settings.deaths': 'Falls',
  'settings.wipe': 'Wipe all progress',
  'settings.on': 'On',
  'settings.off': 'Off',
  'settings.qualityLow': 'Low',
  'settings.qualityHigh': 'High',

  'day.phase': 'DAY · Night',
  'day.startNight': 'Start Night',
  'day.research': 'Research',
  'day.arsenal': 'Arsenal',

  'tutorial.welcome': 'The world has fallen. Hold your base as many nights as you can.',
  'tutorial.build': 'Pick a building below and tap the grid to place it. Wall off the Shelter.',
  'tutorial.craft': 'Craft ammo from resources — without it, firearms fall silent at night.',
  'tutorial.startNight': 'Ready? Hit "Start Night".',
  'tutorial.move': 'Move with the left joystick.',
  'tutorial.fire': 'Tap FIRE — auto-aim finds the nearest threat.',
  'tutorial.skip': 'Skip',
  'tutorial.next': 'Next',
  'tutorial.done': 'Got it',
};

const TABLES: Record<Language, Partial<Table>> = { ru, en };

/** Resolve a key for a language, falling back to RU then the key itself. */
export function translate(lang: Language, key: StringKey): string {
  return TABLES[lang]?.[key] ?? ru[key] ?? key;
}
