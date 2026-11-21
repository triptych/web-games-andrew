// Stages, bosses and cast. Pure data. Wave scripts live in js/sim/stages.js; boss behaviour in js/sim/bosses.js.
//
// art:  fal prompt for the stage's painted backdrop (16:9) or the boss's warning card.
// sky:  colours the view uses for its shader sky, fog and light rig (hex ints).

export const STAGES = [
    {
        id: 'saturn', n: 1, name: "SATURN'S GRAVE", sub: 'Where the Aegis fleet fell',
        music: 'stage1', boss: 'bellwether',
        sky: { top: 0x070a1c, bottom: 0x2a1a30, neb: 0xff9a5c, neb2: 0x5a6cff, fog: 0x0b0d1e, key: 0xffd6a0, rim: 0x6fa8ff, dust: 0xffc890 },
        art: "Saturn seen huge and close from within its rings, golden-amber planet with storm bands, the rings a river of glittering ice and rock debris crossing the frame, burning wrecks of a destroyed human battle fleet drifting in the rings, distant blue sun, deep starfield",
    },
    {
        id: 'veil', n: 2, name: 'VEIL OF GLASS', sub: 'The crystal nebula',
        music: 'stage1', boss: 'wyrm',
        sky: { top: 0x050a18, bottom: 0x0d2a3a, neb: 0x40f0ff, neb2: 0xff5ad8, fog: 0x081626, key: 0xb8fff6, rim: 0xff7ae0, dust: 0x9ff8ff },
        art: "a luminous cyan and magenta nebula full of floating giant prismatic glass crystals and shards that refract starlight into rainbows, glowing gas clouds, deep space",
    },
    {
        id: 'cathedral', n: 3, name: 'CATHEDRAL ARK', sub: 'Inside the Requiem mothership',
        music: 'stage2', boss: 'organ',
        sky: { top: 0x0a0306, bottom: 0x2a0812, neb: 0xff3040, neb2: 0xffa040, fog: 0x14040a, key: 0xffb080, rim: 0xff3050, dust: 0xff6050 },
        art: "the cavernous interior of a colossal alien biomechanical mothership like a gothic cathedral, ribbed vaulted bone-metal arches, pulsing red organic veins, glowing amber reactor light far down a vast corridor, organ-pipe structures, ominous",
    },
    {
        id: 'foundry', n: 4, name: 'IRON HALO FOUNDRY', sub: 'The ring around a dead star',
        music: 'stage2', boss: 'titan',
        sky: { top: 0x06080c, bottom: 0x1c1a22, neb: 0xffb040, neb2: 0x30d0ff, fog: 0x0c0e14, key: 0xffe0b0, rim: 0x40d8ff, dust: 0xffd080 },
        art: "an immense industrial ring-shaped space foundry encircling a white neutron star, endless scaffolds, assembly arms and half-built giant war robots, molten metal sparks, sodium-orange work lights and cyan energy conduits",
    },
    {
        id: 'deep', n: 5, name: 'LEVIATHAN DEEP', sub: 'Graveyard of the star-whales',
        music: 'stage3', boss: 'mother',
        sky: { top: 0x02070a, bottom: 0x06241c, neb: 0x40ff9a, neb2: 0x9a40ff, fog: 0x031410, key: 0xa0ffd0, rim: 0xb070ff, dust: 0x80ffc0 },
        art: "an eerie bioluminescent alien space ocean, skeletons of colossal space whales floating among green and violet gas, glowing alien coral growing on the bones, swarms of tiny lights like plankton, a huge alien eye-shaped moon",
    },
    {
        id: 'heart', n: 6, name: 'REQUIEM HEART', sub: 'Inside the dying star',
        music: 'stage3', boss: 'heart',
        sky: { top: 0x0a0a20, bottom: 0x302060, neb: 0xffffff, neb2: 0x60a0ff, fog: 0x14122e, key: 0xffffff, rim: 0x80b0ff, dust: 0xffffff },
        art: "the interior of a dying blue-white star turned into an alien choir cathedral, rings of angelic crystalline spires orbiting a blinding core, ribbons of plasma like musical staves, white and blue and gold light, sublime and terrifying",
    },
];
export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));

