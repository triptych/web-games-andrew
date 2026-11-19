// Every table in the game. Pure data: the rules in town.js, battle.js and story.js read it, the view and UI show it.
// Costs are { gold, flour, sugar, stone }. Production is per second at level 1.

export const RES = ['gold', 'flour', 'sugar', 'stone'];
export const RES_ICON = { gold: '🪙', flour: '🌾', sugar: '🍬', stone: '🪨' };

// ------------------------------------------------------------------ buildings
// make: produced per second. use: consumed per second while running. hope: added to the hope target.
// workers: villagers needed to run at full speed. aff: the staff member who works best here.
export const BUILDINGS = {
    cottage: { name: 'Cottage', icon: '🏡', cost: { gold: 40, stone: 10 }, workers: 0, housing: 6, aff: null,
        desc: 'Crooked, cosy and slightly haunted. Houses six villagers per level.' },
    mill: { name: 'Windmill', icon: '🌾', cost: { gold: 50, stone: 10 }, workers: 3, make: { flour: 0.5 }, aff: null,
        desc: 'Grinds flour. The crow on the sail is called Reginald and he is not paid.' },
    beets: { name: 'Sugarbeet Patch', icon: '🍬', cost: { gold: 55, stone: 10 }, workers: 3, make: { sugar: 0.4 }, aff: null,
        desc: 'Fat pink beets, boiled down to sugar. The scarecrow wears a witch hat, for solidarity.' },
    quarry: { name: 'Quarry', icon: '🪨', cost: { gold: 60 }, workers: 4, make: { stone: 0.4 }, aff: 'gerald',
        desc: 'Stone for walls and buildings. Gerald can lift a block in each hand.' },
    bakery: { name: 'Bakery', icon: '🥐', cost: { gold: 100, stone: 30 }, workers: 3, use: { flour: 0.3, sugar: 0.2 }, make: { gold: 1.5 }, hope: 6, aff: 'pip',
        desc: 'Turns flour and sugar into pastries, gold and hope. Nobody is scared of a town that smells like this.' },
    market: { name: 'Market', icon: '🎪', cost: { gold: 80, stone: 20 }, workers: 2, tax: 0.035, aff: null,
        desc: 'Stalls of pumpkins, candles and cloth. Earns gold from every villager in town.' },
    tailor: { name: 'Knitting Circle', icon: '🧶', cost: { gold: 120, stone: 40 }, workers: 2, hope: 5, armor: 0.08, aff: 'silk',
        desc: 'Madame Silkwhistle\'s tailor shop. Knits cozies for the wall: less damage from every hit, per level.' },
    tavern: { name: 'The Grinning Gourd', icon: '🍺', cost: { gold: 150, stone: 40 }, workers: 2, slots: [2, 4, 5], aff: null,
        desc: 'A tavern where adventurers drink cocoa and wait to be hired. More rooms, more heroes.' },
    tower: { name: 'Watchtower', icon: '🗼', cost: { gold: 120, stone: 60 }, workers: 1, aff: 'grizelda',
        desc: 'Each tower puts a candied crossbow on the wall in a siege. Grizelda keeps them in flowers.' },
    witch: { name: 'Witch\'s Kitchen', icon: '🧪', cost: { gold: 180, stone: 50 }, workers: 2, use: { sugar: 0.08 }, aff: null, unlock: 'witch',
        desc: 'Brews hex-starch for the Mayor\'s doilies: they hit harder, per level.' },
    bell: { name: 'Belfry', icon: '🔔', cost: { gold: 160, stone: 60 }, workers: 1, hope: 8, morale: 0.06, aff: 'wick',
        desc: 'A bell to ring at bedtime and in a siege. Hope in town, and everyone shoots faster on the wall.' },
    oven: { name: 'The Great Oven', icon: '🎂', cost: { gold: 250, stone: 80 }, workers: 4, unique: true, aff: 'pip', unlock: 'oven',
        desc: 'Big enough to bake a person. The Mayor will not say what for. "Trust me."' },
    gingerhome: { name: 'Gingerfolk Cottage', icon: '🍪', cost: { gold: 60, sugar: 30 }, workers: 0, housing: 8, hope: 3, aff: null, unlock: 'ginger',
        desc: 'Homes for the gingerfolk who decided to stay. They are excellent neighbours and smell of cinnamon.' },
};
export const BUILD_ORDER = ['cottage', 'mill', 'beets', 'quarry', 'bakery', 'market', 'tailor', 'tavern', 'tower', 'bell', 'witch', 'oven', 'gingerhome'];

