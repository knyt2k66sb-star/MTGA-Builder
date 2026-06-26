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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const resultCount = useStore((s) => s.results.length);

  const afterGenerate = () => {
    setTab('results');
    setSidebarOpen(false); // collapse the drawer on mobile after generating
  };

  return (
    <div className="parchment-noise flex h-[100dvh] flex-col bg-wood-950 text-parchment-200">
      <header className="z-20 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b-2 border-gold-700/60 bg-wood-900/80 px-3 py-2 shadow-lg shadow-black/40 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="btn-ghost px-2 py-1 lg:hidden"
            aria-label="Toggle controls"
          >
            ☰
          </button>
          <h1 className="font-display text-xl font-bold tracking-wide text-gold-300 drop-shadow sm:text-2xl">
            MTGA <span className="text-parchment-200">Builder</span>
          </h1>
          <span className="hidden font-serif text-xs italic text-parchment-400 lg:inline">
            Algorithmic Standard &amp; Brawl deck forging
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => setShowIO(true)} className="btn-ghost whitespace-nowrap">
            <span className="sm:hidden">↔</span>
            <span className="hidden sm:inline">↔ Import / Export</span>
          </button>
          <div className="hidden sm:block">
            <PoolBadge />
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Backdrop for the mobile drawer */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — static on desktop, slide-in drawer on mobile */}
        <aside
          className={`scroll-thin fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw] transform space-y-4 overflow-y-auto border-r-2 border-gold-800/40 bg-wood-900 p-3 shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:bg-wood-900/40 lg:shadow-none ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="flex items-center justify-between lg:hidden">
            <PoolBadge />
            <button onClick={() => setSidebarOpen(false)} className="text-parchment-400 hover:text-gold-300">
              ✕
            </button>
          </div>
          <GeneratorPanel onGenerated={afterGenerate} />
          <div>
            <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-gold-300">
              Saved Decks
            </h2>
            <SavedDecks />
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col p-2 sm:p-3">
          <div className="mb-3 flex flex-wrap gap-1.5">
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
