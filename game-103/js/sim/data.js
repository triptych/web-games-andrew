// Content tables: terrain, classes, skills, chapters and every line of story. Pure data.
// Stats are [base at level 1, growth per level]. A unit's level is the chapter it fights in
// (chapter 1 = level 1), so the whole school studies together and nobody falls behind.

export const TERRAIN = {
    '.': { name: 'Grass', h: 0, cost: 1 },
    ',': { name: 'Grassy rise', h: 1, cost: 1 },
    ':': { name: 'High meadow', h: 2, cost: 1 },
    'f': { name: 'Bushes', h: 0, cost: 2, cover: true },
    'F': { name: 'Tall bushes', h: 1, cost: 2, cover: true },
    '~': { name: 'Open air', h: 0, cost: 1, block: true, gap: true },
    '#': { name: 'Wall', h: 2, cost: 1, block: true },
    't': { name: 'Table', h: 1, cost: 1, block: true },
    's': { name: 'Stone', h: 0, cost: 1 },
    'S': { name: 'Raised stone', h: 1, cost: 1 },
    'Z': { name: 'High stone', h: 2, cost: 1 },
    'w': { name: 'Flowers', h: 0, cost: 1 },
    'r': { name: 'Rug', h: 0, cost: 1 },
};

export const STATUS = {
    cheer: { name: 'Cheered', short: 'Cheer', desc: 'Deals 25% more damage.' },
    guard: { name: 'Guarded', short: 'Guard', desc: 'Takes 35% less damage.' },
    regen: { name: 'Cosy', short: 'Cosy', desc: 'Heals a little at the start of each turn.' },
    sleepy: { name: 'Sleepy', short: 'Zzz', desc: 'Skips the next turn. Any damage wakes it up.' },
};

