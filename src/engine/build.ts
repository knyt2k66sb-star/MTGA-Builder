import type { Archetype, Card, Color } from '../types/card';
import {
  ARCHETYPES,
  COLORS,
  canBeCommander,
  cmcBucket,
  isBasicLand,
  isCreature,
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

const FORMAT_TOTAL = 60; // Standard and Standard Brawl are both 60 (Brawl incl. commander).
export const VIABILITY_THRESHOLD = 45; // decks scoring below this are hidden
export const MAX_RESULTS = 50;
const THEME_WEIGHT = 2.0; // how strongly synergy biases the support-fill pass
const CORE_FRACTION = 0.42; // fraction of nonland slots reserved for the synergy core
const DEDUPE_SIMILARITY = 0.65; // decks more similar than this (Jaccard) are treated as dupes
const MAX_EVALUATIONS = 420; // safety valve on (archetype x theme) combinations per call

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
  theme?: Theme,
): SpellSelection {
  const weights = defaultWeights(powerBias);

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
      add = Math.min(add, spellSlots - placed, cap - placedHere);
      if (respectBucket) add = Math.min(add, bucketNeed[bucket]);
      if (respectRole) add = Math.min(add, need[roleKey]);
      if (add <= 0) continue;

      const existing = entries.find((e) => e.card.oracleId === oid);
      if (existing) existing.qty += add;
      else entries.push({ card, qty: add });

      copies.set(oid, already + add);
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
      .map((card) => ({ card, score: theme.detect(card) + qualityScore(card) * 0.15 }))
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
      return { card, score: baseScore(card, profile, colors, weights) + themeBoost };
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
      `Only ${placed}/${spellSlots} nonland spells available in the chosen colors; deck padded with extra lands.`,
    );
  }
  return { entries, warnings };
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
  const formatProfile = params.format === 'brawl' ? brawlAdjust(baseProfile) : baseProfile;
  const profile = applyThemeToProfile(formatProfile, theme);
  const singleton = params.format === 'brawl';

  // --- Resolve commander (Brawl) and colors ---
  let commander: Card | null = null;
  let colors: Color[];

  if (params.format === 'brawl') {
    commander = resolveCommander(params, pool, rng, theme);
    if (!commander) {
      throw new Error('No legal commander available in the chosen colors.');
    }
    colors = commander.colorIdentity.length > 0 ? commander.colorIdentity : [];
  } else {
    colors = params.colors.length > 0 ? params.colors : deriveColors(pool);
    if (params.colors.length === 0) {
      warnings.push(`No colors chosen — auto-selected ${colors.join('') || 'colorless'}.`);
    }
  }

  // --- Filter the legal, on-color pool ---
  const formatLegal = (c: Card): boolean =>
    params.format === 'brawl' ? c.legalBrawl : c.legalStandard;
  const onColor = (c: Card): boolean => {
    if (params.format === 'brawl') {
      // Color identity must be a subset of the commander's.
      return c.colorIdentity.every((ci) => colors.includes(ci));
    }
    // Constructed: no off-color pips.
    return c.colors.every((ci) => colors.includes(ci));
  };

  const legalPool = pool.filter(formatLegal).filter(onColor);
  const spellPool = legalPool.filter(
    (c) => !isLand(c) && (!singleton || c.oracleId !== commander?.oracleId),
  );
  const landPool = legalPool.filter((c) => isLand(c) && !isBasicLand(c));

  // --- Slot math ---
  const nonCommanderTotal = FORMAT_TOTAL - (commander ? 1 : 0);
  const landCount = Math.min(profile.lands, nonCommanderTotal - 1);
  const spellSlots = nonCommanderTotal - landCount;

  // --- Select spells then mana base ---
  const { entries: spells, warnings: spellWarnings } = selectSpells(
    spellPool,
    profile,
    colors,
    spellSlots,
    singleton,
    params.powerBias ?? 0.5,
    theme,
  );
  warnings.push(...spellWarnings);

  const { lands } = buildManaBase(spells, landPool, landCount, colors, singleton);

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
): Card | null {
  if (params.commanderId) {
    const found = pool.find((c) => c.oracleId === params.commanderId);
    if (found && canBeCommander(found)) return found;
  }
  const wanted = new Set(params.colors);
  const eligible = pool
    .filter((c) => c.legalBrawl && canBeCommander(c))
    .filter((c) =>
      wanted.size === 0
        ? true
        : c.colorIdentity.length > 0 &&
          c.colorIdentity.every((ci) => wanted.has(ci)) &&
          c.colorIdentity.length >= Math.min(wanted.size, 1),
    )
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
 * ranked. This is the headline multi-deck generator.
 */
export function generateDecks(params: MultiGenParams, pool: Card[]): RankedDeck[] {
  const colors =
    params.colors.length > 0 ? params.colors : deriveColors(pool);

  // Themes are detected from the color-relevant slice of the pool.
  const colorPool = pool.filter((c) =>
    params.format === 'brawl'
      ? c.colorIdentity.every((ci) => colors.includes(ci))
      : c.colors.every((ci) => colors.includes(ci)),
  );
  const themes = viableThemes(colorPool);

  const archetypes: Archetype[] =
    params.archetype && params.archetype !== 'any'
      ? [params.archetype]
      : ARCHETYPES;

  const ranked: RankedDeck[] = [];
  let evaluated = 0;

  outer: for (const archetype of archetypes) {
    const baseProfile =
      params.format === 'brawl'
        ? brawlAdjust(ARCHETYPE_PROFILES[archetype])
        : ARCHETYPE_PROFILES[archetype];

    for (const theme of themes) {
      // Skip theme/archetype pairs that obviously clash unless it's goodstuff.
      if (
        theme.id !== 'goodstuff' &&
        !theme.archetypeLean.includes(archetype)
      ) {
        continue;
      }
      if (evaluated++ >= MAX_EVALUATIONS) break outer;

      // Deterministic seed per combo for reproducibility.
      const seed = hashSeed(`${params.format}|${colors.join('')}|${archetype}|${theme.id}`);
      const single: GenParams = {
        format: params.format,
        archetype,
        colors,
        commanderId: params.commanderId ?? null,
        powerBias: params.powerBias ?? 0.5,
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
  }

  // Rank best-first, then dedupe near-identical decks (keep higher score).
  ranked.sort((a, b) => b.viability - a.viability);
  const kept: RankedDeck[] = [];
  for (const r of ranked) {
    if (kept.some((k) => deckSimilarity(k.deck, r.deck) > DEDUPE_SIMILARITY)) continue;
    kept.push(r);
    if (kept.length >= (params.maxResults ?? MAX_RESULTS)) break;
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
