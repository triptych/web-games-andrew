// What the dragonfly companion knows and says: the places it can find and
// fly you back to, its hints and secrets, its news about the games, its
// greetings (it remembers your visits), snacks, games, and the looks you can
// give it. Pure data and string building: no three.js and no DOM, so it can
// be checked on its own (see dev/dragonflytest.mjs).

// ---------------------------------------------------------------- places

/**
 * Everywhere the dragonfly can discover with you. `landmark` matches a name in
 * world.landmarks, `zone` the garden's area keys, `room` a hidden place's kind
 * (the room the garden switches to, or 'cove' for Cinderpeak). `about` is what
 * it says when you find it; `hint` is its nudge while you haven't.
 */
export const PLACES = [
    // the island
    {
        id: 'dock', area: 'island', name: 'The Dock', icon: '⚓', zone: ['dock'],
        about: 'Where we met! Your rowboat is still tied up here, and if you climb back in, it sprouts wings and flies you round the island.',
    },
    {
        id: 'hub', area: 'island', name: 'The Hub', icon: '\u{1F4A0}', zone: ['hub'],
        about: 'The heart of the garden. The hologram turns through every game, newest first, and its brass arrows really press in. Every path from here leads to one kind of game.',
        hint: 'Follow the dock path uphill to the Hub. Every path in the garden starts there.',
    },
    {
        id: 'hutside', area: 'island', name: 'The Hut', icon: '\u{1F6D6}', landmark: 'The Hut',
        about: 'A little cabin with a glow in the window. There’s a fireplace inside, and a desk covered in curious things.',
        hint: 'There’s a little hut beside the dock path. Something glows on the desk inside.',
    },
    {
        id: 'tree', area: 'island', name: 'The Great Tree', icon: '\u{1F333}', landmark: 'The Great Tree',
        about: 'The Great Tree! Look at its roots: there’s a door of light in them. My friend the fox lives on the other side.',
        hint: 'The roots of the Great Tree shimmer when you get close. I’d walk right through, if I were you.',
    },
    {
        id: 'gear', area: 'island', name: 'The Great Gear', icon: '⚙️', landmark: 'The Great Gear',
        about: 'The Great Gear, turning and turning. Don’t stand and count its teeth. Go round the back, where the Hub can’t see.',
        hint: 'Somewhere on the island a giant gear turns all day. I’ve felt a cold draught behind it.',
    },
    {
        id: 'observatory', area: 'island', name: 'The Observatory', icon: '\u{1F52D}', landmark: 'The Observatory',
        about: 'The Observatory. Its door opens on a tower that is much bigger on the inside than the outside, with a great telescope under the dome.',
        hint: 'Have you seen the Observatory? Its door opens on far more tower than there ought to be.',
    },
    {
        id: 'lighthouse', area: 'island', name: 'The Lighthouse', icon: '\u{1F3EE}', landmark: 'The Lighthouse',
        about: 'The lighthouse! Its beams sweep the sea after dark. Listen at the door at its foot: there’s music.',
        hint: 'Out on the edge of the island there’s a lighthouse, and I’m sure I hear music coming from it.',
    },
    {
        id: 'fountain', area: 'island', name: 'The Moon Fountain', icon: '⛲', landmark: 'The Moon Fountain',
        about: 'The Moon Fountain. See the toy submarine going round the pool? Click it and climb in. The sea inside goes on for ever.',
        hint: 'A tiny submarine goes round and round a fountain somewhere between the paths. I wonder where it goes.',
    },
    {
        id: 'carousel', area: 'island', name: 'The Starlight Carousel', icon: '\u{1F3A0}', landmark: 'The Starlight Carousel',
        about: 'The Starlight Carousel! Eight creatures of legend to ride. My favourite is the moon moth, obviously. Come back after dark to see its lights run in colours.',
        hint: 'Somewhere between two paths there’s a carousel with a dragon, a pegasus and a moon moth on it.',
    },
    {
        id: 'stones', area: 'island', name: 'The Standing Stones', icon: '\u{1FAA8}', landmark: 'The Standing Stones',
        about: 'The Standing Stones. Feel how the motes over the altar hum? Walk into them and they’ll carry you all the way to Cinderpeak, the volcano.',
        hint: 'There’s a ring of standing stones near the dock, with motes humming over the middle.',
    },
    {
        id: 'clocktower', area: 'island', name: 'The Clock Tower', icon: '\u{1F570}️', landmark: 'The Clock Tower',
        about: 'The Clock Tower on its own little islet. The door at its foot goes down into the Works, where the island’s machines live.',
        hint: 'You can see the Clock Tower from the dock. A stone bridge goes over to it.',
    },
    {
        id: 'pier', area: 'island', name: 'The Fishing Pier', icon: '\u{1F3A3}', landmark: 'The Fishing Pier', zone: ['pier'],
        about: 'The fishing pier. The rod on the rail is for anyone. Nine kinds of fish, and the Moonfin only bites at night.',
        hint: 'On the far side of the island from the dock there’s a fishing pier with a rod waiting on the rail.',
    },
    {
        id: 'wharf', area: 'island', name: 'The Pirate Wharf', icon: '\u{1F3F4}‍☠️', landmark: 'The Pirate Wharf', zone: ['wharf', 'ship'],
        about: 'The Black Nocturne, a gothic galleon! Walk up the gangplank and stand behind her wheel, and she’s yours to sail.',
        hint: 'Below the Delvers’ Descent, at the end of the dungeons path, a pirate ship is tied up at a wharf.',
    },
    {
        id: 'wellside', area: 'island', name: 'The Glowing Well', icon: '\u{1FAA3}', landmark: 'The Glowing Well',
        about: 'A stone well with a rope going down, and something green glowing at the bottom. Walk up to the curb to slide down.',
        hint: 'A few steps past the Hearthgarden there’s a well that glows green at the bottom.',
    },
    {
        id: 'comet', area: 'island', name: 'The Silver Comet', icon: '\u{1F680}', landmark: 'The Silver Comet',
        about: 'A crashed rocket ship, still smoking! Its hatch has fallen open into a ramp. Somewhere aboard, one room still has power.',
        hint: 'Something came down in the trees past the grove between the Puzzle and Dungeon paths. It’s still smoking!',
    },
    // the hidden places: a different world each
    {
        id: 'hut', area: 'hidden', name: 'Inside the Hut', icon: '\u{1F525}', room: 'hut',
        about: 'Cosy! The glass sphere on the desk has a whole galaxy in it. There’s a train ticket, some old papers worth reading, and a stair up to the loft.',
        hint: 'The Hut’s door is always open. Walk right in and look at the desk.',
    },
    {
        id: 'subway', area: 'hidden', name: 'The Violet Line', icon: '\u{1F687}', room: 'subway',
        about: 'The Violet Line, an underground train! It runs from Hearthside down past ghost stations to Prism Halt and the Spectrum Rotunda.',
        hint: 'There’s a train ticket on the Hut’s desk. I hear a train rumbling under the island at night.',
    },
    {
        id: 'tower', area: 'hidden', name: 'The Observatory Tower', icon: '\u{1F30C}', room: 'tower',
        about: 'Five floors of strange rooms, joined by a lift of light! Touch anything that glows. The great telescope is right at the top.',
        hint: 'The Observatory’s door is open. Inside there’s a telescope that finds planets nobody has named.',
    },
    {
        id: 'arcade', area: 'hidden', name: 'The Lighthouse Arcade', icon: '\u{1F579}️', room: 'arcade',
        about: 'A whole arcade under the lighthouse, with a cabinet for every game in the garden! Bowling, a disco, Madame Meridian’s fortunes and the claw machine.',
        hint: 'Try the door at the foot of the lighthouse. Bring your dancing shoes.',
    },
    {
        id: 'forest', area: 'hidden', name: 'The Springwood', icon: '\u{1F338}', room: 'forest',
        about: 'The Springwood, where it’s always April. It goes on for ever, and the fox knows where the hidden places are.',
        hint: 'The door in the Great Tree’s roots leads somewhere where it’s always spring.',
    },
    {
        id: 'city', area: 'hidden', name: 'Gearfall', icon: '\u{1F3DA}️', room: 'city',
        about: 'Gearfall. A dead city that goes on for ever, and something very large at the bottom of the crater in the middle. Stay close to me.',
        hint: 'Read the old papers on the Hut’s desk. They talk about a trap door behind the Great Gear.',
    },
    {
        id: 'well', area: 'hidden', name: 'The Garden Under the Well', icon: '\u{1F344}', room: 'well',
        about: 'A garden that shines by itself! Fill the watering can at the pool, water what’s thirsty and pick what’s ready. It keeps growing while you’re away.',
        hint: 'That glowing well beside the Hearthgarden has a whole garden at the bottom of it.',
    },
    {
        id: 'rocket', area: 'hidden', name: 'Aboard the Silver Comet', icon: '\u{1F6F8}', room: 'rocket',
        about: 'Inside the rocket! The transporter still works. Step on the pad and pull its lever, and it throws you at a world nobody has ever seen.',
        hint: 'The crashed rocket’s hatch is open. One room on board still has power.',
    },
    {
        id: 'works', area: 'hidden', name: 'The Works', icon: '\u{1F529}', room: 'works',
        about: 'The Works, the machine hall that keeps the island running. Those screens show the garden’s own code! There’s a lift at the far end.',
        hint: 'The door at the foot of the Clock Tower goes down into a hall full of machines.',
    },
    {
        id: 'foundry', area: 'hidden', name: 'The Robot Foundry', icon: '\u{1F916}', room: 'foundry',
        about: 'The Robot Foundry. Three lines building robots, head first. Listen to the loudspeakers, and don’t look at the end of the walkway.',
        hint: 'The lift at the far end of the Works goes further down. I don’t like the noises it makes.',
    },
    {
        id: 'cove', area: 'hidden', name: 'Cinderpeak Cove', icon: '\u{1F30B}', room: 'cove',
        about: 'Cinderpeak! A mine cart waits by the mine. It rides through lava tunnels and a cavern full of gems. Keep your wings inside the cart.',
        hint: 'See the volcano beyond the dock? The Standing Stones can take you there.',
    },
];

