// Folio & Fable — the content tables. Pure data, shared by the sim, the bot, the view and the tests.
// Numbers that tune the economy are in ../config.js; this is what things are.

// ------------------------------------------------------------------ virtues
// Every book carries points in one to three virtues. Sold to townsfolk, the points inspire the town; carried by
// an adventurer, they add to the party's power; read by Tam, they teach her.
export const VIRTUES = {
    valor: { name: 'Valor', icon: '⚔️', color: '#c4503c', blurb: 'courage for heroes and dreamers' },
    wit: { name: 'Wit', icon: '🦉', color: '#3f6fb0', blurb: 'cleverness, craft and learning' },
    hearth: { name: 'Hearth', icon: '🍞', color: '#d4943a', blurb: 'home, food and comfort' },
    charm: { name: 'Charm', icon: '🌹', color: '#c45a8a', blurb: 'grace, romance and the stage' },
    wonder: { name: 'Wonder', icon: '✨', color: '#7b5cc4', blurb: 'magic, stars and the unknown' },
};
export const VIRTUE_IDS = Object.keys(VIRTUES);

// ------------------------------------------------------------------ book kinds (genres; also the bindery's patterns)
export const KINDS = {
    cookbook: { name: 'Cookbook', icon: '🍲', virtues: ['hearth', 'charm'], shape: { h: 0.95, w: 0.8, t: 0.22 } },
    novel: { name: 'Novel', icon: '📖', virtues: ['valor', 'charm', 'wonder'], shape: { h: 1.0, w: 0.66, t: 0.26 } },
    poetry: { name: 'Poetry', icon: '🪶', virtues: ['charm', 'wonder'], shape: { h: 0.82, w: 0.62, t: 0.13 } },
    manual: { name: 'Skill Manual', icon: '🛠️', virtues: ['wit', 'valor'], shape: { h: 0.92, w: 0.7, t: 0.2 } },
    bestiary: { name: 'Bestiary', icon: '🐉', virtues: ['valor', 'wit'], shape: { h: 1.08, w: 0.76, t: 0.3 } },
    atlas: { name: 'Atlas', icon: '🧭', virtues: ['wonder', 'wit'], shape: { h: 1.22, w: 0.86, t: 0.14 } },
    almanac: { name: 'Almanac', icon: '🌾', virtues: ['hearth', 'wit'], shape: { h: 0.9, w: 0.68, t: 0.18 } },
    grimoire: { name: 'Grimoire', icon: '🔮', virtues: ['wonder', 'wit'], shape: { h: 1.1, w: 0.78, t: 0.36 } },
};
export const KIND_IDS = Object.keys(KINDS);

export const RARITY = [
    { id: 'common', name: 'Common', color: '#9a8f7e', points: 2, value: 8, stats: 1 },
    { id: 'uncommon', name: 'Uncommon', color: '#4f9a5a', points: 4, value: 16, stats: 2 },
    { id: 'rare', name: 'Rare', color: '#3f78c4', points: 6, value: 34, stats: 2 },
    { id: 'epic', name: 'Epic', color: '#8a4fc4', points: 9, value: 75, stats: 3 },
    { id: 'legendary', name: 'Legendary', color: '#d09a2a', points: 13, value: 160, stats: 3 },
];

