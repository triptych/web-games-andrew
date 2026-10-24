// The house as rules: every hotspot, what a tap on it does, and what each item does to it.
// The sim keeps no positions: the view places a model for each id below. A hotspot with `show`
// disappears when it returns false; `click` runs a plain tap; `use[item]` runs an item on it.
// Nothing here can lose an item or close a door: wrong tries only earn a silly line, so the
// game has no dead end.

import { ROOMS, CLUES, NOTE_NAMES, SUSPECTS, TALK, ordinal } from './data.js';
import { EVIDENCE_NEEDED, BAKE_SECONDS } from '../config.js';

// ------------------------------------------------------------------ helpers
export const say = (G, who, text) => G.events.push({ type: 'say', who, text });
export const sayAll = (G, lines) => { for (const [who, text] of lines) say(G, who, text); };
export const has = (G, item) => G.inv.includes(item);
export const flag = (G, key, val = true) => { G.f[key] = val; G.events.push({ type: 'flag', key }); };
export function give(G, item) {
    if (has(G, item)) return;
    G.inv.push(item);
    G.events.push({ type: 'give', item });
}
export function take(G, item) {
    const i = G.inv.indexOf(item);
    if (i < 0) return;
    G.inv.splice(i, 1);
    G.events.push({ type: 'take', item });
}
export function clue(G, id) {
    if (G.clues.includes(id)) return false;
    G.clues.push(id);
    G.events.push({ type: 'clue', id, kind: CLUES[id].kind });
    return true;
}
export const evidenceCount = (G) => G.clues.filter((c) => CLUES[c].kind === 'evidence').length;

export function roomOpen(G, room) {
    if (room === 'library') return !!G.f.lib_open;
    if (room === 'attic') return !!G.f.attic_open;
    if (room === 'ballroom') return !!G.f.ball_open;
    return room in ROOMS;
}

const ENTER = {
    parlor: [['Dev', 'Ooh. Fancy ghost sofa.'], ['Theo', 'Why does that teapot look like it\'s listening?']],
    kitchen: [['June', 'I smell vanilla. In a house nobody has lived in for a hundred years.'], ['Maya', 'Everyone keep an eye out for clues.']],
    library: [['Theo', 'Okay. Books. Books are safe. Books don\'t move.'], ['', 'A book on the shelf wiggles.'], ['Theo', 'BOOKS MOVE.']],
    attic: [['Dev', 'Every spooky movie has an attic. And now we\'re in one. This is fine.'], ['June', 'Look at all this stuff! Somebody really loved it.']],
    ballroom: [['', 'The doors swing wide. The ballroom is enormous and perfectly still, as if it has been holding its breath for a hundred years.'], ['Maya', 'It\'s a party room. It\'s been waiting for a party.']],
};

export function goRoom(G, room) {
    if (!roomOpen(G, room)) return false;
    if (room === G.room) return true;
    const from = G.room;
    G.room = room;
    const first = !G.visited[room];
    G.visited[room] = true;
    G.events.push({ type: 'room', room, from, first });
    if (first && ENTER[room]) sayAll(G, ENTER[room]);
    return true;
}

const NOPE = [
    ['Maya', 'That doesn\'t go there.'],
    ['Theo', 'I don\'t think that does anything. Can we not find out the hard way?'],
    ['Dev', 'Let\'s try it anyway. ...Nope.'],
    ['June', 'The house says "no thank you."'],
];
export function nope(G, item) {
    G.events.push({ type: 'nope', item });
    say(G, ...NOPE[Math.floor(G.rng() * NOPE.length)]);
}

// ------------------------------------------------------------------ the table
export const HOTSPOTS = {};
const hs = (id, room, def) => { HOTSPOTS[id] = { id, room, ...def }; };
const door = (id, room, name, to) => hs(id, room, { name, kind: 'door', click: (G) => { goRoom(G, to); } });
const flavor = (id, room, name, lines) => hs(id, room, { name, click: (G) => sayAll(G, lines) });

