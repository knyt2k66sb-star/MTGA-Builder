import type { Archetype, Card, Color, Format } from './card';

export interface DeckEntry {
  card: Card;
  qty: number;
}

export interface Deck {
  id: string;
  name: string;
  format: Format;
  /** Brawl commander; null for Standard constructed. */
  commander: Card | null;
  /** Mainboard entries (excludes the commander). */
  main: DeckEntry[];
  /** Standard only. Brawl has no sideboard. */
  sideboard: DeckEntry[];
  colors: Color[];
  archetype: Archetype | null;
  /** Seed used for algorithmic generation, if any. */
  seed: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Per-rarity card limits (counting quantities, nonbasic lands included since
 * they cost wildcards too). null/undefined = unlimited. Commons are never
 * capped — restricting to "commons only" is done by zeroing the other three.
 */
export interface RarityCaps {
  mythic?: number | null;
  rare?: number | null;
  uncommon?: number | null;
}

export interface GenParams {
  format: Format;
  archetype: Archetype;
  colors: Color[];
  /** Brawl: chosen commander oracleId. If absent, one is auto-picked. */
  commanderId?: string | null;
  seed?: number;
  /** 0..1 — how strongly card quality (edhrec rank) is weighted. */
  powerBias?: number;
  /** Per-rarity wildcard budget the deck must fit inside. */
  rarityCaps?: RarityCaps;
  /** Exclude nonland cards above this mana value. */
  maxCmc?: number | null;
  /** Override the archetype's land count. */
  landCount?: number | null;
  /** Score jitter amplitude (0 = deterministic). Used for variant builds. */
  jitter?: number;
}

/** Diagnostics returned alongside a generated deck for UI display. */
export interface DeckDiagnostics {
  totalCards: number;
  landCount: number;
  creatureCount: number;
  nonCreatureSpellCount: number;
  curve: Record<string, number>;
  colorPips: Record<Color, number>;
  roleBreakdown: Record<string, number>;
  /** Count of nonbasic cards by rarity (mythic/rare/uncommon/common). */
  rarity: Record<string, number>;
  warnings: string[];
}

export interface GenerationResult {
  deck: Deck;
  diagnostics: DeckDiagnostics;
}

export interface MultiGenParams {
  format: Format;
  colors: Color[];
  /** Optional archetype filter; 'any' (or omitted) explores all archetypes. */
  archetype?: Archetype | 'any';
  commanderId?: string | null;
  powerBias?: number;
  /** How many decks to return (default 50, clamped to 1..500). */
  maxResults?: number;
  /** Per-rarity wildcard budget every generated deck must fit inside. */
  rarityCaps?: RarityCaps;
  /** Exclude nonland cards above this mana value. */
  maxCmc?: number | null;
  /** Override the archetype land count for every generated deck. */
  landCount?: number | null;
  /** Only build around this theme id ('any' or omitted = all viable themes). */
  themeFilter?: string | 'any';
}

export interface ViabilityBreakdown {
  synergyDensity: number;
  quality: number;
  curveFit: number;
  manaSoundness: number;
}

/** A generated deck plus how it scored, for the results gallery. */
export interface RankedDeck {
  deck: Deck;
  diagnostics: DeckDiagnostics;
  viability: number; // 0..100
  themeId: string;
  themeName: string;
  archetype: Archetype;
  /** Names of the top synergy cards that define this deck. */
  synergyCards: string[];
  breakdown: ViabilityBreakdown;
}
