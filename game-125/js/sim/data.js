// SEEDFALL — every table the rules read: resources, genomes, zones, monsters, bots, upgrades, research,
// harvesters and colonies. Pure data plus a few pure helpers. The view and UI read these too.

export const RES = ['metal', 'mineral', 'flora', 'fauna'];
export const RES_INFO = {
    metal: { name: 'Metals', icon: '⚙️', color: '#c3cede' },
    mineral: { name: 'Minerals', icon: '💎', color: '#86e4ff' },
    flora: { name: 'Plants', icon: '🌿', color: '#86e08e' },
    fauna: { name: 'Animals', icon: '🦴', color: '#ffb47e' },
};

// Four traits every genome carries. A strain's traits decide what it does to a zone:
// Cleansing scrubs toxins, Docility calms the fauna, Fertility greens the soil, Vigor makes all of it stick.
export const TRAITS = [
    { id: 'vig', name: 'Vigor', color: '#ff9a5c', does: 'how strongly the strain takes hold' },
    { id: 'fer', name: 'Fertility', color: '#8be37a', does: 'greens barren ground' },
    { id: 'doc', name: 'Docility', color: '#ffd76a', does: 'calms hostile fauna' },
    { id: 'cln', name: 'Cleansing', color: '#7fd8ff', does: 'scrubs toxins from soil and air' },
];

