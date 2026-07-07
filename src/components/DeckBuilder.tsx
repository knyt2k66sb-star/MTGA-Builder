import { useEffect, useMemo, useState } from 'react';
import type { Card, Color, Format } from '../types/card';
import {
  COLORS,
  FORMAT_LABELS,
  FORMAT_TOTALS,
  canBeCommander,
  isCommanderFormat,
  isFormatLegal,
  isLand,
} from '../types/card';
import { validateDeck } from '../engine';
import { deckToArenaText } from '../io/mtgaExport';
import { matchesCardText } from '../lib/search';
import { useFormatPool, useStore } from '../store/useStore';
import { ColorPip, ManaCost } from './common';
import { RarityBreakdown } from './DeckStats';

const TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'];
const PAGE_SIZE = 40;
const FORMATS: Format[] = ['standard', 'standardbrawl', 'brawl'];

function matchesType(card: Card, types: string[]): boolean {
  if (types.length === 0) return true;
  return types.some((t) => (t === 'Land' ? isLand(card) : new RegExp(`\\b${t}\\b`).test(card.typeLine)));
}

/** Start screen: pick a format for the new deck. */
function StartScreen() {
  const builderNew = useStore((s) => s.builderNew);
  return (
    <div className="panel flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="font-display text-xl text-parchment-100">Forge your own deck</div>
      <p className="max-w-md font-serif text-sm text-parchment-400">
        Pick a format to browse every playable card, search by name, type or rules text,
        and build the list card by card.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {FORMATS.map((f) => (
          <button key={f} onClick={() => builderNew(f)} className="btn-primary">
            {FORMAT_LABELS[f]} · {FORMAT_TOTALS[f]} cards
          </button>
        ))}
      </div>
    </div>
  );
}

function CardRow({
  card,
  qty,
  singleton,
  onAdd,
  onPreview,
  onCommander,
}: {
  card: Card;
  qty: number;
  singleton: boolean;
  onAdd: () => void;
  onPreview: () => void;
  onCommander?: () => void;
}) {
  const limit = /\bBasic\b/.test(card.typeLine) ? Infinity : singleton ? 1 : 4;
  const maxed = qty >= limit;
  return (
    <div className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-wood-800/70">
      <button onClick={onPreview} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="truncate font-serif text-sm text-parchment-100">{card.name}</span>
        <span className="hidden shrink-0 text-[10px] italic text-parchment-500 sm:inline">
          {card.typeLine.split('—')[0].trim()}
        </span>
      </button>
      <ManaCost cost={card.manaCost} />
      {onCommander && (
        <button
          onClick={onCommander}
          title="Set as commander"
          className="shrink-0 rounded px-1 text-sm text-gold-400 hover:bg-gold-700/30"
        >
          ★
        </button>
      )}
      <button
        onClick={onAdd}
        disabled={maxed}
        className={`w-7 shrink-0 rounded font-display text-sm font-bold ${
          maxed
            ? 'cursor-not-allowed text-parchment-600'
            : 'bg-gold-600 text-wood-950 hover:brightness-110'
        }`}
        title={maxed ? 'Copy limit reached' : 'Add to deck'}
      >
        {qty > 0 ? `${qty}` : '+'}
      </button>
    </div>
  );
}