// ------------------------------------------------------------------ staff (Lady Noxia's household, from the first game)
export const STAFF = {
    vellum: { name: 'Lord Vellum', role: 'Chief of Staff', por: 'vellum', sprite: 'staff/lich', aff: null, ability: null,
        bio: 'The lich who once planned the castle\'s parties now plans the town. He has a clipboard for his clipboards. Anywhere he works runs a bit better.' },
    pip: { name: 'Pip', role: 'Head Baker', por: 'pip', sprite: 'staff/imp', aff: 'bakery', ability: 'buns',
        bio: 'The imp sous-chef, promoted. Best in the Bakery or at the Great Oven. In a siege: Bun Barrage.' },
    silk: { name: 'Madame Silkwhistle', role: 'Knitting Circle', por: 'silk', sprite: 'staff/spider', aff: 'tailor', ability: 'web',
        bio: 'Eight hands, eight needles. Best in the Knitting Circle. In a siege: a Sticky Web that slows the whole army.' },
    grizelda: { name: 'Grizelda', role: 'Watchtowers', por: 'grizelda', sprite: 'staff/gargoyle', aff: 'tower', ability: null,
        bio: 'Gargoyle, florist, lookout. Best at a Watchtower. While she has joined, every tower shoots harder.' },
    gerald: { name: 'Gerald', role: 'Quarry & Heavy Lifting', por: 'gerald', sprite: 'staff/golem', aff: 'quarry', ability: 'stomp',
        bio: 'A gingerbread golem, and a gentle one. Best at the Quarry. In a siege: Gerald Stomp pushes the ground troops back.' },
    wick: { name: 'Wick', role: 'Lamplighter', por: 'wick', sprite: 'staff/wraith', aff: 'bell', ability: 'flare',
        bio: 'A candle wraith who lights the lanes at dusk. Best at the Belfry. In a siege: Candle Flare caramelises everything near the target.' },
};
export const STAFF_ORDER = ['vellum', 'pip', 'silk', 'grizelda', 'gerald', 'wick'];

export const ABILITIES = {
    web: { name: 'Sticky Web', icon: '🕸️', cd: 25, dur: 6, slow: 0.5, staff: 'silk', desc: 'Every enemy moves at half speed for 6 s.' },
    flare: { name: 'Candle Flare', icon: '🕯️', cd: 20, dmg: 70, radius: 12, staff: 'wick', desc: '70 damage around the target.' },
    stomp: { name: 'Gerald Stomp', icon: '👣', cd: 30, dmg: 25, reach: 35, push: 18, staff: 'gerald', desc: 'Ground enemies near the wall are knocked back and hurt.' },
    buns: { name: 'Bun Barrage', icon: '🥯', cd: 22, n: 5, dmg: 22, staff: 'pip', desc: 'Five hot buns on the five nearest enemies.' },
};
export const ABILITY_ORDER = ['web', 'flare', 'stomp', 'buns'];

