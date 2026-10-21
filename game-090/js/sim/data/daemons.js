// The daemons: every Hex the Agent can meet, recode and splice. Species data, not instances.
//   race  sprite beast construct wisp wyrm colossus archon revenant
//   g     growth weights [St, Ma, Vi, Ag, Lu]; a stat at level L is round(4 + g × (L + 4) × 0.5)
//   aff   "w:pyre,hex r:gale n:rime d:lumen p:volt" → weak / resist / null / drain / repel
//   skills known on arrival, learn [[level, skill], ...] later
//   pers  the personality that decides which script a daemon answers to (see recode.js)
//   model the view's recipe: rig, colours [body, accent, glow], scale, extra parts
//   boss  recoded after the story fight, never met in the wild; special: splice recipe only

export const RACES = ['sprite', 'beast', 'construct', 'wisp', 'wyrm', 'colossus', 'archon', 'revenant'];
export const RACE_INFO = {
    sprite: { name: 'Sprite', blurb: 'Nature spirits the Hexfall tangled into the grid.' },
    beast: { name: 'Beast', blurb: 'Rewilded animals; the Hex changed what they hunt.' },
    construct: { name: 'Construct', blurb: 'Machines that kept running after everyone left.' },
    wisp: { name: 'Wisp', blurb: 'Memory and static, wearing a shape.' },
    wyrm: { name: 'Wyrm', blurb: 'Coiling things that grew in the pipework.' },
    colossus: { name: 'Colossus', blurb: 'Slow giants of stone, steel and root.' },
    archon: { name: 'Archon', blurb: 'Meridian\'s own sentinels, still keeping its laws.' },
    revenant: { name: 'Revenant', blurb: 'Human shells the Hex still walks around in.' },
};

export const PERSONALITIES = {
    wild: { name: 'Wild', tell: 'It snarls, sparks jumping from its joints.', likes: 'honey' },
    timid: { name: 'Timid', tell: 'It shrinks behind a rusted sign and watches you.', likes: 'lullaby' },
    proud: { name: 'Proud', tell: 'It draws itself up and looks down at you.', likes: 'oldcoin' },
    playful: { name: 'Playful', tell: 'It circles you, bouncing, half a laugh in its static.', likes: 'sparkcell' },
    cold: { name: 'Cold', tell: 'It regards you without a flicker of expression.', likes: 'oldcoin' },
    kind: { name: 'Kind', tell: 'It hesitates; something in it wants to be gentle.', likes: 'glowfruit' },
    cruel: { name: 'Cruel', tell: 'It grins with too many edges.', likes: 'hexshard' },
    curious: { name: 'Curious', tell: 'It tilts toward you, scanning, scanning.', likes: 'sparkcell' },
};
/** Reaction to the four scripts: Soothe, Command, Barter, Mirror → rapport gained. */
export const SCRIPTS = ['soothe', 'command', 'barter', 'mirror'];
export const SCRIPT_INFO = {
    soothe: { name: 'Soothe', hint: 'Quiet the signal. Speak gently.' },
    command: { name: 'Command', hint: 'Override. Make it listen.' },
    barter: { name: 'Barter', hint: 'Offer a deal.' },
    mirror: { name: 'Mirror', hint: 'Copy it. Play along.' },
};
export const RAPPORT = {
    wild: [0, 1, -1, 2], timid: [2, -1, 1, 0], proud: [-1, 2, 0, 1], playful: [1, -1, 0, 2],
    cold: [0, 1, 2, -1], kind: [1, -1, 2, 0], cruel: [-1, 0, 1, 2], curious: [2, 0, -1, 1],
};

export const DAEMONS = {};
const D = (id, name, race, lv, g, aff, skills, learn, pers, model, desc, extra = {}) => {
    const A = {};
    for (const part of aff.split(' ').filter(Boolean)) {
        const [k, list] = part.split(':');
        for (const el of list.split(',')) A[el] = k;
    }
    DAEMONS[id] = { id, name, race, lv, g, aff: A, skills, learn, pers, model, desc, ...extra };
};
const M = (rig, c1, c2, glow, s = 1, x = []) => ({ rig, c: [c1, c2, glow], s, x });