// ---- foyer
hs('f_front', 'foyer', {
    name: 'Front door',
    click: (G) => sayAll(G, G.ending
        ? [['Maya', 'The front door is open. It has been open all night.']]
        : [['Dev', 'It slammed itself shut and it won\'t budge.'], ['Maya', 'It\'s not locked. It\'s just... stuck on staying. We\'re not leaving until we know what\'s going on.']]),
});
hs('f_portrait', 'foyer', {
    name: 'Family portrait',
    click: (G) => {
        const first = clue(G, 'portrait');
        sayAll(G, first
            ? [['Maya', `The Hauntly family: Mr. Hauntly, Mrs. Hauntly... and a little girl in a ruffly dress. The brass plate says "Winifred, aged ${G.layout.age}."`], ['Dev', 'She looks like she\'s about to sneeze.'], ['Maya', 'I\'m writing that number down.']]
            : [['Maya', `"Winifred, aged ${G.layout.age}." She\'s still about to sneeze.`]]);
    },
});
hs('f_clock', 'foyer', {
    name: 'Grandfather clock',
    click: (G) => {
        if (!G.f.card_found) {
            flag(G, 'card_found');
            give(G, 'card');
            sayAll(G, [['Theo', 'Stopped at 11:59. Technically it\'s right twice a day.'], ['Dev', 'Ooh, the case opens! There\'s a blank card tucked inside. Cream-colored. Fancy.']]);
        } else sayAll(G, [['Theo', 'Still stuck at 11:59. It looks smug about it.']]);
    },
});
hs('f_coats', 'foyer', {
    name: 'Coat rack',
    click: (G) => {
        if (!G.f.candles_found) {
            flag(G, 'candles_found');
            give(G, 'candles');
            sayAll(G, [['June', 'These raincoats are tiny. And look! A box of rainbow birthday candles in the pocket. Never opened.']]);
        } else sayAll(G, [['June', 'Tiny raincoats. Somebody small lived here.']]);
    },
});
hs('f_chandelier', 'foyer', {
    name: 'Chandelier',
    click: (G) => {
        const first = clue(G, 'cold');
        sayAll(G, first
            ? [['Theo', 'Seventy degrees... seventy... forty-one! There\'s a cold spot right under the chandelier.'], ['Dev', 'Cold spots are just ghosts hugging you.'], ['Theo', 'DEV.']]
            : [['Theo', 'Still 41 degrees. I\'m not standing there.']]);
    },
});
hs('f_lamp', 'foyer', {
    name: 'Little lamp',
    click: (G) => sayAll(G, [['June', 'I said "please light up" and it did. I like this lamp.'], ['Theo', 'It lit up by itself two seconds before you said please.']]),
});
hs('f_hatch', 'foyer', {
    name: (G) => (G.f.attic_open ? 'Attic ladder' : 'Attic hatch'),
    click: (G) => {
        if (G.f.attic_open) goRoom(G, 'attic');
        else sayAll(G, [['Maya', 'A hatch in the ceiling of the landing. Its pull-cord is dangling just out of reach.'], ['June', 'We need something long.']]);
    },
    use: {
        broom: (G) => {
            take(G, 'broom');
            flag(G, 'attic_open');
            G.events.push({ type: 'unlock', id: 'f_hatch' });
            sayAll(G, [['June', 'Got the cord... pull!'], ['', 'The hatch swings open and a wooden ladder unfolds with a creak and a puff of old-attic smell.'], ['Dev', 'Ladder. Dark attic. What could go wrong?']]);
        },
    },
});
door('d_f_parlor', 'foyer', 'Parlor door', 'parlor');
door('d_f_kitchen', 'foyer', 'Kitchen door', 'kitchen');
hs('d_f_library', 'foyer', {
    name: 'Library door', kind: 'door',
    click: (G) => {
        if (G.f.lib_open) goRoom(G, 'library');
        else sayAll(G, [['Maya', 'Locked. The keyhole is shaped like a little flower.'], ['Theo', 'Is there a flower-shaped key lying around somewhere?']]);
    },
    use: {
        brass_key: (G) => {
            take(G, 'brass_key');
            flag(G, 'lib_open');
            G.events.push({ type: 'unlock', id: 'd_f_library' });
            sayAll(G, [['Maya', 'It fits! Click... and the door swings open on its own.'], ['Dev', 'Fancy. It even creaked at the right moment.']]);
        },
    },
});
hs('d_f_ballroom', 'foyer', {
    name: 'Ballroom doors', kind: 'door',
    click: (G) => {
        if (G.f.ball_open) goRoom(G, 'ballroom');
        else sayAll(G, [['Maya', 'Big double doors, and a ribbon of soft light seals the crack between them. They\'re not opening for us.'], ['Theo', 'Yet. They\'re not opening yet.']]);
    },
});

