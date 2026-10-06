// The story of a scrap kid from Cinderwick: characters, trainer classes, the Forgemasters,
// the Furnace Four, the rival, scripted scenes and the objective chain.
//
// Scripts are arrays of commands run by js/sim/game.js:
//   ['say', who, text] · ['ask', text, [yes…], [no…]] · ['give', item, n] · ['giveBot', name, lv]
//   ['starter'] · ['battle', trainerKey] · ['wild', name, lv, flag] · ['flag', key, value]
//   ['story', n] · ['heal'] · ['seal', n] · ['cogs', n] · ['if', cond, [then…], [else…]]
//   ['fx', name] · ['music', theme] · ['ending'] · ['end']

export const PLAYER_NAME_DEFAULT = 'Rivet';

// ------------------------------------------------------------------ trainer classes
export const CLASSES = {
    scrapper:    { title: 'Scrapper', pay: 16, ai: 1 },
    tinker:      { title: 'Tinker', pay: 20, ai: 1 },
    gearhead:    { title: 'Gearhead', pay: 24, ai: 1 },
    prospector:  { title: 'Prospector', pay: 24, ai: 1 },
    clocksmith:  { title: 'Clocksmith', pay: 28, ai: 1 },
    boilermaker: { title: 'Boilermaker', pay: 28, ai: 1 },
    sparkwitch:  { title: 'Spark Witch', pay: 30, ai: 1 },
    junkdiver:   { title: 'Junk Diver', pay: 24, ai: 1 },
    brawler:     { title: 'Brawler', pay: 28, ai: 1 },
    dockhand:    { title: 'Dockhand', pay: 26, ai: 1 },
    chemist:     { title: 'Chemist', pay: 30, ai: 1 },
    frostrunner: { title: 'Frostrunner', pay: 32, ai: 1 },
    aeronaut:    { title: 'Aeronaut', pay: 36, ai: 1 },
    stationhand: { title: 'Stationhand', pay: 32, ai: 1 },
    veteran:     { title: 'Veteran', pay: 48, ai: 2 },
    grunt:       { title: '', pay: 20, ai: 1 },
    sergeant:    { title: 'Syndicate', pay: 40, ai: 1 },
    exec:        { title: 'Syndicate Executive', pay: 60, ai: 2 },
    baron:       { title: 'Syndicate Boss', pay: 100, ai: 2 },
    leader:      { title: 'Forgemaster', pay: 120, ai: 2 },
    four:        { title: 'Furnace Four', pay: 150, ai: 3 },
    champion:    { title: 'Champion', pay: 200, ai: 3 },
    rival:       { title: 'Rival', pay: 40, ai: 1 },
};

