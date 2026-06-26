import type { Archetype, Card, Color } from '../types/card';
import { isCreature, isLand } from '../types/card';
import { qualityScore } from './scoring';
// (string-detection helpers are inlined per theme below)

/**
 * A synergy theme. `detect` returns how much a card contributes to the theme:
 *   0   = irrelevant
 *   ~1  = fits / minor enabler
 *   2-3 = strong enabler / payoff
 * Decks are built by boosting card scores with `detect`, so denser themes
 * cluster harder.
 */
export interface Theme {
  id: string;
  name: string;
  /** Archetypes this theme naturally plays as (used for labeling / leaning). */
  archetypeLean: Archetype[];
  /** Minimum strong contributors that must exist in the color pool to bother. */
  minCore: number;
  detect: (card: Card) => number;
}

// ---- Static, text-driven themes --------------------------------------------

const STATIC_THEMES: Theme[] = [
  {
    id: 'counters',
    name: '+1/+1 Counters',
    archetypeLean: ['midrange', 'aggro'],
    minCore: 5,
    detect: (c) => {
      let s = 0;
      if (/\+1\/\+1 counter/i.test(c.oracleText)) s += 2;
      if (/proliferate/i.test(c.oracleText)) s += 1.5;
      if (/\bcounters?\b/i.test(c.oracleText) && /\bput\b/i.test(c.oracleText)) s += 0.5;
      return s;
    },
  },
  {
    id: 'aristocrats',
    name: 'Sacrifice',
    archetypeLean: ['midrange', 'combo'],
    minCore: 5,
    detect: (c) => {
      let s = 0;
      if (/sacrifice (a|another|two|that) creature/i.test(c.oracleText)) s += 2;
      if (/when(ever)? .* dies/i.test(c.oracleText)) s += 1.5;
      if (/create a Treasure|Blood token|Food token/i.test(c.oracleText)) s += 0.5;
      if (/each opponent loses .* life/i.test(c.oracleText)) s += 0.5;
      return s;
    },
  },
  {
    id: 'treasure',
    name: 'Treasure & Artifacts',
    archetypeLean: ['midrange', 'ramp'],
    minCore: 5,
    detect: (c) => {
      let s = 0;
      if (/Treasure/i.test(c.oracleText)) s += 1.5;
      if (/\bartifact\b/i.test(c.oracleText)) s += 1;
      if (/\bArtifact\b/.test(c.typeLine)) s += 1;
      return s;
    },
  },
  {
    id: 'tokens',
    name: 'Go-Wide Tokens',
    archetypeLean: ['aggro', 'midrange'],
    minCore: 5,
    detect: (c) => {
      let s = 0;
      if (/create (a|\w+|that many) .*token/i.test(c.oracleText)) s += 2;
      if (/creatures you control get \+/i.test(c.oracleText)) s += 2;
      if (/for each creature you control/i.test(c.oracleText)) s += 1;
      if (/whenever you attack/i.test(c.oracleText)) s += 0.5;
      return s;
    },
  },
  {
    id: 'spells',
    name: 'Spells Matter',
    archetypeLean: ['tempo', 'aggro'],
    minCore: 5,
    detect: (c) => {
      let s = 0;
      if (c.keywords.includes('Prowess')) s += 2;
      if (/prowess|magecraft/i.test(c.oracleText)) s += 2;
      if (/whenever you cast (an instant|a sorcery|a noncreature)/i.test(c.oracleText)) s += 2;
      if (/Instant|Sorcery/.test(c.typeLine)) s += 0.6;
      return s;
    },
  },
  {
    id: 'graveyard',
    name: 'Graveyard',
    archetypeLean: ['midrange', 'control'],
    minCore: 5,
    detect: (c) => {
      let s = 0;
      if (/from your graveyard/i.test(c.oracleText)) s += 2;
      if (/return .* from your graveyard/i.test(c.oracleText)) s += 1.5;
      if (/\bmill\b|surveil|\bexplore\b/i.test(c.oracleText)) s += 1;
      if (/\bblitz\b|\bdisturb\b|\bescape\b|\bflashback\b/i.test(c.oracleText)) s += 1;
      return s;
    },
  },
  {
    id: 'lifegain',
    name: 'Lifegain',
    archetypeLean: ['midrange', 'control'],
    minCore: 5,
    detect: (c) => {
      let s = 0;
      if (c.keywords.includes('Lifelink')) s += 1.5;
      if (/gain (\d+|x) life|gain that much life/i.test(c.oracleText)) s += 1.5;
      if (/whenever you gain life/i.test(c.oracleText)) s += 2.5;
      return s;
    },
  },
  {
    id: 'landfall',
    name: 'Landfall & Lands',
    archetypeLean: ['ramp', 'midrange'],
    minCore: 4,
    detect: (c) => {
      let s = 0;
      if (/landfall|whenever a land enters/i.test(c.oracleText)) s += 2.5;
      if (/search your library for .*land/i.test(c.oracleText)) s += 1;
      if (/additional land/i.test(c.oracleText)) s += 1;
      return s;
    },
  },
  {
    id: 'enchantments',
    name: 'Enchantments',
    archetypeLean: ['midrange', 'control'],
    minCore: 5,
    detect: (c) => {
      let s = 0;
      if (/\bEnchantment\b/.test(c.typeLine)) s += 1.2;
      if (/enchantment/i.test(c.oracleText)) s += 1;
      if (/\bAura\b/.test(c.typeLine)) s += 0.8;
      if (/\bSaga\b/.test(c.typeLine)) s += 0.5;
      return s;
    },
  },
  {
    id: 'aggression',
    name: 'Beatdown',
    archetypeLean: ['aggro', 'tempo'],
    minCore: 6,
    detect: (c) => {
      let s = 0;
      const fast = ['Haste', 'Menace', 'Trample', 'Double strike', 'First strike'];
      if (c.keywords.some((k) => fast.includes(k))) s += 1.5;
      const power = c.power ? parseInt(c.power, 10) : NaN;
      if (Number.isFinite(power) && c.cmc <= 3 && power >= c.cmc + 1) s += 1.5;
      return s;
    },
  },
  {
    id: 'flyers',
    name: 'Flyers',
    archetypeLean: ['tempo', 'aggro'],
    minCore: 6,
    detect: (c) => (c.keywords.includes('Flying') && isCreature(c) ? 2 : 0),
  },
];

