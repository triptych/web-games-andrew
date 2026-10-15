// The people (and mice, and cats, and one snowman) of Vellumvale.
//
// talk(G) returns a script: a list of ops the sim runs in js/sim/dialog.js.
//   ['say', who, text]            who: an npc id, 'wick', 'you', 'note' (narration)
//   ['choice', [[label, goto], …]] ['label', name]  ['goto', name]  ['end']
//   ['give', item, n]  ['take', item, n]  ['coins', n]  ['common', bookId]  ['xp', n]
//   ['flag', name, value]  ['quest', id, 'active'|'done']  ['need', {coins|item}, elseLabel]
//   ['shop', id]  ['rest', price]  ['place']  ['shelve']  ['final']
// Scripts read the game state when they are built, never change it themselves: the ops do.

import { OVERDUE } from './quests.js';
import { COMMON } from './books.js';

const S = (who, text) => ['say', who, text];
const W = (text) => ['say', 'wick', text];
const N = (text) => ['say', 'note', text];

const SK = ['#f3d2b3', '#e2b48c', '#c58c5f', '#8d5a3b', '#5e3b26'];
const P = (k, o = {}) => ({ k, ...o });
const H = (o) => P('human', o);

const books = (G) => G.books.length;
const q = (G, id) => G.quests[id];

// An overdue borrower: hand the book back once the Mayor has asked you to collect them.
function overdue(G, id, lines) {
    const o = OVERDUE.find((x) => x.npc === id);
    if (q(G, 'overdue') !== 'active' || G.flags['od_' + id]) return null;
    return [
        S(id, lines),
        ['common', o.book], ['flag', 'od_' + id, 1],
        N(`Got back "${COMMON[o.book].title}". ${OVERDUE.filter((x) => G.flags['od_' + x.npc]).length + 1} of 8 overdue books returned.`),
    ];
}

const SHOPKEEP = (id, shop, hello) => (G) => [S(id, hello(G)), ['shop', shop]];
const INNKEEP = (id, hello, price = 10) => (G) => [
    S(id, hello(G)),
    ['choice', [[`Rest (${price} coins)`, 'rest'], ['Not just now', 'bye']]],
    ['label', 'rest'], ['need', { coins: price }, 'poor'], ['coins', -price], ['rest'],
    S(id, 'Sleep tight. Breakfast is toast and jam, whenever you wake.'), ['end'],
    ['label', 'poor'], S(id, 'Oh, love, you\'re a little short. Come back when the books have paid you.'), ['end'],
    ['label', 'bye'], S(id, 'The door\'s always open.'),
];

