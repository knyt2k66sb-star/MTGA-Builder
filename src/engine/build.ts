import type { Archetype, Card, Color } from '../types/card';
import {
  ARCHETYPES,
  COLORS,
  FORMAT_TOTALS,
  canBeCommander,
  cmcBucket,
  isBasicLand,
  isCommanderFormat,
  isCreature,
  isFormatLegal,
  isLand,
} from '../types/card';
import type {
  Deck,
  DeckEntry,
  DeckDiagnostics,
  GenParams,
  GenerationResult,
  MultiGenParams,
  RankedDeck,
  RarityCaps,
  ViabilityBreakdown,
} from '../types/deck';
import { mulberry32 } from '../lib/prng';
import { aggregatePips } from '../lib/mana';
import {
  ARCHETYPE_PROFILES,
  brawlAdjust,
  CURVE_BUCKETS,
  type ArchetypeProfile,
} from './archetypes';
import { baseScore, defaultWeights, qualityScore } from './scoring';
import { buildManaBase, makeBasicLand } from './manabase';
import { detectRoles } from './heuristics';
import {
  colorLabel,
  synergyContribution,
  THEME_CARD_THRESHOLD,
  viableThemes,
  type Theme,
} from './themes';

export const VIABILITY_THRESHOLD = 45; // decks scoring below this are hidden
export const MAX_RESULTS = 50; // default result count
export const MAX_RESULTS_LIMIT = 500; // hard ceiling for the deck-count slider
const THEME_WEIGHT = 2.0; // how strongly synergy biases the support-fill pass
const CORE_FRACTION = 0.42; // fraction of nonland slots reserved for the synergy core
const MAX_EVALUATIONS = 2400; // safety valve on (archetype x theme x variant) builds per call

/**
 * Remaining wildcard budget by rarity during a single deck build. Commons are
 * never capped. Shared (and mutated) across spell selection, commander choice
 * and the mana base so the whole 60/100 cards respect the caps together.
 */
type RarityBudget = { mythic: number; rare: number; uncommon: number };

function makeBudget(caps?: RarityCaps): RarityBudget {
  return {
    mythic: caps?.mythic ?? Infinity,
    rare: caps?.rare ?? Infinity,
    uncommon: caps?.uncommon ?? Infinity,
  };
}

/** How many copies of `card` the budget still allows (Infinity for commons/basics). */
function budgetAllowance(budget: RarityBudget, card: Card): number {
  if (isBasicLand(card)) return Infinity;
  const r = card.rarity as keyof RarityBudget;
  return r in budget ? budget[r] : Infinity;
}

function spendBudget(budget: RarityBudget, card: Card, qty: number): void {
  if (isBasicLand(card)) return;
  const r = card.rarity as keyof RarityBudget;
  if (r in budget) budget[r] = Math.max(0, budget[r] - qty);
}

/** Dedupe gets looser as the requested deck count grows — someone asking for
 *  hundreds of decks wants breadth including close variants. */
function dedupeThreshold(maxResults: number): number {
  if (maxResults <= 60) return 0.65;
  if (maxResults <= 200) return 0.75;
  return 0.85;
}

function uid(seed: number): string {
  return `deck-${seed.toString(36)}-${Date.now().toString(36)}`;
}

/** When the user gives no colors, infer them from the strongest cards. */
function deriveColors(pool: Card[]): Color[] {
  const tally: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const ranked = pool
    .filter((c) => !isLand(c) && c.colors.length > 0)
    .sort((a, b) => qualityScore(b) - qualityScore(a))
    .slice(0, 60);
  for (const c of ranked) for (const col of c.colors) tally[col] += 1;
  const sorted = (COLORS as Color[]).sort((a, b) => tally[b] - tally[a]);
  return sorted.slice(0, 2).filter((c) => tally[c] > 0);
}

interface SpellSelection {
  entries: DeckEntry[];
  warnings: string[];
}

