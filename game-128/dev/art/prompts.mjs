/**
 * prompts.mjs — every fal request for Gemheart Saga's art, written from the game's own data tables.
 *
 *   node game-128/dev/art/prompts.mjs            # prints [{ name, input }] as JSON
 *   node game-128/dev/art/prompts.mjs names      # just the names
 *
 * Model: fal-ai/nano-banana-2. One shared system prompt keeps the set coherent. The raw renders are cut and sized by
 * export.py. Cell orders of the sheets are the indices the game uses (see export.py and js/assets.js).
 */
import { HEROES } from '../../js/sim/data/heroes.js';
import { REGIONS, NEMESES } from '../../js/sim/data/world.js';
import { EQUIP, CONSUMABLES } from '../../js/sim/data/items.js';
import { BUILDINGS, NPCS } from '../../js/sim/data/village.js';

export const SYSTEM = 'You are the art director of GEMHEART SAGA, a fantasy role-playing game in the tradition of the great 32-bit era: '
    + 'late-1990s Sega Saturn and Sony PlayStation 2D RPGs. Every image is premium 32-bit era pixel art: crisp visible square pixels on a fine grid, '
    + 'rich large palettes with smooth hue-shifted shading and soft highlights, clean dark outlines, subtle dithering, lush hand-placed detail and warm '
    + 'storybook lighting. Never include any text, letters, numbers, logos, watermarks, signatures, borders, frames or user-interface elements.';

const KEY = { m: 'plain flat solid magenta (#ff00ff) background', g: 'plain flat solid pure green (#00ff00) background' };
const SPRITE = (key) => `${KEY[key]}, no shadow, no ground, no text.`;
// subjects that are purple or violet go on green, everything else on magenta
const GREEN = new Set(['gloamspire', 'sovereign', 'rotroot']);

const jobs = [];
const add = (name, prompt, opt = {}) => jobs.push({ name, input: { prompt, system_prompt: SYSTEM, aspect_ratio: opt.ar || '1:1', resolution: opt.res || '1K', output_format: 'png', num_images: 1 } });

// ---------------------------------------------------------------- scenes
add('bg-title', 'Title screen illustration for a fantasy RPG: a huge glowing faceted crystal heart floating above a peaceful valley village at dusk, beams of ruby, sapphire, emerald and amethyst light fanning across the sky, rolling hills, a winding river, distant mountains and a dark ruined citadel silhouetted far to the east under a violet sky. Wide cinematic composition with open sky in the upper middle.', { ar: '16:9', res: '2K' });
add('bg-village', 'Briarwick, a cosy fantasy village seen from a gentle elevated three-quarter view on a sunny afternoon: cobbled lanes, timber-framed cottages, a village green with a stone well in the middle, a little stream with a wooden bridge, an inn, market stalls, a small temple dome, a blacksmith forge, a farm with wheat fields, a water mill and a slender wizard tower at the edges, flower boxes and lanterns, hills beyond.', { ar: '16:9', res: '2K' });
for (const r of REGIONS) add(`bg-${r.id}`, `Battle backdrop: ${r.art}. Wide side-on view with open ground across the lower half for combatants, no characters or creatures.`, { ar: '16:9' });

// ---------------------------------------------------------------- buildings (3x3 sheet, cell order = building.icon)
const byIcon = [...BUILDINGS].sort((a, b) => a.icon - b.icon);
add('sheet-buildings', `A 3 by 3 grid of nine separate isometric fantasy village buildings for a village-building game, each building alone and centred in its own cell with generous empty space around it, all drawn at the same scale and the same isometric angle. Left to right, top to bottom: ${byIcon.map((b, i) => `(${i + 1}) ${b.art}`).join('; ')}. ${SPRITE('m')}`, { res: '2K' });

// ---------------------------------------------------------------- heroes
for (const h of HEROES) {
    add(`spr-${h.id}`, `Full-body battle sprite of ${h.art}. Dynamic heroic battle stance, facing toward the RIGHT side of the image in three-quarter view, whole figure visible from head to feet, centred. ${SPRITE('m')}`);
    add(`por-${h.id}`, `Character portrait, head and shoulders, of ${h.portrait}. Looking slightly toward the viewer, expressive face, soft painterly blurred background of warm village lantern light.`);
}
for (const n of NPCS) add(`npc-${n.id}`, `Character portrait, head and shoulders, of ${n.art}. Looking toward the viewer, expressive friendly face, soft blurred background of a cosy village interior.`);

// ---------------------------------------------------------------- monsters: one 3x2 sheet per region, then the bosses
for (const r of REGIONS) {
    const key = GREEN.has(r.id) ? 'g' : 'm';
    add(`sheet-${r.id}`, `A 3 by 2 grid of six separate fantasy RPG monster battle sprites, each creature alone and centred in its own cell with empty space around it, whole body visible, every one facing toward the LEFT side of the image. Left to right, top to bottom: ${r.monsters.map((m, i) => `(${i + 1}) ${m.art}${m.rank === 'elite' ? ', drawn noticeably larger and more imposing' : ''}`).join('; ')}. ${SPRITE(key)}`, { ar: '3:2', res: '2K' });
}
const bosses = [...REGIONS.map((r) => r.boss), ...NEMESES];
for (const b of bosses) add(`boss-${b.id}`, `Full-body boss battle sprite of ${b.art}. Imposing and menacing, facing toward the LEFT side of the image, whole figure visible, centred. ${SPRITE(GREEN.has(b.id) ? 'g' : 'm')}`);

