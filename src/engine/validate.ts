import type { Card, Format } from '../types/card';
import { canBeCommander, isBasicLand } from '../types/card';
import type { Deck } from '../types/deck';

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

const DECK_SIZE: Record<Format, number> = {
  standard: 60, // minimum (we always build exactly 60)
  brawl: 60, // exactly, including commander
};

/**
 * Validate a deck against its format rules. Returns issues; an empty list of
 * `error`-level issues means the deck is legal to import.
 */
export function validateDeck(deck: Deck): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const singleton = deck.format === 'brawl';

  const mainTotal = deck.main.reduce((s, e) => s + e.qty, 0);
  const total = mainTotal + (deck.commander ? 1 : 0);

  // --- Size ---
  if (deck.format === 'standard' && total < DECK_SIZE.standard) {
    issues.push({ level: 'error', message: `Standard decks need at least 60 cards (has ${total}).` });
  }
  if (deck.format === 'brawl' && total !== DECK_SIZE.brawl) {
    issues.push({ level: 'error', message: `Standard Brawl decks must be exactly 60 cards incl. commander (has ${total}).` });
  }

  // --- Commander ---
  if (deck.format === 'brawl') {
    if (!deck.commander) {
      issues.push({ level: 'error', message: 'Brawl deck has no commander.' });
    } else if (!canBeCommander(deck.commander)) {
      issues.push({ level: 'error', message: `${deck.commander.name} cannot be a commander.` });
    }
  }

  // --- Copy limits ---
  for (const { card, qty } of deck.main) {
    if (isBasicLand(card)) continue;
    if (singleton && qty > 1) {
      issues.push({ level: 'error', message: `${card.name}: singleton format allows only 1 copy (has ${qty}).` });
    } else if (!singleton && qty > 4) {
      issues.push({ level: 'error', message: `${card.name}: max 4 copies in Standard (has ${qty}).` });
    }
  }

  // --- Color identity (Brawl) ---
  if (deck.format === 'brawl' && deck.commander) {
    const allowed = new Set(deck.commander.colorIdentity);
    for (const { card } of deck.main) {
      const offending = card.colorIdentity.filter((c) => !allowed.has(c));
      if (offending.length > 0) {
        issues.push({
          level: 'error',
          message: `${card.name} is outside the commander's color identity (${offending.join('')}).`,
        });
      }
    }
  }

  // --- Format legality + Arena availability ---
  const checkLegal = (card: Card): boolean =>
    deck.format === 'brawl' ? card.legalBrawl : card.legalStandard;
  for (const { card } of deck.main) {
    if (!isBasicLand(card) && !checkLegal(card)) {
      issues.push({ level: 'error', message: `${card.name} is not legal in ${deck.format}.` });
    }
    if (!isBasicLand(card) && card.arenaId == null) {
      issues.push({ level: 'warning', message: `${card.name} may not be available on Arena (no arena id).` });
    }
  }

  return issues;
}

export function isLegal(deck: Deck): boolean {
  return validateDeck(deck).every((i) => i.level !== 'error');
}
