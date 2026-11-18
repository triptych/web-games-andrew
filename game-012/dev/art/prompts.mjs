/**
 * prompts.mjs — the fal jobs for Arcana Pull's art, built from the game's own data so every picture matches its card,
 * its Hollow or its Threshold, and can be painted again. Prints JSON: [{ name, system_prompt, prompt, aspect_ratio, resolution }].
 *
 *   node game-012/dev/art/prompts.mjs            # every job
 *   node game-012/dev/art/prompts.mjs pilot      # one of each kind
 *   node game-012/dev/art/prompts.mjs cards      # or: foes, realms, scenes, rest
 *   node game-012/dev/art/prompts.mjs sheets     # the sheet → ids table that export.py needs
 *
 * Model: fal-ai/nano-banana-2, PNG. Raw files go to a RAW folder as <name>.png, then
 * `python3 -I game-012/dev/art/export.py RAW SHEETS.json` writes game-012/art/.
 */
import { CARDS, CARD_IDS } from '../../js/sim/data/cards.js';
import { ENEMIES, TRIALS } from '../../js/sim/data/enemies.js';

export const STYLE = 'You paint for ARCANA PULL, an original fantasy tarot card-battler. Every image is a luminous Art Nouveau '
    + 'tarot painting: elegant flowing ink linework, rich gouache with touches of gold leaf, a deep midnight indigo and violet '
    + 'night palette lit by jewel-toned light, dramatic and heroic. The painting fills the whole canvas edge to edge: no border, '
    + 'no ornamental frame, no card edge, no paper margin. Original characters only. Never include any text, letters, numbers, '
    + 'roman numerals, captions, labels, logos, signatures or watermarks anywhere.';
const HOLLOW = 'These are the Hollows, dark reversed shadows of the tarot: eerie and menacing but not gory, cold violet, '
    + 'sickly green and ember highlights against deep black-indigo, each creature centred and fully visible.';
const SUIT_LIGHT = { major: 'golden starlight', wands: 'ember orange and crimson firelight', cups: 'sea teal and pearl moonlight',
    swords: 'silver and pale sky-blue windlight', pentacles: 'moss green and warm gold earthlight' };

const jobs = [];
const add = (group, name, prompt, aspect_ratio = '2:3', resolution = '1K', system) => jobs.push({ group, name, prompt, aspect_ratio, resolution, system });
const WHERE = ['Top left', 'Top right', 'Bottom left', 'Bottom right'];
const GRID = 'Four separate tall portrait paintings arranged in a 2x2 grid, each filling exactly one quarter of the image, '
    + 'divided by thin straight black gutters, no text. Each painting is a complete tarot card illustration of one subject, '
    + 'centred, with its own background. ';

const PAIR = 'Two separate tall portrait paintings side by side, each filling exactly one half of the image, divided by a thin '
    + 'straight black gutter, no text. Each painting is a complete tarot card illustration of one subject, centred, with its own background. ';
// The 78 cards, four to a 2K sheet (2x2, each cell 2:3), in deck order so a sheet is mostly one suit.
export const SHEETS = {};
for (let i = 0, s = 1; i < CARD_IDS.length; i += 4, s++) {
    const ids = CARD_IDS.slice(i, i + 4);
    SHEETS['cards-' + s] = ids;
    const line = (id) => `${CARDS[id].art}, lit by ${SUIT_LIGHT[CARDS[id].suit]}.`;
    if (ids.length === 2) {   // the last two cards: a pair side by side, not a half-empty grid
        add('cards', 'cards-' + s, PAIR + ids.map((id, k) => `${['Left', 'Right'][k]}: ${line(id)}`).join(' '), '4:3', '2K');
    } else add('cards', 'cards-' + s, GRID + ids.map((id, k) => `${WHERE[k]}: ${line(id)}`).join(' '), '2:3', '2K');
}
// The Hollows, four to a sheet; The World alone at 1K.
const foeIds = Object.keys(ENEMIES).filter((id) => id !== 'the_world');
for (let i = 0, s = 1; i < foeIds.length; i += 4, s++) {
    const ids = foeIds.slice(i, i + 4);
    SHEETS['foes-' + s] = ids;
    add('foes', 'foes-' + s, GRID + HOLLOW + ' ' + ids.map((id, k) => `${WHERE[k]}: ${ENEMIES[id].art}.`).join(' '), '2:3', '2K');
}
add('foes', 'foe-the_world', `A single tarot card illustration. ${HOLLOW} ${ENEMIES.the_world.art}.`, '2:3', '1K');