export function DeckBuilder() {
  const builderDeck = useStore((s) => s.builderDeck);
  const builderAdd = useStore((s) => s.builderAdd);
  const builderRemove = useStore((s) => s.builderRemove);
  const builderAddBasic = useStore((s) => s.builderAddBasic);
  const builderSetCommander = useStore((s) => s.builderSetCommander);
  const builderRename = useStore((s) => s.builderRename);
  const builderSave = useStore((s) => s.builderSave);
  const builderClear = useStore((s) => s.builderClear);
  const setPreviewCard = useStore((s) => s.setPreviewCard);
  const savedDecks = useStore((s) => s.savedDecks);

  const format = builderDeck?.format ?? 'standard';
  const pool = useFormatPool(format);
  const singleton = isCommanderFormat(format);

  // Local browsing filters, independent from the Browse tab.
  const [query, setQuery] = useState('');
  const [colorSel, setColorSel] = useState<Color[]>([]);
  const [typeSel, setTypeSel] = useState<string[]>([]);
  const [maxCmc, setMaxCmc] = useState<number | null>(null);
  const [identityOnly, setIdentityOnly] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [copied, setCopied] = useState(false);
  useEffect(() => setLimit(PAGE_SIZE), [query, colorSel, typeSel, maxCmc, identityOnly, format]);

  const qtyByOracle = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of builderDeck?.main ?? []) m.set(e.card.oracleId, e.qty);
    return m;
  }, [builderDeck]);

  const results = useMemo(() => {
    if (!builderDeck) return [];
    const commanderIdentity = builderDeck.commander
      ? new Set(builderDeck.commander.colorIdentity)
      : null;
    return pool
      .filter((c) => isFormatLegal(c, format))
      .filter((c) => matchesCardText(c, query))
      .filter((c) => (colorSel.length === 0 ? true : colorSel.some((col) => c.colors.includes(col))))
      .filter((c) => matchesType(c, typeSel))
      .filter((c) => (maxCmc == null ? true : c.cmc <= maxCmc))
      .filter((c) =>
        singleton && identityOnly && commanderIdentity
          ? c.colorIdentity.every((ci) => commanderIdentity.has(ci))
          : true,
      )
      .sort((a, b) => (a.edhrecRank ?? 1e9) - (b.edhrecRank ?? 1e9));
  }, [builderDeck, pool, format, query, colorSel, typeSel, maxCmc, singleton, identityOnly]);

  if (!builderDeck) return <StartScreen />;

  const total =
    builderDeck.main.reduce((s, e) => s + e.qty, 0) + (builderDeck.commander ? 1 : 0);
  const target = FORMAT_TOTALS[format];
  const issues = validateDeck(builderDeck);
  const errors = issues.filter((i) => i.level === 'error');
  const isSavedAlready = savedDecks.some((d) => d.id === builderDeck.id);

  const rarity: Record<string, number> = { mythic: 0, rare: 0, uncommon: 0, common: 0 };
  for (const e of builderDeck.main) {
    if (/\bBasic\b/.test(e.card.typeLine)) continue;
    const r = ['mythic', 'rare', 'uncommon', 'common'].includes(e.card.rarity) ? e.card.rarity : 'rare';
    rarity[r] += e.qty;
  }

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(deckToArenaText(builderDeck));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const shown = results.slice(0, limit);

  return (
    <div className="flex h-full flex-col gap-3 lg:flex-row">
      {/* ---- Card browser ---- */}
      <div className="panel flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-display text-xs uppercase tracking-wider text-gold-300">
            {FORMAT_LABELS[format]} pool · {results.length} playable cards
          </span>
          <button onClick={builderClear} className="text-xs text-parchment-500 hover:text-rose-400">
            ✕ discard draft
          </button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, type or rules text (words in any order)…"
          className="mb-2 w-full rounded-md border border-gold-800/60 bg-wood-950 px-3 py-1.5 font-serif text-sm text-parchment-100 outline-none placeholder:text-parchment-500 focus:border-gold-500"
        />
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <ColorPip
                key={c}
                color={c}
                active={colorSel.includes(c)}
                onClick={() =>
                  setColorSel((sel) => (sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c]))
                }
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() =>
                  setTypeSel((sel) => (sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t]))
                }
                className={`rounded px-1.5 py-0.5 text-[11px] ${
                  typeSel.includes(t)
                    ? 'bg-gold-600 text-wood-950'
                    : 'bg-wood-800 text-parchment-300 hover:bg-wood-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-parchment-400">
            Max MV {maxCmc ?? '∞'}
            <input
              type="range"
              min={0}
              max={8}
              value={maxCmc ?? 8}
              onChange={(e) => setMaxCmc(Number(e.target.value) >= 8 ? null : Number(e.target.value))}
            />
          </label>
          {singleton && builderDeck.commander && (
            <label className="flex items-center gap-1 text-[11px] text-parchment-400">
              <input
                type="checkbox"
                checked={identityOnly}
                onChange={(e) => setIdentityOnly(e.target.checked)}
              />
              commander identity only
            </label>
          )}
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto rounded border border-gold-800/40 bg-wood-950/60 p-1">
          {shown.map((c) => (
            <CardRow
              key={c.id}
              card={c}
              qty={qtyByOracle.get(c.oracleId) ?? 0}
              singleton={singleton}
              onAdd={() => builderAdd(c)}
              onPreview={() => setPreviewCard(c)}
              onCommander={
                singleton && canBeCommander(c) && isFormatLegal(c, format)
                  ? () => builderSetCommander(c)
                  : undefined
              }
            />
          ))}
          {results.length > shown.length && (
            <div className="py-2 text-center">
              <button onClick={() => setLimit((n) => n + PAGE_SIZE)} className="btn-ghost text-xs">
                Show more ({results.length - shown.length} left)
              </button>
            </div>
          )}
          {results.length === 0 && (
            <div className="py-8 text-center font-serif text-sm italic text-parchment-500">
              No cards match your search.
            </div>
          )}
        </div>
      </div>

      {/* ---- The deck under construction ---- */}
      <div className="panel flex min-h-0 w-full flex-col p-3 lg:w-96">
        <div className="mb-2 flex items-center gap-2">
          <input
            value={builderDeck.name}
            onChange={(e) => builderRename(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-gold-800/60 bg-wood-950 px-2 py-1 font-display text-sm text-parchment-100 outline-none focus:border-gold-500"
          />
          <span
            className={`shrink-0 font-display text-sm font-bold ${
              total === target ? 'text-emerald-400' : 'text-gold-300'
            }`}
          >
            {total}/{target}
          </span>
        </div>

        {singleton && (
          <div className="mb-2 rounded border border-gold-800/50 bg-wood-950/60 px-2 py-1.5 text-xs">
            <span className="font-display uppercase tracking-wide text-gold-400">Commander: </span>
            {builderDeck.commander ? (
              <span className="text-parchment-100">
                {builderDeck.commander.name}{' '}
                <button
                  onClick={() => builderSetCommander(null)}
                  className="ml-1 text-parchment-500 hover:text-rose-400"
                >
                  ✕
                </button>
              </span>
            ) : (
              <span className="italic text-parchment-500">tap ★ on a legend to set one</span>
            )}
          </div>
        )}

        <div className="mb-2 flex items-center gap-1.5 text-xs text-parchment-400">
          <span>Basics:</span>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => builderAddBasic(c)}
              className="scale-90 rounded-full ring-1 ring-gold-800/50 transition-transform hover:scale-100"
              title={`Add basic ${c}`}
            >
              <ColorPip color={c} />
            </button>
          ))}
        </div>

        <RarityBreakdown rarity={rarity} compact />

        <div className="scroll-thin my-2 min-h-0 flex-1 overflow-y-auto">
          <div className="parchment p-2">
            {builderDeck.main.length === 0 && (
              <div className="py-6 text-center font-serif text-sm italic text-ink/60">
                Add cards from the left to begin.
              </div>
            )}
            {builderDeck.main
              .slice()
              .sort((a, b) => a.card.cmc - b.card.cmc || a.card.name.localeCompare(b.card.name))
              .map((e) => (
                <div key={e.card.oracleId} className="flex items-center gap-1.5 px-1 py-0.5">
                  <button
                    onClick={() => builderRemove(e.card.oracleId)}
                    className="w-5 shrink-0 rounded bg-wood-800/20 font-display text-sm text-ink hover:bg-rose-200"
                    title="Remove one"
                  >
                    −
                  </button>
                  <span className="w-4 text-right font-display text-sm text-gold-800">{e.qty}</span>
                  <button
                    onClick={() => setPreviewCard(e.card)}
                    className="min-w-0 flex-1 truncate text-left font-serif text-sm text-ink hover:text-gold-800"
                  >
                    {e.card.name}
                  </button>
                  <ManaCost cost={e.card.manaCost} />
                </div>
              ))}
          </div>
        </div>

        {errors.length > 0 ? (
          <div className="scroll-thin mb-2 max-h-20 space-y-0.5 overflow-y-auto text-[11px] text-rose-400">
            {errors.slice(0, 4).map((i, n) => (
              <div key={n}>✕ {i.message}</div>
            ))}
            {errors.length > 4 && <div>…and {errors.length - 4} more</div>}
          </div>
        ) : (
          <div className="mb-2 text-center font-display text-xs tracking-wide text-emerald-400">
            ✓ Legal for {FORMAT_LABELS[format]}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={builderSave} className="btn-primary flex-1">
            {isSavedAlready ? '✓ Update saved deck' : '💾 Save deck'}
          </button>
          <button onClick={copyExport} className="btn-ghost">
            {copied ? '✓ Copied' : 'Copy for Arena'}
          </button>
        </div>
      </div>
    </div>
  );
}
