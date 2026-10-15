// The main story: the arrival, meeting Wick, restoring each grimoire, the Undercroft, the end.
// Also what Wick thinks you should do next (the objective), which the HUD shows and the bot
// follows.

import { GRIMOIRE, BOOK_ORDER } from './data/books.js';
import { FOE } from './data/enemies.js';
import { getWorld } from './worldgen.js';
import { DUNGEONS } from './data/maps.js';

const S = (who, text) => ['say', who, text];
const W = (text) => ['say', 'wick', text];
const N = (text) => ['say', 'note', text];

// What each grimoire's dungeon needs to be reached, at the least. dev/simtest.mjs proves these
// against the real map: everything listed is needed, and nothing more is.
export const BOOK_REQ = {
    lumen: [], gust: ['lumen'], ember: ['gust'], stone: ['ember'], frost: ['stone'], tide: ['stone'],
    small: ['frost'], verdant: ['small'], echo: ['tide'], key: ['echo'], feather: ['key'], stars: ['verdant', 'feather'],
};
export const BOOK_DUNGEON = {
    lumen: 'hollowoak', gust: 'glimmer', ember: 'kiln', stone: 'quarry', frost: 'rime', tide: 'lighthouse',
    small: 'burrow', verdant: 'greenhouse', echo: 'archive', key: 'abbey', feather: 'keep', stars: 'observatory',
};

const WICK_HINT = {
    lumen: 'I can feel a little light flickering out west, past the farms. In the Hollow Oak, deep in Whisperwood!',
    gust: 'Something\'s howling in the dark under Glimmer Hollow, north in the woods. Now we have a light, we can go in.',
    ember: 'With the Almanac\'s wind we can blow the fog off Mistmoor. I smell smoke up there… the old Cinder Kiln, on the ridge.',
    stone: 'Fire for brambles! Thornvale\'s south of Whisperwood, and past it the Stoneheart Quarry. Something down there is grumbling.',
    frost: 'Stones will move for us now. The rockslide on the Frostmantle Pass, north of Shepherd\'s Rise — and the Rime Temple beyond.',
    tide: 'The coast road\'s rockslide! East of Fennimore\'s Downs. The lighthouse at Saltmere has been dark too long.',
    small: 'With frost we can freeze the river south of Willowbank. Mousehold is over there, and something is squeaking under it.',
    verdant: 'Small enough for a mouse door! There\'s one in the hedge east of Burrow Gardens, and the old Glasshouse behind it.',
    echo: 'We can swim! Out to Archive Isle, in the middle of Lumen Lake. The old Archive sank there. Listen… something\'s wailing.',
    key: 'The Echo Codex can talk to ghosts. Gloaming Abbey, in the far north-west of Mistmoor — its gates are ghost-sealed.',
    feather: 'Rune seals open for us now! The Old Keep, beside the Great Hall of Castle Aubade. The Queen\'s friend is in there.',
    stars: 'Vines up the cliffs, and feathers across the gaps. Skyreach! The Observatory on the farthest isle. One last book.',
};

function doorOf(id) {
    const { maps, W: WW } = getWorld();
    const w = maps.world;
    for (const k in w.warps) if (w.warps[k].to === id) return { x: k % WW, y: Math.floor(k / WW) + 1 };
    return null;
}
function bossTile(id) {
    const M = getWorld().maps[id];
    for (const k in M.objs) if (M.objs[k].kind === 'boss') return { x: k % M.w, y: Math.floor(k / M.w) + 1 };
    return null;
}

export function nextBook(G) {
    for (const id of BOOK_ORDER) {
        if (G.books.includes(id)) continue;
        if (BOOK_REQ[id].every((r) => G.books.includes(r))) return id;
    }
    return null;
}

