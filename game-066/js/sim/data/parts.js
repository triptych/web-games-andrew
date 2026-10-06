// The parts every COM-bot is assembled from. A species is a set of parts in slots, and the parts
// drive everything: the 3D model (js/view/botgen.js), the base stats (each part tilts the stat
// spread), the techniques a bot can learn (each part carries move tags), and evolution — evolving
// installs new parts, which is how a bot gains new attacks.
//
// w: stat weights [hull, torque, plating, arc, shield, clock]   tags: technique families
// move: the technique a bot learns on the spot when the part is installed by evolving.

export const SLOTS = ['c', 'l', 'a', 'b', 'h', 't', 'o'];
export const SLOT_NAMES = { c: 'Chassis', l: 'Drive', a: 'Arms', b: 'Back rig', h: 'Head', t: 'Crest', o: 'Overgrowth' };

export const PARTS = {
    // ---------------------------------------------------------------- chassis
    c: {
        orb:     { name: 'Ball Chassis',       w: [1, 1, 1, 1, 1, 1], tags: ['ram'] },
        egg:     { name: 'Egg Shell',          w: [1, 0, 0, 2, 1, 1], tags: ['ram'] },
        box:     { name: 'Crate Frame',        w: [1, 1, 2, 0, 1, 0], tags: ['ram'] },
        boiler:  { name: 'Boiler Drum',        w: [2, 1, 1, 1, 1, 0], tags: ['ram', 'stack'] },
        barrel:  { name: 'Barrel Body',        w: [2, 1, 2, 0, 0, 0], tags: ['ram'] },
        bell:    { name: 'Diving Bell',        w: [2, 0, 1, 1, 2, 0], tags: ['ram', 'spray'] },
        dome:    { name: 'Rivet Dome',         w: [1, 0, 2, 0, 2, 0], tags: ['ram', 'guard'] },
        bulb:    { name: 'Glass Bulb',         w: [0, 0, 0, 3, 1, 1], tags: ['beam'] },
        tank:    { name: 'Armoured Hull',      w: [2, 1, 3, 0, 0, -1], tags: ['ram', 'guard'] },
        lantern: { name: 'Lantern Cage',       w: [0, 0, 0, 2, 2, 1], tags: ['beam'] },
        cone:    { name: 'Auger Body',         w: [0, 2, 0, 0, 0, 2], tags: ['drill'] },
        serpent: { name: 'Segmented Spine',    w: [1, 2, 0, 0, 0, 2], tags: ['ram', 'whip'] },
        disc:    { name: 'Saucer Hull',        w: [0, 0, 1, 2, 1, 2], tags: ['beam'] },
        frame:   { name: 'Girder Frame',       w: [1, 2, 1, 0, 0, 1], tags: ['ram'] },
        pod:     { name: 'Capsule Pod',        w: [1, 1, 1, 1, 1, 1], tags: ['ram'] },
        kettle:  { name: 'Kettle Belly',       w: [1, 0, 1, 2, 1, 0], tags: ['stack'] },
    },
    // ---------------------------------------------------------------- drive (locomotion)
    l: {
        none:    { name: 'Squat Base',         w: [0, 0, 1, 0, 0, -1], tags: [] },
        wheels:  { name: 'Spoked Wheels',      w: [0, 0, 0, 0, 0, 2], tags: ['ram'], move: 'ram' },
        wheel1:  { name: 'Unicycle Drive',     w: [0, 0, -1, 0, 0, 3], tags: ['ram'], move: 'steamroll' },
        treads:  { name: 'Caterpillar Treads', w: [1, 0, 2, 0, 0, -1], tags: ['ram'], move: 'scrap-slam' },
        legs2:   { name: 'Piston Legs',        w: [0, 1, 0, 0, 0, 1], tags: ['kick'], move: 'stomp' },
        legs4:   { name: 'Walker Legs',        w: [1, 0, 1, 0, 0, 1], tags: ['kick'], move: 'stomp' },
        spider:  { name: 'Spider Legs',        w: [0, 1, 0, 0, 0, 2], tags: ['claw', 'kick'], move: 'rake' },
        hover:   { name: 'Hover Jets',         w: [0, 0, -1, 0, 1, 2], tags: ['jet'], move: 'gust' },
        prop:    { name: 'Rotor Mast',         w: [0, 0, 0, 0, 0, 3], tags: ['wing'], move: 'gust' },
        slither: { name: 'Slither Coils',      w: [0, 1, 0, 0, 0, 2], tags: ['whip'], move: 'cable-whip' },
        pontoon: { name: 'Pontoons',           w: [1, 0, 0, 0, 1, 0], tags: ['spray'], move: 'spritz' },
        skis:    { name: 'Ice Runners',        w: [0, 0, 0, 0, 0, 2], tags: ['skate'], move: 'ice-skate' },
    },
    // ---------------------------------------------------------------- arms
    a: {
        claws:    { name: 'Claw Arms',         w: [0, 2, 0, 0, 0, 0], tags: ['claw'], move: 'rending-claw' },
        pincers:  { name: 'Pincer Arms',       w: [0, 1, 1, 0, 0, 0], tags: ['claw', 'grab'], move: 'clamp' },
        pistons:  { name: 'Piston Fists',      w: [0, 3, 0, 0, 0, 0], tags: ['punch'], move: 'hammer-fist' },
        hammers:  { name: 'Sledge Hammers',    w: [0, 3, 0, 0, 0, -1], tags: ['punch'], move: 'iron-hammer' },
        drills:   { name: 'Drill Arms',        w: [0, 3, 0, 0, 0, 0], tags: ['drill'], move: 'drill-spiral' },
        saws:     { name: 'Buzzsaw Arms',      w: [0, 2, 0, 0, 0, 1], tags: ['saw'], move: 'buzzsaw' },
        tesla:    { name: 'Tesla Rods',        w: [0, 0, 0, 3, 0, 0], tags: ['coil'], move: 'arc-lash' },
        cannons:  { name: 'Arm Cannons',       w: [0, 0, 0, 3, 0, 0], tags: ['blast'], move: 'scrap-cannon' },
        nozzles:  { name: 'Spray Nozzles',     w: [0, 0, 0, 2, 0, 0], tags: ['spray'], move: 'hose-blast' },
        tendrils: { name: 'Cable Tendrils',    w: [0, 1, 0, 1, 0, 1], tags: ['whip'], move: 'cable-whip' },
        grabbers: { name: 'Crane Hooks',       w: [0, 2, 1, 0, 0, 0], tags: ['grab'], move: 'crane-slam' },
        blades:   { name: 'Scythe Blades',     w: [0, 2, 0, 0, 0, 1], tags: ['saw'], move: 'shear' },
        shields:  { name: 'Arm Shields',       w: [0, 0, 3, 0, 1, 0], tags: ['guard'], move: 'bulwark' },
    },
    // ---------------------------------------------------------------- back rig
    b: {
        stack:    { name: 'Smokestack',        w: [1, 0, 0, 1, 0, 0], tags: ['stack'], move: 'smokestack-blast' },
        tank:     { name: 'Pressure Tank',     w: [2, 0, 0, 0, 0, 0], tags: ['spray'], move: 'pressure-blast' },
        gear:     { name: 'Drive Cog',         w: [0, 1, 1, 0, 0, 0], tags: ['gear'], move: 'gear-grind' },
        wings:    { name: 'Brass Wings',       w: [0, 0, 0, 0, 0, 2], tags: ['wing'], move: 'wing-slice' },
        propeller:{ name: 'Pusher Propeller',  w: [0, 0, 0, 0, 0, 2], tags: ['wing'], move: 'prop-wash' },
        coil:     { name: 'Tesla Tower',       w: [0, 0, 0, 2, 0, 0], tags: ['coil'], move: 'tesla-bolt' },
        turbine:  { name: 'Jet Turbine',       w: [0, 0, 0, 0, 0, 3], tags: ['jet'], move: 'jet-ram' },
        furnace:  { name: 'Furnace Grate',     w: [0, 1, 0, 1, 0, 0], tags: ['stack', 'blaze'], move: 'furnace-blast' },
        dish:     { name: 'Signal Dish',       w: [0, 0, 0, 0, 2, 0], tags: ['wave'], move: 'broadcast' },
        vats:     { name: 'Chemical Vats',     w: [0, 0, 0, 1, 1, 0], tags: ['spray'], move: 'toxic-spray' },
        crystal:  { name: 'Aether Crystals',   w: [0, 0, 0, 2, 1, 0], tags: ['beam'], move: 'aether-beam' },
        sail:     { name: 'Solar Sails',       w: [0, 0, 0, 0, 2, 0], tags: ['wing'], move: 'photosynth' },
        balloon:  { name: 'Gas Envelope',      w: [1, 0, 0, 0, 1, 0], tags: ['wing'], move: 'tailwind' },
        horn:     { name: 'Gramophone Horn',   w: [0, 0, 0, 2, 0, 0], tags: ['wave'], move: 'sonic-pulse' },
        spikes:   { name: 'Spike Ridge',       w: [0, 0, 2, 0, 0, 0], tags: ['guard'], move: 'scrap-shards' },
    },
    // ---------------------------------------------------------------- head
    h: {
        none:   { name: 'No Head',             w: [0, 0, 0, 0, 0, 0], tags: [] },
        dome:   { name: 'Dome Head',           w: [0, 0, 0, 0, 1, 0], tags: [] },
        box:    { name: 'Box Head',            w: [0, 0, 1, 0, 0, 0], tags: [] },
        lamp:   { name: 'Lamp Head',           w: [0, 0, 0, 1, 0, 0], tags: ['beam'], move: 'glare' },
        skull:  { name: 'Skull Plate',         w: [0, 1, 0, 0, 0, 0], tags: ['bite'], move: 'rust-bite' },
        helm:   { name: 'Porthole Helm',       w: [0, 0, 1, 0, 1, 0], tags: [] },
        visor:  { name: 'Slit Visor',          w: [0, 0, 0, 0, 0, 1], tags: [] },
        screen: { name: 'Picture Tube',        w: [0, 0, 0, 1, 0, 0], tags: ['wave'], move: 'ping' },
        beak:   { name: 'Riveted Beak',        w: [0, 1, 0, 0, 0, 0], tags: ['peck'], move: 'riveter-beak' },
        jaw:    { name: 'Steel Jaw',           w: [0, 2, 0, 0, 0, 0], tags: ['bite'], move: 'jawlock' },
    },
    // ---------------------------------------------------------------- crest (on top of the head)
    t: {
        antenna: { name: 'Whip Antenna',       w: [0, 0, 0, 0, 1, 0], tags: ['wave'], move: 'sonic-pulse' },
        horn:    { name: 'Ram Horn',           w: [0, 1, 0, 0, 0, 0], tags: ['horn'], move: 'horn-ram' },
        valve:   { name: 'Relief Valve',       w: [1, 0, 0, 0, 0, 0], tags: ['stack'], move: 'purge-vents' },
        lamp:    { name: 'Searchlight',        w: [0, 0, 0, 1, 0, 0], tags: ['beam'], move: 'glare' },
        fin:     { name: 'Stabiliser Fin',     w: [0, 0, 0, 0, 0, 1], tags: ['wing'], move: 'tailwind' },
        crown:   { name: 'Brass Crown',        w: [1, 1, 1, 1, 1, 1], tags: [] },
        spikes:  { name: 'Spiked Crest',       w: [0, 0, 1, 0, 0, 0], tags: ['guard'], move: 'scrap-shards' },
        whistle: { name: 'Steam Whistle',      w: [0, 0, 0, 1, 0, 0], tags: ['wave', 'stack'], move: 'steam-whistle' },
    },
    // ---------------------------------------------------------------- overgrowth / encrustation
    o: {
        moss:    { name: 'Moss Overgrowth',    w: [1, 0, 0, 0, 1, 0], tags: ['whip'], move: 'vine-lash' },
        frost:   { name: 'Rime Crust',         w: [0, 0, 1, 0, 0, 0], tags: [], move: 'rime-armor' },
        crystal: { name: 'Crystal Growths',    w: [0, 0, 0, 1, 0, 0], tags: ['beam'], move: 'prism-ray' },
        rust:    { name: 'Rust Bloom',         w: [0, 1, 0, 0, 0, 0], tags: ['bite'], move: 'oxidize' },
    },
};

/** Stat weight added by each type, so a Volt bot leans to Arc whatever its parts. */
export const TYPE_WEIGHT = {
    scrap: [1, 1, 0, 0, 0, 1], steam: [1, 0, 0, 1, 1, 0], blaze: [0, 1, 0, 2, 0, 0], hydro: [1, 0, 1, 1, 0, 0],
    frost: [0, 0, 0, 2, 1, 0], volt: [0, 0, 0, 2, 0, 1], grit: [0, 2, 1, 0, 0, 0], aero: [0, 1, 0, 0, 0, 2],
    iron: [0, 0, 3, 0, 0, -1], gear: [0, 1, 1, 0, 0, 1], toxic: [1, 0, 0, 1, 1, 0], moss: [1, 0, 0, 1, 1, 0],
    piston: [0, 3, 0, -1, 0, 1], signal: [0, 0, 0, 2, 1, 0], rust: [0, 1, 1, 0, 1, 0], void: [0, 0, 0, 2, 0, 1],
};

export function partName(slot, key) {
    const p = PARTS[slot] && PARTS[slot][key];
    return p ? p.name : key;
}