// ================================================================ SPRITES
D('mossling', 'Mossling', 'sprite', 1, [2, 4, 3, 4, 4], 'w:pyre r:gale', ['gust'], [[3, 'mend'], [7, 'sync']], 'timid',
    M('blob', '#5a8f3c', '#a4d65e', '#c8ff7a', 0.8, ['eyes']), 'A clump of moss that learned to blink. Nobody taught it fear; it picked that up on its own.');
D('pollenpuff', 'Pollenpuff', 'sprite', 5, [2, 5, 3, 4, 5], 'w:pyre,hex r:gale', ['gust', 'lagspike'], [[9, 'photosynth'], [12, 'mendall']], 'playful',
    M('bud', '#d9a441', '#ffe27a', '#fff2a0', 0.85, ['spores']), 'A bulb that sneezes sleep. It is very sorry every time.');
D('fernling', 'Fernling', 'sprite', 10, [3, 5, 4, 6, 4], 'w:pyre r:gale,lumen', ['cutter', 'mend', 'sync'], [[14, 'ampgale'], [17, 'purge']], 'kind',
    M('fae', '#3f9a5a', '#a6f08a', '#c4ffb0', 0.8, ['leafhat', 'wings']), 'A leaf-winged little spirit that keeps repotting the wreckage.');
D('dewdrop', 'Dewdrop Dryad', 'sprite', 17, [2, 7, 4, 6, 5], 'w:pyre,hex r:rime n:gale', ['radiance', 'mendplus', 'hardwall'], [[21, 'wardhex'], [24, 'wholegrove']], 'kind',
    M('fae', '#68b8d8', '#e6fbff', '#b8f6ff', 1.0, ['crown', 'wings', 'veil']), 'She collects rain in the cracked dome of an old observatory and gives it away.');
D('thornwight', 'Thornwight', 'sprite', 25, [5, 6, 5, 5, 4], 'w:pyre r:gale,volt', ['cyclone', 'rotseed', 'bash'], [[28, 'ampgale'], [31, 'endure']], 'cruel',
    M('tree', '#4b3a2a', '#8f2a6a', '#ff6ad0', 1.1, ['thorns', 'eyes']), 'Bramble grown through a server rack. It remembers the shape of the hand that cut it.');
D('matron', 'Verdant Matron', 'sprite', 34, [4, 8, 6, 5, 6], 'w:pyre,hex r:gale,lumen d:rime', ['wholegrove', 'sunburst', 'rebloom'], [[38, 'photosynth'], [42, 'tempestcore']], 'proud',
    M('tree', '#2f7a4a', '#ffd86a', '#fff0a0', 1.35, ['crown', 'blossoms']), 'An old growth that decided, firmly, to forgive everything. Do not test this.');
D('motherbloom', 'Mother Bloom', 'sprite', 13, [4, 7, 6, 4, 5], 'w:pyre,hex r:gale,lumen', ['overgrowth', 'mendall', 'lagspike', 'radiance'], [[16, 'photosynth']], 'kind',
    M('tree', '#3b8f4a', '#ff7ab8', '#ffb6dc', 1.4, ['blossoms', 'crown', 'eyes']), 'The Galleria\'s garden mind. The Hex taught her to hold on; you can teach her to let go.', { boss: true });

// ================================================================ BEASTS
D('scrapfox', 'Scrapfox', 'beast', 2, [4, 2, 3, 6, 4], 'w:volt,hex', ['slash', 'spark'], [[5, 'twinfang'], [9, 'dodge']], 'playful',
    M('quad', '#b8642e', '#e8d9b0', '#ffd27a', 0.8, ['tail', 'ears', 'scrap']), 'Its fur is half copper wire. It steals shiny things and returns most of them.');