// ------------------------------------------------------------------ adventurers (they stand on the wall)
export const ADVENTURERS = {
    tobias: { name: 'Sir Tobias Gallant', role: 'Knight', por: 'tobias', sprite: 'spr/tobias', cost: 0, phase: 0, kind: 'knight',
        bio: 'The hero who once besieged the Dread Lady\'s castle. He has come to say sorry, and to hold the line in front of the wall.' },
    moss: { name: 'Moss', role: 'Ranger', por: 'moss', sprite: 'spr/moss', cost: 120, phase: 0, kind: 'archer', dmg: 9, rate: 1, range: 90,
        bio: 'Quiet, patient, never misses. Her owl, Pellet, is mostly asleep. Long-range arrows.' },
    lark: { name: 'Lark', role: 'Bard', por: 'lark', sprite: 'spr/lark', cost: 150, phase: 1, kind: 'bard', buff: 0.15,
        bio: 'The wandering bard from the old days, now writing a ballad about the siege. Everyone on the wall attacks faster.' },
    fennel: { name: 'Brother Fennel', role: 'Healer', por: 'fennel', sprite: 'spr/fennel', cost: 180, phase: 1, kind: 'healer', heal: 3,
        bio: 'A monk with a teapot that is, he insists, perfectly ordinary. Mends the wall during a siege and gets the knight back up sooner.' },
    ottilie: { name: 'Ottilie Fizzwick', role: 'Hedge Witch', por: 'ottilie', sprite: 'spr/ottilie', cost: 220, phase: 2, kind: 'witch', dmg: 14, rate: 0.5, range: 60, radius: 7, needs: 'q_ottilie',
        bio: 'Throws fizzing potions that splash a whole crowd. Joins once her kitchen is built.' },
};
export const ADV_ORDER = ['tobias', 'moss', 'lark', 'fennel', 'ottilie'];
export const ADV_MAX = 5;

// ------------------------------------------------------------------ enemies (the Crumb Horde)
export const ENEMIES = {
    zombie: { name: 'Gingerbread Zombie', hp: 26, spd: 5, dmg: 4, rate: 1, gold: 2, size: 1 },
    corn: { name: 'Candy-Corn Imp', hp: 12, spd: 10, dmg: 2, rate: 1.5, gold: 1, size: 0.7 },
    slime: { name: 'Gumdrop Slime', hp: 40, spd: 3.5, dmg: 5, rate: 0.8, gold: 2, size: 0.9, split: 2 },
    slimelet: { name: 'Little Gumdrop', hp: 12, spd: 5, dmg: 2, rate: 1, gold: 0, size: 0.5, sprite: 'slime' },
    ghost: { name: 'Marshmallow Ghost', hp: 20, spd: 6, dmg: 3, rate: 1, gold: 2, size: 0.85, fly: true },
    bat: { name: 'Sugar-Skull Bat', hp: 14, spd: 9, dmg: 2, rate: 1.5, gold: 1, size: 0.7, fly: true },
    licorice: { name: 'Licorice Spider', hp: 18, spd: 8, dmg: 3, rate: 1.2, gold: 1, size: 0.75 },
    mimic: { name: 'Cupcake Mimic', hp: 110, spd: 3, dmg: 10, rate: 0.7, gold: 6, size: 1 },
    brute: { name: 'Peppermint Brute', hp: 200, spd: 2.5, dmg: 16, rate: 0.6, gold: 10, size: 1.3 },
    golem: { name: 'Jawbreaker Golem', hp: 700, spd: 1.8, dmg: 30, rate: 0.5, gold: 30, size: 1.6 },
    king: { name: 'King Crumbleton', hp: 4000, spd: 1.5, dmg: 0, rate: 0, gold: 0, size: 2.4, boss: true },
};

