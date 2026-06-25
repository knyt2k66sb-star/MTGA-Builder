import { useStore } from '../store/useStore';
import { useEscape } from '../lib/useEscape';
import { ManaCost } from './common';

export function CardPreview() {
  const card = useStore((s) => s.previewCard);
  const setPreviewCard = useStore((s) => s.setPreviewCard);
  useEscape(() => setPreviewCard(null));
  if (!card) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onClick={() => setPreviewCard(null)}
    >
      <div className="panel max-w-sm bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
        {card.image && (
          <img src={card.image} alt={card.name} className="mb-3 w-full rounded-lg" />
        )}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{card.name}</h3>
          <ManaCost cost={card.manaCost} />
        </div>
        <div className="text-xs text-slate-400">{card.typeLine}</div>
        <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{card.oracleText}</p>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>
            {card.set} · #{card.collectorNumber} · {card.rarity}
          </span>
          {card.power != null && (
            <span className="font-bold text-slate-300">
              {card.power}/{card.toughness}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
