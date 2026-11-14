/**
 * prompts.mjs — the fal jobs for Pinch & Place's art, built from the game's own data so the art
 * matches it and can be regenerated. Prints JSON: [{ name, system_prompt, prompt, aspect_ratio, resolution }].
 *
 *   node game-136/dev/art/prompts.mjs            # every job
 *   node game-136/dev/art/prompts.mjs pilot      # one of each kind
 *   node game-136/dev/art/prompts.mjs portraits  # or: title, motifs
 *
 * Model: fal-ai/nano-banana-2, PNG. Raw files go to a RAW folder named <name>.png, then
 * `python3 -I game-136/dev/art/export.py RAW` writes game-136/art/.
 */
import { LEVELS } from '../../js/sim/data/levels.js';
import { KINDS } from '../../js/sim/data/catalog.js';

const CLAY = 'Claymation stop-motion style: everything is hand-sculpted from smooth matte plasticine modelling clay, '
    + 'with soft visible thumbprints and gentle tool marks, rounded chunky shapes, bright cheerful colours, '
    + 'warm soft studio lighting, like a handmade miniature from a cosy stop-motion film. '
    + 'No text, letters, numbers, logos, signatures, frames, borders or UI anywhere in the image.';
// People get faces; nothing else does (game-135's trucks grew eyes).
const PEOPLE = CLAY + ' Characters have simple friendly clay faces with small round black bead eyes.';
const THINGS = CLAY + ' The objects are ordinary things, NOT characters: no faces, no eyes, no mouths on any object, the sun or the clouds.';

const jobs = [];
jobs.push({
    name: 'title', group: 'title', system_prompt: THINGS, aspect_ratio: '16:9', resolution: '2K',
    prompt: 'A cosy isometric miniature diorama of a little bedroom-living room, cut away like a doll\'s house with two back walls, '
        + 'sitting on a wooden craft table. Everything in the room is made of colourful modelling clay: a puffy bed with a blue blanket, '
        + 'a red armchair, a striped rug, a floor lamp glowing warmly, two framed pictures, a potted plant and a teddy bear. '
        + 'Around the diorama on the table: lumps and coils of coloured clay, a wooden sculpting tool and a rolling pin. '
        + 'Soft morning light, shallow depth of field. The diorama sits in the right half of the picture; '
        + 'the left third is calm, softly blurred table and warm wall, with nothing in it.',
});
for (const L of LEVELS) {
    jobs.push({
        name: 'por-' + L.id, group: 'portraits', system_prompt: PEOPLE, aspect_ratio: '1:1', resolution: '1K',
        prompt: `A head-and-shoulders portrait of a claymation character: ${L.art}. Facing the viewer, centred, filling most of the picture. `
            + 'Plain flat solid magenta (#ff00ff) background, evenly lit, with no shadow on the background and nothing else in the picture.',
    });
}
KINDS.picture.motifArt.forEach((art, i) => {
    jobs.push({
        name: 'motif-' + KINDS.picture.motifs[i].toLowerCase(), group: 'motifs', system_prompt: THINGS, aspect_ratio: '1:1', resolution: '1K',
        prompt: `A small flat clay relief picture seen straight on: ${art}. Pressed plasticine shapes on a smooth clay background, `
            + 'like a child\'s modelling-clay painting. The picture fills the whole square edge to edge: no frame, no border, no table, no wall.',
    });
});

const which = process.argv[2];
const PILOT = ['title', 'por-pip', 'motif-sun'];
const out = !which ? jobs : which === 'pilot' ? jobs.filter((j) => PILOT.includes(j.name)) : jobs.filter((j) => j.group === which);
console.log(JSON.stringify(out.map(({ group, ...j }) => j), null, 1));
