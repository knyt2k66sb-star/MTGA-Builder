import type { Card } from '../types/card';

const FRONT_FACE_LAYOUTS = new Set(['transform', 'modal_dfc', 'meld']);

/**
 * The name MTGA's importer expects.
 * - Transform / MDFC: front-face name only (the part before " // ").
 * - Split / adventure / normal: the full Scryfall name.
 */
export function toArenaName(card: Card): string {
  if (FRONT_FACE_LAYOUTS.has(card.layout) && card.name.includes(' // ')) {
    return card.name.split(' // ')[0].trim();
  }
  return card.name;
}
