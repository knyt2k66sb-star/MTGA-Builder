import type { Card } from '../types/card';

/**
 * Fuzzy card-text matching: the query is split into words, and every word
 * must appear somewhere in the card's name, type line or rules text — in any
 * order, as substrings. So "draw whenever attacks" matches a card whose text
 * says "Whenever this creature attacks, draw a card."
 */
export function matchesCardText(card: Card, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${card.name}\n${card.typeLine}\n${card.oracleText}`.toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}