export const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p]));

/** The place a garden area key or a landmark name stands for, if any. */
export function placeForZone(key) {
    if (!key) return null;
    for (const p of PLACES) {
        if (p.zone?.includes(key)) return p;
        if (p.landmark && p.landmark === key) return p;
    }
    return null;
}

/** The place for a room kind ('hut', 'subway', ... or 'cove' / 'mine' for Cinderpeak). */
export function placeForRoom(kind) {
    if (kind === 'mine') kind = 'cove';
    return PLACES.find((p) => p.room === kind) || null;
}

/** Secrets for someone who has found everything. */
export const SECRETS = [
    'Stay up until midnight. The garden sees in every new day with fireworks, and the carousel plays along.',
    'The Moonfin only bites at night. Try the fishing pier after dark.',
    'On about one visit in five, a fox spirit trots out of the bushes ahead of you. If you see it, follow it!',
    'There’s a cat asleep on the quilt in the Hut’s loft. You can sleep there too, right through the night.',
    'The stained-glass window in the loft is a new design every time you climb up. I’ve never seen the same one twice.',
    'On one world in five, the Silver Comet’s pilot is out there somewhere. Listen for the ping on your suit radio.',
    'The exit in the Robot Foundry works, but only for you. It comes out in the Springwood.',
    'Black holes are the rarest thing the great telescope can find. Keep turning the dial.',
    'The old television in the Hut picks up the island’s secret places. Click it to change the channel.',
    'Click your rowboat at the dock and it flies you round the whole island.',
    'Madame Meridian in the arcade tells fortunes, and every fortune has a lucky game in it.',
    'In the submarine, keep an eye on the sea floor. There’s a sunken galleon down there somewhere, and a magic sword.',
    'The flute in the loft has a songbook. Learn a tune and I’ll hum along.',
    'Weather wanders on its own here, but you can pick it in the time panel. I like the snow best.',
];

