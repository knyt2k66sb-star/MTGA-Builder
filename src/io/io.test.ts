import { describe, expect, it } from 'vitest';
import { POOL } from '../data/pool';
import { generateDeck } from '../engine/build';
import { deckToArenaText } from './mtgaExport';
import { parseArenaText, parseLine } from './mtgaImport';
import type { GenParams } from '../types/deck';

const stdParams: GenParams = { format: 'standard', archetype: 'aggro', colors: ['R'], seed: 7 };
const brawlParams: GenParams = { format: 'standardbrawl', archetype: 'midrange', colors: ['B'], seed: 7 };

describe('parseLine', () => {
  it('parses a full line with set + number', () => {
    expect(parseLine('4 Lightning Strike (DMU) 137')).toEqual({
      qty: 4,
      name: 'Lightning Strike',
      set: 'DMU',
      collectorNumber: '137',
    });
  });

  it('parses a basic land line with no set', () => {
    expect(parseLine('22 Mountain')).toEqual({
      qty: 22,
      name: 'Mountain',
      set: undefined,
      collectorNumber: undefined,
    });
  });

  it('returns null for non-card lines', () => {
    expect(parseLine('Deck')).toBeNull();
  });
});

describe('export format', () => {
  it('emits a Deck header and N Name (SET) num lines', () => {
    const { deck } = generateDeck(stdParams, POOL);
    const text = deckToArenaText(deck);
    expect(text.startsWith('Deck\n')).toBe(true);
    // Nonbasic lines carry a (SET) num suffix.
    const nonbasicLine = text
      .split('\n')
      .find((l) => /\(\w+\)\s+\S+$/.test(l));
    expect(nonbasicLine).toBeTruthy();
  });

  it('puts the commander in a Commander section for Brawl', () => {
    const { deck } = generateDeck(brawlParams, POOL);
    const text = deckToArenaText(deck);
    expect(text.startsWith('Commander\n')).toBe(true);
    expect(text).toContain('\nDeck\n');
  });

  it('emits basic lands by name without a set suffix', () => {
    const { deck } = generateDeck(stdParams, POOL);
    const text = deckToArenaText(deck);
    const basicLine = text.split('\n').find((l) => /^\d+ Mountain$/.test(l));
    expect(basicLine).toBeTruthy();
  });
});

describe('round-trip export -> import', () => {
  it('reconstructs the same card counts', () => {
    const { deck } = generateDeck(stdParams, POOL);
    const text = deckToArenaText(deck);
    const { deck: imported, warnings } = parseArenaText(text, POOL, 'standard');

    expect(warnings).toEqual([]);

    const sum = (d: typeof deck) => d.main.reduce((s, e) => s + e.qty, 0);
    expect(sum(imported)).toBe(sum(deck));
  });

  it('round-trips a brawl deck including the commander', () => {
    const { deck } = generateDeck(brawlParams, POOL);
    const text = deckToArenaText(deck);
    const { deck: imported } = parseArenaText(text, POOL, 'standardbrawl');
    expect(imported.commander?.name).toBe(deck.commander?.name);
    expect(imported.format).toBe('standardbrawl');
  });
});
