import { useState } from 'react';
import { useStore } from '../store/useStore';
import { deckToArenaText } from '../io/mtgaExport';
import { parseArenaText } from '../io/mtgaImport';
import { useEscape } from '../lib/useEscape';

export function ExportImportModal({ onClose }: { onClose: () => void }) {
  useEscape(onClose);
  const deck = useStore((s) => s.deck);
  const pool = useStore((s) => s.pool);
  const setDeck = useStore((s) => s.setDeck);

  const [tab, setTab] = useState<'export' | 'import'>(deck ? 'export' : 'import');
  const [importText, setImportText] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const exportText = deck ? deckToArenaText(deck) : '';

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const doDownload = () => {
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(deck?.name ?? 'deck').replace(/[^\w]+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = () => {
    const { deck: imported, warnings: w } = parseArenaText(importText, pool);
    setWarnings(w);
    if (imported.main.length > 0 || imported.commander) {
      setDeck(imported);
      if (w.length === 0) onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-xl bg-wood-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-1">
            {(['export', 'import'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`btn font-display capitalize ${
                  tab === t ? 'bg-gold-600 text-wood-950' : 'bg-wood-800 text-parchment-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-parchment-400 hover:text-gold-300">✕</button>
        </div>

        {tab === 'export' ? (
          <div className="space-y-2">
            {deck ? (
              <>
                <textarea
                  readOnly
                  value={exportText}
                  className="scroll-thin h-64 w-full rounded-md border border-gold-800/60 bg-wood-950 p-2 font-mono text-xs text-parchment-100"
                />
                <div className="flex gap-2">
                  <button onClick={doCopy} className="btn-primary">
                    {copied ? '✓ Copied' : 'Copy for Arena'}
                  </button>
                  <button onClick={doDownload} className="btn-ghost">Download .txt</button>
                </div>
                <p className="font-serif text-[12px] italic text-parchment-400">
                  In MTG Arena: Decks → Import to paste this list.
                </p>
              </>
            ) : (
              <div className="py-8 text-center text-sm text-parchment-500">No deck to export yet.</div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'Deck\n4 Lightning Strike (DMU) 137\n...'}
              className="scroll-thin h-64 w-full rounded-md border border-gold-800/60 bg-wood-950 p-2 font-mono text-xs text-parchment-100 placeholder:text-parchment-500"
            />
            <button onClick={doImport} className="btn-primary">Import deck</button>
            {warnings.length > 0 && (
              <div className="scroll-thin max-h-24 space-y-0.5 overflow-y-auto rounded bg-amber-950/40 p-2 text-[11px] text-amber-300">
                {warnings.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