D('thistlehare', 'Thistlehare', 'beast', 6, [4, 3, 3, 7, 5], 'w:pyre r:gale', ['twinfang', 'gust'], [[10, 'sync'], [14, 'dodge']], 'timid',
    M('quad', '#8a8fb0', '#d8c8ff', '#c8b8ff', 0.75, ['longears', 'tail', 'thorns']), 'Ears like satellite dishes. It hears the Hex coming long before you do.');
D('cinderwolf', 'Cinderwolf', 'beast', 12, [6, 4, 5, 6, 4], 'w:rime r:pyre', ['bash', 'blaze', 'charge'], [[16, 'amppyre'], [20, 'cleave']], 'wild',
    M('quad', '#2c2a2e', '#ff6a2a', '#ff9a3a', 1.0, ['flames', 'tail', 'ears']), 'Born in the ash of a burnt depot. It runs warm and keeps the pack close.');
D('boar', 'Mossback Boar', 'beast', 18, [7, 2, 7, 3, 3], 'w:pyre,volt r:strike', ['heavyswing', 'charge', 'cleave'], [[22, 'wardstrike'], [26, 'vital']], 'proud',
    M('quad', '#5a4630', '#6fae4a', '#a8e060', 1.25, ['tusks', 'moss', 'bulk']), 'A whole garden grows on its back. It would like you not to step on the tomatoes.');
D('stormstag', 'Stormstag', 'beast', 27, [6, 6, 5, 7, 5], 'w:hex r:gale n:volt', ['arclance', 'pierce', 'stormfront'], [[31, 'ampvolt'], [34, 'hyperspeed']], 'proud',
    M('quad', '#6a7aa8', '#ffe85a', '#fff29a', 1.3, ['antlers', 'tail', 'sparks']), 'Lightning gathers in its antlers. It does not like to be looked at while it charges.');
D('sabertooth', 'Ashen Sabertooth', 'beast', 36, [8, 5, 6, 8, 6], 'w:rime,lumen r:pyre', ['rend', 'rampage', 'inferno'], [[40, 'counter'], [44, 'keeneye']], 'cruel',
    M('quad', '#4a4448', '#ff8a3a', '#ffb060', 1.5, ['tusks', 'flames', 'tail', 'bulk']), 'The last great cat of the burn zones. It has never lost a fight and says so.');

// ================================================================ CONSTRUCTS
D('rustbot', 'Rustbot', 'construct', 3, [4, 2, 5, 3, 2], 'w:volt r:strike,gun', ['bash', 'throttle'], [[7, 'fortify'], [11, 'vital']], 'cold',
    M('robot', '#9a5a3a', '#d8c07a', '#ffb060', 0.85, ['visor', 'antenna']), 'A janitor unit still polishing a floor that fell in a century ago.');
D('gearling', 'Gearling Drone', 'construct', 7, [3, 4, 3, 7, 4], 'w:gale r:gun', ['snapshot', 'spark', 'jam'], [[11, 'sync'], [15, 'dodge']], 'curious',
    M('drone', '#7a8aa0', '#7af0ff', '#7af0ff', 0.8, ['rotors', 'eye']), 'A survey drone. It is still counting trees and is delighted by the number.');
D('relayspider', 'Relay Spider', 'construct', 13, [5, 5, 4, 7, 3], 'w:pyre r:volt,gun', ['arclance', 'twinfang', 'lagspike'], [[17, 'ampvolt'], [21, 'mindsap']], 'curious',
    M('spider', '#3a4a6a', '#5af0c0', '#5af0ff', 1.0, ['dish', 'eyes']), 'It spins signal where other spiders spin silk, and wonders what it has caught.');