// ---------------------------------------------------------------- looks

export const BODIES = [
    { id: 'emerald', name: 'Emerald', a: '#33d67e', b: '#0d6e4a', eye: '#2a7cff' },
    { id: 'azure', name: 'Azure', a: '#45b4ff', b: '#173f9e', eye: '#0f2f78' },
    { id: 'ruby', name: 'Ruby', a: '#ff4d63', b: '#8f1030', eye: '#ffb03a' },
    { id: 'amber', name: 'Amber', a: '#ffbf3a', b: '#a8560a', eye: '#7a2a00' },
    { id: 'violet', name: 'Violet', a: '#b884ff', b: '#4e2399', eye: '#38e0ff' },
    { id: 'moon', name: 'Moonbeam', a: '#eef4ff', b: '#7d93bf', eye: '#5a7cff' },
];

export const WINGS = [
    { id: 'glass', name: 'Glass', tint: '#dff4ff', tip: '#ffffff', iri: 0.35 },
    { id: 'rainbow', name: 'Rainbow', tint: '#ffffff', tip: '#ffffff', iri: 1.0 },
    { id: 'amber', name: 'Amber tips', tint: '#fff2d6', tip: '#ff9a2a', iri: 0.25 },
    { id: 'frost', name: 'Frost', tint: '#bfe8ff', tip: '#7fd0ff', iri: 0.5 },
    { id: 'starry', name: 'Starry', tint: '#5a5aa8', tip: '#20184a', iri: 0.4, stars: true },
];

