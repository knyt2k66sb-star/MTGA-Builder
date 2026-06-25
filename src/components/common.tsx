import type { Color } from '../types/card';

export const COLOR_STYLE: Record<Color | 'C', { bg: string; text: string; border: string; label: string }> = {
  W: { bg: 'bg-amber-100', text: 'text-amber-950', border: 'border-amber-300', label: 'W' },
  U: { bg: 'bg-sky-300', text: 'text-sky-950', border: 'border-sky-400', label: 'U' },
  B: { bg: 'bg-zinc-400', text: 'text-zinc-950', border: 'border-zinc-500', label: 'B' },
  R: { bg: 'bg-rose-400', text: 'text-rose-950', border: 'border-rose-500', label: 'R' },
  G: { bg: 'bg-emerald-400', text: 'text-emerald-950', border: 'border-emerald-500', label: 'G' },
  C: { bg: 'bg-slate-500', text: 'text-slate-950', border: 'border-slate-600', label: 'C' },
};

export function ColorPip({
  color,
  active = true,
  onClick,
}: {
  color: Color;
  active?: boolean;
  onClick?: () => void;
}) {
  const s = COLOR_STYLE[color];
  return (
    <button
      type="button"
      onClick={onClick}
      title={color}
      className={`pip ${active ? `${s.bg} ${s.text} ${s.border}` : 'bg-slate-800 text-slate-500 border-slate-700'} ${
        onClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'
      }`}
    >
      {s.label}
    </button>
  );
}

/** Render a mana cost string like "{1}{U}{U}" as colored pips. */
export function ManaCost({ cost }: { cost: string }) {
  const symbols = cost.match(/\{[^}]+\}/g) ?? [];
  return (
    <span className="inline-flex gap-0.5">
      {symbols.map((sym, i) => {
        const inner = sym.slice(1, -1);
        const color = (['W', 'U', 'B', 'R', 'G'] as Color[]).find((c) => inner.includes(c));
        const s = color ? COLOR_STYLE[color] : COLOR_STYLE.C;
        return (
          <span
            key={i}
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}
          >
            {inner}
          </span>
        );
      })}
    </span>
  );
}
