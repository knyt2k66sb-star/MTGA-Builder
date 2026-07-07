import { describe, expect, it } from 'vitest';
import { POOL } from '../data/pool';
import { generateDeck } from '../engine/build';
import { deckSignature } from './savedDecks';
import type { GenParams } from '../types/deck';

const params: GenParams = { format: 'standard', archetype: 'aggro', colors: ['R'], seed: 42 };

describe('deckSignature', () => {
  it('is identical for the same deck regenerated under a new id/timestamp', () => {
    const { deck: a } = generateDeck(params, POOL);
    const { deck: b } = generateDeck({ ...params }, POOL); // same seed -> same cards, new id/timestamps
    expect(a.id).not.toBe(b.id);
    expect(deckSignature(a)).toBe(deckSignature(b));
  });

  it('is stable regardless of entry order in `main`', () => {
    const { deck } = generateDeck(params, POOL);
    const shuffled = { ...deck, main: [...deck.main].reverse() };
    expect(deckSignature(deck)).toBe(deckSignature(shuffled));
  });

  it('differs when the card list actually differs', () => {
    const { deck: a } = generateDeck(params, POOL);
    const { deck: b } = generateDeck({ ...params, seed: 999, archetype: 'control' }, POOL);
    expect(deckSignature(a)).not.toBe(deckSignature(b));
  });

  it('differs across formats even with an identical main deck', () => {
    const { deck: a } = generateDeck(params, POOL);
    const fakeBrawl = { ...a, format: 'standardbrawl' as const };
    expect(deckSignature(a)).not.toBe(deckSignature(fakeBrawl));
  });
});