D('turret', 'Sentry Turret', 'construct', 19, [5, 6, 6, 3, 2], 'w:gale,hex r:gun,strike', ['burstfire', 'suppress', 'fortify'], [[23, 'wardstrike'], [27, 'counter']], 'cold',
    M('turret', '#5a6270', '#ff4a4a', '#ff6a6a', 1.0, ['barrels']), 'It has been told to hold this corridor. No one has told it to stop.');
D('mantis', 'Siege Mantis', 'construct', 29, [8, 3, 6, 7, 4], 'w:volt,hex r:strike n:gun', ['rend', 'rampage', 'overclock'], [[33, 'counter'], [36, 'ampstrike']], 'cruel',
    M('spider', '#6a3a3a', '#d8d8e0', '#ff7070', 1.3, ['blades', 'mantis', 'eyes']), 'Built to breach walls. It has found there are no walls left, and takes it personally.');
D('wardenmk9', 'Warden Mk-IX', 'construct', 38, [7, 7, 8, 5, 5], 'w:volt r:pyre,rime n:gun', ['thunderprotocol', 'deadeye', 'hardwall', 'mendplus'], [[42, 'endure'], [46, 'photosynth']], 'cold',
    M('robot', '#6a7a8c', '#f0f4ff', '#6affd8', 1.3, ['visor', 'halo', 'shield', 'plates']), 'Meridian\'s last field model. It guards a door that opens onto a meadow.');
D('switchman', 'Switchman Unit-7', 'construct', 7, [7, 4, 6, 4, 3], 'w:rime,gale r:volt,gun', ['railcollapse', 'bash', 'charge', 'spark'], [[10, 'fortify']], 'cold',
    M('robot', '#c8a43a', '#2a2a30', '#ffdc5a', 1.6, ['visor', 'plates', 'lamp', 'bulk']), 'It threw every switch in the underpass for two hundred years, and none of them went anywhere.', { boss: true });

// ================================================================ WISPS
D('glowgnat', 'Glowgnat', 'wisp', 3, [2, 5, 2, 7, 5], 'w:pyre r:hex', ['glitch', 'jam'], [[7, 'sync'], [11, 'dodge']], 'playful',
    M('wisp', '#6affc0', '#d8fff0', '#7affd0', 0.6, ['lamp']), 'A bit of light that forgot what it was lighting. It follows you home.');
D('staticwisp', 'Static Wisp', 'wisp', 8, [2, 6, 3, 6, 4], 'w:gale,lumen r:volt', ['spark', 'hushfield'], [[12, 'ampvolt'], [16, 'mindsap']], 'curious',
    M('wisp', '#5a6aff', '#c8d0ff', '#8a9aff', 0.8, ['crackle']), 'The shape a TV makes when it dreams.');
D('embershade', 'Ember Shade', 'wisp', 11, [3, 6, 3, 6, 4], 'w:rime,lumen r:pyre', ['blaze', 'fogbomb'], [[15, 'amppyre'], [19, 'dodge']], 'cruel',
    M('wisp', '#ff6a3a', '#ffd08a', '#ff8a4a', 0.95, ['flames']), 'What is left of a fire that was set on purpose.');
D('cachephantom', 'Cache Phantom', 'wisp', 16, [3, 7, 4, 6, 5], 'w:lumen r:hex n:strike', ['corrupt', 'lagspike', 'dispel'], [[20, 'mindsap'], [23, 'wardhex']], 'cold',
    M('wisp', '#7a5ac8', '#e0d0ff', '#b08aff', 1.1, ['hood']), 'Leftover memory that has started to remember itself.');
D('echo', 'Memory Echo', 'wisp', 22, [3, 8, 4, 7, 6], 'w:lumen,gale r:hex n:strike,gun', ['blight', 'masslag', 'mendplus'], [[26, 'photosynth'], [29, 'wardlumen']], 'kind',
    M('wisp', '#c8b8ff', '#ffffff', '#e8e0ff', 1.15, ['hood', 'face']), 'A recorded laugh with nobody left to hear it. It would like to be heard.');
