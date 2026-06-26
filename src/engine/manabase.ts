import type { Card, Color } from '../types/card';
import { BASIC_LAND_FOR_COLOR, COLORS, isBasicLand, isLand } from '../types/card';
import type { DeckEntry } from '../types/deck';
import { aggregatePips } from '../lib/mana';
import { landScore } from './scoring';

export interface ManaBaseResult {
  lands: DeckEntry[];
  /** Synthetic basic-land cards keyed by color (so export/UI have a Card). */
  basicsUsed: Record<Color, number>;
}

/** Build a synthetic Card for a basic land so it round-trips through the UI. */
export function makeBasicLand(color: Color): Card {
  const name = BASIC_LAND_FOR_COLOR[color];
  return {
    id: `basic-${color}`,
    oracleId: `basic-${color}`,
    name,
    cmc: 0,
    manaCost: '',
    colors: [],
    colorIdentity: [color],
    typeLine: `Basic Land — ${name}`,
    keywords: [],
    oracleText: `({T}: Add {${color}}.)`,
    power: null,
    toughness: null,
    edhrecRank: null,
    producedMana: [color],
    rarity: 'common',
    set: 'BASIC',
    collectorNumber: '0',
    arenaId: null,
    layout: 'normal',
    image: null,
    imageLarge: null,
    legalStandard: true,
    legalBrawl: true,
  };
}

/**
 * Construct a mana base for the chosen spells.
 *
 * @param spells       chosen nonland entries (drives pip requirements)
 * @param landPool     candidate nonbasic lands legal in the deck
 * @param landCount    total lands to produce
 * @param colors       deck colors
 * @param singleton    Brawl: at most one of each nonbasic land
 */
export function buildManaBase(
  spells: DeckEntry[],
  landPool: Card[],
  landCount: number,
  colors: Color[],
  singleton: boolean,
): ManaBaseResult {
  const lands: DeckEntry[] = [];
  const usedColors = colors.length > 0 ? colors : [];

  // --- Nonbasic fixing lands ---
  // Only multi-color decks meaningfully want duals.
  let nonbasicTarget = 0;
  if (usedColors.length >= 2) {
    nonbasicTarget = Math.round(landCount * 0.45);
  } else if (usedColors.length === 1) {
    nonbasicTarget = Math.min(2, Math.round(landCount * 0.1));
  }

  const candidates = landPool
    .filter((c) => isLand(c) && !isBasicLand(c))
    .filter((c) => c.colorIdentity.every((ci) => usedColors.includes(ci)))
    // Must produce at least one of our colors to be worth a slot.
    .filter((c) => c.producedMana.some((m) => usedColors.includes(m)))
    .sort((a, b) => landScore(b, usedColors) - landScore(a, usedColors));

  let nonbasicCount = 0;
  for (const land of candidates) {
    if (nonbasicCount >= nonbasicTarget || lands.length >= landCount) break;
    const maxCopies = singleton ? 1 : Math.min(4, landCount - lands.length);
    const copies = Math.min(maxCopies, nonbasicTarget - nonbasicCount);
    if (copies <= 0) continue;
    lands.push({ card: land, qty: copies });
    nonbasicCount += copies;
  }

  // --- Basics, proportional to residual pip requirements ---
  const remaining = landCount - lands.reduce((s, e) => s + e.qty, 0);
  const basicsUsed = distributeBasics(spells, lands, remaining, usedColors);
  for (const color of COLORS) {
    if (basicsUsed[color] > 0) {
      lands.push({ card: makeBasicLand(color), qty: basicsUsed[color] });
    }
  }

  return { lands, basicsUsed };
}

/** Allocate `count` basic lands across colors proportional to pip demand. */
function distributeBasics(
  spells: DeckEntry[],
  nonbasics: DeckEntry[],
  count: number,
  colors: Color[],
): Record<Color, number> {
  const out: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  if (count <= 0 || colors.length === 0) return out;

  if (colors.length === 1) {
    out[colors[0]] = count;
    return out;
  }

  const pips = aggregatePips(spells);
  // Subtract sources already provided by nonbasics so we top up the gaps.
  const provided: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const { card, qty } of nonbasics) {
    for (const m of card.producedMana) {
      if ((colors as string[]).includes(m)) provided[m as Color] += qty;
    }
  }

  const demand: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let totalDemand = 0;
  for (const c of colors) {
    const d = Math.max(0.5, pips[c] - provided[c] * 0.5);
    demand[c] = d;
    totalDemand += d;
  }
  if (totalDemand === 0) {
    // Even split fallback.
    for (const c of colors) demand[c] = 1;
    totalDemand = colors.length;
  }

  // Largest-remainder apportionment for stable integer counts.
  const exact: { color: Color; value: number }[] = colors.map((c) => ({
    color: c,
    value: (demand[c] / totalDemand) * count,
  }));
  let assigned = 0;
  for (const e of exact) {
    out[e.color] = Math.floor(e.value);
    assigned += out[e.color];
  }
  let leftover = count - assigned;
  exact
    .sort((a, b) => (b.value % 1) - (a.value % 1))
    .forEach((e) => {
      if (leftover > 0) {
        out[e.color]++;
        leftover--;
      }
    });
  return out;
}
