import { useMemo } from 'react';
import { canBeCommander } from '../types/card';
import { useStore } from '../store/useStore';
import { ManaCost } from './common';

export function CommanderPicker() {
  const pool = useStore((s) => s.pool);
  const colors = useStore((s) => s.colors);
  const commanderId = useStore((s) => s.commanderId);
  const setCommander = useStore((s) => s.setCommander);

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
      <div className="scroll-thin max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-gold-800/50 bg-wood-950 p-1">
        {eligible.length === 0 && (
          <div className="px-2 py-3 text-center text-xs text-parchment-500">
            No eligible commanders in these colors.
          </div>
        )}
        {eligible.map((c) => (
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
      </div>
    </div>
  );
}
