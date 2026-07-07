import type { Card, Color, Format } from '../types/card';
import { BASIC_LAND_FOR_COLOR, COLORS, isLand } from '../types/card';
import type { Deck, DeckEntry } from '../types/deck';
import { makeBasicLand } from '../engine/manabase';
import { toArenaName } from './arenaName';

const BASIC_BY_NAME = new Map<string, Color>(
  (Object.entries(BASIC_LAND_FOR_COLOR) as [Color, string][]).map(([c, n]) => [
    n.toLowerCase(),
    c,
  ]),
);

export interface ParsedLine {
  qty: number;
  name: string;
  set?: string;
  collectorNumber?: string;
}

export interface ImportResult {
  deck: Deck;
  warnings: string[];
}

const LINE_RE = /^(\d+)\s+(.+?)(?:\s+\(([A-Za-z0-9]+)\)\s+(\S+))?\s*$/;
const SECTION_HEADERS = new Set(['deck', 'sideboard', 'commander', 'companion']);

/** Parse a single "N Name (SET) num" line, or null if it isn't one. */
export function parseLine(raw: string): ParsedLine | null {
  const m = raw.trim().match(LINE_RE);
  if (!m) return null;
  return {
    qty: parseInt(m[1], 10),
    name: m[2].trim(),
    set: m[3]?.toUpperCase(),
    collectorNumber: m[4],
  };
}

/** Build a fast name-resolution index from the pool. */
function buildIndex(pool: Card[]): {
  byKey: Map<string, Card>;
  byName: Map<string, Card>;
} {
  const byKey = new Map<string, Card>();
  const byName = new Map<string, Card>();
  for (const card of pool) {
    const key = `${card.set}:${card.collectorNumber}`.toLowerCase();
    byKey.set(key, card);
    // Index by both full and Arena (front-face) name, lowercased.
    for (const n of [card.name, toArenaName(card)]) {
      const lk = n.toLowerCase();
      if (!byName.has(lk)) byName.set(lk, card);
    }
  }
  return { byKey, byName };
}

function resolve(
  line: ParsedLine,
  idx: ReturnType<typeof buildIndex>,
): Card | null {
  // Basic lands are synthetic (not in the pool) — reconstruct them by name.
  const basicColor = BASIC_BY_NAME.get(line.name.toLowerCase());
  if (basicColor) return makeBasicLand(basicColor);

  if (line.set && line.collectorNumber) {
    const hit = idx.byKey.get(`${line.set}:${line.collectorNumber}`.toLowerCase());
    if (hit) return hit;
  }
  return idx.byName.get(line.name.toLowerCase()) ?? null;
}

/**
 * Parse MTGA deck text into a Deck, resolving cards against the pool.
 * Basic lands and unresolved entries are surfaced as warnings rather than
 * throwing.
 */
export function parseArenaText(
  text: string,
  pool: Card[],
  format: Format = 'standard',
): ImportResult {
  const idx = buildIndex(pool);
  const warnings: string[] = [];

  const lines = text.split(/\r?\n/);
  let section: 'deck' | 'sideboard' | 'commander' = 'deck';
  let sawHeader = false;

  const main: DeckEntry[] = [];
  const sideboard: DeckEntry[] = [];
  let commander: Card | null = null;

  const addTo = (bucket: DeckEntry[], card: Card, qty: number) => {
    const existing = bucket.find((e) => e.card.oracleId === card.oracleId);
    if (existing) existing.qty += qty;
    else bucket.push({ card, qty });
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();

    if (SECTION_HEADERS.has(lower)) {
      sawHeader = true;
      if (lower === 'commander') section = 'commander';
      else if (lower === 'sideboard' || lower === 'companion') section = 'sideboard';
      else section = 'deck';
      continue;
    }

    const parsed = parseLine(trimmed);
    if (!parsed) {
      warnings.push(`Could not parse line: "${trimmed}"`);
      continue;
    }
    // An unlabeled second block after a blank line defaults to sideboard,
    // but most exports are labeled; without a header we treat lines as deck.
    if (!sawHeader) section = 'deck';

    const card = resolve(parsed, idx);
    if (!card) {
      warnings.push(`Card not found in pool: "${parsed.name}"`);
      continue;
    }

    if (section === 'commander') commander = card;
    else if (section === 'sideboard') addTo(sideboard, card, parsed.qty);
    else addTo(main, card, parsed.qty);
  }

  const colors = deriveDeckColors(main, commander);
  const now = new Date().toISOString();

  // Infer the format: a commander means a Brawl variant, and a list of ~100
  // cards means the full 100-card Brawl rather than 60-card Standard Brawl.
  const mainTotal = main.reduce((s, e) => s + e.qty, 0);
  const inferred: Format = commander
    ? mainTotal + 1 >= 90
      ? 'brawl'
      : 'standardbrawl'
    : format === 'standard'
      ? 'standard'
      : format;

  const deck: Deck = {
    id: `import-${Date.now().toString(36)}`,
    name: commander ? `${commander.name} Brawl` : 'Imported Deck',
    format: commander ? inferred : 'standard',
    commander,
    main,
    sideboard,
    colors,
    archetype: null,
    seed: null,
    createdAt: now,
    updatedAt: now,
  };

  return { deck, warnings };
}

function deriveDeckColors(main: DeckEntry[], commander: Card | null): Color[] {
  const set = new Set<Color>();
  if (commander) commander.colorIdentity.forEach((c) => set.add(c));
  for (const { card } of main) {
    if (isLand(card)) continue;
    card.colors.forEach((c) => set.add(c));
  }
  return COLORS.filter((c) => set.has(c));
}
