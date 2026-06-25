import { ARCHETYPES, COLORS, type Archetype } from '../types/card';
import { ARCHETYPE_PROFILES } from '../engine';
import { useStore } from '../store/useStore';
import { ColorPip } from './common';
import { CommanderPicker } from './CommanderPicker';

export function GeneratorPanel() {
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
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Auto-Build</h2>
        <div className="flex rounded-md border border-slate-700 p-0.5 text-sm">
          {(['standard', 'brawl'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 rounded px-2 py-1 capitalize ${
                format === f ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {f === 'brawl' ? 'Standard Brawl' : 'Standard'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs text-slate-400">
          {format === 'brawl' ? 'Color identity (commander)' : 'Colors'}
        </div>
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <ColorPip key={c} color={c} active={colors.includes(c)} onClick={() => toggleColor(c)} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs text-slate-400">Archetype</div>
        <div className="grid grid-cols-3 gap-1">
          {ARCHETYPES.map((a: Archetype) => (
            <button
              key={a}
              onClick={() => setArchetype(a)}
              title={ARCHETYPE_PROFILES[a].blurb}
              className={`rounded px-2 py-1 text-xs capitalize ${
                archetype === a ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">{ARCHETYPE_PROFILES[archetype].blurb}</p>
      </div>

      {format === 'brawl' && <CommanderPicker />}

      <label className="block text-xs text-slate-400">
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

      <button onClick={generate} className="btn-primary w-full">
        ⚙ Generate Deck
      </button>
      {genError && <div className="rounded bg-rose-900/40 p-2 text-xs text-rose-300">{genError}</div>}
    </div>
  );
}
