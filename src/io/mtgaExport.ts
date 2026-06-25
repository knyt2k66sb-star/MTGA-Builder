import { isBasicLand } from '../types/card';
import type { Deck, DeckEntry } from '../types/deck';
import { toArenaName } from './arenaName';

function line(entry: DeckEntry): string {
  const { card, qty } = entry;
  const name = toArenaName(card);
  // Basics are accepted by name alone; Arena assigns art.
  if (isBasicLand(card)) return `${qty} ${name}`;
  return `${qty} ${name} (${card.set}) ${card.collectorNumber}`;
}

/**
 * Render a deck in MTG Arena's import/export text format.
 *
 * Standard:
 *   Deck
 *   4 Card (SET) 123
 *   ...
 *   Sideboard
 *   2 Card (SET) 45
 *
 * Brawl:
 *   Commander
 *   1 Commander (SET) 123
 *
 *   Deck
 *   1 Card (SET) 45
 */
export function deckToArenaText(deck: Deck): string {
  const blocks: string[] = [];

  if (deck.commander) {
    blocks.push(['Commander', line({ card: deck.commander, qty: 1 })].join('\n'));
  }

  const mainLines = deck.main.map(line);
  blocks.push(['Deck', ...mainLines].join('\n'));

  if (deck.sideboard.length > 0) {
    const sideLines = deck.sideboard.map(line);
    blocks.push(['Sideboard', ...sideLines].join('\n'));
  }

  return blocks.join('\n\n') + '\n';
}
