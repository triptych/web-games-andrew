// The Lounge's menu, its memory, and the lines the characters use about it
// in Messages. Shared by the Lounge screen (./lounge.js) and the messenger
// (./messages.js), so it imports neither.
//
// What the console remembers is in localStorage `console.lounge`:
//   served  { id: { t, item, q, thanked } }  the last thing you made each friend
//   orders  { id: { item, t, via } }         a friend asked for something (via 'msg' or 'invite')
//   count   drinks and plates served, all time
//   best    { item: stars }                  your best for each menu item
//   seen    the last time you opened the Lounge

export const LOUNGE_KEY = 'console.lounge';
const HOUR = 36e5;

/** Everything on the shelf behind the bar. */
export const INGREDIENTS = [
    { id: 'beans', name: 'Coffee beans', icon: '🫘' },
    { id: 'water', name: 'Hot water', icon: '💧' },
    { id: 'leaves', name: 'Tea leaves', icon: '🍃' },
    { id: 'milk', name: 'Milk', icon: '🥛' },
    { id: 'ice', name: 'Ice', icon: '🧊' },
    { id: 'fizz', name: 'Fizzy water', icon: '🫧' },
    { id: 'berries', name: 'Berries', icon: '🍓' },
    { id: 'orange', name: 'Orange', icon: '🍊' },
    { id: 'lemon', name: 'Lemon', icon: '🍋' },
    { id: 'honey', name: 'Honey', icon: '🍯' },
    { id: 'cocoa', name: 'Cocoa', icon: '🍫' },
    { id: 'cream', name: 'Cream', icon: '🍦' },
    { id: 'flour', name: 'Flour', icon: '🌾' },
    { id: 'bread', name: 'Bread', icon: '🍞' },
    { id: 'cheese', name: 'Cheese', icon: '🧀' },
    { id: 'greens', name: 'Greens', icon: '🥬' },
];

/**
 * The menu. steps: the ingredients in order; finish: the timing step at the
 * end (its verb names the button), and what it says on the sweet spot.
 */
export const MENU = [
    { id: 'coffee', name: 'Coffee', a: 'a', icon: '☕', steps: ['beans', 'water'], finish: 'Brew', kind: 'drink' },
    { id: 'tea', name: 'Green tea', a: 'a', icon: '🍵', steps: ['leaves', 'water', 'honey'], finish: 'Steep', kind: 'drink' },
    { id: 'boba', name: 'Bubble tea', a: 'a', icon: '🧋', steps: ['leaves', 'milk', 'ice'], finish: 'Shake', kind: 'drink' },
    { id: 'cocoa', name: 'Hot cocoa', a: 'a', icon: '♨️', steps: ['cocoa', 'milk', 'cream'], finish: 'Stir', kind: 'drink' },
    { id: 'soda', name: 'Berry soda', a: 'a', icon: '🥤', steps: ['fizz', 'berries', 'ice'], finish: 'Shake', kind: 'drink' },
    { id: 'punch', name: 'Sunrise punch', a: 'a', icon: '🍹', steps: ['orange', 'berries', 'ice'], finish: 'Shake', kind: 'drink' },
    { id: 'lemonade', name: 'Lemonade', a: 'a', icon: '🍋', steps: ['lemon', 'water', 'honey'], finish: 'Stir', kind: 'drink' },
    { id: 'float', name: 'Ice cream float', a: 'an', icon: '🍨', steps: ['fizz', 'cream'], finish: 'Pour', kind: 'drink' },
    { id: 'cake', name: 'Strawberry shortcake', a: 'a', icon: '🍰', steps: ['flour', 'cream', 'berries'], finish: 'Plate', kind: 'food' },
    { id: 'cookie', name: 'Honey cookie', a: 'a', icon: '🍪', steps: ['flour', 'honey', 'milk'], finish: 'Bake', kind: 'food' },
    { id: 'sandwich', name: 'Cheese sandwich', a: 'a', icon: '🥪', steps: ['bread', 'cheese', 'greens'], finish: 'Toast', kind: 'food' },
];

export const itemOf = (id) => MENU.find((m) => m.id === id) || MENU[0];
export const ingredientOf = (id) => INGREDIENTS.find((x) => x.id === id);

/** A stable number for a string (the same friend always has the same favourite). */
export function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}

/** Each character's favourite: picked from words in its character sheet when one fits, else by its id. */
export function favOf(id, d = null) {
    const text = `${d?.portrait?.subject || ''} ${d?.bio || ''} ${d?.role || ''}`.toLowerCase();
    const hints = [
        ['tea', /\b(tea|herbal|herb|monk|witch|grandmother|gran|granny)\b/],
        ['cocoa', /\b(snow|frost|winter|parka|christmas|elf|cozy|cosy)\b/],
        ['coffee', /\b(detective|pilot|commander|captain|engineer|mechanic|radio|dj|controller)\b/],
        ['cake', /\b(princess|baker|bakery|cupcake|crumpet|king)\b/],
        ['cookie', /\b(gingerbread|cookie|kid|baby)\b/],
        ['sandwich', /\b(soldier|knight|warrior|fighter|dwarf|miner|worker|adventurer)\b/],
        ['punch', /\b(pirate|jungle|tropical|sun|beach)\b/],
        ['soda', /\b(80s|neon|arcade|synthwave|disco|retro)\b/],
        ['boba', /\b(anime|cyber|pixel|robot|ai)\b/],
        ['lemonade', /\b(fairy|sprite|flower|garden|florist|bee)\b/],
    ];
    const hit = hints.filter(([, re]) => re.test(text));
    if (hit.length) return hit[hash(id) % hit.length][0];
    return MENU[hash(id) % MENU.length].id;
}

