// Starbase Spooky — the cast. `art` is the prompt each sprite was painted from with fal (dev/art/prompts.mjs),
// `voice` the casting note for ElevenLabs (dev/audio/README.md). Pure data.

export const CAST = {
    kit: {
        name: 'Kit',
        role: 'Junior Station Keeper (you!)',
        art: 'a cheerful 8-year-old kid space cadet with a round face, big friendly eyes, freckles and messy brown hair, wearing a puffy white-and-orange space suit with a star badge and chunky boots, holding a small wrench, standing in a three-quarter view facing right, full body',
        h: 84,
    },
    orby: {
        name: 'Orby',
        role: 'your robot helper',
        art: 'a small round floating helper robot shaped like a shiny teal ball with one big friendly cyan screen-eye, two tiny stubby arms, a little antenna with a glowing yellow tip and a small jet flame underneath, cute and toy-like, full body',
        h: 40,
        voice: 'Friendly, bouncy, slightly robotic little helper.',
    },
    ada: {
        name: 'Captain Ada Comet',
        role: 'the Station Captain, calling from Moon Base',
        art: 'a kind grandmother space captain with silver hair in a bun, round glasses, a big warm smile, a navy blue captain uniform with gold stars on the collar and a headset microphone, waist-up portrait facing the viewer',
        h: 120,
        voice: 'Warm, wise, cheerful grandmother.',
    },
    zorp: {
        name: 'Zorp',
        role: 'a tourist from the planet Glorp',
        art: 'a goofy lime-green blob alien tourist with three eyes on wobbly stalks, a huge happy grin with one tooth, wearing a loud orange Hawaiian shirt, a camera around its neck and a tiny sun hat, standing on stubby feet, full body',
        h: 96,
        voice: 'Excitable, goofy, gurgly tourist.',
    },
    gloobella: {
        name: 'Madame Gloobella',
        role: 'the most famous jelly singer in the galaxy',
        art: 'a grand pink jellyfish alien opera diva with a translucent glowing pink dome body, curly tentacles, long eyelashes, a sparkly purple feather boa and a little golden tiara, posing dramatically, floating, full body',
        h: 112,
        voice: 'Grand, dramatic, theatrical opera diva.',
        key: 'green',
    },
    snorkel: {
        name: 'Captain Snorkel',
        role: 'an ice-hauling space walrus trucker',
        art: 'a big jolly space walrus trucker with huge white tusks, a bushy grey moustache, a red trucker cap with a snowflake on it, a blue plaid flannel shirt and a puffy vest, holding a frosty block of ice under one flipper, standing, full body',
        h: 112,
        voice: 'Big, gruff, jolly old trucker.',
    },
    quasar: {
        name: 'Professor Quasar',
        role: 'a very clever squid scientist',
        art: 'a purple squid alien scientist with big curious eyes, a gold monocle, a tiny bow tie and a white lab coat, holding a bubbling green test tube in one tentacle and a clipboard in another, standing on curled tentacles, full body',
        h: 108,
        voice: 'Clever, fussy, enthusiastic professor.',
        key: 'green',
    },
    blipblop: {
        name: 'Blip & Blop',
        role: 'a two-headed alien who loves rockets',
        art: 'a small fuzzy orange alien with two round heads side by side on one body, each head with a single antenna and big googly eyes, one head grinning and one head giggling, wearing a tiny silver rocket backpack and red sneakers, full body',
        h: 92,
        voice: 'Two silly, fast-talking giggly kids finishing each other\'s sentences.',
    },
    ghost: {
        name: 'The Station Ghost',
        role: '???',
        art: 'a spooky but cute glowing ghost shape made of swirling pale blue mist with two big hollow dark eyes and wispy trailing tail, floating, like a bedsheet ghost made of light, full body',
        h: 96,
        key: 'magenta',
    },
    wisp: {
        name: 'Wisp',
        role: 'a lost baby Glimmerling',
        art: 'an adorable tiny baby space creature made of glowing soft blue and lavender light, round body like a little glowing jellybean with big sparkly eyes, rosy cheeks, two tiny wing-like fins and a little curly glowing tail, floating, full body',
        h: 64,
        voice: 'Tiny, shy, sweet baby creature.',
        key: 'green',
    },
    mama: {
        name: 'Mama Glimmer',
        role: 'Wisp\'s mother, as big as a spaceship',
        art: 'a huge gentle space whale creature made of glowing blue, lavender and gold starlight, with kind sleepy eyes, long flowing fins like nebula clouds and tiny stars twinkling inside her body, swimming, full body side view facing left',
        h: 220,
        voice: 'Deep, soft, kind and motherly, echoing.',
        key: 'green',
    },
};

/** The visitor who docks on each day (1-based). */
export const VISITORS = ['zorp', 'gloobella', 'snorkel', 'quasar', 'blipblop'];