// ---------------------------------------------------------------- icons (4x4 sheets)
const GEM = 'a polished faceted jewel game piece for a match-3 puzzle, rounded square silhouette, bright specular highlight, chunky readable shape';
const gemCells = [
    `${GEM}: a steel-blue crystal with an embossed silver sword emblem`,
    `${GEM}: a rose-red heart-shaped crystal glowing softly`,
    `${GEM}: a deep red ruby, round brilliant cut`,
    `${GEM}: a deep blue sapphire, teardrop cut`,
    `${GEM}: a vivid violet amethyst, hexagonal cut`,
    `${GEM}: a clear white diamond star with rainbow sparkles`,
    'a cracked grey stone block game piece with moss in the cracks',
    'a black obsidian crystal game piece with a glowing red skull inside it',
    'two crossed heavy iron chains with a padlock',
    'an icy blue snowflake crystal',
    'a glowing translucent blue magic shield bubble',
    'a fierce red flame',
    'two crossed steel swords',
    'a jagged yellow lightning bolt',
    'a bright golden four-pointed sparkle star',
    'a bleached skull',
];
const sheet = (name, cells, key) => add(name, `A 4 by 4 grid of sixteen separate fantasy RPG inventory icons, each object alone and centred in its own cell with empty space around it, all drawn at the same scale. Left to right, top to bottom: ${cells.map((c, i) => `(${i + 1}) ${c}`).join('; ')}. ${SPRITE(key)}`, { res: '2K' });
sheet('icons-gems', gemCells, 'g');
const icon = (id) => [...EQUIP, ...CONSUMABLES].find((x) => x.id === id).art;
sheet('icons-gear', EQUIP.filter((e) => e.icon[0] === 'gear').sort((a, b) => a.icon[1] - b.icon[1]).map((e) => e.art), 'm');
const goods = [...EQUIP, ...CONSUMABLES].filter((e) => e.icon[0] === 'goods').sort((a, b) => a.icon[1] - b.icon[1]).map((e) => e.art);
sheet('icons-goods', [...goods, 'a thick purple spellbook with a glowing golden rune on the cover', 'a glowing golden experience star', 'a shiny red heart', 'a steel sword pointing up'], 'g');
sheet('icons-misc', [
    'a small pile of shiny gold coins', 'a bundle of chopped wooden logs tied with rope', 'a chunk of grey iron ore with copper flecks', 'a golden sheaf of wheat tied with twine',
    'a cluster of glowing pale blue mana crystals', `${GEM}: a vivid green emerald, square step cut`, icon('clover'), icon('emer_brooch'),
    'a dripping drop of bright green poison', 'the head of a friendly grey wolf', 'a wooden treasure chest with gold trim, lid open, overflowing with coins', 'a rolled quest parchment with a red wax seal',
    'a round steel kite shield', 'a golden trophy cup', 'a small brass lantern glowing warmly', 'a folded treasure map',
], 'm');

// ---------------------------------------------------------------- skill icons: painted square tiles, 3x3 per hero
// One picture per skill node, in tree order (branch by branch, tier by tier).
export const SKILL_ART = {
    kael: ['a flaming longsword slashing downward in a burst of fire', 'a gleaming steel sword with a silver aura', 'an executioner\'s axe over a cracked red skull',
        'a glowing blue kite shield with a sun emblem', 'a dark steel breastplate with rivets', 'a green heart with a gust of wind around it',
        'a broken golden sun sigil burning with violet and red fire', 'a raised sword with golden chevrons of valour', 'a battle horn with four coloured sparks'],
    sela: ['a crashing blue ocean wave', 'a deep well of glowing blue water seen from above', 'a swirling whirlpool pulling downward',
        'a lance of violet starlight piercing the dark', 'an open spellbook with weaving silver threads of magic', 'a goblet overflowing with glowing violet liquid',
        'a monster trapped inside a block of blue ice', 'a robe glazed with frost crystals', 'a block of ice shattering into shards'],
    fenn: ['three arrows flying in a fan', 'a sharp golden eye with a crosshair', 'an arrow splitting another arrow in a bullseye',
        'thorny green vines snaring a claw', 'a basket of berries, mushrooms and coins', 'a mortar and pestle with healing herbs',
        'a howling grey wolf with glowing eyes', 'three wolf paw prints', 'a winged boot trailing green wind'],
    odo: ['a brass lantern blazing with a blinding white flash', 'a flame burning inside a meditating figure\'s chest', 'a glowing hand breaking a stone block',
        'a blur of many glowing fists', 'a cloth-wrapped fist like iron', 'a yin-yang of water and flowing light',
        'two hands folded in prayer with golden healing light', 'a still lotus flower on calm water', 'a single candle flame burning bright in darkness'],
};
for (const h of HEROES) {
    add(`skills-${h.id}`, `A 3 by 3 grid of nine square fantasy RPG skill icons, separated by thin black gutters. Each icon fills its whole square with its own painted dark background and one bold symbolic image, readable at small size, in the colours of the ${h.title}. Absolutely no words, names, labels or captions anywhere in the image. Left to right, top to bottom: ${SKILL_ART[h.id].map((a, i) => `(${i + 1}) ${a}`).join('; ')}.`, { res: '2K' });
}

if (process.argv[2] === 'names') console.log(jobs.map((j) => j.name).join('\n'));
else if (process.argv[2] === 'one') console.log(JSON.stringify(jobs.find((j) => j.name === process.argv[3]).input));
else console.log(JSON.stringify(jobs, null, 1));
export default jobs;
