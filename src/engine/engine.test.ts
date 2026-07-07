import { describe, expect, it } from 'vitest';
import { POOL } from '../data/pool';
import { generateDeck } from './build';
import { validateDeck } from './validate';
import { isBasicLand } from '../types/card';
import { ARCHETYPES, type Archetype, type Color } from '../types/card';
import type { GenParams } from '../types/deck';

const COLOR_COMBOS: Color[][] = [['R'], ['W', 'U'], ['B', 'G']];

function gen(params: Partial<GenParams>) {
  const full: GenParams = {
    format: 'standard',
    archetype: 'aggro',
    colors: ['R'],
    seed: 12345,
    ...params,
  };
  return generateDeck(full, POOL);
}

describe('pool integrity', () => {
  it('loads a non-empty pool', () => {
    expect(POOL.length).toBeGreaterThan(40);
  });
});

describe('standard generation', () => {
  for (const archetype of ARCHETYPES) {
    for (const colors of COLOR_COMBOS) {
      it(`builds a legal 60-card ${colors.join('')} ${archetype} deck`, () => {
        const { deck } = gen({ archetype: archetype as Archetype, colors });
        const total = deck.main.reduce((s, e) => s + e.qty, 0);
        expect(total).toBe(60);

        const errors = validateDeck(deck).filter((i) => i.level === 'error');
        expect(errors).toEqual([]);

        // No nonbasic card exceeds 4 copies.
        for (const e of deck.main) {
          if (!isBasicLand(e.card)) expect(e.qty).toBeLessThanOrEqual(4);
        }
      });
    }
  }

  it('is deterministic for a fixed seed', () => {
    const a = gen({ seed: 999, colors: ['W', 'U'], archetype: 'control' });
    const b = gen({ seed: 999, colors: ['W', 'U'], archetype: 'control' });
    expect(a.deck.main).toEqual(b.deck.main);
  });

  it('mono-color deck stays on-color', () => {
    const { deck } = gen({ colors: ['G'], archetype: 'ramp' });
    for (const e of deck.main) {
      expect(e.card.colors.every((c) => c === 'G')).toBe(true);
    }
  });

  it('respects the archetype land count band', () => {
    const { deck, diagnostics } = gen({ archetype: 'control', colors: ['W', 'U'] });
    expect(deck.format).toBe('standard');
    // Control wants a high land count.
    expect(diagnostics.landCount).toBeGreaterThanOrEqual(24);
  });
});

describe('brawl generation', () => {
  it('builds a 60-card singleton deck with a legal commander', () => {
    const { deck } = gen({ format: 'standardbrawl', colors: ['B'], archetype: 'midrange' });
    expect(deck.commander).not.toBeNull();

    const total = deck.main.reduce((s, e) => s + e.qty, 0) + (deck.commander ? 1 : 0);
    expect(total).toBe(60);

    // Every nonbasic card is singleton.
    for (const e of deck.main) {
      if (!isBasicLand(e.card)) expect(e.qty).toBe(1);
    }

    const errors = validateDeck(deck).filter((i) => i.level === 'error');
    expect(errors).toEqual([]);
  });

  it('keeps all cards within the commander color identity', () => {
    const { deck } = gen({ format: 'standardbrawl', colors: ['G', 'U'], archetype: 'ramp' });
    const allowed = new Set(deck.commander!.colorIdentity);
    for (const e of deck.main) {
      expect(e.card.colorIdentity.every((c) => allowed.has(c))).toBe(true);
    }
  });
});
