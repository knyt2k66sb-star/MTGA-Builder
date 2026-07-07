import { useEffect, useMemo, useState } from 'react';
import type { Card } from '../types/card';
import { isLand } from '../types/card';
import { matchesCardText } from '../lib/search';
import { useStore } from '../store/useStore';
import { CardTile } from './CardTile';

// Render at most this many tiles at once. The full Standard pool is ~4.7k
// cards; rendering them all (and their images) at once is slow on mobile and
// can rate-limit the image host. Users narrow with the filters / "show more".
const PAGE_SIZE = 60;

function matchesType(card: Card, types: string[]): boolean {
  if (types.length === 0) return true;
  return types.some((t) => {
    if (t === 'Land') return isLand(card);
    return new RegExp(`\\b${t}\\b`).test(card.typeLine);
  });
}

export function CardGrid() {
  const pool = useStore((s) => s.pool);
  const filters = useStore((s) => s.filters);
  const setPreviewCard = useStore((s) => s.setPreviewCard);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Collapse back to the first page whenever the filters change.
  useEffect(() => setLimit(PAGE_SIZE), [filters]);

  const results = useMemo(() => {
    const text = filters.text.trim();
    return pool
      .filter((c) => {
        if (text && !matchesCardText(c, text)) return false;
        if (filters.colors.length > 0) {
          // Card must contain at least one selected color (or be colorless if none chosen).
          const hit = filters.colors.some((col) => c.colors.includes(col));
          if (!hit) return false;
        }
        if (!matchesType(c, filters.types)) return false;
        if (filters.maxCmc != null && c.cmc > filters.maxCmc) return false;
        return true;
      })
      .sort((a, b) => (a.edhrecRank ?? 1e9) - (b.edhrecRank ?? 1e9));
  }, [pool, filters]);

  // Reset the visible window whenever the filtered set changes.
  const shown = results.slice(0, limit);
  const hasMore = results.length > shown.length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 font-display text-xs uppercase tracking-wider text-parchment-400">
        {results.length} cards{hasMore ? ` · showing ${shown.length}` : ''}
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((card) => (
            <CardTile key={card.id} card={card} onClick={() => setPreviewCard(card)} />
          ))}
          {results.length === 0 && (
            <div className="col-span-full py-8 text-center text-sm text-parchment-500">
              No cards match the current filters.
            </div>
          )}
        </div>
        {hasMore && (
          <div className="py-4 text-center">
            <button
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className="btn-ghost"
            >
              Show more ({results.length - shown.length} left)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
