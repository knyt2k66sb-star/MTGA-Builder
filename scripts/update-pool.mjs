#!/usr/bin/env node
// Fetch the current Standard + Arena card pool from Scryfall and write a
// trimmed snapshot to src/data/standard-pool.json. Re-run after a rotation to
// refresh the pool — Scryfall's legality data is live, so the query below
// always reflects the current Standard environment.
//
//   node scripts/update-pool.mjs
//
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../src/data');

const QUERY = 'legal:standard game:arena -is:alchemy';
const HEADERS = {
  'User-Agent': 'MTGABuilder/1.0 (https://github.com/knyt2k66sb-star/mtga-builder)',
  Accept: 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const COLORS = new Set(['W', 'U', 'B', 'R', 'G']);
const onlyColors = (arr) => (arr ?? []).filter((c) => COLORS.has(c));

function frontImage(card) {
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
  return null;
}

function oracleText(card) {
  if (card.oracle_text != null) return card.oracle_text;
  if (card.card_faces) return card.card_faces.map((f) => f.oracle_text ?? '').join('\n');
  return '';
}

function trim(card) {
  return {
    id: card.id,
    oracleId: card.oracle_id,
    name: card.name,
    cmc: card.cmc ?? 0,
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '',
    colors: onlyColors(card.colors ?? card.card_faces?.[0]?.colors),
    colorIdentity: onlyColors(card.color_identity),
    typeLine: card.type_line ?? card.card_faces?.[0]?.type_line ?? '',
    keywords: card.keywords ?? [],
    oracleText: oracleText(card),
    power: card.power ?? card.card_faces?.[0]?.power ?? null,
    toughness: card.toughness ?? card.card_faces?.[0]?.toughness ?? null,
    edhrecRank: card.edhrec_rank ?? null,
    producedMana: onlyColors(card.produced_mana),
    rarity: card.rarity ?? 'common',
    set: (card.set ?? '').toUpperCase(),
    collectorNumber: card.collector_number ?? '',
    arenaId: card.arena_id ?? null,
    layout: card.layout ?? 'normal',
    image: frontImage(card),
    legalStandard: card.legalities?.standard === 'legal',
    legalBrawl:
      card.legalities?.brawl === 'legal' || card.legalities?.standardbrawl === 'legal',
  };
}

async function fetchAll() {
  const cards = [];
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(QUERY)}&unique=cards`;
  let page = 0;
  while (url) {
    page += 1;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Scryfall ${res.status} ${res.statusText} on page ${page}`);
    const json = await res.json();
    for (const card of json.data) cards.push(card);
    process.stdout.write(`\rFetched page ${page} (${cards.length}/${json.total_cards})`);
    url = json.has_more ? json.next_page : null;
    if (url) await sleep(100); // be polite to Scryfall
  }
  process.stdout.write('\n');
  return cards;
}

function dedupe(trimmed) {
  // Keep one printing per oracleId, preferring one with an arena id.
  const byOracle = new Map();
  for (const c of trimmed) {
    if (!c.oracleId) continue;
    const existing = byOracle.get(c.oracleId);
    if (!existing) byOracle.set(c.oracleId, c);
    else if (existing.arenaId == null && c.arenaId != null) byOracle.set(c.oracleId, c);
  }
  return [...byOracle.values()];
}

async function main() {
  console.log(`Querying Scryfall: ${QUERY}`);
  const raw = await fetchAll();
  const trimmed = dedupe(raw.map(trim)).filter((c) => c.arenaId != null);
  trimmed.sort((a, b) => (a.edhrecRank ?? 1e9) - (b.edhrecRank ?? 1e9));

  const sets = [...new Set(trimmed.map((c) => c.set))].sort();
  const meta = {
    updated: new Date().toISOString(),
    count: trimmed.length,
    sets,
    source: 'scryfall',
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, 'standard-pool.json'), JSON.stringify(trimmed));
  writeFileSync(resolve(DATA_DIR, 'pool-meta.json'), JSON.stringify(meta, null, 2));
  console.log(`Wrote ${trimmed.length} cards across ${sets.length} sets to src/data/.`);
}

main().catch((err) => {
  console.error('\nFailed to update pool:', err.message);
  console.error('If this is a network/egress restriction, run this script on a');
  console.error('machine with access to api.scryfall.com. The bundled fallback');
  console.error('pool will continue to work in the meantime.');
  process.exit(1);
});