// ---------------------------------------------------------------- genomes
// kind: flora (sampled from plants) or fauna (sampled from creatures). t: [vigor, fertility, docility, cleansing].
// shape/pal pick the procedural sprite; need: samples to sequence it.
export const SPECIES = [
    // Landfall Meadow
    { id: 'sunbloom', name: 'Sunbloom', kind: 'flora', zone: 0, t: [3, 8, 6, 2], need: 2, shape: 'bloom', pal: ['#ffd04a', '#ff8a3a', '#4f9a3a'], blurb: 'A heliotrope that turns to follow the ship across the sky.' },
    { id: 'whisperreed', name: 'Whisperreed', kind: 'flora', zone: 0, t: [4, 5, 5, 5], need: 2, shape: 'reed', pal: ['#a8e070', '#5a9a40', '#e8f0a0'], blurb: 'Hollow reeds that hum when the wind changes. They hum at your bots.' },
    { id: 'skitterling', name: 'Skitterling', kind: 'fauna', zone: 0, t: [3, 6, 3, 1], need: 2, shape: 'skitter', pal: ['#d8b070', '#8a6a3a', '#ff6a4a'], blurb: 'Six-legged grazers. Curious, then frightened, then furious.' },
    { id: 'thornback', name: 'Thornback', kind: 'fauna', zone: 0, t: [7, 3, 1, 1], need: 2, shape: 'beast', pal: ['#8a6a4a', '#4a3a2a', '#e0e070'], blurb: 'A boar-sized herbivore that grew spines after the Gardener drones came.' },
    // Rustwood
    { id: 'rustcap', name: 'Rustcap', kind: 'flora', zone: 1, t: [4, 6, 3, 7], need: 3, shape: 'mushroom', pal: ['#e0703a', '#f0d8b0', '#8a3a1a'], blurb: 'Fungal canopy that eats iron and breathes spores.' },
    { id: 'ironfern', name: 'Ironfern', kind: 'flora', zone: 1, t: [7, 4, 4, 4], need: 3, shape: 'fern', pal: ['#6a8a3a', '#a85a2a', '#c8d070'], blurb: 'Fronds stiff with oxidised metal. They ring when struck.' },
    { id: 'sporeling', name: 'Sporeling', kind: 'fauna', zone: 1, t: [4, 5, 2, 6], need: 3, shape: 'blob', pal: ['#f0904a', '#a84a2a', '#fff0a0'], blurb: 'A walking spore sac. It spits.' },
    { id: 'barkhound', name: 'Barkhound', kind: 'fauna', zone: 1, t: [7, 4, 3, 1], need: 3, shape: 'hound', pal: ['#a8583a', '#5a2a1a', '#ffe06a'], blurb: 'Pack hunters with bark-plated flanks. The pups are surprisingly soft.' },
    // Glasswater Marsh
    { id: 'glassreed', name: 'Glassreed', kind: 'flora', zone: 2, t: [3, 4, 5, 9], need: 3, shape: 'reed', pal: ['#8af0e8', '#3a9aa8', '#e0ffff'], blurb: 'Silica stems that filter the acid out of the water they stand in.' },
    { id: 'mirelily', name: 'Mirelily', kind: 'flora', zone: 2, t: [4, 8, 7, 6], need: 3, shape: 'lily', pal: ['#ff9ad0', '#3a8a7a', '#fff0f8'], blurb: 'A floating flower. Leechlings sleep beneath it.' },
    { id: 'leechling', name: 'Leechling', kind: 'fauna', zone: 2, t: [5, 7, 2, 4], need: 3, shape: 'serpent', pal: ['#5a8a6a', '#2a4a3a', '#ff5a7a'], blurb: 'It drinks charge. Your bots taste of lithium.' },
    { id: 'glassfin', name: 'Glassfin', kind: 'fauna', zone: 2, t: [6, 5, 4, 3], need: 3, shape: 'flyer', pal: ['#bfe8ff', '#5a8ac0', '#ffffff'], blurb: 'Translucent gliders that dive from the mist.' },
    // Cinder Mesa
    { id: 'embercactus', name: 'Embercactus', kind: 'flora', zone: 3, t: [9, 3, 3, 6], need: 3, shape: 'cactus', pal: ['#5a9a4a', '#ff7a3a', '#ffe08a'], blurb: 'Stores heat in its ribs and bleeds it out at night.' },
    { id: 'ashbloom', name: 'Ashbloom', kind: 'flora', zone: 3, t: [6, 5, 5, 7], need: 3, shape: 'bloom', pal: ['#e8e0d8', '#c84a4a', '#6a5a5a'], blurb: 'White petals that only open after a vent bursts.' },
    { id: 'slagcrawler', name: 'Slagcrawler', kind: 'fauna', zone: 3, t: [9, 2, 1, 2], need: 3, shape: 'crawler', pal: ['#5a4a4a', '#ff6a2a', '#2a2020'], blurb: 'Armour of cooled slag over a molten belly. Slow. Very slow. Very angry.' },
    { id: 'ashwing', name: 'Ashwing', kind: 'fauna', zone: 3, t: [6, 6, 4, 1], need: 3, shape: 'flyer', pal: ['#c86a4a', '#5a2a2a', '#ffd06a'], blurb: 'Rides the vent thermals and drops embers on anything that shines.' },
    // Lumen Hollow
    { id: 'lanternvine', name: 'Lanternvine', kind: 'flora', zone: 4, t: [5, 8, 8, 6], need: 3, shape: 'vine', pal: ['#4a8a6a', '#a8ff8a', '#e8ffd0'], blurb: 'Glowing fruit that the Hollow\'s creatures will not eat. They gather around it to sleep.' },
    { id: 'dreamcap', name: 'Dreamcap', kind: 'flora', zone: 4, t: [3, 6, 9, 8], need: 3, shape: 'mushroom', pal: ['#a87aff', '#e8d8ff', '#4a2a8a'], blurb: 'Its spores make every animal in the Hollow drowsy. And kind.' },
    { id: 'gloomstalker', name: 'Gloomstalker', kind: 'fauna', zone: 4, t: [8, 4, 2, 3], need: 3, shape: 'stalker', pal: ['#3a3a5a', '#1a1a2a', '#7affe0'], blurb: 'Tall, quiet, patient. It was watching your first bot for an hour.' },
    { id: 'glowmoth', name: 'Glowmoth', kind: 'fauna', zone: 4, t: [4, 9, 8, 4], need: 3, shape: 'moth', pal: ['#ffe8a0', '#8a6ad8', '#fffff0'], blurb: 'Pollinators the size of a hand. They follow lights. They follow you.' },
    // Heartroot
    { id: 'heartbloom', name: 'Heartbloom', kind: 'flora', zone: 5, t: [8, 9, 8, 9], need: 2, shape: 'heart', pal: ['#ff6a9a', '#ffd0e0', '#6a2a4a'], blurb: 'It only grows where the Rootmother has rested.' },
    { id: 'rootling', name: 'Rootling', kind: 'fauna', zone: 5, t: [6, 6, 3, 6], need: 3, shape: 'rootling', pal: ['#6a5a3a', '#3a2a1a', '#c8ff6a'], blurb: 'Buds of the Rootmother, sent to keep the soil from forgetting her.' },
    { id: 'thornwarden', name: 'Thornwarden', kind: 'fauna', zone: 5, t: [9, 4, 1, 4], need: 3, shape: 'warden', pal: ['#4a5a3a', '#2a2a1a', '#ff4a6a'], blurb: 'Antibodies with spears.' },
];
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