// ------------------------------------------------------------------ skills
// who: 'adv' works while an adventurer carries the book; 'player' is learned for good when Tam reads it.
export const SKILLS = {
    pathfinding: { name: 'Pathfinding', who: 'adv', desc: 'Expeditions take a day less (never under one).' },
    lockpicking: { name: 'Lockpicking', who: 'adv', desc: 'One more find from every expedition.' },
    swimming: { name: 'Swimming', who: 'adv', desc: '+4 power in the Sunken Archive.' },
    dragontongue: { name: 'Dragon-Tongue', who: 'adv', desc: '+5 power in the Dragon\'s Attic.' },
    starlore: { name: 'Starlore', who: 'adv', desc: '+5 power at Starfall Observatory.' },
    campfire: { name: 'Campfire Cooking', who: 'adv', desc: '+2 power on every expedition.' },
    appraisal: { name: 'Appraisal', who: 'player', desc: 'The trader\'s prices are 15% lower.' },
    silvertongue: { name: 'Silver Tongue', who: 'player', desc: 'Every sale pays 15% more.' },
    finebinding: { name: 'Fine Binding', who: 'player', desc: 'Gold leaf and star fragments lift a crafted book\'s rarity more often.' },
    gilding: { name: 'Gilding', who: 'player', desc: 'Rebinding costs no gold.' },
    whispering: { name: 'Whispering', who: 'player', desc: 'Talking books give you a small gift once a day.' },
    cozykeeping: { name: 'Cozy Keeping', who: 'player', desc: '+4 coziness in the shop.' },
};
export const SKILL_IDS = Object.keys(SKILLS);
// Which skills a book of each kind can teach.
export const KIND_SKILLS = {
    cookbook: ['campfire', 'cozykeeping'],
    novel: ['silvertongue', 'campfire'],
    poetry: ['silvertongue', 'cozykeeping'],
    manual: SKILL_IDS,
    bestiary: ['dragontongue', 'lockpicking'],
    atlas: ['pathfinding', 'starlore', 'swimming'],
    almanac: ['appraisal', 'cozykeeping', 'pathfinding'],
    grimoire: ['whispering', 'starlore', 'finebinding'],
};

// ------------------------------------------------------------------ materials (icon = index in art/mat-*.webp)
// cover: the base of a crafted book (like a weapon's blade): its tier sets the starting rarity.
// ink: its element: the book's main virtue. accent: like a gem in a socket, up to two per book.
export const MATERIALS = {
    paper: { name: 'Paper Boards', type: 'cover', tier: 1, price: 3, icon: 0 },
    leather: { name: 'Calfskin Leather', type: 'cover', tier: 2, price: 8, icon: 1 },
    oak: { name: 'Brass-Capped Oak', type: 'cover', tier: 3, price: 18, icon: 2 },
    dragonhide: { name: 'Dragon Scale', type: 'cover', tier: 4, price: 45, icon: 3 },
    ink: { name: 'Midnight Ink', type: 'ink', virtue: 'wit', price: 4, icon: 4 },
    ember: { name: 'Ember Ink', type: 'ink', virtue: 'valor', price: 6, icon: 5 },
    honey: { name: 'Honey Ink', type: 'ink', virtue: 'hearth', price: 5, icon: 6 },
    rose: { name: 'Rose Ink', type: 'ink', virtue: 'charm', price: 6, icon: 7 },
    moon: { name: 'Moonlight Ink', type: 'ink', virtue: 'wonder', price: 12, icon: 8 },
    gold: { name: 'Gold Leaf', type: 'accent', price: 15, icon: 9, desc: 'May lift the rarity one step; worth more.' },
    clasp: { name: 'Silver Clasp', type: 'accent', price: 10, icon: 10, desc: '+2 to the main virtue.' },
    flower: { name: 'Pressed Violet', type: 'accent', price: 5, icon: 11, desc: '+2 Charm.' },
    star: { name: 'Star Fragment', type: 'accent', price: 40, icon: 12, desc: '+3 Wonder; may lift the rarity one step.' },
    feather: { name: 'Phoenix Feather', type: 'accent', price: 30, icon: 13, desc: '+3 Valor and teaches a skill.' },
    thread: { name: 'Silver Thread', type: 'accent', price: 8, icon: 14, desc: '+1 to every virtue the book has.' },
    seal: { name: 'Wax Seal', type: 'accent', price: 12, icon: 15, desc: 'Seals a skill into the pages.' },
};
export const MATERIAL_IDS = Object.keys(MATERIALS);

// The final book of the story. Crafted like any other, but only from exactly these.
export const MASTERWORK = {
    id: 'larkspur', name: 'The Book of Larkspur', kind: 'grimoire',
    cover: 'dragonhide', ink: 'moon', accents: ['star', 'gold'],
};

