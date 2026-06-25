import type { Archetype } from '../types/card';
import type { Role } from './heuristics';

/** Target curve as a normalized histogram over CMC buckets (sums to ~1). */
export type CurveTarget = Record<'0-1' | '2' | '3' | '4' | '5' | '6+', number>;

export interface ArchetypeProfile {
  /** Number of lands in a 60-card constructed deck. */
  lands: number;
  /** Target creature count (nonland). */
  creatures: number;
  /** Target noncreature spell count (nonland). */
  nonCreature: number;
  /** Desired shape of the nonland mana curve. */
  curve: CurveTarget;
  /** How much each role is wanted (multiplied into the score). */
  roleWeights: Record<Role, number>;
  /** Bonus weight for aggressive/evasive creatures. */
  aggression: number;
  blurb: string;
}

// Land counts and curves are starting heuristics, tuned to feel right per
// archetype. lands + creatures + nonCreature == 60 for constructed.
export const ARCHETYPE_PROFILES: Record<Archetype, ArchetypeProfile> = {
  aggro: {
    lands: 22,
    creatures: 26,
    nonCreature: 12,
    curve: { '0-1': 0.28, '2': 0.34, '3': 0.22, '4': 0.1, '5': 0.04, '6+': 0.02 },
    roleWeights: {
      removal: 1.1,
      sweeper: 0.1,
      draw: 0.5,
      counter: 0.2,
      ramp: 0.2,
      aggroCreature: 1.6,
      creature: 1.1,
      other: 0.6,
    },
    aggression: 1.0,
    blurb: 'Fast, low-curve creatures and reach to close games quickly.',
  },
  tempo: {
    lands: 23,
    creatures: 22,
    nonCreature: 15,
    curve: { '0-1': 0.2, '2': 0.32, '3': 0.26, '4': 0.14, '5': 0.05, '6+': 0.03 },
    roleWeights: {
      removal: 1.2,
      sweeper: 0.2,
      draw: 0.8,
      counter: 1.1,
      ramp: 0.3,
      aggroCreature: 1.4,
      creature: 1.0,
      other: 0.6,
    },
    aggression: 0.8,
    blurb: 'Efficient threats backed by cheap interaction and counters.',
  },
  midrange: {
    lands: 24,
    creatures: 22,
    nonCreature: 14,
    curve: { '0-1': 0.12, '2': 0.26, '3': 0.28, '4': 0.2, '5': 0.1, '6+': 0.04 },
    roleWeights: {
      removal: 1.3,
      sweeper: 0.6,
      draw: 1.0,
      counter: 0.5,
      ramp: 0.6,
      aggroCreature: 1.0,
      creature: 1.2,
      other: 0.7,
    },
    aggression: 0.5,
    blurb: 'Balanced threats and answers that grind out value.',
  },
  control: {
    lands: 26,
    creatures: 6,
    nonCreature: 28,
    curve: { '0-1': 0.1, '2': 0.24, '3': 0.26, '4': 0.2, '5': 0.12, '6+': 0.08 },
    roleWeights: {
      removal: 1.6,
      sweeper: 1.8,
      draw: 1.7,
      counter: 1.6,
      ramp: 0.4,
      aggroCreature: 0.3,
      creature: 0.5,
      other: 0.6,
    },
    aggression: 0.1,
    blurb: 'Removal, sweepers, counters and card draw into few finishers.',
  },
  ramp: {
    lands: 25,
    creatures: 16,
    nonCreature: 19,
    curve: { '0-1': 0.08, '2': 0.24, '3': 0.22, '4': 0.16, '5': 0.16, '6+': 0.14 },
    roleWeights: {
      removal: 1.0,
      sweeper: 0.8,
      draw: 1.0,
      counter: 0.3,
      ramp: 1.9,
      aggroCreature: 0.6,
      creature: 1.1,
      other: 0.7,
    },
    aggression: 0.3,
    blurb: 'Mana acceleration into powerful, expensive payoffs.',
  },
  combo: {
    lands: 24,
    creatures: 16,
    nonCreature: 20,
    curve: { '0-1': 0.16, '2': 0.28, '3': 0.26, '4': 0.16, '5': 0.08, '6+': 0.06 },
    roleWeights: {
      removal: 0.8,
      sweeper: 0.4,
      draw: 1.6,
      counter: 1.0,
      ramp: 1.0,
      aggroCreature: 0.7,
      creature: 0.9,
      other: 1.0,
    },
    aggression: 0.3,
    blurb: 'Card selection and protection to assemble a game-ending engine.',
  },
};

/**
 * Brawl decks are 60-card singleton (commander counts toward the 60). They
 * lean on slightly more lands for consistency. We reuse the constructed
 * profile but nudge land counts up and soften creature/noncreature split.
 */
export function brawlAdjust(profile: ArchetypeProfile): ArchetypeProfile {
  return { ...profile, lands: Math.min(profile.lands + 2, 27) };
}

export const CURVE_BUCKETS: (keyof CurveTarget)[] = [
  '0-1',
  '2',
  '3',
  '4',
  '5',
  '6+',
];
