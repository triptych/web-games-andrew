/**
 * prompts.mjs — the fal jobs for CLEAN SLATE's art, built from the game's own data so the pictures
 * match the cards and the rivals and can be regenerated. Prints JSON: [{ name, system_prompt, prompt,
 * aspect_ratio, resolution }].
 *
 *   node game-139/dev/art/prompts.mjs            # every job
 *   node game-139/dev/art/prompts.mjs pilot      # one of each kind
 *   node game-139/dev/art/prompts.mjs rivals     # or: cards, partners, rooms, scenes
 *
 * Model: fal-ai/nano-banana-2, PNG. Raw files go to a RAW folder as <name>.png, then
 * `python3 -I game-139/dev/art/export.py RAW` writes game-139/art/.
 */
import { CARDS } from '../../js/sim/data/cards.js';
import { RIVALS } from '../../js/sim/data/rivals.js';

export const STYLE = 'You illustrate CLEAN SLATE, a cosy, wry fantasy card game about a retired assassin who opens a tavern. '
    + 'Every image is a rich hand-painted storybook illustration in the manner of an antique tarot deck: warm oil-paint '
    + 'textures over confident ink linework, candlelit amber and honey tones against deep teal and plum shadows, soft '
    + 'painterly edges, a gentle sense of humour. The painting always fills the entire canvas to every edge: no paper margin, '
    + 'no torn or deckled paper edges, no white border. Original characters only. Never include any text, letters, numbers, '
    + 'runes, logos, signatures, watermarks, borders, frames, card edges or user-interface elements anywhere in the image.';

const VIGNETTE = 'A single still-life vignette, centred and filling most of the square, on a softly blurred dark '
    + 'tavern background that fades to deep shadow at the edges. No people unless described.';
const PORTRAIT = 'A three-quarter-length character portrait, the figure centred and facing the viewer, inside a warm, '
    + 'softly blurred candlelit tavern background. Expressive, characterful face, a little comedic.';

const jobs = [];
const add = (group, name, prompt, aspect_ratio = '1:1', resolution = '1K') => jobs.push({ group, name, prompt, aspect_ratio, resolution });

for (const r of Object.values(RIVALS)) add('rivals', 'rival-' + r.id, `${PORTRAIT} The character: ${r.art}.`, '3:4');

// Card pictures come four to a 2K sheet (a 2x2 grid), cut apart by export.py: SHEETS lists which
// card is in which quarter (top left, top right, bottom left, bottom right). Partners reuse their
// rival's portrait. The pilot's card-habit and card-stew were single images and are kept.
export const SINGLE_CARDS = ['habit', 'stew'];
const sheetCards = Object.values(CARDS).filter((c) => c.art && !c.partner && !SINGLE_CARDS.includes(c.id));
export const SHEETS = [];
for (let i = 0; i < sheetCards.length; i += 4) SHEETS.push(sheetCards.slice(i, i + 4).map((c) => c.id));
SHEETS.forEach((ids, n) => {
    const where = ['Top left', 'Top right', 'Bottom left', 'Bottom right'];
    add('cards', 'sheet-' + (n + 1), 'Four separate square still-life paintings arranged in a 2x2 grid, each filling exactly '
        + 'one quarter of the image, divided by thin straight dark gutters. Each painting is a single centred vignette on a '
        + 'softly blurred dark tavern background, no people unless described. '
        + ids.map((id, k) => `${where[k]}: ${CARDS[id].art}.`).join(' '), '1:1', '2K');
});
// v1.1.1: the first title came back as a storybook page (a strip of sky with a torn-paper picture laid over it), which
// no edge trim can remove; this one-seamless-painting wording and system prompt fixed it (seed 7742 is the take in art/).
export const SEAMLESS = STYLE.replace('rich hand-painted storybook illustration in the manner of an antique tarot deck:', 'rich hand-painted illustration with')
    .replace(/The painting always fills[^.]*\./, 'Every image is one seamless painting that fills the whole canvas edge to edge: never a page, never a torn or deckled paper edge, never a white or cream border, never an inset picture, frame or panel inside the image.');
add('scenes', 'title', 'One single continuous full-bleed painting with no borders of any kind. Dusk outside a crooked, charming three-storey '
    + 'timber tavern on a cobbled street, warm light spilling from every window, a blank freshly painted hanging sign with no writing. '
    + 'In the foreground, seen from behind, a lone innkeeper in a long dark coat and an apron stands looking up at the sign, an old '
    + 'dagger tucked away, unused, in a back pocket. Lanterns, fireflies, a purple and orange sky. The rooftops rise directly into the '
    + 'sky with nothing in between: the sky, the buildings and the street are all one uninterrupted scene, not a picture placed on top '
    + 'of another picture. Keep the upper third calm open sky for a title.', '16:9', '2K');
jobs.at(-1).system = SEAMLESS; jobs.at(-1).seed = 7742;
add('scenes', 'table', 'Seen exactly from directly above: the surface of a large, old, well-loved tavern table made of '
    + 'wide dark oak planks, worn smooth, with faint mug rings, a few knife scratches and wax drips, evenly lit by warm '
    + 'candlelight. Nothing on the table. Fills the whole frame edge to edge, flat, no perspective, no objects.', '16:9', '2K');
add('scenes', 'cardback', 'A symmetrical ornate playing-card back design that fills the whole image edge to edge: a '
    + 'crossed dagger and soup ladle at the centre inside a wreath of hops and keys, fine gold filigree on deep teal, '
    + 'repeating diamond pattern around it. Flat, front-on, decorative, no text.', '2:3');
add('scenes', 'rivalback', 'A symmetrical ornate playing-card back design that fills the whole image edge to edge: '
    + 'a single dark rose with thorns wrapped around a broken dagger at the centre, fine silver filigree on deep oxblood red, '
    + 'repeating lattice pattern around it. Flat, front-on, decorative, no text.', '2:3');
add('scenes', 'ending', 'A full, joyful tavern at night, seen from the doorway: a crowd of colourful eccentric '
    + 'characters laughing around tables, a gentle giant singing, a stern nun smiling into her tea, an elegant old woman in '
    + 'black lace by the fire with a bowl of stew, mugs raised. Golden warm light.', '16:9');
add('scenes', 'over', 'A lonely dark tavern after closing, rain on the windows, every chair upturned on the tables, '
    + 'a single dagger stuck upright in the middle of the bar under one guttering candle.', '16:9');

const which = process.argv[2];
if (which === 'sheets') { console.log(JSON.stringify(SHEETS)); process.exit(0); }
const PILOT = ['title', 'table', 'cardback', 'rival-brannoc', 'card-stew', 'card-habit'];
const out = !which ? jobs : which === 'pilot' ? jobs.filter((j) => PILOT.includes(j.name))
    : which === 'rest' ? jobs.filter((j) => !PILOT.includes(j.name)) : jobs.filter((j) => j.group === which);
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
    console.log(JSON.stringify(out.map(({ group, system, ...j }) => ({ ...j, system_prompt: system || STYLE })), null, 1));
}
export { jobs };
