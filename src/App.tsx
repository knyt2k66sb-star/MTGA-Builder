import { useState } from 'react';
import { GeneratorPanel } from './components/GeneratorPanel';
import { SavedDecks } from './components/SavedDecks';
import { Filters } from './components/Filters';
import { CardGrid } from './components/CardGrid';
import { DeckView } from './components/DeckView';
import { DeckGallery } from './components/DeckGallery';
import { ExportImportModal } from './components/ExportImportModal';
import { CardPreview } from './components/CardPreview';
import { PoolBadge } from './components/PoolBadge';
import { useStore } from './store/useStore';

type Tab = 'results' | 'deck' | 'browse';

const TAB_LABELS: Record<Tab, string> = {
  results: 'Deck Gallery',
  deck: 'Current Deck',
  browse: 'Browse Cards',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('results');
  const [showIO, setShowIO] = useState(false);
  const resultCount = useStore((s) => s.results.length);

  return (
    <div className="parchment-noise flex h-screen flex-col bg-wood-950 text-parchment-200">
      <header className="flex items-center justify-between border-b-2 border-gold-700/60 bg-wood-900/80 px-4 py-2.5 shadow-lg shadow-black/40">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-wide text-gold-300 drop-shadow">
            MTGA <span className="text-parchment-200">Builder</span>
          </h1>
          <span className="hidden font-serif text-xs italic text-parchment-400 sm:inline">
            Algorithmic Standard &amp; Brawl deck forging
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
        <aside className="scroll-thin w-80 shrink-0 space-y-4 overflow-y-auto border-r-2 border-gold-800/40 bg-wood-900/40 p-3">
          <GeneratorPanel onGenerated={() => setTab('results')} />
          <div>
            <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-gold-300">
              Saved Decks
            </h2>
            <SavedDecks />
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col p-3">
          <div className="mb-3 flex gap-1.5">
            {(['results', 'deck', 'browse'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`btn font-display tracking-wide ${
                  tab === t
                    ? 'bg-gold-600 text-wood-950 shadow ring-1 ring-gold-300'
                    : 'bg-wood-800/70 text-parchment-300 hover:bg-wood-700'
                }`}
              >
                {TAB_LABELS[t]}
                {t === 'results' && resultCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-wood-950/30 px-1.5 text-xs">{resultCount}</span>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1">
            {tab === 'results' && <DeckGallery onOpen={() => setTab('deck')} />}
            {tab === 'deck' && <DeckView />}
            {tab === 'browse' && (
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
