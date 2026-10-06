// Every place on Midden. Maps are ASCII grids; js/view/overworld.js builds the 3D scene from the
// same grid the simulation walks on.
//
//   .  ground          ,  road            "  scrap drift (wild COM-bots)   _  metal deck
//   #  junk pile       T  pylon / mast     ~  sludge (needs the Hover Skiff; wild bots too)
//   ^  ledge (hop down, south only)        B  building                       =  wall / railing
//   X  chained fence (Cutter Torch)        O  engine block (Lift Coil)       %  counter
//   K  machinery / furniture               +  lamp post                      *  moss patch (walkable)
//   0–9 warps: digit d leads to w[d] = [map, digit] (doors, edges, hatches)
//   a–z entities, defined in ents (the tile underneath is the map's floor)
//
// Entity kinds: npc · trainer · item · heap (scavenge materials) · wreck (repairable dormant bot)
// · sign · healer · locker · bench · clerk · marshal (blocks a path until a condition) · titan.
// `when` / `unless` take a condition string (see game.js cond()): 'flag:x', 'seals>=3', 'story>=5', 'item:id'.

export const MAPS = {};
function map(id, def) {
    def.id = id;
    def.rows = def.rows.map((r) => r.replace(/\s+$/, ''));
    def.H = def.rows.length;
    def.W = def.rows[0].length;
    def.ents = def.ents || {};
    def.w = def.w || {};
    def.floor = def.floor || (def.kind === 'interior' || def.kind === 'dungeon' ? '_' : '.');
    MAPS[id] = def;
    return def;
}

// ===================================================================== interiors (templates)
function station(id, town, back) {
    return map(id, {
        name: `${town} Boiler Station`, kind: 'interior', style: 'station', music: 'station', heal: true,
        rows: [
            '=============',
            '=KK_%%h%%_KK=',
            '=___________=',
            '=l_________k=',
            '=___________=',
            '=_K_______K_=',
            '=__a________=',
            '======0======',
        ],
        w: { 0: back },
        ents: {
            h: { k: 'healer', look: 'keeper', name: 'Boilerkeeper' },
            l: { k: 'locker' },
            k: { k: 'bench' },
            a: { k: 'npc', look: 'rand', face: 'up', wander: 2, say: STATION_CHATTER[id] || ['The boilers in here never go out. They say the first Boiler Station was built around a sleeping titan.'] },
        },
    });
}
const STATION_CHATTER = {};

function shop(id, town, back, cards = null) {
    return map(id, {
        name: `${town} Parts Exchange`, kind: 'interior', style: 'shop', music: 'shop',
        rows: [
            '===========',
            '=KK_%s%_KK=',
            '=_________=',
            '=K_______K=',
            '=_____c___=',
            '=__K___K__=',
            '=====0=====',
        ],
        w: { 0: back },
        ents: {
            s: { k: 'clerk', look: 'clerk', name: 'Exchange Clerk', cards },
            c: { k: 'npc', look: 'rand', face: 'left', wander: 2, say: ['Brass Spikes catch better than Reboot Spikes. Tesla Spikes, better still. You get what you pay for.'] },
        },
    });
}

function house(id, name, back, ents, rows) {
    return map(id, {
        name, kind: 'interior', style: 'house', music: 'house',
        rows: rows || [
            '=========',
            '=KK___KK=',
            '=_______=',
            '=_K_a___=',
            '=_____b_=',
            '=_______=',
            '====0====',
        ],
        w: { 0: back }, ents,
    });
}

function foundry(id, town, back, leader, apprentices, guide, style) {
    return map(id, {
        name: `${town} Foundry`, kind: 'interior', style: `foundry-${style}`, music: 'foundry', dark: false,
        rows: [
            '=================',
            '=K=====_l_=====K=',
            '=_______________=',
            '=_KK_________KK_=',
            '=_______________=',
            '=___a_______b___=',
            '=_______________=',
            '=_KK_________KK_=',
            '=_______________=',
            '=_______c_______=',
            '=_______________=',
            '========0========',
        ],
        w: { 0: back },
        ents: { l: leader, a: apprentices[0], b: apprentices[1], c: guide },
    });
}

// ===================================================================== CINDERWICK — home
map('cinderwick', {
    name: 'Cinderwick', kind: 'town', biome: 'scrapyard', music: 'home', sub: 'A shanty of boiler-shacks on the edge of the junk sea',
    rows: [
        '###########11############',
        '#T"".....+.,,.+....."""T#',
        '#""".......,,.......""""#',
        '#...BBBBB..,,..BBBBBBB..#',
        '#...BBBBB..,,..BBBBBBB..#',
        '#...BB2BB..,,..BBB3BBB..#',
        '#.....,,,,,,,,,,,,,.....#',
        '#+....,....a.......,...+#',
        '#.....,............,....#',
        '#..BBBB,...b...*****....#',
        '#..BBBB,.......**c**....#',
        '#..BB4B,,,,,,,,*****....#',
        '#T.....d..........e....T#',
        '#""...##....TT....##..""#',
        '#"""..###..####..###..""#',
        '#########################',
    ],
    w: { 1: ['route1', 1], 2: ['home', 0], 3: ['workshop', 0], 4: ['tobble', 0] },
    bld: ['shack', 'workshop', 'house'],
    ents: {
        a: { k: 'sign', text: 'CINDERWICK — "We fix what the sky throws away."' },
        b: { k: 'npc', look: 'kid', name: 'Tansy', wander: 3, say: ['Ma Bellows has been banging in her workshop all night! She says she\'s building something for YOU.', 'I want a COM-bot when I\'m older. A big one. With saws.'] },
        c: { k: 'npc', look: 'elder', name: 'Old Hob', face: 'down', say: ['See that ring of junk across the sky? That\'s where all this comes from. Every ship that dies up there ends up down here.', 'Nobody leaves Midden. Except the Circuit Champion. One ticket, once a year, on the Aurelia.'] },
        d: { k: 'item', item: 'patch-kit', n: 2 },
        e: { k: 'heap', loot: [['scrap-metal', 3], ['copper-wire', 1]] },
    },
    deco: [{ k: 'crane', x: 2, y: 13 }, { k: 'boiler', x: 20, y: 13 }],
});
map('home', {
    name: 'Your Shack', kind: 'interior', style: 'shack', music: 'home',
    rows: [
        '=========',
        '=K_K___K=',
        '=_______=',
        '=K____a_=',
        '=_______=',
        '====0====',
    ],
    w: { 0: ['cinderwick', 2] },
    ents: { a: { k: 'sign', text: 'A hand-drawn map of Midden, covered in circles. In the corner, in your handwriting: "THE AURELIA. ONE DAY."' } },
});
map('workshop', {
    name: 'Ma Bellows\' Workshop', kind: 'interior', style: 'workshop', music: 'home', heal: true,
    rows: [
        '===============',
        '=KK_K_____K_KK=',
        '=_____________=',
        '=__p___q___r__=',
        '=_____________=',
        '=K_____m_____k=',
        '=_____________=',
        '=_l_______v_K_=',
        '=_____________=',
        '=======0=======',
    ],
    w: { 0: ['cinderwick', 3] },
    ents: {
        m: { k: 'npc', id: 'ma', look: 'ma', name: 'Ma Bellows', face: 'down', script: 'ma' },
        p: { k: 'npc', look: 'capsule', name: 'Workbench', capsule: 'Embrit', unless: 'flag:starter', script: 'capsule' },
        q: { k: 'npc', look: 'capsule', name: 'Workbench', capsule: 'Bubblet', unless: 'flag:starter', script: 'capsule' },
        r: { k: 'npc', look: 'capsule', name: 'Workbench', capsule: 'Mossbit', unless: 'flag:starter', script: 'capsule' },
        v: { k: 'npc', id: 'vex', look: 'vex', name: 'Vex', face: 'left', when: 'flag:vexHere' },
        l: { k: 'locker' },
        k: { k: 'bench' },
    },
});
house('tobble', 'Old Tobble\'s House', ['cinderwick', 4], {
    a: { k: 'npc', look: 'elder', name: 'Old Tobble', face: 'down', say: ['When I was your age, I rebuilt a Tinwing from three ration cans and a bedspring. Flew like a dream. Crashed like a dream, too.', 'Scrap heaps that sparkle have good parts in them. Press A on them and dig.'] },
    b: { k: 'item', item: 'reboot-spike', n: 2 },
});

// ===================================================================== ROUTE 1 — Rustfield Flats
map('route1', {
    name: 'Rustfield Flats', kind: 'route', biome: 'scrapyard', music: 'route', lv: [2, 5],
    enc: [['Bolty', 30], ['Tinwing', 25], ['Cogling', 18], ['Canbot', 12], ['Junkpup', 10], ['Sparkit', 4], ['Seedling', 3]],
    rows: [
        '##########22##########',
        '#T"""....,,,....""""T#',
        '#""""....,,.....""""##',
        '#""""..a.,,.....####.#',
        '##.......,,..........#',
        '#..TT....,,,,,,...b..#',
        '#........""""",......#',
        '#..c.....""""",......#',
        '#^^^^^^^^""""",^^^^^^#',
        '#.....#..""""",......#',
        '#..d..#..,,,,,,..e...#',
        '#.....#..,...........#',
        '#""""".,.,.....TT....#',
        '#""""".,.,...........#',
        '#"""""f,.,...."""""".#',
        '#.....,,.,....""""""g#',
        '#.....,..,...."""""".#',
        '#..h..,..,...........#',
        '#.....,..,,,,,,,.....#',
        '#^^^^^,^^^^^^^^,^^^^^#',
        '#.....,........,..i..#',
        '#""...,....j...,...""#',
        '#"""..,,,,,,,,,,.."""#',
        '#""""....,,......""""#',
        '#T"""....,,......"""T#',
        '##########11##########',
    ],
    w: { 1: ['cinderwick', 1], 2: ['gasket', 1] },
    ents: {
        a: { k: 'sign', text: 'RUSTFIELD FLATS — North: Gasket Gulch. Wild COM-bots nest in the scrap drifts.' },
        b: { k: 'trainer', cls: 'scrapper', name: 'Dex', face: 'left', sight: 4, team: [['Bolty', 4], ['Tinwing', 4]], say: 'You\'re Ma Bellows\' kid! Let\'s see what she built you!', lose: 'Okay, okay. Ma builds good bots.' },
        c: { k: 'item', item: 'reboot-spike', n: 2 },
        d: { k: 'heap', loot: [['scrap-metal', 2], ['rubber', 1]] },
        e: { k: 'trainer', cls: 'tinker', name: 'Pell Jr.', face: 'down', sight: 3, team: [['Cogling', 5]], say: 'My Cogling ticks louder than yours!', lose: 'It… it ticks quieter now.' },
        f: { k: 'item', item: 'patch-kit', n: 1 },
        g: { k: 'wreck', sp: 'Seedling', lv: 6, mats: { 'scrap-metal': 2, 'moss-fiber': 0, 'rubber': 1 } },
        h: { k: 'trainer', cls: 'scrapper', name: 'Wren', face: 'right', sight: 4, team: [['Junkpup', 5], ['Canbot', 4]], say: 'This drift is MY drift.', lose: 'Fine. Share the drift.' },
        i: { k: 'heap', loot: [['copper-wire', 1], ['spring', 1]] },
        j: { k: 'npc', look: 'kid', name: 'Pim', wander: 2, say: ['Ledges only go one way. Hop down, and you can\'t climb back. Plan your route!'] },
    },
});

