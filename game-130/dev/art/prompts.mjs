/**
 * prompts.mjs — every fal request for Starbase Spooky's art, built from the game's own data tables.
 *
 *   node game-130/dev/art/prompts.mjs            # prints [{ name, input }] as JSON
 *   node game-130/dev/art/prompts.mjs bg-deck spr-kit   # only these
 *
 * Model: fal-ai/nano-banana-2. One shared system prompt keeps the set coherent; backdrops are 16:9, sprites are
 * on a flat key colour that export.py cuts away. See dev/art/README.md.
 */
import { CAST } from '../../js/sim/data/cast.js';
import { ROOMS, SCENES } from '../../js/sim/data/rooms.js';

export const SYSTEM = 'You are the art director of Starbase Spooky, a 1990s 16-bit edutainment adventure game for young children, '
    + 'in the tradition of classic SNES and Amiga point-and-click games. Every image is premium 16-bit pixel art: crisp visible square '
    + 'pixels, bright cheerful saturated colours with soft hue-shifted shading, clean dark outlines, gentle dithering, and a cozy, silly, '
    + 'only-a-little-bit-spooky retro-future space station. Characters are cute, round and friendly, with big expressive eyes. '
    + 'Never include any text, letters, numbers, logos, watermarks, signatures, borders, frames or user-interface elements.';

const KEYS = { magenta: 'plain flat solid magenta (#ff00ff)', green: 'plain flat solid green (#00ff00)' };

const bg = (desc) => `${desc}. Side view, like a backdrop from a classic point-and-click adventure game, with a flat open floor along the bottom fifth where a character can walk, running right to the bottom edge with nothing in the foreground. `
    + 'The room is empty: no people, no characters, no aliens, no robots, no animals. Screens and signs show only simple shapes and glowing graphs, never any writing. Wide 16:9 framing.';

export function requests() {
    const out = [];
    for (const [id, r] of Object.entries(ROOMS)) {
        out.push({ name: `bg-${id}`, input: { prompt: bg(r.art), aspect_ratio: '16:9', resolution: '1K' } });
    }
    out.push({ name: 'bg-title', input: { prompt: `${SCENES.title}. Wide 16:9 framing.`, aspect_ratio: '16:9', resolution: '2K' } });
    out.push({ name: 'bg-station', input: { prompt: `${SCENES.station}. Wide 16:9 framing, the station fills the middle of the picture.`, aspect_ratio: '16:9', resolution: '1K' } });
    for (const [id, c] of Object.entries(CAST)) {
        const key = KEYS[c.key || 'magenta'];
        const ar = id === 'mama' ? '16:9' : id === 'ada' ? '1:1' : '3:4';
        out.push({ name: `spr-${id}`, input: { prompt: `A single game character sprite: ${c.art}. Centred, the whole figure visible with a little space around it. ${key} background, no shadow, no ground, no text.`, aspect_ratio: ar, resolution: '1K' } });
    }
    out.push({
        name: 'icons-items', input: {
            prompt: 'A 4 by 4 grid sheet of sixteen separate inventory item icons for a children\'s space adventure game, each centred in its own cell with plenty of space between them, in this order, left to right and top to bottom: '
                + '1 a blob of glowing sparkly blue-white goo, 2 a little pile of cookie crumbs with one half-eaten cookie, 3 a thick power cable with tiny round bite marks and a spark, '
                + '4 a retro cassette tape with little sound waves, 5 two tiny glowing blue footprints, 6 a rolled-out star chart scroll with a swirly nebula on it, '
                + '7 a handheld gadget with a dial and a glowing green screen and an antenna (a ghost detector), 8 a round cookie sparkling with starlight, 9 a glowing five-pointed star crystal in lavender and gold, '
                + '10 a shiny gold star sticker, 11 a silver wrench, 12 a chunky battery with a lightning bolt, 13 a glass fuse with a glowing filament, '
                + '14 a big thick blue book with a planet on its cover, 15 a folded space station map, 16 a spiral notebook with a magnifying glass. '
                + 'Plain flat solid magenta (#ff00ff) background everywhere, no grid lines, no borders, no numbers, no text.',
            aspect_ratio: '1:1', resolution: '2K',
        },
    });
    out.push({
        name: 'icons-planets', input: {
            prompt: 'A 3 by 3 grid sheet of nine separate round icons of our solar system, each centred in its own cell with plenty of space between them, in this order, left to right and top to bottom: '
                + 'the Sun (bright yellow-orange with a glow), Mercury (small grey and cratered), Venus (pale yellow-cream clouds), Earth (blue oceans, green land, white clouds), '
                + 'Mars (rusty red with a white polar cap), Jupiter (big, with orange and cream stripes and a red spot), Saturn (golden with wide bright rings, tilted), '
                + 'Uranus (pale cyan, with thin faint rings), Neptune (deep blue with white streaks). Each one drawn the same size so they fit the cells. '
                + 'Plain flat solid magenta (#ff00ff) background everywhere, no grid lines, no borders, no numbers, no text, no labels.',
            aspect_ratio: '1:1', resolution: '2K',
        },
    });
    for (const r of out) r.input = { system_prompt: SYSTEM, output_format: 'png', ...r.input };
    return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const only = process.argv.slice(2);
    const all = requests().filter((r) => !only.length || only.includes(r.name));
    console.log(JSON.stringify(all, null, 1));
}
