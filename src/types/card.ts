// Core domain types for the MTGA Builder.

export type Color = 'W' | 'U' | 'B' | 'R' | 'G';
export const COLORS: Color[] = ['W', 'U', 'B', 'R', 'G'];

export const COLOR_NAMES: Record<Color, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};

export const BASIC_LAND_FOR_COLOR: Record<Color, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

/**
 * Supported formats:
 * - standard:      60-card constructed, up to 4 copies.
 * - standardbrawl: 60-card singleton + commander, Standard pool.
 * - brawl:         100-card singleton + commander, full Arena pool with the
 *                  competitive Brawl ban list (Scryfall `brawl` legality).
 */
export type Format = 'standard' | 'standardbrawl' | 'brawl';

export const FORMAT_LABELS: Record<Format, string> = {
  standard: 'Standard',
  standardbrawl: 'Standard Brawl',
  brawl: 'Brawl (100)',
};

/** Total deck size per format (commander counts toward the total). */
export const FORMAT_TOTALS: Record<Format, number> = {
  standard: 60,
  standardbrawl: 60,
  brawl: 100,
};

/** Formats that are singleton and use a commander. */
export function isCommanderFormat(format: Format): boolean {
  return format !== 'standard';
}

/** Is this card legal in the given format? Tolerates old cached cards that predate `legalStandardBrawl`. */
export function isFormatLegal(card: Card, format: Format): boolean {
  if (format === 'standard') return card.legalStandard;
  if (format === 'standardbrawl') return card.legalStandardBrawl ?? card.legalBrawl;
  return card.legalBrawl;
}

export type Archetype =
  | 'aggro'
  | 'tempo'
  | 'midrange'
  | 'control'
  | 'ramp'
  | 'combo';

export const ARCHETYPES: Archetype[] = [
  'aggro',
  'tempo',
  'midrange',
  'control',
  'ramp',
  'combo',
];

/**
 * Trimmed card record. This is the exact shape persisted in
 * `src/data/standard-pool.json` by the update-pool script, and the shape the
 * whole app + engine operates on.
 */
export interface Card {
  /** Scryfall printing id (unique). */
  id: string;
  /** Oracle id — stable identity across printings; used for dedupe + copy limits. */
  oracleId: string;
  /** Full card name (both faces for DFC, e.g. "A // B"). */
  name: string;
  /** Mana value / converted mana cost. */
  cmc: number;
  /** Mana cost string, e.g. "{1}{U}{U}". Empty for lands with no cost. */
  manaCost: string;
  /** Castable colors of the card. */
  colors: Color[];
  /** Color identity (for Brawl legality). */
  colorIdentity: Color[];
  /** Full type line, e.g. "Legendary Creature — Elf Druid". */
  typeLine: string;
  /** Keyword abilities, e.g. ["Flying", "Haste"]. */
  keywords: string[];
  /** Oracle rules text (both faces joined by newlines). */
  oracleText: string;
  power: string | null;
  toughness: string | null;
  /** EDHREC popularity rank — lower = more played. Quality proxy. */
  edhrecRank: number | null;
  /** Mana the card can produce (for lands / mana rocks). */
  producedMana: Color[];
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic' | string;
  /** Uppercase set code used by Arena import. */
  set: string;
  collectorNumber: string;
  /** Present when the card is available on Arena. */
  arenaId: number | null;
  layout: string;
  /** Front-face image URL (normal size) for grid tiles. */
  image: string | null;
  /** Higher-resolution image URL for the card close-up. */
  imageLarge: string | null;
  legalStandard: boolean;
  /** Legal in 60-card Standard Brawl. Optional: older cached pools predate this field. */
  legalStandardBrawl?: boolean;
  /** Legal in 100-card Brawl (Scryfall `brawl` — reflects the competitive Brawl ban list). */
  legalBrawl: boolean;
}

export interface PoolMeta {
  updated: string;
  count: number;
  /** Cards in the lazy-loaded brawl-extra pool (non-Standard, Brawl-legal). */
  brawlExtraCount?: number;
  sets: string[];
  source: 'scryfall' | 'fallback';
}

// ---- Derived card helpers ---------------------------------------------------

export function isLand(card: Card): boolean {
  return /\bLand\b/.test(card.typeLine);
}

export function isBasicLand(card: Card): boolean {
  return /\bBasic\b/.test(card.typeLine) && isLand(card);
}

export function isCreature(card: Card): boolean {
  return /\bCreature\b/.test(card.typeLine);
}

export function isPlaneswalker(card: Card): boolean {
  return /\bPlaneswalker\b/.test(card.typeLine);
}

export function isLegendary(card: Card): boolean {
  return /\bLegendary\b/.test(card.typeLine);
}

/**
 * Can this card be a Brawl commander? Both Brawl variants allow any legendary
 * creature or any legendary planeswalker to command the deck.
 */
export function canBeCommander(card: Card): boolean {
  if (!isLegendary(card)) return false;
  return isCreature(card) || isPlaneswalker(card);
}

/** CMC bucket label used for curve display & targeting. */
export function cmcBucket(cmc: number): '0-1' | '2' | '3' | '4' | '5' | '6+' {
  if (cmc <= 1) return '0-1';
  if (cmc === 2) return '2';
  if (cmc === 3) return '3';
  if (cmc === 4) return '4';
  if (cmc === 5) return '5';
  return '6+';
}