/** What Wick suggests now: { text, map, x, y } (x, y in tiles; the target's doorstep). */
export function objective(G) {
    if (!G.flags.metWick) {
        const d = doorOf('library');
        return { text: 'Step inside the Lantern Library.', map: 'world', x: d.x, y: d.y };
    }
    const unplaced = G.books.filter((b) => !G.placed.includes(b));
    if (unplaced.length) {
        const where = G.map === 'library' ? { map: 'library', x: 17, y: 7 } : { map: 'world', ...doorOf('library') };
        return { text: `Take ${GRIMOIRE[unplaced[0]].title} home to a lectern in the Rotunda.`, ...where };
    }
    if (G.flags.won) return { text: 'The library is open. Wander, read, and have some tea.', map: null };
    if (G.books.length === 12) {
        if (G.map === 'undercroft') return { text: 'Find Marigold, deep in the Undercroft.', map: 'undercroft', ...bossTile('undercroft') };
        const lib = getWorld().maps.library;
        const seal = Object.keys(lib.warps).map(Number).find((k) => lib.warps[k].star);
        const open = G.opened.library?.[seal];
        if (G.map === 'library') return { text: open ? 'Go down through the star seal, into the Undercroft.' : 'Open the star seal in the middle of the Rotunda.', map: 'library', x: 17, y: open ? 5 : 6 };
        return { text: 'Every grimoire is home. Open the star seal beneath the Rotunda.', map: 'world', ...doorOf('library') };
    }
    const id = nextBook(G);
    if (!id) return { text: 'Explore Vellumvale.', map: null };
    const dg = BOOK_DUNGEON[id];
    const dname = DUNGEONS.find((d) => d.id === dg).name;
    if (G.map === dg) return { text: `Find ${GRIMOIRE[id].title} somewhere in ${dname}.`, map: dg, ...bossTile(dg), book: id };
    return { text: `Find ${GRIMOIRE[id].title} in ${dname}.`, map: 'world', ...doorOf(dg), book: id, hint: WICK_HINT[id] };
}

// ------------------------------------------------------------------ scripts
export function introScript() {
    return [
        N('The coach rattles away down the hill, and you are standing in Lantern Square, Quillford, with a suitcase and a letter of appointment.'),
        S('mayor', 'Ah! You must be the new Librarian! Welcome to Quillford, and to the Lantern Library. I\'m Mayor Thistlewood. Mostly ceremonial. Partly decorative.'),
        S('mayor', 'I\'ll be honest with you. The library has been shut for years — ever since old Marigold Ashby, the last Librarian, vanished.'),
        S('mayor', 'One stormy night every book in it flew out of the windows like a flock of starlings. Scattered all over Vellumvale. Some of them have gone… a bit wild.'),
        S('mayor', 'They say a true Librarian can use the magic of any book in their library. Well — you\'ve got a library. It just hasn\'t got any books.'),
        S('mayor', 'Here\'s the key. It\'s all yours, Librarian. Do your best — and do drop in on the village. Everyone\'s ever so glad you came.'),
        ['give', 'libkey', 1],
        N('Received the Library Key. The Lantern Library stands right behind you.'),
    ];
}

export function meetWickScript() {
    return [
        N('The library is cold and silent. Loose pages drift across the floor like autumn leaves. Every shelf is bare.'),
        N('Then, in the dead hearth of the study, something crackles.'),
        W('Oh! Oh my. A visitor? No… a LIBRARIAN! I can tell by the cardigan.'),
        W('I\'m Wick. I live in the hearth. At least, I think I do. I can\'t remember much of anything from before the books left.'),
        W('A library\'s magic lives in its books, you know. Bring them home and the library will lend you their magic. All of it. That\'s how it works for Librarians.'),
        W('There are twelve grimoires — the great books, the ones that kept this place warm. Without them the library is just… a cold old building. And I\'m just a spark.'),
        W('I can feel one of them out there. A little light, flickering in the west. The Lumen Primer, I think! In the Hollow Oak, deep in Whisperwood.'),
        W('Let\'s go and fetch it! I\'ll come with you. I\'m small, but I\'m very good at being warm.'),
        ['flag', 'metWick', 1],
        N('Wick will follow you everywhere. In squabbles with runaway books, Wick will help. Press Action near things to talk, read and open.'),
    ];
}

export function bossIntro(G, id) {
    const d = FOE[id];
    if (d.final) return [
        N('In the deepest part of the Undercroft, the dark is wet and moving. A great Blot of ink rises off the floor, with too many eyes, all of them sad.'),
        W('That\'s it. That\'s the curse. I… I remember now. It came up out of the old stacks, all the stories nobody tells anymore, and it was so hungry.'),
        W('I held the door shut from this side. And it held me. And the books ran, to keep themselves safe. Oh, apprentice — you\'ve come all this way.'),
        W('Don\'t fight it. It\'s only lonely. Tell it a story. Tell it every story we\'ve got.'),
        ['battle', id],
    ];
    const book = GRIMOIRE[d.book];
    return [
        N(`Something enormous is thrashing about in here. Pages whirl. It is ${d.name}.`),
        W(`That\'s ${book.title}! It\'s run wild — it\'s frightened. Let\'s calm it down. Gently, now.`),
        ['battle', id],
    ];
}

