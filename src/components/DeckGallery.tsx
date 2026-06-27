import type { Color } from '../types/card';
import type { RankedDeck } from '../types/deck';
import { useStore } from '../store/useStore';
import { ManaCurve, ColorPie, RarityBreakdown } from './DeckStats';
import { ColorPip } from './common';

function ViabilityMeter({ value }: { value: number }) {
  // Gold meter; hue shifts subtly with strength.
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-wood-900/60 ring-1 ring-gold-700/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-700 to-gold-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-display text-sm font-bold text-gold-300">{value}</span>
    </div>
  );
}

function ResultCard({ r, onOpen }: { r: RankedDeck; onOpen: () => void }) {
  const selectResult = useStore((s) => s.selectResult);
  const selectedDeckId = useStore((s) => s.selectedDeckId);
  const selected = selectedDeckId === r.deck.id;

  const thumbs = r.synergyCards
    .map((name) => r.deck.main.find((e) => e.card.name === name)?.card)
    .filter(Boolean)
    .slice(0, 5);

  return (
    <button
      onClick={() => {
        selectResult(r.deck.id);
        onOpen();
      }}
      className={`panel group flex flex-col gap-2 p-3 text-left transition-transform hover:-translate-y-0.5 ${
        selected ? 'ring-2 ring-gold-400' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-base font-semibold leading-tight text-parchment-100">
            {r.deck.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="rounded bg-gold-800/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-200 ring-1 ring-gold-700/50">
              {r.themeName}
            </span>
            <span className="text-[10px] capitalize text-parchment-400">{r.archetype}</span>
          </div>
        </div>
        <div className="flex gap-0.5">
          {(r.deck.colors as Color[]).map((c) => (
            <span key={c} className="scale-90">
              <ColorPip color={c} />
            </span>
          ))}
        </div>
      </div>

      <ViabilityMeter value={r.viability} />

      <div className="grid grid-cols-2 gap-3">
        <ManaCurve curve={r.diagnostics.curve} />
        <ColorPie pips={r.diagnostics.colorPips as Record<Color, number>} />
      </div>

      <RarityBreakdown rarity={r.diagnostics.rarity} compact />


      {thumbs.length > 0 && (
        <div className="flex gap-1">
          {thumbs.map(
            (c) =>
              c && (
                <img
                  key={c.id}
                  src={c.image ?? ''}
                  alt={c.name}
                  title={c.name}
                  loading="lazy"
                  className="aspect-[5/7] w-1/5 rounded border border-gold-800/60 object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
                />
              ),
          )}
        </div>
      )}
    </button>
  );
}

export function DeckGallery({ onOpen }: { onOpen: () => void }) {
  const results = useStore((s) => s.results);
  const genError = useStore((s) => s.genError);

  if (genError && results.length === 0) {
    return (
      <div className="panel flex h-full items-center justify-center p-6 text-center text-sm text-rose-300">
        {genError}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="panel flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="font-display text-lg text-parchment-200">No decks generated yet</div>
        <p className="max-w-sm text-sm text-parchment-400">
          Pick colors, a format and an archetype filter, then{' '}
          <span className="text-gold-300">Generate Decks</span> to enumerate every viable
          synergy build.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="font-display text-sm text-parchment-200">
          {results.length} viable {results.length === 1 ? 'deck' : 'decks'} — best first
        </div>
        <div className="text-xs text-parchment-400">click a deck to open & edit</div>
      </div>
      <div className="scroll-thin grid flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 lg:grid-cols-2 2xl:grid-cols-3">
        {results.map((r) => (
          <ResultCard key={r.deck.id} r={r} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
