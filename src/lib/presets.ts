import type { RarityCaps } from '../types/deck';
import type { ArchetypeFilter } from '../store/useStore';

/**
 * One-tap generation profiles. Each preset patches the generator parameters;
 * anything it doesn't mention keeps its current value, except the fields
 * every preset resets (rarity caps / max MV / land override / theme filter)
 * so presets always start from a clean slate.
 */
export interface GenPreset {
  id: string;
  name: string;
  blurb: string;
  patch: {
    archetype?: ArchetypeFilter;
    powerBias?: number;
    rarityCaps: RarityCaps;
    maxCmc: number | null;
    landCountOverride: number | null;
    themeFilter: string;
  };
}

const clean = {
  rarityCaps: { mythic: null, rare: null, uncommon: null } as RarityCaps,
  maxCmc: null,
  landCountOverride: null,
  themeFilter: 'any',
};

export const PRESETS: GenPreset[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    blurb: 'Default settings — every archetype, no restrictions.',
    patch: { ...clean, archetype: 'any', powerBias: 0.5 },
  },
  {
    id: 'competitive',
    name: 'Competitive',
    blurb: 'Raw card quality first: strongest staples, any wildcard cost.',
    patch: { ...clean, powerBias: 0.85 },
  },
  {
    id: 'synergy-max',
    name: 'Synergy Max',
    blurb: 'Lean hardest into theme packages over raw card power.',
    patch: { ...clean, powerBias: 0.15 },
  },
  {
    id: 'wildcard-saver',
    name: 'Wildcard Saver',
    blurb: 'At most 5 rares and no mythics — the rest uncommon/common.',
    patch: { ...clean, rarityCaps: { mythic: 0, rare: 5, uncommon: null } },
  },
  {
    id: 'budget',
    name: 'Budget Brew',
    blurb: 'No rares or mythics at all.',
    patch: { ...clean, rarityCaps: { mythic: 0, rare: 0, uncommon: null } },
  },
  {
    id: 'commons-only',
    name: 'Commons Only',
    blurb: 'Pauper-style: every card a common.',
    patch: { ...clean, rarityCaps: { mythic: 0, rare: 0, uncommon: 0 } },
  },
  {
    id: 'cheap-fast',
    name: 'Cheap & Fast',
    blurb: 'Aggro decks with nothing above 3 mana.',
    patch: { ...clean, archetype: 'aggro', maxCmc: 3 },
  },
  {
    id: 'big-mana',
    name: 'Big Mana',
    blurb: 'Ramp decks reaching for the top of the curve.',
    patch: { ...clean, archetype: 'ramp', powerBias: 0.5 },
  },
];