// ------------------------------------------------------------------ how people look (js/view/people.js)
// body: kid · adult · big · tall · old   hat: none cap top bowler aviator wide witch helm hood bandana mask crown captain plague bun
export const LOOKS = {
    player:    { body: 'kid', skin: '#e0b48a', hair: '#3a2418', hairStyle: 'messy', hat: 'cap', coat: 'jacket', coatColor: '#7a3a22', pants: '#3a3a44', scarf: '#c8902a', goggles: true },
    ma:        { body: 'old', skin: '#d8a880', hair: '#c8c8c8', hairStyle: 'bun', hat: 'none', coat: 'apron', coatColor: '#5a3a22', pants: '#2a2a30', goggles: true, accent: '#c8902a' },
    vex:       { body: 'kid', skin: '#f0c8a0', hair: '#c83a1a', hairStyle: 'slick', hat: 'none', coat: 'longcoat', coatColor: '#a8201a', pants: '#1a1a22', goggles: true, accent: '#e8c050' },
    keeper:    { body: 'adult', skin: '#c89070', hair: '#5a2a1a', hairStyle: 'bun', hat: 'cap', coat: 'apron', coatColor: '#e8e0d0', pants: '#5a3a3a', accent: '#c83a2a' },
    clerk:     { body: 'adult', skin: '#e8c0a0', hair: '#2a2a2a', hairStyle: 'short', hat: 'bowler', coat: 'vest', coatColor: '#2a4a8a', pants: '#2a2a30' },
    guide:     { body: 'adult', skin: '#b88060', hair: '#1a1a1a', hairStyle: 'short', hat: 'cap', coat: 'vest', coatColor: '#c8902a', pants: '#3a2a22' },
    capsule:   { body: 'capsule' },
    kid:       { body: 'kid', hat: 'cap', coat: 'jacket' },
    elder:     { body: 'old', hat: 'none', coat: 'longcoat', beard: true },
    engineer:  { body: 'adult', hat: 'none', coat: 'overalls', goggles: true },
    boilermaker: { body: 'big', hat: 'cap', coat: 'overalls', beard: true },
    prospector:{ body: 'adult', hat: 'wide', coat: 'vest', beard: true },
    dockhand:  { body: 'big', hat: 'bandana', coat: 'vest' },
    chemist:   { body: 'adult', hat: 'mask', coat: 'labcoat' },
    frostrunner: { body: 'adult', hat: 'hood', coat: 'parka' },
    aeronaut:  { body: 'adult', hat: 'aviator', coat: 'jacket', goggles: true },
    captain:   { body: 'adult', hat: 'captain', coat: 'longcoat' },
    // Syndicate
    slag:      { body: 'big', skin: '#c89070', hair: '#1a1a1a', hat: 'mask', coat: 'longcoat', coatColor: '#6a2a1a', pants: '#2a1a14', accent: '#c8582a' },
    verdigris: { body: 'tall', skin: '#d8c0a8', hair: '#3a8a6a', hairStyle: 'long', hat: 'top', coat: 'longcoat', coatColor: '#2a5a4a', pants: '#1a2a22', accent: '#6ac8a0' },
    oxide:     { body: 'tall', skin: '#b89070', hair: '#2a1a14', hat: 'top', coat: 'longcoat', coatColor: '#8a3a1a', pants: '#2a1410', accent: '#ff7a2a', mask: true },
    grunt:     { body: 'adult', hat: 'mask', coat: 'longcoat', coatColor: '#6a2a1a', pants: '#2a1a14', accent: '#c8582a' },
    // Forgemasters
    cassia:    { body: 'tall', skin: '#e8c0a0', hair: '#c8902a', hairStyle: 'bun', hat: 'top', coat: 'longcoat', coatColor: '#8a6a2a', pants: '#3a2a1a', goggles: true, accent: '#e8c050' },
    sal:       { body: 'big', skin: '#a87050', hair: '#2a2a2a', hat: 'cap', coat: 'overalls', coatColor: '#4a4a52', pants: '#2a2a30', beard: true, accent: '#d8d0c8' },
    volta:     { body: 'adult', skin: '#f0d0b0', hair: '#4ac8ff', hairStyle: 'spiky', hat: 'witch', coat: 'longcoat', coatColor: '#2a2a6a', pants: '#1a1a3a', accent: '#ffd82a' },
    bramwell:  { body: 'big', skin: '#c89070', hair: '#8a8a8a', hat: 'wide', coat: 'vest', coatColor: '#8a5a2a', pants: '#4a3a2a', beard: true, accent: '#c8984a' },
    ondine:    { body: 'adult', skin: '#8a5a3a', hair: '#1a1a2a', hairStyle: 'long', hat: 'captain', coat: 'longcoat', coatColor: '#1a3a6a', pants: '#1a1a2a', accent: '#e8c050' },
    mire:      { body: 'tall', skin: '#d8c8b8', hair: '#1a1a1a', hat: 'plague', coat: 'longcoat', coatColor: '#1a2a1a', pants: '#1a1a1a', accent: '#8ad83a' },
    ivarra:    { body: 'old', skin: '#f0e0d8', hair: '#ffffff', hairStyle: 'long', hat: 'hood', coat: 'parka', coatColor: '#c8e8ff', pants: '#5a6a8a', accent: '#8ae0ff' },
    vane:      { body: 'tall', skin: '#c8a080', hair: '#c8c8c8', hairStyle: 'short', hat: 'aviator', coat: 'longcoat', coatColor: '#e8e0d0', pants: '#2a3a5a', goggles: true, accent: '#e8c050' },
    // Furnace Four
    rook:      { body: 'big', skin: '#b08060', hair: '#3a3a3a', hat: 'helm', coat: 'armor', coatColor: '#8a929e', pants: '#3a3e46', accent: '#d0d8e4' },
    seraphine: { body: 'tall', skin: '#f0d0c0', hair: '#e86ad8', hairStyle: 'long', hat: 'none', coat: 'dress', coatColor: '#5a2a6a', pants: '#2a1a3a', accent: '#ffaaf0', goggles: true },
    morrow:    { body: 'tall', skin: '#c8c0b8', hair: '#1a1a1a', hat: 'top', coat: 'longcoat', coatColor: '#2a1a14', pants: '#1a1410', accent: '#a8582a' },
    ashka:     { body: 'adult', skin: '#6a4a3a', hair: '#e8e8ff', hairStyle: 'long', hat: 'hood', coat: 'robe', coatColor: '#2a1a5a', pants: '#1a1030', accent: '#c08aff' },
};
/** Default looks per class for unnamed trainers. */
export const CLASS_LOOK = {
    scrapper: 'kid', tinker: 'engineer', gearhead: 'engineer', prospector: 'prospector', clocksmith: 'clerk', boilermaker: 'boilermaker',
    sparkwitch: 'volta', junkdiver: 'dockhand', brawler: 'boilermaker', dockhand: 'dockhand', chemist: 'chemist', frostrunner: 'frostrunner',
    aeronaut: 'aeronaut', stationhand: 'engineer', veteran: 'captain', grunt: 'grunt', sergeant: 'slag', exec: 'verdigris', baron: 'oxide',
};

