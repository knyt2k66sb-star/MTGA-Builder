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
      className="group relative block w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900 text-left transition-transform hover:-translate-y-0.5 hover:border-indigo-500"
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
        <div className="flex aspect-[5/7] w-full flex-col justify-between bg-gradient-to-br from-slate-800 to-slate-900 p-2">
          <div className="flex items-start justify-between gap-1">
            <span className="text-xs font-semibold leading-tight">{card.name}</span>
            <ManaCost cost={card.manaCost} />
          </div>
          <div className="text-[10px] text-slate-400">{card.typeLine}</div>
          <div className="line-clamp-4 text-[9px] leading-snug text-slate-500">{card.oracleText}</div>
          {card.power != null && (
            <div className="self-end text-xs font-bold text-slate-300">
              {card.power}/{card.toughness}
            </div>
          )}
        </div>
      )}
      {badge && (
        <span className="absolute right-1 top-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
