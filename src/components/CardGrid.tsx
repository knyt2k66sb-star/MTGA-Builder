import { useMemo } from 'react';
import type { Card } from '../types/card';
import { isLand } from '../types/card';
import { useStore } from '../store/useStore';
import { CardTile } from './CardTile';

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

  const results = useMemo(() => {
    const text = filters.text.trim().toLowerCase();
    return pool
      .filter((c) => {
        if (text && !c.name.toLowerCase().includes(text) && !c.oracleText.toLowerCase().includes(text)) {
          return false;
        }
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

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 text-xs text-slate-400">{results.length} cards</div>
      <div className="scroll-thin grid grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {results.map((card) => (
          <CardTile key={card.id} card={card} onClick={() => setPreviewCard(card)} />
        ))}
        {results.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-slate-500">
            No cards match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