// ------------------------------------------------------------------ the eight Forgemasters, the Furnace Four, the champion
export const SEAL_NAMES = ['Gear Seal', 'Boil Seal', 'Spark Seal', 'Grit Seal', 'Tide Seal', 'Fume Seal', 'Rime Seal', 'Gale Seal'];
export const SEAL_TYPES = ['gear', 'steam', 'volt', 'grit', 'hydro', 'toxic', 'frost', 'aero'];

export const LEADERS = {
    1: { name: 'Cassia Gearwright', type: 'gear', team: [['Cogling', 12], ['Tickit', 12], ['Sprocketeer', 14]], items: { 'patch-kit': 2 }, card: 'gear-grind', cogs: 1400,
        say: 'Welcome to the Gasket Gulch Foundry! I\'m Cassia Gearwright. Every gear I own was cut by hand, to the thousandth of an inch. Let\'s see if your bots run as true!',
        lose: 'Beautiful. Not a tooth out of place. That\'s the Gear Seal — the first of eight.',
        after: ['Take this program card too: Gear Grind. Run it in any bot whose parts can turn it.', 'The Marshal will let you onto the Cogdune Wastes now. Mind the Halcyon wreck out there… I\'ve heard engines running inside it.'] },
    2: { name: 'Smokestack Sal', type: 'steam', team: [['Kettlet', 18], ['Pistup', 18], ['Teakettler', 20]], items: { 'rivet-kit': 1 }, card: 'scald-jet', cogs: 2000,
        say: 'HAH! A kid from Cinderwick! I worked those boilers when your Ma was still welding in short trousers! Show me some pressure!',
        lose: 'WHOO! That\'s a blowout! Fair and square — the Boil Seal is yours.',
        after: ['And a card: Scald Jet. Burns going in, burns coming out.', 'Two seals means the Sparkmarsh is open. Take a Grit bot if you have one. Trust old Sal.'] },
    3: { name: 'Volta Ferris', type: 'volt', team: [['Sparkat', 24], ['Lumibulb', 24], ['Fuzebox', 24], ['Teslarch', 26]], items: { 'rivet-kit': 2 }, card: 'tesla-bolt', cogs: 2600,
        say: 'The tower above us has stood for three hundred years, and for three hundred years a Ferris has kept it lit. I\'ve never let it flicker. Let\'s see if you can make it.',
        lose: '…It flickered. You made it flicker! The Spark Seal is yours, and you\'ve earned it.',
        after: ['Here, Tesla Bolt — my favourite card.', 'West through Tumbledown Canyon is Grindstone. Bramwell has dug through every rock on Midden. Dig deep.'] },
    4: { name: 'Bramwell Thorne', type: 'grit', team: [['Gravelgut', 28], ['Sandhopper', 28], ['Backhoe', 29], ['Drillhorn', 31]], items: { 'rivet-kit': 2 }, card: 'seismic-stomp', cogs: 3100, give: 'lift-coil',
        say: 'Forty years I\'ve been digging. Found engines, found ships, found a whole city once. Never found anyone who could out-dig me. You going to be the first?',
        lose: 'Well, I\'ll be buried. The Grit Seal\'s yours, youngster.',
        after: ['Take my old Lift Coil, too. Some fool dropped an engine block across the Sludgeway road and nobody else can move it.', 'And this card: Seismic Stomp. Shake the ground right out from under \'em.'] },
    5: { name: 'Captain Ondine Brack', type: 'hydro', team: [['Clampress', 33], ['Periscorp', 33], ['Siphoon', 34], ['Sternwheel', 36]], items: { 'overhaul-kit': 1 }, card: 'maelstrom', cogs: 3600,
        say: 'I\'ve sailed every sludge sea on this planet, and sunk better bots than yours. Ready about!',
        lose: 'Struck my colours, and proud to. The Tide Seal, Captain to captain.',
        after: ['Maelstrom — the sea\'s favourite card.', 'Skiffwright Nell on the docks can fit you with a Hover Skiff now. Something stinks over at the old Mirefen Refinery, and I want it found.'] },
    6: { name: 'Dr. Lysander Mire', type: 'toxic', team: [['Smogwing', 38], ['Leadacid', 38], ['Acidrake', 39], ['Gunkgut', 41]], items: { 'overhaul-kit': 2 }, card: 'toxic-spray', cogs: 4100,
        say: 'You shut down that refinery. Good. That was never medicine. Mine is. Breathe deep — this may sting.',
        lose: 'A clean bill of health. The Fume Seal is yours, my young colleague.',
        after: ['Toxic Spray. Use it responsibly. Or don\'t. I\'m a doctor, not your mother.', 'North is the Frostline, then Rimehaven. Dress warmly.'] },
    7: { name: 'Ivarra Frostwhistle', type: 'frost', team: [['Freezerk', 43], ['Rimewraith', 43], ['Snowdozer', 44], ['Blizzarrow', 44], ['Rimefang', 46]], items: { 'overhaul-kit': 2 }, card: 'cryo-beam', cogs: 4600,
        say: 'I froze the Frostline passes when I was your age, child. Ninety winters later, I\'m still here. Stillness. Is. Strength.',
        lose: 'Hm. You thawed an old woman\'s heart. Take the Rime Seal.',
        after: ['Cryo Beam, for your collection.', 'My sister — the Elder, at the lodge — keeps an Arc Lantern. The Heliograph is pitch black. Go and see her.'] },
    8: { name: 'Admiral Hexa Vane', type: 'aero', team: [['Galeforce', 47], ['Zeppelord', 47], ['Kitewyrm', 47], ['Skyreaper', 48], ['Gildhawk', 50]], items: { 'full-rebuild': 1, 'overhaul-kit': 1 }, card: 'wing-slice', cogs: 5000,
        say: 'Eight seals is where most trainers stop. Not because they lose to me — because they look down. Don\'t look down, cadet.',
        lose: 'Outflown! The Gale Seal, with the Admiralty\'s compliments.',
        after: ['But hear this. My scouts report the Rust Syndicate has seized the Leviathan — the dreadnought that crashed east of here. Baron Oxide means to fire its engine.', 'If that engine lights, every COM-bot on Midden melts. The Championship can wait. I\'ve opened the east gate. Go.'] },
    9: { name: 'Rook Ironside', type: 'iron', team: [['Clampress', 51], ['Foundryx', 52], ['Vaultguard', 52], ['Anvilox', 52], ['Juggernaught', 54]], items: { 'full-rebuild': 2 }, cogs: 8000,
        say: 'I am the first wall of the Furnace Four. Walls do not move. Walls do not break. Show me otherwise.',
        lose: 'The wall… has a door in it after all. Go on through.' },
    10: { name: 'Seraphine Static', type: 'signal', team: [['Telescreen', 53], ['Arraydish', 53], ['Gramophant', 53], ['Broadcastor', 54], ['Chronograf', 55]], items: { 'full-rebuild': 2 }, cogs: 8200,
        say: 'Darling, the whole planet listens to my broadcasts. Tonight they\'ll hear you lose. Live!',
        lose: 'And… cut! What a finale. Go — the audience is waiting.' },
    11: { name: 'Morrow Hollowell', type: 'rust', team: [['Scarecrank', 54], ['Derelictus', 54], ['Chandelor', 54], ['Husklord', 54], ['Ruinmaw', 56]], items: { 'full-rebuild': 2 }, cogs: 8400,
        say: 'I am the undertaker of Midden. Every machine ends with me, sooner or later. Let me measure your bots for their final rest.',
        lose: 'Not yet, it seems. Not yet. Pass, little wright.' },
    12: { name: 'Ashka Nyx', type: 'void', team: [['Prismatar', 55], ['Mothership', 55], ['Probehedron', 56], ['Pulsarch', 56], ['Singulatron', 58]], items: { 'full-rebuild': 2 }, cogs: 8600,
        say: 'I chart the dark between the stars. Everything that falls on Midden came from there — and so did my bots. Come. Fall.',
        lose: 'The stars were right about you. The Champion is waiting beyond that door.' },
};