// ===================================================================== GASKET GULCH — Seal 1 (Gear)
map('gasket', {
    name: 'Gasket Gulch', kind: 'town', biome: 'scrapyard', music: 'town', sub: 'Where the Circuit begins',
    rows: [
        '##########################',
        '#T"".....+.........+..""T#',
        '#"..BBBBBBB...,..BBBBB.."#',
        '#...BBBBBBB...,..BBBBB...#',
        '#...BBB5BBB...,..BB3BB...#',
        '#......,,,,,,,,,,,,,.....#',
        '#+.....,.....a.,.........#',
        '#......,......,....BBBB..#',
        '#..BBBB,......,....BBBB..#',
        '#..BBBB,......,....BB4B.m2',
        '#..BB6B,,,,,,,,,,,,,,,,,,#',
        '#......,...b..,..........#',
        '#T.....,......,.....c...T#',
        '#"".....,,,,,,,......."""#',
        '#"""......d.,........""""#',
        '##"".......,,.......""""##',
        '###.....T..,,..T.....#####',
        '###########11#############',
    ],
    w: { 1: ['route1', 2], 2: ['route2', 1], 3: ['gasket-station', 0], 4: ['gasket-shop', 0], 5: ['gasket-foundry', 0], 6: ['gasket-house', 0] },
    bld: ['foundry', 'station', 'shop', 'house'],
    ents: {
        a: { k: 'sign', text: 'GASKET GULCH FOUNDRY — Forgemaster Cassia Gearwright. "Precision beats power."' },
        b: { k: 'npc', look: 'rand', name: 'Gearhead Lou', wander: 3, say: ['Cassia\'s bots are Gear types. Fire melts gears; Volt fries them; Rust jams them solid.', 'Every Forgemaster you beat gives you a Cog Seal. Eight seals and you can enter the Championship.'] },
        c: { k: 'npc', look: 'rand', name: 'Nan Ruddle', wander: 2, say: ['The Boiler Station fixes your bots for free. The workbench in there turns scrap into spikes and kits — if you have the parts.'] },
        d: { k: 'heap', loot: [['brass-gear', 1], ['scrap-metal', 2]] },
        m: { k: 'marshal', name: 'Circuit Marshal', face: 'left', unless: 'seals>=1', say: 'The Cogdune Wastes are Circuit territory. No one crosses without at least one Cog Seal. Go and see Forgemaster Cassia!' },
    },
});
station('gasket-station', 'Gasket Gulch', ['gasket', 3]);
STATION_CHATTER['gasket-station'] = ['Bots that shut down in battle can be restarted here for free. Just talk to the Boilerkeeper.'];
shop('gasket-shop', 'Gasket Gulch', ['gasket', 4]);
house('gasket-house', 'Ruddle House', ['gasket', 6], {
    a: { k: 'npc', look: 'elder', name: 'Grandpa Ruddle', face: 'down', script: 'datalink' },
    b: { k: 'npc', look: 'kid', name: 'Bit Ruddle', wander: 1, say: ['Grandpa used to be a Forgemaster! He still has his old Data Link.'] },
});
foundry('gasket-foundry', 'Gasket Gulch', ['gasket', 5],
    { k: 'trainer', id: 'cassia', cls: 'leader', name: 'Cassia Gearwright', look: 'cassia', face: 'down', sight: 0, leader: 1 },
    [{ k: 'trainer', cls: 'clocksmith', name: 'Tock', face: 'right', sight: 4, team: [['Cogling', 9], ['Tickit', 10]], say: 'Tick tock! Your time is up!', lose: 'I… lost track of time.' },
     { k: 'trainer', cls: 'clocksmith', name: 'Tess', face: 'left', sight: 4, team: [['Coilspring', 10]], say: 'Surprise! It\'s a spring!', lose: 'Sprung.' }],
    { k: 'npc', look: 'guide', name: 'Foundry Guide', face: 'down', say: ['Hey, challenger! Cassia trains Gear bots. They\'re precise and sturdy, but Blaze, Volt and Rust techniques go right through them. Good luck!'] }, 'gear');

// ===================================================================== ROUTE 2 — Cogdune Wastes
map('route2', {
    name: 'Cogdune Wastes', kind: 'route', biome: 'dunes', music: 'route', lv: [7, 11],
    enc: [['Drillbit', 20], ['Sandhopper', 16], ['Siftle', 14], ['Scoopit', 12], ['Bolty', 10], ['Tinwing', 8], ['Clankle', 8], ['Cinderpup', 6], ['Gravelgut', 4], ['Whirlet', 3], ['Junkpup', 2]],
    rows: [
        '####################################',
        '#T""""....#####......."""""""....TT#',
        '#"""""....#KKK#.......""""""".....T#',
        '#.........#K3K#....a..""""""".....##',
        '#.....b...##,##...........,,,,,,...#',
        '1,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,X,,,2',
        '1..........,......."""""",.....#...#',
        '#..c.......,....d..""""""",.....#..#',
        '#""""".....,.......""""""",..e..#..#',
        '#""""""....,,,,,,,,,,,,,,,,.....#..#',
        '#"""""""..........##.......f....#..#',
        '#""""""".....g....##.....""""...#..#',
        '#T""""".........h.##....""""""..T..#',
        '##""""..........######.."""""".....#',
        '###"""..i.......######...""""....j.#',
        '####################################',
    ],
    w: { 1: ['gasket', 2], 2: ['boilerburg', 1], 3: ['halcyon', 1] },
    deco: [{ k: 'giantgear', x: 18, y: 13 }, { k: 'shiphull', x: 12, y: 1 }, { k: 'rocketfin', x: 32, y: 7 }],
    ents: {
        a: { k: 'sign', text: 'THE WRECK OF THE HALCYON — a freighter that fell forty years ago. KEEP OUT. (Someone has scratched out "OUT".)' },
        b: { k: 'trainer', cls: 'prospector', name: 'Gus', face: 'down', sight: 3, team: [['Drillbit', 9], ['Siftle', 9]], say: 'Struck it rich! A trainer with bots to beat!', lose: 'Fool\'s brass.' },
        c: { k: 'item', item: 'brass-spike', n: 1 },
        d: { k: 'trainer', cls: 'scrapper', name: 'Midge', face: 'down', sight: 4, team: [['Sandhopper', 9], ['Bolty', 10]], say: 'Dune runners never lose!', lose: 'I lost. In the dunes.' },
        e: { k: 'trainer', cls: 'gearhead', name: 'Rolf', face: 'left', sight: 4, team: [['Clankle', 11], ['Scoopit', 10]], say: 'MY BOTS ARE LOUDER THAN YOURS!', lose: 'MY EARS ARE RINGING!' },
        f: { k: 'heap', loot: [['spring', 2], ['scrap-metal', 2]] },
        g: { k: 'wreck', sp: 'Mossbit', lv: 10, mats: { 'scrap-metal': 3, 'moss-fiber': 1, 'copper-wire': 1 } },
        h: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'up', sight: 3, team: [['Junkpup', 10], ['Bolty', 10]], say: 'Hey! The Halcyon is Rust Syndicate salvage! Scram!', lose: 'Sergeant Slag won\'t like this…', unless: 'story>=6' },
        i: { k: 'item', item: 'rivet-kit', n: 1 },
        j: { k: 'heap', loot: [['glass-lens', 1], ['brass-gear', 1]] },
    },
});

// ===================================================================== THE WRECK OF THE HALCYON (dungeon)
map('halcyon', {
    name: 'Wreck of the Halcyon', kind: 'dungeon', biome: 'wreck', music: 'dungeon', lv: [10, 14], dark: true,
    enc: [['Bulbit', 18], ['Screenie', 14], ['Coilspring', 14], ['Hissling', 12], ['Punchkin', 12], ['Wickit', 10], ['Dozertin', 8], ['Tickit', 6], ['Postling', 6]],
    rows: [
        '==========================',
        '=KK___=____s____=____KKK_=',
        '=_____=___p_____=________=',
        '=__"""=_________=__"""___=',
        '=__"""=====___=====""""__=',
        '=__"""_______________""__=',
        '=====_____KK___KK____=====',
        '=___c_______________d____=',
        '=_____===========____=___=',
        '=_"""_=K_______K=____=_e_=',
        '=_"""_=_________=____=___=',
        '=_"""_=__f______======___=',
        '=_____=_________""""""___=',
        '=___g_====___=====""""___=',
        '=________________________=',
        '=KK____h___________i___KK=',
        '=____________1___________=',
        '==========================',
    ],
    w: { 1: ['route2', 3] },
    deco: [{ k: 'holo', x: 12, y: 1 }],
    ents: {
        s: { k: 'trainer', id: 'slag', cls: 'sergeant', name: 'Sgt. Slag', look: 'slag', face: 'down', sight: 0, team: [['Gunklet', 13], ['Punchkin', 13], ['Clankle', 14]], say: 'You\'re the brat poking around my salvage? The Rust Syndicate melts down bots like yours for rivets!', lose: 'Bah! Keep the old tub. We\'ve got bigger wrecks to strip.', after: 'slagBeaten', cogs: 900 },
        p: { k: 'npc', id: 'pell', look: 'engineer', name: 'Engineer Pell', face: 'down', script: 'pell' },
        c: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'right', sight: 5, team: [['Bolty', 11], ['Wickit', 11]], say: 'Intruder in the cargo hold!', lose: 'Ugh. Scrap.' },
        d: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'left', sight: 4, team: [['Hissling', 12]], say: 'Every bot in here gets melted. Yours too!', lose: 'Mine got melted instead…' },
        e: { k: 'item', item: 'bp-patchwork', n: 1 },
        f: { k: 'wreck', sp: 'Tickit', lv: 13, mats: { 'brass-gear': 2, 'spring': 1, 'glass-lens': 1 } },
        g: { k: 'item', item: 'restart-cell', n: 1 },
        h: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'up', sight: 3, team: [['Junkpup', 11], ['Screenie', 12]], say: 'Lost, kid? The exit\'s behind me. Ha!', lose: 'The exit is… still behind me.' },
        i: { k: 'heap', loot: [['circuit-board', 1], ['copper-wire', 2]] },
    },
});

