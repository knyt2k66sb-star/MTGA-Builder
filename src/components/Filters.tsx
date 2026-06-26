import { COLORS } from '../types/card';
import { useStore } from '../store/useStore';
import { ColorPip } from './common';

const TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'];

export function Filters() {
  const filters = useStore((s) => s.filters);
  const setFilterText = useStore((s) => s.setFilterText);
  const toggleFilterColor = useStore((s) => s.toggleFilterColor);
  const toggleFilterType = useStore((s) => s.toggleFilterType);
  const setMaxCmc = useStore((s) => s.setMaxCmc);

  return (
    <div className="panel space-y-3 p-3">
      <input
        value={filters.text}
        onChange={(e) => setFilterText(e.target.value)}
        placeholder="Search name or text…"
        className="w-full rounded-md border border-gold-800/60 bg-wood-950 px-3 py-1.5 font-serif text-sm text-parchment-100 outline-none placeholder:text-parchment-500 focus:border-gold-500"
      />
      <div className="flex items-center gap-1.5">
        {COLORS.map((c) => (
          <ColorPip
            key={c}
            color={c}
            active={filters.colors.includes(c)}
            onClick={() => toggleFilterColor(c)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => toggleFilterType(t)}
            className={`rounded px-2 py-0.5 text-xs ${
              filters.types.includes(t)
                ? 'bg-gold-600 text-wood-950'
                : 'bg-wood-800 text-parchment-300 hover:bg-wood-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-parchment-400">
        Max MV: {filters.maxCmc ?? 'any'}
        <input
          type="range"
          min={0}
          max={8}
          value={filters.maxCmc ?? 8}
          onChange={(e) => {
            const v = Number(e.target.value);
            setMaxCmc(v >= 8 ? null : v);
          }}
          className="flex-1"
        />
      </label>
    </div>
  );
}