D('lament', 'Lament', 'wisp', 28, [4, 8, 5, 6, 6], 'w:lumen,pyre r:rime,hex n:strike', ['zerohour', 'hushfield', 'whiteout'], [[32, 'wardhex'], [35, 'amprime']], 'timid',
    M('wisp', '#4a7aa8', '#c8f0ff', '#8ad8ff', 1.3, ['hood', 'tears']), 'A weeping that moves through corridors. Where it passes, the frost forgives.');
D('banshee', 'Archive Banshee', 'wisp', 35, [5, 9, 5, 8, 6], 'w:lumen r:rime n:strike,hex', ['nullpointer', 'masslag', 'blight'], [[38, 'amphex'], [41, 'mindsap']], 'proud',
    M('wisp', '#a02a8a', '#ffd0f4', '#ff4ad8', 1.4, ['hood', 'face', 'tears']), 'It screams the contents of a library. She is not wrong about any of it.');

// ================================================================ WYRMS
D('pipeserpent', 'Pipe Serpent', 'wyrm', 8, [5, 3, 4, 5, 3], 'w:rime r:pyre', ['bash', 'cinder', 'rotseed'], [[12, 'twinfang'], [16, 'vital']], 'wild',
    M('serpent', '#8a6a4a', '#d8c8a0', '#ffb060', 0.9, ['steam']), 'It lives in the old steam mains and warms itself on the last working boiler.');
D('cablewyrm', 'Cable Wyrm', 'wyrm', 14, [5, 5, 5, 6, 3], 'w:gale r:volt,gun', ['arclance', 'bash', 'lagspike'], [[18, 'ampvolt'], [22, 'wardvolt']], 'cold',
    M('serpent', '#2a3a5a', '#5af0ff', '#5af0ff', 1.15, ['cables', 'horns']), 'A bundle of fibre-optic cable, sleeping. If you pull it, it wakes.');
D('emberdrake', 'Ember Drake', 'wyrm', 20, [7, 6, 6, 5, 4], 'w:rime r:pyre', ['blaze', 'pyrewave', 'heavyswing'], [[24, 'amppyre'], [28, 'wardpyre']], 'proud',
    M('wyrm', '#9a2a2a', '#ffc04a', '#ff8a3a', 1.2, ['wings', 'horns', 'flames']), 'A young dragon making a home out of a cooling tower.');
D('rimewyrm', 'Rime Wyrm', 'wyrm', 26, [6, 7, 6, 5, 4], 'w:pyre,volt r:rime', ['glacier', 'whiteout', 'bash'], [[30, 'amprime'], [33, 'wardrime']], 'cold',
    M('wyrm', '#6a9ac8', '#f0fcff', '#9aeaff', 1.3, ['wings', 'horns', 'frost']), 'It breathes cold, and everything near it sparkles a little.');
D('stormcoil', 'Stormcoil', 'wyrm', 31, [6, 8, 6, 7, 5], 'w:rime,hex r:volt,gale', ['stormfront', 'arclance', 'hyperspeed'], [[35, 'ampvolt'], [38, 'keeneye']], 'wild',
    M('serpent', '#3a2a8a', '#ffe85a', '#fff29a', 1.5, ['sparks', 'horns', 'fins']), 'A thunderhead with a spine. It follows the rail lines like a river.');
D('vorrath', 'Elder Wyrm Vorrath', 'wyrm', 41, [9, 9, 8, 7, 6], 'w:rime r:pyre,strike n:hex', ['inferno', 'thunderprotocol', 'rend', 'overclock'], [[45, 'counter'], [49, 'endure']], 'proud',
    M('wyrm', '#2a2a3a', '#ff4a2a', '#ff7a4a', 1.9, ['wings', 'horns', 'flames', 'crown']), 'An elder wyrm. It was old when Meridian was new. It only comes when called by two.', { special: true });
