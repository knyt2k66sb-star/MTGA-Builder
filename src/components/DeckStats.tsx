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
