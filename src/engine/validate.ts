import {
  FORMAT_LABELS,
  FORMAT_TOTALS,
  canBeCommander,
  isBasicLand,
  isCommanderFormat,
  isFormatLegal,
} from '../types/card';
import type { Deck } from '../types/deck';

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

/**
 * Validate a deck against its format rules. Returns issues; an empty list of
 * `error`-level issues means the deck is legal to import.
 */
export function validateDeck(deck: Deck): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const singleton = isCommanderFormat(deck.format);
  const target = FORMAT_TOTALS[deck.format];
  const label = FORMAT_LABELS[deck.format];

  const mainTotal = deck.main.reduce((s, e) => s + e.qty, 0);
  const total = mainTotal + (deck.commander ? 1 : 0);

  // --- Size ---
  if (deck.format === 'standard' && total < target) {
    issues.push({ level: 'error', message: `Standard decks need at least ${target} cards (has ${total}).` });
  }
  if (singleton && total !== target) {
    issues.push({
      level: 'error',
      message: `${label} decks must be exactly ${target} cards incl. commander (has ${total}).`,
    });
  }

  // --- Commander ---
  if (singleton) {
    if (!deck.commander) {
      issues.push({ level: 'error', message: `${label} deck has no commander.` });
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

  // --- Color identity (Brawl variants) ---
  if (singleton && deck.commander) {
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

  // --- Format legality ---
  // (Arena availability isn't re-checked here: the pool is sourced from a
  // `game:arena` query, and Scryfall lags on `arena_id` for new sets, so a
  // missing id is not a reliable "unavailable" signal and only adds noise.)
  const cardsToCheck = deck.commander
    ? [...deck.main, { card: deck.commander, qty: 1 }]
    : deck.main;
  for (const { card } of cardsToCheck) {
    if (!isBasicLand(card) && !isFormatLegal(card, deck.format)) {
      issues.push({ level: 'error', message: `${card.name} is not legal in ${label}.` });
    }
  }

  return issues;
}

export function isLegal(deck: Deck): boolean {
  return validateDeck(deck).every((i) => i.level !== 'error');
}