// ---- parlor
const KEY_LINES = {
    sofa: [['Dev', 'Something is poking me... A brass key! It has a little flower on it.']],
    teapot: [['June', 'The lid rattles... and a tiny brass key is hiding in the teapot. Tea for two keys.']],
    fireplace: [['Theo', 'There\'s a key in the ashes with a flower on it. It\'s only a little bit singed.']],
};
const keySpot = (spot, name, empty) => hs('p_' + spot, 'parlor', {
    name,
    click: (G) => {
        if (G.layout.keySpot === spot && !G.f.key_found) {
            flag(G, 'key_found');
            give(G, 'brass_key');
            sayAll(G, KEY_LINES[spot]);
        } else sayAll(G, empty);
    },
});
keySpot('sofa', 'Sofa', [['Dev', 'Cushion dive! I found three coins, a button, and a very old gummy bear. I did not eat it.'], ['Theo', 'You thought about it.']]);
keySpot('teapot', 'Teapot', [['June', 'Tea? Cold. Ancient. It waves at us.'], ['Theo', 'Teapots do not wave.']]);
keySpot('fireplace', 'Fireplace', [['June', 'Just ashes. Cold ashes.'], ['June', 'Ah-choo!']]);
hs('p_musicbox', 'parlor', {
    name: 'Music box',
    show: (G) => !G.f.music_taken,
    click: (G) => {
        if (!G.f.box_heard) {
            flag(G, 'box_heard');
            clue(G, 'giggle');
            sayAll(G, [['', 'The music box tinkles three crooked notes all by itself, then stops. Then: a very small giggle.'], ['Theo', 'Did everyone hear the giggle? Please tell me everyone heard the giggle.'], ['Dev', 'Recorded it!']]);
        }
        if (!G.f.box_wound) sayAll(G, [['Maya', 'It\'s stuck. There\'s a tiny keyhole in the back for winding it.']]);
        else G.events.push({ type: 'open', ui: 'melody' });
    },
    use: {
        winding_key: (G) => {
            take(G, 'winding_key');
            flag(G, 'box_wound');
            G.notes.length = 0;
            sayAll(G, [['Maya', 'Click-click-click... the box shivers and five little colored keys light up on the lid.'], ['June', 'It wants a tune. Four notes, I think.']]);
            G.events.push({ type: 'open', ui: 'melody' });
        },
    },
});
hs('p_guestlist', 'parlor', {
    name: 'Guest list',
    click: (G) => {
        const first = clue(G, 'guests');
        sayAll(G, first
            ? [['June', `A guest list on the little table: "Winnie\'s Birthday Party: ${G.layout.guests} guests invited."`], ['June', 'And every single name is crossed out. "So sorry, the storm!" Aw.'], ['Maya', 'Pantry code number three. I\'ll write it down.']]
            : [['June', `${G.layout.guests} guests invited, ${G.layout.guests} polite no-thank-yous. That's sad.`]]);
    },
});
flavor('p_window', 'parlor', 'Moonlit window', [['Theo', 'The moon is out. That cloud looks like a cat.'], ['Dev', 'That cloud looks like a cat with a hat.']]);
flavor('p_cat', 'parlor', 'Stuffed cat', [['Theo', 'Its glass eyes follow me.'], ['June', 'It\'s a stuffed cat.'], ['Theo', 'It\'s a stuffed cat that FOLLOWS me.']]);
door('d_p_foyer', 'parlor', 'Back to the foyer', 'foyer');