/** `unlock` is a test on the companion's memory, `need` says what it asks for. */
export const ACCESSORIES = [
    { id: 'none', name: 'Nothing', icon: '✨' },
    { id: 'bowtie', name: 'Bow tie', icon: '\u{1F380}' },
    { id: 'tophat', name: 'Top hat', icon: '\u{1F3A9}' },
    { id: 'scarf', name: 'Scarf', icon: '\u{1F9E3}' },
    { id: 'glasses', name: 'Spectacles', icon: '\u{1F453}', need: 'Visit 3 games', unlock: (s) => Object.keys(s.games).length >= 3 },
    { id: 'crown', name: 'Flower crown', icon: '\u{1F33C}', need: 'Find 8 places', unlock: (s) => Object.keys(s.places).length >= 8 },
    { id: 'lantern', name: 'Lantern', icon: '\u{1F3EE}', need: 'Come back 3 times', unlock: (s) => s.visits >= 3 },
];

export const NAME_IDEAS = ['Zephyr', 'Glimmer', 'Pip', 'Sapphire', 'Dart', 'Juniper', 'Ripple', 'Nimbus', 'Bramble', 'Skipper', 'Lumen', 'Odette', 'Whirr', 'Fennel'];

/** A name as it is kept: trimmed, no control characters, at most 18 characters. */
export function cleanName(s) {
    const n = String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18).trim();
    return n;
}

// ---------------------------------------------------------------- snacks and games

export const SNACKS = [
    { id: 'midge', name: 'Midge', icon: '\u{1F99F}', full: 0.28, joy: 0.06, lines: ['Crunchy! Just how I like them.', 'Snap! Got it. Thank you!', 'Mmm, a midge. The classic.'] },
    { id: 'dew', name: 'Dewdrop', icon: '\u{1F4A7}', full: 0.06, joy: 0.12, lines: ['Fresh off a lily pad. So cool!', 'Ahh. Sparkly.', 'A dewdrop! I can see the whole garden in it.'] },
    { id: 'pollen', name: 'Pollen puff', icon: '\u{1F33C}', full: 0.14, joy: 0.1, lines: ['Achoo! Delicious, though.', 'It tastes like the Puzzle Grove.', 'Fluffy!'] },
    { id: 'honey', name: 'Honey bead', icon: '\u{1F36F}', full: 0.2, joy: 0.18, lines: ['Sticky! Sweet! My favourite kind of trouble.', 'Honey! You spoil me.', 'Oh, that’s good. Don’t tell the bees.'] },
    { id: 'moonberry', name: 'Moonberry', icon: '\u{1FAD0}', full: 0.32, joy: 0.22, lines: ['A moonberry! They only ripen in the Springwood.', 'It fizzes! My wings are tingling.', 'Ooh, I can see in the dark now. I think.'] },
];

