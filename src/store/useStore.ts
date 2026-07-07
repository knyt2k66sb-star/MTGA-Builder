import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import type { Archetype, Card, Color, Format } from '../types/card';
import { isCommanderFormat, isLand } from '../types/card';
import type {
  Deck,
  DeckDiagnostics,
  MultiGenParams,
  RankedDeck,
  RarityCaps,
} from '../types/deck';
import { POOL, POOL_META, loadBrawlExtra } from '../data/pool';
import { diagnose, generateDecks, MAX_RESULTS } from '../engine/build';
import { makeBasicLand } from '../engine/manabase';
import { deckSignature, loadSavedDecks, persistSavedDecks } from './savedDecks';

export type ArchetypeFilter = Archetype | 'any';

export interface CardFilters {
  text: string;
  colors: Color[];
  types: string[]; // e.g. ['Creature', 'Land']
  maxCmc: number | null;
}

const COLOR_ORDER: Color[] = ['W', 'U', 'B', 'R', 'G'];

function deriveDeckColors(deck: Deck): Color[] {
  const set = new Set<Color>();
  if (deck.commander) deck.commander.colorIdentity.forEach((c) => set.add(c));
  for (const { card } of deck.main) {
    if (isLand(card)) continue;
    card.colors.forEach((c) => set.add(c));
  }
  return COLOR_ORDER.filter((c) => set.has(c));
}