// ---------------------------------------------------------------- zones
// base: starting [toxic, hostile, barren] 0..100. niche: the trait profile the local ecology needs.
// req: bot generation needed to land. weight in the Eden Index. counts at full hostility / toxicity / barrenness.
export const ZONES = [
    {
        id: 'meadow', name: 'Landfall Meadow', req: 0, weight: 1, base: [26, 52, 46], niche: [4, 7, 6, 3], tier: 0,
        hazard: 'none', hazardName: 'none', echo: 0,
        sky: ['#7aa8e8', '#ffe2b0'], fog: '#e8d2b0', ground: ['#7aa84a', '#a8b858'], dead: ['#8a7a4a', '#9a8a5a'], sun: '#fff0d0', light: 2.4,
        counts: { metal: 8, mineral: 7, flora: 10, enemies: { skitterling: 7, thornback: 3 }, hazards: 0, props: 26 },
        props: ['rock', 'wreck', 'rock', 'tuft'],
        intro: 'Rolling grass under a gold sky. The Gardener wreckage came down here.',
    },
    {
        id: 'rustwood', name: 'Rustwood', req: 1, weight: 1, base: [56, 62, 40], niche: [6, 5, 4, 6], tier: 1,
        hazard: 'spore', hazardName: 'spore clouds', echo: 1,
        sky: ['#c8784a', '#f8c88a'], fog: '#d89a6a', ground: ['#8a5a2a', '#a86a3a'], dead: ['#6a4a3a', '#5a3a2a'], sun: '#ffd0a0', light: 2.0,
        counts: { metal: 9, mineral: 4, flora: 9, enemies: { sporeling: 6, barkhound: 6 }, hazards: 6, props: 34 },
        props: ['rusttree', 'rusttree', 'rock', 'stump'],
        intro: 'A forest that breathes iron. The air is thick with spores.',
    },
    {
        id: 'marsh', name: 'Glasswater Marsh', req: 2, weight: 1, base: [76, 56, 52], niche: [4, 6, 6, 8], tier: 2,
        hazard: 'acid', hazardName: 'acid pools', echo: 2,
        sky: ['#5a9aa8', '#d0f0e8'], fog: '#a8d8d0', ground: ['#4a7a6a', '#5a8a7a'], dead: ['#5a6a5a', '#4a5a4a'], sun: '#e8fff8', light: 1.9,
        counts: { metal: 5, mineral: 9, flora: 10, enemies: { leechling: 8, glassfin: 5 }, hazards: 9, props: 28 },
        props: ['glass', 'rock', 'deadtree', 'tuft'],
        intro: 'Flats of shallow, acidic water and spires of natural glass.',
    },
    {
        id: 'mesa', name: 'Cinder Mesa', req: 3, weight: 1, base: [62, 72, 82], niche: [8, 5, 4, 6], tier: 3,
        hazard: 'vent', hazardName: 'heat vents', echo: 3,
        sky: ['#a84a3a', '#ffb87a'], fog: '#c87a5a', ground: ['#8a4a3a', '#a85a3a'], dead: ['#5a3a30', '#4a2a28'], sun: '#ffc890', light: 2.6,
        counts: { metal: 10, mineral: 8, flora: 7, enemies: { slagcrawler: 5, ashwing: 7 }, hazards: 8, props: 24 },
        props: ['spire', 'rock', 'spire', 'bones'],
        intro: 'Red stone and black glass. The ground breathes fire in pulses.',
    },
    {
        id: 'hollow', name: 'Lumen Hollow', req: 4, weight: 1, base: [50, 82, 56], niche: [5, 7, 8, 6], tier: 4,
        hazard: 'dark', hazardName: 'the dark', echo: 4,
        sky: ['#140c2a', '#3a2a6a'], fog: '#2a2050', ground: ['#3a3a6a', '#4a3a7a'], dead: ['#2a2a3a', '#20202a'], sun: '#a8a0ff', light: 0.9,
        counts: { metal: 6, mineral: 9, flora: 11, enemies: { gloomstalker: 6, glowmoth: 8 }, hazards: 5, props: 30 },
        props: ['crystal', 'shroomtree', 'rock', 'crystal'],
        intro: 'A sinkhole forest under a roof of roots, lit only by what grows there.',
    },
    {
        id: 'heartroot', name: 'Heartroot', req: 5, weight: 1.5, base: [90, 95, 86], niche: [7, 8, 8, 8], tier: 5,
        hazard: 'thorn', hazardName: 'thorn fields', echo: -1, boss: true,
        sky: ['#3a1a3a', '#c86a8a'], fog: '#7a3a5a', ground: ['#7a4a5a', '#8a5a6a'], dead: ['#5a3444', '#4a2a38'], sun: '#ffb0d0', light: 1.6,
        counts: { metal: 6, mineral: 6, flora: 6, enemies: { rootling: 6, thornwarden: 5 }, hazards: 6, props: 26 },
        props: ['root', 'root', 'rock', 'bones'],
        intro: 'The planet\'s heart. Everything here grows toward one enormous root.',
    },
];

