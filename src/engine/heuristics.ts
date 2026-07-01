import type { Card } from '../types/card';
import { isCreature, isLand } from '../types/card';

/**
 * Functional roles a nonland card can play. A card may match several roles;
 * scoring uses the best-matching role per archetype.
 */
export type Role =
  | 'removal'
  | 'sweeper'
  | 'draw'
  | 'counter'
  | 'ramp'
  | 'aggroCreature'
  | 'creature'
  | 'other';

const RE = {
  removal:
    /\b(destroy target|exile target (creature|permanent|artifact|enchantment|planeswalker)|deals? \d+ damage to (any target|target creature|target creature or planeswalker)|fight target|each opponent sacrifices)\b/i,
  sweeper:
    /\b(destroy all|exile all|deals? \d+ damage to each|each creature gets -|to each creature|all creatures get)\b/i,
  draw: /\bdraw (a card|\w+ cards?|cards equal)\b/i,
  counter: /\bcounter target (spell|ability)\b/i,
  rampText:
    /\b(search your library for (a|up to (one|two|three))[^.]*\bland|add \{[wubrgc/]+\}|create a Treasure)\b/i,
};

/** Detect ramp: lands that tap for mana, mana dorks, mana rocks, rampy text. */
function isRamp(card: Card): boolean {
  if (isLand(card)) return false;
  // Mana dork / rock: nonland that produces colored mana.
  if (card.producedMana.length > 0) return true;
  return RE.rampText.test(card.oracleText);
}

// detectRoles is regex-heavy and pure per card; the multi-deck generator
// calls it for the same cards across every (archetype x theme) combination,
// so memoize by card id rather than re-running the regexes each time.
const roleCache = new Map<string, Set<Role>>();

export function detectRoles(card: Card): Set<Role> {
  const cached = roleCache.get(card.id);
  if (cached) return cached;

  const roles = new Set<Role>();
  const text = card.oracleText || '';

  if (RE.sweeper.test(text)) roles.add('sweeper');
  if (RE.removal.test(text)) roles.add('removal');
  if (RE.draw.test(text)) roles.add('draw');
  if (RE.counter.test(text)) roles.add('counter');
  if (isRamp(card)) roles.add('ramp');

  if (isCreature(card)) {
    roles.add('creature');
    if (isAggressiveCreature(card)) roles.add('aggroCreature');
  }

  if (roles.size === 0) roles.add('other');
  roleCache.set(card.id, roles);
  return roles;
}

const AGGRO_KEYWORDS = new Set([
  'Haste',
  'Flying',
  'Menace',
  'Trample',
  'Double strike',
  'First strike',
  'Prowess',
  'Deathtouch',
  'Lifelink',
]);

/** A creature that pressures the opponent: evasive/efficient body. */
export function isAggressiveCreature(card: Card): boolean {
  if (!isCreature(card)) return false;
  const hasKeyword = card.keywords.some((k) => AGGRO_KEYWORDS.has(k));
  const power = card.power ? parseInt(card.power, 10) : NaN;
  // Efficient: power meets or beats its mana value at the low end of the curve.
  const efficient =
    Number.isFinite(power) && card.cmc <= 4 && power >= Math.max(2, card.cmc + 1);
  return hasKeyword || efficient;
}

/** Numeric power, or 0 if not a creature / variable. */
export function numericPower(card: Card): number {
  const p = card.power ? parseInt(card.power, 10) : NaN;
  return Number.isFinite(p) ? p : 0;
}