/** "a ☕ coffee" style names for messages. */
export const itemWords = (item, { article = false } = {}) => {
    const m = itemOf(item);
    return `${article ? `${m.a} ` : ''}${m.icon} ${m.name.toLowerCase()}`;
};

// ---------------------------------------------------------------- memory

function fresh() {
    return { v: 1, served: {}, orders: {}, count: 0, best: {}, seen: 0 };
}

let fallback = null;

export function loungeState() {
    try {
        const v = JSON.parse(localStorage.getItem(LOUNGE_KEY) || 'null');
        if (v && v.v === 1) {
            for (const k of ['served', 'orders', 'best']) if (!v[k] || typeof v[k] !== 'object') v[k] = {};
            return v;
        }
    } catch {
        /* blocked or broken: start fresh */
    }
    return fallback || (fallback = fresh());
}

export function saveLounge(s) {
    fallback = s;
    try {
        localStorage.setItem(LOUNGE_KEY, JSON.stringify(s));
    } catch {
        /* kept in memory */
    }
}

/** Change the stored state and keep it. */
export function updateLounge(fn) {
    const s = loungeState();
    fn(s);
    saveLounge(s);
    return s;
}

/** A friend asked (in Messages) for something at the bar. Orders older than two days lapse. */
export function pendingOrder(id) {
    const o = loungeState().orders[id];
    return o && Date.now() - o.t < 48 * HOUR ? o : null;
}

export function pendingOrders() {
    const s = loungeState();
    return Object.entries(s.orders)
        .filter(([, o]) => o && Date.now() - o.t < 48 * HOUR)
        .map(([id, o]) => ({ id, ...o }));
}

/** "yesterday", "earlier today", "the other day" for a time in the past. */
export function whenWords(t, now = Date.now()) {
    const d = new Date(t);
    const today = new Date(now);
    if (d.toDateString() === today.toDateString()) return now - t < 3 * HOUR ? 'just now' : 'earlier today';
    const y = new Date(now - 24 * HOUR);
    if (d.toDateString() === y.toDateString()) return 'yesterday';
    return now - t < 7 * 24 * HOUR ? 'the other day' : 'a while back';
}

// ---------------------------------------------------------------- what they say about it

/** Sent a while after you served someone: {item} is "☕ coffee", {when} "yesterday". */
export const THANKS = [
    'Thanks for the {item} {when}, {you}! Best one in the whole Garden. 💖',
    'Still thinking about that {item} you made me {when}. Same again next time? 😋',
    'Hey {you}! That {item} {when} really hit the spot. You have a gift!',
    'Okay, confession: I told everyone in {game} about your {item}. They are all jealous. 🍹',
    'The {item} {when}? Perfect. I am leaving you a five-star review in my heart. ⭐',
];

/** The ones that were not quite right still get a kind word. */
export const THANKS_MEH = [
    'Thanks for the {item} {when}, {you}! It was… brave. I like brave. 😅',
    'That {item} {when} was an adventure! Practice makes perfect, right? 💪',
];

/** A friend asks for something: the message comes with a button that opens the Lounge. */
export const ASK = [
    'Hey {you}, could you make me {item}? I am heading to the Lounge now! 🍹',
    'Long day in {game}. {Item} at the Lounge would fix everything. Please? 🥺',
    'Is the Lounge open? I am craving {item}! Meet you at the bar.',
    'Psst, {you}! {Item}, my usual stool. I will be waiting! ☕',
    'Can you make me {item}? I saved you a seat at the Lounge. 😊',
];

/** Said when a friend's order from Messages is served. */
export const ASK_DONE = [
    'You remembered! That {item} was exactly what I needed. Thanks, {you}! 💖',
    'Mmm! Worth the walk from {game}. You are the best bartender, {you}!',
];

/** What they say at the bar when they order (in a dialog box), by how they feel about you. */
export const ORDER_LINES = [
    ['Um, hello! Could I please have {item}?', 'Hi there! {Item}, if it is no trouble?'],
    ['Hey {you}! {Item}, please!', 'Ooh, I think I will have {item} today.'],
    ['{you}! My favourite bartender! {Item}, please!', 'The usual? Kidding! {Item} this time.'],
    ['{you}, you know me so well. {Item}, please! 😊', 'Make me {item} like only you can!'],
    ['Best friend, best bartender! {Item}, extra love please! 💖', '{you}! {Item}, and tell me about your day!'],
];

/** The reaction when served, by stars (1–3). */
export const SERVED_LINES = {
    1: ['Oh! It is… um… interesting! Thank you! 😅', 'Hmm, a little different. I will drink it anyway!', 'Thanks! I think something was missing… but it is the thought that counts!'],
    2: ['Yum! That is really good. Thanks, {you}!', 'Nice! Just what I wanted.', 'Ahh, that hits the spot! Thank you!'],
    3: ['PERFECT! How do you do that?! ✨', 'Wow… this is the best {item} I have ever had! 💖', 'Flawless! You should open your own place. Oh wait, you did!'],
};
export const FAV_LINES = ['My favourite! You remembered?! 💖', 'Oh, this is my absolute favourite! 🥰', 'How did you know this is my favourite?!'];

/** Chatter when you talk to someone sitting around. */
export const HANG_LINES = [
    'This place is so cozy. I could stay all night.',
    'Did you change the music? I like it!',
    'I come here to relax after a long day in {game}.',
    'Everyone from the Garden comes here eventually, you know.',
    'The stools here are the comfiest in the whole collection.',
    'If you are ever not busy, come sit with us!',
];

/** Things the patrons say when they show up. */
export const ENTER_LINES = ['Evening, everyone!', 'Ooh, it is busy tonight!', 'Is my stool free?', 'Hello hello!', 'I smell coffee!'];
