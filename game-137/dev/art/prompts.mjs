/**
 * prompts.mjs — the fal jobs for SHARDFRAME's art, built from the game's own data so the art
 * matches it and can be regenerated. Prints JSON: [{ name, system_prompt, prompt, aspect_ratio, resolution }].
 *
 *   node game-137/dev/art/prompts.mjs            # every job
 *   node game-137/dev/art/prompts.mjs pilot      # one of each kind
 *   node game-137/dev/art/prompts.mjs crew       # or: title, cast, scenes
 *
 * Model: fal-ai/nano-banana-2, PNG. Raw files go to a RAW folder named <name>.png, then
 * `python3 -I game-137/dev/art/export.py RAW` writes game-137/art/.
 */
import { CREW, CAST } from '../../js/sim/data/crew.js';
import { SECTORS } from '../../js/sim/data/missions.js';

const STYLE = 'Early-1990s Japanese TV anime cel animation style: hand-painted acetate cels with bold clean black ink outlines, '
    + 'flat cel shading with crisp two-tone hard-edged shadows and a single highlight, slightly grainy warm VHS-era film colour, '
    + 'painted watercolour-and-gouache backgrounds, dramatic lighting, vivid saturated palette. '
    + 'Original characters and machines that do not resemble any existing anime or game franchise. '
    + 'No text, letters, numbers, logos, signatures, watermarks, frames, borders, speech bubbles or UI anywhere in the image.';
// The hero mech, described the same way everywhere it appears.
const MECH = 'Shardframe Unit-07, an original lean bipedal walking mech about eight metres tall, '
    + 'white armour with red chest and blue shoulder panels, a single glowing green visor eye in an angular head, '
    + 'a rotary gun on its left arm and a boxy rocket pod on its right shoulder';
const KAIJU = 'giant monsters built entirely out of glowing magenta, violet and cyan cubes, like living voxel sculptures, with no faces';
const PORTRAIT_BG = 'Head-and-shoulders anime character portrait, facing three-quarters toward the viewer, centred, filling most of the square. '
    + 'Simple background: a soft two-colour gradient with faint radiating speed lines, like a 1990s anime eyecatch card.';

const jobs = [];
jobs.push({
    name: 'title', group: 'title', aspect_ratio: '16:9', resolution: '2K',
    prompt: `A dramatic 1990s anime key visual: ${MECH}, standing in a low heroic angle on a shattered plain at sunset, `
        + `firing a trail of rockets at a towering crowd of ${KAIJU}. One monster is exploding into a spray of hundreds of little coloured cubes. `
        + 'An orange and violet sky with long streaky clouds, sun flare behind the mech. '
        + 'Keep the left third of the picture calmer sky and distant hills with no characters in it, for a title.',
});
for (const [id, c] of Object.entries(CAST)) {
    jobs.push({ name: 'cast-' + id, group: 'cast', aspect_ratio: '1:1', resolution: '1K', prompt: `${PORTRAIT_BG} The character: ${c.art}.` });
}
for (const c of CREW) {
    jobs.push({ name: 'crew-' + c.id, group: 'crew', aspect_ratio: '1:1', resolution: '1K', prompt: `${PORTRAIT_BG} The character: ${c.art}. A warm, friendly expression.` });
}
for (const [id, s] of Object.entries(SECTORS)) {
    jobs.push({
        name: 'sector-' + id, group: 'scenes', aspect_ratio: '16:9', resolution: '1K',
        prompt: `A painted 1990s anime background establishing shot, no characters: ${s.art}. Small ${KAIJU} roam in the distance.`,
    });
}
jobs.push({
    name: 'hangar', group: 'scenes', aspect_ratio: '16:9', resolution: '1K',
    prompt: `A 1990s anime background painting of the hangar deck inside a flying carrier ship: ${MECH} stands in a maintenance gantry `
        + 'with cables plugged into it, sparks from welding, yellow-and-black hazard stripes on the floor, tool carts, warm work lights, '
        + 'big windows showing clouds outside. No people.',
});
jobs.push({
    name: 'ending', group: 'scenes', aspect_ratio: '16:9', resolution: '1K',
    prompt: `A peaceful 1990s anime ending scene: ${MECH} kneels on a green hill at dawn, damaged but standing, `
        + 'a crowd of tiny happy townsfolk waving below it, the last glowing cubes of a defeated monster drifting up into a clear golden sky like fireflies.',
});

const which = process.argv[2];
const PILOT = ['title', 'cast-kai', 'crew-hana', 'sector-prairie'];
const out = !which ? jobs : which === 'pilot' ? jobs.filter((j) => PILOT.includes(j.name)) : jobs.filter((j) => j.group === which);
console.log(JSON.stringify(out.map(({ group, ...j }) => ({ ...j, system_prompt: STYLE })), null, 1));
