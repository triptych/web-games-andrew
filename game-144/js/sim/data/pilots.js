// The three Seraph pilots. Pure data: the sim reads the numbers, the view and the art pipeline read the rest.
//
// shot:   the main gun (always auto-firing). 'spread' fans out, 'lance' is a piercing beam, 'needle' homes.
// burst:  the pilot's own super, fired when the Burst gauge is full.
// art:    the fal prompt for the pilot's portrait (dev/art/prompts.mjs builds every request from these).

export const PILOTS = [
    {
        id: 'sora',
        name: 'Sora Amane',
        callsign: 'KIRIN',
        ship: 'AZURE SERAPH',
        age: 19,
        color: 0x4fc3ff,
        accent: 0xbff4ff,
        css: '#4fc3ff',
        blurb: 'Wide spread vulcan that tightens into a focused stream. Starfall Volley rains blades across the whole screen.',
        story: 'Her sister Hikari flew the first Seraph into the Veil and never came back. Sora still hears her singing.',
        stats: { speed: 10.5, focusSpeed: 4.6, hitbox: 0.16 },
        shot: { kind: 'spread', rate: 0.07, dmg: 1.0, speed: 46 },
        burst: { id: 'starfall', name: 'STARFALL VOLLEY', time: 6 },
        voice: 'young, bright, determined Japanese-anime heroine, warm but steely',
        art: 'Sora Amane, a 19-year-old ace starfighter pilot girl, short sky-blue bob hair with a long side lock, bright determined cyan eyes, a white and azure flight suit with glowing blue piping, an open flight helmet held under one arm, a small silver locket at her collar',
        fierce: 'same girl, now shouting a battle cry with fierce narrowed eyes, helmet on with visor up, blue cockpit light on her face, strands of hair flying',
    },
    {
        id: 'kaito',
        name: 'Kaito Ren',
        callsign: 'GARUDA',
        ship: 'CRIMSON HALBERD',
        age: 27,
        color: 0xff4d5e,
        accent: 0xffc0a0,
        css: '#ff4d5e',
        blurb: 'A piercing lance laser that cuts through rows of enemies. Halberd Lance fires a beam the height of the sky.',
        story: 'He gave the order to retreat at Saturn. Eleven thousand people did not make it out. He flies to carry their names.',
        stats: { speed: 9.2, focusSpeed: 4.0, hitbox: 0.18 },
        shot: { kind: 'lance', rate: 0.05, dmg: 0.82, speed: 70 },
        burst: { id: 'halberd', name: 'HALBERD LANCE', time: 5 },
        voice: 'deep, quiet, battle-weary man in his late twenties, grave and resolute',
        art: 'Kaito Ren, a 27-year-old male fighter pilot and former fleet commander, messy black hair with a red streak, a thin scar across his left eyebrow, tired crimson eyes, a black and crimson flight jacket over a pressure suit, dog tags of fallen comrades around his neck',
        fierce: 'same man, jaw clenched in grim resolve, red emergency cockpit light across his face, gripping the flight stick, sweat on his brow',
    },
    {
        id: 'lyra',
        name: 'Lyra-07',
        callsign: 'NUE',
        ship: 'VIOLET WRAITH',
        age: 17,
        color: 0xc77dff,
        accent: 0xf0d0ff,
        css: '#c77dff',
        blurb: 'Seeker needles that hunt the nearest target. Wraith Swarm releases a storm of homing phantoms.',
        story: 'An android pilot grown from salvaged Requiem tissue. The enemy calls her daughter. She has not decided what she is.',
        stats: { speed: 11.5, focusSpeed: 5.0, hitbox: 0.14 },
        shot: { kind: 'needle', rate: 0.09, dmg: 0.9, speed: 34 },
        burst: { id: 'wraith', name: 'WRAITH SWARM', time: 6 },
        voice: 'soft, precise, slightly synthetic young woman, calm and curious with rare flashes of emotion',
        art: 'Lyra-07, an android girl pilot who looks seventeen, long silver-lavender hair, pale skin with faint glowing violet circuit lines on her cheek and neck, heterochromatic eyes (one violet, one gold), a sleek black and violet bodysuit with a glowing collar, expressionless but curious',
        fierce: 'same android girl, violet circuit lines blazing bright, eyes glowing, hair lifting in a static field, a single tear on her cheek',
    },
];

export const PILOT_BY_ID = Object.fromEntries(PILOTS.map((p) => [p.id, p]));