export const NPCS = {
    // ======================================================== Wick and Marigold
    wick: { name: 'Wick', look: P('wick') },
    marigold: {
        name: 'Marigold', look: H({ skin: SK[0], hair: 'bun', hc: '#e8e4dc', top: '#c6763a', bottom: '#6b4a3a', acc: 'glasses' }),
        when: (G) => !!G.flags.won,
        talk: (G) => {
            if (G.bag.teaset) return [
                S('marigold', 'My teapot! You found my teapot! It was down there with me the whole time, poor thing.'),
                ['take', 'teaset', 1],
                S('marigold', 'Sit down, apprentice. No — Librarian. Sit down, Librarian, and I\'ll make us both a pot. Wick always took two sugars. I suppose that means I do.'),
                ['give', 'cocoa', 5], ['flag', 'teaParty', 1],
            ];
            return [
                S('marigold', G.flags.teaParty ? 'More tea? The library is full of readers again. Listen to them turning pages. Best sound in the world.'
                    : 'It\'s so warm up here. I\'d forgotten. Somewhere in the Undercroft there\'s my old teapot. If you ever find it, we\'ll have a proper cup.'),
            ];
        },
    },

    // ======================================================== Quillford and Lantern Square
    mayor: {
        name: 'Mayor Thistlewood', look: H({ skin: SK[1], hair: 'bald', hc: '#cfc6b8', top: '#3b5a8a', bottom: '#2e2e3a', hat: 'top', acc: 'beard' }),
        talk: (G) => {
            if (!G.flags.metWick) return [S('mayor', 'In you go, Librarian! The key\'s a bit stiff. Jiggle it and say something nice.')];
            if (!q(G, 'overdue') && books(G) >= 1) return [
                S('mayor', 'A grimoire back already! Splendid. Now — slightly embarrassing municipal matter.'),
                S('mayor', 'Eight people in this kingdom have had library books out for, ahem, rather a long time. Since before the library closed.'),
                S('mayor', 'I\'d be ever so grateful if you\'d collect them on your travels. Everyone knows the Librarian\'s word is law, overdue-wise.'),
                ['quest', 'overdue', 'active'],
                N('New quest: Overdue! (See your journal.)'),
            ];
            if (q(G, 'overdue') === 'active' && OVERDUE.every((o) => G.flags['od_' + o.npc])) return [
                S('mayor', 'All eight! Not a single fine levied, I hope. No? Good. Fines are so uncosy.'),
                S('mayor', 'The council has voted you these. Well, I voted. The council is mostly me.'),
                ['give', 'patch', 2], ['coins', 200], ['quest', 'overdue', 'done'],
                N('Received 2 Quilt Patches and 200 coins.'),
            ];
            if (G.flags.won) return [S('mayor', 'The Lantern Library, open again, and Marigold home! I\'m declaring a festival. Every year. Forever. That\'s within my powers, I checked.')];
            if (books(G) >= 6) return [S('mayor', 'People say they can see the library windows glowing from the castle road at night. Like old times.')];
            return [S('mayor', q(G, 'overdue') === 'active' ? 'Any luck with those overdue books? Old Ben\'s just over in Quillford, if you want an easy one.' : 'If the library needs anything, anything at all, the town will find it. Within reason. And budget.')];
        },
    },
    mayorwife: {
        name: 'Clementine Thistlewood', look: H({ skin: SK[1], hair: 'curly', hc: '#b0623a', top: '#7a9a5a', bottom: '#4a3a2a' }),
        talk: (G) => [S('mayorwife', books(G) < 3
            ? 'Bartholomew hasn\'t slept properly since the library closed. He used to read in the bath. Now he just lies there, sighing.'
            : 'He\'s reading in the bath again! Library books, too. I\'ve hidden the towels so he\'ll have to be careful.')],
    },
    mayorpost: {
        name: 'Dot the Postmistress', look: H({ skin: SK[2], hair: 'pony', hc: '#3a2a1e', top: '#c0392b', bottom: '#2e3a5a', hat: 'cap' }),
        talk: (G) => [S('mayorpost', books(G) === 0
            ? 'Post for the Librarian! Oh — it\'s your own appointment letter. It came back. The library\'s letterbox has been jammed with pages for years.'
            : books(G) < 6 ? 'The north road goes up to Aubade and the castle. West are the farms and Whisperwood. East, the Downs — but the coast road\'s blocked by a rockslide.'
                : 'Letters are flying again! Everybody\'s writing to everybody about the library. It\'s the best for business since the Great Valentine of \'09.')],
    },
    kid_tam: {
        name: 'Tam', look: P('kid', { skin: SK[3], hair: 'curly', hc: '#2a1e18', top: '#e9a64e', bottom: '#3a5a8a' }),
        talk: (G) => {
            if (q(G, 'cat') === 'done') return [S('kid_tam', 'Biscuit\'s asleep on the well again. She says thank you. Well, she said "mrrp", but I know what she means.')];
            if (G.flags.catFound) return [
                S('kid_tam', 'BISCUIT! You found her! She came trotting down the road like she\'d never been gone!'),
                S('kid_tam', 'Here — it\'s my lucky acorn. It\'s the luckiest one I ever found. You should have it.'),
                ['give', 'acorn', 1], ['coins', 30], ['quest', 'cat', 'done'], N('Received the Lucky Acorn and 30 coins.'),
            ];
            if (!q(G, 'cat')) return [
                S('kid_tam', 'Are you the new librarian? My cat Biscuit chased a paper moth into Whisperwood and she hasn\'t come back.'),
                S('kid_tam', 'She\'s orange and round and she likes being called "Your Majesty". Can you look for her?'),
                ['quest', 'cat', 'active'], N('New quest: Where Is Biscuit?'),
            ];
            return [S('kid_tam', 'Whisperwood\'s west, past the farms. Biscuit hates getting her paws wet, so she won\'t have gone near the brook.')];
        },
    },
    catbiscuit_home: {
        name: 'Biscuit', look: P('cat', { top: '#e8913a' }), when: (G) => !!G.flags.catFound,
        talk: () => [S('catbiscuit_home', 'Mrrp.'), N('Biscuit permits one (1) chin scratch.')],
    },
    oldben: {
        name: 'Old Ben', look: H({ skin: SK[0], hair: 'bald', hc: '#ddd', top: '#7a6a4a', bottom: '#3a3a3a', acc: 'beard' }),
        talk: (G) => overdue(G, 'oldben', 'Overdue? This? I\'ve only had it thirty-one years. I was getting to the good bit. Fine, fine — mind the coffee rings.')
            || [S('oldben', books(G) < 1 ? 'Marigold used to read to us all by the hearth in winter. Haven\'t had a proper winter since.' : 'You\'ve got her look about you, you know. Marigold\'s. Like you\'re about to recommend something.')],
    },
    hen_lady: {
        name: 'Henrietta', look: H({ skin: SK[1], hair: 'bun', hc: '#8a8a8a', top: '#c9a6e0', bottom: '#4a3a5a', acc: 'apron' }),
        talk: (G) => [S('hen_lady', 'My hens have stopped laying since the books blew away. They used to listen to the story hour through the window. They\'re very literary hens.')],
    },
    gardener_poppy: {
        name: 'Poppy', look: H({ skin: SK[2], hair: 'pony', hc: '#c0623a', top: '#5fae6a', bottom: '#6a4a2a', hat: 'straw' }),
        talk: (G) => [S('gardener_poppy', books(G) < 4 ? 'I keep the library garden tidy, even with nobody to see it. Marigold planted these marigolds. Well. Obviously.' : 'The marigolds are blooming out of season! The whole bed. It\'s the library — it\'s waking up.')],
    },
    busker: {
        name: 'Fiddler Jory', look: H({ skin: SK[4], hair: 'short', hc: '#1a1210', top: '#8a3a5a', bottom: '#2a2a3a', hat: 'beret' }),
        talk: (G) => [S('busker', G.common.b43 === 2 ? 'Someone put "Harvest Rounds" back on the shelf! I\'ve been trying to remember the third verse for six years!' : 'I only know half of every song. The other halves were in the library\'s Songbooks. If you find them, I\'ll learn the rest.')],
    },
    pip: {
        name: 'Pip', look: H({ skin: SK[1], hair: 'short', hc: '#d8b048', top: '#5a8a4a', bottom: '#4a3a2a', acc: 'apron' }),
        talk: SHOPKEEP('pip', 'quill_general', (G) => books(G) < 1 ? 'Welcome to Pip\'s! Tea for nerves, biscuits for bigger nerves, ink for the magic sort of nerves.' : 'Back again! You look like someone who\'s been talking runaway books down off ledges. Biscuit?'),
    },
    mabel: {
        name: 'Mabel', look: H({ skin: SK[0], hair: 'bun', hc: '#c9c9c9', top: '#b84a6a', bottom: '#5a4a6a', acc: 'glasses' }),
        talk: SHOPKEEP('mabel', 'quill_tailor', () => 'A librarian needs a good cardigan. Pockets for bookmarks, elbows for leaning, and a knit you can hide in when the world is loud.'),
    },
    bramwell: {
        name: 'Bramwell', look: H({ skin: SK[2], hair: 'short', hc: '#6a4a2a', top: '#f2efe2', bottom: '#4a3a2a', hat: 'chef', acc: 'apron' }),
        talk: (G) => {
            if (q(G, 'flour') === 'done') return [S('bramwell', 'Fresh bread every morning again! First slice is always yours, Librarian. That\'s the law. My law. Bakery law.')];
            if (G.bag.flour) return [
                S('bramwell', 'FLOUR! Beautiful, powdery flour! Let me just — oh, I\'m going to make a loaf the size of a sheep.'),
                ['take', 'flour', 1], ['give', 'biscuit', 3], ['common', 'b7'], ['coins', 40], ['quest', 'flour', 'done'],
                S('bramwell', 'Here: biscuits, coins, and — this was in my flour bin, of all places. One of yours, I think? "The Honest Biscuit". Very honest. Brutal, really.'),
                N('Received 3 Honey Biscuits, 40 coins and a book: "The Honest Biscuit".'),
            ];
            if (!q(G, 'flour')) return [
                S('bramwell', 'No bread today, I\'m afraid. No flour! The miller\'s cart can\'t get through — the mill road is swarming with paperbacks.'),
                S('bramwell', 'Hearthfield Mill is west of the village. If you were passing… a sack of flour would make a baker very happy.'),
                ['quest', 'flour', 'active'], N('New quest: A Baker Without Flour.'),
            ];
            return [S('bramwell', 'The mill\'s west, past Hearthfield. Big windmill. Can\'t miss it. Well, you could, but it would take effort.')];
        },
    },
    hattie: {
        name: 'Hattie', look: H({ skin: SK[1], hair: 'long', hc: '#9a8a7a', top: '#5a7aaa', bottom: '#3a3a4a', acc: 'glasses' }),
        talk: (G) => {
            if (q(G, 'letter') === 'done') return [S('hattie', 'Meg says the sea air is doing her good and that I should visit. Me! On a cart! I might, you know.')];
            if (G.bag.reply) return [
                S('hattie', 'A letter from Meg! Oh, her handwriting\'s got worse. Lovely. Thank you, dear. Here — a little charm for your troubles.'),
                ['take', 'reply', 1], ['give', 'teacup', 1], ['quest', 'letter', 'done'], N('Received the Teacup Charm.'),
            ];
            if (!q(G, 'letter') && books(G) >= 2) return [
                S('hattie', 'My sister Meg is a netmaker in Saltmere, on the coast. We wrote every week until the rockslide closed the road.'),
                S('hattie', 'If you ever get through to the coast, would you take her this? And bring back whatever she says?'),
                ['give', 'letter', 1], ['quest', 'letter', 'active'], N('New quest: A Letter for Saltmere. Received a Sealed Letter.'),
            ];
            return [S('hattie', q(G, 'letter') === 'active' ? 'Saltmere\'s past the Eastern Downs. They say a rockslide blocks the road. They say lots of things.' : 'Tea? No? Quite right, you\'re busy. Mind the step.')];
        },
    },
    rosalind: {
        name: 'Rosalind', look: H({ skin: SK[3], hair: 'curly', hc: '#3a2a1a', top: '#d9a64a', bottom: '#6a3a2a', acc: 'apron' }),
        talk: INNKEEP('rosalind', () => 'Welcome to the Sleepy Owl! Ten coins for a bed, a hot-water bottle, and an owl that hoots you to sleep. Not a real owl. My husband.'),
    },

    // ======================================================== the farms and Whisperwood
    miller: {
        name: 'Miller Hobb', look: H({ skin: SK[1], hair: 'short', hc: '#e0dcd0', top: '#d8d0b8', bottom: '#6a5a4a', hat: 'cap' }),
        talk: (G) => {
            if (q(G, 'flour') === 'active' && !G.bag.flour && !G.flags.gotFlour) return [
                S('miller', 'Flour for Bramwell? Bless him. I\'ve been milling all month and nobody can get through to buy it. Here — take two sacks. No, one. Your back.'),
                ['give', 'flour', 1], ['flag', 'gotFlour', 1], N('Received a Sack of Flour.'),
            ];
            return [S('miller', 'The sails turn whether anyone buys the flour or not. Bit like writing, I suppose. You do it because the wind\'s blowing.')];
        },
    },
    scarecrow: {
        name: 'Scarecrow', look: P('scarecrow'),
        talk: (G) => [N(books(G) < 3 ? 'The scarecrow has a library card pinned to its chest. It expired eleven years ago.' : 'The scarecrow\'s library card has been renewed in neat green ink. You don\'t remember doing that.')],
    },
    farmerjo: {
        name: 'Farmer Jo', look: H({ skin: SK[3], hair: 'pony', hc: '#5a3a1a', top: '#6a8a3a', bottom: '#3a5a8a', hat: 'straw' }),
        talk: (G) => [S('farmerjo', 'Runaway paperbacks keep nesting in my turnips. Calm one down and it turns right back into a book — Gran says that\'s the Librarian\'s gift.')],
    },
    farmwife: {
        name: 'Nell', look: H({ skin: SK[1], hair: 'bun', hc: '#a0603a', top: '#c97a8a', bottom: '#4a4a3a', acc: 'apron' }),
        talk: (G) => [S('farmwife', 'Make yourself at home. If a book flies through the window, just shut it. The window, I mean. Well. Both.')],
    },
    oldfarmer: {
        name: 'Old Wendel', look: H({ skin: SK[2], hair: 'bald', hc: '#ccc', top: '#7a5a3a', bottom: '#3a3a2a', acc: 'beard' }),
        talk: (G) => [S('oldfarmer', 'You calm \'em with a "shhh"? Ha! Marigold did that. Ran the library like a hushed little kingdom. Even the mice used their inside voices.')],
    },
    orchardist: {
        name: 'Orla', look: H({ skin: SK[0], hair: 'long', hc: '#d8a048', top: '#d9562f', bottom: '#5a4a2a', hat: 'straw' }),
        talk: (G) => [S('orchardist', books(G) < 4 ? 'There\'s a silver inkwell behind that big rock by the fence. My grandad hid it there. Nobody\'s been able to shift the rock since.' : 'Did you move the rock? Did it just… roll away when you asked? Grandad always said you had to ask stones nicely.')],
    },
    pumpkingran: {
        name: 'Granny Gourd', look: H({ skin: SK[2], hair: 'bun', hc: '#e0e0e0', top: '#e08a3a', bottom: '#4a5a2a', acc: 'glasses' }),
        talk: (G) => [S('pumpkingran', 'There\'s a chest out on that little island in the pond. Swum out to it as a girl. Can\'t now. Knees. And I\'ve forgotten how to swim. Mostly knees.')],
    },
    fisherboy: {
        name: 'Rowan', look: P('kid', { skin: SK[1], hair: 'short', hc: '#c8783a', top: '#3a8ac8', bottom: '#4a4a3a', hat: 'cap' }),
        talk: (G) => [S('fisherboy', books(G) < 5 ? 'Out in the middle of Lumen Lake there\'s an island with a door on it. A DOOR. To where?! You\'d have to swim like a fish to find out.' : 'Can you really swim now? Like, out to the door island? Tell me what\'s inside. Is it fish? I bet it\'s fish.')],
    },
    biscuitcat: {
        name: 'An orange cat', look: P('cat', { top: '#e8913a' }), when: (G) => !G.flags.catFound,
        talk: (G) => q(G, 'cat') === 'active' ? [
            S('biscuitcat', 'Mrrrow.'),
            W('This must be Biscuit! Round, orange, and looking at us like we\'re late with her dinner.'),
            ['say', 'you', '"Your Majesty, Tam is waiting for you at home."'],
            N('Biscuit considers this, stretches magnificently, and trots off towards Quillford.'),
            ['flag', 'catFound', 1],
        ] : [S('biscuitcat', 'Mrrp.'), N('An orange cat is watching a paper moth with enormous concentration.')],
    },
    ranger: {
        name: 'Ranger Ashe', look: H({ skin: SK[3], hair: 'pony', hc: '#2a1e18', top: '#3a6a3a', bottom: '#5a4a2a', hat: 'hood' }),
        talk: (G) => [S('ranger', books(G) < 1
            ? 'I saw a light in the Hollow Oak last night. Flickering, like someone reading under the covers with a candle. West of here, through the glade.'
            : books(G) < 3 ? 'North of the woods is Mistmoor. Fog so thick you can lean on it. No one\'s been through in years.'
                : 'The brambles south of the woods grew all at once, the night the library fell. Thornvale\'s behind them. And the old quarry.')],
    },

    // ======================================================== the hills, the Downs
    shepherd: {
        name: 'Shepherd Gil', look: H({ skin: SK[1], hair: 'curly', hc: '#6a4a2a', top: '#8a9a6a', bottom: '#5a4a3a', hat: 'cap', acc: 'staff' }),
        talk: (G) => overdue(G, 'shepherd', '"Ferns of the Whisperwood"? Oh, the sheep ate the index. Just the index, mind. Very discerning sheep.')
            || [S('shepherd', 'There\'s a chest in a hollow up here, inside a fog bank that never lifts. The sheep won\'t go near it. They\'re not stupid, sheep. People think they are.')],
    },
    fennimore: {
        name: 'Old Fennimore', look: H({ skin: SK[0], hair: 'long', hc: '#f0f0f0', top: '#6a5a8a', bottom: '#3a3a4a', acc: 'beard' }),
        talk: (G) => {
            const od = overdue(G, 'fennimore', 'Overdue? Young one, I am ninety-four. Everything is overdue. But yes, here\'s your "Stones That Hum". It hums. That\'s why I kept it.');
            if (od) return od;
            if (q(G, 'seeds') === 'done') return [S('fennimore', 'Look at them, the glass flowers. When the sun\'s low they ring like little bells. I\'ll die happy. Not soon. But happy.')];
            if (G.bag.seeds) return [
                S('fennimore', 'Glass-flower seeds! Oh, I haven\'t seen these since I was a boy. Marigold brought me some once. Here — take this. It was my wife\'s.'),
                ['take', 'seeds', 1], ['give', 'locket', 1], ['quest', 'seeds', 'done'], N('Received the Hearth Locket.'),
            ];
            if (!q(G, 'seeds') && books(G) >= 3) return [
                S('fennimore', 'Before the Glasshouse south of Mousehold was overgrown, it grew glass flowers. Petals like windowpanes.'),
                S('fennimore', 'If you ever find seeds, bring them here. I\'ve got one more garden in me.'),
                ['quest', 'seeds', 'active'], N('New quest: Glass Flowers.'),
            ];
            return [S('fennimore', 'Sit, sit. I\'ve been watching the Skyreach cliffs from here for seventy years. Vines used to grow up them like ladders.')];
        },
    },

    // ======================================================== Aubade
    guard_left: {
        name: 'Guard Pim', look: P('knight', { top: '#9aa3b5', bottom: '#3a5a9a' }),
        talk: (G) => [S('guard_left', books(G) < 9 ? 'The Great Hall\'s open to all. But the Old Keep, there, has been rune-sealed since the library fell. Nobody\'s got the words to open it.' : 'You read the seal open?! I\'m telling my mum.')],
    },
    guard_right: {
        name: 'Guard Pom', look: P('knight', { top: '#9aa3b5', bottom: '#3a5a9a' }),
        talk: (G) => [S('guard_right', 'I\'m Pom. He\'s Pim. We\'re not brothers. We get that a lot.')],
    },
    herald: {
        name: 'Herald Bunting', look: H({ skin: SK[1], hair: 'short', hc: '#d8b048', top: '#c0392b', bottom: '#e0c060', hat: 'plume' }),
        talk: (G) => [S('herald', books(G) === 0 ? 'Hear ye! Her Majesty Queen Isolde welcomes all to Castle Aubade! Mind the moat. There\'s no moat. Mind it anyway.' : `Hear ye! The new Librarian has returned ${books(G)} grimoire${books(G) === 1 ? '' : 's'}! Hear ye about it!`)],
    },
    queen: {
        name: 'Queen Isolde', look: H({ skin: SK[3], hair: 'long', hc: '#2a1a12', top: '#6a3a8a', bottom: '#e0c060', hat: 'crown' }),
        talk: (G) => {
            const out = [];
            if (!G.flags.metQueen) {
                out.push(S('queen', 'So you\'re the new Librarian. I spent half my childhood under the big table in that library, you know. Reading things I wasn\'t supposed to.'));
                out.push(S('queen', 'Marigold always pretended not to see me. She left the Featherfall Folio on the floor for me, open at the starlings.'));
                out.push(S('queen', 'When it all went dark, the Folio fled here, into the Old Keep. It sealed the door behind it with runes. I hear it tumbling about in there at night.'));
                out.push(S('queen', 'If you can find the words to open that seal, bring my old friend home. And I collect moon pearls — if you find any, I\'d be grateful.'));
                out.push(['flag', 'metQueen', 1], ['quest', 'pearls', 'active'], N('New quest: Moon Pearls.'));
                return out;
            }
            if (G.bag.pearl) {
                const n = (G.flags.pearls || 0) + 1;
                return [
                    S('queen', n === 1 ? 'A moon pearl! Look how it holds the light. Thank you. Please, take this from the royal sewing box.' : 'The second pearl! The pair! I shall wear them to the library\'s reopening. You must take this.'),
                    ['take', 'pearl', 1], ['flag', 'pearls', n], ['give', n === 1 ? 'patch' : 'inkwell', 1],
                    ...(n >= 2 ? [['quest', 'pearls', 'done']] : []),
                    N(n === 1 ? 'Received a Quilt Patch.' : 'Received a Silver Inkwell.'),
                ];
            }
            if (G.books.includes('feather')) return [S('queen', G.flags.won ? 'You brought them all home. And Marigold too. Vellumvale owes you its stories.' : 'The Folio is home where it belongs. Thank you, Librarian. Go on — I hear the stars calling you to Skyreach.')];
            if (G.books.includes('key')) return [S('queen', 'You have the Locksmith\'s Lexicon? Then the Old Keep is yours to open. It\'s the tower beside the hall. Please be gentle with it.')];
            return [S('queen', 'The Old Keep\'s seal answers to the Locksmith\'s Lexicon, they say, and that book fled to Gloaming Abbey, far in the misty north-west.')];
        },
    },
    chamberlain: {
        name: 'Chamberlain Quayle', look: H({ skin: SK[0], hair: 'short', hc: '#9a9a9a', top: '#2a2a4a', bottom: '#2a2a3a', acc: 'glasses' }),
        talk: (G) => [S('chamberlain', 'Her Majesty is receiving visitors. Please don\'t mention the moth incident. She\'s still very sensitive about the moth incident.')],
    },
    royalguard: {
        name: 'Captain Thorne', look: P('knight', { top: '#c0b070', bottom: '#8a2a2a' }),
        talk: (G) => [S('royalguard', 'In my day the library had a fire sprite in the hearth. Little thing. Very bossy. Kept the reading room warm all winter.'), W('Bossy?! I am NOT bossy. Tell him I\'m not bossy.')],
    },
    royalgardener: {
        name: 'Hedge-Master Fronds', look: H({ skin: SK[4], hair: 'short', hc: '#2a2a2a', top: '#3a7a3a', bottom: '#5a4a2a', hat: 'straw' }),
        talk: (G) => [S('royalgardener', 'Every hedge in this garden is clipped into the shape of a book. That one\'s a dictionary. That one\'s a cookbook. That one\'s a hedge. I gave up.')],
    },
    princess_wren: {
        name: 'Princess Wren', look: P('kid', { skin: SK[3], hair: 'long', hc: '#2a1a12', top: '#d77fb0', bottom: '#f2efe2', hat: 'tiara' }),
        talk: (G) => [S('princess_wren', G.books.includes('feather') ? 'Mother says I can borrow the Featherfall Folio when I\'m older. I\'m older now. I checked this morning.' : 'Mother says the library had a table so big you could hide under it with a lantern and nobody would find you for HOURS.')],
    },
    townscholar: {
        name: 'Scholar Penwick', look: H({ skin: SK[2], hair: 'short', hc: '#3a2a1a', top: '#4a3a6a', bottom: '#2a2a3a', acc: 'glasses' }),
        talk: (G) => [S('townscholar', 'Fascinating. A grimoire, when lost, becomes a guardian of its own pages — terrified, not wicked. You must calm it, not conquer it. Footnote twelve.')],
    },
    flowerseller: {
        name: 'Daisy', look: H({ skin: SK[1], hair: 'pony', hc: '#d8b048', top: '#f2a0b0', bottom: '#5a7a3a', hat: 'bonnet' }),
        talk: (G) => [S('flowerseller', 'Marigolds? No, sorry, they\'re all reserved for the library\'s reopening. Every single one. The Mayor\'s orders. He\'s very excited.')],
    },
    nightwatch: {
        name: 'Watchman Elm', look: H({ skin: SK[3], hair: 'short', hc: '#1a1a1a', top: '#3a3a5a', bottom: '#2a2a3a', hat: 'cap' }),
        talk: (G) => [S('nightwatch', 'I watch the night. It\'s mostly dark. Sometimes, lately, there\'s a glow from Quillford way. Your library, I reckon.')],
    },
    marketkid: {
        name: 'Fen', look: P('kid', { skin: SK[0], hair: 'short', hc: '#c0623a', top: '#5a8ac8', bottom: '#3a3a3a' }),
        talk: (G) => [S('marketkid', 'I can juggle three apples! Well. Two apples and a turnip. Well. One apple. I\'m practising.')],
    },
    juggler: {
        name: 'Juggler Rue', look: H({ skin: SK[4], hair: 'curly', hc: '#1a1210', top: '#e05a5a', bottom: '#e0c060', hat: 'beret' }),
        talk: (G) => [S('juggler', 'Tried juggling books once. Runaway paperbacks. Very bad idea. They juggled ME.')],
    },
    cartographer: {
        name: 'Cartographer Vell', look: H({ skin: SK[2], hair: 'bun', hc: '#5a3a2a', top: '#5d9bd1', bottom: '#4a3a2a', acc: 'glasses' }),
        talk: (G) => [S('cartographer', 'Every map I draw has a hole in it: the places no one\'s been since the library fell. Bring back the Maps & Travels shelf and I\'ll fill them in.'),
            N('Tip: your map (in the satchel) fills in as you explore.')],
    },
    stationer: {
        name: 'Madame Verso', look: H({ skin: SK[0], hair: 'bun', hc: '#2a1a12', top: '#2a3a6a', bottom: '#2a2a3a', acc: 'glasses' }),
        talk: SHOPKEEP('stationer', 'aub_station', () => 'Royal Stationers. Bookmarks for focus, ink for spells. Everything a calm and focused librarian needs. Nothing a frazzled one deserves.'),
    },
    curioowner: {
        name: 'Mister Odd', look: H({ skin: SK[1], hair: 'curly', hc: '#7a3a8a', top: '#4a2a4a', bottom: '#2a2a2a', hat: 'top' }),
        talk: SHOPKEEP('curioowner', 'aub_curio', () => 'Curios! Charms! Feathers from owls who know things! You can wear one at a time. One. I can tell you were going to ask.'),
    },
    grocer: {
        name: 'Grocer Plum', look: H({ skin: SK[3], hair: 'short', hc: '#2a1e18', top: '#8a5aa0', bottom: '#3a3a3a', acc: 'apron' }),
        talk: SHOPKEEP('grocer', 'aub_general', () => 'Jam tarts, tea, biscuits! The jam tarts are strawberry. They are always strawberry. That\'s not a choice, it\'s a promise.'),
    },
    innkeeper_aub: {
        name: 'Goodwife Penny', look: H({ skin: SK[1], hair: 'curly', hc: '#9a5a2a', top: '#3a6a8a', bottom: '#4a3a2a', acc: 'apron' }),
        talk: INNKEEP('innkeeper_aub', () => 'The Gilded Quill! Feather beds, quilted counterpanes, and absolutely no runaway books. We check under the beds.', 12),
    },
    lark: {
        name: 'Lark the Bard', look: H({ skin: SK[2], hair: 'long', hc: '#c0623a', top: '#e0b040', bottom: '#3a7a3a', hat: 'plume' }),
        talk: (G) => {
            if (q(G, 'poem') === 'done') return [S('lark', 'Percival and I are writing a ballad together. It\'s about a librarian. Can you guess which one? Here\'s a hint: you.')];
            if (G.bag.poem) return [
                S('lark', 'A poem? For me? From — Percival?! He rhymed "lance" with "romance"! Oh, that great tin-plated goose.'),
                S('lark', 'Here, take this. A pressed violet I\'ve kept for years, made into a bookmark. I won\'t need it to remember this day.'),
                ['take', 'poem', 1], ['give', 'pressed', 1], ['quest', 'poem', 'done'], N('Received the Pressed-Flower Bookmark.'),
            ];
            return [S('lark', 'Half the old ballads were in the library\'s Songbooks. Now I only know the choruses. A song needs its verses, Librarian.')];
        },
    },
    percival: {
        name: 'Sir Percival', look: P('knight', { top: '#b8c0d0', bottom: '#3a6a3a' }),
        talk: (G) => {
            const od = overdue(G, 'percival', '"The Locked Library"! I couldn\'t put it down. For nine years. Honestly, the twist — no, I won\'t spoil it.');
            if (od) return od;
            if (!q(G, 'poem')) return [
                S('percival', 'Librarian! A quest of the utmost delicacy. I have written a poem for Lark, the court bard. It is my finest work.'),
                S('percival', 'I cannot deliver it myself. My armour clanks when I am nervous, and I am nervous always. Would you…?'),
                ['give', 'poem', 1], ['quest', 'poem', 'active'], N('New quest: Verses for a Bard. Received Knight\'s Lost Poem.'),
            ];
            if (q(G, 'poem') === 'done') return [S('percival', 'She liked it?! She LIKED it! I must sit down. I can\'t sit down, I\'m in armour. I must lean.')];
            return [S('percival', 'Lark lives in Aubade, in the house by the fountain. Please, be casual. Very casual. Casually mention I\'m brave.')];
        },
    },
    weaver: {
        name: 'The Weaver', look: H({ skin: SK[4], hair: 'bun', hc: '#d0d0d0', top: '#a03a3a', bottom: '#5a3a2a', acc: 'glasses' }),
        talk: (G) => {
            if (q(G, 'scarf') === 'active' && !G.bag.scarf && !G.flags.gotScarf) return [
                S('weaver', 'A scarf for a snowman? What a thing to ask. What a lovely thing to ask. Here — red, and long enough to wrap twice.'),
                ['give', 'scarf', 1], ['flag', 'gotScarf', 1], N('Received a Knitted Scarf.'),
            ];
            return [S('weaver', 'Click, click, click. I knit while I think. I have thought my way through four hundred scarves.')];
        },
    },
    scholarlady: {
        name: 'Professor Inkle', look: H({ skin: SK[1], hair: 'bun', hc: '#5a5a5a', top: '#2a5a5a', bottom: '#2a2a2a', acc: 'glasses' }),
        talk: (G) => [S('scholarlady', G.books.length >= 9 ? 'The Undercroft. Of course. The oldest stacks, under the Rotunda. If Marigold sealed herself anywhere, it would be there.' : 'My theory: the library didn\'t lose its books. It sent them away, to keep them safe from something. The question is — from what?')],
    },

    // ======================================================== the moors and the Abbey
    bogman: {
        name: 'Mossbeard', look: H({ skin: '#8aa07a', hair: 'long', hc: '#4a6a3a', top: '#5a6a4a', bottom: '#3a4a3a', acc: 'beard' }),
        talk: (G) => overdue(G, 'bogman', 'Ooh, "The Abbey Bell". Lovely and damp, this one. I\'ve been using it as a pillow. Smells of bog. You\'re welcome.')
            || [S('bogman', 'The fen\'s fine once you\'re used to it. Wet feet are just feet that know where they are.')],
    },
    nettle: {
        name: 'Granny Nettle', look: H({ skin: SK[1], hair: 'long', hc: '#9a9a9a', top: '#3a3a4a', bottom: '#4a2a4a', hat: 'witch' }),
        talk: SHOPKEEP('nettle', 'moor_witch', () => 'Well, well. The new Librarian, come to Granny\'s cauldron. Sachets, inks, a robe stitched from midnight. All honest magic, dearie.'),
    },
    cairnwarden: {
        name: 'Brother Cairn', look: P('ghost', { top: '#c9b6ff' }),
        talk: (G) => {
            if (q(G, 'bell') === 'done') return [S('cairnwarden', 'Every evening now, the bell. Even the fog stops to listen. Thank you, child.')];
            if (G.bag.bellrope) return [
                S('cairnwarden', 'The bell rope! After all these years! When you\'re gone, I\'ll ring it. I\'ve been waiting so very long to ring it.'),
                ['take', 'bellrope', 1], ['give', 'patch', 1], ['quest', 'bell', 'done'], N('Somewhere behind you, faint and silver, a bell rings. Received a Quilt Patch.'),
            ];
            if (!q(G, 'bell')) return [
                S('cairnwarden', 'Do not be afraid. I was a monk of Gloaming Abbey, a long while ago. Now I am mostly fog with opinions.'),
                S('cairnwarden', 'The Abbey bell has been silent since its rope was lost. If you go inside, and you find it, bring it to me.'),
                ['quest', 'bell', 'active'], N('New quest: The Silent Bell.'),
            ];
            return [S('cairnwarden', 'The Abbey\'s gates are ghost-sealed. Only the Echo Codex can talk them open, and that book sank with the old archive, under Lumen Lake.')];
        },
    },

    // ======================================================== Frostmantle and Skyreach
    lodgekeeper: {
        name: 'Ingrid', look: H({ skin: SK[0], hair: 'pony', hc: '#e8d8a0', top: '#c0392b', bottom: '#4a4a5a', hat: 'beanie' }),
        talk: (G) => {
            const od = overdue(G, 'lodgekeeper', '"Frostmantle by Lantern"? Overdue? It\'s a guidebook! Guests kept borrowing it! It\'s the lodge\'s — oh. Oh, it says "Lantern Library" inside. Fair enough.');
            if (od) return od;
            return [
                S('lodgekeeper', 'Frostmantle Lodge! Cocoa by the fire, beds piled with blankets, and a shop for anything the mountain took off you.'),
                ['choice', [['Rest (12 coins)', 'rest'], ['Shop', 'shop'], ['Not just now', 'bye']]],
                ['label', 'rest'], ['need', { coins: 12 }, 'poor'], ['coins', -12], ['rest'],
                S('lodgekeeper', 'Sleep well. The blankets are heavy on purpose. The mountain likes to visit at night.'), ['end'],
                ['label', 'poor'], S('lodgekeeper', 'Short on coins? The mountain is too. Come back later.'), ['end'],
                ['label', 'shop'], ['shop', 'frost_lodge'], ['end'],
                ['label', 'bye'], S('lodgekeeper', 'Stay warm out there.'),
            ];
        },
    },
    skier: {
        name: 'Sven', look: H({ skin: SK[0], hair: 'short', hc: '#e8d8a0', top: '#3a8ac8', bottom: '#2a2a3a', hat: 'beanie', acc: 'scarf' }),
        talk: (G) => [S('skier', 'The temple on Rime Summit is made of ice that never melts. Inside it\'s colder than the outside, which is a skill.')],
    },
    snowman: {
        name: 'A Snowman', look: P('snowman'),
        talk: (G) => {
            if (q(G, 'scarf') === 'done') return [N('The snowman looks very snug in its red scarf. You could swear it\'s smiling more than before.')];
            if (G.bag.scarf) return [
                N('You wrap the scarf twice around the snowman\'s neck.'),
                S('snowman', '…'),
                N('A small book drops out of the snow at its feet, and a quilt patch, neatly folded.'),
                ['take', 'scarf', 1], ['common', 'b47'], ['give', 'patch', 1], ['quest', 'scarf', 'done'],
                N('Received "Carols of the Peaks" and a Quilt Patch.'),
            ];
            if (!q(G, 'scarf')) return [N('A snowman with coal eyes and a carrot nose. It is shivering. You didn\'t know snowmen could shiver.'),
                W('Poor thing! It needs a scarf. Someone in Aubade knits — I can feel all that wool from here.'),
                ['quest', 'scarf', 'active'], N('New quest: A Cold Snowman.')];
            return [N('The snowman shivers hopefully.')];
        },
    },
    hermit: {
        name: 'Orrin the Hermit', look: H({ skin: SK[2], hair: 'long', hc: '#e0e0e0', top: '#3a3a6a', bottom: '#2a2a3a', acc: 'beard' }),
        talk: (G) => {
            if (q(G, 'lens') === 'done') return [S('hermit', 'Last night I saw a comet named after a librarian. Not you. Marigold. But it was heading your way.')];
            if (G.bag.lens) return [
                S('hermit', 'A Star Lens! Clear as a frozen pond. My telescope will see the backs of the stars now. Please, take this, from my old inkwell collection.'),
                ['take', 'lens', 1], ['give', 'inkwell', 1], ['give', 'patch', 1], ['quest', 'lens', 'done'], N('Received a Silver Inkwell and a Quilt Patch.'),
            ];
            if (!q(G, 'lens')) return [
                S('hermit', 'A visitor! Up the vines, no less. I study the stars, but I cracked my lens. There\'s a spare in the Observatory, across the floating isles.'),
                S('hermit', 'Not that you could get there without wings. Or something like wings.'),
                ['quest', 'lens', 'active'], N('New quest: A Lens for the Stars.'),
            ];
            return [S('hermit', 'The isles drift on the wind. Only something light as a feather could cross between them.')];
        },
    },
    cloudkid: {
        name: 'Nimbus', look: P('kid', { skin: SK[0], hair: 'curly', hc: '#f0f0f0', top: '#bfe6ff', bottom: '#8d8dff' }),
        talk: (G) => [S('cloudkid', 'I live in a cloud. Well, next to a cloud. Well, under a rock near where the cloud usually is.')],
    },

    // ======================================================== the coast
    harbourmaster: {
        name: 'Harbourmaster Gale', look: H({ skin: SK[3], hair: 'short', hc: '#d0d0d0', top: '#2a3a6a', bottom: '#2a2a3a', hat: 'captain', acc: 'beard' }),
        talk: (G) => overdue(G, 'harbourmaster', '"The Founding of Saltmere"? Aye, it\'s overdue. It\'s also the only copy and it\'s got my granddad in it. Look after it.')
            || [S('harbourmaster', G.books.includes('tide') ? 'The lighthouse is lit again! First ships in years are coming in. You did that, Librarian.' : 'The lighthouse went dark when the library fell. The Tidal Hymnal\'s up there, they say, roaring like a storm in a bottle.')],
    },
    fishwife: {
        name: 'Marina', look: H({ skin: SK[2], hair: 'curly', hc: '#3a2a1a', top: '#3a8a8a', bottom: '#4a3a2a', acc: 'apron' }),
        talk: (G) => [S('fishwife', 'Fresh fish! Well. Fish. Freshness is a journey, love.')],
    },
    sailor: {
        name: 'Bosun Tibb', look: H({ skin: SK[4], hair: 'bald', hc: '#1a1a1a', top: '#f2efe2', bottom: '#2a3a6a', hat: 'cap' }),
        talk: (G) => [S('sailor', 'The Barnacle does a fine fish pie. I\'d tell you what\'s in it but then you\'d have to eat it anyway.')],
    },
    oldbrine: {
        name: 'Old Brine', look: H({ skin: SK[3], hair: 'long', hc: '#e0e0e0', top: '#2a5a6a', bottom: '#3a3a3a', hat: 'captain', acc: 'beard' }),
        talk: (G) => [S('oldbrine', 'There\'s a wreck down south, in the cove. Silver aboard, they say. A silver bookmark. Odd cargo. Odd ship.')],
    },
    brinewife: {
        name: 'Marnie', look: H({ skin: SK[2], hair: 'bun', hc: '#c0c0c0', top: '#8a5a7a', bottom: '#3a3a3a' }),
        talk: (G) => [S('brinewife', 'He tells everyone about the wreck. He doesn\'t tell them he was the captain.')],
    },
    fisher2: {
        name: 'Fisher Kit', look: P('kid', { skin: SK[1], hair: 'pony', hc: '#c0623a', top: '#e9a64e', bottom: '#3a5a8a', hat: 'cap' }),
        talk: (G) => [S('fisher2', 'I caught a book once! A Lily Lexicon. It said "ribbit" eleven different ways and swam off.')],
    },
    fishmonger: {
        name: 'Finnegan', look: H({ skin: SK[1], hair: 'curly', hc: '#c0623a', top: '#3a7a8a', bottom: '#3a3a3a', acc: 'apron' }),
        talk: SHOPKEEP('fishmonger', 'salt_market', () => 'Fish and sundries! Sundries are anything that isn\'t fish. It\'s a broad category. Broader than fish.'),
    },
    driftowner: {
        name: 'Coral', look: H({ skin: SK[3], hair: 'long', hc: '#4fa8e0', top: '#e9d9a8', bottom: '#4a7a8a' }),
        talk: SHOPKEEP('driftowner', 'salt_curio', () => 'Everything here washed up on the beach. Including me, once. Have a browse.'),
    },
    netmaker: {
        name: 'Meg the Netmaker', look: H({ skin: SK[1], hair: 'long', hc: '#9a8a7a', top: '#4a8a6a', bottom: '#3a3a4a' }),
        talk: (G) => {
            if (G.bag.letter) return [
                S('netmaker', 'From Hattie?! Years without a word and now — oh, she\'s still underlining everything. Give me a moment.'),
                N('Meg reads the letter twice, laughs, wipes her eyes, and writes a reply on the back of a fishing chart.'),
                S('netmaker', 'Take her this, would you? And tell her the sea air\'s doing me good. She\'ll know what I mean.'),
                ['take', 'letter', 1], ['give', 'reply', 1], N('Received a Letter in Reply.'),
            ];
            return [S('netmaker', q(G, 'letter') === 'done' ? 'Hattie\'s threatening to visit. I\'ve started cleaning. I\'ll be cleaning for a year.' : 'Nets, nets, nets. You\'d be surprised how many books end up in fishing nets these days.')];
        },
    },
    innkeeper_salt: {
        name: 'Skipper Mae', look: H({ skin: SK[4], hair: 'curly', hc: '#1a1210', top: '#c0392b', bottom: '#2a3a5a', hat: 'captain' }),
        talk: INNKEEP('innkeeper_salt', () => 'Welcome aboard the Barnacle! Hammocks or beds? Beds. Everyone says beds. Nobody wants the hammocks.', 12),
    },
    beachcomber: {
        name: 'Shelly', look: H({ skin: SK[2], hair: 'pony', hc: '#e8d8a0', top: '#e0704a', bottom: '#e9d9a8', hat: 'straw' }),
        talk: (G) => [S('beachcomber', 'Atlas Crabs carry whole sea charts on their backs! Calm one down and you get the chart. I\'ve got eleven. They\'re all of the same beach.')],
    },
    tidekid: {
        name: 'Pebble', look: P('kid', { skin: SK[3], hair: 'short', hc: '#2a1e18', top: '#5fae8a', bottom: '#e9d9a8' }),
        talk: (G) => [S('tidekid', 'There\'s a sealed vault in the rocks. It has runes on it! Grandma says the castle runes are the same. The castle! Can you imagine?')],
    },

    // ======================================================== Willowbank and Mousehold
    picnicker: {
        name: 'Hetty and Ned', look: H({ skin: SK[1], hair: 'pony', hc: '#6a3a1a', top: '#f2a0b0', bottom: '#f2efe2', hat: 'bonnet' }),
        talk: (G) => [S('picnicker', books(G) < 5 ? 'We come here every Sunday to look at Mousehold across the river. You can\'t cross. The river\'s too quick. Ned tried. Ned\'s still drying.' : 'You crossed the river?! On ICE?! In summer?! Ned, did you see that?'),],
    },
    kitepoet: {
        name: 'Wilhelmina', look: H({ skin: SK[3], hair: 'long', hc: '#c0623a', top: '#5a7aaa', bottom: '#d9a64a', hat: 'beret' }),
        talk: (G) => [S('kitepoet', 'I fly kites with poems written on them. If the wind takes one, someone, somewhere, gets a poem. That\'s the whole plan.')],
    },
    heron: {
        name: 'A Heron', look: P('heron'),
        talk: (G) => [N('The heron regards you with one yellow eye, then goes back to regarding the river.'), W('I think it\'s reading. Herons are very well read. All those fish.')],
    },
    mousemayor: {
        name: 'Mayor Whiskerton', look: P('mouse', { top: '#3a5a8a', hat: 'top' }),
        talk: (G) => {
            if (q(G, 'cheese') === 'done') return [S('mousemayor', 'The Starlight Cheese is back on its plinth! Mousehold is whole again! We\'ve declared a week of nibbling.')];
            if (G.bag.cheese) return [
                S('mousemayor', 'THE STARLIGHT CHEESE! Oh, oh, oh. Mice of Mousehold, rejoice! And nibble! But mostly rejoice!'),
                ['take', 'cheese', 1], ['give', 'patch', 1], ['coins', 300], ['quest', 'cheese', 'done'], N('Received a Quilt Patch and 300 coins (in very small coins).'),
            ];
            if (!q(G, 'cheese')) return [
                S('mousemayor', 'A big-folk! And the Librarian, by the cardigan! Welcome to Mousehold! Please wipe your enormous feet.'),
                S('mousemayor', 'We have a tragedy. Our wheel of Starlight Cheese was carried into the Great Burrow by a squeaking grimoire. The Diminutive Grammar! Gone wild!'),
                ['quest', 'cheese', 'active'], N('New quest: Cheese for the Mayor.'),
            ];
            return [S('mousemayor', 'The Great Burrow is just below us. Mind your head. Mind everyone\'s head. Mind all the heads.')];
        },
    },
    mousekid: {
        name: 'Pipkin', look: P('mouse', { top: '#e9a64e' }),
        talk: (G) => [S('mousekid', G.books.includes('small') ? 'You can go SMALL now?! Come to my house! It\'s got a mouse door! It\'s a mouse house! You\'d fit!' : 'Big-folk can\'t fit in our houses. Unless they know the Small Grammar. Then they can fit in anything. Even a teacup.')],
    },
    mouseguard: {
        name: 'Corporal Nib', look: P('mouse', { top: '#9aa3b5', hat: 'helm' }),
        talk: (G) => [S('mouseguard', 'HALT! Oh, you\'re enormous. Carry on. Very carefully.')],
    },
    thimble: {
        name: 'Mrs Thimble', look: P('mouse', { top: '#d77fb0', hat: 'bonnet' }),
        talk: SHOPKEEP('thimble', 'mouse_shop', () => 'The Thimble Shop! Moonsilk woven by moths, jam in thimble-sized pots (we\'ll give you several), and charms for big and small.'),
    },
    mousepoet: {
        name: 'Quillon', look: P('mouse', { top: '#5a7aaa', hat: 'beret' }),
        talk: (G) => [S('mousepoet', 'I write very small poems. Here is one: "Cheese." Here is a longer one: "Cheese, please."')],
    },
    mousegran: {
        name: 'Granny Thimbleton', look: P('mouse', { top: '#8a8a8a', acc: 'glasses' }),
        talk: (G) => overdue(G, 'mousegran', 'Overdue? The Mouse Cheese Almanac? Dearie, it took the whole family to carry it home. It\'ll take the whole family to carry it back. Oh, you\'ll manage. Big-folk.')
            || [S('mousegran', 'Marigold gave us all library cards, you know. Tiny ones. I still have mine. Look. It says "Thimbleton, Borrower in Good Standing".')],
    },
    briarwitch: {
        name: 'Rosamund', look: H({ skin: SK[1], hair: 'long', hc: '#4a6a2a', top: '#7a3a4a', bottom: '#3a4a2a', hat: 'hood' }),
        talk: (G) => [S('briarwitch', 'The brambles came the same night the library fell. They grew around my cottage like a hug that won\'t let go. Thank you for burning a way through.'),
            ...(G.flags.briarGift ? [] : [S('briarwitch', 'Take this. Rose-hip jam. For the road.'), ['give', 'jam', 3], ['flag', 'briarGift', 1], N('Received 3 Jam Tarts.')])],
    },
};

// Readable names for speakers that aren't in NPCS.
export const SPEAKERS = { wick: 'Wick', you: 'You', note: '' };
export const speakerName = (id) => NPCS[id]?.name ?? SPEAKERS[id] ?? id;
