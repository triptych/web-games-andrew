// The Lantern of Fernhollow — the Atelier's sample game. A short, complete RPG
// that uses every feature, built in code with the same schema helpers the
// editor uses. It is also the fixture the harnesses play from title to The End.

export const SAMPLE_ID = 'p_sample_fernhollow';

// Switches and variables the sample uses
const SW = { intro: 1, quest: 2, pip: 3, wisp: 4, ending: 5, bridge: 6 };
const VAR = { levers: 1, apples: 2 };

export function sampleProject(TW) {
    const S = TW.schema;
    const p = S.newProject({ title: 'The Lantern of Fernhollow' });
    p.id = SAMPLE_ID;
    p.meta.title = 'The Lantern of Fernhollow';
    p.meta.author = 'The Atelier';
    Object.assign(p.system, {
        title: 'The Lantern of Fernhollow', subtitle: 'a TALEWRIGHT sample tale', titleStyle: 'forest', titleMusic: 'title',
        startMap: 1, startX: 14, startY: 16, startDir: 8, startSet: true, party: [1], gold: 60, currency: 'G', windowSkin: 'classic',
        gameOverText: 'The lantern gutters out… but every tale can be begun again.',
    });
    p.switches = ['', 'Intro seen', 'Quest accepted', 'Pip joined', 'Wisp defeated', 'Ending played', 'Bridge open', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    p.variables = ['', 'Levers pulled', 'Apples given', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];

    // ── database ──
    p.actors = [
        Object.assign(S.actor(1, 'Rowan', 'hero'), { cls: 'Lamplighter', stats: { hp: 60, mp: 8, atk: 14, def: 9, mag: 6, spd: 10 }, gain: { hp: 10, mp: 2, atk: 2.6, def: 2, mag: 1, spd: 1.4 }, skills: [{ skill: 3, level: 2 }, { skill: 2, level: 4 }], equip: { weapon: 5, armor: 7, acc: 0 } }),
        Object.assign(S.actor(2, 'Pip', 'child'), { cls: 'Hedge Witch', stats: { hp: 34, mp: 24, atk: 7, def: 6, mag: 14, spd: 13 }, gain: { hp: 7, mp: 4, atk: 1.2, def: 1.2, mag: 2.6, spd: 1.8 }, skills: [{ skill: 1, level: 1 }, { skill: 2, level: 1 }, { skill: 4, level: 5 }] }),
    ];
    const item = (id, name, o) => Object.assign(S.item(id, name), { hp: 0, desc: '' }, o);
    p.items = [
        item(1, 'Potion', { icon: 'potion', price: 20, hp: 50, desc: 'Restores 50 HP.' }),
        item(2, 'Ether', { icon: 'ether', price: 40, mp: 20, desc: 'Restores 20 MP.' }),
        item(3, 'Phoenix Feather', { icon: 'feather', price: 100, revive: true, hp: 50, pct: true, desc: 'Revives a fallen ally with half their HP.' }),
        item(4, 'Firebomb', { icon: 'bomb', price: 60, dmg: 45, element: 'fire', menu: false, desc: 'Hurls fire at one enemy (45).' }),
        item(5, 'Wooden Sword', { icon: 'sword', kind: 'weapon', price: 50, atk: 4, desc: 'A practice sword. ATK +4' }),
        item(6, 'Iron Sword', { icon: 'sword', kind: 'weapon', price: 200, atk: 10, desc: 'Honest iron. ATK +10' }),
        item(7, 'Leather Vest', { icon: 'armor', kind: 'armor', price: 60, def: 4, desc: 'Stiff boiled leather. DEF +4' }),
        item(8, 'Chain Mail', { icon: 'armor', kind: 'armor', price: 220, def: 9, desc: 'Rings of steel. DEF +9' }),
        item(9, 'Lucky Charm', { icon: 'amulet', kind: 'accessory', price: 150, spd: 3, mag: 2, desc: 'A four-leaf clover in glass. SPD +3, MAG +2' }),
        item(10, 'Old Lantern', { icon: 'lantern', kind: 'key', price: 0, desc: 'Fernhollow\'s lantern. Its flame is gone.' }),
        item(11, 'Bread', { icon: 'bread', price: 8, hp: 20, desc: 'Fresh from the oven. Restores 20 HP.' }),
        item(12, 'Red Apple', { icon: 'flower', kind: 'key', price: 0, desc: 'A shiny apple. Someone might want it.' }),
    ];
    p.skills = [
        Object.assign(S.skill(1, 'Fire'), { mp: 4, kind: 'damage', power: 16, element: 'fire', scope: 'enemy', anim: 'fire' }),
        Object.assign(S.skill(2, 'Heal'), { mp: 4, kind: 'heal', power: 28, element: 'none', scope: 'ally', anim: 'heal' }),
        Object.assign(S.skill(3, 'Lantern Strike'), { mp: 3, kind: 'damage', power: 18, element: 'holy', scope: 'enemy', anim: 'holy' }),
        Object.assign(S.skill(4, 'Gust'), { mp: 7, kind: 'damage', power: 12, element: 'wind', scope: 'allEnemies', anim: 'wind' }),
        Object.assign(S.skill(5, 'Gloom'), { mp: 5, kind: 'damage', power: 10, element: 'dark', scope: 'allEnemies', anim: 'dark' }),
        Object.assign(S.skill(6, 'Spark'), { mp: 3, kind: 'damage', power: 10, element: 'bolt', scope: 'enemy', anim: 'bolt' }),
    ];
    const foe = (id, name, look, stats, exp, gold, o) => Object.assign(S.enemy(id, name), { look, stats, exp, gold }, o || {});
    p.enemies = [
        foe(1, 'Moss Slime', { family: 'slime', palette: 0, size: 'S' }, { hp: 22, mp: 0, atk: 10, def: 3, mag: 2, spd: 6 }, 5, 4, { drops: [{ item: 1, chance: 15 }], weak: ['fire'] }),
        foe(2, 'Dusk Bat', { family: 'bat', palette: 3, size: 'S' }, { hp: 18, mp: 0, atk: 11, def: 2, mag: 2, spd: 15 }, 6, 5, { weak: ['wind'] }),
        foe(3, 'Grey Wolf', { family: 'wolf', palette: 5, size: 'M' }, { hp: 36, mp: 0, atk: 13, def: 5, mag: 2, spd: 11 }, 12, 9, { drops: [{ item: 11, chance: 30 }], weak: ['fire'] }),
        foe(4, 'Mushling', { family: 'mushroom', palette: 2, size: 'S' }, { hp: 30, mp: 6, atk: 11, def: 5, mag: 8, spd: 7 }, 9, 7, { skills: [6], weak: ['fire'], resist: ['wind'] }),
        foe(5, 'Gloom Wisp', { family: 'ghost', palette: 7, size: 'L' }, { hp: 240, mp: 60, atk: 15, def: 8, mag: 11, spd: 11 }, 140, 150, { skills: [5, 6], weak: ['holy', 'fire'], resist: ['dark'] }),
    ];
    p.troops = [
        S.troop(1, 'Slimes', [{ enemy: 1, x: 120, y: 150 }, { enemy: 1, x: 200, y: 150 }]),
        S.troop(2, 'Bats', [{ enemy: 2, x: 110, y: 120 }, { enemy: 2, x: 210, y: 130 }]),
        S.troop(3, 'Wolf and Slime', [{ enemy: 3, x: 130, y: 155 }, { enemy: 1, x: 220, y: 150 }]),
        S.troop(4, 'Mushlings', [{ enemy: 4, x: 90, y: 150 }, { enemy: 4, x: 160, y: 156 }, { enemy: 4, x: 230, y: 150 }]),
        Object.assign(S.troop(5, 'The Gloom Wisp', [{ enemy: 5, x: 160, y: 160 }]), { music: 'boss' }),
    ];
    p.sprites = [{ id: 'f1', name: 'Fernhollow Guard', parts: S.parts({ outfit: 'armor', c1: '#7a8a6a', c2: '#3a5a2a', head: 'helmet', hc: '#9aa08a', acc: 'cape', ac: '#3a7a3a' }) }];

    // ── map helpers ──
    const tile = (set, name) => {
        const i = TW.tiles.TILESETS[set].tiles.findIndex((t) => t.n === name);
        if (i < 0) throw new Error('sample: no tile ' + name + ' in ' + set);
        return i + 1;
    };
    function mk(id, name, w, h, set, o) {
        const m = S.map(id, name, w, h, set);
        Object.assign(m, o || {});
        p.maps = p.maps.filter((x) => x.id !== id);
        p.maps.push(m);
        const L = (li, x, y, n) => { if (x >= 0 && y >= 0 && x < w && y < h) m.layers[li][y * w + x] = typeof n === 'string' ? tile(set, n) : n; };
        const rect = (li, x, y, rw, rh, n) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) L(li, x + i, y + j, n); };
        let evId = 1;
        const ev = (x, y, name, pages) => { const e = S.event(evId++, x, y, name); e.pages = pages.map((pg) => Object.assign(S.page(), pg)); m.events.push(e); return e; };
        return { m, L, rect, ev };
    }
    const T = (text, speaker, face, o) => Object.assign({ t: 'text', speaker: speaker || '', face: face || '', text, pos: 'bottom' }, o || {});
    const C = (t, o) => Object.assign(S.command(t), o || {});
    const char = (id, dir) => ({ kind: 'char', id, dir: dir || 2 });
    const obj = (id) => ({ kind: 'obj', id, dir: 2 });
    const door = (x, y, map, tx, ty, dir) => ({ x, y, name: 'Door', pages: [{ trigger: 'touch', priority: 'below', list: [C('transfer', { map, x: tx, y: ty, dir, fade: true })] }] });

    // ── 1: Fernhollow ──
    {
        const { m, L, rect, ev } = mk(1, 'Fernhollow', 30, 22, 'village', { music: 'village', battleBg: 'town', showName: true });
        rect(0, 0, 0, 30, 22, 'Grass');
        rect(0, 13, 0, 3, 22, 'Dirt Path'); rect(0, 0, 10, 30, 3, 'Dirt Path');
        rect(0, 10, 13, 9, 5, 'Plaza Tiles');
        rect(1, 0, 0, 30, 1, 'Oak Tree'); rect(1, 0, 0, 1, 22, 'Oak Tree'); rect(1, 0, 21, 30, 1, 'Oak Tree'); rect(1, 29, 0, 1, 22, 'Oak Tree');
        L(1, 13, 0, 0); L(1, 14, 0, 0); L(1, 15, 0, 0);          // north gap (blocked by a guard)
        L(1, 29, 10, 0); L(1, 29, 11, 0); L(1, 29, 12, 0);       // east exit to Whisperwood
        L(1, 0, 10, 0); L(1, 0, 11, 0); L(1, 0, 12, 0); rect(1, 0, 10, 1, 3, 'Hedge');
        // elder's house (west)
        rect(0, 3, 3, 7, 3, 'Red Roof'); rect(0, 3, 6, 7, 2, 'Brick Wall'); L(0, 4, 7, 'Brick Window'); L(0, 8, 7, 'Brick Window'); L(0, 6, 7, 'Wooden Door');
        // inn (east)
        rect(0, 19, 3, 8, 3, 'Blue Roof'); rect(0, 19, 6, 8, 2, 'Timber Wall'); L(0, 20, 7, 'Timber Window'); L(0, 25, 7, 'Timber Window'); L(0, 23, 7, 'Timber Door');
        L(1, 22, 8, 'Inn Sign');
        // southern houses
        rect(0, 3, 14, 5, 2, 'Thatch Roof'); rect(0, 3, 16, 5, 2, 'Timber Wall'); L(0, 4, 17, 'Timber Window'); L(0, 6, 17, 'Timber Window');
        rect(0, 21, 14, 6, 2, 'Green Roof'); rect(0, 21, 16, 6, 2, 'Brick Wall'); L(0, 22, 17, 'Brick Window'); L(0, 25, 17, 'Brick Window');
        // pond, well, stalls, decorations
        rect(0, 3, 19, 5, 2, 'Water'); L(1, 14, 14, 'Fountain');
        L(1, 11, 13, 'Fruit Stall'); L(1, 17, 13, 'Cloth Stall');
        L(1, 10, 9, 'Lamp Post'); L(1, 18, 9, 'Lamp Post'); L(1, 10, 18, 'Lamp Post'); L(1, 18, 18, 'Lamp Post');
        for (const [x, y] of [[2, 9], [11, 4], [12, 6], [17, 5], [27, 9], [9, 20], [20, 20], [26, 20]]) L(1, x, y, 'Flower Bed');
        L(1, 2, 8, 'Barrel'); L(1, 10, 7, 'Crate'); L(1, 27, 7, 'Barrel'); L(1, 18, 7, 'Bench');
        rect(1, 8, 19, 1, 2, 'Fence (N–S)'); rect(1, 19, 19, 1, 2, 'Fence (N–S)');
        L(1, 24, 12, 'Oak Tree'); L(1, 6, 11, 'Oak Tree'); L(2, 24, 11, 'Canopy');
        L(2, 11, 12, 'Red Awning');

        ev(14, 15, 'Intro', [
            { trigger: 'autorun', list: [
                C('tint', { color: '#0c0628c8', sec: 0 }),
                T('Fernhollow. A village at the edge of the Whisperwood, where the great Lantern has burned on the hill for three hundred years.', ''),
                T('Until last night.', ''),
                C('tint', { color: '#00000000', sec: 1.5 }), C('wait', { sec: 1 }),
                T('Rowan! The Lantern went out in the night. The Elder is asking for you — go and see her, quickly!', 'Villager', 'villager2'),
                C('switch', { id: SW.intro, value: 'on' }),
            ] },
            { cond: Object.assign(S.page().cond, { sw1: SW.intro }), list: [] },
        ]);
        ev(13, 0, 'North Guard', [
            { gfx: char('f1', 2), list: [T('The north road is closed while the Lantern is dark. Strange lights in the hills, they say.', 'Guard', 'f1')] },
        ]);
        ev(6, 7, 'Elder door', [door(0, 0, 2, 5, 8, 8).pages[0]]);
        ev(23, 7, 'Inn door', [door(0, 0, 3, 5, 8, 8).pages[0]]);
        ev(12, 13, 'Fruit seller', [
            { gfx: char('farmer', 2), list: [
                T('Fresh bread and potions! Fair prices, even in the dark.', 'Marta', 'farmer'),
                C('shop', { goods: [11, 1, 2, 3, 4] }),
            ] },
        ]);
        ev(16, 13, 'Smith', [
            { gfx: char('smith', 2), list: [
                T('Going into the woods? Not with that stick, you aren\'t.', 'Bram', 'smith'),
                C('shop', { goods: [5, 6, 7, 8, 9] }),
            ] },
        ]);
        ev(8, 11, 'Mittens', [{ gfx: char('cat', 2), move: 'random', speed: 2, list: [T('Mrrrow?', 'Mittens', 'cat'), C('sfx', { name: 'cursor' })] }]);
        ev(20, 11, 'Child', [
            { gfx: char('villager2', 4), move: 'random', speed: 2, list: [
                T('My little brother Pip went into the Whisperwood to look for the Lantern\'s fire. He hasn\'t come back!', 'Hana', 'villager2'),
                C('if', { cond: { kind: 'switch', id: SW.pip, value: true }, then: [T('Oh! Pip is with you! Thank you, thank you!', 'Hana', 'villager2')], else: [T('Please, if you see him, bring him home.', 'Hana', 'villager2')] }),
            ] },
        ]);
        ev(2, 12, 'Old Tree', [
            { gfx: char('oldwoman', 6), list: [
                T('I\'ve a craving for a red apple. My knees won\'t take me to the orchard any more.', 'Granny Wren', 'oldwoman'),
                C('if', { cond: { kind: 'item', id: 12, value: true }, then: [
                    C('choice', { options: ['Give her the apple', 'Keep it'], cancel: 1, branches: [
                        [C('item', { item: 12, amount: -1 }), C('var', { id: VAR.apples, op: 'add', value: 1 }), T('Oh, how lovely! Here, take this — it brought me luck for sixty years.', 'Granny Wren', 'oldwoman'), C('item', { item: 9, amount: 1 }), C('sfx', { name: 'item' }), C('self', { key: 'A', value: true })],
                        [T('Hmph. Young people.', 'Granny Wren', 'oldwoman')],
                    ] }),
                ] }),
            ] },
            { gfx: char('oldwoman', 6), cond: Object.assign(S.page().cond, { self: 'A' }), list: [T('That apple was delicious. Mind how you go, dear.', 'Granny Wren', 'oldwoman')] },
        ]);
        ev(5, 9, 'Chest', [
            { gfx: obj('chest'), list: [C('sfx', { name: 'open' }), T('Found a \\c[4]Red Apple\\c[0]!'), C('item', { item: 12, amount: 1 }), C('self', { key: 'A', value: true })] },
            { gfx: obj('chest_open'), cond: Object.assign(S.page().cond, { self: 'A' }), list: [T('It\'s empty.')] },
        ]);
        ev(16, 18, 'Sign', [{ gfx: obj('sign'), list: [T('FERNHOLLOW\nWest: the Elder\'s house.  East: the Inn and the Whisperwood.')] }]);
        for (const y of [10, 11, 12]) {
            ev(29, y, 'To Whisperwood', [
                { trigger: 'touch', priority: 'below', list: [
                    T('Nobody goes into the Whisperwood without the Elder\'s say-so. Not with the Lantern dark.', 'Guard', 'guard'),
                    C('route', { target: 'player', steps: ['l'], wait: true }),
                ] },
                { cond: Object.assign(S.page().cond, { sw1: SW.quest }), trigger: 'touch', priority: 'below', list: [C('transfer', { map: 4, x: 1, y: 12, dir: 6, fade: true })] },
            ]);
        }
        ev(28, 9, 'Road Guard', [
            { gfx: char('guard', 2), list: [T('The Elder\'s orders: nobody into the woods tonight.', 'Guard', 'guard')] },
            { cond: Object.assign(S.page().cond, { sw1: SW.quest }), gfx: char('guard', 2), list: [T('The Elder sent you? Then go carefully. Wolves are bold tonight.', 'Guard', 'guard')] },
        ]);
        ev(14, 12, 'Homecoming', [
            { cond: Object.assign(S.page().cond, { sw1: SW.wisp }), trigger: 'autorun', list: [
                C('fadein', { sec: 1 }),
                C('bgm', { name: 'festival' }),
                T('The Lantern burns on the hill again, brighter than anyone remembers.', ''),
                T('You brought back our light — and our Pip. Fernhollow will tell this tale for three hundred years more.', 'Elder Maple', 'elder'),
                C('switch', { id: SW.ending, value: 'on' }),
                C('end', { text: 'Rowan and Pip relit the Lantern of Fernhollow.\n\nThank you for playing this sample tale.\nNow write your own!' }),
            ] },
            { cond: Object.assign(S.page().cond, { sw1: SW.ending }), list: [] },
        ]);
    }

    // ── 2: the Elder's house ──
    {
        const { m, rect, L, ev } = mk(2, 'Elder\'s House', 11, 10, 'interior', { music: 'mystery', showName: false });
        rect(0, 0, 0, 11, 10, 'Darkness');
        rect(0, 1, 1, 9, 8, 'Wood Floor'); rect(0, 1, 1, 9, 2, 'Plaster Wall'); L(0, 3, 1, 'Window Wall'); L(0, 7, 1, 'Window Wall'); L(0, 5, 1, 'Fireplace');
        L(0, 5, 9, 'Doormat'); rect(0, 4, 4, 3, 3, 'Red Carpet');
        L(1, 1, 3, 'Bookshelf'); L(1, 2, 3, 'Bookshelf'); L(1, 9, 3, 'Bed'); L(1, 8, 3, 'House Plant');
        L(1, 2, 6, 'Table'); L(1, 3, 6, 'Chair'); L(1, 9, 7, 'Pot'); L(1, 1, 8, 'Barrel');
        L(2, 5, 4, 'Hanging Lamp');
        ev(5, 9, 'Exit', [door(0, 0, 1, 6, 9, 2).pages[0]]);
        ev(5, 3, 'Elder Maple', [
            { gfx: char('elder', 2), list: [
                T('Rowan. Thank the stars. The Lantern went dark at midnight, and the woods have been whispering ever since.', 'Elder Maple', 'elder'),
                T('Something in the Hollow Cave is drinking the light. Will you go and bring our flame home?', 'Elder Maple', 'elder'),
                C('choice', { options: ['I\'ll go.', 'I\'m not ready yet.'], cancel: 1, branches: [
                    [
                        T('Brave heart. Take these — and take the Lantern itself. It will know its fire when it finds it.', 'Elder Maple', 'elder'),
                        C('item', { item: 1, amount: 3 }), C('item', { item: 10, amount: 1 }), C('sfx', { name: 'item' }),
                        T('Received \\c[4]3 Potions\\c[0] and the \\c[4]Old Lantern\\c[0].'),
                        C('switch', { id: SW.quest, value: 'on' }),
                    ],
                    [T('Then rest at the inn and buy what you need. But do not wait too long.', 'Elder Maple', 'elder')],
                ] }),
            ] },
            { gfx: char('elder', 2), cond: Object.assign(S.page().cond, { sw1: SW.quest }), list: [
                T('The Hollow Cave lies past the old bridge in the Whisperwood. Go with the light, Rowan.', 'Elder Maple', 'elder'),
                C('if', { cond: { kind: 'var', id: VAR.levers, op: '>=', value: 1, src: 'const' }, then: [T('You have found the cave\'s levers, I see. There were two, in my day.', 'Elder Maple', 'elder')], else: null }),
            ] },
        ]);
    }

    // ── 3: the Inn ──
    {
        const { m, rect, L, ev } = mk(3, 'The Sleepy Fern Inn', 11, 10, 'interior', { music: 'village', showName: false });
        rect(0, 0, 0, 11, 10, 'Darkness');
        rect(0, 1, 1, 9, 8, 'Dark Floor'); rect(0, 1, 1, 9, 2, 'Wood Wall'); L(0, 8, 1, 'Fireplace'); L(0, 5, 9, 'Doormat');
        rect(1, 2, 4, 5, 1, 'Counter'); L(1, 1, 7, 'Red Bed'); L(1, 2, 7, 'Red Bed'); L(1, 9, 7, 'Laid Table'); L(1, 9, 6, 'Chair'); L(1, 9, 4, 'Barrel'); L(1, 1, 3, 'Clock');
        L(2, 4, 6, 'Chandelier');
        ev(5, 9, 'Exit', [door(0, 0, 1, 23, 9, 2).pages[0]]);
        ev(4, 3, 'Innkeeper', [
            { gfx: char('innkeeper', 2), list: [
                T('Welcome to the Sleepy Fern! A warm bed is 10 G a night.', 'Rosa', 'innkeeper'),
                C('choice', { options: ['Stay the night (10 G)', 'No thanks'], cancel: 1, branches: [
                    [C('if', { cond: { kind: 'gold', op: '>=', value: 10 }, then: [
                        C('gold', { amount: -10 }), C('fadeout', { sec: 0.6 }), C('heal'), C('sfx', { name: 'heal' }), C('wait', { sec: 0.8 }), C('fadein', { sec: 0.6 }),
                        T('Good morning! You look much better.', 'Rosa', 'innkeeper'),
                    ], else: [T('Oh dear, you\'re a little short.', 'Rosa', 'innkeeper')] })],
                    [T('Come back any time.', 'Rosa', 'innkeeper')],
                ] }),
            ] },
        ]);
        ev(7, 6, 'Bard', [{ gfx: char('bard', 4), list: [T('They say the Gloom Wisp fears holy light. And fire. And, frankly, most things.', 'Lute', 'bard'), C('sfx', { name: 'holy' })] }]);
        ev(5, 6, 'Save Crystal', [{ gfx: obj('crystal'), list: [T('A crystal hums softly. Press Cancel and choose Save to keep your progress.'), C('sfx', { name: 'save' })] }]);
    }

    // ── 4: Whisperwood ──
    {
        const { m, rect, L, ev } = mk(4, 'Whisperwood', 32, 24, 'meadow', { music: 'field', battleBg: 'grass', encounters: [{ troop: 1, weight: 5 }, { troop: 2, weight: 3 }, { troop: 3, weight: 2 }], encRate: 28 });
        rect(0, 0, 0, 32, 24, 'Grass');
        // dense tree border and clumps
        for (let x = 0; x < 32; x++) for (let y = 0; y < 24; y++) {
            const edge = x === 0 || y === 0 || x === 31 || y === 23;
            const h = (x * 7919 + y * 104729) % 97;
            if (edge || (h < 13 && !(y >= 10 && y <= 13) && !(x >= 14 && x <= 17))) L(1, x, y, h % 3 ? 'Oak Tree' : 'Pine Tree');
        }
        rect(0, 0, 11, 32, 2, 'Dirt Path'); rect(0, 15, 2, 2, 22, 'Dirt Path');
        rect(1, 0, 11, 1, 2, 0); rect(1, 15, 0, 2, 1, 0); rect(1, 0, 10, 32, 4, 0); rect(1, 14, 0, 4, 24, 0);
        L(1, 0, 10, 'Oak Tree'); L(1, 0, 13, 'Oak Tree'); rect(1, 0, 10, 1, 1, 'Oak Tree');
        // river with a bridge
        rect(0, 22, 0, 3, 24, 'Water'); rect(0, 22, 11, 3, 2, 'Bridge (E–W)');
        rect(1, 22, 0, 3, 24, 0);
        rect(0, 3, 16, 6, 5, 'Flower Meadow'); rect(0, 5, 3, 5, 4, 'Tall Grass');
        for (const [x, y] of [[4, 17], [7, 19], [26, 5], [28, 18], [11, 5], [19, 20]]) L(1, x, y, 'Red Flowers');
        for (const [x, y] of [[5, 18], [27, 17], [12, 18]]) L(1, x, y, 'Mushrooms');
        L(1, 10, 15, 'Rock'); L(1, 27, 8, 'Boulder'); L(1, 18, 16, 'Stump');
        rect(1, 26, 2, 4, 3, 0); rect(0, 26, 2, 4, 3, 'Stone Path');
        rect(0, 27, 4, 2, 7, 'Dirt Path'); rect(1, 27, 4, 2, 7, 0);
        rect(1, 3, 15, 13, 6, 0); rect(1, 18, 7, 3, 3, 0); rect(1, 25, 14, 6, 9, 0);
        L(2, 9, 10, 'Canopy'); L(2, 20, 10, 'Canopy'); L(2, 9, 13, 'Treetop');

        ev(0, 11, 'To Fernhollow', [{ trigger: 'touch', priority: 'below', list: [C('transfer', { map: 1, x: 28, y: 12, dir: 4, fade: true })] }]);
        ev(0, 12, 'To Fernhollow', [{ trigger: 'touch', priority: 'below', list: [C('transfer', { map: 1, x: 28, y: 12, dir: 4, fade: true })] }]);
        ev(28, 3, 'Cave mouth', [{ gfx: obj('portal'), trigger: 'touch', priority: 'same', list: [T('A cold draught breathes out of the Hollow Cave.'), C('transfer', { map: 5, x: 3, y: 17, dir: 8, fade: true })] }]);
        ev(6, 18, 'Spring', [{ gfx: obj('spring'), list: [C('heal'), C('sfx', { name: 'heal' }), C('flash', { color: '#a8ffc8', sec: 0.5 }), T('The spring\'s water is cool and bright. Your party is fully restored!')] }]);
        ev(12, 19, 'Pip', [
            { gfx: char('child', 2), list: [
                T('Rowan?! Oh, thank goodness. I followed the Lantern\'s last spark into the woods and got lost.', 'Pip', 'child'),
                T('I know a little hedge magic! Let me come with you to the cave. Please?', 'Pip', 'child'),
                C('choice', { options: ['Come along, Pip.', 'Go home where it\'s safe.'], cancel: -1, branches: [
                    [C('party', { actor: 2, op: 'add' }), C('sfx', { name: 'levelup' }), T('\\c[3]Pip joined the party!\\c[0]'), C('switch', { id: SW.pip, value: 'on' }), C('erase')],
                    [T('Aww. Fine. But I\'m still coming. I\'ll just follow… quietly.', 'Pip', 'child'), C('party', { actor: 2, op: 'add' }), C('switch', { id: SW.pip, value: 'on' }), C('erase')],
                ] }),
            ] },
            { cond: Object.assign(S.page().cond, { sw1: SW.pip }), list: [] },
        ]);
        ev(19, 8, 'Chest', [
            { gfx: obj('chest'), list: [C('sfx', { name: 'open' }), T('Found a \\c[4]Firebomb\\c[0]!'), C('item', { item: 4, amount: 1 }), C('self', { key: 'A', value: true })] },
            { gfx: obj('chest_open'), cond: Object.assign(S.page().cond, { self: 'A' }), list: [] },
        ]);
        ev(25, 14, 'Wolf', [
            { gfx: { kind: 'char', id: 'blackcat', dir: 4 }, move: 'approach', speed: 2, trigger: 'touch', list: [
                T('A shadowy beast lunges from the trees!'),
                C('battle', { troop: 3, escape: true, lose: 'gameover', win: [C('erase')] }),
            ] },
        ]);
        ev(30, 20, 'Signpost', [{ gfx: obj('sign'), list: [T('HOLLOW CAVE → north-east.\nBeware the Gloom.')] }]);
    }

    // ── 5: Hollow Cave ──
    {
        const { m, rect, L, ev } = mk(5, 'Hollow Cave', 26, 20, 'dungeon', { music: 'dungeon', battleBg: 'cave', encounters: [{ troop: 4, weight: 4 }, { troop: 2, weight: 3 }], encRate: 24 });
        rect(0, 0, 0, 26, 20, 'Cave Wall');
        rect(0, 2, 15, 4, 4, 'Cave Floor'); rect(0, 3, 4, 2, 11, 'Cave Floor'); rect(0, 3, 3, 12, 2, 'Cave Floor');
        rect(0, 13, 3, 2, 12, 'Cave Floor'); rect(0, 13, 13, 10, 2, 'Cave Floor'); rect(0, 20, 5, 3, 8, 'Cave Floor');
        rect(0, 7, 8, 5, 4, 'Stone Floor'); rect(0, 5, 9, 2, 1, 'Cave Floor');
        rect(0, 16, 1, 9, 4, 'Stone Floor'); rect(0, 15, 3, 1, 1, 'Cave Floor');
        rect(0, 9, 14, 3, 1, 'Water'); rect(0, 16, 7, 3, 3, 'Lava');
        L(0, 20, 2, 'Glowing Floor'); L(0, 21, 2, 'Glowing Floor'); L(0, 22, 2, 'Glowing Floor');
        L(1, 2, 15, 'Wall Torch'); L(1, 5, 15, 'Stalagmite'); L(1, 7, 8, 'Pillar'); L(1, 11, 8, 'Pillar'); L(1, 14, 7, 'Skull'); L(1, 21, 6, 'Bones'); L(1, 22, 12, 'Blue Crystal');
        L(1, 16, 1, 'Brazier'); L(1, 24, 1, 'Brazier'); L(1, 4, 3, 'Cobweb'); L(1, 8, 11, 'Rubble'); L(1, 13, 14, 'Glowcaps');
        L(2, 9, 3, 'Stalactites'); L(2, 18, 13, 'Stalactites');
        ev(3, 18, 'Exit', [{ trigger: 'touch', priority: 'below', list: [C('transfer', { map: 4, x: 28, y: 4, dir: 2, fade: true })] }]);
        const lever = (x, y) => ev(x, y, 'Lever', [
            { gfx: obj('lever'), list: [C('sfx', { name: 'door' }), C('self', { key: 'A', value: true }), C('var', { id: VAR.levers, op: 'add', value: 1 }), C('shake', { power: 2, sec: 0.3 }), T('The lever grinds into place. (\\v[1] of 2)')] },
            { gfx: obj('lever_on'), cond: Object.assign(S.page().cond, { self: 'A' }), list: [T('The lever is already pulled.')] },
        ]);
        lever(9, 9); lever(21, 11);
        ev(15, 3, 'Iron Gate', [
            { gfx: obj('gate'), list: [T('A rusted iron gate. Two lever-chains run into the walls.')] },
            { cond: Object.assign(S.page().cond, { var: VAR.levers, varOp: '>=', varVal: 2 }), list: [] },
        ]);
        ev(8, 10, 'Chest', [
            { gfx: obj('chest'), list: [C('sfx', { name: 'open' }), T('Found an \\c[4]Iron Sword\\c[0]!'), C('item', { item: 6, amount: 1 }), C('self', { key: 'A', value: true })] },
            { gfx: obj('chest_open'), cond: Object.assign(S.page().cond, { self: 'A' }), list: [] },
        ]);
        ev(21, 8, 'Chest', [
            { gfx: obj('bigchest'), list: [C('sfx', { name: 'open' }), T('Found \\c[4]2 Ethers\\c[0] and a \\c[4]Phoenix Feather\\c[0]!'), C('item', { item: 2, amount: 2 }), C('item', { item: 3, amount: 1 }), C('self', { key: 'A', value: true })] },
            { gfx: obj('bigchest_open'), cond: Object.assign(S.page().cond, { self: 'A' }), list: [] },
        ]);
        ev(20, 3, 'Wisp', [
            { gfx: obj('wisp'), trigger: 'touch', list: [
                C('bgm', { name: 'none' }),
                C('shake', { power: 5, sec: 1 }), C('flash', { color: '#a05aff', sec: 0.6 }),
                T('…so warm… so bright… give it to me… GIVE ME THE LIGHT…', 'Gloom Wisp'),
                C('if', { cond: { kind: 'actor', id: 2, value: true }, then: [T('Rowan, it\'s the thing that ate the Lantern\'s fire! Together!', 'Pip', 'child')], else: [T('(You grip the Old Lantern tightly.)')] }),
                C('battle', { troop: 5, escape: false, lose: 'gameover', win: [
                    C('flash', { color: '#ffffff', sec: 1 }), C('sfx', { name: 'holy' }),
                    T('The Gloom Wisp bursts into a thousand sparks — and every one of them flies into the Old Lantern.'),
                    T('The Lantern blazes with light!'),
                    C('switch', { id: SW.wisp, value: 'on' }), C('exp', { actor: 0, amount: 40 }),
                    C('fadeout', { sec: 1 }),
                    C('transfer', { map: 1, x: 14, y: 13, dir: 8, fade: false }),
                ] }),
            ] },
            { cond: Object.assign(S.page().cond, { sw1: SW.wisp }), list: [] },
        ]);
        ev(13, 12, 'Old Note', [{ gfx: obj('scroll'), list: [T('A scrap of paper: "Two levers, two chains, one gate. The cave remembers what it is told."')] }]);
    }

    return p;
}

export const SAMPLE_SW = SW;
export const SAMPLE_VAR = VAR;