/**
 * Curve-and-role-aware selection of nonland spells, built in two phases:
 *
 *  Phase A (synergy core): when a real theme is active, lock in a target
 *  fraction of the deck from cards ranked purely by theme fit (quality only
 *  breaks near-ties). This is what makes two decks with the same archetype
 *  and colors actually *read* as different builds instead of the same
 *  quality-sorted pile with a couple of cards swapped.
 *
 *  Phase B (support fill): the remaining slots are filled by overall score
 *  (quality + archetype fit + color fit + a smaller theme bonus), same as
 *  before, so the rest of the deck is still coherent and legal.
 *
 * Both phases respect curve-bucket and creature/noncreature targets, relaxing
 * them in later passes only if the pool can't fill them exactly.
 */
function selectSpells(
  candidates: Card[],
  profile: ArchetypeProfile,
  colors: Color[],
  spellSlots: number,
  singleton: boolean,
  powerBias: number,
  theme: Theme | undefined,
  budget: RarityBudget,
  rng: () => number,
  jitter = 0,
): SpellSelection {
  const weights = defaultWeights(powerBias);
  // Seeded noise on scores (0 = fully deterministic). Used to spin coherent
  // variant builds of the same archetype/theme when many decks are requested.
  const noise = () => (jitter > 0 ? (rng() - 0.5) * jitter : 0);

  // Target counts per curve bucket and per creature/noncreature split.
  const bucketNeed: Record<string, number> = {};
  for (const b of CURVE_BUCKETS) bucketNeed[b] = Math.round(profile.curve[b] * spellSlots);
  const creatureNeed = Math.round(
    (profile.creatures / (profile.creatures + profile.nonCreature)) * spellSlots,
  );
  const need = { creature: creatureNeed, nonCreature: spellSlots - creatureNeed };

  const copies = new Map<string, number>();
  const entries: DeckEntry[] = [];
  let placed = 0;

  /** Place cards from `ordered`, respecting bucket/role targets, up to `cap` new cards. */
  const placeFrom = (
    ordered: Card[],
    respectBucket: boolean,
    respectRole: boolean,
    cap: number,
  ): number => {
    let placedHere = 0;
    for (const card of ordered) {
      if (placed >= spellSlots || placedHere >= cap) break;
      const oid = card.oracleId;
      const already = copies.get(oid) ?? 0;
      const perCardLimit = singleton ? 1 : 4;
      if (already >= perCardLimit) continue;

      const bucket = cmcBucket(card.cmc);
      if (respectBucket && bucketNeed[bucket] <= 0) continue;
      const isCrea = isCreature(card);
      const roleKey = isCrea ? 'creature' : 'nonCreature';
      if (respectRole && need[roleKey] <= 0) continue;

      let add = singleton ? 1 : 4 - already;
      add = Math.min(add, spellSlots - placed, cap - placedHere, budgetAllowance(budget, card));
      if (respectBucket) add = Math.min(add, bucketNeed[bucket]);
      if (respectRole) add = Math.min(add, need[roleKey]);
      if (add <= 0) continue;

      const existing = entries.find((e) => e.card.oracleId === oid);
      if (existing) existing.qty += add;
      else entries.push({ card, qty: add });

      copies.set(oid, already + add);
      spendBudget(budget, card, add);
      bucketNeed[bucket] -= add;
      need[roleKey] -= add;
      placed += add;
      placedHere += add;
    }
    return placedHere;
  };

  // ---- Phase A: lock in a synergy core, ranked by theme fit first ----
  if (theme && theme.id !== 'goodstuff') {
    const coreOrdered = candidates
      .filter((c) => theme.detect(c) >= THEME_CARD_THRESHOLD)
      .map((card) => ({ card, score: theme.detect(card) + qualityScore(card) * 0.15 + noise() }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.card);

    let coreRemaining = Math.round(spellSlots * CORE_FRACTION);
    coreRemaining -= placeFrom(coreOrdered, true, true, coreRemaining);
    coreRemaining -= placeFrom(coreOrdered, false, true, coreRemaining);
    placeFrom(coreOrdered, false, false, coreRemaining);
  }

  // ---- Phase B: fill the remainder by overall score (+ a smaller theme bonus) ----
  const scored = candidates
    .map((card) => {
      const themeBoost = theme ? THEME_WEIGHT * theme.detect(card) : 0;
      return { card, score: baseScore(card, profile, colors, weights) + themeBoost + noise() };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.card);

  // Pass 1: honor curve + role. Pass 2: relax curve. Pass 3: relax everything.
  placeFrom(scored, true, true, Infinity);
  placeFrom(scored, false, true, Infinity);
  placeFrom(scored, false, false, Infinity);

  const warnings: string[] = [];
  if (placed < spellSlots) {
    warnings.push(
      `Only ${placed}/${spellSlots} nonland spells fit the chosen colors and restrictions; deck padded with extra lands.`,
    );
  }
  return { entries, warnings };
}

/**
 * Scale a 60-card archetype profile to the 100-card Brawl format. Land counts
 * land in the conventional 36–42 range; the curve distribution is unchanged.
 */
function scaleForBrawl100(profile: ArchetypeProfile): ArchetypeProfile {
  const factor = 100 / 60;
  const lands = Math.min(42, Math.max(36, Math.round(profile.lands * factor)));
  return {
    ...profile,
    lands,
    creatures: Math.round(profile.creatures * factor),
    nonCreature: Math.round(profile.nonCreature * factor),
  };
}

/**
 * Nudge an archetype profile toward a theme's natural shape (e.g. Spells
 * Matter wants fewer creatures and a cheaper curve; Reanimator wants a
 * bimodal curve of cheap enablers + huge payoffs). Curve deltas are added
 * then renormalized; the creature/noncreature split is shifted by a fraction
 * of the total nonland count. Themes without nudges (most tribes, goodstuff)
 * pass the profile through unchanged.
 */
function applyThemeToProfile(profile: ArchetypeProfile, theme?: Theme): ArchetypeProfile {
  if (!theme || (!theme.curveNudge && !theme.creatureShift)) return profile;

  let curve = profile.curve;
  if (theme.curveNudge) {
    const nudged = { ...profile.curve };
    for (const b of CURVE_BUCKETS) nudged[b] = Math.max(0.01, nudged[b] + (theme.curveNudge[b] ?? 0));
    const sum = CURVE_BUCKETS.reduce((s, b) => s + nudged[b], 0);
    for (const b of CURVE_BUCKETS) nudged[b] = nudged[b] / sum;
    curve = nudged;
  }

  let { creatures, nonCreature } = profile;
  if (theme.creatureShift) {
    const total = creatures + nonCreature;
    const shiftAmt = Math.round(total * theme.creatureShift);
    creatures = Math.max(1, creatures + shiftAmt);
    nonCreature = Math.max(1, total - creatures);
  }

  return { ...profile, curve, creatures, nonCreature };
}

export function generateDeck(
  params: GenParams,
  pool: Card[],
  theme?: Theme,
): GenerationResult {
  const seed = params.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = mulberry32(seed);
  const warnings: string[] = [];

  const baseProfile = ARCHETYPE_PROFILES[params.archetype];
  const formatProfile =
    params.format === 'standardbrawl'
      ? brawlAdjust(baseProfile)
      : params.format === 'brawl'
        ? scaleForBrawl100(baseProfile)
        : baseProfile;
  const profile = applyThemeToProfile(formatProfile, theme);
  const singleton = isCommanderFormat(params.format);
  const budget = makeBudget(params.rarityCaps);

  // --- Resolve commander (Brawl variants) and colors ---
  let commander: Card | null = null;
  let colors: Color[];

  if (singleton) {
    commander = resolveCommander(params, pool, rng, theme, budget);
    if (!commander) {
      throw new Error('No legal commander available in the chosen colors.');
    }
    // The commander costs wildcards like any other card.
    spendBudget(budget, commander, 1);
    colors = commander.colorIdentity.length > 0 ? commander.colorIdentity : [];
  } else {
    colors = params.colors.length > 0 ? params.colors : deriveColors(pool);
    if (params.colors.length === 0) {
      warnings.push(`No colors chosen — auto-selected ${colors.join('') || 'colorless'}.`);
    }
  }

  // --- Filter the legal, on-color pool ---
  const onColor = (c: Card): boolean => {
    if (singleton) {
      // Color identity must be a subset of the commander's.
      return c.colorIdentity.every((ci) => colors.includes(ci));
    }
    // Constructed: no off-color pips.
    return c.colors.every((ci) => colors.includes(ci));
  };

  const legalPool = pool.filter((c) => isFormatLegal(c, params.format)).filter(onColor);
  const maxCmc = params.maxCmc ?? null;
  const spellPool = legalPool.filter(
    (c) =>
      !isLand(c) &&
      (!singleton || c.oracleId !== commander?.oracleId) &&
      (maxCmc == null || c.cmc <= maxCmc),
  );
  const landPool = legalPool.filter((c) => isLand(c) && !isBasicLand(c));

  // --- Slot math ---
  const formatTotal = FORMAT_TOTALS[params.format];
  const nonCommanderTotal = formatTotal - (commander ? 1 : 0);
  const requestedLands = params.landCount ?? profile.lands;
  const landCount = Math.min(
    Math.max(Math.round(requestedLands), 10),
    nonCommanderTotal - 1,
  );
  const spellSlots = nonCommanderTotal - landCount;

  // --- Select spells then mana base (sharing one wildcard budget) ---
  const { entries: spells, warnings: spellWarnings } = selectSpells(
    spellPool,
    profile,
    colors,
    spellSlots,
    singleton,
    params.powerBias ?? 0.5,
    theme,
    budget,
    rng,
    params.jitter ?? 0,
  );
  warnings.push(...spellWarnings);

  const { lands } = buildManaBase(spells, landPool, landCount, colors, singleton, budget);

  // --- Reconcile to exactly nonCommanderTotal cards ---
  const main = [...spells, ...lands];
  reconcileCount(main, nonCommanderTotal, colors);

  const now = new Date().toISOString();
  const deck: Deck = {
    id: uid(seed),
    name: defaultDeckName(params, colors, commander, theme),
    format: params.format,
    commander,
    main,
    sideboard: [],
    colors,
    archetype: params.archetype,
    seed,
    createdAt: now,
    updatedAt: now,
  };

  return { deck, diagnostics: diagnose(deck, warnings) };
}

function resolveCommander(
  params: GenParams,
  pool: Card[],
  rng: () => number,
  theme?: Theme,
  budget?: RarityBudget,
): Card | null {
  if (params.commanderId) {
    const found = pool.find((c) => c.oracleId === params.commanderId);
    // An explicitly chosen commander is honored even under rarity caps.
    if (found && canBeCommander(found)) return found;
  }
  const wanted = new Set(params.colors);
  let eligible = pool
    .filter((c) => isFormatLegal(c, params.format) && canBeCommander(c))
    .filter((c) =>
      wanted.size === 0
        ? true
        : c.colorIdentity.length > 0 &&
          c.colorIdentity.every((ci) => wanted.has(ci)) &&
          c.colorIdentity.length >= Math.min(wanted.size, 1),
    );
  // Under rarity caps, prefer a commander the budget can actually afford.
  if (budget) {
    const affordable = eligible.filter((c) => budgetAllowance(budget, c) >= 1);
    if (affordable.length > 0) eligible = affordable;
  }
  eligible = eligible
    // Prefer commanders that themselves advance the theme, then raw quality.
    .sort((a, b) => {
      const t = theme ? theme.detect(b) - theme.detect(a) : 0;
      return t !== 0 ? t : qualityScore(b) - qualityScore(a);
    });
  if (eligible.length === 0) return null;
  // Pick from the top few for a little variety across seeds.
  const top = eligible.slice(0, Math.min(5, eligible.length));
  return top[Math.floor(rng() * top.length)];
}

/** Add/remove basics so the deck has exactly `target` cards. */
function reconcileCount(main: DeckEntry[], target: number, colors: Color[]): void {
  const total = () => main.reduce((s, e) => s + e.qty, 0);

  while (total() > target) {
    // Trim from the largest basic-land stack, else the last entry.
    const basics = main.filter((e) => isBasicLand(e.card) && e.qty > 0);
    const victim = (basics.length ? basics : main).sort((a, b) => b.qty - a.qty)[0];
    victim.qty -= 1;
    if (victim.qty === 0) main.splice(main.indexOf(victim), 1);
  }

  if (total() < target && colors.length > 0) {
    const pips = aggregatePips(main.filter((e) => !isLand(e.card)));
    const fillColor = colors.slice().sort((a, b) => pips[b] - pips[a])[0];
    // Reuse an existing basic stack of that color if present.
    const existing = main.find(
      (e) => isBasicLand(e.card) && e.card.colorIdentity[0] === fillColor,
    );
    const deficit = target - total();
    if (existing) existing.qty += deficit;
    else main.push({ card: makeBasicLand(fillColor), qty: deficit });
  }
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function defaultDeckName(
  params: GenParams,
  colors: Color[],
  commander: Card | null,
  theme?: Theme,
): string {
  const themePart = theme && theme.id !== 'goodstuff' ? `${theme.name} ` : '';
  if (commander) return `${commander.name} — ${themePart}Brawl`.replace(' — Brawl', ' Brawl');
  return `${colorLabel(colors)} ${themePart}${titleCase(params.archetype)}`.replace(/\s+/g, ' ').trim();
}

export function diagnose(deck: Deck, warnings: string[] = []): DeckDiagnostics {
  const all = [...deck.main, ...(deck.commander ? [{ card: deck.commander, qty: 1 }] : [])];
  let landCount = 0;
  let creatureCount = 0;
  let nonCreatureSpellCount = 0;
  const curve: Record<string, number> = { '0-1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6+': 0 };
  const roleBreakdown: Record<string, number> = {};
  // Rarity = wildcard cost in Arena. Basic lands are free, so exclude them;
  // nonbasic lands still cost wildcards and are counted.
  const rarity: Record<string, number> = { mythic: 0, rare: 0, uncommon: 0, common: 0 };

  for (const { card, qty } of all) {
    if (!isBasicLand(card)) {
      const r = ['mythic', 'rare', 'uncommon', 'common'].includes(card.rarity)
        ? card.rarity
        : 'rare'; // bucket promos/special into rare
      rarity[r] += qty;
    }
    if (isLand(card)) {
      landCount += qty;
      continue;
    }
    if (isCreature(card)) creatureCount += qty;
    else nonCreatureSpellCount += qty;
    curve[cmcBucket(card.cmc)] += qty;
    for (const role of detectRoles(card)) {
      roleBreakdown[role] = (roleBreakdown[role] ?? 0) + qty;
    }
  }

  const colorPips = aggregatePips(deck.main.filter((e) => !isLand(e.card)));

  return {
    totalCards: all.reduce((s, e) => s + e.qty, 0),
    landCount,
    creatureCount,
    nonCreatureSpellCount,
    curve,
    colorPips,
    roleBreakdown,
    rarity,
    warnings,
  };
}

// ===========================================================================
// Multi-deck synergy generation
// ===========================================================================

/** Distance of a deck's curve from the archetype target (0 = perfect). */
function curveDistance(deck: Deck, profile: ArchetypeProfile): number {
  const nonland = deck.main.filter((e) => !isLand(e.card));
  const total = nonland.reduce((s, e) => s + e.qty, 0) || 1;
  const actual: Record<string, number> = { '0-1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6+': 0 };
  for (const e of nonland) actual[cmcBucket(e.card.cmc)] += e.qty;
  let dist = 0;
  for (const b of CURVE_BUCKETS) dist += Math.abs(actual[b] / total - profile.curve[b]);
  return dist / 2; // 0..1
}

/** Fraction of deck colors that have a reasonable number of mana sources. */
function manaSoundness(deck: Deck, colors: Color[]): number {
  if (colors.length === 0) return 1;
  const sources: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const e of deck.main) {
    if (!isLand(e.card)) continue;
    for (const m of e.card.producedMana) if ((colors as string[]).includes(m)) sources[m as Color] += e.qty;
  }
  const adequate = colors.filter((c) => sources[c] >= 4).length;
  return adequate / colors.length;
}

function computeViability(
  deck: Deck,
  adjustedProfile: ArchetypeProfile,
  theme: Theme,
  colors: Color[],
): { viability: number; breakdown: ViabilityBreakdown } {
  const nonland = deck.main.filter((e) => !isLand(e.card));
  const nonlandCount = nonland.reduce((s, e) => s + e.qty, 0) || 1;

  // Synergy density: average theme contribution per nonland card, normalized.
  // Combo (dual-theme) detectors sum two independent detectors, so they need
  // a higher normalizer or every combo deck would clip to a perfect 1.0.
  const synergy = synergyContribution(theme, nonland) / nonlandCount;
  const normalizer = theme.parentIds ? 2.4 : 1.6;
  const synergyDensity = Math.min(1, synergy / normalizer);

  const quality =
    nonland.reduce((s, e) => s + qualityScore(e.card) * e.qty, 0) / nonlandCount;

  // Curve target reflects the theme's own curve nudges, so a deck isn't
  // penalized for correctly leaning into e.g. Reanimator's bimodal curve.
  const curveFit = 1 - Math.min(1, curveDistance(deck, adjustedProfile));
  const mana = manaSoundness(deck, colors);

  const breakdown: ViabilityBreakdown = {
    synergyDensity,
    quality,
    curveFit,
    manaSoundness: mana,
  };
  const viability =
    100 * (0.5 * synergyDensity + 0.25 * quality + 0.15 * curveFit + 0.1 * mana);
  return { viability, breakdown };
}

/** Jaccard similarity of two decks by oracleId multiset of nonland cards. */
function deckSimilarity(a: Deck, b: Deck): number {
  const setOf = (d: Deck) => new Set(d.main.filter((e) => !isBasicLand(e.card)).map((e) => e.card.oracleId));
  const sa = setOf(a);
  const sb = setOf(b);
  let inter = 0;
  for (const id of sa) if (sb.has(id)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Generate every viable deck for a color/format combo: one per
 * (archetype × synergy theme), scored for viability, filtered, deduped and
 * ranked. When more decks are requested than there are combos, additional
 * seeded **variant** builds are spun per combo with controlled score jitter —
 * coherent alternate takes on the same synergy, not random piles.
 * This is the headline multi-deck generator.
 */
export function generateDecks(params: MultiGenParams, pool: Card[]): RankedDeck[] {
  const maxResults = Math.min(
    Math.max(Math.round(params.maxResults ?? MAX_RESULTS), 1),
    MAX_RESULTS_LIMIT,
  );
  const colors =
    params.colors.length > 0 ? params.colors : deriveColors(pool);

  // Themes are detected from the color-relevant slice of the pool.
  const singleton = isCommanderFormat(params.format);
  const colorPool = pool.filter((c) =>
    singleton
      ? c.colorIdentity.every((ci) => colors.includes(ci))
      : c.colors.every((ci) => colors.includes(ci)),
  );
  let themes = viableThemes(colorPool);
  if (params.themeFilter && params.themeFilter !== 'any') {
    themes = themes.filter((t) => t.id === params.themeFilter);
  }

  const archetypes: Archetype[] =
    params.archetype && params.archetype !== 'any'
      ? [params.archetype]
      : ARCHETYPES;

  // Enumerate allowed (archetype, theme) combos up-front so we know how many
  // jittered variant passes are needed to reach the requested count.
  const combos: { archetype: Archetype; theme: Theme }[] = [];
  for (const archetype of archetypes) {
    for (const theme of themes) {
      // Skip theme/archetype pairs that obviously clash unless it's goodstuff
      // or the user explicitly asked for this theme.
      if (
        theme.id !== 'goodstuff' &&
        params.themeFilter !== theme.id &&
        !theme.archetypeLean.includes(archetype)
      ) {
        continue;
      }
      combos.push({ archetype, theme });
    }
  }
  if (combos.length === 0) return [];

  // Variant passes: pass 0 is deterministic; later passes add growing seeded
  // jitter. Overshoot the request a bit so dedupe still leaves enough.
  const variantPasses = Math.min(
    8,
    Math.max(1, Math.ceil((maxResults * 1.6) / combos.length)),
  );

  const ranked: RankedDeck[] = [];
  let evaluated = 0;

  outer: for (let variant = 0; variant < variantPasses; variant++) {
    for (const { archetype, theme } of combos) {
      if (evaluated++ >= MAX_EVALUATIONS) break outer;

      const baseProfile =
        params.format === 'standardbrawl'
          ? brawlAdjust(ARCHETYPE_PROFILES[archetype])
          : params.format === 'brawl'
            ? scaleForBrawl100(ARCHETYPE_PROFILES[archetype])
            : ARCHETYPE_PROFILES[archetype];

      // Deterministic seed per combo+variant for reproducibility.
      const seed = hashSeed(
        `${params.format}|${colors.join('')}|${archetype}|${theme.id}|v${variant}`,
      );
      const single: GenParams = {
        format: params.format,
        archetype,
        colors,
        commanderId: params.commanderId ?? null,
        powerBias: params.powerBias ?? 0.5,
        rarityCaps: params.rarityCaps,
        maxCmc: params.maxCmc,
        landCount: params.landCount,
        jitter: variant === 0 ? 0 : 0.5 + 0.35 * variant,
        seed,
      };

      let result;
      try {
        result = generateDeck(single, pool, theme);
      } catch {
        continue; // e.g. no legal commander for this color combo
      }
      const { deck, diagnostics } = result;

      const nonland = deck.main.filter((e) => !isLand(e.card));
      const nonlandTotal = nonland.reduce((s, e) => s + e.qty, 0);

      // Did the synergy core actually materialize, scaled to deck size?
      // (goodstuff is exempt — it has no "package" to require.)
      const themeCards = nonland.filter((e) => theme.detect(e.card) >= THEME_CARD_THRESHOLD);
      const themeCount = themeCards.reduce((s, e) => s + e.qty, 0);
      const minThemeCards = Math.max(6, Math.round(nonlandTotal * 0.22));
      if (theme.id !== 'goodstuff' && themeCount < minThemeCards) continue;

      const adjustedProfile = applyThemeToProfile(baseProfile, theme);
      const { viability, breakdown } = computeViability(deck, adjustedProfile, theme, deck.colors);
      if (viability < VIABILITY_THRESHOLD) continue;

      const synergyCards = themeCards
        .sort((a, b) => theme.detect(b.card) - theme.detect(a.card))
        .slice(0, 6)
        .map((e) => e.card.name);

      ranked.push({
        deck,
        diagnostics,
        viability: Math.round(viability),
        themeId: theme.id,
        themeName: theme.name,
        archetype,
        synergyCards,
        breakdown,
      });
    }
    // Stop spinning variants once we clearly have enough raw candidates.
    if (ranked.length >= maxResults * 1.6) break;
  }

  // Rank best-first, then dedupe near-identical decks (keep higher score).
  ranked.sort((a, b) => b.viability - a.viability);
  const threshold = dedupeThreshold(maxResults);
  const kept: RankedDeck[] = [];
  for (const r of ranked) {
    if (kept.some((k) => deckSimilarity(k.deck, r.deck) > threshold)) continue;
    kept.push(r);
    if (kept.length >= maxResults) break;
  }
  return kept;
}

/** Stable string hash -> 31-bit seed. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2 ** 31;
}
