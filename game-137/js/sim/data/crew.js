// The people you rescue. Each moves onto the carrier Skylark and, every so often in real time,
// leaves a small gift in the Crew Deck: credits, or a boost for the next sortie.
// `art` is the portrait prompt for fal (dev/art/prompts.mjs); keep it true to the character.

export const GIFTS = {
    gold: { name: 'Credits', icon: '💰' },
    bento: { name: 'Bento Box', icon: '🍱', desc: '+25 max HP next sortie' },
    charm: { name: 'Lucky Charm', icon: '🧲', desc: '+1.5 magnet reach next sortie' },
    tuneup: { name: 'Tune-up', icon: '🔧', desc: 'Start the next sortie at level 2' },
    cheer: { name: 'Cheer Song', icon: '🎤', desc: 'Start the next sortie with Overdrive full' },
    ammo: { name: 'Hot Rounds', icon: '🔥', desc: '+15% damage next sortie' },
    ward: { name: 'Shrine Ward', icon: '⛩️', desc: '+30 shield next sortie' },
    tea: { name: 'Herb Tea', icon: '🍵', desc: 'Regenerate 1.2 HP a second next sortie' },
    turbo: { name: 'Turbo Oil', icon: '🛢️', desc: '+12% speed next sortie' },
    luck: { name: 'Maneki Cat', icon: '🐈', desc: 'Monsters drop more gold voxels next sortie' },
};
export const BOOSTS = Object.keys(GIFTS).filter((k) => k !== 'gold');

export const CREW = [
    { id: 'hana', name: 'Hana Mori', role: 'Ramen cook', gift: 'bento', every: 600,
        line: 'Eat up, pilot! Nobody fights on an empty stomach.',
        art: 'a cheerful young woman ramen cook with a white headband, short brown bob hair, rolled-up sleeves, holding a steaming bento box' },
    { id: 'gen', name: 'Old Gen', role: 'Retired mechanic', gift: 'gold', amount: 70, every: 540,
        line: 'Found these bolts in the scrap heap. Sell ’em, buy something loud.',
        art: 'a wiry old mechanic with a grey moustache, welding goggles pushed up on his forehead, oil-stained overalls and a big wrench on his shoulder' },
    { id: 'twins', name: 'Tomo & Yui', role: 'Twin kids', gift: 'charm', every: 720,
        line: 'We made you a magnet charm! It pulls in lucky stuff!',
        art: 'two small twin children, a boy and a girl about eight years old, matching yellow raincoats, grinning, holding up a handmade magnet charm on a string' },
    { id: 'sato', name: 'Dr. Sato', role: 'Lattice scientist', gift: 'tuneup', every: 900,
        line: 'I recalibrated your servos overnight. Don’t thank me, just survive.',
        art: 'a tired brilliant woman scientist in a long white lab coat, round glasses, long black hair in a messy ponytail, holding a glowing crystal sample' },
    { id: 'rin', name: 'Rin Hoshizora', role: 'Pop idol', gift: 'cheer', every: 840,
        line: 'I recorded a song just for your cockpit. Turn it up when it gets scary!',
        art: 'a bright teenage pop idol with long pink twin-tail hair, a sparkly stage outfit and a headset microphone, winking and making a peace sign' },
    { id: 'goro', name: 'Officer Goro', role: 'Ex-police sergeant', gift: 'ammo', every: 780,
        line: 'Hand-packed rounds. They hit harder than the factory kind.',
        art: 'a broad-shouldered middle-aged police sergeant with a square jaw, short black crew cut, a scar on his chin, a blue uniform jacket with rolled sleeves' },
    { id: 'miko', name: 'Miko Asahi', role: 'Shrine maiden', gift: 'ward', every: 760,
        line: 'This ward kept our shrine standing. May it keep you standing too.',
        art: 'a calm young shrine maiden in a white and red miko outfit, long straight black hair tied low, holding a paper ofuda ward charm' },
    { id: 'benji', name: 'Benji', role: 'Courier kid', gift: 'gold', amount: 45, every: 420,
        line: 'Delivery! Some folks downtown chipped in for you.',
        art: 'a scrappy energetic boy courier about twelve with spiky orange hair, a backwards cap, a big messenger bag and a bandage on his nose' },
    { id: 'ume', name: 'Professor Ume', role: 'Botanist', gift: 'tea', every: 820,
        line: 'Brewed from the last wild leaves in the valley. Slowly, now. Sip.',
        art: 'a kind elderly woman botanist with white hair in a bun, a green cardigan, a straw sun hat, holding a small teapot and a sprig of leaves' },
    { id: 'saki', name: 'Saki Kaze', role: 'Street racer', gift: 'turbo', every: 700,
        line: 'Racing oil. Your legs will feel like new tyres.',
        art: 'a cool young woman street racer with a short silver undercut, a red racing jacket covered in patches, fingerless gloves, a helmet under her arm' },
    { id: 'ota', name: 'Captain Ota', role: 'Fisherman', gift: 'gold', amount: 110, every: 960,
        line: 'Sold the catch. Half’s yours, kid, and don’t argue.',
        art: 'a big bearded old fisherman captain with a weathered face, a navy captain hat, a thick knit sweater and a pipe' },
    { id: 'nana', name: 'Nana & Mochi', role: 'Cat café owner', gift: 'luck', every: 880,
        line: 'Mochi says you’ll be lucky today. Mochi is never wrong.',
        art: 'a gentle young woman cafe owner with a lavender apron and wavy auburn hair, cradling a round white cat with one paw raised like a lucky cat' },
];

export const crewById = (id) => CREW.find((c) => c.id === id);

/** The two voices of the story, painted by fal too. */
export const CAST = {
    kai: { name: 'Kai Arashi', role: 'Pilot, Shardframe Unit-07',
        art: 'a determined seventeen year old mech pilot with spiky dark blue hair, a sleek orange and charcoal-grey pilot suit with teal piping and a high collar, a headset, fists clenched, intense eyes' },
    mirei: { name: 'Captain Mirei Tachibana', role: 'Commander, carrier Skylark',
        art: 'a composed woman commander in her thirties with long dark purple hair, a white naval officer coat with gold epaulettes over her shoulders, arms folded, a sharp confident smile' },
};
