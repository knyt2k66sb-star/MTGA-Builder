import type { Card, Color } from '../types/card';
import { COLORS } from '../types/card';

/**
 * Count colored mana pips in a mana cost string, e.g. "{1}{U}{U}" -> {U:2}.
 * Hybrid symbols like {W/U} count half to each color. Phyrexian {U/P} counts
 * as that color. Generic / colorless symbols are ignored.
 */
export function countPips(manaCost: string): Record<Color, number> {
  const pips: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  if (!manaCost) return pips;
  const symbols = manaCost.match(/\{[^}]+\}/g) ?? [];
  for (const raw of symbols) {
    const inner = raw.slice(1, -1); // strip braces
    const parts = inner.split('/');
    const colorParts = parts.filter((p) => (COLORS as string[]).includes(p)) as Color[];
    if (colorParts.length === 0) continue;
    const weight = 1 / colorParts.length;
    for (const c of colorParts) pips[c] += weight;
  }
  return pips;
}

/** Aggregate colored pips across a set of cards (weighted by qty). */
export function aggregatePips(
  entries: { card: Card; qty: number }[],
): Record<Color, number> {
  const total: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const { card, qty } of entries) {
    const pips = countPips(card.manaCost);
    for (const c of COLORS) total[c] += pips[c] * qty;
  }
  return total;
}