// The four invasions. Each group spawns n of a kind spread evenly between t0 and t1 (seconds), with a little jitter.
export const WAVES = [
    { name: 'The First Crumbs', hp: 1.2, groups: [['zombie', 22, 0, 55], ['corn', 8, 15, 55]] },
    { name: 'The Gumdrop Push', hp: 1.7, groups: [['zombie', 26, 0, 70], ['corn', 12, 10, 70], ['slime', 8, 15, 65], ['ghost', 8, 20, 70], ['licorice', 6, 25, 70], ['brute', 2, 40, 70]] },
    { name: 'The Sugar Storm', hp: 2.15, groups: [['zombie', 30, 0, 85], ['corn', 14, 5, 85], ['slime', 10, 10, 80], ['ghost', 10, 15, 85], ['bat', 12, 20, 85], ['licorice', 10, 20, 85], ['mimic', 5, 30, 80], ['brute', 4, 40, 85], ['golem', 1, 60, 60]] },
    { name: 'The Cookie King', hp: 2.9, king: 30, groups: [['zombie', 34, 0, 100], ['corn', 16, 5, 100], ['slime', 10, 10, 95], ['ghost', 12, 15, 100], ['bat', 14, 20, 100], ['licorice', 12, 20, 100], ['mimic', 6, 25, 95], ['brute', 6, 30, 100], ['golem', 2, 50, 90]] },
];
// Epilogue leftovers: a random mix from this pool, more and tougher each time.
export const EPI_POOL = ['zombie', 'zombie', 'zombie', 'corn', 'corn', 'slime', 'ghost', 'bat', 'licorice', 'mimic', 'brute'];

// What the town should have before each invasion. Meeting all of them gives the wall a bonus.
export const READY = [
    [['wall', 1], ['towers', 1], ['advs', 1]],
    [['wall', 2], ['towers', 2], ['advs', 2], ['bake', 25]],
    [['wall', 3], ['towers', 3], ['advs', 3], ['bake', 50], ['build', 'witch']],
    [['wall', 4], ['towers', 3], ['advs', 4], ['bake', 100]],
];

// ------------------------------------------------------------------ the Grand Bake: four ingredients, each lifts the cap by 25%
export const INGREDIENTS = {
    recipe: { name: 'Mother\'s Recipe Card', icon: '📜' },
    vanilla: { name: 'Moonlight Vanilla', icon: '🌙' },
    icing: { name: 'Royal Icing', icon: '🧁' },
    spark: { name: 'A Spark of Life', icon: '✨' },
};
export const ING_ORDER = ['recipe', 'vanilla', 'icing', 'spark'];

// ------------------------------------------------------------------ daily happenings
export const DAY_EVENTS = [
    { id: 'rain', text: 'Soft rain overnight. The beets and the mill are thriving today.', mods: { mill: 1.5, beets: 1.5 } },
    { id: 'festival', text: 'A pumpkin festival! The market is busy today.', mods: { market: 1.6 }, hope: 4 },
    { id: 'cat', text: 'Pudding the moon cat was seen purring at the town gate. Everyone takes it as a good sign.', hope: 6 },
    { id: 'scouts', text: 'Gingerbread scouts were spotted on the hill. The villagers are nervous today.', hope: -6 },
    { id: 'fog', text: 'Thick fog. The quarry can barely see its own rocks.', mods: { quarry: 0.5 } },
    { id: 'merchant', text: 'A travelling candy merchant swapped bags of sugar for some of our flour.', trade: { flour: -20, sugar: 25 } },
    { id: 'pie', text: 'Granny Hollyhock baked pies for the whole street. Hope rises.', hope: 5 },
];