export function bossWonScript(G, bookId) {
    const book = GRIMOIRE[bookId];
    return [
        N(`The guardian settles, page by page, and falls softly into your hands. It is ${book.title}.`),
        W(`You did it! Oh, it\'s purring. Books don\'t purr. Listen to it purr.`),
        N(`You can use its magic now — ${book.power}`),
        N(`In battle, read its spell: ${book.spell.name} (${book.spell.ink} ink).`),
        W('Shall I take us home? I can find the library from anywhere. It\'s like a smell. A nice smell. Toast.'),
        ['choice', [['Go home with Wick', 'home'], ['Stay and explore', 'stay']]],
        ['label', 'home'], ['warp', 'library', 17, 9], ['end'],
        ['label', 'stay'], W('All right! But don\'t forget, it wants to go back on its lectern.'),
    ];
}

const MILESTONE = {
    1: 'The Rotunda flickers. One lamp, in a ring of twelve, has lit itself.',
    3: 'The loose pages in the atrium flutter, and a few of them stack themselves neatly on a table.',
    6: 'Half the lamps in the Rotunda are lit. The library smells of old paper and warm dust again — the best smell there is.',
    9: 'The floor of the Rotunda hums. Far below, something answers it — something cold, and something warm.',
    12: 'Every lamp in the Rotunda is burning. In the middle of the floor, a seal of stars begins to glow.',
};

export function placeScript(G) {
    const ops = [];
    const unplaced = G.books.filter((b) => !G.placed.includes(b));
    let n = G.placed.length;
    for (const id of unplaced) {
        n++;
        const b = GRIMOIRE[id];
        ops.push(N(`You set ${b.title} on its lectern. The pages riffle open, and settle.`));
        ops.push(['placeOne', id]);
        ops.push(W(b.memory));
        if (MILESTONE[n]) ops.push(N(MILESTONE[n]));
        if (n === 6) ops.push(W('Apprentice… I think I used to be someone. Not a spark. A someone. With hands, and a teapot.'));
        if (n === 9) ops.push(W('I was the Librarian. Before you. Marigold. My body is still down there, under the Rotunda, in the Undercroft. Asleep, I think. Waiting.'));
        if (n === 12) ops.push(W('That\'s all twelve. The star seal — it\'s the door to the Undercroft. Open it, and come and get me. Please.'));
    }
    const next = nextBook({ ...G, books: G.books });
    if (n < 12 && next) ops.push(W(WICK_HINT[next]));
    return ops;
}

export function lecternText(G, n) {
    const id = G.placed[n];
    if (!id) return [N(G.placed.length < 12 ? 'An empty lectern, waiting for a grimoire.' : '…')];
    const b = GRIMOIRE[id];
    return [N(`${b.title}: ${b.lore}`)];
}

export function hearthScript(G) {
    const lines = [
        'Home sweet hearth. Did you know a library is the only building that\'s bigger on the inside? It\'s true. Because of the books.',
        'If you get tired, the bed in here is yours. Rest, and you\'ll feel like a new chapter.',
        'The Returns Cart in the Reading Room — put the little books there and they\'ll find their own shelves. They\'re very well trained.',
        'Runaway books calm down when you read them first. Understanding is half of calming. The other half is snacks.',
    ];
    return [W(G.flags.won ? 'I\'m not in the hearth anymore! Well, a bit of me is. The warm bit. Marigold kept the warm bit.' : lines[(G.placed.length + G.lvl) % lines.length])];
}

export function finalScript() {
    return [
        N('The Blot shivers… and settles. Page by page, the ink draws itself into lines, and the lines into words, and the words into a great book bound in midnight blue.'),
        N('It is The Chronicle of Vellumvale: every story the kingdom ever told and then forgot.'),
        W('Oh… look at it. It was never a monster. It was only everything nobody remembered.'),
        N('Wick flares brighter, and brighter, until you have to shade your eyes —'),
        S('marigold', 'There. That\'s better. Goodness, my knees. Have I been lying on a stone floor for eleven years? I have, haven\'t I.'),
        S('marigold', 'Hello, apprentice. Sorry — Librarian. You\'ve earned the title twice over.'),
        S('marigold', 'I\'m Marigold. I was Wick. I suppose I\'ll always be a little bit Wick. I\'ve still got the urge to sit in the fireplace.'),
        S('marigold', 'Let\'s go upstairs. I want to see the Rotunda with all its lamps lit. And then I want a very, very large pot of tea.'),
        ['flag', 'won', 1],
        ['final'],
        ['warp', 'library', 17, 9],
    ];
}

export function shelveScript(G, n, gifts) {
    const ops = [N(n ? `You load ${n} book${n === 1 ? '' : 's'} onto the Returns Cart. They wriggle off it one at a time and hop onto their shelves.` : 'The Returns Cart is empty. Calm runaway books on your travels and they\'ll turn back into ones you can return here.')];
    for (const g of gifts) ops.push(N(`The ${g.genre} shelf is complete! Tucked behind the last book: ${g.name}.`));
    return ops;
}
