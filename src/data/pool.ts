import type { Card, PoolMeta } from '../types/card';
import rawPool from './standard-pool.json';
import rawMeta from './pool-meta.json';

/** Standard-legal pool — eagerly loaded, powers Standard & Standard Brawl. */
export const POOL: Card[] = rawPool as unknown as Card[];
export const POOL_META: PoolMeta = rawMeta as PoolMeta;

let brawlExtraCache: Card[] | null = null;
let brawlExtraPromise: Promise<Card[]> | null = null;

/**
 * Brawl(100)-only cards (non-Standard, Brawl-legal). Loaded lazily via a
 * split chunk so Standard users never download it — and so Standard/Standard
 * Brawl generation, which only ever reads POOL, can never draw from it.
 * Returns [] (with a console warning) if the file is missing/empty, e.g.
 * before the first `npm run update-pool` writes real data.
 */
export function loadBrawlExtra(): Promise<Card[]> {
  if (brawlExtraCache) return Promise.resolve(brawlExtraCache);
  if (!brawlExtraPromise) {
    brawlExtraPromise = import('./brawl-extra-pool.json')
      .then((mod) => {
        brawlExtraCache = (mod.default ?? []) as unknown as Card[];
        return brawlExtraCache;
      })
      .catch((err) => {
        console.warn('Brawl extra pool unavailable — run `npm run update-pool`.', err);
        brawlExtraCache = [];
        return brawlExtraCache;
      });
  }
  return brawlExtraPromise;
}

/** Full pool for a format: Standard pool alone, or merged with the Brawl extras. */
export async function poolForFormat(format: string): Promise<Card[]> {
  if (format !== 'brawl') return POOL;
  const extra = await loadBrawlExtra();
  return [...POOL, ...extra];
}