// ===================================================================== BOILERBURG — Seal 2 (Steam)
map('boilerburg', {
    name: 'Boilerburg', kind: 'town', biome: 'boiler', music: 'town', sub: 'City of a thousand chimneys',
    rows: [
        '#############2############',
        '#T""....+....,....+...""T#',
        '#..BBBBBBB...,...BBBBB...#',
        '#..BBBBBBB...,...BBBBB...#',
        '#..BBB5BBB...,...BB3BB...#',
        '#.....,,,,,,,,,,,,,,.....#',
        '#.....,.......,......a...#',
        '#.....,..b....,....BBBB..#',
        '1,,,,,,,,,,,,,,,,,,BBBB..#',
        '#..BBBB.......,....BB4B..#',
        '#..BBBB.......,......,...#',
        '#..BB6B,,,,,,,,,,,,,,,...#',
        '#.....c.......,..........#',
        '#T...KK.....d.,....KK..T##',
        '#""..KK.......,....KK..""#',
        '##########################',
    ],
    w: { 1: ['route2', 2], 2: ['route3', 1], 3: ['boilerburg-station', 0], 4: ['boilerburg-shop', 0], 5: ['boilerburg-foundry', 0], 6: ['boilerburg-house', 0] },
    bld: ['foundry', 'station', 'shop', 'house'],
    deco: [{ k: 'boiler', x: 5, y: 13 }, { k: 'boiler', x: 19, y: 13 }],
    ents: {
        a: { k: 'sign', text: 'BOILERBURG FOUNDRY — Forgemaster "Smokestack" Sal. "Pressure makes rubies. And explosions."' },
        b: { k: 'npc', look: 'boilermaker', name: 'Stoker Meg', wander: 3, say: ['Sal\'s Steam bots shrug off fire and frost. Hit them with Aero to blow the steam away, or Grit to clog their valves.'] },
        c: { k: 'npc', look: 'rand', name: 'Chimney Sweep', wander: 2, say: ['North is the Sparkmarsh. Bring Grit bots — the Volt types there can\'t touch them.'] },
        d: { k: 'heap', loot: [['brass-gear', 2], ['rubber', 1]] },
        m: { k: 'marshal', name: 'Circuit Marshal', face: 'down', unless: 'seals>=2', say: 'The Sparkmarsh is closed to anyone with fewer than two Cog Seals. Sal\'s Foundry is just over there!' },
    },
});
MAPS.boilerburg.rows[1] = '#T""....+....m....+...""T#';
station('boilerburg-station', 'Boilerburg', ['boilerburg', 3]);
shop('boilerburg-shop', 'Boilerburg', ['boilerburg', 4]);
house('boilerburg-house', 'Musicbox Cottage', ['boilerburg', 6], {
    a: { k: 'npc', look: 'elder', name: 'Old Chime', face: 'down', say: ['I built music boxes for forty years. Here, take my old plans. A Lullabox will put anything to sleep.'] },
    b: { k: 'item', item: 'bp-lullabox', n: 1 },
});
foundry('boilerburg-foundry', 'Boilerburg', ['boilerburg', 5],
    { k: 'trainer', id: 'sal', cls: 'leader', name: 'Smokestack Sal', look: 'sal', face: 'down', sight: 0, leader: 2 },
    [{ k: 'trainer', cls: 'boilermaker', name: 'Ash', face: 'right', sight: 4, team: [['Kettlet', 16], ['Hissling', 16]], say: 'Feel the heat!', lose: 'Vented.' },
     { k: 'trainer', cls: 'boilermaker', name: 'Cole', face: 'left', sight: 4, team: [['Chuggle', 17]], say: 'Choo choo! Out of the way!', lose: 'Derailed…' }],
    { k: 'npc', look: 'guide', name: 'Foundry Guide', face: 'down', say: ['Sal runs Steam bots. They resist Blaze, Hydro and Frost. Aero disperses them and Grit clogs their valves!'] }, 'steam');

// ===================================================================== ROUTE 3 — Sparkmarsh
map('route3', {
    name: 'Sparkmarsh', kind: 'route', biome: 'marsh', music: 'route', lv: [14, 18],
    enc: [['Sparkit', 16], ['Coilette', 12], ['Gurglet', 12], ['Spigot', 10], ['Joltfin', 10], ['Vinewire', 10], ['Dynamole', 10], ['Kettlet', 8], ['Pottle', 8], ['Lichenbot', 4]],
    encS: [['Gurglet', 40], ['Joltfin', 35], ['Junktopus', 25]],
    rows: [
        '###########22###########',
        '#T"""....T.,,..T..""""T#',
        '#""""".....,,....."""""#',
        '#~~~~~~""..,,..a..""~~~#',
        '#~~~~~~~"..,,......~~~~#',
        '#~~~~~~~~..,,,,,,..~~~~#',
        '#""~~~~~...b....,...~~~#',
        '#"""""".........,....""#',
        '#..T....c.......,..T...#',
        '#.....,,,,,,,,,,,......#',
        '#..d..,..""""""""..e...#',
        '#.....,..""""""""......#',
        '#~~~..,..""""""""...~~~#',
        '#~~~~.,..........f.~~~~#',
        '#~~~~~,,,,,,,,,,,,~~~~~#',
        '#~~~~~~...g...~~~,~~~~~#',
        '#""~~~~..........,~~~""#',
        '#""""".....h.....,""""##',
        '#T"""....,,,,,,,,,""""T#',
        '#.....i..,.............#',
        '#""".....,.....j...."""#',
        '#T"""....,,.......""""T#',
        '###########11###########',
    ],
    w: { 1: ['boilerburg', 2], 2: ['voltspire', 1] },
    deco: [{ k: 'pylon', x: 9, y: 1 }, { k: 'pylon', x: 15, y: 1 }, { k: 'pylon', x: 3, y: 8 }, { k: 'pylon', x: 19, y: 8 }],
    ents: {
        a: { k: 'sign', text: 'SPARKMARSH — Mind the pylons. They bite.' },
        b: { k: 'trainer', cls: 'sparkwitch', name: 'Ozzie', face: 'down', sight: 4, team: [['Sparkit', 16], ['Bulbit', 16]], say: 'The marsh hums for me!', lose: 'The hum went flat.' },
        c: { k: 'item', item: 'grounding-strap', n: 2 },
        d: { k: 'trainer', cls: 'tinker', name: 'Rosa', face: 'right', sight: 4, team: [['Spigot', 16], ['Pottle', 17]], say: 'My garden needs watering. And winning.', lose: 'Wilted.' },
        e: { k: 'trainer', cls: 'sparkwitch', name: 'Fizz', face: 'left', sight: 4, team: [['Coilette', 17], ['Dynamole', 17]], say: 'Zzzap!', lose: 'Fzzt…' },
        f: { k: 'wreck', sp: 'Bubblet', lv: 15, mats: { 'rubber': 2, 'copper-wire': 1, 'glass-lens': 1 } },
        g: { k: 'item', item: 'card-arc-lash', n: 1 },
        h: { k: 'trigger', id: 'rival2', unless: 'flag:rival2', w: 7 },
        i: { k: 'heap', loot: [['copper-wire', 2], ['plasma-cell', 1]] },
        j: { k: 'trainer', cls: 'junkdiver', name: 'Bubbles', face: 'up', sight: 3, team: [['Gurglet', 17], ['Joltfin', 18]], say: 'Glub glub! Battle!', lose: 'Glub…' },
    },
});

// ===================================================================== VOLTSPIRE — Seal 3 (Volt)
map('voltspire', {
    name: 'Voltspire', kind: 'town', biome: 'volt', music: 'town', sub: 'Lit by a tower that never goes dark',
    rows: [
        '##########################',
        '#T"".....+....T....+..""T#',
        '#""BBBBBBB....T....BBBBB.#',
        '#..BBBBBBB.........BBBBB.#',
        '#..BBB5BBB....a....BB3BB.#',
        '#.....,,,,,,,,,,,,,,,....#',
        '#............,...........#',
        '#..BBBB......,.....BBBB..#',
        '#..BBBB......,.....BBBB..#',
        '#..BB6B......,...b.BB4B..#',
        '2m...,,,,,,,,,,,,,,,,,...#',
        '#........c...,...........#',
        '#T...........,........d.T#',
        '#""".........,.........""#',
        '###########11#############',
    ],
    w: { 1: ['route3', 2], 2: ['route4', 1], 3: ['voltspire-station', 0], 4: ['voltspire-shop', 0], 5: ['voltspire-foundry', 0], 6: ['voltspire-house', 0] },
    bld: ['foundry', 'station', 'house', 'shop'],
    deco: [{ k: 'teslatower', x: 14, y: 2 }],
    ents: {
        a: { k: 'sign', text: 'VOLTSPIRE — The tower has stood for three hundred years. Please do not lick it.' },
        b: { k: 'npc', look: 'rand', name: 'Lamplighter', wander: 2, say: ['Volta\'s bots are fast. Grit bots ground out their Volt attacks completely!'] },
        c: { k: 'npc', look: 'kid', name: 'Sprocket', wander: 3, say: ['The card vendor here sells program cards! A card teaches one technique to any bot that can run it.'] },
        d: { k: 'heap', loot: [['copper-wire', 2], ['circuit-board', 1]] },
        m: { k: 'marshal', name: 'Circuit Marshal', face: 'right', unless: 'seals>=3', say: 'Tumbledown Canyon is for trainers with three Cog Seals or more. Volta\'s waiting at the Foundry.' },
    },
});
station('voltspire-station', 'Voltspire', ['voltspire', 3]);
shop('voltspire-shop', 'Voltspire', ['voltspire', 4], 'low');
house('voltspire-house', 'The Calculating House', ['voltspire', 6], {
    a: { k: 'npc', look: 'engineer', name: 'Professor Abacus', face: 'down', say: ['I designed a bot that predicts its foe\'s every move. Then it predicted I\'d lose the plans. Here — before it\'s right.'] },
    b: { k: 'item', item: 'bp-analytix', n: 1 },
});
foundry('voltspire-foundry', 'Voltspire', ['voltspire', 5],
    { k: 'trainer', id: 'volta', cls: 'leader', name: 'Volta Ferris', look: 'volta', face: 'down', sight: 0, leader: 3 },
    [{ k: 'trainer', cls: 'sparkwitch', name: 'Amp', face: 'right', sight: 4, team: [['Sparkat', 22], ['Bulbit', 21]], say: 'Charged up!', lose: 'Drained.' },
     { k: 'trainer', cls: 'sparkwitch', name: 'Ohm', face: 'left', sight: 4, team: [['Fuzebox', 22], ['Coilette', 22]], say: 'Resistance is futile!', lose: 'Ohm my…' }],
    { k: 'npc', look: 'guide', name: 'Foundry Guide', face: 'down', say: ['Volta trains Volt bots. Grit bots are completely immune to Volt techniques. Moss, Volt, Rust and Void shrug them off too.'] }, 'volt');