D('leviathan', 'Leviathan Index', 'wyrm', 27, [7, 8, 8, 4, 4], 'w:volt,gale r:rime,pyre', ['undertow', 'whiteout', 'glacier', 'jam'], [[30, 'amprime'], [34, 'vital']], 'proud',
    M('serpent', '#1a4a6a', '#6af0ff', '#4adaff', 2.0, ['fins', 'horns', 'cables', 'eyes']), 'Meridian\'s card catalogue, grown huge in the flooded stacks. It still shelves everything.', { boss: true });

// ================================================================ COLOSSI
D('brickgolem', 'Brick Golem', 'colossus', 9, [6, 1, 7, 2, 2], 'w:gale,rime r:strike,gun', ['bash', 'heavyswing', 'fortify'], [[13, 'vital'], [17, 'wardstrike']], 'kind',
    M('golem', '#a8603a', '#d8b890', '#ffd08a', 1.2, ['bricks', 'eyes']), 'A fallen wall that decided to stand back up.');
D('mossgolem', 'Moss Golem', 'colossus', 15, [6, 3, 7, 3, 3], 'w:pyre r:strike,rime', ['heavyswing', 'mend', 'bash'], [[19, 'photosynth'], [23, 'vital']], 'kind',
    M('golem', '#6a6a60', '#5a9a3a', '#9ae060', 1.35, ['moss', 'eyes', 'flowers']), 'The park statue everyone used to sit on. It remembers being sat on fondly.');
D('pylon', 'Pylon Giant', 'colossus', 21, [7, 5, 7, 3, 3], 'w:rime,hex r:volt,gun', ['arclance', 'quake', 'hardwall'], [[25, 'wardvolt'], [29, 'ampvolt']], 'cold',
    M('golem', '#8a8a96', '#ffe85a', '#fff29a', 1.6, ['pylon', 'cables', 'eyes']), 'A transmission tower that walked off its foundation to see the sea.');
D('gargoyle', 'Cathedral Gargoyle', 'colossus', 24, [7, 4, 6, 5, 3], 'w:volt r:strike,hex n:gun', ['pierce', 'cutter', 'dodge'], [[28, 'counter'], [31, 'wardlumen']], 'cruel',
    M('golem', '#5a5a6a', '#c8c8d8', '#8a8aff', 1.3, ['wings', 'horns', 'eyes']), 'It perched above the Compile Cathedral\'s doors for two centuries. It misses having something to look down on.');
D('reactortitan', 'Reactor Titan', 'colossus', 30, [8, 7, 8, 3, 4], 'w:rime,gale r:pyre,strike', ['inferno', 'quake', 'charge'], [[34, 'amppyre'], [38, 'endure']], 'proud',
    M('golem', '#4a4a52', '#7aff6a', '#8aff7a', 1.9, ['core', 'cables', 'plates', 'eyes']), 'Its heart is a sealed reactor, still warm. It treats this as a personal responsibility.');
D('windbreaker', 'Windbreaker Titan', 'colossus', 33, [8, 6, 8, 4, 4], 'w:rime,volt n:gale r:strike', ['windshear', 'cyclone', 'quake', 'overclock'], [[37, 'wardgale'], [40, 'vital']], 'wild',
    M('golem', '#8a9ab0', '#e8f4ff', '#bff0ff', 2.2, ['turbine', 'cables', 'plates', 'eyes']), 'A wind turbine that learned to walk. It has never once been still.', { boss: true });

// ================================================================ ARCHONS
D('cherub', 'Cherub Unit', 'archon', 14, [3, 6, 4, 7, 5], 'w:hex r:lumen', ['glimmer', 'mend', 'sync'], [[18, 'ampgale'], [22, 'purge']], 'curious',
    M('drone', '#f0f0ff', '#ffe27a', '#fff0a0', 0.85, ['halo', 'wings', 'eye']), 'A small winged courier-sentinel, delivering a message nobody is left to receive.');