// The rival's starter is the one strong against yours.
export const RIVAL_STARTER = { Embrit: 'Bubblet', Bubblet: 'Mossbit', Mossbit: 'Embrit' };
const LINE = { Embrit: ['Embrit', 'Furnacle', 'Infernaut'], Bubblet: ['Bubblet', 'Pumpkett', 'Torrentank'], Mossbit: ['Mossbit', 'Thicketron', 'Verdigrand'] };
export function rivalTeam(stage, starter) {
    const r = LINE[RIVAL_STARTER[starter] || 'Bubblet'];
    switch (stage) {
        case 1: return [[r[0], 5]];
        case 2: return [['Brasswing', 17], ['Boltrat', 16], [r[1], 19]];
        case 3: return [['Brasswing', 34], ['Teslarch', 33], ['Backhoe', 34], [r[1], 37]];
        default: return [['Gildhawk', 57], ['Teslatron', 57], ['Excavaurus', 57], ['Cryodon', 58], ['Chronograf', 57], [r[2], 62]];
    }
}

// ------------------------------------------------------------------ scripts
export const SCRIPTS = {
    intro: [
        ['say', null, 'Midden. The planet where the galaxy throws away what it has finished with.'],
        ['say', null, 'Ten thousand dead starships circle overhead in a ring of junk, and every so often, one of them falls.'],
        ['say', null, 'Down here, scrap kids dig through the wreckage for parts, and wrights build those parts into COM-bots — Companion Mechanoids — that live, and grow, and fight.'],
        ['say', null, 'Once a year, the Champion of the Grand Gearworks Circuit wins a ticket on the Aurelia: the only ship that ever leaves Midden.'],
        ['say', null, 'You have wanted that ticket your whole life.'],
        ['say', null, 'Outside, the clang of Ma Bellows\' hammer stops. That means she\'s finished something. Better go and see!'],
        ['story', 0],
    ],
    ma: [
        ['if', 'story>=25', [
            ['if', 'flag:omnicogGiven', [['say', 'Ma Bellows', 'Champion of Midden. Wright of Cinderwick. Off you go into the stars, and don\'t forget to write.'], ['heal']], [
                ['say', 'Ma Bellows', 'You came back! Before you go — there\'s something I\'ve been keeping under that tarp for fifty years.'],
                ['say', 'Ma Bellows', 'It was the first COM-bot ever built on Midden. My grandmother found it. It\'s been asleep all this time. I think it was waiting for you.'],
                ['giveBot', 'Omnicog', 60], ['flag', 'omnicogGiven', true],
            ]],
        ], [
            ['if', 'flag:starter', [
                ['say', 'Ma Bellows', 'Let me give your bots a once-over… there. Good as new.'], ['heal'],
                ['if', 'seals>=4', [['say', 'Ma Bellows', 'Four seals! You\'re halfway there. Your gran would have been proud.']],
                    [['say', 'Ma Bellows', 'Remember: the workbench turns scrap into spikes and repair kits. Dig through every heap you see.']]],
            ], [
                ['say', 'Ma Bellows', 'There you are! Look at this — three COM-bots, rebuilt from three wrecks I dragged out of the Rustfield. Took me all night.'],
                ['say', 'Ma Bellows', 'You\'ve been on at me about the Circuit since you were knee-high. Well, nobody enters the Circuit without a bot.'],
                ['say', 'Ma Bellows', 'Embrit is a little furnace bot. Bubblet is a diving bell. Mossbit let the moss grow over it. Pick one. Take your time.'],
                ['flag', 'maTalked', true], ['story', 1],
            ]],
        ]],
    ],
    capsule: [], // built per capsule in game.js
    pell: [
        ['if', 'flag:slagBeaten', [
            ['if', 'item:cutter-torch', [['say', 'Engineer Pell', 'Thanks again. I\'m going to stay and patch the old girl up. Maybe she\'ll fly again someday.']], [
                ['say', 'Engineer Pell', 'You ran them off! I\'m Pell — I was the Halcyon\'s engineer, a long time ago. I came back for her, and the Syndicate came back for me.'],
                ['say', 'Engineer Pell', 'They\'re stripping wrecks all over Midden. Melting bots for metal. Their boss, Baron Oxide, is after something big.'],
                ['say', 'Engineer Pell', 'Here. My Cutter Torch. There\'s a chained fence east of the wreck on the road to Boilerburg — walk into it and the torch will cut it.'],
                ['give', 'cutter-torch', 1], ['story', 6],
            ]],
        ], [['say', 'Engineer Pell', 'Psst! They\'ve locked me up in here! That big brute — Sergeant Slag — has the key. Please, help!']]],
    ],
    datalink: [
        ['if', 'flag:dataLinkGiven', [['say', 'Grandpa Ruddle', 'The Data Link shares experience with your whole team. Even the ones on the bench learn by watching.']], [
            ['if', 'seals>=1', [
                ['say', 'Grandpa Ruddle', 'You beat Cassia? Ha! I taught her everything she knows. Well, most things. Some things.'],
                ['say', 'Grandpa Ruddle', 'Here — my old Data Link. It shares battle experience with every bot on your team.'],
                ['give', 'data-link', 1], ['flag', 'dataLinkGiven', true],
            ], [['say', 'Grandpa Ruddle', 'I was a Forgemaster once, you know. Come back when you have a Cog Seal and maybe I\'ll have something for you.']]],
        ]],
    ],
    skiff: [
        ['if', 'item:hover-skiff', [['say', 'Skiffwright Nell', 'Walk out onto the sludge and the skiff does the rest. Don\'t lean over the side.']], [
            ['if', 'seals>=5', [
                ['say', 'Skiffwright Nell', 'The Captain sent word. One Hover Skiff, fitted and fuelled. It folds up into your pack, look.'],
                ['give', 'hover-skiff', 1], ['story', 14],
                ['say', 'Skiffwright Nell', 'The old Mirefen Refinery is out in the middle of the Sludgeway, north of here. Just walk onto the sludge.'],
            ], [['say', 'Skiffwright Nell', 'I build hover skiffs. But the Captain says nobody gets one until they\'ve beaten her. Harbour rules.']]],
        ]],
    ],
    lantern: [
        ['if', 'item:arc-lantern', [['say', 'Elder Frostwhistle', 'The lantern will show you the way. It always has.']], [
            ['if', 'seals>=7', [
                ['say', 'Elder Frostwhistle', 'My sister sent you? Then you must be something. Here: the Arc Lantern. It lit my way out of the Heliograph when it fell, sixty years ago.'],
                ['give', 'arc-lantern', 1], ['story', 20],
            ], [['say', 'Elder Frostwhistle', 'Ivarra is my little sister. She\'s only eighty-nine. Win her seal and I\'ll have something for you.']]],
        ]],
    ],
    rival1Intro: [
        ['say', 'Vex', 'Ha! So Ma Bellows finally built you a bot! I\'m Vex Coppervane, and I\'m going to win the Aurelia ticket. My dad bought me a factory-fresh COM-bot from the Spire.'],
        ['say', 'Vex', 'Well, "bought". The Spire was having a sale. Anyway — let\'s see what a junk bot can do!'],
    ],
    rival1Win: [
        ['say', 'Vex', 'Lucky. LUCKY! I\'ll see you on the Circuit, scrap kid. And next time I\'ll win!'],
        ['say', 'Ma Bellows', 'Well, that settles who built the better bot. Now then — take these.'],
        ['give', 'registry', 1], ['give', 'reboot-spike', 5], ['give', 'patch-kit', 3], ['give', 'steam-boots', 1],
        ['say', 'Ma Bellows', 'That\'s my old Registry. It records every COM-bot you see, and every one you own. Fill it up for me.'],
        ['say', 'Ma Bellows', 'Reboot Spikes let you take over a feral bot — weaken it first. And those are Steam Boots: hold B or Shift to run.'],
        ['say', 'Ma Bellows', 'The first Foundry is in Gasket Gulch, north across the Rustfield Flats. Go on. Go and win that ticket.'],
        ['story', 2],
    ],
    rival2: [
        ['say', 'Vex', 'Hey! Scrap kid! I\'ve got two Cog Seals and a bag full of Brass Spikes. How about you?'],
        ['battle', 'rival2'],
        ['say', 'Vex', 'Argh! You got lucky again! …Hey, did you see those Syndicate goons at the Halcyon? They tried to buy my Bubblet. For SCRAP. Who does that?'],
        ['flag', 'rival2', true],
    ],
    rival3: [
        ['say', 'Vex', 'You\'re still going? Fine! My dad says I\'m a shoo-in for the Championship. Let\'s find out who\'s really the best on Midden!'],
        ['battle', 'rival3'],
        ['say', 'Vex', '…You\'re good. Really good. I\'m going to train until my bots can\'t see straight. See you at the top.'],
        ['flag', 'rival3', true],
    ],
    oxideBeaten: [
        ['say', 'Baron Oxide', 'Then let the engine choose who it obeys!'],
        ['fx', 'quake'],
        ['say', null, 'The Baron flees down an escape chute as the engine core flares. Light pours out of it… and then it settles, waiting.'],
        ['say', null, 'The Leviathan Engine didn\'t fire. Something inside it woke up instead.'],
        ['story', 23],
        ['say', null, 'With the Syndicate scattered, Victory Causeway is open. The Brass Crown Arena is waiting.'],
    ],
    slagBeaten: [['say', null, 'Sgt. Slag stomps off into the dark. Behind you, someone is banging on a cage.']],
    verdigrisBeaten: [['say', null, 'Madame Verdigris sweeps away through the north bulkhead. The refinery\'s pumps sputter and die.'], ['story', 16]],
    championIntro: [
        ['say', 'Vex', 'Took you long enough. I beat the old Champion this morning. So that makes ME the Champion.'],
        ['say', 'Vex', 'You know, when I started, I thought this was all about the ticket. About getting off this junk heap.'],
        ['say', 'Vex', 'But every bot on my team, I fixed up myself. Every one. Dad\'s factory bot? I traded it for parts on day two.'],
        ['say', 'Vex', 'So this isn\'t about the ticket any more. It\'s about who\'s the best wright on Midden. Let\'s go!'],
    ],
    ending: [
        ['say', 'Vex', '…Yeah. Yeah, okay. You\'re the best. I\'m not even mad. Well. I\'m a little mad.'],
        ['say', 'Arena Herald', 'LADIES, GENTLEMEN AND BOTS OF MIDDEN! YOUR NEW CHAMPION OF THE GRAND GEARWORKS CIRCUIT!'],
        ['give', 'starward-ticket', 1],
        ['say', null, 'The Starward Ticket. A brass card with a starship etched into it. It is warm in your hand.'],
        ['ending'],
        ['story', 25],
    ],
};

