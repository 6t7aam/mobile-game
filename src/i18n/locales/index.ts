/**
 * Generated locale tables (see scripts/translate_locales.py). RU/EN live in
 * ../strings.ts as the hand-written source of truth.
 */
import type { Language, Table } from '../strings';

export const LOCALE_TABLES: Partial<Record<Language, Table>> = {
  zh: require('./zh.json'),
  hi: require('./hi.json'),
  es: require('./es.json'),
  fr: require('./fr.json'),
  ar: require('./ar.json'),
  bn: require('./bn.json'),
  pt: require('./pt.json'),
  ur: require('./ur.json'),
  id: require('./id.json'),
  de: require('./de.json'),
  ja: require('./ja.json'),
  tr: require('./tr.json'),
  ko: require('./ko.json'),
  it: require('./it.json'),
  vi: require('./vi.json'),
  th: require('./th.json'),
  pl: require('./pl.json'),
  nl: require('./nl.json'),
};