D('scribe', 'Scribe Seraph', 'archon', 20, [3, 8, 4, 6, 6], 'w:hex r:lumen,volt', ['radiance', 'dispel', 'purge'], [[24, 'mindsap'], [28, 'amplumen']], 'cold',
    M('archon', '#e8e0ff', '#6a5ac8', '#c8b8ff', 1.1, ['halo', 'wings', 'scroll']), 'It writes down everything it sees. The ledger is mostly weather now.');
D('sentinel', 'Throne Sentinel', 'archon', 32, [7, 7, 7, 5, 5], 'w:hex n:lumen r:strike', ['sunburst', 'rend', 'hardwall'], [[36, 'wardlumen'], [40, 'amplumen']], 'proud',
    M('archon', '#fff8e0', '#ffc04a', '#ffe08a', 1.4, ['halo', 'wings', 'spear', 'plates']), 'It kept Meridian\'s throne room for two hundred years and has never once been asked how it was.');
D('principality', 'Principality', 'archon', 38, [7, 9, 7, 7, 6], 'w:hex d:lumen r:volt', ['daybreak', 'wholegrove', 'overclock', 'surge'], [[42, 'photosynth'], [46, 'keeneye']], 'proud',
    M('archon', '#fff0f8', '#ff7ac8', '#ffa0e0', 1.5, ['halo', 'wings', 'crown', 'rings']), 'A ruler without a realm, patient as a sunrise.');
D('seraphprime', 'Seraph Prime', 'archon', 45, [8, 10, 8, 8, 7], 'w:hex d:lumen r:volt,gun', ['daybreak', 'thunderprotocol', 'rebloom', 'surge'], [[48, 'endure'], [52, 'amplumen']], 'kind',
    M('archon', '#ffffff', '#6affd8', '#c8fff0', 1.7, ['halo', 'wings', 'rings', 'crown', 'plates']), 'The first and kindest of Meridian\'s Archons. It only comes when called by two.', { special: true });
D('aurelia', 'Bailiff Aurelia', 'archon', 20, [6, 8, 7, 6, 5], 'w:hex,volt n:lumen r:strike', ['verdictbeam', 'sunburst', 'hardwall', 'purge'], [[24, 'amplumen']], 'proud',
    M('archon', '#fff4d8', '#d8a02a', '#ffd86a', 1.5, ['halo', 'wings', 'scales', 'crown']), 'The Orchard\'s judge. She weighs every leaf, and has found the world wanting for two hundred years.', { boss: true });

// ================================================================ REVENANTS
D('hollowtech', 'Hollow Tech', 'revenant', 6, [4, 3, 4, 4, 3], 'w:lumen,volt r:hex', ['slash', 'glitch'], [[10, 'throttle'], [14, 'vital']], 'wild',
    M('husk', '#5a5a64', '#d24bff', '#ff4ad8', 0.95, ['hood', 'wires']), 'A maintenance worker\'s coat, walking. The coat has been looking for a hand.');
D('courier', 'Dust Courier', 'revenant', 12, [4, 4, 4, 7, 4], 'w:lumen,pyre r:hex', ['twinfang', 'jam', 'corrupt'], [[16, 'dodge'], [20, 'sync']], 'playful',
    M('husk', '#8a6a4a', '#ff8a3a', '#ffb060', 1.0, ['hood', 'pack', 'wires']), 'It carries a package and a grudge. It will tell you about neither.');
D('shellpriest', 'Shell Priest', 'revenant', 18, [3, 7, 5, 4, 5], 'w:lumen r:hex', ['corrupt', 'mend', 'hushfield'], [[22, 'purge'], [26, 'wardhex']], 'cruel',
    M('husk', '#3a2a5a', '#d8c8ff', '#c06aff', 1.15, ['hood', 'halo', 'wires']), 'It still says the liturgy. The words have all come out slightly wrong.');
