import { ARCHETYPES } from '../types/card';
import { COLORS } from '../types/card';
import { ARCHETYPE_PROFILES } from '../engine';
import { useStore, type ArchetypeFilter } from '../store/useStore';
import { ColorPip } from './common';
import { CommanderPicker } from './CommanderPicker';

const ARCHETYPE_OPTIONS: ArchetypeFilter[] = ['any', ...ARCHETYPES];

export function GeneratorPanel({ onGenerated }: { onGenerated?: () => void }) {
  const format = useStore((s) => s.format);
  const archetype = useStore((s) => s.archetype);
  const colors = useStore((s) => s.colors);
  const powerBias = useStore((s) => s.powerBias);
  const genError = useStore((s) => s.genError);
  const setFormat = useStore((s) => s.setFormat);
  const setArchetype = useStore((s) => s.setArchetype);
  const toggleColor = useStore((s) => s.toggleColor);
  const setPowerBias = useStore((s) => s.setPowerBias);
  const generate = useStore((s) => s.generate);

  return (
    <div className="panel space-y-4 p-4">
      <div>
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-gold-300">
          Auto-Build
        </h2>
        <div className="flex rounded-md border border-gold-800/60 p-0.5 text-sm">
          {(['standard', 'brawl'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 rounded px-2 py-1 font-display capitalize ${
                format === f ? 'bg-gold-600 text-wood-950' : 'text-parchment-300 hover:bg-wood-800'
              }`}
            >
              {f === 'brawl' ? 'Standard Brawl' : 'Standard'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs text-parchment-400">
          {format === 'brawl' ? 'Color identity (commander)' : 'Colors'}
        </div>
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <ColorPip key={c} color={c} active={colors.includes(c)} onClick={() => toggleColor(c)} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs text-parchment-400">Archetype filter</div>
        <div className="grid grid-cols-3 gap-1">
          {ARCHETYPE_OPTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setArchetype(a)}
              title={a === 'any' ? 'Explore every archetype' : ARCHETYPE_PROFILES[a].blurb}
              className={`rounded px-2 py-1 text-xs capitalize ${
                archetype === a ? 'bg-gold-600 text-wood-950' : 'bg-wood-800 text-parchment-300 hover:bg-wood-700'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <p className="mt-1 font-serif text-[12px] italic leading-snug text-parchment-400">
          {archetype === 'any'
            ? 'Explore every archetype — generates the full spread of viable decks.'
            : ARCHETYPE_PROFILES[archetype].blurb}
        </p>
      </div>

      {format === 'brawl' && <CommanderPicker />}

      <label className="block text-xs text-parchment-400">
        Power bias (quality vs. archetype): {powerBias.toFixed(2)}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={powerBias}
          onChange={(e) => setPowerBias(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>

      <button
        onClick={() => {
          generate();
          onGenerated?.();
        }}
        className="btn-primary w-full"
      >
        ⚙ Generate Decks
      </button>
      {genError && (
        <div className="rounded border border-rose-800/50 bg-rose-950/40 p-2 text-xs text-rose-300">
          {genError}
        </div>
      )}
    </div>
  );
}