// Survival mode cycles these backdrops; it has its own music.
export const ENDLESS = {
    id: 'endless', name: 'THE ENDLESS CHOIR', sub: 'Survive',
    music: 'endless',
    art: "a swirling vortex of every color in deep space, shattered planets and wrecked alien ships orbiting a black hole with a bright accretion disk, infinite and hostile",
};

export const BOSSES = {
    bellwether: {
        name: 'BELLWETHER', title: 'Requiem Dreadnought', kind: 'ship',
        art: "an enormous alien dreadnought warship in side view, black and bone-white hull shaped like a cathedral bell and a whale, covered in gun turrets, four huge glowing red engine thrusters, red sensor eyes, battle damage",
    },
    wyrm: {
        name: 'HALCYON WYRM', title: 'Crystal Leviathan', kind: 'monster',
        art: "a gigantic crystal space serpent dragon made of glowing cyan and pink prismatic glass segments, a horned crystal head with a jaw full of light, coiling through a nebula, refracting rainbows",
    },
    organ: {
        name: 'THE CHOIRMASTER', title: 'Engine of the Ark', kind: 'machine',
        art: "a colossal biomechanical reactor heart inside an alien mothership, a wall of organ pipes and pistons fused with red flesh and bone, a giant central glowing eye-core, tentacle cables, gun nozzles",
    },
    titan: {
        name: 'TITAN ORDINAL', title: "Admiral Voss's war-frame", kind: 'robot',
        art: "a towering giant humanoid war robot mecha in space, heavy gunmetal and crimson armor plates, a glowing visor, shoulder missile pods, a massive beam cannon arm and a plasma sword arm, thrusters blazing, imposing anime mecha design",
    },
    mother: {
        name: "XEL'THUUN", title: 'Mother of Eyes', kind: 'alien',
        art: "a colossal eldritch alien space creature, a writhing mass of violet and green tentacles around one enormous golden eye, many smaller eyes along the tentacles, bioluminescent spots, spawning glowing eggs",
    },
    heart: {
        name: 'SERAPHINE NULL', title: 'The Requiem Heart', kind: 'angel',
        art: "a vast alien angel-machine made of white crystal and gold, six immense halo rings and many wings of light, a serene feminine mask face at its center, orbiting choir spires, inside a blazing blue-white star",
    },
};

// Every speaking role. `voice` describes the ElevenLabs casting; `art` the fal portrait (pilots are in pilots.js).
export const CAST = {
    mei: {
        name: 'Cmdr. Mei Tachibana', role: 'Lumen Ark flight control', color: '#ffd166',
        voice: 'composed, warm commanding woman in her forties, mission control',
        art: 'Commander Mei Tachibana, a woman in her forties with dark hair in a neat bun and silver streaks, a navy and gold naval officer uniform, a headset microphone, calm wise eyes',
    },
    seraphine: {
        name: 'Seraphine Null', role: 'Herald of the Requiem', color: '#e8f0ff',
        voice: 'ethereal, serene, otherworldly woman, slow and musical, gently menacing',
        art: 'Seraphine Null, an otherworldly alien herald with an elegant feminine form, porcelain-white skin, a golden halo-crown of thin rings floating behind her head, eyes of pure white light, long flowing white and gold robes made of light, serene and terrifying smile',
    },
    voss: {
        name: 'Adm. Gideon Voss', role: 'Defector', color: '#ff8a5c',
        voice: 'cold, arrogant older man, an admiral, clipped and contemptuous',
        art: 'Admiral Gideon Voss, a stern man in his sixties with slicked-back white hair and a trimmed beard, half of his face replaced by sleek alien biomechanical plating with a glowing orange eye, a black admiral greatcoat with gold epaulettes',
    },
    hikari: {
        name: 'Hikari Amane', role: 'The Cantor', color: '#9fe8ff',
        voice: 'gentle, sad young woman in her twenties, a soft dreamy voice',
        art: "Hikari Amane, a young woman in her twenties with long sky-blue hair floating weightlessly, closed eyes, wearing the shredded remains of an azure pilot suit fused with white crystal growths, crystal tendrils trailing from her back, singing, bathed in pale light, the same silver locket at her collar",
    },
    system: {
        name: 'SERAPH OS', role: 'Ship computer', color: '#8cf',
        voice: 'calm female ship computer announcer',
    },
};