// ===================================================================== ROUTE 4 — Tumbledown Canyon
map('route4', {
    name: 'Tumbledown Canyon', kind: 'route', biome: 'canyon', music: 'route', lv: [19, 23],
    enc: [['Drillhorn', 10], ['Gravelgut', 12], ['Jackhop', 12], ['Kickstand', 10], ['Geysprite', 10], ['Dustdevil', 6], ['Cementine', 8], ['Anvilet', 8], ['Grabbit', 8], ['Jabber', 8], ['Weldit', 8]],
    rows: [
        '###################################',
        '#TT###"""""......####......."""""##',
        '#K3O.."""""..a...####...b..."""""##',
        '#KKK...."""......,,,,,,,,,,,..."""#',
        '#........,,,,,,,,,.........,....""#',
        '##^^^^^^^,^^^^^^^^^^###^^^^,^^^^^##',
        '#........,.....""""""###...,.....##',
        '2,,,,,,,,,..c..""""""###...,..d...#',
        '#........,.....""""""......,,,,,,,1',
        '#..e.....,................f.......#',
        '##^^^^^^^,^^^^^^^^^^^^^^^^^^^^,^^##',
        '#""""....,,,,,,,,,,,,,,,,,,,,,,..##',
        '#""""".......g.......h.......""".##',
        '#"""""".............#####...""""i##',
        '#T""""""....j.......#####..""""""T#',
        '###################################',
    ],
    w: { 1: ['voltspire', 2], 2: ['grindstone', 1], 3: ['cave-titan1', 0] },
    deco: [{ k: 'shiphull', x: 20, y: 6 }],
    ents: {
        a: { k: 'sign', text: 'TUMBLEDOWN CANYON — West to Grindstone. Watch your step: the ledges only go down.' },
        b: { k: 'trainer', cls: 'prospector', name: 'Dusty', face: 'down', sight: 3, team: [['Drillhorn', 22], ['Siftle', 21]], say: 'This canyon\'s mine! Well, the mine\'s mine.', lose: 'Tapped out.' },
        c: { k: 'trainer', cls: 'brawler', name: 'Knox', face: 'left', sight: 5, team: [['Punchkin', 22], ['Jabber', 22], ['Grabbit', 22]], say: 'Put \'em up!', lose: 'Down for the count.' },
        d: { k: 'item', item: 'card-drill-spiral', n: 1 },
        e: { k: 'wreck', sp: 'Embrit', lv: 20, mats: { 'scrap-metal': 3, 'plasma-cell': 1, 'brass-gear': 1 } },
        f: { k: 'trainer', cls: 'gearhead', name: 'Brakes', face: 'up', sight: 4, team: [['Kickstand', 22], ['Weldit', 23]], say: 'Full throttle!', lose: 'Out of gas.' },
        g: { k: 'heap', loot: [['spring', 2], ['plasma-cell', 1]] },
        h: { k: 'trainer', cls: 'boilermaker', name: 'Cinder', face: 'down', sight: 4, team: [['Geysprite', 23], ['Cinderpup', 22]], say: 'The canyon\'s hot today. So am I!', lose: 'Cooled off.' },
        i: { k: 'item', item: 'overhaul-kit', n: 1 },
        j: { k: 'item', item: 'bp-rivetpup', n: 1 },
    },
});
map('cave-titan1', {
    name: 'Boiler Cave', kind: 'dungeon', biome: 'cave', music: 'titan', dark: true,
    rows: [
        '=============',
        '=KK__"""__KK=',
        '=____"t"____=',
        '=___________=',
        '=K_________K=',
        '======0======',
    ],
    w: { 0: ['route4', 3] },
    ents: { t: { k: 'titan', sp: 'Thermopylon', lv: 50, flag: 'titanBoiler', say: 'A colossal boiler-beast sleeps here, venting heat in slow breaths. It opens one eye.' } },
});

// ===================================================================== GRINDSTONE — Seal 4 (Grit)
map('grindstone', {
    name: 'Grindstone', kind: 'town', biome: 'canyon', music: 'town', sub: 'The mining town that never stops digging',
    rows: [
        '##########################',
        '#T"".....+.......+...""T##',
        '#..BBBBBBB.........BBBBB.#',
        '#..BBBBBBB.........BBBBB.#',
        '#..BBB5BBB....a....BB3BB.1',
        '#.....,,,,,,,,,,,,,,,,,,,1',
        '#............,...........#',
        '#..BBBB......,.....BBBB..#',
        '#..BBBB..b...,.....BBBB..#',
        '#..BB6B......,.....BB4B..#',
        '#.....,,,,,,,,,,,,,,,,...#',
        '#.......c....,.......d...#',
        '#T...........,..........T#',
        '#"""........m,........"""#',
        '#############2############',
    ],
    w: { 1: ['route4', 2], 2: ['route5', 1], 3: ['grindstone-station', 0], 4: ['grindstone-shop', 0], 5: ['grindstone-foundry', 0], 6: ['grindstone-house', 0] },
    bld: ['foundry', 'station', 'house', 'shop'],
    deco: [{ k: 'crane', x: 13, y: 2 }],
    ents: {
        a: { k: 'sign', text: 'GRINDSTONE FOUNDRY — Forgemaster Bramwell Thorne. "Dig deep."' },
        b: { k: 'npc', look: 'prospector', name: 'Miner Joss', wander: 2, say: ['Bramwell\'s Grit bots hit hard. Hydro washes them out; Moss overgrows them; and Aero bots just fly over the quakes.'] },
        c: { k: 'npc', look: 'rand', name: 'Foreman Dray', wander: 2, say: ['An engine block fell across the Sludgeway road a while back. You\'d need a Lift Coil to shift it. Bramwell has one.'] },
        d: { k: 'heap', loot: [['scrap-metal', 4], ['spring', 1]] },
        m: { k: 'marshal', name: 'Circuit Marshal', face: 'up', unless: 'seals>=4', say: 'Four Cog Seals for the Sludgeway, rules are rules. Bramwell\'s Foundry is up the road.' },
    },
});
station('grindstone-station', 'Grindstone', ['grindstone', 3]);
shop('grindstone-shop', 'Grindstone', ['grindstone', 4]);
house('grindstone-house', 'Canary House', ['grindstone', 6], {
    a: { k: 'npc', look: 'elder', name: 'Widow Marl', face: 'down', say: ['My husband dug for forty years and found a blueprint once. A war-dog of rivets. He never built it. You keep that one from the canyon, dear — build it for him.'] },
    b: { k: 'npc', look: 'kid', name: 'Pebble', wander: 1, say: ['Rubber, springs, gears… every material has a use at the workbench. Wild bots drop parts when you beat them!'] },
});
foundry('grindstone-foundry', 'Grindstone', ['grindstone', 5],
    { k: 'trainer', id: 'bramwell', cls: 'leader', name: 'Bramwell Thorne', look: 'bramwell', face: 'down', sight: 0, leader: 4 },
    [{ k: 'trainer', cls: 'prospector', name: 'Shale', face: 'right', sight: 4, team: [['Gravelgut', 26], ['Sandhopper', 26]], say: 'Rock and roll!', lose: 'Rolled.' },
     { k: 'trainer', cls: 'prospector', name: 'Flint', face: 'left', sight: 4, team: [['Drillhorn', 27]], say: 'Drill sergeant reporting!', lose: 'Dulled…' }],
    { k: 'npc', look: 'guide', name: 'Foundry Guide', face: 'down', say: ['Bramwell digs with Grit bots. Hydro and Moss techniques wash and root them out. Volt does nothing at all to Grit!'] }, 'grit');