// kind: phys | mag | heal | buff | status.  tgt: foe | ally | self (centred on the caster).
export const SKILLS = {
    // Pip
    scepter: { name: 'Wobbly Scepter', kind: 'phys', tgt: 'foe', range: [1, 1], aoe: 0, power: 1.0, cost: 0, lvl: 1, fx: 'star',
        desc: 'A swing of the royal scepter. Pip is a little clumsy: now and then she trips, and now and then she stumbles into a lucky double hit.' },
    decree: { name: 'Royal Decree', kind: 'buff', tgt: 'self', range: [0, 0], aoe: 2, status: 'cheer', dur: 3, cost: 3, lvl: 2, fx: 'crown',
        desc: 'Allies within 2 tiles are cheered for 3 turns: +25% damage.' },
    crown: { name: 'Crown Sparkle', kind: 'mag', tgt: 'foe', range: [1, 3], aoe: 1, power: 1.1, cost: 4, lvl: 4, fx: 'sparkle',
        desc: 'The tiara flashes. Magic damage in a small burst.' },
    // Bram
    sword: { name: 'Sword', kind: 'phys', tgt: 'foe', range: [1, 1], aoe: 0, power: 1.0, cost: 0, lvl: 1, fx: 'slash', desc: 'A steady sword stroke.' },
    shieldwall: { name: 'Shield Wall', kind: 'buff', tgt: 'self', range: [0, 0], aoe: 1, status: 'guard', dur: 3, cost: 2, lvl: 2, fx: 'shield',
        desc: 'Bram and the allies next to him are guarded for 3 turns: 35% less damage.' },
    smash: { name: 'Hearty Smash', kind: 'phys', tgt: 'foe', range: [1, 1], aoe: 0, power: 1.7, cost: 3, lvl: 3, fx: 'slash', desc: 'A big, apologetic wallop.' },
    // Mina
    zap: { name: 'Wand Zap', kind: 'mag', tgt: 'foe', range: [1, 2], aoe: 0, power: 0.9, cost: 0, lvl: 1, fx: 'sparkle', desc: 'A small, reliable zap.' },
    burst: { name: 'Sparkle Burst', kind: 'mag', tgt: 'foe', range: [2, 4], aoe: 1, power: 1.1, cost: 3, lvl: 2, fx: 'sparkle', desc: 'A burst of confetti-coloured magic that hits everything next to the target.' },
    lullaby: { name: 'Lullaby', kind: 'status', tgt: 'foe', range: [2, 3], aoe: 0, status: 'sleepy', dur: 2, cost: 2, lvl: 4, fx: 'zzz', desc: 'Puts one enemy to sleep. It skips its next turn unless something hurts it.' },
    starshower: { name: 'Star Shower', kind: 'mag', tgt: 'foe', range: [3, 5], aoe: 1, power: 1.6, cost: 6, lvl: 6, fx: 'stars', desc: 'Stars rain down on a patch of floor. Mina has read about this one. Twice.' },
    // Juniper
    whack: { name: 'Herb Whack', kind: 'mag', tgt: 'foe', range: [1, 1], aoe: 0, power: 0.8, cost: 0, lvl: 1, fx: 'leaf', desc: 'A gentle bonk with a bundle of rosemary.' },
    mend: { name: 'Mend', kind: 'heal', tgt: 'ally', range: [1, 3], aoe: 0, base: 8, power: 1.0, cost: 2, lvl: 1, fx: 'heal', desc: 'Heals one friend.' },
    tea: { name: 'Cup of Tea', kind: 'heal', tgt: 'ally', range: [1, 3], aoe: 1, base: 4, power: 0.7, status: 'regen', dur: 3, cost: 4, lvl: 3, fx: 'heal', desc: 'Heals friends in a small circle and leaves them cosy for 3 turns.' },
    bloom: { name: 'Blossom Bloom', kind: 'heal', tgt: 'self', range: [0, 0], aoe: 2, base: 5, power: 0.8, cost: 6, lvl: 6, fx: 'bloom', desc: 'Flowers burst up around Juniper and heal everyone within 2 tiles.' },
    // Fenn
    bow: { name: 'Bow', kind: 'phys', tgt: 'foe', range: [2, 4], aoe: 0, power: 1.0, cost: 0, lvl: 1, fx: 'arrow', desc: 'A clean shot from a distance.' },
    quick: { name: 'Quick Draw', kind: 'phys', tgt: 'foe', range: [2, 4], aoe: 0, power: 0.7, hits: 2, cost: 3, lvl: 4, fx: 'arrow', desc: 'Two arrows before the first one lands.' },
    volley: { name: 'Volley', kind: 'phys', tgt: 'foe', range: [3, 5], aoe: 1, power: 0.9, cost: 3, lvl: 6, fx: 'arrow', desc: 'A rain of arrows on a small area.' },
    // Pudge
    slam: { name: 'Clay Slam', kind: 'phys', tgt: 'foe', range: [1, 1], aoe: 0, power: 1.0, cost: 0, lvl: 1, fx: 'slash', desc: 'A heavy, friendly thump.' },
    stomp: { name: 'Stomp', kind: 'phys', tgt: 'foe', range: [0, 0], aoe: 1, centre: true, power: 1.1, cost: 3, lvl: 5, fx: 'stomp', desc: 'Pudge stamps; every enemy next to him is hit.' },
    harden: { name: 'Bake Hard', kind: 'buff', tgt: 'self', range: [0, 0], aoe: 0, status: 'guard', dur: 3, cost: 2, lvl: 6, fx: 'shield', desc: 'Pudge fires himself in the oven, as it were. Guarded for 3 turns.' },
    // Foes
    nibble: { name: 'Nibble', kind: 'phys', tgt: 'foe', range: [1, 1], aoe: 0, power: 1.0, cost: 0, lvl: 1, fx: 'slash', desc: '' },
    splat: { name: 'Splat', kind: 'mag', tgt: 'foe', range: [2, 3], aoe: 0, power: 1.0, cost: 0, lvl: 1, fx: 'ink', desc: '' },
    lash: { name: 'Thorn Lash', kind: 'phys', tgt: 'foe', range: [1, 1], aoe: 0, power: 1.0, cost: 0, lvl: 1, fx: 'leaf', desc: '' },
    peck: { name: 'Peck', kind: 'phys', tgt: 'foe', range: [1, 1], aoe: 0, power: 1.0, cost: 0, lvl: 1, fx: 'slash', desc: '' },
    poof: { name: 'Soot Poof', kind: 'mag', tgt: 'foe', range: [1, 2], aoe: 0, power: 0.9, cost: 0, lvl: 1, fx: 'soot', desc: '' },
    crumble: { name: 'Crumble Strike', kind: 'phys', tgt: 'foe', range: [1, 1], aoe: 0, power: 1.1, cost: 0, lvl: 1, fx: 'slash', desc: '' },
    smite: { name: 'Reluctant Smite', kind: 'phys', tgt: 'foe', range: [1, 2], aoe: 0, power: 1.25, cost: 0, lvl: 1, fx: 'smite', desc: '' },
    gust: { name: 'Gloom Gust', kind: 'mag', tgt: 'foe', range: [2, 3], aoe: 1, power: 1.0, cost: 3, lvl: 1, fx: 'soot', desc: '' },
};

