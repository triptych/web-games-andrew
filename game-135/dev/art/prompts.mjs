// prompts.mjs — every image prompt for HARD HAT HARBOR, built from the game's own data tables, so the art matches the
// game and can be regenerated. `node game-135/dev/art/prompts.mjs [group]` prints a JSON array of
// { name, system_prompt, prompt, aspect_ratio, resolution }; groups: portraits, title, refs, all.
// portraits and title go to fal (fal-ai/nano-banana-2, PNG); refs go to Meshy (meshy-batch.mjs). See README.md.

import { GIVERS } from '../../js/sim/data/jobs.js';
import { VEHICLES } from '../../js/config.js';

const WORLD = 'HARD HAT HARBOR, a cheerful construction game for children about toy trucks rebuilding a small seaside town';
export const SYS = {
    toon: `You are the illustrator of ${WORLD}. Style: a 1990s children's CD-ROM edutainment cartoon: bold clean black outlines, flat bright primary colours with simple two-tone cel shading, friendly rounded shapes, big expressive eyes. No text, letters, logos, frames or UI.`,
    // scenes and objects: the first title came back with faces on the trucks (eyes in the windscreen AND eyes for
    // headlights, a second face on the bulldozer blade), which the in-game models don't have
    scene: `You are the illustrator of ${WORLD}. Style: a 1990s children's CD-ROM edutainment cartoon: bold clean black outlines, flat bright primary colours with simple two-tone cel shading, friendly rounded shapes. The vehicles and objects are ordinary toys, NOT characters: they have no faces, no eyes, no mouths, no eyebrows anywhere on them. No text, letters, logos, frames or UI.`,
    ref: `You are the toy designer of ${WORLD}. A single chunky die-cast toy rendered as a clean 3D game model: bright saturated glossy paint, simple rounded shapes, thick black rubber tyres or tracks, no driver, no people. ONE subject, whole subject visible and centred, three-quarter view from the front left and slightly above, soft even studio lighting, plain flat light-grey background, no shadow, no floor, no text, no logos, no brand names.`,
};

const job = (name, sys, prompt, aspect_ratio = '1:1', resolution = '1K') => ({ name, system_prompt: SYS[sys], prompt, aspect_ratio, resolution });

const portraits = Object.entries(GIVERS).map(([id, g]) => job(`por-${id}`, 'toon',
    `A head and shoulders portrait of ${g.name}, ${g.art}. Smiling warmly at the viewer, centred, on a plain flat sky-blue background.`));

const title = [
    job('title', 'scene', 'A wide cheerful scene: a yellow dump truck, a yellow bulldozer, a yellow excavator and a red crane truck, chunky toy vehicles parked in a row on a grassy hill at sunrise, looking down on a small colourful harbor town with a river, a half-built bridge, a clock tower and little houses. Big empty blue sky in the upper half. The trucks are plain toys with no faces at all: empty dark glass cab windows with nobody inside, simple round yellow headlights that are just lamps, plain metal grilles and bumpers, a plain bulldozer blade. Nothing in the picture has eyes or a mouth, not the trucks, not the sun, not the clouds.', '16:9', '2K'),
    job('badge', 'scene', 'A shiny golden construction hard hat, a plain helmet with no face, no eyes and no mouth, with one small embossed star on its front, sitting on a round red rosette ribbon award with two ribbon tails, centred, on a plain flat magenta (#ff00ff) background.'),
];

const VEH_ART = {
    dump: 'A yellow dump truck: a big empty tipper bed lowered flat, a rounded cab with an orange roof beacon, six chunky black wheels.',
    dozer: 'A yellow bulldozer: a wide curved steel blade at the front resting low, two black rubber crawler tracks, a small square cab with a roof.',
    digger: 'A yellow excavator: black crawler tracks, a round cab body, and a long two-part digging arm with a toothed bucket reaching forward and down to the ground.',
    roller: 'An orange road roller: one wide smooth silver steel drum at the front, two big black wheels at the back, an open driver seat under a small canopy roof.',
    crane: 'A red mobile crane truck: a long yellow lattice boom raised at 45 degrees pointing forward over the cab, eight chunky wheels, four small outrigger feet. No cable, no hook, no load.',
    wrecker: 'A green crawler crane for demolition: black tracks, a boxy green cab body, and a tall grey lattice boom raised steeply forward. No cable, no ball, no load.',
    loader: 'A blue farm tractor with a front loader: huge rear wheels, small front wheels, a wide silver bucket held low at the front on two lifting arms, an open cab with a roof.',
    mixer: 'A cement mixer truck: a white cab, and a big tilted mixing drum on the back with bold orange and white spiral stripes, a pouring chute at the rear, six wheels.',
};
const BUILD_ART = {
    townhall: 'A toy town hall building: red brick walls, four white columns at the front door, a green copper roof and a central clock tower with a round clock face. Standing on a thin square base.',
    school: 'A toy little red schoolhouse: red wooden walls, white window frames, a yellow front door, a small white bell tower on the grey roof. Standing on a thin square base.',
    cannery: 'A toy old abandoned cannery factory: dirty brown brick walls, a rusty saw-tooth corrugated roof, broken boarded windows, one cracked brick chimney, peeling paint. Standing on a thin square base.',
    barn: 'A toy red farm barn with white trim and big double doors, with a round grey grain silo attached at its side. Standing on a thin square base.',
    house: 'A toy cottage house: two storeys, cream walls, an orange tiled gable roof with a brick chimney, a round window in the gable, a red front door. Standing on a thin square base.',
    shop: 'A toy corner shop bakery: mint green walls, a big front window, a red and white striped awning over the door, a flat roof with a low parapet. Standing on a thin square base.',
};
const refs = [
    ...VEHICLES.map((v) => job(`ref-veh-${v.id}`, 'ref', VEH_ART[v.id])),
    ...Object.entries(BUILD_ART).map(([id, art]) => job(`ref-bld-${id}`, 'ref', art)),
];

export const GROUPS = { portraits, title, refs };

if (import.meta.url === `file://${process.argv[1]}`) {
    const g = process.argv[2] || 'all';
    const list = g === 'all' ? Object.values(GROUPS).flat() : GROUPS[g];
    console.log(JSON.stringify(list, null, 1));
    console.error(`${list.length} jobs`);
}