// ------------------------------------------------------------------ furniture (sprite = index in art/furniture)
// row 'wall' goes on the back wall, 'floor' stands in front of it. cap: how many books it holds.
export const FURNITURE = {
    shelf: { name: 'Bookshelf', row: 'wall', cost: 25, cap: 12, cozy: 0, sprite: 0, desc: 'Holds twelve books. Four of one kind make a section customers love.' },
    painting: { name: 'Dragon Painting', row: 'wall', cost: 20, cozy: 2, sprite: 6, desc: 'Cozy +2, and the shelves beside it catch the eye.' },
    ivy: { name: 'Hanging Ivy', row: 'wall', cost: 12, cozy: 2, sprite: 7, desc: 'Cozy +2, and the shelves beside it catch the eye.' },
    table: { name: 'Display Table', row: 'floor', cost: 20, cap: 3, cozy: 1, sprite: 1, desc: 'Shows off three books. Featured books sell more easily.' },
    armchair: { name: 'Reading Armchair', row: 'floor', cost: 30, cozy: 3, sprite: 2, desc: 'Cozy +3. Customers by it linger and buy more.' },
    lamp: { name: 'Fringed Lamp', row: 'floor', cost: 15, cozy: 2, sprite: 3, desc: 'Cozy +2, and the shelf behind it glows.' },
    fern: { name: 'Potted Fern', row: 'floor', cost: 10, cozy: 2, sprite: 4, desc: 'Cozy +2.' },
    cat: { name: 'Cat Basket', row: 'floor', cost: 40, cozy: 4, sprite: 5, unique: true, desc: 'Cozy +4. A ginger cat moves in. Everyone stays a little longer.' },
};
export const FURNITURE_IDS = Object.keys(FURNITURE);

// ------------------------------------------------------------------ customers (sprite = index in art/folk)
export const FOLK = {
    adventurer: { name: 'Adventurer', kinds: ['bestiary', 'atlas', 'manual'], virtues: ['valor', 'wonder'], budget: 1.0, sprite: 0 },
    noble: { name: 'Noble', kinds: ['poetry', 'novel'], virtues: ['charm'], budget: 1.8, sprite: 1 },
    actor: { name: 'Actor', kinds: ['novel', 'poetry'], virtues: ['charm', 'valor'], budget: 1.2, sprite: 2 },
    cook: { name: 'Baker', kinds: ['cookbook', 'almanac'], virtues: ['hearth'], budget: 1.0, sprite: 3 },
    shopkeeper: { name: 'Shopkeeper', kinds: ['almanac', 'manual', 'cookbook'], virtues: ['wit', 'hearth'], budget: 1.1, sprite: 4 },
    scholar: { name: 'Scholar', kinds: ['grimoire', 'atlas', 'manual'], virtues: ['wit', 'wonder'], budget: 1.4, sprite: 5 },
    farmer: { name: 'Farmer', kinds: ['almanac', 'cookbook'], virtues: ['hearth', 'wit'], budget: 0.9, sprite: 6 },
    child: { name: 'Child', kinds: ['novel', 'bestiary'], virtues: ['wonder', 'valor'], budget: 0.7, sprite: 7 },
};
export const FOLK_IDS = Object.keys(FOLK);
export const FOLK_NAMES = {
    adventurer: ['Tobin', 'Bryn', 'Kestrel', 'Arlo', 'Wynn', 'Dace'],
    noble: ['Lady Primrose', 'Duchess Amaryllis', 'Lord Fennick', 'Countess Brielle'],
    actor: ['Florian', 'Marisol', 'Percival', 'Ottilie', 'Jasper'],
    cook: ['Baker Bun', 'Mrs. Crumb', 'Hob the Cook', 'Nettie Loaf'],
    shopkeeper: ['Mr. Pennywhistle', 'Greta Spool', 'Old Barnaby', 'Mabel Thimble'],
    scholar: ['Professor Owlbury', 'Sage Ilsabet', 'Master Corvin', 'Doctor Quill'],
    farmer: ['Farmer Hazel', 'Rowan Haystack', 'Bess Turnip', 'Ned Furrow'],
    child: ['Little Pip', 'Wren-the-small', 'Dot', 'Milo', 'Poppy'],
};
// What they say when they bring a request, keyed by what they're after.
export const REQUEST_REASONS = {
    adventurer: ['for the road to the mountains', 'before my first real quest', 'so I stop getting lost'],
    noble: ['to read aloud at my salon', 'for my dreadfully bored niece', 'to impress the Duchess'],
    actor: ['for our next play', 'to find a role worth playing', 'to learn my lines with feeling'],
    cook: ['for the harvest feast', 'because my buns have gone dull', 'for a new pie recipe'],
    shopkeeper: ['to keep my ledgers tidy', 'to fix my squeaky cart', 'for the long winter evenings'],
    scholar: ['for my thesis on the stars', 'to settle a bet with the abbot', 'for my research'],
    farmer: ['before the rains come', 'for my pumpkin patch', 'to read to the goats'],
    child: ['for bedtime', 'because Grandpa snores', 'to be brave like a knight'],
};