// ---- kitchen
hs('k_floor', 'kitchen', {
    name: 'Floury footprints',
    click: (G) => {
        const first = clue(G, 'footprints');
        sayAll(G, first
            ? [['Maya', 'Footprints in spilled flour. Tiny ones. Bare feet. They start in the middle of the room and stop in the middle of the room.'], ['Dev', 'As if somebody floated in and floated out.'], ['Maya', 'Raccoons don\'t go barefoot.']]
            : [['Maya', 'Still floating-shaped footprints. Still tiny.']]);
    },
});
hs('k_closet', 'kitchen', {
    name: 'Broom closet',
    click: (G) => {
        if (!G.f.broom_found) {
            flag(G, 'broom_found');
            give(G, 'broom');
            sayAll(G, [['', 'The closet door pops open and a broom falls out and bonks Dev.'], ['Dev', 'I\'m okay! I\'m okay. Who wants a broom?']]);
        } else sayAll(G, [['Dev', 'Just mops and buckets in there now. I checked twice.']]);
    },
});
hs('k_calendar', 'kitchen', {
    name: 'Wall calendar',
    click: (G) => {
        const first = clue(G, 'partyday');
        sayAll(G, first
            ? [['June', `An old October calendar. One day has a huge circle and "MY PARTY!!!" with a doodled cake: the ${ordinal(G.layout.day)}.`], ['Maya', 'Pantry code number two.']]
            : [['June', `The ${ordinal(G.layout.day)}: "MY PARTY!!!" with a doodled cake.`]]);
    },
});
hs('k_jar', 'kitchen', {
    name: 'Cookie jar',
    click: (G) => {
        if (!G.f.jar_read) {
            flag(G, 'jar_read');
            clue(G, 'diary2');
            sayAll(G, [['Dev', 'Stale cookies. They\'re not even good ghost cookies.'], ['Dev', 'Hey, a folded page under them. It\'s from a diary!'], ['Maya', 'It says the pantry lock goes: how old she was, which day her party was, how many friends she invited.']]);
        } else sayAll(G, [['Dev', 'I ate one. It crumbled. A hundred-year-old crumb. Worth it.']]);
    },
});
hs('k_pantry', 'kitchen', {
    name: 'Pantry',
    click: (G) => {
        if (G.f.pantry_open) sayAll(G, [['June', 'Empty now. Just a lonely jar of pickles.']]);
        else G.events.push({ type: 'open', ui: 'lock' });
    },
});
hs('k_oven', 'kitchen', {
    name: 'Old oven',
    click: (G) => {
        if (G.f.baked && !G.f.cake_taken) {
            flag(G, 'cake_taken');
            give(G, 'plain_cake');
            sayAll(G, [['June', 'Perfectly golden! Smell that. Is it weird that I\'m a little proud?']]);
        } else if (G.f.baking) sayAll(G, [['Theo', 'It\'s warming up. It smells like vanilla and old bricks.']]);
        else if (G.f.cake_taken) sayAll(G, [['Dev', 'The oven is off. The cake is in my heart. And my backpack.']]);
        else sayAll(G, [['Maya', 'A huge iron oven, stone cold. If we had something to bake, it would work.']]);
    },
    use: {
        cake_mix: (G) => {
            take(G, 'cake_mix');
            flag(G, 'baking');
            G.bake = BAKE_SECONDS;
            sayAll(G, [['June', 'Mix, pour, in it goes. The oven lights itself. Nobody mention that.'], ['Theo', 'I\'m not mentioning it.']]);
        },
    },
});
flavor('k_fridge', 'kitchen', 'Icebox', [['Dev', 'The jar in the back is waving.'], ['Theo', 'Close the icebox.'], ['Dev', 'It waved first.']]);
door('d_k_foyer', 'kitchen', 'Back to the foyer', 'foyer');