// The Thresholds: one backdrop each, wide, with the lower half calm enough for cards to stand on.
for (const t of TRIALS) {
    add('realms', 'realm-' + t.id, `A wide panoramic fantasy landscape painting, no figures in the foreground: ${t.realm}. `
        + 'The lower third is open ground in soft shadow; the light falls on the middle distance.', '16:9', '2K');
}
add('scenes', 'title', 'A wide painting: a mysterious cartomancer\'s parlour at night seen from across a round table draped in '
    + 'violet velvet, a glowing well of starlight in the middle of the table from which tarot cards rise in a spiral of golden light, '
    + 'candles, a crystal ball, hanging brass astrolabes. Behind it, tall arched windows open onto a deep starry night sky and a '
    + 'violet nebula that rise all the way to the top edge of the painting: one continuous painted scene from the table to the top '
    + 'edge, never a plain band, panel or empty strip.', '16:9', '2K');
// v2.0.0: the first take asked to "keep the upper third calm for a title" and came back with a flat empty band across the top
add('scenes', 'parlour', 'A wide painting of a cosy, mysterious cartomancer\'s study at night: shelves of old books and jars, '
    + 'a large ornate brass-rimmed well of swirling starlight set into the floor, velvet curtains, candles, an orrery, '
    + 'a window showing ten distant floating islands in a violet sky. No people.', '16:9', '2K');
add('scenes', 'cardback', 'A symmetrical ornate tarot card back that fills the whole image edge to edge: an all-seeing eye inside '
    + 'a radiant eight-pointed star at the centre, a crescent moon above and a sun below, fine gold filigree and stars on deep '
    + 'midnight indigo, a repeating geometric lattice. Flat, front-on, decorative, no text.', '2:3', '1K');
add('scenes', 'reading', 'Seen from directly above: a round table of dark wood covered in a midnight-blue velvet cloth embroidered '
    + 'with golden constellations and a large faint circle of zodiac glyphs, a few candles and scattered crystals at the very edge. '
    + 'The middle is empty cloth. Flat, no perspective.', '16:9', '2K');
add('scenes', 'ending', 'A wide triumphant painting: the cosmos restored, a radiant golden wreath of stars around a peaceful world '
    + 'of green lands and blue seas, the twenty-two great tarot figures as tiny glowing silhouettes standing on floating islands '
    + 'around it, dawn light breaking.', '16:9', '2K');
add('scenes', 'over', 'A wide melancholy painting: a cartomancer\'s round table at night after a storm, tarot cards scattered and '
    + 'face down, a guttering candle, the well of starlight gone dark and cracked, cold blue moonlight through a window.', '16:9', '1K');

const PILOT = ['title', 'cardback', 'cards-1', 'foes-1', 'realm-1'];
const which = process.argv[2];
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
    if (which === 'sheets') console.log(JSON.stringify(SHEETS));
    else {
        const out = !which ? jobs : which === 'pilot' ? jobs.filter((j) => PILOT.includes(j.name))
            : which === 'rest' ? jobs.filter((j) => !PILOT.includes(j.name)) : jobs.filter((j) => j.group === which || j.name === which);
        console.log(JSON.stringify(out.map(({ group, system, ...j }) => ({ ...j, system_prompt: system || STYLE })), null, 1));
    }
}
export { jobs };
