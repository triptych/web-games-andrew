// ============================================================
// data/cultures.js - the seven cultures (GDD §34.3). APPEND ONLY.
// ============================================================
import { T } from './tiles.js';
import { O } from './objects.js';

const c = (key, o) => ({ key, ...o });

export const CULTURES = {
  hedgewright: c('hedgewright', {
    name: 'hedgewright', build: O.wall_timber, roof: 'thatch', floor: T.floor_wood,
    wall: 'hedge', signature: O.beehive, plazaProp: O.well,
    foods: ['pottage', 'honey', 'bread'], festival: 'Hedge-Turning',
    greeting: 'Now then.', nameStyle: 'soft',
    trades: { weaver: 4, farmer: 5, beekeeper: 3, innkeeper: 2, smith: 2, herbalist: 2, carter: 2, baker: 2 },
  }),
  fenfolk: c('fenfolk', {
    name: 'fenfolk', build: O.wall_timber, roof: 'reed', floor: T.thatch_floor,
    wall: 'none', signature: O.reeds_tall, plazaProp: O.standing_lantern,
    foods: ['dried_fish', 'samphire', 'pottage'], festival: 'The Low Water',
    greeting: 'Come in off the wet.', nameStyle: 'fen',
    trades: { fisher: 5, thatcher: 4, boatwright: 3, herbalist: 3, innkeeper: 2, weaver: 2, keeper: 2 },
  }),
  stonewake: c('stonewake', {
    name: 'stonewake', build: O.wall_stone, roof: 'slate', floor: T.floor_flag,
    wall: 'stone', signature: O.standing_stone, plazaProp: O.cairn,
    foods: ['bread', 'pottage'], festival: 'Stone-Counting',
    greeting: 'Aye.', nameStyle: 'stone',
    trades: { smith: 5, shepherd: 4, digger: 3, innkeeper: 2, scholar: 2, potter: 2, farmer: 2 },
  }),
  saltmarch: c('saltmarch', {
    name: 'saltmarch', build: O.wall_timber, roof: 'tar', floor: T.floor_wood,
    wall: 'none', signature: O.drying_rack, plazaProp: O.boat_wreck,
    foods: ['dried_fish', 'samphire'], festival: 'The Wrack',
    greeting: 'Wind\'s round.', nameStyle: 'salt',
    trades: { fisher: 5, boatwright: 4, cooper: 3, innkeeper: 2, tanner: 2, weaver: 2 },
  }),
  tallgrass: c('tallgrass', {
    name: 'tallgrass', build: O.wall_cob, roof: 'thatch', floor: T.thatch_floor,
    wall: 'hedge', signature: O.scarecrow, plazaProp: O.well,
    foods: ['bread', 'pottage', 'greens'], festival: 'Sheaf Day',
    greeting: 'Good day to you.', nameStyle: 'soft',
    trades: { farmer: 6, miller: 3, baker: 3, carter: 3, innkeeper: 2, smith: 2, weaver: 2 },
  }),
  bellhold: c('bellhold', {
    name: 'bellhold', build: O.wall_stone, roof: 'tile', floor: T.floor_flag,
    wall: 'stone', signature: O.bell_frame, plazaProp: O.bell_frame,
    foods: ['bread', 'honey', 'pottage'], festival: 'The Ringing',
    greeting: 'Ring you well.', nameStyle: 'soft',
    trades: { bellringer: 4, smith: 3, scholar: 3, baker: 3, innkeeper: 3, herbalist: 2, potter: 2 },
  }),
  ashkin: c('ashkin', {
    name: 'ashkin', build: O.wall_timber, roof: 'turf', floor: T.floor_flag,
    wall: 'palisade', signature: O.forge, plazaProp: O.hearth,
    foods: ['dried_fish', 'bread'], festival: 'Emberwake',
    greeting: 'Sit by it.', nameStyle: 'ash',
    trades: { smith: 5, tanner: 3, potter: 3, carter: 2, innkeeper: 2, keeper: 3, herbalist: 2 },
  }),
};
for (const k of Object.keys(CULTURES)) Object.freeze(CULTURES[k]);
Object.freeze(CULTURES);

/** What each trade wants, gives, and keeps in their home. */
export const TRADES = Object.freeze({
  weaver: { values: ['craft'], prop: 'loom', gives: ['wool'], wants: ['wool'], service: null },
  smith: { values: ['craft'], prop: 'anvil', gives: ['repair_kit'], wants: ['river_clay'], service: 'smith' },
  innkeeper: { values: ['custom'], prop: 'table', gives: ['pottage'], wants: ['greens'], service: 'inn' },
  herbalist: { values: ['curiosity'], prop: 'mortar', gives: ['antidote'], wants: ['nettle'], service: 'herbalist' },
  farmer: { values: ['family'], prop: 'kitchen_garden', gives: ['greens'], wants: ['seed_packet'], service: null },
  fisher: { values: ['safety'], prop: 'drying_rack', gives: ['dried_fish'], wants: ['rope'], service: null },
  shepherd: { values: ['custom'], prop: 'goat_pen', gives: ['wool'], wants: ['bread'], service: null },
  baker: { values: ['family'], prop: 'hearth', gives: ['bread'], wants: ['honey'], service: 'market' },
  carter: { values: ['curiosity'], prop: 'wood_stack', gives: ['firewood'], wants: ['bread'], service: 'market' },
  miller: { values: ['craft'], prop: 'mill_wheel', gives: ['bread'], wants: ['firewood'], service: null },
  cooper: { values: ['craft'], prop: 'barrel', gives: ['oil_flask'], wants: ['firewood'], service: 'market' },
  thatcher: { values: ['craft'], prop: 'wood_stack', gives: ['firewood'], wants: ['rope'], service: null },
  digger: { values: ['safety'], prop: 'wood_stack', gives: ['river_clay'], wants: ['bread'], service: null },
  keeper: { values: ['custom'], prop: 'standing_lantern', gives: ['oil_flask'], wants: ['tallow'], service: 'market' },
  tanner: { values: ['craft'], prop: 'drying_rack', gives: ['tallow'], wants: ['salt'], service: null },
  potter: { values: ['craft'], prop: 'barrel', gives: ['river_clay'], wants: ['firewood'], service: 'market' },
  scholar: { values: ['curiosity'], prop: 'table', gives: ['ledger_fragment'], wants: ['name_shard'], service: 'herbalist' },
  bellringer: { values: ['custom'], prop: 'bell_frame', gives: ['bell_cap'], wants: ['wool'], service: null },
  boatwright: { values: ['craft'], prop: 'boat', gives: ['firewood'], wants: ['tallow'], service: null },
  beekeeper: { values: ['family'], prop: 'beehive', gives: ['honey'], wants: ['greens'], service: 'market' },
});

export const TRADE_KEYS = Object.freeze(Object.keys(TRADES));