// ------------------------------------------------------------------ quests
// obj: what completes it. pay: resources the player hands over with "Deliver". reward: what it gives.
// Objective kinds: build (a finished building of kind), lvl (a building of kind at level), wall, hope, advs (hired),
// pop, bake (percent), assign (a staff member working somewhere), towers (count), none (story only).
export const QUESTS = [
    // ---- Phase 1: Madam Mayor
    { id: 'q_home', phase: 0, giver: 'vellum', title: 'Somewhere to Sleep', obj: { kind: 'build', what: 'cottage', n: 2 }, reward: { gold: 40 },
        intro: ['vellum', 'Madam Mayor. The villagers who were hiding in the pumpkin patch would like a roof. Any roof. Your own cottage is lovely, but it only sleeps six.'],
        outro: ['vellum', 'Another cottage! Two families moved in before the paint was dry. I have filed it under "miracles".'] },
    { id: 'q_flour', main: true, phase: 0, giver: 'pip', title: 'Flour Power', obj: { kind: 'build', what: 'mill', and: 'beets' }, reward: { staff: 'pip', flour: 20 },
        intro: ['pip', 'Boss! Boss! A town needs a windmill AND a sugarbeet patch. You can\'t bake hope out of nothing!'],
        outro: ['pip', 'Ooh! More flour! More sugar! More oven! I\'m the Head Baker now, right? I made myself a hat.', ['pip', 1]] },
    { id: 'q_pies', main: true, phase: 0, giver: 'bram', title: 'Torches, Pitchforks and Pies', needs: ['q_flour'], obj: { kind: 'build', what: 'bakery' }, reward: { hopeBonus: 5, gold: 50 },
        intro: ['bram', 'Mayor... we, er, still have all the torches and pitchforks from when we marched on your castle. Sorry about that. Could we... put them to better use?'],
        outro: ['bram', 'Turns out a pitchfork makes a lovely toasting fork. Nobody\'s marching anywhere now except to the bakery.'] },
    { id: 'q_tower', phase: 0, giver: 'grizelda', title: 'A Watchful Eye', obj: { kind: 'build', what: 'tower' }, reward: { staff: 'grizelda' },
        intro: ['grizelda', 'Hmph. Nobody ever asks the gargoyles. We are excellent at looking out. Build me a tower and I\'ll keep watch.'],
        outro: ['grizelda', 'Now THIS is a view. I put geraniums on the crossbow. Don\'t argue.'] },
    { id: 'q_tobias', main: true, phase: 0, giver: 'tobias', title: 'Sir Tobias Comes Back', obj: { kind: 'build', what: 'tavern' }, reward: { adv: 'tobias' },
        intro: ['tobias', 'Lady Noxia! I am Sir Tobias. Last year I besieged your castle because everyone said you were a monster. I was wrong, and I\'m sorry. If there were a tavern, I could stay and help.', ['tobias', 1]],
        outro: ['tobias', 'I\'ll hold the line in front of the wall, Mayor. And I\'ve painted a doily on my shield. It was very calming.'] },
    { id: 'q_knit', phase: 0, giver: 'silk', title: 'Knit One, Defend Two', obj: { kind: 'build', what: 'tailor' }, reward: { staff: 'silk' },
        intro: ['silk', 'Darling, some of the villagers cross the street when they see me. Eight legs, you understand. Give me a shop, and let them see what these legs can knit.'],
        outro: ['silk', 'Knit one, defend two, darling. Three ladies from the bakery have joined the circle already. One of them used to scream when she saw me. Now she drops stitches. Progress!', ['silk', 1]] },
    { id: 'q_oven', main: true, phase: 0, giver: 'gustave', title: 'The Great Oven', needs: ['q_pies'], obj: { kind: 'build', what: 'oven' }, reward: { ing: 'recipe' },
        intro: ['gustave', 'Monsieur Gustave, food critic. Madame Mayor, they say you plan a bake so grand it will end a war. Pfft. You will need an oven the size of a house.'],
        outro: ['noxia', 'Mother left me her recipe card. The biggest bake I have ever attempted. No, Vellum, I will not tell you what it is. Trust me.'] },
    // ---- Phase 2
    { id: 'q_gerald', phase: 1, giver: 'tansy', title: 'The Golem Who Wasn\'t', obj: { kind: 'pay', cost: { sugar: 40, flour: 20 } }, reward: { staff: 'gerald', hopeBonus: 6 },
        intro: ['tansy', 'Mayor, the grown-ups won\'t let Gerald help because he\'s gingerbread, like the invaders. But Gerald\'s nice! He let me sit on his shoulders. Can we have a tea party, so everybody meets him properly?'],
        outro: ['gerald', 'Nobody\'s ever asked me to tea before. Farmer Bram shook my hand. He said I smell like Christmas.', ['gerald', 3]] },
    { id: 'q_lanes', phase: 1, giver: 'wick', title: 'Lights in the Lanes', obj: { kind: 'build', what: 'bell' }, reward: { staff: 'wick' },
        intro: ['wick', 'The villagers are frightened of the dark lanes, Mayor. I could light every lamp at dusk, if there were a belfry to ring the hour.'],
        outro: ['wick', 'The children follow me around at dusk now. I let them hold the pole. Only the end without the fire.'] },
    { id: 'q_vanilla', main: true, phase: 1, giver: 'hollyhock', title: 'Moonlight Vanilla', obj: { kind: 'bake', pct: 20, pay: { gold: 80, sugar: 30 } }, reward: { ing: 'vanilla' },
        intro: ['hollyhock', 'I baked for this village for fifty years, dearie, and I was sure you\'d be dreadful. Your gingersnaps changed my mind. Moonlight vanilla grows by the old graveyard. Bring me the oven warm and some sugar, and I\'ll fetch it.'],
        outro: ['hollyhock', 'There. Picked under a full moon, the proper way. Don\'t tell anyone I was wrong about you. I have a reputation.'] },
    { id: 'q_heroes', phase: 1, giver: 'moss', title: 'A Company on the Wall', obj: { kind: 'advs', n: 2 }, reward: { gold: 90 },
        intro: ['moss', 'One knight won\'t hold a wall. Hire another adventurer at the Gourd. My owl agrees. He\'s asleep, but he agrees.'],
        outro: ['vellum', 'Quest complete. I\'ve filed it under miracles.', ['vellum', 4]], outro2: ['moss', 'That\'s better. Pellet woke up for almost a whole minute.'] },
    { id: 'q_mother', phase: 1, giver: 'mother', title: 'Mother\'s Wall', obj: { kind: 'wall', lvl: 2 }, reward: { hopeBonus: 4, stone: 60 },
        intro: ['mother', 'Darling, a mayor. Of course you are. Your wall, however, is a fence. Raise it before those biscuits come back.', ['mother', 1]],
        outro: ['mother', 'Better. I was proud of the evil, you know. I am prouder of this.', ['mother', 2]] },
    // ---- Phase 3
    { id: 'q_icing', main: true, phase: 2, giver: 'silk', title: 'Royal Icing', obj: { kind: 'bake', pct: 45, pay: { sugar: 80, flour: 40 } }, reward: { ing: 'icing' },
        intro: ['silk', 'Whatever you are baking needs lace, darling. Icing lace. Nobody pipes finer than a spider. I just need sugar. A great deal of sugar.'],
        outro: ['silk', 'A scarf for every soldier. And the wall. That too. Forty yards of royal icing lace. I may have wept a little. It is the finest thing I have ever made.', ['silk', 2]] },
    { id: 'q_ghost', phase: 2, giver: 'bram', title: 'The Ghost Who Was Just Cold', obj: { kind: 'lvl', what: 'tailor', lvl: 2 }, reward: { hopeBonus: 5, gold: 80 },
        intro: ['bram', 'There\'s a ghost in the end cottage, Mayor. Moaning all night. Everyone says he\'s cursed and wicked and we ought to chase him off.'],
        outro: ['noxia', 'He wasn\'t wicked. He was cold. Madame Silkwhistle knitted him a scarf and now he hums. Old Mr Ambrose has been haunting that cottage politely for two hundred years. Nobody ever asked.'] },
    { id: 'q_honey', phase: 2, giver: 'grizelda', title: 'Bees in the Belfry', obj: { kind: 'lvl', what: 'bell', lvl: 2, pay: { gold: 60 } }, reward: { honey: true },
        intro: ['grizelda', 'There are bees in the belfry. Good bees. If the bell tower were bigger they\'d make enough honey to sweeten your mysterious bake.'],
        outro: ['grizelda', 'Honey for the Great Oven. It\'ll bake faster now. The bees and I have an understanding.'] },
    { id: 'q_ottilie', phase: 2, giver: 'ottilie', title: 'Ottilie\'s Kitchen', obj: { kind: 'build', what: 'witch' }, reward: { gold: 40 },
        intro: ['ottilie', 'Hello! I\'m a witch. A nice one. Most witches are, actually, it\'s just the loud ones who get the stories. Build me a kitchen and I\'ll brew starch for your doilies, and come throw potions from the wall!'],
        outro: ['ottilie', 'Hex-starch, freshly brewed! Hire me at the Gourd whenever you\'re ready.'] },
    // ---- Phase 4
    { id: 'q_spark', main: true, phase: 3, giver: 'vellum', title: 'A Spark of Life', obj: { kind: 'bake', pct: 70, pay: { gold: 200, flour: 80, sugar: 80 } }, reward: { ing: 'spark' },
        intro: ['vellum', 'Madam Mayor. I finally peeked in the Great Oven. I understand now. If you mean to wake... her... it will take a spark of life. Wick and I can manage it. It will not be cheap.'],
        outro: ['wick', 'A little candle-flame, a little lich magic, and all the sugar in Thistlegloom. She\'s ready to finish baking.'] },
    { id: 'q_drawing', phase: 3, giver: 'tansy', title: 'Tansy\'s Drawing', obj: { kind: 'hope', v: 70 }, reward: { gold: 120 },
        intro: ['tansy', 'I drew you, Mayor! That\'s you, and those are your horns, and that\'s everybody being happy. Can you make everybody happy for real, so the drawing\'s true?'],
        outro: ['tansy', 'It\'s true now! I\'m putting it up in the bakery window. Granny Hollyhock says it\'s very good. She said "very".'] },
];