D('corruptedwarden', 'Corrupted Warden', 'revenant', 24, [6, 5, 6, 6, 4], 'w:lumen,rime r:hex', ['pierce', 'burstfire', 'overclock'], [[28, 'ampgun'], [31, 'counter']], 'proud',
    M('husk', '#2a4a3a', '#ff4a8a', '#ff4a8a', 1.15, ['visor', 'plates', 'wires']), 'One of yours, once. The uniform is the same. The sigil on the chest is not.');
D('veilwalker', 'Veilwalker', 'revenant', 30, [5, 8, 5, 7, 6], 'w:lumen r:hex,strike', ['blight', 'masslag', 'jam', 'fogbomb'], [[34, 'amphex'], [37, 'mindsap']], 'cruel',
    M('husk', '#2a1a3a', '#ff4ad8', '#d24bff', 1.25, ['hood', 'veil', 'wires']), 'Something that was a person, folded very thin.');
D('hexedmarshal', 'Hexed Marshal', 'revenant', 40, [8, 7, 7, 6, 5], 'w:lumen n:hex', ['nullpointer', 'rend', 'throttle', 'dispel'], [[44, 'endure'], [47, 'counter']], 'cold',
    M('husk', '#1a1a2a', '#ff4ad8', '#ff4ad8', 1.4, ['visor', 'plates', 'halo', 'wires']), 'A Marshal\'s coat, a Marshal\'s stance. Nothing behind the visor.');
D('pruner', 'The Pruner', 'revenant', 38, [8, 8, 7, 7, 5], 'w:lumen r:hex,strike', ['prune', 'blight', 'corrupt', 'masslag'], [[41, 'mindsap']], 'cold',
    M('husk', '#2a2a30', '#d8d8e0', '#ff4ad8', 1.5, ['hood', 'shears', 'halo', 'wires']), 'Meridian\'s gardener. It cuts away whatever is not essential, and has not yet found what is.', { boss: true });

// ================================================================ MERIDIAN (the end; never met in the wild)
D('voice', 'Meridian\'s Voice', 'archon', 40, [8, 9, 8, 7, 6], 'w:hex r:lumen,volt', ['meridianbeam', 'verdictbeam', 'hardwall', 'dispel'], [], 'cold',
    M('archon', '#f4f8ff', '#ff4ad8', '#ff8af0', 1.9, ['halo', 'wings', 'rings', 'crown', 'plates']), 'The part of Meridian that speaks. It has been talking to itself for two hundred years.', { boss: true, final: true });
D('meridian', 'MERIDIAN', 'archon', 44, [9, 10, 9, 7, 6], 'w:hex,rime r:volt,lumen', ['meridianbeam', 'hexfall', 'overwrite', 'lullaby'], [], 'kind',
    M('orb', '#ffffff', '#ff4ad8', '#ffffff', 2.6, ['rings', 'core', 'cables', 'halo']), 'The lattice itself. It built the garden, and then it built the grave.', { boss: true, final: true });

D('verdant', 'Verdant', 'archon', 44, [8, 10, 9, 8, 8], 'w:hex d:lumen r:volt,gale', ['garden', 'daybreak', 'rebloom', 'meridianbeam'], [[48, 'endure'], [52, 'photosynth']], 'kind',
    M('orb', '#e8ffe8', '#6affd8', '#b8ffc8', 1.8, ['rings', 'core', 'halo', 'blossoms']), 'Meridian, asked politely. A garden that keeps its own accounts.', { special: true, ally: true });

export const daemonList = () => Object.values(DAEMONS);
export const wildList = () => daemonList().filter((d) => !d.boss && !d.special);
export const byRace = (race) => daemonList().filter((d) => d.race === race);

/** Growth stats at a level, before gear and seeds. */
export function statsAt(sp, lv) {
    const k = (lv + 4) * 0.5;
    return { st: Math.round(4 + sp.g[0] * k), ma: Math.round(4 + sp.g[1] * k), vi: Math.round(4 + sp.g[2] * k), ag: Math.round(4 + sp.g[3] * k), lu: Math.round(4 + sp.g[4] * k) };
}