// ---------------------------------------------------------------- creatures
// hp, spd, dmg, reach (melee), sight, cd (between attacks). ranged: shot range. drain: battery per hit.
export const ENEMIES = {
    skitterling: { name: 'Skitterling', hp: 12, spd: 2.7, dmg: 4, reach: 1.1, sight: 8, cd: 0.9, r: 0.45, fauna: [1, 1], h: 0.8 },
    thornback: { name: 'Thornback', hp: 34, spd: 2.1, dmg: 9, reach: 1.5, sight: 9, cd: 1.4, r: 0.75, fauna: [2, 3], h: 1.3 },
    sporeling: { name: 'Sporeling', hp: 22, spd: 1.6, dmg: 5, reach: 1.1, sight: 10, cd: 1.6, r: 0.55, ranged: 8, fauna: [1, 2], h: 1.0 },
    barkhound: { name: 'Barkhound', hp: 38, spd: 3.3, dmg: 8, reach: 1.3, sight: 11, cd: 1.1, r: 0.65, pack: true, fauna: [2, 3], h: 1.1 },
    leechling: { name: 'Leechling', hp: 28, spd: 2.4, dmg: 6, reach: 1.2, sight: 8, cd: 1.0, r: 0.55, drain: 6, fauna: [2, 2], h: 0.8 },
    glassfin: { name: 'Glassfin', hp: 34, spd: 4.0, dmg: 11, reach: 1.4, sight: 13, cd: 1.6, r: 0.6, flyer: true, fauna: [2, 3], h: 1.0 },
    slagcrawler: { name: 'Slagcrawler', hp: 90, spd: 1.5, dmg: 18, reach: 1.7, sight: 9, cd: 1.8, r: 0.95, fauna: [3, 4], h: 1.4 },
    ashwing: { name: 'Ashwing', hp: 38, spd: 3.6, dmg: 8, reach: 1.3, sight: 14, cd: 1.5, r: 0.6, flyer: true, ranged: 10, fauna: [2, 3], h: 1.0 },
    gloomstalker: { name: 'Gloomstalker', hp: 80, spd: 3.8, dmg: 19, reach: 1.7, sight: 10, cd: 1.4, r: 0.7, fauna: [3, 4], h: 2.0 },
    glowmoth: { name: 'Glowmoth', hp: 30, spd: 3.0, dmg: 7, reach: 1.2, sight: 12, cd: 1.0, r: 0.5, flyer: true, drain: 4, fauna: [2, 3], h: 0.9 },
    rootling: { name: 'Rootling', hp: 40, spd: 2.8, dmg: 10, reach: 1.3, sight: 12, cd: 1.1, r: 0.55, fauna: [2, 3], h: 0.9 },
    thornwarden: { name: 'Thornwarden', hp: 170, spd: 2.6, dmg: 22, reach: 1.9, sight: 12, cd: 1.5, r: 0.85, fauna: [3, 5], h: 2.0 },
    rootmother: { name: 'The Rootmother', hp: 4200, spd: 0, dmg: 30, reach: 4.5, sight: 40, cd: 3.5, r: 3.2, boss: true, fauna: [10, 10], h: 7 },
};
/** Which species a creature type carries. */
export const ENEMY_SPECIES = { rootmother: 'heartbloom' };
for (const s of SPECIES) if (s.kind === 'fauna' && ENEMIES[s.id]) ENEMY_SPECIES[s.id] = s.id;

