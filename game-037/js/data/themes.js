// ============================================================
// data/themes.js - Hollow themes (GDD §12.2). APPEND ONLY.
// Each supplies layout weights, palette, monster weights, props,
// problem weights and flavour.
// ============================================================
import { T } from './tiles.js';

const th = (key, name, o) => ({ key, name, ...o });

export const THEMES = {
  barrow: th('barrow', 'barrow', {
    layouts: { rooms: 8, grid: 3, warren: 2, cave: 1, ring: 1 },
    floor: T.dust, wall: T.wall_stone, water: T.water_hollow,
    monsters: { rat_swarm: 4, bell_shade: 3, stone_walker: 3, drowned_thing: 1, deep_folk: 1 },
    warden: 'stone_warden',
    problems: { lantern_line: 4, sleeping_pack: 3, quiet_naming: 4, the_wanderer: 2, weight_doors: 2 },
    palette: 'barrow',
    lore: [
      'Grave niches, and dust that has not been disturbed in a long time.',
      'There are names scratched here. Yours is not one of them. Not yet.',
      'Somebody swept this floor, and not very long ago.',
      'Name-plates, turned to the wall.',
      'A cup, set down on a ledge, with nothing in it.',
    ],
  }),
  flooded_mill: th('flooded_mill', 'flooded mill', {
    layouts: { ring: 6, rooms: 4, cave: 2, grid: 1, warren: 1 },
    floor: T.floor_flag, wall: T.wall_stone, water: T.water_hollow,
    monsters: { drowned_thing: 5, fen_lurcher: 4, mill_thing: 3, rat_swarm: 2 },
    warden: 'drowned_warden',
    problems: { rising_water: 5, weight_doors: 3, the_wanderer: 2, lantern_line: 2, collapse: 2 },
    palette: 'mill',
    lore: [
      'The wheel still turns. There is nothing left to grind.',
      'The water tastes of iron and something older than iron.',
      'A mill that ground more than grain.',
      'Sluice-marks on the wall, four hands above your head.',
      'Sacks, still stacked, gone to nothing inside.',
    ],
  }),
  hollow_root: th('hollow_root', 'hollow root', {
    layouts: { cave: 7, warren: 4, rooms: 1, ring: 1, grid: 0 },
    floor: T.root_floor, wall: T.root_wall, water: T.water_hollow,
    monsters: { root_thing: 6, midge_swarm: 3, wolf: 2, hollow_hound: 2 },
    warden: 'root_warden',
    problems: { hungry_dark: 4, sleeping_pack: 3, collapse: 3, the_wanderer: 3, guest: 2 },
    palette: 'root',
    lore: [
      'Roots, and between them a light that is not doing any good.',
      'Something grew down here on purpose.',
      'Spore-light, enough to see your own hands and nothing else.',
      'A root has grown through a chair and kept going.',
    ],
  }),
  stonewake_vault: th('stonewake_vault', 'stonewake vault', {
    layouts: { grid: 7, rooms: 4, ring: 2, cave: 0, warren: 0 },
    floor: T.floor_flag, wall: T.wall_stone, water: T.water_hollow,
    monsters: { stone_walker: 5, bell_shade: 3, deep_folk: 2, salt_thing: 2 },
    warden: 'stone_warden',
    problems: { weight_doors: 5, mirror_room: 4, quiet_naming: 3, lantern_line: 3 },
    palette: 'vault',
    lore: [
      'Everything here is square, and was meant to stay square.',
      'Pressure plates, worn in the middle. People walked this way for years.',
      'A statue with its face turned to the corner.',
      'The stone was counted before it was laid. You can see the numbers.',
    ],
  }),
  sunken_chapel: th('sunken_chapel', 'sunken chapel', {
    layouts: { ring: 5, rooms: 5, grid: 3, cave: 1, warren: 0 },
    floor: T.floor_flag, wall: T.wall_stone, water: T.water_hollow,
    monsters: { bell_shade: 5, drowned_thing: 3, wisp: 3, deep_folk: 1 },
    warden: 'quiet_warden',
    problems: { quiet_naming: 5, lantern_line: 4, guest: 3, sleeping_pack: 2 },
    palette: 'chapel',
    lore: [
      'Pews, and the water up to the second row.',
      'The bell is still here. The rope is not.',
      'Three cups on the ledge. Two have been used.',
      'Somebody stopped ringing, and then everybody did.',
    ],
  }),
  beast_warren: th('beast_warren', 'beast warren', {
    layouts: { cave: 6, warren: 6, rooms: 2, ring: 0, grid: 0 },
    floor: T.floor_cave, wall: T.wall_cave, water: T.water_hollow,
    monsters: { wolf: 5, hollow_hound: 4, rat_swarm: 3, fen_lurcher: 2 },
    warden: 'root_warden',
    problems: { sleeping_pack: 6, the_wanderer: 4, hungry_dark: 2, collapse: 2 },
    palette: 'warren',
    lore: [
      'A den, and the smell of a den.',
      'Bones arranged by nothing with hands.',
      'Something has been dragging things in here for years.',
    ],
  }),
  saltworks: th('saltworks', 'saltworks', {
    layouts: { grid: 5, rooms: 4, ring: 3, cave: 1, warren: 1 },
    floor: T.floor_salt, wall: T.wall_stone, water: T.water_hollow,
    monsters: { salt_thing: 5, crab_thing: 3, drowned_thing: 3, stone_walker: 2 },
    warden: 'salt_warden',
    problems: { weight_doors: 3, collapse: 4, rising_water: 3, the_wanderer: 3 },
    palette: 'saltworks',
    lore: [
      'Terraced pans, and salt standing in every one of them.',
      'The crust gives a little where you stand. Then a little more.',
      'Brine, and everything in it kept exactly as it was.',
    ],
  }),
  quiet_house: th('quiet_house', 'quiet house', {
    layouts: { rooms: 7, grid: 4, ring: 1, warren: 1, cave: 0 },
    floor: T.floor_wood, wall: T.wall_timber, water: T.water_hollow,
    monsters: { wisp: 4, bell_shade: 4, rat_swarm: 2 },
    warden: 'quiet_warden', quietLean: true,
    problems: { quiet_naming: 6, mirror_room: 4, guest: 3, hungry_dark: 2 },
    palette: 'house',
    lore: [
      'A kitchen. Somebody was going to come back to it.',
      'The table is laid for four and has been for a while.',
      'A child\'s shoe, and no child.',
      'The stairs go up. You came in at the bottom of a hill.',
    ],
  }),
  orchard_under: th('orchard_under', 'orchard under', {
    layouts: { grid: 5, rooms: 4, cave: 2, warren: 2, ring: 1 },
    floor: T.root_floor, wall: T.root_wall, water: T.water_hollow,
    monsters: { root_thing: 5, midge_swarm: 3, hollow_hound: 2, wisp: 2 },
    warden: 'root_warden',
    problems: { hungry_dark: 3, sleeping_pack: 3, quiet_naming: 3, guest: 3 },
    palette: 'orchard',
    lore: [
      'Rows, and walls between the rows, and fruit that is not fruit.',
      'The trees down here grow the wrong way up.',
      'Windfalls. Nothing has eaten them.',
    ],
  }),
  starwell: th('starwell', 'starwell', {
    layouts: { ring: 7, cave: 3, rooms: 2, grid: 1, warren: 0 },
    floor: T.bare_stone, wall: T.wall_stone, water: T.water_hollow,
    monsters: { bell_shade: 4, stone_walker: 4, wisp: 3, deep_folk: 2 },
    warden: 'quiet_warden',
    problems: { collapse: 4, the_wanderer: 4, lantern_line: 3, hungry_dark: 3 },
    palette: 'starwell',
    lore: [
      'A shaft, and a wind in it coming up from somewhere.',
      'The spiral goes down further than the hill is tall.',
      'Someone dropped a lantern here. You can hear it, still falling. You cannot.',
    ],
  }),
};
for (const k of Object.keys(THEMES)) Object.freeze(THEMES[k]);
Object.freeze(THEMES);

