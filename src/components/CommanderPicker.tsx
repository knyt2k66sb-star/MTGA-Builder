import { useMemo, useState } from 'react';
import { canBeCommander } from '../types/card';
import { useStore } from '../store/useStore';
import { ManaCost } from './common';

// Cap how many commander buttons render at once (the eligible list can be huge,
// especially with no colors selected). The search box narrows it down.
const RENDER_CAP = 60;

export function CommanderPicker() {
  const pool = useStore((s) => s.pool);
  const colors = useStore((s) => s.colors);
  const commanderId = useStore((s) => s.commanderId);
  const setCommander = useStore((s) => s.setCommander);
  const [query, setQuery] = useState('');

  const eligible = useMemo(() => {
    const wanted = new Set(colors);
    return pool
      .filter((c) => c.legalBrawl && canBeCommander(c))
      .filter((c) =>
        wanted.size === 0
          ? true
          : c.colorIdentity.length > 0 && c.colorIdentity.every((ci) => wanted.has(ci)),
      )
      .sort((a, b) => (a.edhrecRank ?? 1e9) - (b.edhrecRank ?? 1e9));
  }, [pool, colors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(
      (c) => c.name.toLowerCase().includes(q) || c.typeLine.toLowerCase().includes(q),
    );
  }, [eligible, query]);

  const shown = filtered.slice(0, RENDER_CAP);
  const selected = commanderId ? eligible.find((c) => c.oracleId === commanderId) : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-parchment-400">
        <span>Commander {commanderId ? '' : '(auto-pick if none)'}</span>
        {commanderId && (
          <button onClick={() => setCommander(null)} className="text-gold-300 hover:underline">
            clear
          </button>
        )}
      </div>

      {selected && (
        <div className="flex items-center justify-between gap-2 rounded border border-gold-500/60 bg-gold-600/20 px-2 py-1 text-xs text-parchment-100">
          <span className="truncate">★ {selected.name}</span>
          <ManaCost cost={selected.manaCost} />
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search commanders…"
        className="w-full rounded-md border border-gold-800/60 bg-wood-950 px-2 py-1 text-xs text-parchment-100 outline-none placeholder:text-parchment-500 focus:border-gold-500"
      />

      <div className="scroll-thin max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-gold-800/50 bg-wood-950 p-1">
        {filtered.length === 0 && (
          <div className="px-2 py-3 text-center text-xs text-parchment-500">
            {eligible.length === 0
              ? 'No eligible commanders in these colors.'
              : 'No commanders match your search.'}
          </div>
        )}
        {shown.map((c) => (
          <button
            key={c.oracleId}
            onClick={() => setCommander(c.oracleId)}
            className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs ${
              commanderId === c.oracleId ? 'bg-gold-600 text-wood-950' : 'hover:bg-wood-800'
            }`}
          >
            <span className="truncate">{c.name}</span>
            <ManaCost cost={c.manaCost} />
          </button>
        ))}
        {filtered.length > shown.length && (
          <div className="px-2 py-1 text-center text-[10px] text-parchment-500">
            +{filtered.length - shown.length} more — keep typing to narrow
          </div>
        )}
      </div>
    </div>
  );
}
