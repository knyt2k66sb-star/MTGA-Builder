import { useMemo } from 'react';
import type { Card, Color } from '../types/card';
import { isCreature, isLand, isPlaneswalker } from '../types/card';
import type { DeckEntry } from '../types/deck';
import { validateDeck } from '../engine';
import { useStore } from '../store/useStore';
import { ManaCost } from './common';
import { ColorPie, ManaCurve, RoleBreakdown } from './DeckStats';

function group(entries: DeckEntry[]): Record<string, DeckEntry[]> {
  const groups: Record<string, DeckEntry[]> = {};
  const put = (k: string, e: DeckEntry) => {
    (groups[k] ??= []).push(e);
  };
  for (const e of entries) {
    const c = e.card;
    if (isLand(c)) put('Lands', e);
    else if (isCreature(c)) put('Creatures', e);
    else if (isPlaneswalker(c)) put('Planeswalkers', e);
    else if (/Instant|Sorcery/.test(c.typeLine)) put('Spells', e);
    else put('Other', e);
  }
  return groups;
}

const GROUP_ORDER = ['Creatures', 'Planeswalkers', 'Spells', 'Other', 'Lands'];

function EntryRow({ entry, onClick }: { entry: DeckEntry; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left font-serif text-[15px] text-ink hover:bg-gold-700/15"
    >
      <span className="w-5 text-right font-display text-sm text-gold-800">{entry.qty}</span>
      <span className="flex-1 truncate">{entry.card.name}</span>
      <ManaCost cost={entry.card.manaCost} />
    </button>
  );
}

export function DeckView() {
  const deck = useStore((s) => s.deck);
  const diagnostics = useStore((s) => s.diagnostics);
  const setPreviewCard = useStore((s) => s.setPreviewCard);
  const saveCurrentDeck = useStore((s) => s.saveCurrentDeck);

  const issues = useMemo(() => (deck ? validateDeck(deck) : []), [deck]);

  if (!deck || !diagnostics) {
    return (
      <div className="panel flex h-full flex-col items-center justify-center p-6 text-center text-sm text-parchment-400">
        <div className="font-display text-lg text-parchment-200">No deck selected</div>
        <p className="mt-1 max-w-sm">
          Open one from the <span className="text-gold-300">Deck Gallery</span>, or
          <span className="mx-1 font-semibold text-gold-300">Generate Decks</span>
          to forge a new spread.
        </p>
      </div>
    );
  }

  const groups = group(deck.main);
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const preview = (c: Card) => setPreviewCard(c);

  return (
    <div className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gold-800/40 p-3">
        <div>
          <div className="font-display text-lg font-semibold text-parchment-100">{deck.name}</div>
          <div className="text-xs text-parchment-400">
            {deck.format === 'brawl' ? 'Standard Brawl' : 'Standard'} · {diagnostics.totalCards} cards
            {deck.seed != null && <> · seed {deck.seed}</>}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={saveCurrentDeck} className="btn-ghost">💾 Save</button>
        </div>
      </div>

      <div className="grid gap-3 border-b border-gold-800/40 p-3 sm:grid-cols-2">
        <ManaCurve curve={diagnostics.curve} />
        <div className="space-y-2">
          <ColorPie pips={diagnostics.colorPips as Record<Color, number>} />
          <RoleBreakdown diag={diagnostics} />
        </div>
      </div>

      {errors.length > 0 ? (
        <div className="space-y-1 border-b border-gold-800/40 p-3 text-xs">
          {errors.map((i, n) => (
            <div key={`e${n}`} className="text-rose-400">✕ {i.message}</div>
          ))}
          {warnings.map((i, n) => (
            <div key={`w${n}`} className="text-amber-400">⚠ {i.message}</div>
          ))}
        </div>
      ) : (
        <div className="border-b border-gold-800/40 p-2 text-center text-xs font-display tracking-wide text-emerald-400">
          ✓ Legal for {deck.format === 'brawl' ? 'Standard Brawl' : 'Standard'}
          {warnings.length > 0 && <span className="text-amber-400"> · {warnings.length} note(s)</span>}
        </div>
      )}

      <div className="scroll-thin m-3 flex-1 overflow-y-auto">
        <div className="parchment p-3">
          {deck.commander && (
            <div className="mb-3">
              <div className="mb-1 font-display text-xs font-semibold uppercase tracking-wider text-gold-700">
                Commander
              </div>
              <EntryRow entry={{ card: deck.commander, qty: 1 }} onClick={() => preview(deck.commander!)} />
            </div>
          )}
          {GROUP_ORDER.filter((g) => groups[g]?.length).map((g) => {
            const entries = groups[g].sort((a, b) => a.card.cmc - b.card.cmc);
            const count = entries.reduce((s, e) => s + e.qty, 0);
            return (
              <div key={g} className="mb-3">
                <div className="mb-1 border-b border-gold-700/30 pb-0.5 font-display text-xs font-semibold uppercase tracking-wider text-gold-800">
                  {g} ({count})
                </div>
                {entries.map((e) => (
                  <EntryRow key={e.card.id} entry={e} onClick={() => preview(e.card)} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