export const THEME_KEYS = Object.freeze(Object.keys(THEMES));

/** Floor problems (GDD §12.7). minDepth gates the harder ones. */
export const PROBLEMS = Object.freeze({
  rising_water: { key: 'rising_water', name: 'rising water', minDepth: 1, statement: 'The water is coming up. Something opened, further in.' },
  sleeping_pack: { key: 'sleeping_pack', name: 'sleeping pack', minDepth: 1, statement: 'Things are asleep in here. They will not stay asleep.' },
  lantern_line: { key: 'lantern_line', name: 'lantern line', minDepth: 1, statement: 'Four sconces, unlit. Something is counting them.' },
  weight_doors: { key: 'weight_doors', name: 'weighted doors', minDepth: 1, statement: 'The doors are held by counterweights. What you carry matters here.' },
  the_wanderer: { key: 'the_wanderer', name: 'the wanderer', minDepth: 2, statement: 'Something large is walking this floor, and it is not looking for you yet.' },
  collapse: { key: 'collapse', name: 'collapse', minDepth: 3, statement: 'The floor behind you is going. Keep moving.' },
  hungry_dark: { key: 'hungry_dark', name: 'the hungry dark', minDepth: 1, statement: 'Your light will not reach as far here. Something is drinking it.' },
  guest: { key: 'guest', name: 'a guest', minDepth: 1, statement: 'Someone is down here who should not be.' },
  mirror_room: { key: 'mirror_room', name: 'the mirror room', minDepth: 3, statement: 'What you do here, the room does a moment later.' },
  quiet_naming: { key: 'quiet_naming', name: 'the naming', minDepth: 1, statement: 'Three things here have lost their names. Give them back.' },
});
