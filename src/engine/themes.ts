import type { Archetype, Card, Color } from '../types/card';
import { isCreature, isLand } from '../types/card';
import { qualityScore } from './scoring';
// (string-detection helpers are inlined per theme below)

type CurveBucketKey = '0-1' | '2' | '3' | '4' | '5' | '6+';

/**
 * A synergy theme. `detect` returns how much a card contributes to the theme:
 *   0   = irrelevant
 *   ~1  = fits / minor enabler
 *   2-3 = strong enabler / payoff
 * Decks are built by locking in a core of the highest-`detect` cards first
 * (see engine/build.ts), so denser themes produce visibly distinct decks
 * rather than reskins of the same quality-sorted pile.
 */
export interface Theme {
  id: string;
  name: string;
  /** Archetypes this theme naturally plays as (used for labeling / leaning). */
  archetypeLean: Archetype[];
  /** Minimum strong contributors that must exist in the color pool to bother. */
  minCore: number;
  detect: (card: Card) => number;
  /** Optional nudge to the archetype's target curve (added, then renormalized). */
  curveNudge?: Partial<Record<CurveBucketKey, number>>;
  /** Optional shift to the creature/noncreature split, e.g. -0.15 = fewer creatures. */
  creatureShift?: number;
  /** Present on synthesized combo themes: the two themes it was built from. */
  parentIds?: [string, string];
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
    curveNudge: { '0-1': 0.05, '2': 0.05, '4': -0.04, '5': -0.03 },
    creatureShift: -0.15,
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
    curveNudge: { '2': 0.03, '3': 0.03 },
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
    curveNudge: { '2': 0.05, '6+': 0.03 },
    creatureShift: 0.05,
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
  {
    id: 'equipment',
    name: 'Equipment',
    archetypeLean: ['aggro', 'midrange', 'tempo'],
    minCore: 4,
    curveNudge: { '2': 0.04 },
    creatureShift: 0.08,
    detect: (c) => {
      let s = 0;
      if (/\bEquipment\b/.test(c.typeLine)) s += 2;
      if (/\bequip\b/i.test(c.oracleText)) s += 1.5;
      if (/living weapon|whenever .* becomes equipped/i.test(c.oracleText)) s += 1;
      return s;
    },
  },
  {
    id: 'discard',
    name: 'Discard & Madness',
    archetypeLean: ['midrange', 'control', 'aggro'],
    minCore: 5,
    creatureShift: -0.05,
    detect: (c) => {
      let s = 0;
      if (/madness/i.test(c.oracleText)) s += 2;
      if (/discards? a card/i.test(c.oracleText)) s += 1.5;
      if (/you may discard a card/i.test(c.oracleText)) s += 1;
      return s;
    },
  },
  {
    id: 'reanimator',
    name: 'Reanimator',
    archetypeLean: ['midrange', 'control', 'ramp'],
    minCore: 4,
    curveNudge: { '0-1': 0.08, '6+': 0.1, '3': -0.05, '4': -0.05 },
    creatureShift: 0.05,
    detect: (c) => {
      let s = 0;
      if (/put .* from your graveyard onto the battlefield|return .* from your graveyard to the battlefield/i.test(c.oracleText)) s += 2.5;
      if (/onto the battlefield from (a|your) graveyard/i.test(c.oracleText)) s += 2;
      if (/\bmill\b/i.test(c.oracleText)) s += 0.8;
      return s;
    },
  },
  {
    id: 'blink',
    name: 'Blink & ETB',
    archetypeLean: ['midrange', 'control'],
    minCore: 5,
    curveNudge: { '3': 0.04 },
    creatureShift: 0.05,
    detect: (c) => {
      let s = 0;
      if (/whenever .* enters,/i.test(c.oracleText)) s += 1.3;
      if (/exile .*, then return (it|that card) to the battlefield/i.test(c.oracleText)) s += 2.5;
      if (/flicker|blink/i.test(c.oracleText)) s += 1.5;
      return s;
    },
  },
  {
    id: 'burn',
    name: 'Burn',
    archetypeLean: ['aggro', 'tempo'],
    minCore: 5,
    curveNudge: { '0-1': 0.06, '2': 0.04 },
    creatureShift: -0.05,
    detect: (c) => {
      let s = 0;
      if (/damage to (any target|each opponent|that player|target player)/i.test(c.oracleText)) s += 2;
      if (/deals? \d+ damage/i.test(c.oracleText)) s += 0.4;
      return s;
    },
  },
];

// ---- Dynamic tribal themes -------------------------------------------------

const TRACKED_TRIBES = [
  'Elf', 'Goblin', 'Vampire', 'Merfolk', 'Dragon', 'Knight', 'Soldier',
  'Wizard', 'Spirit', 'Zombie', 'Human', 'Angel', 'Beast', 'Warrior', 'Rogue',
  // Universes Beyond / Marvel Super Heroes creature types
  'Hero', 'Villain', 'Mutant', 'Robot', 'God',
];

