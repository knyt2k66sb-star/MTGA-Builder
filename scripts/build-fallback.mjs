#!/usr/bin/env node
// Generates a curated, illustrative fallback card pool (src/data/standard-pool.json)
// so the app, generator and tests run without network access.
//
// IMPORTANT: this is a hand-authored *sample* of real Standard-era cards. Set
// codes / collector numbers are plausible but not guaranteed import-accurate.
// Run `npm run update-pool` on a machine with access to api.scryfall.com to
// replace this with the live, import-verified Standard + Arena pool.
//
//   node scripts/build-fallback.mjs
//
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../src/data');
const COLORS = ['W', 'U', 'B', 'R', 'G'];

let arenaSeq = 70000;

function cmcFromCost(cost) {
  if (!cost) return 0;
  let cmc = 0;
  for (const sym of cost.match(/\{[^}]+\}/g) ?? []) {
    const inner = sym.slice(1, -1);
    if (/^\d+$/.test(inner)) cmc += parseInt(inner, 10);
    else if (inner === 'X') cmc += 0;
    else cmc += 1; // colored / hybrid / phyrexian / colorless symbol
  }
  return cmc;
}

function colorsFromCost(cost) {
  const set = new Set();
  for (const sym of (cost || '').match(/\{[^}]+\}/g) ?? []) {
    for (const c of sym.slice(1, -1).split('/')) if (COLORS.includes(c)) set.add(c);
  }
  return COLORS.filter((c) => set.has(c));
}

function identityFrom(cost, oracle, prod, override) {
  if (override) return override;
  const set = new Set(colorsFromCost(cost));
  for (const sym of (oracle || '').match(/\{[^}]+\}/g) ?? []) {
    for (const c of sym.slice(1, -1).split('/')) if (COLORS.includes(c)) set.add(c);
  }
  for (const c of prod ?? []) if (COLORS.includes(c)) set.add(c);
  return COLORS.filter((c) => set.has(c));
}

// Compact card definition -> full Card record.
function mk(d) {
  const cost = d.m ?? '';
  const oracle = d.o ?? '';
  const prod = d.prod ?? [];
  const colors = colorsFromCost(cost);
  return {
    id: `fb-${arenaSeq}`,
    oracleId: `fb-${d.n.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: d.n,
    cmc: cmcFromCost(cost),
    manaCost: cost,
    colors,
    colorIdentity: identityFrom(cost, oracle, prod, d.ci),
    typeLine: d.t,
    keywords: d.k ?? [],
    oracleText: oracle,
    power: d.p ?? null,
    toughness: d.tough ?? null,
    edhrecRank: d.r ?? null,
    producedMana: prod,
    rarity: d.rar ?? 'rare',
    set: d.set ?? 'FDN',
    collectorNumber: String(d.num ?? '1'),
    arenaId: arenaSeq++,
    layout: d.layout ?? 'normal',
    image: `https://api.scryfall.com/cards/named?format=image&version=normal&exact=${encodeURIComponent(d.n)}`,
    legalStandard: true,
    legalBrawl: d.banBrawl ? false : true,
  };
}