// ---------------------------------------------------------------- bots
export const GENS = [
    { name: 'Sprout', mk: 'Mk I', blurb: 'A hoist and a prayer. A cutter on one arm, a bucket on the other.', cost: null },
    { name: 'Digger', mk: 'Mk II', blurb: 'Spore filters, a proper drill and a pulse blaster. Can breathe in Rustwood.', cost: { metal: 50, mineral: 20, flora: 10 } },
    { name: 'Ranger', mk: 'Mk III', blurb: 'Sealed legs and acid-proof skin. Wades the Glasswater Marsh.', cost: { metal: 110, mineral: 50, flora: 20, fauna: 15 } },
    { name: 'Forgeback', mk: 'Mk IV', blurb: 'Ceramic plating and heat sinks. Walks through the Cinder Mesa\'s vents.', cost: { metal: 195, mineral: 105, flora: 45, fauna: 40 } },
    { name: 'Lanternhead', mk: 'Mk V', blurb: 'A lamp, a long-range eye and a quiet tread for the Lumen Hollow.', cost: { metal: 285, mineral: 180, flora: 80, fauna: 70 } },
    { name: 'Gardener', mk: 'Mk VI', blurb: 'Everything we learned, in one body. Built to reach the Heartroot and come home.', cost: { metal: 390, mineral: 270, flora: 135, fauna: 120 } },
];
export const UPGRADES = [
    { id: 'hull', name: 'Hull plating', does: '+12% integrity', res: ['metal', 'mineral'] },
    { id: 'cell', name: 'Power cell', does: '+10% battery', res: ['mineral', 'metal'] },
    { id: 'drive', name: 'Drive servos', does: '+5% speed', res: ['metal', 'flora'] },
    { id: 'edge', name: 'Cutter & blaster', does: '+12% damage', res: ['metal', 'fauna'] },
    { id: 'drill', name: 'Drill & sampler', does: '+14% gathering speed', res: ['metal', 'mineral'] },
    { id: 'hold', name: 'Cargo hold', does: '+3 cargo', res: ['metal', 'flora'] },
];
export const upgradeMax = (gen) => 2 + gen * 2;
export function upgradeCost(id, lv) {
    const u = UPGRADES.find((x) => x.id === id);
    const k = Math.pow(1.36, lv);
    return { [u.res[0]]: Math.round(12 * k), [u.res[1]]: Math.round(5 * k) };
}

