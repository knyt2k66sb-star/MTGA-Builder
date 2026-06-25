import { POOL_META } from '../store/useStore';

export function PoolBadge() {
  const date = new Date(POOL_META.updated);
  const dateStr = isNaN(date.getTime()) ? 'unknown' : date.toLocaleDateString();
  const isFallback = POOL_META.source === 'fallback';

  return (
    <div className="text-right text-[11px] leading-tight text-slate-400">
      <div>
        Pool: <span className="font-semibold text-slate-200">{POOL_META.count}</span> cards · {dateStr}
      </div>
      {isFallback && (
        <div className="text-amber-400" title="Run `npm run update-pool` for the live, import-accurate Standard pool.">
          sample pool — run <code className="text-amber-300">npm run update-pool</code> for live data
        </div>
      )}
    </div>
  );
}