// ===================================================================== ROUTE 5 — The Sludgeway
map('route5', {
    name: 'The Sludgeway', kind: 'route', biome: 'sludge', music: 'route', lv: [24, 28],
    enc: [['Paddler', 12], ['Clampet', 10], ['Periscopa', 10], ['Nailfin', 10], ['Gunklet', 10], ['Corrodent', 10], ['Wreckling', 8], ['Snaptrap', 10], ['Sporelet', 10], ['Bilgeworm', 6], ['Junktopus', 4]],
    encS: [['Siphoon', 25], ['Nailfin', 20], ['Bilgeworm', 20], ['Paddler', 15], ['Joltfin', 10], ['Junktopus', 10]],
    rows: [
        '###########11###########',
        '#T""".....,,......"""T##',
        '#"""......,,.....a.""""#',
        '#....b....,,...........#',
        '#.........OO...........#',
        '#.........,,.....~~~~~~#',
        '#..c......,,....~~~~~~~#',
        '#"""......,,...~~~~~~~~#',
        '#""""".d..,,..~~~~~~~~~#',
        '#""""".....,,.~~~~~~~~~#',
        '#..........,,~~~~__~~~~#',
        '#T..e......,,~~~~_3_~~~#',
        '#..........,,~~~~~~~~~~#',
        '#""""......,,.~~~~~~~~~#',
        '#""""".f...,,..~~~~~~~~#',
        '#"""""".....,,..~~~~~~~#',
        '#...........,,...~~~~~~#',
        '#..g........,,....~~~~~#',
        '#""""....h..,,.....i.~~#',
        '#"""""......,,.........#',
        '#T"""".....j,,.....""T##',
        '############22##########',
    ],
    w: { 1: ['grindstone', 2], 2: ['port', 1], 3: ['refinery', 1] },
    deco: [{ k: 'refinery', x: 17, y: 9 }],
    ents: {
        a: { k: 'sign', text: 'THE SLUDGEWAY — Do not swim. Do not drink. Do not look too long.' },
        b: { k: 'trainer', cls: 'dockhand', name: 'Bosun Pike', face: 'right', sight: 4, team: [['Paddler', 26], ['Clampet', 26]], say: 'Ahoy! Ye picked the wrong pier!', lose: 'Sunk!' },
        c: { k: 'item', item: 'antirust', n: 3 },
        d: { k: 'trainer', cls: 'chemist', name: 'Vial', face: 'down', sight: 4, team: [['Gunklet', 27], ['Corrodent', 27]], say: 'An experiment! On you!', lose: 'Results inconclusive.' },
        e: { k: 'wreck', sp: 'Lampyre', lv: 27, mats: { 'glass-lens': 2, 'plasma-cell': 1, 'scrap-metal': 2 } },
        f: { k: 'trainer', cls: 'junkdiver', name: 'Murk', face: 'right', sight: 4, team: [['Periscopa', 27], ['Nailfin', 28]], say: 'I saw you through my periscope!', lose: 'Should\'ve stayed under.' },
        g: { k: 'heap', loot: [['rubber', 3], ['coolant-gel', 1]] },
        h: { k: 'trainer', cls: 'tinker', name: 'Moss', face: 'up', sight: 4, team: [['Snaptrap', 27], ['Sporelet', 27], ['Lichenbot', 28]], say: 'My garden grows in sludge!', lose: 'Uprooted.' },
        i: { k: 'item', item: 'card-hose-blast', n: 1 },
        j: { k: 'heap', loot: [['coolant-gel', 1], ['moss-fiber', 2]] },
    },
});

// ===================================================================== PORT BRACKWATER — Seal 5 (Hydro)
map('port', {
    name: 'Port Brackwater', kind: 'town', biome: 'harbor', music: 'town', sub: 'Harbour of the sludge sea',
    rows: [
        '############11############',
        '#T"".....+..,,..+....""T##',
        '#..BBBBBBB..,,.....BBBBB.#',
        '#..BBBBBBB..,,.....BBBBB.#',
        '#..BBB5BBB..,,..a..BB3BB.#',
        '#.....,,,,,,,,,,,,,,,,...#',
        '#..........,.............#',
        '#..BBBB....,......BBBB...#',
        '#..BBBB....,..b...BBBB...#',
        '#..BB6B....,......BB4B...#',
        '#.....,,,,,,,,,,,,,,,....#',
        '#==...c.........d.....===#',
        '#~~==________________==~~#',
        '#~~~~__K__________K__~~~~#',
        '#~~~~~~~~~~~~~~~~~~~~~~~~#',
        '##########################',
    ],
    w: { 1: ['route5', 2], 3: ['port-station', 0], 4: ['port-shop', 0], 5: ['port-foundry', 0], 6: ['port-house', 0] },
    bld: ['foundry', 'station', 'house', 'shop'],
    deco: [{ k: 'ship', x: 12, y: 14 }],
    ents: {
        a: { k: 'sign', text: 'PORT BRACKWATER FOUNDRY — Forgemaster Captain Ondine Brack. "The tide waits for no bot."' },
        b: { k: 'npc', look: 'dockhand', name: 'Old Salt', wander: 2, say: ['Captain Brack\'s Hydro bots douse Blaze and wash away Grit. Volt and Moss are what you want against her.'] },
        c: { k: 'npc', look: 'rand', name: 'Netmender', wander: 2, say: ['The Mirefen Refinery across the sludge started pumping again twenty days ago. Nobody on the docks works there. So who does?'] },
        d: { k: 'npc', id: 'skiffwright', look: 'engineer', name: 'Skiffwright Nell', face: 'down', script: 'skiff' },
    },
});
station('port-station', 'Port Brackwater', ['port', 3]);
shop('port-shop', 'Port Brackwater', ['port', 4]);
house('port-house', 'Harbourmaster\'s Office', ['port', 6], {
    a: { k: 'npc', look: 'captain', name: 'Harbourmaster', face: 'down', say: ['Sludge seas are full of things that fell from orbit. Fathom Spikes catch Hydro, Toxic and Frost bots three times as well.'] },
    b: { k: 'item', item: 'fathom-spike', n: 3 },
});
foundry('port-foundry', 'Port Brackwater', ['port', 5],
    { k: 'trainer', id: 'ondine', cls: 'leader', name: 'Captain Ondine Brack', look: 'ondine', face: 'down', sight: 0, leader: 5 },
    [{ k: 'trainer', cls: 'dockhand', name: 'Deckhand Rook', face: 'right', sight: 4, team: [['Siphoon', 31], ['Clampet', 31]], say: 'All hands, battle stations!', lose: 'Man overboard!' },
     { k: 'trainer', cls: 'junkdiver', name: 'Coral', face: 'left', sight: 4, team: [['Periscorp', 32]], say: 'Up periscope!', lose: 'Down periscope.' }],
    { k: 'npc', look: 'guide', name: 'Foundry Guide', face: 'down', say: ['The Captain sails with Hydro bots. Volt and Moss techniques sink them. Don\'t bother with Blaze!'] }, 'hydro');

// ===================================================================== MIREFEN REFINERY (dungeon)
map('refinery', {
    name: 'Mirefen Refinery', kind: 'dungeon', biome: 'refinery', music: 'dungeon', lv: [28, 32], dark: true,
    enc: [['Gunkgut', 10], ['Vatling', 10], ['Acidcell', 10], ['Hazdrum', 6], ['Hazmite', 8], ['Fumewing', 10], ['Drumlet', 10], ['Smeltling', 8], ['Chuggle', 8], ['Pistup', 8], ['Whistlet', 8], ['Corrodent', 6]],
    rows: [
        '============================',
        '=KK___=====2=====______KKKK=',
        '=_____=K___v___K=__________=',
        '=__""_=_________=___"""____=',
        '=_"""_====___====___"""_a__=',
        '=_"""_____________________==',
        '===____KK__b__KK_____=======',
        '=________________________=K=',
        '=__c___=======_____=======_=',
        '=______=_""""=_____=_____d_=',
        '=_KK___=_""""=__e__=_______=',
        '=______=_____=_____=___"""_=',
        '=__f______________g____"""_=',
        '=__KK_____h_______________K=',
        '=_______________i__________=',
        '=KK__________1___________KK=',
        '============================',
    ],
    w: { 1: ['route5', 3], 2: ['fumehollow', 1] },
    ents: {
        v: { k: 'trainer', id: 'verdigris', cls: 'exec', name: 'Madame Verdigris', look: 'verdigris', face: 'down', sight: 0, team: [['Gunkgut', 32], ['Acidrake', 33], ['Lampyre', 33], ['Smogwing', 34]], unless: 'flag:verdigrisBeaten', say: 'Ah, the Halcyon brat. Do you know what we brew here? Liquid rust. One barrel can melt a city\'s bots. The Baron has such plans for it.', lose: 'Enough! Shut the valves — we\'re leaving. The Baron has his Leviathan; he doesn\'t need this swamp.', after: 'verdigrisBeaten', cogs: 2400 },
        a: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'left', sight: 4, team: [['Gunkgut', 29], ['Fumewing', 29]], say: 'Smell that? That\'s progress!', lose: 'Smells like defeat.' },
        b: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'down', sight: 4, team: [['Corrodent', 30], ['Drumlet', 30], ['Hazmite', 30]], say: 'Nobody gets to the Madame!', lose: 'Somebody got to the Madame…' },
        c: { k: 'item', item: 'universal-solvent', n: 2 },
        d: { k: 'wreck', sp: 'Gunkgut', lv: 30, mats: { 'glass-lens': 1, 'rubber': 2, 'moss-fiber': 1 } },
        e: { k: 'trainer', cls: 'chemist', name: 'Syndicate Chemist', face: 'down', sight: 3, team: [['Vatling', 30], ['Acidcell', 31]], say: 'Hold still. This won\'t sting much.', lose: 'It stung.' },
        f: { k: 'heap', loot: [['glass-lens', 2], ['plasma-cell', 1]] },
        g: { k: 'item', item: 'card-sludge-shot', n: 1 },
        h: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'right', sight: 5, team: [['Hazdrum', 31], ['Pistup', 30]], say: 'Intruder! On the catwalk!', lose: 'Off the catwalk…' },
        i: { k: 'heap', loot: [['circuit-board', 1], ['rubber', 2]] },
    },
});