// ------------------------------------------------------------------ portraits and story scenes
export const CAST = {
    noxia: { name: 'Mayor Noxia', por: 'noxia', side: 'left' },
    vellum: { name: 'Lord Vellum', por: 'vellum' }, pip: { name: 'Pip', por: 'pip' }, silk: { name: 'Madame Silkwhistle', por: 'silk' },
    grizelda: { name: 'Grizelda', por: 'grizelda' }, gerald: { name: 'Gerald', por: 'gerald' }, wick: { name: 'Wick', por: 'wick' },
    mother: { name: 'Mother (a portrait)', por: 'mother' }, tansy: { name: 'Tansy', por: 'tansy' }, hollyhock: { name: 'Granny Hollyhock', por: 'hollyhock' },
    bram: { name: 'Farmer Bram', por: 'bram' }, hilde: { name: 'Hilde the Stonemason', por: 'hilde' }, tobias: { name: 'Sir Tobias', por: 'tobias' },
    lark: { name: 'Lark', por: 'lark' }, moss: { name: 'Moss', por: 'moss' }, ottilie: { name: 'Ottilie', por: 'ottilie' },
    fennel: { name: 'Brother Fennel', por: 'fennel' }, gustave: { name: 'Monsieur Gustave', por: 'gustave' },
    king: { name: 'King Crumbleton', por: 'king' }, queen: { name: 'Queen Honeysnap', por: 'queen', side: 'left' },
};

