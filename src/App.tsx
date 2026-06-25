import { useState } from 'react';
import { GeneratorPanel } from './components/GeneratorPanel';
import { SavedDecks } from './components/SavedDecks';
import { Filters } from './components/Filters';
import { CardGrid } from './components/CardGrid';
import { DeckView } from './components/DeckView';
import { ExportImportModal } from './components/ExportImportModal';
import { CardPreview } from './components/CardPreview';
import { PoolBadge } from './components/PoolBadge';

type Tab = 'browse' | 'deck';

export default function App() {
  const [tab, setTab] = useState<Tab>('deck');
  const [showIO, setShowIO] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-indigo-400">MTGA</span> Builder
          </h1>
          <span className="hidden text-xs text-slate-500 sm:inline">
            Algorithmic Standard &amp; Brawl deck generation
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowIO(true)} className="btn-ghost">
            ↔ Import / Export
          </button>
          <PoolBadge />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="scroll-thin w-80 shrink-0 space-y-4 overflow-y-auto border-r border-slate-800 p-3">
          <GeneratorPanel />
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-200">Saved Decks</h2>
            <SavedDecks />
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col p-3">
          <div className="mb-3 flex gap-1">
            {(['deck', 'browse'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`btn capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                {t === 'deck' ? 'Current Deck' : 'Browse Cards'}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1">
            {tab === 'deck' ? (
              <DeckView />
            ) : (
              <div className="flex h-full flex-col gap-3">
                <Filters />
                <div className="min-h-0 flex-1">
                  <CardGrid />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {showIO && <ExportImportModal onClose={() => setShowIO(false)} />}
      <CardPreview />
    </div>
  );
}
