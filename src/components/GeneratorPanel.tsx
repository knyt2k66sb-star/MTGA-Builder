import { useMemo, useState } from 'react';
import { ARCHETYPES, COLORS, FORMAT_LABELS, isCommanderFormat, type Format } from '../types/card';
import { ARCHETYPE_PROFILES, viableThemes } from '../engine';
import { MAX_RESULTS_LIMIT } from '../engine/build';
import { PRESETS } from '../lib/presets';
import { useFormatPool, useStore, type ArchetypeFilter } from '../store/useStore';
import { ColorPip } from './common';
import { CommanderPicker } from './CommanderPicker';

const ARCHETYPE_OPTIONS: ArchetypeFilter[] = ['any', ...ARCHETYPES];
const FORMATS: Format[] = ['standard', 'standardbrawl', 'brawl'];

/** Numeric cap input: blank = unlimited. */
function CapInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (n: number | null) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-parchment-400">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        max={99}
        value={value ?? ''}
        placeholder="∞"
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
        className="w-14 rounded border border-gold-800/60 bg-wood-950 px-1.5 py-0.5 text-center text-parchment-100 outline-none placeholder:text-parchment-600 focus:border-gold-500"
      />
    </label>
  );
}

export function GeneratorPanel({ onGenerated }: { onGenerated?: () => void }) {
  const format = useStore((s) => s.format);
  const archetype = useStore((s) => s.archetype);
  const colors = useStore((s) => s.colors);
  const powerBias = useStore((s) => s.powerBias);
  const deckCount = useStore((s) => s.deckCount);
  const rarityCaps = useStore((s) => s.rarityCaps);
  const maxCmc = useStore((s) => s.maxCmc);
  const landCountOverride = useStore((s) => s.landCountOverride);
  const themeFilter = useStore((s) => s.themeFilter);
  const generating = useStore((s) => s.generating);
  const genError = useStore((s) => s.genError);
  const setFormat = useStore((s) => s.setFormat);
  const setArchetype = useStore((s) => s.setArchetype);
  const toggleColor = useStore((s) => s.toggleColor);
  const setPowerBias = useStore((s) => s.setPowerBias);
  const setDeckCount = useStore((s) => s.setDeckCount);
  const setRarityCap = useStore((s) => s.setRarityCap);
  const setMaxCmcParam = useStore((s) => s.setMaxCmcParam);
  const setLandCountOverride = useStore((s) => s.setLandCountOverride);
  const setThemeFilter = useStore((s) => s.setThemeFilter);
  const applyPreset = useStore((s) => s.applyPreset);
  const generate = useStore((s) => s.generate);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('balanced');

  const pool = useFormatPool(format);
  const singleton = isCommanderFormat(format);

  // Theme options are only computed while the advanced panel is open — the
  // detection sweep over the pool is too heavy to run on every color toggle.
  const themeOptions = useMemo(() => {
    if (!showAdvanced) return [];
    const colorPool = pool.filter((c) =>
      singleton
        ? c.colorIdentity.every((ci) => colors.includes(ci))
        : c.colors.every((ci) => colors.includes(ci)),
    );
    return viableThemes(colorPool).map((t) => ({ id: t.id, name: t.name }));
  }, [showAdvanced, pool, singleton, colors]);

  const restrictionsActive =
    rarityCaps.mythic != null ||
    rarityCaps.rare != null ||
    rarityCaps.uncommon != null ||
    maxCmc != null ||
    landCountOverride != null ||
    themeFilter !== 'any';

  return (
    <div className="panel space-y-4 p-4">
      <div>
        <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-gold-300">
          Auto-Build
        </h2>
        <div className="flex rounded-md border border-gold-800/60 p-0.5 text-xs">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 rounded px-1.5 py-1 font-display leading-tight ${
                format === f ? 'bg-gold-600 text-wood-950' : 'text-parchment-300 hover:bg-wood-800'
              }`}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
        {format === 'brawl' && (
          <p className="mt-1 font-serif text-[11px] italic leading-snug text-parchment-400">
            100-card singleton from the full Arena pool (competitive Brawl ban list).
          </p>
        )}
      </div>

      {/* Presets */}
      <div>
        <div className="mb-1 text-xs text-parchment-400">Presets</div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                applyPreset(p.patch);
                setActivePreset(p.id);
              }}
              title={p.blurb}
              className={`rounded px-1.5 py-0.5 text-[11px] ${
                activePreset === p.id
                  ? 'bg-gold-600 text-wood-950'
                  : 'bg-wood-800 text-parchment-300 hover:bg-wood-700'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs text-parchment-400">
          {singleton ? 'Color identity (commander)' : 'Colors'}
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
      </div>

      {singleton && <CommanderPicker />}

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

      <label className="block text-xs text-parchment-400">
        Decks to generate: <span className="font-display text-gold-300">{deckCount}</span>
        <input
          type="range"
          min={10}
          max={MAX_RESULTS_LIMIT}
          step={10}
          value={deckCount}
          onChange={(e) => setDeckCount(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>

      {/* Advanced fine-tuning */}
      <div className="rounded-md border border-gold-800/40">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-2 py-1.5 font-display text-xs uppercase tracking-wider text-gold-300"
        >
          <span>
            Advanced {restrictionsActive && <span className="text-amber-400">● active</span>}
          </span>
          <span>{showAdvanced ? '▾' : '▸'}</span>
        </button>
        {showAdvanced && (
          <div className="space-y-2 border-t border-gold-800/40 p-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-parchment-500">
              Rarity limits (wildcards)
            </div>
            <CapInput label="Max mythics" value={rarityCaps.mythic} onChange={(n) => setRarityCap('mythic', n)} />
            <CapInput label="Max rares" value={rarityCaps.rare} onChange={(n) => setRarityCap('rare', n)} />
            <CapInput
              label="Max uncommons"
              value={rarityCaps.uncommon}
              onChange={(n) => setRarityCap('uncommon', n)}
            />
            <div className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-parchment-500">
              Deck shape
            </div>
            <label className="flex items-center justify-between gap-2 text-xs text-parchment-400">
              <span>Max mana value</span>
              <input
                type="number"
                min={1}
                max={16}
                value={maxCmc ?? ''}
                placeholder="∞"
                onChange={(e) => setMaxCmcParam(e.target.value === '' ? null : Number(e.target.value))}
                className="w-14 rounded border border-gold-800/60 bg-wood-950 px-1.5 py-0.5 text-center text-parchment-100 outline-none placeholder:text-parchment-600 focus:border-gold-500"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-parchment-400">
              <span>Lands (blank = auto)</span>
              <input
                type="number"
                min={10}
                max={60}
                value={landCountOverride ?? ''}
                placeholder="auto"
                onChange={(e) =>
                  setLandCountOverride(e.target.value === '' ? null : Number(e.target.value))
                }
                className="w-14 rounded border border-gold-800/60 bg-wood-950 px-1.5 py-0.5 text-center text-parchment-100 outline-none placeholder:text-parchment-600 focus:border-gold-500"
              />
            </label>
            <label className="block text-xs text-parchment-400">
              Theme focus
              <select
                value={themeFilter}
                onChange={(e) => setThemeFilter(e.target.value)}
                className="mt-1 w-full rounded border border-gold-800/60 bg-wood-950 px-1.5 py-1 text-parchment-100 outline-none focus:border-gold-500"
              >
                <option value="any">Any viable theme</option>
                {themeOptions
                  .filter((t) => t.id !== 'goodstuff')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        )}
      </div>

      <button
        onClick={async () => {
          await generate();
          onGenerated?.();
        }}
        disabled={generating}
        className={`btn-primary w-full ${generating ? 'cursor-wait opacity-70' : ''}`}
      >
        {generating ? '⏳ Forging decks…' : '⚙ Generate Decks'}
      </button>
      {genError && (
        <div className="rounded border border-rose-800/50 bg-rose-950/40 p-2 text-xs text-rose-300">
          {genError}
        </div>
      )}
    </div>
  );
}
