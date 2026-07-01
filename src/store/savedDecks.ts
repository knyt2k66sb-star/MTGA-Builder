import { isBasicLand } from '../types/card';
import type { Deck } from '../types/deck';

const KEY = 'mtga-builder:saved-decks';

/**
 * Content signature for a deck — same commander + same nonbasic cards/qty,
 * regardless of id/name/seed. Two decks with this in common are "the same
 * saved deck" as far as the user is concerned, even if one was regenerated
 * later under a new id. Basics are excluded since they carry no identity.
 */
export function deckSignature(deck: Deck): string {
  const parts = deck.main
    .filter((e) => !isBasicLand(e.card))
    .map((e) => `${e.card.oracleId}:${e.qty}`)
    .sort();
  const commander = deck.commander ? `CMD:${deck.commander.oracleId}` : '';
  return [deck.format, commander, ...parts].join('|');
}

/**
 * Saved decks live in localStorage. We serialize the full Deck (cards included)
 * so a saved deck survives even if the card pool changes underneath it.
 */
export function loadSavedDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const decks = JSON.parse(raw) as Deck[];
    return Array.isArray(decks) ? decks : [];
  } catch {
    return [];
  }
}

export function persistSavedDecks(decks: Deck[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(decks));
  } catch {
    // Storage full / unavailable — non-fatal.
  }
}