// ---------------------------------------------------------------- research
// branch: mech | bio | auto. days of lab time. req: research ids first. gen: unlocks fabricating that generation.
export const RESEARCH = [
    { id: 'm1', br: 'mech', name: 'Reinforced Chassis', does: '+20% bot integrity', days: 2, cost: { metal: 20 }, req: [] },
    { id: 'm2', br: 'mech', name: 'Mk II Blueprint', does: 'Fabricate the Digger: spore filters, drill, blaster', days: 3, cost: { metal: 35, mineral: 12 }, req: [], gen: 1 },
    { id: 'm3', br: 'mech', name: 'Servo Tuning', does: '+12% bot speed', days: 3, cost: { metal: 40, mineral: 15 }, req: ['m1'] },
    { id: 'm4', br: 'mech', name: 'Mk III Blueprint', does: 'Fabricate the Ranger: acid-proof', days: 5, cost: { metal: 80, mineral: 40, flora: 15 }, req: ['m2'], gen: 2 },
    { id: 'm5', br: 'mech', name: 'Black Box Recorder', does: 'A destroyed bot keeps 70% of its cargo, not 35%', days: 4, cost: { metal: 60, mineral: 30 }, req: ['m1'] },
    { id: 'm6', br: 'mech', name: 'Mk IV Blueprint', does: 'Fabricate the Forgeback: heatproof', days: 7, cost: { metal: 150, mineral: 80, fauna: 30 }, req: ['m4'], gen: 3 },
    { id: 'm7', br: 'mech', name: 'Mk V Blueprint', does: 'Fabricate the Lanternhead: sees in the dark', days: 9, cost: { metal: 230, mineral: 150, flora: 60 }, req: ['m6'], gen: 4 },
    { id: 'm8', br: 'mech', name: 'Mk VI Blueprint', does: 'Fabricate the Gardener: built for the Heartroot', days: 11, cost: { metal: 320, mineral: 220, flora: 90, fauna: 90 }, req: ['m7', 'b6'], gen: 5 },
    { id: 'b1', br: 'bio', name: 'Sequencing Primer', does: 'Every genome needs one sample fewer', days: 2, cost: { flora: 8, fauna: 6 }, req: [] },
    { id: 'b2', br: 'bio', name: 'Second Vat', does: 'Incubate two strains at once', days: 3, cost: { metal: 30, mineral: 20 }, req: [] },
    { id: 'b3', br: 'bio', name: 'Symbiosis Models', does: 'Plant + animal blends gain +1 Fertility and +1 Docility more', days: 4, cost: { flora: 25, fauna: 20 }, req: ['b1'] },
    { id: 'b4', br: 'bio', name: 'Cleansing Lattice', does: '+1 Cleansing on every strain', days: 4, cost: { mineral: 40, flora: 25 }, req: ['b1'] },
    { id: 'b5', br: 'bio', name: 'Docility Pheromones', does: '+1 Docility on every strain', days: 5, cost: { flora: 40, fauna: 35 }, req: ['b3'] },
    { id: 'b6', br: 'bio', name: 'Fertile Crescent', does: '+1 Fertility on every strain', days: 5, cost: { mineral: 40, flora: 50 }, req: ['b3'] },
    { id: 'b7', br: 'bio', name: 'Third Vat', does: 'Incubate three strains at once', days: 6, cost: { metal: 90, mineral: 60 }, req: ['b2'] },
    { id: 'b8', br: 'bio', name: 'Hardy Chimeras', does: '+1 Vigor on every strain', days: 6, cost: { fauna: 60, mineral: 40 }, req: ['b4'] },
    { id: 'b9', br: 'bio', name: 'Mycelial Translation', does: 'Learn the Chorus\'s grammar. Opens another way to end this', days: 9, cost: { flora: 120, fauna: 100, mineral: 60 }, req: ['b5', 'b6'] },
    { id: 'a1', br: 'auto', name: 'Harvester Rigs', does: 'Drop automatic harvesters on zones you have visited', days: 2, cost: { metal: 30, mineral: 10 }, req: [] },
    { id: 'a2', br: 'auto', name: 'Lab Bench II', does: 'Run two research projects at once', days: 3, cost: { metal: 40, mineral: 20 }, req: [] },
    { id: 'a3', br: 'auto', name: 'Rig Efficiency', does: 'Harvesters yield 35% more', days: 4, cost: { metal: 60, mineral: 30 }, req: ['a1'] },
    { id: 'a4', br: 'auto', name: 'Supply Shuttle', does: 'Harvester stock comes up by itself every day', days: 4, cost: { metal: 50, mineral: 35, flora: 10 }, req: ['a1'] },
    { id: 'a5', br: 'auto', name: 'Colony Seeds', does: 'Found bot colonies on calmed zones', days: 6, cost: { metal: 90, mineral: 50, flora: 30, fauna: 20 }, req: ['a3'] },
    { id: 'a6', br: 'auto', name: 'Emergency Recall', does: 'Hold R to recall a bot from anywhere', days: 4, cost: { metal: 50, mineral: 40 }, req: ['a2'] },
    { id: 'a7', br: 'auto', name: 'Lab Bench III', does: 'Run three research projects at once', days: 6, cost: { metal: 110, mineral: 70 }, req: ['a2'] },
    { id: 'a8', br: 'auto', name: 'Hive Mind', does: 'Colonies work 50% harder, tending and harvesting', days: 8, cost: { metal: 160, mineral: 100, flora: 40, fauna: 40 }, req: ['a5'] },
];
export const RESEARCH_BY_ID = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));
export const BRANCHES = [
    { id: 'mech', name: 'Mechanics', icon: '⚙️' },
    { id: 'bio', name: 'Biotech', icon: '🧬' },
    { id: 'auto', name: 'Autonomics', icon: '🤖' },
];

