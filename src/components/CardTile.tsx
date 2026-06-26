import { useState } from 'react';
import type { Card } from '../types/card';
import { ManaCost } from './common';

export function CardTile({
  card,
  onClick,
  badge,
}: {
  card: Card;
  onClick?: () => void;
  badge?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = card.image && !imgFailed;

  return (
    <button
      type="button"
      onClick={onClick}
      className="card-frame group relative block w-full text-left transition-all duration-150 hover:-translate-y-1 hover:shadow-[0_0_18px_rgba(217,178,76,0.45)]"
      title={card.name}
    >
      {showImage ? (
        <img
          src={card.image!}
          alt={card.name}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="aspect-[5/7] w-full object-cover"
        />
      ) : (
        <div className="parchment flex aspect-[5/7] w-full flex-col justify-between rounded-none p-2">
          <div className="flex items-start justify-between gap-1">
            <span className="font-serif text-xs font-semibold leading-tight">{card.name}</span>
            <ManaCost cost={card.manaCost} />
          </div>
          <div className="border-y border-gold-700/40 py-0.5 font-serif text-[10px] italic text-ink/80">
            {card.typeLine}
          </div>
          <div className="line-clamp-5 font-serif text-[9px] leading-snug text-ink/70">{card.oracleText}</div>
          {card.power != null && (
            <div className="self-end font-display text-xs font-bold text-ink">
              {card.power}/{card.toughness}
            </div>
          )}
        </div>
      )}
      {badge && (
        <span className="absolute right-1 top-1 rounded bg-gold-600 px-1.5 py-0.5 text-[10px] font-bold text-wood-950">
          {badge}
        </span>
      )}
    </button>
  );
}
