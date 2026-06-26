import { POOL_META } from '../store/useStore';

export function PoolBadge() {
  const date = new Date(POOL_META.updated);
  const dateStr = isNaN(date.getTime()) ? 'unknown' : date.toLocaleDateString();
  const isFallback = POOL_META.source === 'fallback';

  return (
    <div className="text-right font-serif text-[11px] leading-tight text-parchment-400">
      <div>
        Pool: <span className="font-display font-semibold text-gold-300">{POOL_META.count}</span> cards · {dateStr}
      </div>
      {isFallback && (
        <div className="text-amber-400/90" title="Run `npm run update-pool` for the live, import-accurate Standard pool.">
          sample pool — run <code className="text-amber-300">npm run update-pool</code> for live data
        </div>
      )}
    </div>
  );
}