// ------------------------------------------------------------------ objectives (shown on the HUD; followed by the test pilot)
// goal(state) -> { map, ent? } : where to go next.
export const OBJECTIVES = [
    { s: 0, text: 'Go to Ma Bellows\' workshop, across the square.', goal: () => ({ map: 'workshop', ent: 'm' }) },
    { s: 1, text: 'Choose a COM-bot from Ma\'s workbenches.', goal: () => ({ map: 'workshop', ent: 'q' }) },
    { s: 2, text: 'Head north across the Rustfield Flats to Gasket Gulch.', goal: () => ({ map: 'gasket' }) },
    { s: 3, text: 'Win the Gear Seal from Forgemaster Cassia at the Gasket Gulch Foundry.', goal: () => ({ map: 'gasket-foundry', ent: 'l' }) },
    { s: 4, text: 'Cross the Cogdune Wastes. Something is stirring inside the wreck of the Halcyon.', goal: () => ({ map: 'halcyon' }) },
    { s: 5, text: 'Drive the Rust Syndicate out of the Halcyon.', goal: (st) => (st.flags.slagBeaten ? { map: 'halcyon', ent: 'p' } : { map: 'halcyon', ent: 's' }) },
    { s: 6, text: 'Cut through the fence east of the Halcyon and reach Boilerburg.', goal: () => ({ map: 'boilerburg' }) },
    { s: 7, text: 'Win the Boil Seal from Smokestack Sal.', goal: () => ({ map: 'boilerburg-foundry', ent: 'l' }) },
    { s: 8, text: 'Head north through the Sparkmarsh to Voltspire.', goal: () => ({ map: 'voltspire' }) },
    { s: 9, text: 'Win the Spark Seal from Volta Ferris.', goal: () => ({ map: 'voltspire-foundry', ent: 'l' }) },
    { s: 10, text: 'Take Tumbledown Canyon west to Grindstone.', goal: () => ({ map: 'grindstone' }) },
    { s: 11, text: 'Win the Grit Seal from Bramwell Thorne.', goal: () => ({ map: 'grindstone-foundry', ent: 'l' }) },
    { s: 12, text: 'Lift the engine block off the Sludgeway road and head south to Port Brackwater.', goal: () => ({ map: 'port' }) },
    { s: 13, text: 'Win the Tide Seal from Captain Ondine Brack.', goal: () => ({ map: 'port-foundry', ent: 'l' }) },
    { s: 14, text: 'Skiff across the Sludgeway to the Mirefen Refinery.', goal: (st) => (st.bag['hover-skiff'] ? { map: 'refinery' } : { map: 'port', ent: 'd' }) },
    { s: 15, text: 'Find out who is running the Mirefen Refinery.', goal: () => ({ map: 'refinery', ent: 'v' }) },
    { s: 16, text: 'Go through the refinery to Fumehollow.', goal: () => ({ map: 'fumehollow' }) },
    { s: 17, text: 'Win the Fume Seal from Dr. Lysander Mire.', goal: () => ({ map: 'fumehollow-foundry', ent: 'l' }) },
    { s: 18, text: 'Cross the Frostline Shelf to Rimehaven.', goal: () => ({ map: 'rimehaven' }) },
    { s: 19, text: 'Win the Rime Seal from Ivarra Frostwhistle.', goal: () => ({ map: 'rimehaven-foundry', ent: 'l' }) },
    { s: 20, text: 'Get the Arc Lantern from the Elder, then cross Skyrail Heights and the dark Heliograph Station to Aetherton.', goal: (st) => (st.bag['arc-lantern'] ? { map: 'aetherton' } : { map: 'rimehaven-house', ent: 'a' }) },
    { s: 21, text: 'Win the Gale Seal from Admiral Hexa Vane.', goal: () => ({ map: 'aetherton-foundry', ent: 'l' }) },
    { s: 22, text: 'Stop Baron Oxide aboard the Leviathan, east of Aetherton.', goal: () => ({ map: 'leviathan', ent: 'o' }) },
    { s: 23, text: 'Walk Victory Causeway to the Brass Crown Arena.', goal: () => ({ map: 'arena' }) },
    { s: 24, text: 'Defeat the Furnace Four and the Champion.', goal: (st) => (
        !st.flags['beat:rook'] ? { map: 'four1', ent: 'e' } : !st.flags['beat:seraphine'] ? { map: 'four2', ent: 'e' }
            : !st.flags['beat:morrow'] ? { map: 'four3', ent: 'e' } : !st.flags['beat:ashka'] ? { map: 'four4', ent: 'e' } : { map: 'crown', ent: 'c' }) },
    { s: 25, text: 'You are the Champion! Fill the Registry, wake the titans, and visit Ma Bellows.', goal: () => null },
];