const IRREGULAR_PLURALS: Record<string, string> = {
  Elf: 'Elves',
  Merfolk: 'Merfolk',
  Dwarf: 'Dwarves',
  Hero: 'Heroes',
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

// ---- Composite (dual-theme) synergy packages --------------------------------
//
// Real constructed decks are rarely built around one axis in isolation — a
// sacrifice deck wants Treasure/Food fodder, a tribal deck leans on a support
// theme (Goblins want sac outlets, Elves want ramp/counters). Combining two
// independently-viable themes into one synthesized theme is what actually
// produces decks that *read* as different from each other, rather than
// reshuffled top-quality staples with a different label.

/** Curated pairs of static themes that combine into a recognizable archetype. */
const STATIC_COMBO_PAIRS: [string, string][] = [
  ['aristocrats', 'treasure'],
  ['aristocrats', 'tokens'],
  ['aristocrats', 'graveyard'],
  ['counters', 'tokens'],
  ['counters', 'lifegain'],
  ['spells', 'flyers'],
  ['spells', 'burn'],
  ['graveyard', 'discard'],
  ['graveyard', 'reanimator'],
  ['landfall', 'treasure'],
  ['equipment', 'aggression'],
  ['aggression', 'burn'],
  ['enchantments', 'lifegain'],
  ['blink', 'lifegain'],
];

/** Each tribe gets one curated companion static theme it naturally supports. */
const TRIBE_COMBOS: Record<string, string> = {
  goblin: 'aristocrats',
  elf: 'counters',
  vampire: 'lifegain',
  zombie: 'graveyard',
  soldier: 'tokens',
  spirit: 'flyers',
  human: 'aggression',
  wizard: 'spells',
  knight: 'equipment',
  merfolk: 'landfall',
  dragon: 'treasure',
  angel: 'lifegain',
  beast: 'counters',
  warrior: 'equipment',
  rogue: 'graveyard',
  hero: 'counters',
  villain: 'aristocrats',
  mutant: 'counters',
  robot: 'treasure',
  god: 'enchantments',
};

function mergeCurveNudge(
  a?: Theme['curveNudge'],
  b?: Theme['curveNudge'],
): Theme['curveNudge'] {
  if (!a && !b) return undefined;
  const out: Theme['curveNudge'] = {};
  const keys: CurveBucketKey[] = ['0-1', '2', '3', '4', '5', '6+'];
  for (const k of keys) {
    const v = (a?.[k] ?? 0) + (b?.[k] ?? 0);
    if (v !== 0) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function makeCombo(a: Theme, b: Theme): Theme {
  const creatureShift =
    a.creatureShift != null || b.creatureShift != null
      ? ((a.creatureShift ?? 0) + (b.creatureShift ?? 0)) / 2
      : undefined;
  return {
    id: `${a.id}+${b.id}`,
    name: `${a.name} & ${b.name}`,
    archetypeLean: Array.from(new Set([...a.archetypeLean, ...b.archetypeLean])),
    minCore: Math.max(a.minCore, b.minCore),
    detect: (c) => a.detect(c) + b.detect(c),
    curveNudge: mergeCurveNudge(a.curveNudge, b.curveNudge),
    creatureShift,
    parentIds: [a.id, b.id],
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

/** Detect threshold for "does this card meaningfully belong to the theme". */
export const THEME_CARD_THRESHOLD = 1.3;

function isViableTheme(theme: Theme, colorPool: Card[]): boolean {
  const core = colorPool.filter((c) => !isLand(c) && theme.detect(c) >= THEME_CARD_THRESHOLD).length;
  return core >= theme.minCore;
}

/**
 * Determine which themes are viable in a color-filtered pool: every
 * independently-viable single theme (static + tribal), plus curated
 * combinations of two viable themes that form a recognizable synergy
 * package. Goodstuff is always included as a baseline.
 */
export function viableThemes(colorPool: Card[]): Theme[] {
  const singleCandidates: Theme[] = [
    ...STATIC_THEMES,
    ...TRACKED_TRIBES.map(tribalTheme),
  ];
  const viableSingles = singleCandidates.filter((t) => isViableTheme(t, colorPool));
  const byId = new Map(viableSingles.map((t) => [t.id, t]));

  const combos: Theme[] = [];
  for (const [aId, bId] of STATIC_COMBO_PAIRS) {
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (a && b) combos.push(makeCombo(a, b));
  }
  for (const [tribe, companionId] of Object.entries(TRIBE_COMBOS)) {
    const a = byId.get(`tribe-${tribe}`);
    const b = byId.get(companionId);
    if (a && b) combos.push(makeCombo(a, b));
  }
  const viableCombos = combos.filter((t) => isViableTheme(t, colorPool));

  return [GOODSTUFF, ...viableSingles, ...viableCombos];
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