// ---- library
hs('l_quill', 'library', {
    name: 'Quill pen', show: (G) => !G.f.quill_taken,
    click: (G) => { flag(G, 'quill_taken'); give(G, 'quill'); sayAll(G, [['June', 'A feather pen! I\'m taking this. I will write very dramatic letters.']]); },
});
hs('l_inkwell', 'library', {
    name: 'Inkwell', show: (G) => !G.f.ink_taken,
    click: (G) => { flag(G, 'ink_taken'); give(G, 'ink'); sayAll(G, [['Theo', 'The ink is still wet. After a hundred years. That\'s... fine.']]); },
});
hs('l_diary1', 'library', {
    name: 'Open diary',
    click: (G) => {
        const first = clue(G, 'diary1');
        sayAll(G, first
            ? [['Maya', 'A diary, open to the last page. It says: "Oct 31. My birthday. I stood at the window all day. Nobody came. Mama says it was the storm. Maybe next year. Love, Winnie."'], ['June', 'That\'s the saddest thing I\'ve ever read.'], ['Theo', 'Okay, I am no longer scared. I am only sad.']]
            : [['Maya', '"Nobody came." I keep reading it. It doesn\'t get better.']]);
    },
});
hs('l_rhyme', 'library', {
    name: 'Framed rhyme',
    click: (G) => {
        const first = clue(G, 'rhyme');
        const t = G.layout.bookTitles, o = G.layout.bookOrder;
        sayAll(G, [['Maya', `A framed rhyme over the desk: "Pull ${t[o[0]]}, then ${t[o[1]]}, then ${t[o[2]]}, and the shelf will say hello."`], ...(first ? [['Dev', 'The shelf says hello? I love this house.']] : [])]);
    },
});
const bookPull = (i) => (G) => {
    if (G.f.shelf_open) { sayAll(G, [['Maya', 'That one\'s already been pulled. The shelf is wide open.']]); return; }
    const order = G.layout.bookOrder;
    if (i === order[G.books.length]) {
        G.books.push(i);
        G.events.push({ type: 'book', i, ok: true });
        if (G.books.length === order.length) {
            flag(G, 'shelf_open');
            G.events.push({ type: 'unlock', id: 'l_compartment' });
            sayAll(G, [['', 'Thunk, thunk, thunk. A panel in the shelf slides open with a polite little "ahem".'], ['Dev', 'It said hello.']]);
        } else say(G, 'Maya', 'Click. It stays pulled out.');
    } else {
        G.books.length = 0;
        G.events.push({ type: 'book', i, ok: false });
        sayAll(G, [['June', `${G.layout.bookTitles[i]}. Wrong chapter! All the books pop back out.`]]);
    }
};
for (let i = 0; i < 5; i++) hs('l_book_' + i, 'library', { name: (G) => G.layout.bookTitles[i], click: bookPull(i) });
hs('l_compartment', 'library', {
    name: 'Secret compartment',
    show: (G) => !!G.f.shelf_open && !G.f.wkey_taken,
    click: (G) => { flag(G, 'wkey_taken'); give(G, 'winding_key'); sayAll(G, [['Theo', 'There\'s a tiny silver key with a crank on it. Like for winding a clockwork thing.'], ['June', 'Or a music thing.']]); },
});
hs('l_globe', 'library', {
    name: 'Globe',
    click: (G) => sayAll(G, [['June', 'I spun the globe. It slowed down and then spun back by itself.'], ['Theo', 'I\'m going to stand behind June now.']]),
});
flavor('l_chair', 'library', 'Rocking chair', [['Dev', 'It\'s rocking. Nobody\'s in it.'], ['Maya', 'Maybe somebody is. Just somebody we can\'t see yet.']]);
door('d_l_foyer', 'library', 'Back to the foyer', 'foyer');

// ---- attic
hs('a_sheet', 'attic', {
    name: 'Sheet music',
    click: (G) => {
        const first = clue(G, 'lullaby');
        const notes = G.layout.melody.map((n) => NOTE_NAMES[n]).join(', ');
        sayAll(G, [['June', `Sheet music with crayon-colored notes: ${notes}. There\'s a scribble: "Mama\'s lullaby."`], ...(first ? [['Maya', 'Four notes. A tune for the music box, I bet.']] : [])]);
    },
});
hs('a_trunk', 'attic', {
    name: 'Old trunk',
    click: (G) => {
        if (G.f.trunk_open) sayAll(G, [['Dev', 'Empty trunk. Good place for a nap, though.']]);
        else sayAll(G, [['Maya', 'A big trunk with a star-shaped lock.'], ['Theo', 'We need a key with a star on it, I guess.']]);
    },
    use: {
        trunk_key: (G) => {
            take(G, 'trunk_key');
            flag(G, 'trunk_open');
            give(G, 'streamers');
            clue(G, 'diary3');
            G.events.push({ type: 'unlock', id: 'a_trunk' });
            sayAll(G, [['June', 'Click! Streamers! Balloons! All the colors of a party nobody got to have.'], ['Maya', 'And a diary page: "Oct 31, late. The party is over and nobody came, but I can\'t seem to go to bed. I think I\'ll stay and wait. Someone has to be here when friends finally come. I\'ll leave the doors open."'], ['Theo', 'I... need a minute.']]);
        },
    },
});
flavor('a_horse', 'attic', 'Rocking horse', [['Dev', 'Giddy up!'], ['Dev', '...It rocked on its own. I didn\'t do that. Who did that?']]);
hs('a_mirror', 'attic', {
    name: 'Dusty mirror',
    click: (G) => {
        const first = clue(G, 'mirror');
        sayAll(G, first
            ? [['Theo', 'There are five of us in the mirror.'], ['Maya', 'And the fifth one is waving.'], ['Theo', 'I am waving back. Is that okay? I\'m just being polite.']]
            : [['Theo', 'Still five in the mirror. Still waving. Hi!']]);
    },
});
flavor('a_dolls', 'attic', 'Dust-sheet dolls', [['June', 'Dolls under little bedsheets. They look like tiny ghosts.'], ['Dev', 'Everything in this house wants to be a ghost.']]);
door('d_a_foyer', 'attic', 'Ladder down', 'foyer');