/** Entering a map can move the story on: [from, to]. */
export const ENTER_STORY = {
    gasket: [2, 3], halcyon: [4, 5], boilerburg: [6, 7], voltspire: [8, 9], grindstone: [10, 11], port: [12, 13],
    refinery: [14, 15], fumehollow: [16, 17], rimehaven: [18, 19], aetherton: [20, 21], arena: [23, 24],
};

/** Beating a leader moves the story on from → to. */
export const LEADER_STORY = { 1: [3, 4], 2: [7, 8], 3: [9, 10], 4: [11, 12], 5: [13, 14], 6: [17, 18], 7: [19, 20], 8: [21, 22] };

export const TIPS = [
    'Wild COM-bots live in the scrap drifts — the patches of bent wire and junk.',
    'Weaken a wild bot before you spike it. Powered-down and seized bots are easiest to reboot.',
    'Sparkling heaps hide materials. Press A next to one to dig.',
    'Dormant wrecks can be repaired at the spot if you carry the right materials. Better calibration means better stats.',
    'Evolving installs new parts: new stats, new traits and new techniques.',
    'Some COM-bots only evolve when you install an upgrade kit. Craft kits at any workbench.',
    'Some COM-bots evolve when they trust you enough. Keep them in your team and win together.',
    'Program cards teach techniques. A bot can run a card if it matches its types or its parts.',
    'Defeated wild bots sometimes leave parts behind: materials for the workbench.',
    'Hold B (or Shift) to run in your Steam Boots.',
];