// ------------------------------------------------------------------ adventurers (portrait = index in art/heroes)
export const HEROES = {
    rook: { name: 'Rook', role: 'Young Knight', stats: { valor: 3, wit: 1, wonder: 0 }, skill: null, hire: 0, portrait: 0, line: 'Point me at the danger! Politely, please.' },
    fen: { name: 'Fen', role: 'Elf Ranger', stats: { valor: 2, wit: 1, wonder: 2 }, skill: 'pathfinding', hire: 60, portrait: 1, line: 'The woods remember every story. I listen.' },
    juniper: { name: 'Juniper', role: 'Halfling Rogue', stats: { valor: 1, wit: 3, wonder: 1 }, skill: 'lockpicking', hire: 90, portrait: 2, line: 'A locked chest is just a book that hasn\'t been opened yet.' },
    maris: { name: 'Maris', role: 'Tidecaller', stats: { valor: 1, wit: 2, wonder: 3 }, skill: 'swimming', hire: 120, portrait: 3, line: 'The sea keeps the best libraries.' },
};
export const HERO_IDS = Object.keys(HEROES);

// ------------------------------------------------------------------ expedition places (art = index in art/place-*)
// need: the party power for a sure thing. virtue: what counts most. bonus: a skill that helps here.
export const PLACES = {
    woods: {
        name: 'Whispering Woods', need: 4, days: 1, virtues: ['valor', 'wonder'], unlock: { start: true }, art: 0,
        mats: ['paper', 'paper', 'leather', 'flower', 'honey', 'ink'], kinds: ['almanac', 'bestiary', 'cookbook', 'poetry'], rarity: [0, 1],
        blurb: 'Paper-leaf trees that rustle like turning pages. Gentle, and full of strays.',
    },
    market: {
        name: 'Lantern Market', need: 6, days: 1, virtues: ['wit', 'valor'], unlock: { start: true }, art: 1,
        mats: ['ink', 'rose', 'thread', 'paper', 'leather', 'ember'], kinds: ['novel', 'poetry', 'cookbook', 'manual'], rarity: [0, 2],
        blurb: 'A night market under floating lanterns. Haggling takes wits.',
    },
    archive: {
        name: 'Sunken Archive', need: 10, days: 2, virtues: ['wit', 'wonder'], bonus: 'swimming', unlock: { renown: 6 }, art: 2,
        mats: ['moon', 'clasp', 'ink', 'oak', 'seal'], kinds: ['manual', 'atlas', 'grimoire', 'almanac'], rarity: [1, 2],
        blurb: 'A drowned library where fish read over your shoulder.',
    },
    scriptorium: {
        name: 'Moonlit Scriptorium', need: 14, days: 2, virtues: ['wonder', 'wit'], unlock: { renown: 16 }, art: 3,
        mats: ['gold', 'moon', 'seal', 'oak', 'thread'], kinds: ['grimoire', 'poetry', 'manual', 'novel'], rarity: [1, 3],
        blurb: 'Monks who copy books by moonlight, and trade the spares.',
    },
    attic: {
        name: 'Dragon\'s Attic', need: 19, days: 3, virtues: ['valor', 'charm'], bonus: 'dragontongue', unlock: { renown: 30 }, art: 4,
        mats: ['dragonhide', 'ember', 'gold', 'feather', 'dragonhide'], kinds: ['bestiary', 'novel', 'atlas', 'cookbook'], rarity: [2, 3],
        blurb: 'A sleepy dragon who hoards books instead of gold. Mostly.',
    },
    observatory: {
        name: 'Starfall Observatory', need: 26, days: 3, virtues: ['wonder', 'valor'], bonus: 'starlore', unlock: { chapter: 6 }, art: 5,
        mats: ['star', 'moon', 'feather', 'star', 'gold'], kinds: ['atlas', 'grimoire', 'poetry'], rarity: [2, 4],
        blurb: 'Where falling stars land, and the sky keeps its diary.',
    },
};
export const PLACE_IDS = Object.keys(PLACES);