// ---- ballroom: four things make the party
const PARTY = ['p_cake', 'p_banner', 'p_music', 'p_invite'];
export const partyReady = (G) => PARTY.every((k) => G.f[k]);
function place(flagName, item, lines) {
    return (G) => {
        take(G, item);
        flag(G, flagName);
        G.events.push({ type: 'place', flag: flagName });
        sayAll(G, lines);
        if (partyReady(G) && !G.f.party_ready) {
            flag(G, 'party_ready');
            G.events.push({ type: 'party' });
            startTalk(G, 'meet');
        }
    };
}
hs('b_table', 'ballroom', {
    name: 'Long table',
    click: (G) => sayAll(G, G.f.p_cake ? [['Dev', 'The cake looks incredible. I\'m not allowed to touch it.']] : [['Maya', 'A long table with a lace cloth. It needs something worth gathering around.'], ['Dev', 'Cake. It needs cake.']]),
    use: { birthday_cake: place('p_cake', 'birthday_cake', [['Maya', 'Right in the middle. Perfect.']]) },
});
hs('b_banner', 'ballroom', {
    name: 'Bare wall',
    click: (G) => sayAll(G, G.f.p_banner ? [['June', 'Streamers and balloons. Now it looks like a party.']] : [['June', 'This wall is begging for decorations.']]),
    use: { streamers: place('p_banner', 'streamers', [['June', 'Balloons up! Streamers up! The ballroom looks like it just woke up smiling.']]) },
});
hs('b_stand', 'ballroom', {
    name: 'Pedestal',
    click: (G) => sayAll(G, G.f.p_music ? [['Theo', 'It\'s playing the lullaby. Very softly. I\'m not crying, you\'re crying.']] : [['Theo', 'A little pedestal. It\'s just the right size for something that plays music.']]),
    use: { music_box: place('p_music', 'music_box', [['Theo', 'I wound it all the way. Here goes.'], ['', 'The music box begins to play a soft waltz, and the whole ballroom seems to lean in to listen.']]) },
});
hs('b_easel', 'ballroom', {
    name: 'Welcome easel',
    click: (G) => sayAll(G, G.f.p_invite ? [['Maya', 'The invitation says it all.']] : [['Maya', 'An easel by the door, the kind you put a welcome sign on.']]),
    use: { invitation: place('p_invite', 'invitation', [['Maya', 'We\'ll put it right where she\'ll see it first.']]) },
});
flavor('b_window', 'ballroom', 'Tall window', [['Theo', 'You can see the whole town from here. All the little lights.'], ['June', 'That\'s the view she had on her birthday.']]);
door('d_b_foyer', 'ballroom', 'Back to the foyer', 'foyer');

// ---- the shy ghost: one peek in every room. Optional, and counted at the end.
for (const room of Object.keys(ROOMS)) {
    hs('peek_' + room, room, {
        name: 'Something white',
        kind: 'peek',
        show: (G) => !G.f['peek_' + room],
        click: (G) => {
            flag(G, 'peek_' + room);
            G.stats.wisps++;
            G.events.push({ type: 'wisp', room });
            sayAll(G, [['June', 'Did you see that?! Something small and white just ducked behind there!'], ['', 'A tiny giggle fades away.']]);
        },
    });
}

export const hotspotName = (G, id) => { const n = HOTSPOTS[id].name; return typeof n === 'function' ? n(G) : n; };
export const hotspotShown = (G, id) => { const h = HOTSPOTS[id]; return h.room === G.room && (!h.show || h.show(G)); };
export const visibleHotspots = (G) => Object.keys(HOTSPOTS).filter((id) => hotspotShown(G, id));

