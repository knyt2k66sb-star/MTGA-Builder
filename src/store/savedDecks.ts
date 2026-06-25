import type { Deck } from '../types/deck';

const KEY = 'mtga-builder:saved-decks';

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
