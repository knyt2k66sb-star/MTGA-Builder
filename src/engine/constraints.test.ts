import { describe, expect, it } from 'vitest';
import { POOL } from '../data/pool';
import rawExtra from '../data/brawl-extra-pool.json';
import { generateDeck, generateDecks } from './build';
import { validateDeck } from './validate';
import { isBasicLand, isLand, type Card } from '../types/card';
import { matchesCardText } from '../lib/search';
import type { Deck, GenParams } from '../types/deck';

const EXTRA = rawExtra as unknown as Card[];
const MERGED = [...POOL, ...EXTRA];

function countRarities(deck: Deck): Record<string, number> {
  const out: Record<string, number> = { mythic: 0, rare: 0, uncommon: 0, common: 0 };
  const all = deck.commander ? [...deck.main, { card: deck.commander, qty: 1 }] : deck.main;
  for (const { card, qty } of all) {
    if (isBasicLand(card)) continue;
    if (card.rarity in out) out[card.rarity] += qty;
  }
  return out;
}

describe('rarity caps', () => {
  it('respects mythic/rare caps across spells, lands and commander', () => {
    const params: GenParams = {
      format: 'standard',
      archetype: 'aggro',
      colors: ['R'],
      seed: 11,
      rarityCaps: { mythic: 0, rare: 5 },
    };
    const { deck } = generateDeck(params, POOL);
    const rarities = countRarities(deck);
    expect(rarities.mythic).toBe(0);
    expect(rarities.rare).toBeLessThanOrEqual(5);
    expect(deck.main.reduce((s, e) => s + e.qty, 0)).toBe(60);
  });

  it('builds commons-only decks when everything else is zeroed', () => {
    const { deck } = generateDeck(
      {
        format: 'standard',
        archetype: 'midrange',
        colors: ['G'],
        seed: 12,
        rarityCaps: { mythic: 0, rare: 0, uncommon: 0 },
      },
      POOL,
    );
    const rarities = countRarities(deck);
    expect(rarities.mythic + rarities.rare + rarities.uncommon).toBe(0);
  });

  it('caps flow through multi-deck generation', () => {
    const results = generateDecks(
      { format: 'standard', colors: ['B'], rarityCaps: { mythic: 1, rare: 4 }, maxResults: 20 },
      POOL,
    );
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const rarities = countRarities(r.deck);
      expect(rarities.mythic).toBeLessThanOrEqual(1);
      expect(rarities.rare).toBeLessThanOrEqual(4);
    }
  });
});

describe('deck shape constraints', () => {
  it('honors a max mana value cap', () => {
    const { deck } = generateDeck(
      { format: 'standard', archetype: 'aggro', colors: ['R'], seed: 13, maxCmc: 3 },
      POOL,
    );
    for (const e of deck.main) {
      if (!isLand(e.card)) expect(e.card.cmc).toBeLessThanOrEqual(3);
    }
  });

  it('honors a land count override', () => {
    const { deck, diagnostics } = generateDeck(
      { format: 'standard', archetype: 'midrange', colors: ['G', 'W'], seed: 14, landCount: 20 },
      POOL,
    );
    expect(diagnostics.landCount).toBe(20);
    expect(deck.main.reduce((s, e) => s + e.qty, 0)).toBe(60);
  });
});

describe('deck count + variants', () => {
  it('returns roughly the requested number of decks when raised past the combo count', () => {
    const results = generateDecks({ format: 'standard', colors: ['R'], maxResults: 120 }, POOL);
    // Mono-red has ~50-60 base combos; variants must push well past that.
    expect(results.length).toBeGreaterThan(70);
    expect(results.length).toBeLessThanOrEqual(120);
    // Every deck still legal.
    for (const r of results.slice(0, 10)) {
      expect(validateDeck(r.deck).filter((i) => i.level === 'error')).toEqual([]);
    }
  });

  it('clamps the requested count to the hard limit', () => {
    const results = generateDecks({ format: 'standard', colors: ['R'], maxResults: 99999 }, POOL);
    expect(results.length).toBeLessThanOrEqual(500);
  });
});

describe('brawl (100-card) format', () => {
  it('builds a legal 100-card singleton deck from the merged pool', () => {
    const { deck } = generateDeck(
      { format: 'brawl', archetype: 'midrange', colors: ['B', 'R'], seed: 15 },
      MERGED,
    );
    const total = deck.main.reduce((s, e) => s + e.qty, 0) + 1;
    expect(total).toBe(100);
    expect(deck.commander).not.toBeNull();
    for (const e of deck.main) {
      if (!isBasicLand(e.card)) expect(e.qty).toBe(1);
    }
    expect(validateDeck(deck).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('standard generation never uses brawl-only cards, even from a merged pool', () => {
    const results = generateDecks(
      { format: 'standard', colors: ['U', 'R'], maxResults: 30 },
      MERGED,
    );
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      for (const e of r.deck.main) {
        if (!isBasicLand(e.card)) expect(e.card.legalStandard).toBe(true);
      }
    }
  });

  it('standard brawl never uses brawl-only cards either', () => {
    const results = generateDecks(
      { format: 'standardbrawl', colors: ['R'], maxResults: 10 },
      MERGED,
    );
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const all = [...r.deck.main, { card: r.deck.commander!, qty: 1 }];
      for (const e of all) {
        if (!isBasicLand(e.card)) expect(e.card.legalStandard).toBe(true);
      }
    }
  });
});

describe('fuzzy card text search', () => {
  const sample = POOL.find((c) => /draw/i.test(c.oracleText));
  it('matches words in any order across name/type/text', () => {
    expect(sample).toBeTruthy();
    if (!sample) return;
    const words = sample.oracleText.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    if (words.length >= 2) {
      // Reversed order must still match.
      expect(matchesCardText(sample, `${words[1]} ${words[0]}`)).toBe(true);
    }
    expect(matchesCardText(sample, 'zzzzqqq notaword')).toBe(false);
    expect(matchesCardText(sample, '')).toBe(true);
  });
});
