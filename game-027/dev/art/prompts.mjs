/**
 * prompts.mjs — the fal jobs for Alchemist's Lattice, built from the game's own data so the pictures
 * match the cast, foes, elements, items and potions, and can be regenerated. Prints JSON:
 * [{ group, name, system, prompt, aspect_ratio, resolution }].
 *
 *   node game-027/dev/art/prompts.mjs              # every job
 *   node game-027/dev/art/prompts.mjs scenes       # or: cast, foes, things
 *   node game-027/dev/art/prompts.mjs sheets > SHEETS.json   # what is in each 2x2 sheet (for export.py)
 *
 * Model: fal-ai/nano-banana-2, PNG. Raw files go to a RAW folder as <name>.png, then
 * `python3 -I game-027/dev/art/export.py RAW SHEETS.json` writes game-027/art/.
 */
import { ELEMENTS } from '../../js/sim/data/elements.js';
import { FOES } from '../../js/sim/data/foes.js';
import { POTIONS, ITEMS, COIN_ART } from '../../js/sim/data/potions.js';
import { CHARACTERS } from '../../js/sim/data/story.js';

export const STYLE = "You illustrate ALCHEMIST'S LATTICE, a cozy fantasy alchemy puzzle game. Every image is a rich hand-painted "
    + 'illustration: warm oil-paint textures over fine ink linework, candlelit amber, brass and honey tones against deep teal and '
    + 'indigo shadows, a soft glow from potions and embers, gentle storybook whimsy. Every image is one seamless painting that fills '
    + 'the whole canvas edge to edge: never a page, never a torn or deckled paper edge, never a white or cream border, never a frame. '
    + 'Original characters only. Never include any text, letters, numbers, runes, symbols, logos, signatures, watermarks or '
    + 'user-interface elements anywhere in the image.';

const WHERE = ['Top left', 'Top right', 'Bottom left', 'Bottom right'];
const jobs = [];
const add = (group, name, prompt, aspect_ratio = '1:1', resolution = '1K') => jobs.push({ group, name, system: STYLE, prompt, aspect_ratio, resolution });

// ------------------------------------------------------------------ scenes
add('scenes', 'title', 'One continuous full-bleed painting. A cozy candlelit alchemist workshop at night seen from a little above: a '
    + 'heavy oak workbench in the foreground with a square brass-framed grid tray on it, half filled with small glowing coloured '
    + 'crystal blocks; around it shelves of bottles, hanging dried herbs, a bubbling copper cauldron over a small fire, an arched '
    + 'window with a deep blue starry sky. Keep the upper third darker and calm for a title.', '16:9', '2K');
add('scenes', 'workshop', 'One continuous full-bleed painting, softly out of focus like a background: the inside of a dim, warm '
    + 'alchemist workshop at night, shelves of glowing bottles on both sides, candles, a far arched window with starlight, '
    + 'drifting motes of light. Quiet and dark in the middle of the picture, nothing in the centre.', '16:9', '2K');
add('scenes', 'table', 'Seen exactly from directly above: the surface of an old dark oak alchemist workbench, worn smooth, with '
    + 'faint scorch marks, a few old potion rings and brass inlay strips along the grain, evenly lit by warm candlelight. Nothing '
    + 'on it. Fills the whole frame edge to edge, flat, no perspective, no objects.', '1:1', '1K');
add('scenes', 'map', 'Seen from directly above: an aged parchment-coloured painted landscape of rolling hills, a winding river, '
    + 'pine woods, a ruined tower, a mine entrance, misty caves and a distant walled town with a guild hall, painted like a '
    + 'beautiful old fantasy chart but with no writing and no compass rose. Soft, muted colours, plenty of open ground.', '16:9', '2K');
add('scenes', 'cauldron', 'One continuous full-bleed painting. A great black iron cauldron on three legs over a crackling fire in a '
    + 'stone alcove, a shimmering column of coloured light rising from it, little crystal blocks floating up in the steam, '
    + 'shelves of jars around it. The cauldron sits on the left third, the right side is calm shadowy wall.', '16:9', '2K');
