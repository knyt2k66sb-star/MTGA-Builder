import { create } from 'zustand';
import type { Archetype, Card, Color, Format } from '../types/card';
import type { Deck, DeckDiagnostics, GenParams } from '../types/deck';
import { POOL, POOL_META } from '../data/pool';
import { diagnose, generateDeck } from '../engine/build';
import { loadSavedDecks, persistSavedDecks } from './savedDecks';

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
  archetype: Archetype;
  colors: Color[];
  commanderId: string | null;
  powerBias: number;
  // ---- current deck ----
  deck: Deck | null;
  diagnostics: DeckDiagnostics | null;
  genError: string | null;
  // ---- saved decks ----
  savedDecks: Deck[];
  // ---- browsing ----
  filters: CardFilters;
  previewCard: Card | null;

  setFormat: (f: Format) => void;
  setArchetype: (a: Archetype) => void;
  toggleColor: (c: Color) => void;
  setCommander: (id: string | null) => void;
  setPowerBias: (n: number) => void;
  generate: () => void;
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
  archetype: 'aggro',
  colors: ['R'],
  commanderId: null,
  powerBias: 0.5,
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
    const params: GenParams = {
      format: s.format,
      archetype: s.archetype,
      colors: s.colors,
      commanderId: s.format === 'brawl' ? s.commanderId : null,
      powerBias: s.powerBias,
    };
    try {
      const { deck, diagnostics } = generateDeck(params, s.pool);
      set({ deck, diagnostics, genError: null });
    } catch (err) {
      set({ genError: err instanceof Error ? err.message : String(err) });
    }
  },

  setDeck: (deck) => set({ deck, diagnostics: diagnose(deck), genError: null }),
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