// ------------------------------------------------------------------ the town of Larkspur (art = index in art/town-*)
// Sold books pour their virtues into the town. Each threshold inspires something new.
export const INSPIRATIONS = [
    { id: 'guild', virtue: 'valor', need: 70, art: 0, name: 'The Guild Takes Heart', text: 'Young heroes crowd the guild hall, quoting your bestiaries. Juniper the rogue wants to join you, the bindery learns the Bestiary pattern, and every expedition gets +1 power.' },
    { id: 'school', virtue: 'wit', need: 70, art: 1, name: 'The Schoolhouse Reopens', text: 'The old schoolhouse rings with spelling bees. Children start visiting, and the bindery learns the Atlas pattern.' },
    { id: 'bakery', virtue: 'hearth', need: 70, art: 2, name: 'The Bakery\'s New Bun', text: 'Baker Bun tried a recipe from one of your cookbooks. The whole town follows its nose to your street: one more customer every day.' },
    { id: 'theatre', virtue: 'charm', need: 70, art: 3, name: 'Opening Night', text: 'The playhouse stages a novel you sold. Your name is in the programme: +1 renown every day, and the bindery learns the Poetry pattern.' },
    { id: 'tower', virtue: 'wonder', need: 70, art: 4, name: 'Lights over the Tower', text: 'The old stargazer has her telescope working again. Ottoline brings one more rare book on every visit.' },
    { id: 'guild2', virtue: 'valor', need: 200, art: 0, name: 'Heroes of Larkspur', text: 'Songs are sung about your adventurers. Every expedition gets +2 more power.' },
    { id: 'school2', virtue: 'wit', need: 200, art: 1, name: 'The Little Library', text: 'The children built a library of their own. Your binding improves: +1 to every crafted book\'s virtues.' },
    { id: 'bakery2', virtue: 'hearth', need: 200, art: 2, name: 'The Feast of Pages', text: 'A feast in your honour. Two more customers every day.' },
    { id: 'garden', virtue: 'charm', need: 200, art: 5, name: 'The Duchess\'s Garden Party', text: 'The Duchess becomes your patron: 15 gold every morning.' },
    { id: 'tower2', virtue: 'wonder', need: 200, art: 4, name: 'The Sky Remembers', text: 'The stars themselves seem to read. Gold leaf and star fragments lift crafted books more often.' },
];

