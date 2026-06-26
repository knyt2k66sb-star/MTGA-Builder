import { create } from 'zustand';
import type { Archetype, Card, Color, Format } from '../types/card';
import type { Deck, DeckDiagnostics, MultiGenParams, RankedDeck } from '../types/deck';
import { POOL, POOL_META } from '../data/pool';
import { diagnose, generateDecks } from '../engine/build';
import { loadSavedDecks, persistSavedDecks } from './savedDecks';

export type ArchetypeFilter = Archetype | 'any';

export interface CardFilters {
  text: string;
  colors: Color[];
  types: string[]; // e.g. ['Creature', 'Land']
  maxCmc: number | null;
}

interface AppState {
  pool: Card[];
  // ---- generator parameters ----
  format: Format;
  archetype: ArchetypeFilter;
  colors: Color[];
  commanderId: string | null;
  powerBias: number;
  // ---- generated results ----
  results: RankedDeck[];
  selectedDeckId: string | null;
  generating: boolean;
  // ---- current deck (the selected/opened one) ----
  deck: Deck | null;
  diagnostics: DeckDiagnostics | null;
  genError: string | null;
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
  generate: () => void;
  selectResult: (deckId: string) => void;
  setDeck: (deck: Deck) => void;
  recomputeDiagnostics: () => void;

  saveCurrentDeck: () => void;
  deleteSavedDeck: (id: string) => void;
  loadDeck: (id: string) => void;

  setFilterText: (t: string) => void;
  toggleFilterColor: (c: Color) => void;
  toggleFilterType: (t: string) => void;
  setMaxCmc: (n: number | null) => void;
  setPreviewCard: (c: Card | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  pool: POOL,
  format: 'standard',
  archetype: 'any',
  colors: ['R'],
  commanderId: null,
  powerBias: 0.5,
  results: [],
  selectedDeckId: null,
  generating: false,
  deck: null,
  diagnostics: null,
  genError: null,
  savedDecks: loadSavedDecks(),
  filters: { text: '', colors: [], types: [], maxCmc: null },
  previewCard: null,

  setFormat: (format) => set({ format }),
  setArchetype: (archetype) => set({ archetype }),
  toggleColor: (c) =>
    set((s) => ({
      colors: s.colors.includes(c)
        ? s.colors.filter((x) => x !== c)
        : [...s.colors, c],
    })),
  setCommander: (commanderId) => set({ commanderId }),
  setPowerBias: (powerBias) => set({ powerBias }),

  generate: () => {
    const s = get();
    const params: MultiGenParams = {
      format: s.format,
      archetype: s.archetype,
      colors: s.colors,
      commanderId: s.format === 'brawl' ? s.commanderId : null,
      powerBias: s.powerBias,
    };
    set({ generating: true });
    try {
      const results = generateDecks(params, s.pool);
      if (results.length === 0) {
        set({
          results: [],
          genError:
            'No viable decks found for these parameters. Try different colors or loosen the archetype.',
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

  saveCurrentDeck: () => {
    const { deck, savedDecks } = get();
    if (!deck) return;
    const stamped = { ...deck, updatedAt: new Date().toISOString() };
    const without = savedDecks.filter((d) => d.id !== stamped.id);
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
