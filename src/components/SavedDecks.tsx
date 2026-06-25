import { useStore } from '../store/useStore';
import { ColorPip } from './common';
import type { Color } from '../types/card';

export function SavedDecks() {
  const savedDecks = useStore((s) => s.savedDecks);
  const loadDeck = useStore((s) => s.loadDeck);
  const deleteSavedDeck = useStore((s) => s.deleteSavedDeck);

  if (savedDecks.length === 0) {
    return <div className="px-1 py-2 text-xs text-slate-500">No saved decks yet.</div>;
  }

  return (
    <div className="space-y-1">
      {savedDecks.map((d) => (
        <div
          key={d.id}
          className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1.5"
        >
          <button onClick={() => loadDeck(d.id)} className="flex-1 truncate text-left text-sm hover:text-indigo-400">
            {d.name}
          </button>
          <div className="flex gap-0.5">
            {(d.colors as Color[]).map((c) => (
              <span key={c} className="scale-75">
                <ColorPip color={c} />
              </span>
            ))}
          </div>
          <span className="text-[10px] uppercase text-slate-500">{d.format === 'brawl' ? 'BR' : 'ST'}</span>
          <button
            onClick={() => deleteSavedDeck(d.id)}
            className="text-slate-500 hover:text-rose-400"
            title="Delete"
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  );
}