// ------------------------------------------------------------------ story (Old Vellum's chapters)
// goal(G) reads only counters and state. Rewards are applied by the sim when the chapter is done.
export const CHAPTERS = [
    {
        n: 1, name: 'Dust and Daylight',
        goal: 'Put books on the shelves, open the shop and sell 3 books.', counter: 'sold', target: 3,
        intro: 'Welcome home, child. Elowen kept this shop forty years, and she wanted it to go on. Dust the shelves, set out her books, and open the door. Larkspur has been waiting.',
        done: 'Three books found new homes! Do you feel it? Every book you sell changes someone a little. An old friend of Elowen\'s will come by in the morning. He has been waiting for work.',
    },
    {
        n: 2, name: 'Words That Wander',
        goal: 'Send Rook on an expedition and welcome him home.', counter: 'expeditions', target: 1,
        intro: 'Rook the knight used to fetch books for Elowen from the wild places. Give him a book to carry for courage, and send him out. Books are found, child, not just sold.',
        done: 'He came back with treasures! And look at the leather and paper. The bindery in the back room has been asleep since Elowen left. Shall we wake it?',
    },
    {
        n: 3, name: 'The Bindery Wakes',
        goal: 'Craft a book at the bindery.', counter: 'crafted', target: 1,
        intro: 'A cover for its body, an ink for its heart, and a little something extra for its soul. That is all a book is. Go on: make one.',
        done: 'Your very first book! It is a little wonky. So was Elowen\'s. I\'ll teach you the Skill Manual pattern: books that teach.',
    },
    {
        n: 4, name: 'A Town That Reads',
        goal: 'Answer 4 customer requests or commissions.', counter: 'requests', target: 4,
        intro: 'Some customers come with a wish: a cookbook with real heart, a novel for a nervous actor. Find them the right book, or take their wish as a commission and find it later.',
        done: 'The town is talking about you! Even the travelling trader has heard. Ottoline will stop by every third morning with books from far away.',
    },
    {
        n: 5, name: 'Whispers in the Margins',
        goal: 'Find a book that talks, and talk with it.', counter: 'talked', target: 1,
        intro: 'I am not the only book with something to say. Rare grimoires sometimes wake up. Ottoline has one, I am sure of it. Or your adventurers might stumble on one.',
        done: 'You heard it! Then you have the gift, child: Whispering. Talking books will give you little presents now. And you may bind grimoires of your own.',
    },
    {
        n: 6, name: 'Larkspur Awakens',
        goal: 'Inspire the town 3 times.', counter: 'inspired', target: 3,
        intro: 'Look out of the window: the baker hums. The actors rehearse. Books do that. Keep putting the right ones in the right hands, and watch the town wake up.',
        done: 'Three wonders in one little town! Now I can tell you Elowen\'s last secret. On Starfall Mountain there is an observatory where the stars come down to rest. She meant to go. She never did.',
    },
    {
        n: 7, name: 'The Last Chapter',
        goal: 'Bind The Book of Larkspur: Dragon Scale, Moonlight Ink, a Star Fragment and Gold Leaf.', counter: 'masterwork', target: 1,
        intro: 'Elowen spent her last winter writing the story of this town: every reader, every shop, every book. She never bound it. Dragon scale for the cover, moonlight for the ink, a star for its soul and gold for its edges. Bind it, Tam.',
        done: 'There. Can you see her? She is smiling. The shop is yours, Tam, and so is the story. It will never really end, you know. Good stories don\'t.',
    },
];

// Old Vellum's little remarks between chapters (text; the voiced ones are in audio.js).
export const VELLUM_TIPS = [
    'Four books of one kind on a shelf make a section. Customers adore a section.',
    'A lamp or a plant beside a shelf makes it glow. Customers notice glowing shelves.',
    'Give an adventurer a book to carry. Its virtues become their courage.',
    'A request you cannot answer today can be a commission. People are patient in Larkspur.',
    'Read a book each evening. Skill manuals teach you things that stay.',
    'Rebinding a favourite book makes it stronger, like polishing a sword.',
    'The cat does nothing useful. Everyone loves her anyway.',
];

// Talking books: each wakes with a personality. {t} is its own title.
export const VOICES = {
    grumpy: { name: 'grumpy', lines: ['Hmph. Mind the spine.', 'I was shelved next to a cookbook for ninety years. Ninety!', 'Read me properly or not at all.', 'Fine. You may turn ONE page.'] },
    poetic: { name: 'poetic', lines: ['Oh, the light today is the colour of a margin note!', 'Every reader is a door, and every door a dawn.', 'Hush. Listen. The shelves are breathing.', 'I dreamt I was a sonnet once.'] },
    giggly: { name: 'giggly', lines: ['Hee! That tickles! Page forty-two is ticklish!', 'Do you know any jokes? I know eleven. All about owls.', 'Psst. The atlas fancies the almanac.', 'Wheee, turn me faster!'] },
    pompous: { name: 'pompous', lines: ['I, {t}, was once read aloud to a king.', 'Do mind the gilt. It is real, you know.', 'A first edition. Naturally.', 'One does not simply skim me.'] },
    sleepy: { name: 'sleepy', lines: ['Mmh? Is it morning? Five more chapters…', 'Zzz… the dragon… returns the… library book…', 'I was dreaming in footnotes.', 'Read me a little softer, would you?'] },
    salty: { name: 'salty', lines: ['Yo-ho! I sailed the Inky Sea, I did!', 'Batten down the bookmarks!', 'Smells like low tide in here. Lovely.', 'Every story needs a storm, lass.'] },
};
export const VOICE_IDS = Object.keys(VOICES);