// Everyone: hp, mp, atk, mag, def, res are [base, growth]; spd, move, jump are flat.
export const CLASSES = {
    pip: { name: 'Pip', full: 'Princess Pippa', role: 'Royal Apprentice', team: 'p', size: 1, hp: [26, 4], mp: [6, 1], atk: [7, 1.2], mag: [5, 1], def: [3, 0.8], res: [3, 0.8], spd: 9, move: 4, jump: 1,
        skills: ['scepter', 'decree', 'crown'], blurb: 'Heir to the throne of Brightmeadow, three weeks into her first term and already on a first-name basis with the infirmary. Hits hard when she hits, trips sometimes, and is learning that a queen is mostly someone who keeps showing up.' },
    bram: { name: 'Bram', full: 'Bram Oakenshield', role: 'Shield Cadet', team: 'p', size: 1.1, hp: [34, 5], mp: [4, 0.5], atk: [8, 1.4], mag: [2, 0.3], def: [6, 1], res: [3, 0.6], spd: 7, move: 3, jump: 1,
        skills: ['sword', 'shieldwall', 'smash'], blurb: 'A gentle giant who apologises to the sword before drawing it. Afraid of moths, brave about everything else. Knits his own scarves.' },
    mina: { name: 'Mina', full: 'Mina Quill', role: 'Library Mage', team: 'p', size: 1, hp: [20, 3], mp: [10, 1.5], atk: [3, 0.4], mag: [9, 1.6], def: [2, 0.5], res: [5, 1], spd: 8, move: 3, jump: 1,
        skills: ['zap', 'burst', 'lullaby', 'starshower'], blurb: 'Reads faster than she walks and speaks in footnotes. Her spells arrive with a surprising amount of confetti. Fragile, brilliant, and always carrying one more book than she can hold.' },
    juniper: { name: 'Juniper', full: 'Juniper Fern', role: 'Herb Healer', team: 'p', size: 1, hp: [24, 3.5], mp: [10, 1.5], atk: [4, 0.5], mag: [7, 1.3], def: [3, 0.7], res: [6, 1], spd: 8, move: 3, jump: 1,
        skills: ['whack', 'mend', 'tea', 'bloom'], blurb: 'Calm in every crisis and prepared for it with a flask. If a plant is nearby she is already talking to it. Keeps the party standing.' },
    fenn: { name: 'Fenn', full: 'Fenn Hollis', role: 'Rooftop Archer', team: 'p', size: 0.95, hp: [22, 3.5], mp: [5, 1], atk: [8, 1.4], mag: [3, 0.4], def: [3, 0.7], res: [3, 0.6], spd: 11, move: 4, jump: 2,
        skills: ['bow', 'quick', 'volley'], blurb: 'Lives on the roof and refuses to explain why. Never misses, hates being thanked, and has been secretly leaving snacks out for the crows.' },
    pudge: { name: 'Pudge', full: 'Pudge', role: 'Clay Golem', team: 'p', size: 1.15, hp: [42, 6], mp: [4, 0.5], atk: [7, 1.2], mag: [2, 0.3], def: [8, 1.2], res: [4, 0.8], spd: 4, move: 3, jump: 1,
        skills: ['slam', 'stomp', 'harden'], blurb: 'A golem who enrolled by accident and stayed on purpose. Slow, sturdy, and always hungry. Speaks in short sentences. Mostly about pie.' },
    // Foes
    bunny: { name: 'Dust Bunny', team: 'e', size: 0.9, hp: [14, 3], mp: [0, 0], atk: [5, 0.9], mag: [1, 0], def: [1, 0.4], res: [1, 0.3], spd: 8, move: 4, jump: 1, skills: ['nibble'], blurb: 'Fluffy, furious and about the size of a loaf.' },
    blot: { name: 'Ink Blot', team: 'e', size: 0.95, hp: [12, 2.5], mp: [0, 0], atk: [1, 0], mag: [6, 1.1], def: [0, 0.2], res: [2, 0.5], spd: 7, move: 3, jump: 1, skills: ['splat'], blurb: 'Escaped from a very dull book. Throws itself at you.' },
    thorn: { name: 'Thornling', team: 'e', size: 1, hp: [22, 3.5], mp: [0, 0], atk: [6, 1.1], mag: [1, 0], def: [3, 0.7], res: [2, 0.5], spd: 6, move: 3, jump: 1, skills: ['lash'], blurb: 'A hedge with opinions.' },
    crow: { name: 'Cheeky Crow', team: 'e', size: 0.9, fly: true, hp: [14, 2.8], mp: [0, 0], atk: [6, 1.1], mag: [1, 0], def: [2, 0.5], res: [2, 0.4], spd: 12, move: 5, jump: 9, skills: ['peck'], blurb: 'Took the bell. Wants to be asked nicely to give it back.' },
    sprite: { name: 'Soot Sprite', team: 'e', size: 0.85, hp: [11, 2.5], mp: [0, 0], atk: [2, 0.3], mag: [6, 1.1], def: [1, 0.3], res: [2, 0.5], spd: 10, move: 4, jump: 2, skills: ['poof'], blurb: 'Smells of toast. The Dread Lord\'s favourite minion, not that he would say so.' },
    scone: { name: 'Scone Knight', team: 'e', size: 1.1, hp: [30, 5], mp: [0, 0], atk: [8, 1.3], mag: [1, 0], def: [6, 1.1], res: [3, 0.6], spd: 5, move: 3, jump: 1, skills: ['crumble'], blurb: 'Rather stale. Rather proud. Crumbles with dignity.' },
    basil: { name: 'Dread Lord Basil', team: 'e', size: 1.35, boss: true, hp: [84, 6], mp: [6, 0], atk: [9, 1.5], mag: [8, 1.4], def: [5, 1], res: [5, 1], spd: 7, move: 3, jump: 2, skills: ['smite', 'gust'], blurb: 'The Dread Lord of the Underkitchens. Looks very frightening. Keeps apologising.' },
};