// ---- Dynamic tribal themes -------------------------------------------------

const TRACKED_TRIBES = [
  'Elf', 'Goblin', 'Vampire', 'Merfolk', 'Dragon', 'Knight', 'Soldier',
  'Wizard', 'Spirit', 'Zombie', 'Human', 'Angel', 'Beast', 'Warrior', 'Rogue',
];

const IRREGULAR_PLURALS: Record<string, string> = {
  Elf: 'Elves',
  Merfolk: 'Merfolk',
  Dwarf: 'Dwarves',
};

function pluralize(tribe: string): string {
  return IRREGULAR_PLURALS[tribe] ?? `${tribe}s`;
}

function tribalTheme(tribe: string): Theme {
  const typeRe = new RegExp(`\\b${tribe}s?\\b`);
  return {
    id: `tribe-${tribe.toLowerCase()}`,
    name: pluralize(tribe),
    archetypeLean: ['aggro', 'midrange'],
    minCore: 6,
    detect: (c) => {
      let s = 0;
      if (isCreature(c) && typeRe.test(c.typeLine)) s += 1.5;
      // Lords / payoffs that reference the tribe in text.
      if (typeRe.test(c.oracleText)) s += 2;
      return s;
    },
  };
}

// ---- Goodstuff (always-on baseline) ----------------------------------------

const GOODSTUFF: Theme = {
  id: 'goodstuff',
  name: 'Good Stuff',
  archetypeLean: ['midrange', 'aggro', 'control', 'tempo', 'ramp', 'combo'],
  minCore: 0,
  // Scores on raw card quality so a "best cards" deck is always offered.
  detect: (c) => (isLand(c) ? 0 : qualityScore(c) * 2),
};

/**
 * Determine which themes are viable in a color-filtered pool. A theme is
 * viable if at least `minCore` cards contribute meaningfully. Goodstuff is
 * always included.
 */
export function viableThemes(colorPool: Card[]): Theme[] {
  const candidates: Theme[] = [
    ...STATIC_THEMES,
    ...TRACKED_TRIBES.map(tribalTheme),
  ];
  const viable = candidates.filter((theme) => {
    const core = colorPool.filter((c) => !isLand(c) && theme.detect(c) >= 1.5).length;
    return core >= theme.minCore;
  });
  return [GOODSTUFF, ...viable];
}

export { GOODSTUFF };

/** Total synergy contribution of a card list for a theme (qty-weighted). */
export function synergyContribution(
  theme: Theme,
  entries: { card: Card; qty: number }[],
): number {
  return entries.reduce((s, e) => s + theme.detect(e.card) * e.qty, 0);
}

/** Color label helper for deck names, e.g. ['R','G'] -> "Gruul". */
export const GUILD_NAMES: Record<string, string> = {
  W: 'Mono-White', U: 'Mono-Blue', B: 'Mono-Black', R: 'Mono-Red', G: 'Mono-Green',
  WU: 'Azorius', WB: 'Orzhov', WR: 'Boros', WG: 'Selesnya', UB: 'Dimir',
  UR: 'Izzet', UG: 'Simic', BR: 'Rakdos', BG: 'Golgari', RG: 'Gruul',
  WUB: 'Esper', WUR: 'Jeskai', WUG: 'Bant', WBR: 'Mardu', WBG: 'Abzan',
  WRG: 'Naya', UBR: 'Grixis', UBG: 'Sultai', URG: 'Temur', BRG: 'Jund',
};

export function colorLabel(colors: Color[]): string {
  if (colors.length === 0) return 'Colorless';
  const key = (['W', 'U', 'B', 'R', 'G'] as Color[]).filter((c) => colors.includes(c)).join('');
  return GUILD_NAMES[key] ?? key;
}