add('scenes', 'shop', 'One continuous full-bleed painting. A cheerful cramped merchant stall inside a covered market at evening: '
    + 'wooden shelves crowded with vials, flasks, pouches and brass instruments, a striped awning, lanterns, a counter in front. '
    + 'No people. The left half is the stall, the right half is soft warm shadow.', '16:9', '2K');
add('scenes', 'ending', 'One continuous full-bleed painting. In a grand guild hall with tall stained windows of plain coloured glass '
    + '(no pictures, no writing), a young apprentice alchemist with tousled dark hair and brass goggles, in a navy robe, holds up '
    + 'a gleaming golden medallion shaped like a cauldron. A stern silver-haired woman in plum robes smiles beside them; a '
    + 'blond young man in a crimson coat applauds; a translucent spirit of blue light glows above. Warm golden light.', '16:9', '2K');

// ------------------------------------------------------------------ the cast: four expressions to a sheet
for (const c of Object.values(CHARACTERS)) {
    add('cast', 'cast-' + c.id, 'Four head-and-shoulders portraits of the SAME character arranged in a 2x2 grid, each filling exactly one '
        + 'quarter of the image, divided by thin straight dark gutters. Identical face, hair, clothes, lighting and framing in all four, '
        + 'the character centred and facing the viewer, a softly blurred warm candlelit workshop background. The character: '
        + `${c.art}. Expressions: ` + c.expressions.map((e, k) => `${WHERE[k].toLowerCase()} ${e}`).join(', ') + '.', '1:1', '2K');
}

// ------------------------------------------------------------------ foes: bosses alone, the rest four to a sheet
const VIGNETTE = 'centred, filling most of the frame, on a softly blurred dark background that fades to shadow at the edges';
const foes = Object.values(FOES).filter((f) => f.art);
for (const f of foes.filter((f) => f.boss)) add('foes', 'foe-' + f.id, `A dramatic creature portrait, ${VIGNETTE}: ${f.art}.`, '1:1', '1K');
const minions = foes.filter((f) => !f.boss).map((f) => ({ id: 'foe-' + f.id, art: f.art }));

// ------------------------------------------------------------------ elements, items, potions, the coin: four to a sheet
const things = [
    ...Object.values(ELEMENTS).map((e) => ({ id: 'el-' + e.id, art: e.art })),
    ...Object.values(ITEMS).map((i) => ({ id: 'item-' + i.id, art: i.art })),
    ...Object.values(POTIONS).map((p) => ({ id: 'potion-' + p.id, art: p.art })),
    { id: 'coin', art: COIN_ART },
];

export const SHEETS = {};
function sheets(group, prefix, list, kind) {
    for (let i = 0, n = 1; i < list.length; i += 4, n++) {
        const four = list.slice(i, i + 4);
        // a short last sheet repeats its own subjects in the empty quarters; export.py skips them (null)
        for (let k = 0; four.length < 4; k++) four.push({ id: null, art: four[k].art });
        const name = `${prefix}-${n}`;
        SHEETS[name] = four.map((t) => t.id);
        add(group, name, `Four separate square ${kind} arranged in a 2x2 grid, each filling exactly one quarter of the image, divided `
            + `by thin straight dark gutters. Each one is a single subject ${VIGNETTE}. `
            + four.map((t, k) => `${WHERE[k]}: ${t.art}.`).join(' '), '1:1', '2K');
    }
}
sheets('foes', 'foes', minions, 'creature paintings');
sheets('things', 'things', things, 'still-life paintings of alchemical objects');

const want = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
    if (want === 'sheets') console.log(JSON.stringify(SHEETS, null, 1));
    else console.log(JSON.stringify(want ? jobs.filter((j) => j.group === want) : jobs, null, 1));
}
export { jobs };
