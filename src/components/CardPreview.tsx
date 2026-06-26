import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useEscape } from '../lib/useEscape';
import { ManaCost } from './common';

export function CardPreview() {
  const card = useStore((s) => s.previewCard);
  const setPreviewCard = useStore((s) => s.setPreviewCard);
  useEscape(() => setPreviewCard(null));
  // Try the large image first; on error fall back to the normal one, then text.
  const [stage, setStage] = useState(0);
  // Reset the fallback stage each time a different card is opened.
  useEffect(() => setStage(0), [card?.id]);
  if (!card) return null;

  const candidates = [card.imageLarge, card.image].filter(Boolean) as string[];
  const src = candidates[stage];
  const showImage = !!src;
  const onImgError = () => setStage((s) => s + 1);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => setPreviewCard(null)}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-4 sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* High-res framed art */}
        {showImage && (
          <div className="card-frame mx-auto w-full max-w-xs shrink-0 self-center">
            <img
              key={src}
              src={src}
              alt={card.name}
              onError={onImgError}
              className="w-full"
            />
          </div>
        )}

        {/* Parchment text panel */}
        <div className="parchment flex min-w-0 flex-1 flex-col gap-2 self-center p-5">
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
          <div className="mt-auto flex items-center justify-between pt-2 font-serif text-xs text-ink/70">
            <span>
              {card.set} · #{card.collectorNumber} · <span className="capitalize">{card.rarity}</span>
            </span>
            {card.power != null && (
              <span className="font-display text-base font-bold text-ink">
                {card.power}/{card.toughness}
              </span>
            )}
          </div>
          <button
            onClick={() => setPreviewCard(null)}
            className="btn-ghost mt-1 self-end"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