// ===================================================================== FUMEHOLLOW — Seal 6 (Toxic)
map('fumehollow', {
    name: 'Fumehollow', kind: 'town', biome: 'toxic', music: 'town', sub: 'A town that learned to breathe through filters',
    rows: [
        '#############2############',
        '#T""...+.....,.....+.""T##',
        '#..BBBBBBB...m.....BBBBB.#',
        '#..BBBBBBB...,.....BBBBB.#',
        '#..BBB5BBB...,..a..BB3BB.#',
        '#.....,,,,,,,,,,,,,,,....#',
        '1,,,,,,......,...........#',
        '#..BBBB......,.....BBBB..#',
        '#..BBBB..b...,.....BBBB..#',
        '#..BB6B......,.....BB4B..#',
        '#.....,,,,,,,,,,,,,,,....#',
        '#****...c.........d..****#',
        '#*""*..............*""**##',
        '##########################',
    ],
    w: { 1: ['refinery', 2], 2: ['route6', 1], 3: ['fumehollow-station', 0], 4: ['fumehollow-shop', 0], 5: ['fumehollow-foundry', 0], 6: ['fumehollow-house', 0] },
    bld: ['foundry', 'station', 'house', 'shop'],
    ents: {
        a: { k: 'sign', text: 'FUMEHOLLOW FOUNDRY — Forgemaster Dr. Lysander Mire. "Every poison is a cure in the right dose."' },
        b: { k: 'npc', look: 'chemist', name: 'Filter-maker', wander: 2, say: ['Dr. Mire\'s Toxic bots resist their own kind. Grit, Hydro and Signal techniques cut through the fumes.'] },
        c: { k: 'npc', look: 'rand', name: 'Fume Warden', wander: 2, say: ['North is the Frostline. A cryo-ship crashed there long ago, and the cold never left.'] },
        d: { k: 'heap', loot: [['moss-fiber', 2], ['glass-lens', 1]] },
        m: { k: 'marshal', name: 'Circuit Marshal', face: 'down', unless: 'seals>=6', say: 'Six Cog Seals to cross the Frostline. The cold kills the unprepared.' },
    },
});
station('fumehollow-station', 'Fumehollow', ['fumehollow', 3]);
shop('fumehollow-shop', 'Fumehollow', ['fumehollow', 4]);
house('fumehollow-house', 'Spore Cellar', ['fumehollow', 6], {
    a: { k: 'npc', look: 'chemist', name: 'Mycologist Fen', face: 'down', say: ['Moss fiber makes Universal Solvent at the workbench. Two fibers and a dab of coolant gel. Very handy.'] },
    b: { k: 'item', item: 'seed-vault', n: 1 },
});
foundry('fumehollow-foundry', 'Fumehollow', ['fumehollow', 5],
    { k: 'trainer', id: 'mire', cls: 'leader', name: 'Dr. Lysander Mire', look: 'mire', face: 'down', sight: 0, leader: 6 },
    [{ k: 'trainer', cls: 'chemist', name: 'Nurse Ichor', face: 'right', sight: 4, team: [['Gunkgut', 36], ['Fumewing', 36]], say: 'Time for your dose!', lose: 'Overdosed on losing.' },
     { k: 'trainer', cls: 'chemist', name: 'Orderly Bile', face: 'left', sight: 4, team: [['Alembix', 37]], say: 'The doctor will see you now. Through me.', lose: 'The doctor is in.' }],
    { k: 'npc', look: 'guide', name: 'Foundry Guide', face: 'down', say: ['Dr. Mire uses Toxic bots. Acid eats Iron and Moss — keep those back! Grit, Hydro and Signal hit them hard.'] }, 'toxic');

// ===================================================================== ROUTE 6 — Frostline Shelf
map('route6', {
    name: 'Frostline Shelf', kind: 'route', biome: 'frost', music: 'route', lv: [33, 37],
    enc: [['Chillit', 10], ['Icebox', 10], ['Plowlet', 10], ['Sleetle', 10], ['Rimeling', 10], ['Glacigear', 6], ['Coolantis', 4], ['Shieldbug', 8], ['Bellowsnout', 8], ['Flarefly', 8], ['Emberoll', 6], ['Pressurion', 5], ['Sumobot', 5]],
    rows: [
        '###########22###########',
        '#T"""....,,,,....""""T##',
        '#""""....,.......""""""#',
        '#""""..a.,...b....."""##',
        '#........,.............#',
        '#.....,,,,,,,,,,,,.....#',
        '#.....,...######.,..c..#',
        '#..d..,...#KKK3#.,.....#',
        '#"""..,...##___#.,.."""#',
        '#""""",.........,."""""#',
        '#""""",,,,,,,,,,,,."""##',
        '#""""......e.....,.....#',
        '#..........,.....,..f..#',
        '#..g.......,.....,.....#',
        '#.....h....,,,,,,,.....#',
        '#""".......,..........##',
        '#"""""..i..,......j..""#',
        '#T"""".....,.......""T##',
        '###########1############',
    ],
    w: { 1: ['fumehollow', 2], 2: ['rimehaven', 1], 3: ['cave-titan2', 0] },
    deco: [{ k: 'cryoship', x: 12, y: 6 }],
    ents: {
        a: { k: 'sign', text: 'FROSTLINE SHELF — The cryo-ship Vesper crashed here ninety years ago. Its coolant still leaks.' },
        b: { k: 'trainer', cls: 'frostrunner', name: 'Pip Rime', face: 'down', sight: 4, team: [['Rimefang', 35], ['Sleetle', 35]], say: 'Brr! Let\'s warm up with a battle!', lose: 'Still cold.' },
        c: { k: 'item', item: 'thaw-torch', n: 3 },
        d: { k: 'trainer', cls: 'frostrunner', name: 'Hale', face: 'right', sight: 4, team: [['Plowlet', 35], ['Icebox', 36]], say: 'Snow day! Battle day!', lose: 'Snowed under.' },
        e: { k: 'trigger', id: 'rival3', unless: 'flag:rival3', w: 7 },
        f: { k: 'wreck', sp: 'Rimefang', lv: 34, mats: { 'coolant-gel': 2, 'scrap-metal': 2, 'circuit-board': 1 } },
        g: { k: 'heap', loot: [['coolant-gel', 2], ['plasma-cell', 1]] },
        h: { k: 'trainer', cls: 'boilermaker', name: 'Stoker Ingrid', face: 'right', sight: 4, team: [['Flarefly', 36], ['Bellowsnout', 36], ['Emberoll', 36]], say: 'Fire beats ice. Everyone knows that.', lose: 'Fire beats ice. Ice beat me.' },
        i: { k: 'item', item: 'card-cryo-beam', n: 1 },
        j: { k: 'trainer', cls: 'veteran', name: 'Sgt. Ivo', face: 'left', sight: 4, team: [['Shieldbug', 37], ['Glacigear', 37]], say: 'Hold the line!', lose: 'Line broken.' },
    },
});
map('cave-titan2', {
    name: 'Wreck of the Vesper — Cryo Hold', kind: 'dungeon', biome: 'frostcave', music: 'titan', dark: true,
    rows: [
        '=============',
        '=KK__"""__KK=',
        '=____"t"____=',
        '=___________=',
        '=K_________K=',
        '======0======',
    ],
    w: { 0: ['route6', 3] },
    ents: { t: { k: 'titan', sp: 'Glaciarch', lv: 52, flag: 'titanFrost', say: 'Something vast is frozen into the wall of the cryo hold. Frost creeps across the floor toward you.' } },
});

// ===================================================================== RIMEHAVEN — Seal 7 (Frost)
map('rimehaven', {
    name: 'Rimehaven', kind: 'town', biome: 'frost', music: 'town', sub: 'Warm hearths on the edge of the ice',
    rows: [
        '##########################',
        '#T"".....+.......+...""T##',
        '#..BBBBBBB.........BBBBB.#',
        '#..BBBBBBB....a....BBBBB.#',
        '#..BBB5BBB.........BB3BB.#',
        '#.....,,,,,,,,,,,,,,,,..m2',
        '#............,...........#',
        '#..BBBB......,.....BBBB..#',
        '#..BBBB..b...,.....BBBB..#',
        '#..BB6B......,.....BB4B..#',
        '#.....,,,,,,,,,,,,,,,....#',
        '#"".....c....,....d....""#',
        '##########11##############',
    ],
    w: { 1: ['route6', 2], 2: ['route7', 1], 3: ['rimehaven-station', 0], 4: ['rimehaven-shop', 0], 5: ['rimehaven-foundry', 0], 6: ['rimehaven-house', 0] },
    bld: ['foundry', 'station', 'house', 'shop'],
    ents: {
        a: { k: 'sign', text: 'RIMEHAVEN FOUNDRY — Forgemaster Ivarra Frostwhistle. "Stillness is strength."' },
        b: { k: 'npc', look: 'frostrunner', name: 'Ice-fisher Bo', wander: 2, say: ['Ivarra\'s Frost bots are brittle. Blaze, Steam, Iron and Piston all shatter them.'] },
        c: { k: 'npc', look: 'rand', name: 'Stablehand', wander: 2, say: ['East of here is Skyrail Heights, and past that the old Heliograph Station that fell from orbit. It\'s pitch black in there.'] },
        d: { k: 'heap', loot: [['coolant-gel', 2], ['aether-crystal', 1]] },
        m: { k: 'marshal', name: 'Circuit Marshal', face: 'left', unless: 'seals>=7', say: 'Seven Cog Seals for the Skyrail. The winds up there will throw a weak bot off the edge.' },
    },
});
station('rimehaven-station', 'Rimehaven', ['rimehaven', 3]);
shop('rimehaven-shop', 'Rimehaven', ['rimehaven', 4]);
house('rimehaven-house', 'The Elder\'s Lodge', ['rimehaven', 6], {
    a: { k: 'npc', id: 'elder', look: 'elder', name: 'Elder Frostwhistle', face: 'down', script: 'lantern' },
    b: { k: 'npc', look: 'kid', name: 'Snowdrop', wander: 1, say: ['Grandma Ivarra is the strongest Forgemaster ever! She\'s my auntie. Well, great-auntie. It\'s complicated.'] },
});
foundry('rimehaven-foundry', 'Rimehaven', ['rimehaven', 5],
    { k: 'trainer', id: 'ivarra', cls: 'leader', name: 'Ivarra Frostwhistle', look: 'ivarra', face: 'down', sight: 0, leader: 7 },
    [{ k: 'trainer', cls: 'frostrunner', name: 'Sleet', face: 'right', sight: 4, team: [['Blizzarrow', 41], ['Rimewraith', 41]], say: 'Freeze!', lose: 'Thawed.' },
     { k: 'trainer', cls: 'frostrunner', name: 'Hail', face: 'left', sight: 4, team: [['Freezerk', 42]], say: 'Cold hands, cold heart!', lose: 'Warm loss.' }],
    { k: 'npc', look: 'guide', name: 'Foundry Guide', face: 'down', say: ['Ivarra commands Frost bots. They freeze Aero, Moss, Grit and Void, but Blaze, Steam, Iron and Piston smash right through.'] }, 'frost');

