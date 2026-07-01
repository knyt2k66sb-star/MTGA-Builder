import { useMemo } from 'react';
import type { Color } from '../types/card';
import { diagnose } from '../engine';
import { useStore } from '../store/useStore';
import { ColorPip } from './common';
import { RarityBreakdown } from './DeckStats';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function SavedDecks() {
  const savedDecks = useStore((s) => s.savedDecks);
  const currentDeckId = useStore((s) => s.deck?.id);
  const loadDeck = useStore((s) => s.loadDeck);
  const deleteSavedDeck = useStore((s) => s.deleteSavedDeck);

  // Most recently saved/updated first, regardless of store insertion order.
  const sorted = useMemo(
    () => savedDecks.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [savedDecks],
  );

  if (sorted.length === 0) {
    return (
      <div className="px-1 py-2 font-serif text-xs italic text-parchment-500">
        No saved decks yet — generate one and hit Save.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {sorted.map((d) => {
        const isOpen = d.id === currentDeckId;
        const diag = diagnose(d);
        return (
          <div
            key={d.id}
            className={`rounded-md border px-2 py-1.5 transition-colors ${
              isOpen
                ? 'border-gold-400 bg-gold-600/15 ring-1 ring-gold-400/60'
                : 'border-gold-800/40 bg-wood-900/70 hover:border-gold-700/70'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => loadDeck(d.id)}
                className="flex min-w-0 flex-1 items-center gap-1 text-left"
                title={d.name}
              >
                {isOpen && <span className="shrink-0 text-gold-300">●</span>}
                <span className="truncate font-serif text-sm text-parchment-100 hover:text-gold-300">
                  {d.name}
                </span>
              </button>
              <div className="flex shrink-0 gap-0.5">
                {(d.colors as Color[]).map((c) => (
                  <span key={c} className="scale-75">
                    <ColorPip color={c} />
                  </span>
                ))}
              </div>
              <span className="shrink-0 rounded bg-wood-800 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-wide text-parchment-300 ring-1 ring-gold-800/40">
                {d.format === 'brawl' ? 'Brawl' : 'Std'}
              </span>
              <button
                onClick={() => deleteSavedDeck(d.id)}
                className="shrink-0 text-parchment-500 hover:text-rose-400"
                title="Delete"
              >
                🗑
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <RarityBreakdown rarity={diag.rarity} compact />
              <span className="shrink-0 font-serif text-[10px] text-parchment-500">{timeAgo(d.updatedAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
