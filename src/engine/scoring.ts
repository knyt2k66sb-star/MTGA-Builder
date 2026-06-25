import type { Card, Color } from '../types/card';
import { COLORS } from '../types/card';
import type { ArchetypeProfile } from './archetypes';
import { detectRoles, numericPower, type Role } from './heuristics';

/**
 * Quality proxy from EDHREC rank. Lower rank = more played = better.
 * Maps to ~0..1 via inverse-log. Cards with no rank get a neutral-low default.
 */
export function qualityScore(card: Card): number {
  if (card.edhrecRank == null) return 0.25;
  // rank 1 -> ~1.0, rank 1000 -> ~0.5, rank 20000 -> ~0.25
  return 1 / Math.log10(card.edhrecRank + 10);
}

/** Best role-weight match for the archetype, plus aggression bonus. */
export function archetypeFit(card: Card, profile: ArchetypeProfile): number {
  const roles = detectRoles(card);
  let best = 0;
  for (const role of roles) {
    const w = profile.roleWeights[role as Role] ?? 0;
    if (w > best) best = w;
  }
  let bonus = 0;
  if (roles.has('aggroCreature')) {
    // Reward raw pressure proportional to how aggressive the archetype is.
    const power = numericPower(card);
    bonus += profile.aggression * Math.min(power, 6) * 0.08;
  }
  return best + bonus;
}

/** Penalty for color pips that fall outside the chosen colors. */
export function colorFit(card: Card, colors: Color[]): number {
  const allowed = new Set(colors);
  const offColor = card.colors.filter((c) => !allowed.has(c)).length;
  return offColor === 0 ? 0.2 : -offColor * 1.5;
}

export interface ScoreWeights {
  quality: number;
  archetype: number;
  color: number;
}

export function defaultWeights(powerBias = 0.5): ScoreWeights {
  // powerBias shifts emphasis between raw quality and archetype fit.
  return {
    quality: 1.0 + powerBias * 1.5,
    archetype: 1.4,
    color: 1.0,
  };
}

/**
 * Static score of a card independent of remaining curve needs. Curve fit is
 * applied dynamically during slot-filling in build.ts.
 */
export function baseScore(
  card: Card,
  profile: ArchetypeProfile,
  colors: Color[],
  weights: ScoreWeights,
): number {
  return (
    weights.quality * qualityScore(card) +
    weights.archetype * archetypeFit(card, profile) +
    weights.color * colorFit(card, colors)
  );
}

/** Land usefulness for the mana base: prefers fixing for the deck's colors. */
export function landScore(card: Card, colors: Color[]): number {
  const wanted = new Set(colors);
  const producesWanted = card.producedMana.filter((c) => wanted.has(c)).length;
  const producesOff = card.producedMana.filter(
    (c) => (COLORS as string[]).includes(c) && !wanted.has(c),
  ).length;
  const dualBonus = producesWanted >= 2 ? 1.5 : 0;
  return producesWanted * 1.0 + dualBonus - producesOff * 0.5 + qualityScore(card);
}