// ---------------------------------------------------------------------------
// Card data. A spread of recent Standard-era cards across all five colors,
// including creatures (aggressive + value), removal, card draw, counters,
// sweepers, ramp, legendary commanders, multicolor cards and nonbasic lands.
// ---------------------------------------------------------------------------
const defs = [
  // ---------------- WHITE ----------------
  { n: 'Savannah Lions', m: '{W}', t: 'Creature — Cat', p: '2', tough: '1', r: 1200, set: 'FDN', num: 1 },
  { n: 'Ambitious Farmhand', m: '{W}', t: 'Creature — Human Peasant', o: 'When Ambitious Farmhand enters, search your library for a basic land.', p: '1', tough: '1', r: 900, set: 'MID', num: 2 },
  { n: 'Brutal Cathar', m: '{2}{W}', t: 'Creature — Human Cleric Werewolf', o: 'When Brutal Cathar enters, exile target creature an opponent controls.', p: '2', tough: '2', k: ['Vigilance'], r: 700, set: 'MID', num: 17, layout: 'transform' },
  { n: 'Adeline, Resplendent Cathar', m: '{1}{W}{W}', t: 'Legendary Creature — Human Soldier', o: 'Whenever you attack, create a 1/1 white Human creature token.', p: '*', tough: '4', k: ['Vigilance'], r: 300, set: 'MID', num: 1 },
  { n: 'Elspeth, Storm Slayer', m: '{2}{W}{W}', t: 'Legendary Planeswalker — Elspeth', o: 'If one or more tokens would be created, twice that many are created instead.', r: 250, set: 'BLB', num: 5 },
  { n: 'Get Lost', m: '{1}{W}', t: 'Instant', o: 'Destroy target creature or planeswalker.', r: 200, set: 'LCI', num: 18 },
  { n: 'Ossification', m: '{1}{W}', t: 'Enchantment', o: 'When Ossification enters, exile target nonland permanent an opponent controls.', r: 400, set: 'ONE', num: 26 },
  { n: 'Sunfall', m: '{3}{W}{W}', t: 'Sorcery', o: 'Exile all creatures. Each player collects evidence.', r: 350, set: 'MOM', num: 40 },
  { n: 'The Wandering Emperor', m: '{2}{W}{W}', t: 'Legendary Planeswalker — The Wandering Emperor', o: 'You may activate loyalty abilities on any player\'s turn. +1: Create a 2/2 white Samurai token with vigilance.', r: 150, set: 'NEO', num: 42 },
  { n: 'Knight-Errant of Eos', m: '{2}{W}', t: 'Creature — Human Knight', o: 'When Knight-Errant of Eos enters, search your library for up to two cards with mana value 1.', p: '3', tough: '3', r: 800, set: 'BRO', num: 28 },
  { n: 'Wedding Announcement', m: '{2}{W}', t: 'Enchantment — Saga', o: 'Draw a card. Create a 1/1 white Human creature token.', r: 600, set: 'VOW', num: 44 },
  { n: 'Guardian of New Benalia', m: '{1}{W}', t: 'Creature — Human Soldier', p: '2', tough: '2', k: ['Vigilance'], r: 1500, set: 'DMU', num: 13 },
  { n: 'Inspiring Overseer', m: '{2}{W}', t: 'Creature — Angel Cleric', o: 'When Inspiring Overseer enters, you gain 1 life and draw a card.', p: '2', tough: '1', k: ['Flying'], r: 280, set: 'SNC', num: 16 },
  { n: 'Charming Prince', m: '{1}{W}', t: 'Creature — Human Noble', o: 'When Charming Prince enters, scry 2.', p: '2', tough: '2', r: 500, set: 'ELD', num: 8 },

  // ---------------- BLUE ----------------
  { n: 'Spectral Sailor', m: '{U}', t: 'Creature — Spirit', o: '{3}{U}, {T}: Draw a card.', p: '1', tough: '1', k: ['Flash', 'Flying'], r: 450, set: 'M20', num: 75 },
  { n: 'Faerie Mastermind', m: '{1}{U}', t: 'Legendary Creature — Faerie', o: 'Whenever an opponent draws a card except the first, you may draw a card.', p: '2', tough: '1', k: ['Flash', 'Flying'], r: 320, set: 'MOM', num: 58 },
  { n: 'Make Disappear', m: '{1}{U}', t: 'Instant', o: 'Counter target spell unless its controller pays {2}.', r: 700, set: 'SNC', num: 52 },
  { n: 'Three Steps Ahead', m: '{2}{U}', t: 'Instant', o: 'Choose one — Counter target spell; or draw two cards then discard a card; or create a token copy.', r: 260, set: 'OTJ', num: 67 },
  { n: 'Cut Down the Tall Tale', m: '{U}', t: 'Instant', o: 'Counter target spell unless its controller pays {3}.', r: 1800, set: 'WOE', num: 53 },
  { n: 'Into the Flood Maw', m: '{U}', t: 'Instant', o: 'Return target creature or planeswalker to its owner\'s hand.', r: 240, set: 'BLB', num: 53 },
  { n: 'Tishana\'s Tidebinder', m: '{1}{U}{U}', t: 'Creature — Merfolk Wizard', o: 'Flash. When Tishana\'s Tidebinder enters, counter target activated or triggered ability.', p: '3', tough: '2', k: ['Flash'], r: 220, set: 'LCI', num: 75 },
  { n: 'Subterranean Schooner', m: '{2}{U}', t: 'Artifact — Vehicle', o: 'Whenever Subterranean Schooner attacks, draw a card, then discard a card.', p: '4', tough: '2', r: 1100, set: 'OTJ', num: 65 },
  { n: 'Kaito, Bane of Nightmares', m: '{2}{U}{U}', t: 'Legendary Planeswalker — Kaito', o: 'Ninjutsu. As long as it\'s not your turn, Kaito is a 3/4 creature with hexproof.', r: 180, set: 'DSK', num: 53 },
  { n: 'Deduce', m: '{1}{U}', t: 'Instant', o: 'Draw a card. Create a Clue token.', r: 950, set: 'MKM', num: 51 },
  { n: 'Of One Mind', m: '{2}{U}', t: 'Sorcery', o: 'Draw two cards.', r: 1400, set: 'VOW', num: 71 },
  { n: 'Stormchaser\'s Talent', m: '{U}', t: 'Enchantment — Class', o: 'Create a 1/1 blue Otter creature token with prowess.', r: 500, set: 'BLB', num: 71 },
  { n: 'Mistrise Village', m: '', t: 'Land', o: '{T}: Add {U}.', prod: ['U'], r: 2000, set: 'BLB', num: 256, rar: 'uncommon' },
  { n: 'Enthusiastic Mechanaut', m: '{1}{U}', t: 'Creature — Vedalken Artificer', o: 'Artifact spells you cast cost {1} less. Flying.', p: '1', tough: '3', k: ['Flying'], r: 1300, set: 'BRO', num: 47 },

  // ---------------- BLACK ----------------
  { n: 'Cut Down', m: '{B}', t: 'Instant', o: 'Destroy target creature with total power and toughness 5 or less.', r: 130, set: 'DMU', num: 89 },
  { n: 'Go for the Throat', m: '{1}{B}', t: 'Instant', o: 'Destroy target nonartifact creature.', r: 110, set: 'BRO', num: 102 },
  { n: 'Sheoldred, the Apocalypse', m: '{2}{B}{B}', t: 'Legendary Creature — Phyrexian Praetor', o: 'Whenever you draw a card, you gain 2 life. Whenever an opponent draws a card, they lose 2 life.', p: '4', tough: '5', k: ['Deathtouch'], r: 90, set: 'DMU', num: 107 },
  { n: 'Gix\'s Command', m: '{3}{B}', t: 'Sorcery', o: 'Choose two — each player sacrifices two creatures; or put a +1/+1 counter; or return creatures; or draw two cards and lose 2 life.', r: 700, set: 'BRO', num: 97 },
  { n: 'Evolved Sleeper', m: '{B}', t: 'Creature — Human Wizard', o: '{1}{B}: Level up. Draw a card and lose 1 life.', p: '1', tough: '1', r: 600, set: 'DMU', num: 90 },
  { n: 'Tenacious Underdog', m: '{1}{B}', t: 'Creature — Human Warrior', o: 'Blitz {2}{B}.', p: '3', tough: '2', r: 800, set: 'SNC', num: 97 },
  { n: 'Deep-Cavern Bat', m: '{1}{B}', t: 'Creature — Bat', o: 'When Deep-Cavern Bat enters, look at target opponent\'s hand and exile a nonland card from it.', p: '1', tough: '2', k: ['Flying', 'Lifelink'], r: 200, set: 'LCI', num: 102 },
  { n: 'Mscoff Mortician', m: '{1}{B}', t: 'Creature — Human', o: 'When this enters, mill three cards. Draw a card.', p: '2', tough: '2', r: 1600, set: 'MKM', num: 98 },
  { n: 'Liliana of the Veil', m: '{1}{B}{B}', t: 'Legendary Planeswalker — Liliana', o: '+1: Each player discards a card. -2: Target player sacrifices a creature.', r: 160, set: 'DMU', num: 97 },
  { n: 'Bloodtithe Harvester', m: '{B}{R}', t: 'Creature — Vampire', o: '{1}, Sacrifice a Blood token: Target creature gets -1/-1.', p: '2', tough: '2', r: 240, set: 'VOW', num: 232, ci: ['B', 'R'] },
  { n: 'Preacher of the Schism', m: '{2}{B}', t: 'Creature — Vampire Cleric', o: 'Whenever one or more creatures you control with power 3 or greater attack, draw a card and lose 1 life.', p: '3', tough: '2', k: ['Deathtouch'], r: 380, set: 'LCI', num: 113 },
  { n: 'The Cruelty of Gix', m: '{4}{B}', t: 'Enchantment — Saga', o: 'Each opponent loses 3 life. You draw three cards and lose 3 life.', r: 750, set: 'BRO', num: 109 },

  // ---------------- RED ----------------
  { n: 'Monastery Swiftspear', m: '{R}', t: 'Creature — Human Monk', p: '1', tough: '2', k: ['Haste', 'Prowess'], r: 140, set: 'FDN', num: 130 },
  { n: 'Kumano Faces Kakkazan', m: '{R}', t: 'Enchantment — Saga', o: 'Deal 1 damage to each opponent. Create a 2/2 red Monk creature token.', r: 300, set: 'NEO', num: 152 },
  { n: 'Play with Fire', m: '{R}', t: 'Instant', o: 'Play with Fire deals 2 damage to any target. If a player is dealt damage this way, scry 1.', r: 260, set: 'MID', num: 154 },
  { n: 'Lightning Strike', m: '{1}{R}', t: 'Instant', o: 'Lightning Strike deals 3 damage to any target.', r: 350, set: 'DMU', num: 137 },
  { n: 'Reckless Stormseeker', m: '{1}{R}', t: 'Creature — Human Berserker', o: 'Haste. {1}{R}: transform. Other creatures you control have haste.', p: '1', tough: '1', k: ['Haste'], r: 500, set: 'MID', num: 158, layout: 'transform' },
  { n: 'Feldon, Ronom Excavate', m: '{1}{R}', t: 'Legendary Creature — Human Artificer', o: 'Whenever Feldon attacks, exile the top card of your library. You may play it this turn.', p: '2', tough: '3', r: 700, set: 'DMU', num: 125 },
  { n: 'Squee, Dubious Monarch', m: '{2}{R}', t: 'Legendary Creature — Goblin Noble', o: 'You may cast Squee from your graveyard by paying {3}{R} and exiling three other cards.', p: '2', tough: '2', r: 800, set: 'DMU', num: 146 },
  { n: 'Witchstalker Frenzy', m: '{X}{R}{R}', t: 'Instant', o: 'Witchstalker Frenzy deals X damage to target creature or planeswalker.', r: 1000, set: 'MID', num: 164 },
  { n: 'Goldspan Dragon', m: '{3}{R}{R}', t: 'Legendary Creature — Dragon', o: 'Whenever Goldspan Dragon attacks or becomes the target of a spell, create a Treasure token. Treasures you control make twice the mana.', p: '4', tough: '4', k: ['Flying', 'Haste'], r: 200, set: 'KHM', num: 139 },
  { n: 'Firefist Striker', m: '{R}', t: 'Creature — Goblin Soldier', o: 'Boast — {1}{R}: Target creature can\'t block this turn.', p: '2', tough: '1', r: 1500, set: 'KHM', num: 136 },
  { n: 'Charming Scoundrel', m: '{R}', t: 'Creature — Human Rogue', o: 'When Charming Scoundrel enters, choose one — discard a card then draw a card; or create a Treasure.', p: '2', tough: '1', r: 1100, set: 'OTJ', num: 124 },
  { n: 'Urabrask\'s Forge', m: '{2}{R}', t: 'Artifact', o: 'At the beginning of combat on your turn, create a 1/1 red Phyrexian Horror token.', r: 900, set: 'MOM', num: 165 },

  // ---------------- GREEN ----------------
  { n: 'Llanowar Elves', m: '{G}', t: 'Creature — Elf Druid', o: '{T}: Add {G}.', p: '1', tough: '1', prod: ['G'], r: 400, set: 'DMU', num: 168 },
  { n: 'Elvish Mystic', m: '{G}', t: 'Creature — Elf Druid', o: '{T}: Add {G}.', p: '1', tough: '1', prod: ['G'], r: 420, set: 'FDN', num: 170 },
  { n: 'Sylvan Caryatid', m: '{1}{G}', t: 'Creature — Plant', o: 'Defender, hexproof. {T}: Add one mana of any color.', p: '0', tough: '3', prod: ['W', 'U', 'B', 'R', 'G'], k: ['Defender', 'Hexproof'], r: 600, set: 'FDN', num: 171 },
  { n: 'Tireless Tracker', m: '{2}{G}', t: 'Creature — Human Scout', o: 'Whenever a land enters under your control, investigate. Sacrifice a Clue: put a +1/+1 counter on Tireless Tracker.', p: '3', tough: '2', r: 350, set: 'SOI', num: 233 },
  { n: 'Old-Growth Troll', m: '{G}{G}', t: 'Creature — Troll Warrior', o: 'Trample. When Old-Growth Troll dies, create a legendary green Aura.', p: '4', tough: '4', k: ['Trample'], r: 500, set: 'KHM', num: 178 },
  { n: 'Cankerbloom', m: '{1}{G}', t: 'Creature — Phyrexian Fungus', o: '{1}, Sacrifice: choose one — destroy target artifact; or destroy target enchantment; or proliferate.', p: '2', tough: '2', r: 700, set: 'MOM', num: 173 },
  { n: 'Wrenn and Realmbreaker', m: '{2}{G}', t: 'Legendary Planeswalker — Wrenn', o: '+1: Reveal cards from the top of your library until you reveal a land. -2: Mill, return permanent.', r: 300, set: 'ONE', num: 192 },
  { n: 'Topiary Stomper', m: '{3}{G}', t: 'Creature — Plant Dinosaur', o: 'When Topiary Stomper enters, search your library for a basic land and put it onto the battlefield tapped.', p: '4', tough: '4', k: ['Vigilance'], r: 800, set: 'SNC', num: 173 },
  { n: 'Workshop Warchief', m: '{3}{G}', t: 'Creature — Beast', o: 'Trample. When Workshop Warchief dies, create a 4/4 green Ogre.', p: '5', tough: '4', k: ['Trample'], r: 600, set: 'BRO', num: 183 },
  { n: 'Sentinel of the Nameless City', m: '{2}{G}', t: 'Creature — Snake Warrior', o: 'Ward {2}. When Sentinel enters, create a 1/1 green and white Citizen token.', p: '4', tough: '4', r: 250, set: 'LCI', num: 211 },
  { n: 'Vorinclex, Monstrous Raider', m: '{4}{G}{G}', t: 'Legendary Creature — Phyrexian Praetor', o: 'If you would put counters on a permanent, put twice that many instead.', p: '6', tough: '6', k: ['Trample', 'Haste'], r: 400, set: 'KHM', num: 199 },
  { n: 'Tear Asunder', m: '{1}{G}', t: 'Instant', o: 'Kicker {1}{G}. Exile target artifact or enchantment. If kicked, exile any nonland permanent.', r: 900, set: 'KHM', num: 196 },

  // ---------------- MULTICOLOR / GOLD ----------------
  { n: 'Fable of the Mirror-Breaker', m: '{2}{R}', t: 'Enchantment — Saga', o: 'Create a 2/2 red Goblin Shaman token. Exile up to one target creature you control, then return it transformed.', r: 100, set: 'NEO', num: 141, layout: 'transform' },
  { n: 'Raffine, Scheming Seer', m: '{W}{U}{B}', t: 'Legendary Creature — Sphinx Demon', o: 'Whenever you attack, connive for each attacking creature.', p: '1', tough: '4', k: ['Flying', 'Ward'], r: 220, set: 'SNC', num: 215, ci: ['W', 'U', 'B'] },
  { n: 'Atraxa, Grand Unifier', m: '{4}{G}{W}{U}{B}', t: 'Legendary Creature — Phyrexian Angel', o: 'When Atraxa enters, reveal the top ten cards; put one of each card type into your hand.', p: '7', tough: '5', k: ['Flying', 'Vigilance', 'Deathtouch', 'Lifelink'], r: 80, set: 'ONE', num: 196, ci: ['W', 'U', 'B', 'G'] },
  { n: 'Riveteers Charm', m: '{B}{R}', t: 'Instant', o: 'Choose one — target opponent loses 3 life; or draw a card; or destroy target creature.', r: 1200, set: 'SNC', num: 211, ci: ['B', 'R'] },
  { n: 'Wrenn and Seven', m: '{4}{G}{G}', t: 'Legendary Planeswalker — Wrenn', o: '+1: reveal lands. -3: Create a 0/0 Treefolk with reach.', r: 700, set: 'MID', num: 207 },
  { n: 'Slogurk, the Overslime', m: '{1}{G}{U}', t: 'Legendary Creature — Slug Horror', o: 'Whenever a land is put into your graveyard, put a +1/+1 counter on Slogurk.', p: '0', tough: '0', k: ['Trample'], r: 600, set: 'MID', num: 211, ci: ['G', 'U'] },
  { n: 'Tatyova, Benthic Druid', m: '{3}{G}{U}', t: 'Legendary Creature — Merfolk Druid', o: 'Whenever a land enters under your control, draw a card and gain 1 life.', p: '3', tough: '3', r: 500, set: 'DOM', num: 206, ci: ['G', 'U'] },

  // ---------------- NONBASIC LANDS ----------------
  { n: 'Sundown Pass', m: '', t: 'Land', o: '{T}: Add {R} or {W}.', prod: ['R', 'W'], r: 1700, set: 'OTJ', num: 269, rar: 'rare' },
  { n: 'Restless Anchorage', m: '', t: 'Land', o: '{T}: Add {W} or {U}. {2}{W}{U}: becomes a 2/3 creature.', prod: ['W', 'U'], r: 1600, set: 'LCI', num: 280, rar: 'rare' },
  { n: 'Underground Mortuary', m: '', t: 'Land', o: '{T}: Add {B} or {G}. Enters tapped. Surveil 1.', prod: ['B', 'G'], r: 1900, set: 'MKM', num: 268, rar: 'common' },
  { n: 'Thornwood Falls', m: '', t: 'Land', o: '{T}: Add {G} or {U}. Enters tapped. Gain 1 life.', prod: ['G', 'U'], r: 2100, set: 'FDN', num: 270, rar: 'common' },
  { n: 'Shipwreck Marsh', m: '', t: 'Land', o: '{T}: Add {U} or {B}.', prod: ['U', 'B'], r: 1500, set: 'MID', num: 264, rar: 'rare' },
  { n: 'Sulfurous Springs', m: '', t: 'Land', o: '{T}: Add {C}. {T}, lose 1 life: Add {B} or {R}.', prod: ['B', 'R'], r: 1400, set: 'DMU', num: 251, rar: 'rare' },
  { n: 'Karplusan Forest', m: '', t: 'Land', o: '{T}: Add {C}. {T}, lose 1 life: Add {R} or {G}.', prod: ['R', 'G'], r: 1450, set: 'DMU', num: 250, rar: 'rare' },
  { n: 'Brushland', m: '', t: 'Land', o: '{T}: Add {C}. {T}, lose 1 life: Add {G} or {W}.', prod: ['G', 'W'], r: 1480, set: 'DMU', num: 248, rar: 'rare' },
  { n: 'Adarkar Wastes', m: '', t: 'Land', o: '{T}: Add {C}. {T}, lose 1 life: Add {W} or {U}.', prod: ['W', 'U'], r: 1490, set: 'DMU', num: 247, rar: 'rare' },
  { n: 'Caves of Koilos', m: '', t: 'Land', o: '{T}: Add {C}. {T}, lose 1 life: Add {W} or {B}.', prod: ['W', 'B'], r: 1495, set: 'DMU', num: 249, rar: 'rare' },
];

function main() {
  const cards = defs.map(mk);
  // Basic-quality sanity sort by edhrec rank.
  cards.sort((a, b) => (a.edhrecRank ?? 1e9) - (b.edhrecRank ?? 1e9));

  const sets = [...new Set(cards.map((c) => c.set))].sort();
  const meta = {
    updated: new Date().toISOString(),
    count: cards.length,
    sets,
    source: 'fallback',
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, 'standard-pool.json'), JSON.stringify(cards));
  writeFileSync(resolve(DATA_DIR, 'pool-meta.json'), JSON.stringify(meta, null, 2));
  console.log(`Wrote curated fallback pool: ${cards.length} cards, ${sets.length} sets.`);
}

main();