export const PLAYS = [
    { id: 'loop', name: 'Loop the loop', icon: '➰', joy: 0.14, line: 'Wheee! Again, again!' },
    { id: 'roll', name: 'Barrel roll', icon: '\u{1F300}', joy: 0.14, line: 'Did you see that? A perfect roll.' },
    { id: 'circle', name: 'Fly round you', icon: '\u{1F504}', joy: 0.12, line: 'Round and round and round!' },
    { id: 'catch', name: 'Catch me!', icon: '\u{1F3AF}', joy: 0.25, line: 'Catch me if you can! Click me, quick!' },
];

/** Feelings in words, from how full and how happy it is (both 0..1). */
export function moodOf(full, joy) {
    if (full < 0.15) return { word: 'Hungry', face: '\u{1F97A}' };
    if (joy > 0.8 && full > 0.4) return { word: 'Overjoyed', face: '\u{1F929}' };
    if (joy > 0.55) return { word: 'Happy', face: '\u{1F60A}' };
    if (joy > 0.3) return { word: 'Content', face: '\u{1F642}' };
    return { word: 'A little bored', face: '\u{1F610}' };
}

/** Hunger and joy fade slowly while you are away: about a meal every six hours. */
export function decay(full, joy, hours) {
    return {
        full: Math.max(0, full - hours / 6),
        joy: Math.max(0.2, joy - hours / 18),
    };
}

// ---------------------------------------------------------------- dates

const DAY = 864e5;

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago", "on Nov 3". */
export function ago(ts, now) {
    const d = now - ts;
    if (d < 9e4) return 'just now';
    if (d < 36e5) {
        const m = Math.round(d / 6e4);
        return `${m} minute${m === 1 ? '' : 's'} ago`;
    }
    if (d < DAY) {
        const h = Math.round(d / 36e5);
        return `${h} hour${h === 1 ? '' : 's'} ago`;
    }
    const days = Math.floor(d / DAY);
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    return 'on ' + new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------------------------------------------------------------- greetings

/**
 * What it says when it meets you at the dock. `mem` is its memory (visits, prevSeen,
 * metAt, places, games); `ctx` the garden right now ({ night, weather, news }).
 */
export function greeting(name, mem, now, ctx = {}) {
    const lines = [];
    const n = mem.visits || 1;
    const since = mem.prevSeen ? now - mem.prevSeen : 0;
    if (!mem.prevSeen) lines.push('You came back!');
    else if (since > 30 * DAY) lines.push('You’re back! It’s been ages. I kept your spot on the dock warm.');
    else if (since > 6 * DAY) lines.push(`Welcome back! It’s been ${Math.floor(since / DAY)} days. I missed you.`);
    else if (since > 1.5 * DAY) lines.push(`Welcome back! I last saw you ${ago(mem.prevSeen, now)}.`);
    else if (since > 0.5 * DAY) lines.push('Welcome back! Did you sleep well?');
    else lines.push('Back again already? Wonderful!');
    lines.push(`That’s your ${ordinal(n)} visit${n >= 10 ? '. You’re practically an islander now' : ''}.`);
    if (ctx.night > 0.5) lines.push('The lamps are lit. Let’s go and look at the stars.');
    else if (ctx.weather === 'rain' || ctx.weather === 'storm') lines.push('Bit wet today. My wings don’t mind if yours don’t.');
    else if (ctx.weather === 'snow') lines.push('Snow! Everything sparkles.');
    if (ctx.news) lines.push(ctx.news);
    return lines.join(' ');
}

/** The first words, on the dock. */
export function introduction(visits) {
    const back = visits > 1 ? ' I’ve seen you here before, haven’t I? I never forget a face.' : '';
    return [
        `Oh! Hello! A visitor!${back}`,
        'I’m a garden dragonfly. I’ve been darting about this island since the very first statue went up, so I know every path, and one or two that aren’t paths at all.',
        'Would you like a guide? I’ll show you new things as we find them, drop the odd hint, bring you the latest news from the games, and fly you back to anywhere we’ve been.',
    ];
}

// ---------------------------------------------------------------- news

/**
 * News about the games, newest first: what's new since your last visit, the newest
 * game, the latest updates. `updates` is js/updates.json's `games` map (or null).
 * Returns [{ text, game? }].
 */
export function buildNews(games, updates, now, since = 0) {
    const out = [];
    const byId = new Map(games.map((g) => [g.id, g]));
    const ents = updates ? Object.entries(updates).filter(([id]) => byId.has(id)).map(([id, u]) => ({ game: byId.get(id), added: Date.parse(u.added), updated: Date.parse(u.updated), version: u.version })) : [];
    const valid = ents.filter((e) => Number.isFinite(e.added) && Number.isFinite(e.updated));
    if (since && valid.length) {
        const fresh = valid.filter((e) => e.added > since);
        const changed = valid.filter((e) => e.added <= since && e.updated > since);
        if (fresh.length || changed.length) {
            const bits = [];
            if (fresh.length) bits.push(fresh.length === 1 ? `a new game arrived (${fresh[0].game.title})` : `${fresh.length} new games arrived`);
            if (changed.length) bits.push(changed.length === 1 ? `${changed[0].game.title} was updated` : `${changed.length} games were updated`);
            const g = (fresh[0] || changed[0]).game;
            out.push({ text: `Since you were last here, ${bits.join(' and ')}!`, game: g, kind: 'since' });
        }
    }
    // the newest game: by its added date when known, else the highest id
    const newest = valid.length ? valid.reduce((a, b) => (b.added > a.added ? b : a)).game : [...games].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))[0];
    const ne = valid.find((e) => e.game === newest);
    if (newest) out.push({ text: `The newest game in the garden is ${newest.title}${ne ? `, which arrived ${ago(ne.added, now)}` : ''}. Its statue stands nearest the Hub on its path.`, game: newest, kind: 'newest' });
    // the latest updates (a version change after it arrived)
    const updated = valid.filter((e) => e.updated - e.added > 6e4).sort((a, b) => b.updated - a.updated).slice(0, 4);
    for (const e of updated) out.push({ text: `${e.game.title} was updated to version ${e.version} ${ago(e.updated, now)}.`, game: e.game, kind: 'update' });
    out.push({ text: `There are ${games.length} games in the garden now, and the island grows a little with every one.`, kind: 'count' });
    return out;
}