// Voice clips: [speaker, clip number] for lines that have one (see audio/README.md).
export const SCENES = {
    intro: [
        ['vellum', 'Madam Mayor. Congratulations on the election. It was unanimous, which is unusual, as you were not standing.', null],
        ['noxia', 'I was found out, Vellum. A whole castle of doilies. I expected torches. Instead they voted me MAYOR.', null],
        ['hilde', 'You fed half the village anonymously for a year, Mayor. We worked it out. The doilies were a clue.', null],
        ['noxia', 'Citizens of Thistlegloom! Your mayor is here. Please stop hiding behind the pumpkins.', ['noxia', 1]],
        ['vellum', 'There is a small problem. The scouts report gingerbread. A great deal of gingerbread.', ['vellum', 2]],
        ['vellum', 'King Crumbleton, the Gingerbread Zombie King, is marching from the Stale Lands with the Crumb Horde. They crumble everything they touch.', null],
        ['noxia', 'Then we have a week. Build it, bake it, and do try to look menacing.', ['noxia', 2]],
    ],
    phase2: [
        ['vellum', 'We held! The town is in one piece. Mostly. The horde has fallen back to regroup.', null],
        ['noxia', 'And the ones we beat just... curled up and napped. Like sleepy biscuits. They\'re not monsters, Vellum. They\'re confused.', null],
        ['mother', 'Darling, a word. The king will come again, larger. Whatever you are baking, bake faster.', null],
    ],
    phase3: [
        ['tobias', 'The second wave broke, Mayor! Lark is already writing the ballad.', null],
        ['gerald', 'One of the little gingerbread ones napped next to me after. He asked if I was his dad. I said no, but he could hold my mitt.', null],
        ['vellum', 'The scouts say the next wave is a storm. Jawbreakers. Bats. Cupcakes with teeth. I have prepared a schedule for panicking.', ['vellum', 3]],
    ],
    phase4: [
        ['noxia', 'A napping scout told me something. The king wasn\'t always a king. He was baked alone, for a contest nobody came to judge. Nobody ever shared him.', null],
        ['king', 'Nobody ever... shared me...', ['king', 2]],
        ['noxia', 'He went stale waiting, and he\'s been crumbling everything since, so nobody else gets to be shared either. That\'s not wickedness. That\'s loneliness.', null],
        ['vellum', 'Then the Great Oven... Madam Mayor, is that what you\'ve been...', null],
        ['noxia', 'Finish the bake, Vellum. He\'s coming himself this time.', null],
    ],
    king: [
        ['king', 'Crumble... everything...', ['king', 1]],
        ['noxia', 'Hold the wall! And mind the doilies, they\'re hand-made!', ['noxia', 3]],
    ],
    queen: [
        ['noxia', 'Now, my darling... it\'s time for the reveal.', ['noxia', 6]],
        ['queen', 'Hello, your Majesty. I was baked just for you.', ['queen', 1]],
        ['king', 'For... me?', ['king', 3]],
        ['queen', 'Shall we stop all this crumbling, and have a dance instead?', ['queen', 2]],
    ],
    ending: [
        ['king', 'I\'m not stale anymore.', ['king', 4]],
        ['queen', 'Sweet dreams, everyone.', ['queen', 3]],
        ['vellum', 'The Crumb Horde has... sat down. Several of them are holding hands. The war is over, Madam Mayor.', null],
        ['mother', 'I was proud of the evil. I\'m prouder of this.', ['mother', 2]],
        ['noxia', 'We held! Somebody put the kettle on.', ['noxia', 5]],
        ['noxia', 'And Vellum? Some of the gingerfolk want to stay. Let\'s build them houses. They\'re neighbours now.', null],
    ],
    retreat: [
        ['king', 'Crumble... everything...', ['king', 1]],
        ['vellum', 'The king has withdrawn to rebake his army! Three more days, Madam Mayor. Whatever is in that oven, finish it.', null],
    ],
};

// Gossip ticker lines by hope: frightened, uneasy, hopeful, cheerful. View-only flavour.
export const GOSSIP = [
    ['Villagers hide under beds. Beds report feeling crowded.', 'Someone heard a cookie crunch in the woods. Everyone heard it twice.', 'Bram has started sleeping with his pitchfork again.'],
    ['Mayor seen in apron at the bakery. Villagers unsure whether to be scared or hungry.', 'The cottage ghost moaned again. Nobody has asked him why.', 'Gingerbread scouts sighted. Granny Hollyhock says "not my gingerbread".'],
    ['Wall growing taller by the day. Tansy has drawn a picture of it.', 'Madame Silkwhistle\'s knitting circle now has nine members and a waiting list.', 'Lark\'s new ballad, "The Doily Defence", reaches number one at the Gourd.'],
    ['Thistlegloom voted Most Hopeful Village by the Thistlegloom Gazette.', 'Gerald seen giving piggyback rides. Queue around the block.', 'The Mayor\'s cackle heard from the belfry. Villagers cheer.'],
];
