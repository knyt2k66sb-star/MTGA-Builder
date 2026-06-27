import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useEscape } from '../lib/useEscape';
import { ManaCost } from './common';

export function CardPreview() {
  const card = useStore((s) => s.previewCard);
  const setPreviewCard = useStore((s) => s.setPreviewCard);
  useEscape(() => setPreviewCard(null));
  // Try the large image first; on error fall back to the normal one, then to
  // the text panel. `stage` past the last candidate means no image is usable.
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [card?.id]);
  if (!card) return null;

  const candidates = [card.imageLarge, card.image].filter(Boolean) as string[];
  const src = candidates[stage];
  const hasImage = !!src;
  const onImgError = () => setStage((s) => s + 1);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => setPreviewCard(null)}
    >
      <div
        className="flex max-h-[92vh] flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {hasImage ? (
          // When we have the real card art, the art *is* the card — just show it.
          <div className="card-frame max-h-[88vh] w-auto">
            <img
              key={src}
              src={src}
              alt={card.name}
              onError={onImgError}
              className="max-h-[88vh] w-auto object-contain"
            />
          </div>
        ) : (
          // Fallback only when no image is available: a parchment text card.
          <div className="parchment flex w-full max-w-sm flex-col gap-2 p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-xl font-semibold text-ink">{card.name}</h3>
              <ManaCost cost={card.manaCost} />
            </div>
            <div className="border-y border-gold-700/40 py-1 font-serif text-sm italic text-ink/80">
              {card.typeLine}
            </div>
            <p className="whitespace-pre-line font-serif text-[15px] leading-relaxed text-ink">
              {card.oracleText || '—'}
            </p>
            <div className="mt-2 flex items-center justify-between font-serif text-xs text-ink/70">
              <span>
                {card.set} · #{card.collectorNumber} · <span className="capitalize">{card.rarity}</span>
              </span>
              {card.power != null && (
                <span className="font-display text-base font-bold text-ink">
                  {card.power}/{card.toughness}
                </span>
              )}
            </div>
          </div>
        )}

        <button onClick={() => setPreviewCard(null)} className="btn-ghost">
          Close (Esc)
        </button>
      </div>
    </div>
  );
}