function emptyDeck(format: Format): Deck {
  const now = new Date().toISOString();
  return {
    id: `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: 'New Deck',
    format,
    commander: null,
    main: [],
    sideboard: [],
    colors: [],
    archetype: null,
    seed: null,
    createdAt: now,
    updatedAt: now,
  };
}

interface AppState {
  pool: Card[];
  /** Lazily loaded Brawl(100)-only cards; null until first requested. */
  extraPool: Card[] | null;
  // ---- generator parameters ----
  format: Format;
  archetype: ArchetypeFilter;
  colors: Color[];
  commanderId: string | null;
  powerBias: number;
  deckCount: number;
  rarityCaps: RarityCaps;
  maxCmc: number | null;
  landCountOverride: number | null;
  themeFilter: string;
  // ---- generated results ----
  results: RankedDeck[];
  selectedDeckId: string | null;
  generating: boolean;
  // ---- current deck (the selected/opened one) ----
  deck: Deck | null;
  diagnostics: DeckDiagnostics | null;
  genError: string | null;
  // ---- manual deck builder ----
  builderDeck: Deck | null;
  // ---- saved decks ----
  savedDecks: Deck[];
  // ---- browsing ----
  filters: CardFilters;
  previewCard: Card | null;

  setFormat: (f: Format) => void;
  setArchetype: (a: ArchetypeFilter) => void;
  toggleColor: (c: Color) => void;
  setCommander: (id: string | null) => void;
  setPowerBias: (n: number) => void;
  setDeckCount: (n: number) => void;
  setRarityCap: (rarity: keyof RarityCaps, n: number | null) => void;
  setMaxCmcParam: (n: number | null) => void;
  setLandCountOverride: (n: number | null) => void;
  setThemeFilter: (id: string) => void;
  applyPreset: (patch: Partial<AppState>) => void;
  ensureBrawlExtra: () => Promise<Card[]>;
  generate: () => Promise<void>;
  selectResult: (deckId: string) => void;
  setDeck: (deck: Deck) => void;
  recomputeDiagnostics: () => void;

  // ---- builder actions ----
  builderNew: (format: Format) => void;
  builderLoadDeck: (deck: Deck) => void;
  builderAdd: (card: Card) => void;
  builderRemove: (oracleId: string) => void;
  builderAddBasic: (color: Color) => void;
  builderSetCommander: (card: Card | null) => void;
  builderRename: (name: string) => void;
  builderSave: () => void;
  builderClear: () => void;

  saveCurrentDeck: () => void;
  deleteSavedDeck: (id: string) => void;
  loadDeck: (id: string) => void;

  setFilterText: (t: string) => void;
  toggleFilterColor: (c: Color) => void;
  toggleFilterType: (t: string) => void;
  setMaxCmc: (n: number | null) => void;
  setPreviewCard: (c: Card | null) => void;
}

/** Mutate the builder deck immutably and keep colors/timestamps fresh. */
function withBuilder(deck: Deck, mutate: (d: Deck) => void): Deck {
  const next: Deck = {
    ...deck,
    main: deck.main.map((e) => ({ ...e })),
    updatedAt: new Date().toISOString(),
  };
  mutate(next);
  next.colors = deriveDeckColors(next);
  return next;
}

export const useStore = create<AppState>((set, get) => ({
  pool: POOL,
  extraPool: null,
  format: 'standard',
  archetype: 'any',
  colors: ['R'],
  commanderId: null,
  powerBias: 0.5,
  deckCount: MAX_RESULTS,
  rarityCaps: { mythic: null, rare: null, uncommon: null },
  maxCmc: null,
  landCountOverride: null,
  themeFilter: 'any',
  results: [],
  selectedDeckId: null,
  generating: false,
  deck: null,
  diagnostics: null,
  genError: null,
  builderDeck: null,
  savedDecks: loadSavedDecks(),
  filters: { text: '', colors: [], types: [], maxCmc: null },
  previewCard: null,

  setFormat: (format) => set({ format, themeFilter: 'any' }),
  setArchetype: (archetype) => set({ archetype }),
  toggleColor: (c) =>
    set((s) => ({
      colors: s.colors.includes(c)
        ? s.colors.filter((x) => x !== c)
        : [...s.colors, c],
    })),
  setCommander: (commanderId) => set({ commanderId }),
  setPowerBias: (powerBias) => set({ powerBias }),
  setDeckCount: (deckCount) => set({ deckCount }),
  setRarityCap: (rarity, n) =>
    set((s) => ({ rarityCaps: { ...s.rarityCaps, [rarity]: n } })),
  setMaxCmcParam: (maxCmc) => set({ maxCmc }),
  setLandCountOverride: (landCountOverride) => set({ landCountOverride }),
  setThemeFilter: (themeFilter) => set({ themeFilter }),
  applyPreset: (patch) => set(patch),

  ensureBrawlExtra: async () => {
    const cached = get().extraPool;
    if (cached) return cached;
    const extra = await loadBrawlExtra();
    set({ extraPool: extra });
    return extra;
  },

  generate: async () => {
    set({ generating: true, genError: null });
    // Let the spinner paint before the synchronous generation work starts.
    await new Promise((r) => setTimeout(r, 30));
    try {
      const s = get();
      const pool =
        s.format === 'brawl' ? [...POOL, ...(await s.ensureBrawlExtra())] : POOL;
      const params: MultiGenParams = {
        format: s.format,
        archetype: s.archetype,
        colors: s.colors,
        commanderId: isCommanderFormat(s.format) ? s.commanderId : null,
        powerBias: s.powerBias,
        maxResults: s.deckCount,
        rarityCaps: s.rarityCaps,
        maxCmc: s.maxCmc,
        landCount: s.landCountOverride,
        themeFilter: s.themeFilter,
      };
      const results = generateDecks(params, pool);
      if (results.length === 0) {
        set({
          results: [],
          genError:
            'No viable decks found for these parameters. Try loosening the restrictions, colors or archetype.',
          generating: false,
        });
        return;
      }
      const top = results[0];
      set({
        results,
        selectedDeckId: top.deck.id,
        deck: top.deck,
        diagnostics: top.diagnostics,
        genError: null,
        generating: false,
      });
    } catch (err) {
      set({
        genError: err instanceof Error ? err.message : String(err),
        generating: false,
      });
    }
  },

  selectResult: (deckId) => {
    const r = get().results.find((x) => x.deck.id === deckId);
    if (r) set({ deck: r.deck, diagnostics: r.diagnostics, selectedDeckId: deckId });
  },

  setDeck: (deck) => set({ deck, diagnostics: diagnose(deck), genError: null, selectedDeckId: deck.id }),
  recomputeDiagnostics: () => {
    const d = get().deck;
    if (d) set({ diagnostics: diagnose(d) });
  },

  // ---- manual deck builder ----
  builderNew: (format) => set({ builderDeck: emptyDeck(format) }),
  builderLoadDeck: (deck) =>
    set({
      builderDeck: { ...deck, main: deck.main.map((e) => ({ ...e })) },
    }),
  builderAdd: (card) => {
    const d = get().builderDeck;
    if (!d) return;
    const singleton = isCommanderFormat(d.format);
    const isBasic = /\bBasic\b/.test(card.typeLine);
    set({
      builderDeck: withBuilder(d, (next) => {
        const existing = next.main.find((e) => e.card.oracleId === card.oracleId);
        const limit = isBasic ? Infinity : singleton ? 1 : 4;
        if (existing) {
          if (existing.qty < limit) existing.qty += 1;
        } else {
          next.main.push({ card, qty: 1 });
        }
      }),
    });
  },
  builderRemove: (oracleId) => {
    const d = get().builderDeck;
    if (!d) return;
    set({
      builderDeck: withBuilder(d, (next) => {
        const idx = next.main.findIndex((e) => e.card.oracleId === oracleId);
        if (idx === -1) return;
        next.main[idx].qty -= 1;
        if (next.main[idx].qty <= 0) next.main.splice(idx, 1);
      }),
    });
  },
  builderAddBasic: (color) => {
    get().builderAdd(makeBasicLand(color));
  },
  builderSetCommander: (card) => {
    const d = get().builderDeck;
    if (!d) return;
    set({ builderDeck: withBuilder(d, (next) => void (next.commander = card)) });
  },
  builderRename: (name) => {
    const d = get().builderDeck;
    if (!d) return;
    set({ builderDeck: withBuilder(d, (next) => void (next.name = name)) });
  },
  builderSave: () => {
    const { builderDeck, savedDecks } = get();
    if (!builderDeck) return;
    const stamped = { ...builderDeck, updatedAt: new Date().toISOString() };
    const sig = deckSignature(stamped);
    const without = savedDecks.filter((d) => d.id !== stamped.id && deckSignature(d) !== sig);
    const next = [stamped, ...without];
    persistSavedDecks(next);
    set({ savedDecks: next, builderDeck: stamped });
  },
  builderClear: () => set({ builderDeck: null }),

  saveCurrentDeck: () => {
    const { deck, savedDecks } = get();
    if (!deck) return;
    const stamped = { ...deck, updatedAt: new Date().toISOString() };
    const sig = deckSignature(stamped);
    // Replace any existing entry with the same id OR the same content (a
    // regenerated-but-identical deck shouldn't create a second saved copy).
    const without = savedDecks.filter((d) => d.id !== stamped.id && deckSignature(d) !== sig);
    const next = [stamped, ...without];
    persistSavedDecks(next);
    set({ savedDecks: next });
  },
  deleteSavedDeck: (id) => {
    const next = get().savedDecks.filter((d) => d.id !== id);
    persistSavedDecks(next);
    set({ savedDecks: next });
  },
  loadDeck: (id) => {
    const d = get().savedDecks.find((x) => x.id === id);
    if (d) set({ deck: d, diagnostics: diagnose(d), genError: null });
  },

  setFilterText: (text) => set((s) => ({ filters: { ...s.filters, text } })),
  toggleFilterColor: (c) =>
    set((s) => ({
      filters: {
        ...s.filters,
        colors: s.filters.colors.includes(c)
          ? s.filters.colors.filter((x) => x !== c)
          : [...s.filters.colors, c],
      },
    })),
  toggleFilterType: (t) =>
    set((s) => ({
      filters: {
        ...s.filters,
        types: s.filters.types.includes(t)
          ? s.filters.types.filter((x) => x !== t)
          : [...s.filters.types, t],
      },
    })),
  setMaxCmc: (maxCmc) => set((s) => ({ filters: { ...s.filters, maxCmc } })),
  setPreviewCard: (previewCard) => set({ previewCard }),
}));

export { POOL_META };

/** True if a deck with the same content (commander + nonbasic cards) is already saved. */
export function useIsDeckSaved(deck: Deck | null | undefined): boolean {
  const savedSignatures = useStore((s) => s.savedDecks);
  return useMemo(() => {
    if (!deck) return false;
    const sig = deckSignature(deck);
    return savedSignatures.some((d) => deckSignature(d) === sig);
  }, [deck, savedSignatures]);
}

/**
 * The card pool visible for a format: the Standard pool alone, or merged with
 * the lazily-fetched Brawl(100) extras. Kicks off the extra-pool load when a
 * Brawl(100) context first appears.
 */
export function useFormatPool(format: Format): Card[] {
  const extraPool = useStore((s) => s.extraPool);
  const ensureBrawlExtra = useStore((s) => s.ensureBrawlExtra);
  useEffect(() => {
    if (format === 'brawl' && !extraPool) void ensureBrawlExtra();
  }, [format, extraPool, ensureBrawlExtra]);
  return useMemo(
    () => (format === 'brawl' && extraPool ? [...POOL, ...extraPool] : POOL),
    [format, extraPool],
  );
}