// ===================================================================== ROUTE 7 — Skyrail Heights
map('route7', {
    name: 'Skyrail Heights', kind: 'route', biome: 'sky', music: 'route', lv: [38, 42],
    enc: [['Rotorhawk', 8], ['Kitebit', 8], ['Blimpet', 8], ['Flutterbolt', 8], ['Draftling', 8], ['Gliderine', 6], ['Magnetiq', 8], ['Gyrolet', 8], ['Winderkin', 8], ['Pendulum', 8], ['Hookshot', 8], ['Dishling', 8], ['Phonopup', 8], ['Clackey', 8]],
    rows: [
        '###################################',
        '#TT"""""....a.......####K2K####."T#',
        '#""""""........b....####_m_####.""#',
        '#""""".....,,,,,,,,,,,,,,,,,,,....#',
        '#.....,,,,,,..............,...""""#',
        '1,,,,,,......c.......d....,..e....#',
        '#.........""""""""........,,,,,,..#',
        '#..f......""""""""..g.........,...#',
        '#^^^^^^^^^""""""""^^^^^^^^^^^,^^^^#',
        '#"""".......h............i...,...T#',
        '#""""""....,,,,,,,,,,,,,,,,,,,..""#',
        '#T"""""..j.....TTT....k.......""T##',
        '###################################',
    ],
    w: { 1: ['rimehaven', 2], 2: ['heliograph', 1] },
    deco: [{ k: 'skyrail', x: 0, y: 0 }, { k: 'pylon', x: 15, y: 11 }],
    ents: {
        a: { k: 'sign', text: 'SKYRAIL HEIGHTS — East: Heliograph Station (CONDEMNED). Hold onto your hat.' },
        b: { k: 'trainer', cls: 'aeronaut', name: 'Skye', face: 'down', sight: 4, team: [['Rotorhawk', 40], ['Blimpet', 40]], say: 'Up here, the wind decides who wins!', lose: 'The wind changed.' },
        c: { k: 'trainer', cls: 'clocksmith', name: 'Minute', face: 'down', sight: 4, team: [['Pendulance', 41], ['Winderkin', 40]], say: 'Right on time!', lose: 'Late again…' },
        d: { k: 'item', item: 'bp-zephlit', n: 1 },
        e: { k: 'trainer', cls: 'sparkwitch', name: 'Radia', face: 'left', sight: 4, team: [['Arraydish', 41], ['Magnetron', 41]], say: 'I can hear your bots\' thoughts!', lose: 'Static. Just static.' },
        f: { k: 'heap', loot: [['aether-crystal', 1], ['brass-gear', 2]] },
        g: { k: 'wreck', sp: 'Rotorhawk', lv: 38, mats: { 'brass-gear': 2, 'spring': 2, 'plasma-cell': 1 } },
        h: { k: 'trainer', cls: 'aeronaut', name: 'Gale', face: 'right', sight: 5, team: [['Galeforce', 41], ['Kitebit', 40], ['Flutterbolt', 41]], say: 'Fly with me!', lose: 'Grounded.' },
        i: { k: 'item', item: 'card-wing-slice', n: 1 },
        j: { k: 'titan', sp: 'Tempestor', lv: 54, flag: 'titanStorm', when: 'story>=23', say: 'The pylons sing. Above them, a storm the shape of a machine looks down at you.' },
        k: { k: 'heap', loot: [['plasma-cell', 1], ['copper-wire', 3]] },
        m: { k: 'marshal', name: 'Station Guard', face: 'down', unless: 'item:arc-lantern', say: 'It\'s pitch black in the Heliograph. Nobody goes in without a proper lantern. The Elder in Rimehaven has one.' },
    },
});

// ===================================================================== HELIOGRAPH STATION (dungeon)
map('heliograph', {
    name: 'Heliograph Station', kind: 'dungeon', biome: 'station', music: 'dungeon', lv: [41, 45], dark: true,
    enc: [['Quarklet', 9], ['Probelet', 9], ['Saucerling', 9], ['Shardlet', 8], ['Gravitum', 5], ['Driftsuit', 6], ['Plasmite', 6], ['Hololark', 6], ['Orrerin', 5], ['Tombot', 6], ['Clattergeist', 6], ['Lockbox', 7], ['Bleeplet', 7], ['Ingot', 6], ['Fuzebox', 6]],
    rows: [
        '============================',
        '=KK____=====_2_=====____KKK=',
        '=_______=K_______K=________=',
        '=__"""__=_________=__"""a__=',
        '=__"""______b_____________==',
        '=___________________=====__=',
        '=====___KKK___KKK___=_c____=',
        '=d__=_______________=______=',
        '=___=___""""""""____===___==',
        '=___e___""""""""___________=',
        '=___=___""""f"""_______g___=',
        '=KK_=______________===_____=',
        '=___=====____h_____=K=_____=',
        '=________________________i_=',
        '=KK____j____1______________=',
        '============================',
    ],
    w: { 1: ['route7', 2], 2: ['aetherton', 1] },
    ents: {
        a: { k: 'item', item: 'bp-voidling', n: 1 },
        b: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'down', sight: 4, team: [['Rustling', 42], ['Lockbox', 42]], say: 'The Baron\'s moving the last crates out. You\'re not stopping it!', lose: 'You\'re… stopping it.' },
        c: { k: 'trainer', cls: 'stationhand', name: 'Lost Technician', face: 'left', sight: 4, team: [['Blipwave', 42], ['Fuzebox', 42], ['Probelet', 43]], say: 'Are you real? I\'ve been down here so long…', lose: 'You\'re definitely real.' },
        d: { k: 'heap', loot: [['void-shard', 1], ['circuit-board', 2]] },
        e: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'right', sight: 5, team: [['Shacklet', 43], ['Hollowhelm', 42]], say: 'Lights! Turn off those lights!', lose: 'Too bright…' },
        f: { k: 'wreck', sp: 'Quasarc', lv: 42, mats: { 'aether-crystal': 2, 'void-shard': 1, 'circuit-board': 1 } },
        g: { k: 'item', item: 'card-aether-beam', n: 1 },
        h: { k: 'trainer', cls: 'stationhand', name: 'Astronomer Lux', face: 'up', sight: 4, team: [['Quasarc', 43], ['Saucerling', 43]], say: 'The stars sent these to me!', lose: 'The stars sent you, too.' },
        i: { k: 'item', item: 'tesla-spike', n: 3 },
        j: { k: 'heap', loot: [['aether-crystal', 1], ['void-shard', 1]] },
    },
});

// ===================================================================== AETHERTON — Seal 8 (Aero)
map('aetherton', {
    name: 'Aetherton', kind: 'town', biome: 'sky', music: 'town', sub: 'City of airships, at the top of the world',
    rows: [
        '#############2############',
        '#T"".....+...m.....+.""T##',
        '#..BBBBBBB...,.....BBBBB.#',
        '#..BBBBBBB...,.....BBBBB.#',
        '#..BBB5BBB...,..a..BB3BB.#',
        '#.....,,,,,,,,,,,,,,,....#',
        '1,,,,,,......,...........#',
        '#..BBBB......,.....BBBB..#',
        '#..BBBB..b...,.....BBBB..#',
        '#..BB6B......,.....BB4B..#',
        '#.....,,,,,,,,,,,,,,,,,,n7',
        '#"".....c.........d....""#',
        '##########################',
    ],
    w: { 1: ['heliograph', 2], 2: ['causeway', 1], 3: ['aetherton-station', 0], 4: ['aetherton-shop', 0], 5: ['aetherton-foundry', 0], 6: ['aetherton-house', 0], 7: ['leviathan', 1] },
    bld: ['foundry', 'station', 'house', 'shop'],
    deco: [{ k: 'airship', x: 22, y: 11 }],
    ents: {
        a: { k: 'sign', text: 'AETHERTON FOUNDRY — Forgemaster Admiral Hexa Vane. "Rise above."' },
        b: { k: 'npc', look: 'aeronaut', name: 'Deck Officer', wander: 2, say: ['The Admiral\'s Aero bots hate Volt, Frost and Iron. Don\'t send Moss or Piston bots against them!'] },
        c: { k: 'npc', look: 'rand', name: 'Stargazer', wander: 2, say: ['See that dark hulk past the east cliffs? The dreadnought Leviathan. It fell before my grandmother was born.'] },
        d: { k: 'heap', loot: [['aether-crystal', 1], ['plasma-cell', 2]] },
        m: { k: 'marshal', name: 'Circuit Marshal', face: 'down', unless: 'story>=23', say: 'Victory Causeway is sealed! There\'s Syndicate trouble at the Leviathan, and no Championship until it\'s dealt with.' },
        n: { k: 'marshal', name: 'Admiralty Sentry', face: 'left', unless: 'story>=22', say: 'The Leviathan wreck is off limits by order of Admiral Vane.' },
    },
});
station('aetherton-station', 'Aetherton', ['aetherton', 3]);
shop('aetherton-shop', 'Aetherton', ['aetherton', 4], 'all');
house('aetherton-house', 'Observatory', ['aetherton', 6], {
    a: { k: 'npc', look: 'engineer', name: 'Astronomer Quell', face: 'down', say: ['The ring in the sky is ten thousand dead ships. Some of them are still falling. One day, something from out there will fall that we can\'t fix.'] },
    b: { k: 'item', item: 'singularity-seed', n: 1 },
});
foundry('aetherton-foundry', 'Aetherton', ['aetherton', 5],
    { k: 'trainer', id: 'vane', cls: 'leader', name: 'Admiral Hexa Vane', look: 'vane', face: 'down', sight: 0, leader: 8 },
    [{ k: 'trainer', cls: 'aeronaut', name: 'Ensign Wisp', face: 'right', sight: 4, team: [['Skyreaper', 46], ['Zeppelord', 45]], say: 'For the Admiral!', lose: 'Shot down…' },
     { k: 'trainer', cls: 'aeronaut', name: 'Lt. Cirrus', face: 'left', sight: 4, team: [['Galeforce', 46], ['Ornithopter', 46]], say: 'Tally ho!', lose: 'Tally no.' }],
    { k: 'npc', look: 'guide', name: 'Foundry Guide', face: 'down', say: ['The Admiral flies Aero bots. Volt, Frost and Iron techniques bring them down. Grit can\'t even reach them!'] }, 'aero');

