import type { Card, PoolMeta } from '../types/card';
import rawPool from './standard-pool.json';
import rawMeta from './pool-meta.json';

export const POOL: Card[] = rawPool as unknown as Card[];
export const POOL_META: PoolMeta = rawMeta as PoolMeta;