/** When a game was last updated, if recently (within `days`): { version, when } or null. */
export function recentUpdate(game, updates, now, days = 10) {
    const u = updates?.[game.id];
    if (!u) return null;
    const t = Date.parse(u.updated), a = Date.parse(u.added);
    if (!Number.isFinite(t) || now - t > days * DAY) return null;
    return { version: u.version, when: ago(t, now), fresh: Math.abs(t - a) < 6e4 };
}

// ---------------------------------------------------------------- idle chatter and reactions

export const CHATTER = {
    night: ['The lamps are coming on. The fireflies will be out soon!', 'Ooh, it’s getting dark. The aurora might come out tonight.'],
    midnight: ['It’s nearly midnight! Find somewhere with a view of the sky.'],
    rain: ['Rain! I’ll keep close. My wings get heavy when they’re wet.'],
    snow: ['Snow! Look how it settles on the statues.'],
    storm: ['Thunder! Let’s stay away from the lighthouse.'],
    fog: ['I can hardly see my own tail in this fog.'],
    hungry: ['My tummy is rumbling. A midge would be lovely, if you have one…', 'I’m getting peckish. Have you got a snack?'],
    bored: ['Want to play? I know a game.', 'I could do a loop-the-loop, if you like.'],
    pet: ['Hee hee, that tickles!', 'Hello to you too!', '*happy buzzing*', 'I’m right here!', 'Bzzz! Where to next?'],
    travel: ['Hold on to my tail!', 'Off we go!', 'Close your eyes… and open them!'],
    cantTravel: 'Let’s wait until we’re back on our feet, then I’ll fly us anywhere.',
    rooms: ['I’m right behind you.', 'Stay close!'],
};

/** A line about a game, for its statue or a recommendation. */
export function aboutGame(game, genre, upd) {
    const desc = game.description.split(/(?<=[.!?])\s+/)[0];
    let s = `${game.title}! ${desc}`;
    if (upd) s += upd.fresh ? ` It only just arrived, ${upd.when}.` : ` It was updated to version ${upd.version} ${upd.when}.`;
    return s;
}