// ===================================================================== THE LEVIATHAN (dungeon)
map('leviathan', {
    name: 'The Leviathan', kind: 'dungeon', biome: 'leviathan', music: 'leviathan', lv: [46, 50], dark: true,
    enc: [['Oxidrake', 8], ['Shacklet', 10], ['Husklord', 6], ['Scaretin', 10], ['Spadelet', 10], ['Mossbulk', 8], ['Amperoo', 8], ['Coolantis', 6], ['Teslarch', 8], ['Riftcoil', 4], ['Rustling', 10], ['Hollowhelm', 8]],
    rows: [
        '==============================',
        '=KKK_______=___t___=______KKK=',
        '=__________=__o____=_________=',
        '=___""""___=KK___KK=__""""___=',
        '=___""""___===___===__""""___=',
        '=_______________q____________=',
        '====_____==============_____==',
        '=___a___=KK__________KK=__b__=',
        '=_______=______c_______=_____=',
        '=__""""_=______________=_""""=',
        '=__""""_====___d___=====_""""=',
        '=__e____________________f____=',
        '=________KK________KK________=',
        '==_____======_____======___===',
        '=__g________h_____i______j___=',
        '=KK__________1____________KKK=',
        '==============================',
    ],
    w: { 1: ['aetherton', 7] },
    ents: {
        o: { k: 'trainer', id: 'oxide', cls: 'baron', name: 'Baron Oxide', look: 'oxide', face: 'down', sight: 0, team: [['Gunkolossus', 50], ['Husklord', 50], ['Oxidrake', 51], ['Juggernaught', 51], ['Ruinmaw', 53]], say: 'So. The scrap kid. Do you know what this engine is? It pushed this ship between the stars. When I light it, every bot on Midden will melt to slag — and every wright on this planet will buy their metal from ME.', lose: 'Impossible… You\'d choose a planet of junk over an empire of steel? Then keep your junk. Keep ALL of it.', after: 'oxideBeaten', cogs: 6000 },
        t: { k: 'titan', sp: 'Leviacore', lv: 55, flag: 'titanEngine', when: 'flag:oxideBeaten', say: 'The engine core of the Leviathan stirs. Tendrils of light uncoil from it, and it turns to face you.' },
        q: { k: 'trainer', cls: 'exec', name: 'Madame Verdigris', look: 'verdigris', face: 'down', sight: 3, team: [['Acidrake', 48], ['Chandelor', 48], ['Gunkolossus', 49]], say: 'You again! The Baron is one valve away from lighting the engine. I\'ll buy him the time.', lose: 'Go on, then. See what he\'s become.' },
        a: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'right', sight: 4, team: [['Oxidrake', 47], ['Spadelet', 47]], say: 'The Leviathan is ours!', lose: 'Was ours.' },
        b: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'left', sight: 4, team: [['Husklord', 48], ['Scaretin', 47]], say: 'One more step and you\'re slag!', lose: 'I\'m slag…' },
        c: { k: 'item', item: 'bp-ramparton', n: 1 },
        d: { k: 'trainer', cls: 'sergeant', name: 'Sgt. Slag', look: 'slag', face: 'down', sight: 4, team: [['Gunkolossus', 47], ['Hydraulix', 48], ['Clanklord', 48]], say: 'YOU. You cost me my stripes in the Halcyon. Not this time!', lose: 'Again?! Fine. FINE. I quit. I\'m going to go fix bots for a living.' },
        e: { k: 'wreck', sp: 'Oxidrake', lv: 46, mats: { 'scrap-metal': 4, 'void-shard': 1, 'plasma-cell': 1 } },
        f: { k: 'item', item: 'prime-cell', n: 2 },
        g: { k: 'heap', loot: [['void-shard', 2], ['plasma-cell', 1]] },
        h: { k: 'trainer', cls: 'grunt', name: 'Syndicate Grunt', face: 'up', sight: 4, team: [['Riftcoil', 48], ['Teslarch', 47]], say: 'The engine\'s going to blow and you\'re in the way!', lose: 'You\'re still in the way.' },
        i: { k: 'item', item: 'full-rebuild', n: 2 },
        j: { k: 'heap', loot: [['aether-crystal', 2], ['circuit-board', 1]] },
    },
});

// ===================================================================== VICTORY CAUSEWAY
map('causeway', {
    name: 'Victory Causeway', kind: 'route', biome: 'causeway', music: 'route', lv: [50, 55],
    enc: [['Teslatron', 6], ['Pulsarch', 4], ['Cryodon', 6], ['Excavaurus', 6], ['Dreadnaut', 6], ['Foundryx', 6], ['Chronograf', 6], ['Broadcastor', 6], ['Gunkolossus', 6], ['Vulcanvent', 6], ['Samovaruk', 6], ['Hydraulix', 6], ['Skyreaper', 6], ['Voltigar', 6]],
    rows: [
        '##########22##########',
        '#T"""....,,,,....""T##',
        '#"""....a,,......""""#',
        '#........,,..b.......#',
        '#..c.....,,..........#',
        '#""""....,,,,,,..."""#',
        '#"""""...,....,.."""##',
        '#..d.....,....,..e...#',
        '#........,....,......#',
        '#..,,,,,,,,,,,,......#',
        '#..,.....f...........#',
        '#..,.........g...."""#',
        '#""",,,,,,,,,,,,.."""#',
        '#""""..h.......,...""#',
        '#T"""..........,..""T#',
        '##############1#######',
    ],
    w: { 1: ['aetherton', 2], 2: ['arena', 1] },
    ents: {
        a: { k: 'sign', text: 'VICTORY CAUSEWAY — Only the strongest walk this road. At its end: the Brass Crown Arena.' },
        b: { k: 'trainer', cls: 'veteran', name: 'Ace Trainer Wynn', face: 'left', sight: 5, team: [['Cryodon', 52], ['Dreadnaut', 52], ['Teslatron', 53]], say: 'Eight seals? So have I. Prove you deserve the Arena!', lose: 'You deserve it.' },
        c: { k: 'heap', loot: [['plasma-cell', 2], ['aether-crystal', 1]] },
        d: { k: 'trainer', cls: 'veteran', name: 'Ace Trainer Corra', face: 'right', sight: 5, team: [['Excavaurus', 52], ['Chronograf', 53], ['Vulcanvent', 52]], say: 'I\'ve walked this road nine times. Not the tenth — not with you here!', lose: 'Ten times, then.' },
        e: { k: 'item', item: 'full-rebuild', n: 1 },
        f: { k: 'trainer', cls: 'veteran', name: 'Ace Trainer Holt', face: 'down', sight: 4, team: [['Foundryx', 53], ['Hydraulix', 53], ['Skyreaper', 53]], say: 'The Furnace Four are just ahead. Let me warm you up!', lose: 'Warmed up.' },
        g: { k: 'item', item: 'card-full-throttle', n: 1 },
        h: { k: 'trainer', cls: 'veteran', name: 'Ace Trainer Sable', face: 'up', sight: 4, team: [['Broadcastor', 52], ['Samovaruk', 53], ['Voltigar', 53]], say: 'Turn back while you can still walk!', lose: 'Walk on, then.' },
    },
});

// ===================================================================== THE BRASS CROWN ARENA
map('arena', {
    name: 'Brass Crown Arena', kind: 'interior', style: 'arena', music: 'arena', heal: true,
    rows: [
        '===============',
        '=KK====2====KK=',
        '=_____________=',
        '=_K_%%h%%___K_=',
        '=_____________=',
        '=l__________k_=',
        '=_____s%______=',
        '=_____________=',
        '=K___________K=',
        '=======1=======',
    ],
    w: { 1: ['causeway', 2], 2: ['four1', 0] },
    ents: {
        h: { k: 'healer', look: 'keeper', name: 'Arena Boilerkeeper' },
        s: { k: 'clerk', look: 'clerk', name: 'Arena Quartermaster', cards: 'all' },
        l: { k: 'locker' },
        k: { k: 'bench' },
    },
});
function eliteRoom(id, name, style, next, back, ent) {
    return map(id, {
        name, kind: 'interior', style, music: 'elite',
        rows: [
            '===========',
            '=KK==2==KK=',
            '=_________=',
            '=_K_e___K_=',
            '=_________=',
            '=_K_____K_=',
            '=_________=',
            '=====0=====',
        ],
        w: { 0: back, 2: next },
        lock: { 2: [`beat:${ent.id}`, 'The great doors are sealed. They open for the one who wins this hall.'] },
        ents: { e: ent },
    });
}
eliteRoom('four1', 'Hall of Iron', 'elite-iron', ['four2', 0], ['arena', 2], { k: 'trainer', id: 'rook', cls: 'four', name: 'Rook Ironside', look: 'rook', face: 'down', sight: 0, leader: 9 });
eliteRoom('four2', 'Hall of Signals', 'elite-signal', ['four3', 0], ['four1', 2], { k: 'trainer', id: 'seraphine', cls: 'four', name: 'Seraphine Static', look: 'seraphine', face: 'down', sight: 0, leader: 10 });
eliteRoom('four3', 'Hall of Rust', 'elite-rust', ['four4', 0], ['four2', 2], { k: 'trainer', id: 'morrow', cls: 'four', name: 'Morrow Hollowell', look: 'morrow', face: 'down', sight: 0, leader: 11 });
eliteRoom('four4', 'Hall of the Void', 'elite-void', ['crown', 0], ['four3', 2], { k: 'trainer', id: 'ashka', cls: 'four', name: 'Ashka Nyx', look: 'ashka', face: 'down', sight: 0, leader: 12 });
map('crown', {
    name: 'The Brass Crown', kind: 'interior', style: 'crown', music: 'champion',
    rows: [
        '=============',
        '=KKK=====KKK=',
        '=_____c_____=',
        '=_K_______K_=',
        '=___________=',
        '=_K_______K_=',
        '=___________=',
        '======0======',
    ],
    w: { 0: ['four4', 2] },
    ents: { c: { k: 'trainer', id: 'champion', cls: 'champion', name: 'Vex Coppervane', look: 'vex', face: 'down', sight: 0, leader: 13 } },
});

/** Every map's warp digits and where they lead, flattened for tests and the pilot. */
export function warpTargets(m) {
    const out = [];
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = m.rows[y][x];
        if (c >= '0' && c <= '9') out.push({ x, y, d: c, to: m.w[c] });
    }
    return out;
}

/** World map layout for the map screen (normalised 0–1 coordinates). */
export const WORLD_NODES = {
    cinderwick: [0.18, 0.88], route1: [0.18, 0.76], gasket: [0.18, 0.64], route2: [0.32, 0.64], halcyon: [0.32, 0.55],
    boilerburg: [0.46, 0.64], route3: [0.46, 0.52], voltspire: [0.46, 0.4], route4: [0.32, 0.4], grindstone: [0.18, 0.4],
    route5: [0.18, 0.27], port: [0.18, 0.14], refinery: [0.32, 0.2], fumehollow: [0.46, 0.2], route6: [0.6, 0.2],
    rimehaven: [0.74, 0.2], route7: [0.74, 0.34], heliograph: [0.74, 0.46], aetherton: [0.74, 0.58], leviathan: [0.88, 0.58],
    causeway: [0.74, 0.72], arena: [0.74, 0.86],
};
