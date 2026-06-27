import type { Color } from '../types/card';
import { COLORS } from '../types/card';
import type { DeckDiagnostics } from '../types/deck';
import { CURVE_BUCKETS } from '../engine/archetypes';
import { COLOR_STYLE } from './common';

export function ManaCurve({ curve }: { curve: Record<string, number> }) {
  const max = Math.max(1, ...CURVE_BUCKETS.map((b) => curve[b] ?? 0));
  return (
    <div>
      <div className="mb-1 text-xs text-parchment-400">Mana curve</div>
      <div className="flex items-end gap-1.5" style={{ height: 64 }}>
        {CURVE_BUCKETS.map((b) => {
          const v = curve[b] ?? 0;
          return (
            <div key={b} className="flex flex-1 flex-col items-center justify-end">
              <span className="text-[10px] text-parchment-400">{v}</span>
              <div
                className="w-full rounded-t bg-gradient-to-t from-gold-700 to-gold-400"
                style={{ height: `${(v / max) * 44}px` }}
              />
              <span className="mt-0.5 text-[10px] text-parchment-500">{b}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ColorPie({ pips }: { pips: Record<Color, number> }) {
  const total = COLORS.reduce((s, c) => s + pips[c], 0) || 1;
  return (
    <div>
      <div className="mb-1 text-xs text-parchment-400">Color requirements (pips)</div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-wood-800 ring-1 ring-gold-800/40">
        {COLORS.map((c) =>
          pips[c] > 0 ? (
            <div
              key={c}
              className={COLOR_STYLE[c].bg}
              style={{ width: `${(pips[c] / total) * 100}%` }}
              title={`${c}: ${pips[c].toFixed(1)}`}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}

const RARITY_STYLE: Record<string, { dot: string; label: string }> = {
  mythic: { dot: 'bg-orange-500', label: 'Mythic' },
  rare: { dot: 'bg-amber-400', label: 'Rare' },
  uncommon: { dot: 'bg-slate-300', label: 'Uncommon' },
  common: { dot: 'bg-zinc-600', label: 'Common' },
};
const RARITY_ORDER = ['mythic', 'rare', 'uncommon', 'common'] as const;

/** Wildcard cost: how many of each rarity the deck needs. */
export function RarityBreakdown({
  rarity,
  compact = false,
}: {
  rarity: Record<string, number>;
  compact?: boolean;
}) {
  return (
    <div>
      {!compact && (
        <div className="mb-1 text-xs text-parchment-400">Rarity (wildcards)</div>
      )}
      <div className={`flex flex-wrap items-center ${compact ? 'gap-x-2.5 gap-y-1' : 'gap-x-3 gap-y-1'}`}>
        {RARITY_ORDER.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-1 text-xs"
            title={RARITY_STYLE[r].label}
          >
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${RARITY_STYLE[r].dot} ring-1 ring-black/40`} />
            {!compact && <span className="text-parchment-400">{RARITY_STYLE[r].label}</span>}
            <span className="font-display text-parchment-100">{rarity[r] ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function RoleBreakdown({ diag }: { diag: DeckDiagnostics }) {
  const rows: [string, number][] = [
    ['Lands', diag.landCount],
    ['Creatures', diag.creatureCount],
    ['Other spells', diag.nonCreatureSpellCount],
    ['Removal', diag.roleBreakdown.removal ?? 0],
    ['Card draw', diag.roleBreakdown.draw ?? 0],
    ['Counters', diag.roleBreakdown.counter ?? 0],
    ['Ramp', diag.roleBreakdown.ramp ?? 0],
    ['Sweepers', diag.roleBreakdown.sweeper ?? 0],
  ];
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
      {rows.map(([label, n]) => (
        <div key={label} className="flex justify-between">
          <span className="text-parchment-400">{label}</span>
          <span className="font-display text-parchment-100">{n}</span>
        </div>
      ))}
    </div>
  );
}
