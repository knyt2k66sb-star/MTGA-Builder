import { describe, expect, it } from 'vitest';
import { POOL } from '../data/pool';
import { generateDecks, VIABILITY_THRESHOLD } from './build';
import { validateDeck } from './validate';
import { viableThemes } from './themes';
import { isBasicLand, isLand } from '../types/card';
import type { Deck, MultiGenParams, RankedDeck } from '../types/deck';

function run(params: Partial<MultiGenParams>) {
  const full: MultiGenParams = { format: 'standard', colors: ['R'], ...params };
  return generateDecks(full, POOL);
}

/** Jaccard similarity of two decks' nonbasic card lists (0 = disjoint, 1 = identical). */
function jaccard(a: Deck, b: Deck): number {
  const setOf = (d: Deck) =>
    new Set(d.main.filter((e) => !isBasicLand(e.card)).map((e) => e.card.oracleId));
  const sa = setOf(a);
  const sb = setOf(b);
  let inter = 0;
  for (const id of sa) if (sb.has(id)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function avgPairwiseSimilarity(results: RankedDeck[]): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      sum += jaccard(results[i].deck, results[j].deck);
      count++;
    }
  }
  return count ? sum / count : 0;
}

describe('viableThemes', () => {
  it('always includes goodstuff', () => {
    const themes = viableThemes(POOL);
    expect(themes.some((t) => t.id === 'goodstuff')).toBe(true);
  });

  it('detects tribal + static themes in a rich pool', () => {
    const ids = viableThemes(POOL).map((t) => t.id);
    // The enriched fallback pool has Goblins, Elves, counters, sacrifice, etc.
    expect(ids).toContain('tribe-goblin');
    expect(ids.length).toBeGreaterThan(3);
  });
});

describe('generateDecks', () => {
  it('returns multiple distinct decks for a mono color', () => {
    const results = run({ colors: ['R'] });
    expect(results.length).toBeGreaterThan(1);
    // Distinct themes among the results.
    const themeIds = new Set(results.map((r) => r.themeId));
    expect(themeIds.size).toBeGreaterThan(1);
  });

  it('returns multiple distinct decks for a two-color pair', () => {
    const results = run({ colors: ['B', 'R'] });
    expect(results.length).toBeGreaterThan(1);
  });

  it('every result is a legal 60-card deck above the threshold', () => {
    const results = run({ colors: ['G'] });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const total = r.deck.main.reduce((s, e) => s + e.qty, 0);
      expect(total).toBe(60);
      expect(r.viability).toBeGreaterThanOrEqual(VIABILITY_THRESHOLD);
      expect(validateDeck(r.deck).filter((i) => i.level === 'error')).toEqual([]);
      for (const e of r.deck.main) {
        if (!isBasicLand(e.card)) expect(e.qty).toBeLessThanOrEqual(4);
      }
    }
  });

  it('results are ranked by viability descending', () => {
    const results = run({ colors: ['R', 'G'] });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].viability).toBeGreaterThanOrEqual(results[i].viability);
    }
  });

  it('does not return near-identical decks', () => {
    const results = run({ colors: ['R'] });
    const sig = (r: (typeof results)[number]) =>
      r.deck.main
        .filter((e) => !isBasicLand(e.card))
        .map((e) => e.card.oracleId)
        .sort()
        .join(',');
    const sigs = results.map(sig);
    expect(new Set(sigs).size).toBe(sigs.length);
  });

  it('respects an explicit archetype filter', () => {
    const results = run({ colors: ['R'], archetype: 'aggro' });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.archetype).toBe('aggro');
  });

  it('generates multiple brawl decks within commander identity', () => {
    const results = run({ format: 'brawl', colors: ['B'] });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.deck.commander).not.toBeNull();
      const allowed = new Set(r.deck.commander!.colorIdentity);
      for (const e of r.deck.main) {
        expect(e.card.colorIdentity.every((c) => allowed.has(c))).toBe(true);
      }
    }
  });

  it('produces genuinely distinct decks, not reskins of the same pile', () => {
    // Average pairwise Jaccard similarity across nonbasic cards should be low:
    // decks built around different synergy cores should share only a minority
    // of their card list, not the same quality-sorted staples over and over.
    for (const colors of [['R'], ['R', 'G'], ['B', 'R']] as const) {
      const results = run({ colors: [...colors] });
      expect(results.length).toBeGreaterThan(5);
      const avgSim = avgPairwiseSimilarity(results);
      expect(avgSim).toBeLessThan(0.35);
    }
  });

  it('includes composite dual-theme decks when the color pool supports it', () => {
    const results = run({ colors: ['R', 'G'] });
    const combos = results.filter((r) => r.themeId.includes('+'));
    expect(combos.length).toBeGreaterThan(0);
    // Each combo's synergy contribution should be a real sum of two detectors,
    // reflected in a viability breakdown that isn't degenerate.
    for (const r of combos) {
      expect(r.breakdown.synergyDensity).toBeGreaterThan(0);
    }
  });

  it("a theme's curve/creature nudge measurably shapes the deck", () => {
    // Spells Matter is defined with creatureShift: -0.15 (fewer creatures,
    // cheaper curve). Compare it against Good Stuff for the same archetype.
    const results = run({ colors: ['U', 'R'], archetype: 'tempo' });
    const spells = results.find((r) => r.themeId === 'spells');
    const goodstuff = results.find((r) => r.themeId === 'goodstuff');
    if (spells && goodstuff) {
      const nonlandOf = (d: Deck) => d.main.filter((e) => !isLand(e.card));
      const creatureShare = (d: Deck) => {
        const nonland = nonlandOf(d);
        const total = nonland.reduce((s, e) => s + e.qty, 0);
        const creatures = nonland
          .filter((e) => /Creature/.test(e.card.typeLine))
          .reduce((s, e) => s + e.qty, 0);
        return total ? creatures / total : 0;
      };
      expect(creatureShare(spells.deck)).toBeLessThan(creatureShare(goodstuff.deck));
    }
  });
});