// ------------------------------------------------------------------ puzzles with their own input
export function tryCode(G, id, digits) {
    if (id !== 'pantry' || G.room !== 'kitchen' || G.f.pantry_open) return false;
    const L = G.layout;
    const ok = digits.length === 3 && digits[0] === L.age && digits[1] === L.day && digits[2] === L.guests;
    G.events.push({ type: 'code', ok });
    if (ok) {
        flag(G, 'pantry_open');
        give(G, 'cake_mix');
        give(G, 'frosting');
        G.events.push({ type: 'unlock', id: 'k_pantry' });
        sayAll(G, [['', 'Click-click-clunk. The pantry door swings open.'], ['June', 'Cake mix and a jar of pink frosting! Somebody was going to make a great cake.'], ['Maya', 'We\'ll make it for her.']]);
    } else say(G, 'Maya', 'Nothing. The lock rattles. Age, party day, guests: let\'s check our notes.');
    return ok;
}

export function playNote(G, n) {
    if (!G.f.box_wound || G.f.box_open || G.room !== 'parlor') return false;
    G.notes.push(n);
    const m = G.layout.melody;
    if (G.notes.length < m.length) { G.events.push({ type: 'note', n, ok: null }); return null; }
    const ok = m.every((x, i) => G.notes[i] === x);
    G.notes.length = 0;
    G.events.push({ type: 'note', n, ok });
    if (ok) {
        flag(G, 'box_open');
        flag(G, 'music_taken');
        give(G, 'trunk_key');
        give(G, 'music_box');
        G.events.push({ type: 'unlock', id: 'p_musicbox' });
        sayAll(G, [['', 'The lullaby plays all the way through. A tiny drawer in the base slides open.'], ['Maya', 'A star-shaped key.'], ['Theo', 'And the box itself is perfect for the party. A party needs music. Let\'s take it.']]);
    } else sayAll(G, [['Dev', 'That sounded like a cat on a piano. Try again?']]);
    return ok;
}

// ------------------------------------------------------------------ the case board and the talk
export function accuse(G, who) {
    if (G.f.case_solved) return;
    if (evidenceCount(G) < EVIDENCE_NEEDED) {
        const n = evidenceCount(G);
        sayAll(G, [['Maya', `We only have ${n} piece${n === 1 ? '' : 's'} of evidence. Let\'s find ${EVIDENCE_NEEDED}, then decide.`]]);
        return;
    }
    if (who === 'ghost') {
        flag(G, 'case_solved');
        flag(G, 'ball_open');
        G.events.push({ type: 'solved' });
        G.events.push({ type: 'unlock', id: 'd_f_ballroom' });
        sayAll(G, [
            ['Maya', 'It\'s a ghost. And I don\'t think she\'s a scary one. I think she\'s lonely. She\'s been waiting for friends for a hundred years.'],
            ['Dev', 'Then let\'s be her friends.'],
            ['June', 'Let\'s throw her the party she never got.'],
            ['', 'Far away, in the foyer, the ribbon of light on the ballroom doors fades, and the doors swing slowly open.'],
        ]);
    } else if (SUSPECTS[who]) {
        G.events.push({ type: 'wrong', who });
        sayAll(G, [SUSPECTS[who].no(G)]);
    }
}

/** Winnie's conversation: say the node's lines, then wait for a choice (or finish). */
export function startTalk(G, node) {
    G.talk = { node };
    sayAll(G, TALK[node].lines);
    G.events.push({ type: 'talk', node });
    if (TALK[node].end) endTalk(G);
}

export function chooseTalk(G, i) {
    const node = TALK[G.talk.node];
    const c = node.choices[i];
    if (!c) return;
    say(G, c.who, c.text);
    G.f['bond_' + c.id] = (G.f['bond_' + c.id] || 0) + 1;
    G.f.bond_last = c.id;                      // a tie goes to the last thing you said
    G.events.push({ type: 'choice', id: c.id });
    sayAll(G, c.reply);
    startTalk(G, node.next);
}

function endTalk(G) {
    G.talk = null;
    let best = G.f.bond_last || 'warm';
    for (const k of ['warm', 'funny', 'brave']) if ((G.f['bond_' + k] || 0) > (G.f['bond_' + best] || 0)) best = k;
    G.ending = best;
    G.events.push({ type: 'ending', kind: best });
}