export const PARTY_ORDER = ['pip', 'bram', 'mina', 'juniper', 'fenn', 'pudge'];

export const SNACKS = {
    scone: { name: 'Honey Scone', desc: 'The whole party starts cheered: +25% damage for 4 turns.', status: 'cheer', dur: 4 },
    tart: { name: 'Berry Tart', desc: 'The whole party starts guarded: 35% less damage for 4 turns.', status: 'guard', dur: 4 },
    tea: { name: 'Mint Tea', desc: 'The whole party starts cosy for 5 turns, and gets +3 MP.', status: 'regen', dur: 5, mp: 3 },
};

// Each chapter: a map, who is on it, and the story around it.
// foes: [key, x, y, ai]  (ai: hunt = comes for you, guard = waits until you are close)
export const CHAPTERS = [
    {
        id: 'jitters', title: 'First Day Jitters', place: 'The Practice Yard', theme: 'yard', slots: 2,
        goal: 'Chase the dust bunnies out of the practice yard.',
        map: [
            'ww..,,,.',
            'w.f.,:,.',
            '..f.,,,.',
            '....s...',
            '~~..s.f.',
            '~~..s.ff',
            '....s...',
            '..w.s..w'],
        starts: [[1, 6], [2, 7], [3, 6], [3, 7], [1, 7]],
        foes: [['bunny', 6, 3, 'hunt'], ['bunny', 5, 1, 'hunt'], ['bunny', 6, 0, 'guard']],
        hint: 'Tap a blue tile twice to walk there. Tap a red-ringed enemy twice to attack it. Wait ends the turn.',
        pre: [
            ['narrator', 'In the Realm of Brightmeadow, every future queen must spend a year at Thistlewick Academy of Magic & Marching. Today, one of them is arriving.'],
            ['pip', 'Okay. Deep breath. Tiara straight, cape tucked, chin up. I am Princess Pippa of Brightmeadow and I am going to be a very great-'],
            ['narrator', '(Pip trips on the front steps and lands in a flowerbed.)'],
            ['pip', '-queen. Ow. Eventually.'],
            ['hazel', 'Welcome to Thistlewick, Your Highness. You took the shortcut, I see.'],
            ['pip', 'It was a very short shortcut.'],
            ['hazel', 'Class begins in the practice yard. A few dust bunnies have got in. Nothing sinister. Cadet Oakenshield will go with you.'],
            ['bram', 'H-hello, Your Highness. I brought a spare shield. And a spare spare shield.'],
            ['pip', 'Call me Pip! Come on, Bram. Time to prove ourselves!'],
        ],
        post: [
            ['bram', 'That was... a lot of fluff.'],
            ['pip', 'We did it! My first real battle! I only fell over twice.'],
            ['hazel', 'Three times. But well done. Dust bunnies do not usually travel in packs, though. Something is stirring beyond the Thistle Hills.'],
            ['hazel', 'Rumour says the Dread Lord Basil has woken in the Underkitchens. You will want friends, Princess. Try the library; there is a great deal of noise coming from it.'],
        ],
    },
    {
        id: 'library', title: 'The Library Incident', place: 'The Great Library', theme: 'library', slots: 3,
        goal: 'Clear the ink blots and find whoever is shouting from behind the reading desk.',
        map: [
            '#t.t.t.t#',
            '#..rrr..#',
            '...rrr...',
            '.t.....t.',
            '.........',
            '..t.r.t..',
            '.........',
            'ss.....ss'],
        starts: [[3, 7], [4, 7], [5, 7], [2, 7], [6, 7]],
        foes: [['blot', 3, 2, 'hunt'], ['blot', 4, 1, 'guard'], ['bunny', 0, 4, 'hunt'], ['bunny', 8, 4, 'guard']],
        guest: { key: 'mina', x: 4, y: 0, ask: 'Over here! Behind the desk!' },
        pre: [
            ['narrator', 'The library is full of the sound of something very dull escaping from a book.'],
            ['mina', '(from somewhere) Hello? Hello! If anyone can hear me, please do not touch the first editions. Footnote: please do touch the ink blots. With a sword.'],
            ['bram', 'Someone is trapped.'],
            ['pip', 'And someone needs rescuing! Brave heroes, ready? Bram, you stand in front. I will... stand behind you bravely.'],
        ],
        rescue: [
            ['mina', 'You came! I mean thank you. I mean, I was fine. I had a plan. The plan was shouting.'],
            ['pip', 'It was a good plan! I am Pip. This is Bram.'],
            ['mina', 'Mina Quill. I know exactly who you are, Your Highness; there is a chapter on your family. Come on, I owe these blots a lecture.'],
        ],
        post: [
            ['mina', 'Right. Footnote: I have read forty-one books about the Dread Lord Basil. None of them agree on anything. One says he eats moonlight.'],
            ['bram', 'I do not like the sound of that.'],
            ['mina', 'Another says he is "disappointed in everyone, mostly himself". I think that one is a typo.'],
            ['pip', 'Then we will find out. Mina, will you come with us?'],
            ['mina', '...Bring a lot of snacks. My spells use a lot of energy and I run on biscuits.'],
        ],
    },
    {
        id: 'garden', title: 'Maze of Thistles', place: 'The Hedge Garden', theme: 'garden', slots: 4,
        goal: 'Fight through the hedge garden and reach the gazebo.',
        map: [
            'w.f.,S,.fw',
            '..#.,,,.#.',
            '.f#.....#f',
            '....f.f...',
            '##.##.##.#',
            '....w.....',
            '.f.#...#f.',
            '...#.w.#..',
            'w..s.s.s..'],
        starts: [[2, 8], [4, 8], [6, 8], [5, 8], [3, 8]],
        foes: [['thorn', 5, 3, 'hunt'], ['thorn', 1, 5, 'guard'], ['thorn', 8, 5, 'guard'], ['blot', 3, 3, 'hunt'], ['blot', 7, 3, 'hunt']],
        guest: { key: 'juniper', x: 5, y: 0, ask: 'Mind the roses, dear!' },
        pre: [
            ['narrator', 'The academy gardens have been getting a little... assertive.'],
            ['mina', 'These hedges were not here yesterday. Footnote: hedges do not usually have faces.'],
            ['bram', 'Oh no. They have faces.'],
            ['juniper', '(from the gazebo, calmly) Hello! Don\'t mind me. I\'m having tea. The hedges have been rude, so I\'m waiting for them to calm down.'],
            ['pip', 'We\'re coming!'],
        ],
        rescue: [
            ['juniper', 'Lovely. Thank you, dears. Tea?'],
            ['bram', 'In the middle of a fight?'],
            ['juniper', 'Especially in the middle of a fight. I\'m Juniper. I look after people. Here: sit, drink, and let me worry about the scratches.'],
        ],
        post: [
            ['juniper', 'Poor things. They\'re only scared. Something in the cellars is warming up the whole garden and it\'s confusing the roots.'],
            ['pip', 'Warming up? The Dread Lord\'s castle is supposed to be cold and spooky.'],
            ['mina', 'The books do say that. Footnote: the books also say a lot of things.'],
            ['juniper', 'Whatever it is, I\'m coming. Somebody has to keep you from tripping into the thorns, Princess.'],
            ['pip', 'I do NOT trip. Much.'],
        ],
    },
    {
        id: 'roof', title: 'Rooftops & Rascals', place: 'The Bell Tower Roofs', theme: 'roof', slots: 4,
        goal: 'Get the academy bell back from the crows.',
        map: [
            '~~ZZZZZ~~',
            '~SSZZZSS~',
            'SSSSSSSSS',
            'S.S...S.S',
            '..s.s.s..',
            '.s.....s.',
            'ss.sss.ss',
            '.........'],
        starts: [[2, 7], [3, 7], [5, 7], [6, 7], [4, 7]],
        foes: [['crow', 2, 3, 'hunt'], ['crow', 6, 3, 'hunt'], ['crow', 1, 2, 'guard'], ['sprite', 4, 3, 'hunt'], ['sprite', 7, 2, 'guard'], ['crow', 7, 4, 'hunt'], ['sprite', 1, 4, 'guard']],
        guest: { key: 'fenn', x: 4, y: 0, ask: '...Don\'t look up.' },
        pre: [
            ['narrator', 'Someone has been ringing the bell tower at all hours. It is not a person.'],
            ['bram', 'The crows have taken the bell.'],
            ['mina', 'They like shiny things. Footnote: the bell is very shiny.'],
            ['juniper', 'There\'s somebody up there with them. I can see a hood.'],
            ['fenn', '(from the highest roof) Stop pointing at me. I\'m not here.'],
            ['pip', 'Hello! We\'re here to help!'],
            ['fenn', 'Nobody asked.'],
        ],
        rescue: [
            ['fenn', 'Fine. Fine! Look, I wasn\'t stuck. I was supervising.'],
            ['pip', 'Of course you were!'],
            ['fenn', 'I\'m Fenn. Don\'t thank me. The crows were leaving the bell alone until the gloom started. Now they won\'t even take the snacks I leave out. I mean. I don\'t leave snacks out.'],
        ],
        post: [
            ['fenn', 'There. The bell\'s back. The crows were stealing it because it\'s the only thing in Brightmeadow that still rings clean.'],
            ['mina', 'Rings clean?'],
            ['fenn', 'Everything else is muffled. Like there\'s a lid on the sky. It smells of smoke from the Underkitchens. And something like... cinnamon?'],
            ['pip', 'Cinnamon? From the Dread Lord\'s castle?'],
            ['fenn', 'I\'m coming with you. Not for you. For the crows.'],
        ],
    },
    {
        id: 'cellar', title: 'Cellar of Crumbs', place: 'The Academy Cellars', theme: 'cellar', slots: 4,
        goal: 'Fight your way down to the lowest pantry.',
        map: [
            '#t..ss..t#',
            '...t..t...',
            '.s......s.',
            '..#.tt.#..',
            '.t..ss..t.',
            '....ss....',
            '.s#....#s.',
            '..........'],
        starts: [[2, 7], [3, 7], [5, 7], [6, 7], [4, 7]],
        foes: [['scone', 3, 2, 'guard'], ['scone', 6, 2, 'guard'], ['sprite', 2, 4, 'hunt'], ['sprite', 7, 4, 'hunt'], ['thorn', 3, 5, 'hunt'], ['sprite', 4, 1, 'guard'], ['scone', 5, 5, 'hunt']],
        guest: { key: 'pudge', x: 4, y: 0, ask: 'Pie?' },
        pre: [
            ['narrator', 'Below the academy, the stairs keep going. There is a smell of warm bread, and it is deeply suspicious.'],
            ['juniper', 'That\'s not mildew. That\'s... yeast.'],
            ['bram', 'Scone Knights. They are very stale.'],
            ['mina', 'Footnote: stale scones are the Dread Lord\'s elite troops. Do not feel bad about hitting them.'],
            ['pudge', '(from the dark) ...Pie?'],
            ['pip', 'Did something just ask for pie?'],
        ],
        rescue: [
            ['pudge', 'Pudge. Hungry.'],
            ['pip', 'Pudge! I am Pip. We will find you a pie. A big one.'],
            ['pudge', 'Okay. Pudge help. Pudge hit things. Then pie.'],
            ['bram', 'I like him.'],
        ],
        post: [
            ['pudge', 'Pudge was in cellar a long time. Door at bottom. Warm. Smells good. Nobody scary.'],
            ['mina', 'Nobody scary? We have been fighting everything on the way down!'],
            ['pudge', 'Minions scary. Boss... sad.'],
            ['juniper', 'Sad? That\'s a strange thing for a dread lord to be.'],
            ['pip', 'Then we will find out why. Together. Team: ready?'],
            ['bram', 'Ready. I brought three spare shields.'],
        ],
    },
    {
        id: 'kitchens', title: 'The Gloomy Kitchens', place: 'The Underkitchens', theme: 'kitchen', slots: 5, final: true,
        goal: 'Face the Dread Lord Basil. Defeat him... or at least talk him round.',
        map: [
            '#t#,,,,#t#',
            '..,,::,,..',
            '..........',
            '.t..rr..t.',
            '..........',
            '..t....t..',
            '....rr....',
            '.t......t.',
            '..........'],
        starts: [[3, 8], [4, 8], [5, 8], [6, 8], [4, 7], [5, 7]],
        foes: [['basil', 5, 1, 'guard'], ['scone', 3, 3, 'hunt'], ['scone', 6, 3, 'hunt'], ['sprite', 2, 4, 'hunt'], ['sprite', 7, 4, 'hunt'], ['sprite', 4, 5, 'hunt']],
        pre: [
            ['narrator', 'The door at the bottom of the cellars is round, warm, and has a little brass plaque: "Staff Only. Please Knock."'],
            ['mina', 'Footnote: this is not what the books said.'],
            ['bram', 'Should we knock?'],
            ['pip', 'We\'re the heroes. We... kick it open. Bravely.'],
            ['narrator', '(Pip kicks it. It opens inward. Pip falls through.)'],
            ['basil', 'Ugh. Heroes. Sorry. One moment. (clears throat, sweeps cape) Behold! I am the Dread Lord Basil! Tremble, mortals! Et cetera!'],
            ['pip', 'You... are wearing an oven glove.'],
            ['basil', 'It\'s part of the look. Come on, then. Minions! Assemble! We will crush the princess! I think.'],
        ],
        midTalk: [
            { when: 'hp70', lines: [['basil', 'Please do not make me use the big attack. I haven\'t stretched.'], ['pip', 'You can stop whenever you like!'], ['basil', 'I cannot. I am an Overlord. It is a family business.']] },
        ],
        yield: [
            ['basil', 'Stop! Stop. Please. I yield. I\'m... out of breath, and my soufflé is collapsing.'],
            ['pip', 'Your... soufflé?'],
            ['basil', 'The gloom. The smoke over Brightmeadow. It\'s been my kitchens. I\'ve been trying to bake a proper brioche for forty years and the ovens vent up through your hills. I never meant to cause any of it.'],
            ['basil', 'I am a terrible Overlord. I hate it. I just want to cook. My mother ran the Underkitchens as a fortress, and then it became a family tradition, and I never had the heart to say.'],
            ['mina', 'That explains the cinnamon.'],
            ['pudge', 'Pie?'],
            ['basil', 'There... may be a pie.'],
            ['pip', 'Basil. I came here to prove I could be a queen. I tripped a lot. I think I\'ve learned that a good queen is mostly someone who stops, listens, and helps. So: let us help.'],
            ['pip', 'Come to Thistlewick. Open a cooking school. We have a very big, very empty kitchen, and a lot of students who run on biscuits.'],
            ['basil', '...Really? You would let the Dread Lord Basil near your oven?'],
            ['pip', 'I would let Chef Basil near it. Oven gloves and all.'],
        ],
        post: [],
    },
];

