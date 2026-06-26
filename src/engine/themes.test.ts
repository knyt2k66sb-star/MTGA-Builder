import { describe, expect, it } from 'vitest';
import { POOL } from '../data/pool';
import { generateDecks, VIABILITY_THRESHOLD } from './build';
import { validateDeck } from './validate';
import { viableThemes } from './themes';
import { isBasicLand } from '../types/card';
import type { MultiGenParams } from '../types/deck';

function run(params: Partial<MultiGenParams>) {
  const full: MultiGenParams = { format: 'standard', colors: ['R'], ...params };
  return generateDecks(full, POOL);
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
});