// ---------------------------------------------------------------- idle: harvesters and colonies
export const HARVESTERS = [
    { id: 'metal', name: 'Scrap Rig', res: 'metal', rate: 2.0 },
    { id: 'mineral', name: 'Crystal Drill', res: 'mineral', rate: 1.5 },
    { id: 'flora', name: 'Seed Grove', res: 'flora', rate: 1.4 },
    { id: 'fauna', name: 'Gentle Trap', res: 'fauna', rate: 1.1 },
];
export const HARV_MAX = 5;
export function harvesterCost(zone, lv) {
    const z = 1 + zone * 0.3, k = Math.pow(1.6, lv);
    return { metal: Math.round(22 * k * z), mineral: Math.round(9 * k * z) };
}
export const COLONY = [
    { name: 'Outpost', host: 62, does: 'A charging pylon and three tenders' },
    { name: 'Settlement', host: 46, does: 'A workshop dome and a seed bank' },
    { name: 'Hive', host: 30, does: 'A bot city. The zone tends itself' },
];
export function colonyCost(zone, stage) {
    const z = 1 + zone * 0.25, k = [1, 2.2, 4][stage];
    return { metal: Math.round(70 * k * z), mineral: Math.round(40 * k * z), flora: Math.round(25 * k * z), fauna: Math.round(20 * k * z) };
}
export const stockCap = (colony) => 50 + colony * 45;

// ---------------------------------------------------------------- helpers
export function canAfford(res, cost) { for (const k in cost) if ((res[k] || 0) < cost[k]) return false; return true; }
export function pay(res, cost) { for (const k in cost) res[k] -= cost[k]; }
export function costText(cost) { return RES.filter((k) => cost[k]).map((k) => `${cost[k]} ${RES_INFO[k].name}`).join(', '); }