export const ENDING = [
    ['narrator', 'A season later, the smoke over Brightmeadow has gone. In its place there is a smell of warm bread, drifting from a round door under the old academy.'],
    ['narrator', 'The sign reads: THISTLEWICK COOKING SCHOOL. Founded by a Dread Lord, a Princess, and a very stale scone. Everyone Welcome. Please Knock.'],
    ['basil', 'Today\'s lesson is brioche. Mina, you will not set the dough on fire. Footnote: you will not. Please.'],
    ['mina', 'Footnote accepted!'],
    ['bram', 'I knitted everyone oven mitts. I knitted spare oven mitts.'],
    ['juniper', 'I\'ve brought the herbs. And the tea. And a second kettle.'],
    ['fenn', 'I\'m only here to taste-test. ...This is very good. Don\'t tell anyone.'],
    ['pudge', 'Pie.'],
    ['pip', 'Is this too much cinnamon? It\'s a bit... black.'],
    ['basil', 'Princess, that is not a brioche, that is a charcoal brick. But it is the finest charcoal brick I have ever seen.'],
    ['hazel', 'Queen Maribel has sent word. She says she is proud of you, and that she is coming for lunch, and that she would like the brick.'],
    ['pip', 'She... wants the brick?'],
    ['hazel', 'It is, she says, what a queen looks like when she is learning.'],
    ['narrator', 'And so, Princess Pippa of Brightmeadow did not become queen that year. But she did become a very good friend, a decent baker, and the person you would most want next to you in a hard place. Which, the books say, is the same thing.'],
    ['narrator', 'THE END. (Eventually: Queen Pip the Clumsy, the Kind. Forty years later. With a very good bakery.)'],
];

export const TITLE_BLURB = 'A cosy tactics story about a clumsy princess, a school of magic and marching, and a very reluctant Dread Lord.';
