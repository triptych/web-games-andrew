/**
 * prompts.mjs — every fal request for NEBULA REQUIEM's art, built from the game's own data tables.
 *
 *   node game-144/dev/art/prompts.mjs            # prints [{ name, input }] as JSON
 *   node game-144/dev/art/prompts.mjs names      # just the names
 *
 * Model: fal-ai/nano-banana-2 (the "fierce" pilot portraits are fal-ai/nano-banana-2/edit of the base portrait).
 */
import { PILOTS } from '../../js/sim/data/pilots.js';
import { STAGES, ENDLESS, BOSSES, CAST } from '../../js/sim/data/world.js';

export const STYLE = [
    'You are the art director of NEBULA REQUIEM, a premium anime space-opera shoot-em-up.',
    'Every image is a high-end Japanese anime key visual: clean confident line art, cel shading with soft gradients,',
    'luminous glowing light effects, dramatic rim lighting, rich saturated colours against deep space blacks,',
    'in the tradition of late-90s and 2000s mecha and space-opera anime films. Cinematic composition.',
    'Never include any text, letters, numbers, logos, captions, speech bubbles, watermarks, signatures, borders,',
    'frames, panels or user-interface elements.',
].join(' ');

const KEY = 'Plain flat solid pure green (#00ff00) background, nothing else behind the figure, no shadow on the background.';
const BUST = 'Isolated on a plain flat pure chroma-key green (#00ff00) background. Anime character portrait, head and shoulders to mid-chest, facing three-quarters toward the viewer, centred.';

const jobs = [];
const add = (name, prompt, aspect_ratio, resolution = '1K') => jobs.push({ name, endpoint: 'fal-ai/nano-banana-2', input: { prompt, aspect_ratio, resolution, system_prompt: STYLE, output_format: 'png' } });

// Pilots and cast: dialogue and select-screen portraits, cut out of the green key.
for (const p of PILOTS) add(`por-${p.id}`, `${BUST} ${p.art}. ${KEY}`, '3:4');
for (const [id, c] of Object.entries(CAST)) if (c.art) add(`por-${id}`, `${BUST} ${c.art}. ${KEY}`, '3:4');

// Cutscenes: 16:9 anime film stills.
const P = Object.fromEntries(PILOTS.map((p) => [p.id, p]));
const CS = {
    'cs-opening': `A colossal alien biomechanical armada shaped like singing angels and cathedral organs emerging from a glowing nebula, a human battle fleet exploding in front of it near Saturn, beams of white light, a star going dark in the distance, epic wide shot. ${STAGES[0].art}`,
    'cs-launch': 'Three sleek prototype starfighters launching in formation from the catapult deck of a huge white space carrier, one azure blue, one crimson red, one violet black, engine trails glowing, the carrier hangar lights streaming past, dynamic angle, Saturn in the background',
    'cs-sora-1': `Inside a starfighter cockpit, ${P.sora.art}, looking at an open silver locket holding a tiny photo of her older sister, a tear in her eye, the glowing nebula through the canopy behind her`,
    'cs-sora-2': `A floating crystal chamber of light, ${CAST.hikari.art}, opening her eyes and reaching out a hand toward a small azure starfighter approaching through the light, emotional reunion`,
    'cs-sora-end': `Two sisters embracing and weeping with joy in front of a starfighter cockpit in space, ${P.sora.art} hugging her older sister with long sky-blue hair in a torn azure pilot suit, a sunrise of a revived star behind them`,
    'cs-kaito-1': `Flashback: ${P.kaito.art}, standing on the bridge of a burning battleship near Saturn shouting an order, red alarm lights, explosions and fleeing ships through the viewport behind him`,
    'cs-kaito-2': `A wrecked giant crimson war robot falling and breaking apart in space with sparks and fire, in the foreground ${P.kaito.art} in his cockpit, saluting solemnly, glowing visor of the robot fading`,
    'cs-kaito-end': `${P.kaito.art}, standing alone before a vast memorial wall of engraved names on a space station, sunlight returning over Saturn through a huge window, dog tags in his hand, a quiet smile`,
    'cs-lyra-1': `A dark laboratory, ${P.lyra.art}, floating asleep inside a glowing violet liquid tank, six empty dark broken tanks beside hers, cables and alien tissue samples, eerie light`,
    'cs-lyra-2': `A vast white void of light, ${CAST.seraphine.art}, towering over and gently cupping the face of ${P.lyra.art}, who stands defiant, violet light against gold light`,
    'cs-lyra-end': `${P.lyra.art}, sitting on the wing of a black-violet starfighter parked on a grassy hill on Earth at dawn, watching her first sunrise, wind in her hair, a small genuine smile, birds in the sky`,
    'cs-cathedral': `A tiny starfighter approaching the open maw of a colossal gothic alien mothership many kilometres long, its hull like a bone cathedral with organ pipes and red glowing windows, scale is overwhelming. ${STAGES[2].art}`,
    'cs-heart': `A tiny starfighter flying toward the heart of a dying blue-white star, ${BOSSES.heart.art}, awe-inspiring scale`,
};
for (const [name, prompt] of Object.entries(CS)) add(name, `Anime film still, 16:9 cinematic. ${prompt}`, '16:9', '2K');

// Stage backdrops: wide painted space vistas (the view puts 3D parallax layers in front of these).
for (const s of STAGES) add(`bg-${s.id}`, `Wide painted anime space background, no characters, no ships in the centre, ${s.art}`, '16:9', '2K');
add('bg-endless', `Wide painted anime space background, no characters, ${ENDLESS.art}`, '16:9', '2K');

// Boss warning cards.
for (const [id, b] of Object.entries(BOSSES)) add(`boss-${id}`, `Dramatic anime mecha key art of a giant enemy, ${b.art}, menacing low angle, deep space`, '16:9', '1K');

// Title key visual.
add('title', `Anime key visual poster for a space shooter: three pilots in the foreground, ${P.sora.art}; ${P.kaito.art}; ${P.lyra.art}; behind them their three starfighters (azure, crimson, violet) streaking across a vast nebula toward a colossal angelic alien armada, epic and hopeful. Leave the upper third darker and empty for a title.`, '16:9', '2K');

// Fierce portraits: edits of the base portrait so the face holds.
export const EDITS = PILOTS.map((p) => ({ name: `por-${p.id}-fierce`, base: `por-${p.id}`, endpoint: 'fal-ai/nano-banana-2/edit', prompt: `Same character, same framing and art style, same plain flat pure green (#00ff00) background: ${p.fierce}.` }));

export const JOBS = jobs;

if (import.meta.url === `file://${process.argv[1]}`) {
    if (process.argv[2] === 'names') console.log(jobs.map((j) => j.name).join('\n'), `\n${jobs.length} jobs + ${EDITS.length} edits`);
    else console.log(JSON.stringify(jobs, null, 1));
}
