/**
 * library — the Warlock's library of bottled stories. Gran's bottle is on the
 * top shelf; the Warlock's journal is on the lectern; the tower door is locked.
 */

import { rect, grad, glow, planks, poly, ellipse, circle, line, speckle, hexA } from '../paint.js';

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

const BOTTLE = [254, 14];
const LADDER_FROM = 58, LADDER_TO = 254;
const BOTTLE_COLS = ['#f4c542', '#6fc7c0', '#c86f8f', '#a8c8e8', '#b6d97a', '#f0a878', '#fbe7a1'];

const TITLES = [
    'The Ballad of Brackenford (all nine verses)', 'How the Baker\'s Grandmother Met a Bear', 'Pie Crust, Brackenford Method',
    'The Plough and the Pheasant', 'Tam\'s Drinking Song (the one you know)', 'Why the River Grumbles', 'The Fox and the Frost Giant',
    'The Hedgehog Who Borrowed the Moon', 'How Hob Lights the Lamps', 'The Miller\'s Three Wishes',
];

async function climbForBottle(G) {
    if (G.has('bottle') || G.flag('pouredBottle')) {
        await G.say('You climb up, admire the view of ten thousand glowing bottles from above, and climb back down again. It is a long way up.');
        return;
    }
    await G.say('You climb the ladder, rung by rung, until the shelves of glowing bottles are going past your nose like the lit windows of a very tall town.');
    G.hide(true);
    await G.wait(500);
    await G.say('At the very top, you close your fingers around the gold bottle. It is warm, like a hand. It hums very faintly — and for a moment you could swear you hear Gran\'s voice inside it, saying *"Once upon a time—"*');
    G.give('bottle');
    G.set('gotBottle');
    G.award('mabBottle');
    G.hide(false);
    await G.say('You climb down very, very carefully.');
}

async function readJournal(G) {
    await G.say('A heavy journal bound in blue leather, open on the lectern. The handwriting starts neat and gets steadily less so.');
    await G.say('*Day 3.* She will not wake. Her breathing is even, her colour is good. It is as though she is only waiting for something.');
    await G.say('*Day 41.* I have tried every waking-charm in the Sixth Grimoire. I have tried the Seventh, which is forbidden, and which did not work either.');
    await G.say('*Day 380.* Wenna says it was the story — that she fell asleep waiting for the rest of it. Very well. If a story sent her to sleep, then a story can wake her. I have only to find the right one.');
    await G.say('*Day 702.* The Loom is finished. It can weave a thousand endings in a night. I have begun to borrow stories from the valley. Only a few. They will not miss a few.');
    await G.say('*Day 1,090.* I have woven every ending there is. Happy ones. Sad ones. Clever ones. None of them is hers.');
    await G.say('The last line isn\'t dated. *I cannot remember how our story was meant to go. I don\'t think I ever knew. Her mother always knew.*');
    if (!G.flag('journalKey')) {
        await G.say('As you close the journal, something slides out of its spine and rings on the floor: a slender silver key, with a lighthouse worked into its bow.');
        G.set('journalKey');
        G.give('silverkey');
        G.award('silverKey');
        G.chron('journal', 'In the Warlock\'s library, among ten thousand bottled stories, Rowan read Corvin Hale\'s journal: a thousand days of spells and stories and endings, and none of them the right one.');
    }
}

export default {
    id: 'library',
    name: 'The Library of Bottled Stories',
    ambience: 'magic',
    scale: [144, 0.86, 198, 1.06],
    entries: { default: [60, 176, 'right'], cavern: [18, 174, 'right'], tower: [160, 150, 'down'], sanctum: [298, 172, 'left'] },
    bgKey: (S) => [S.flag('ladderMoved'), S.flag('ladderRolling'), S.flag('towerOpen'), S.flag('gotBottle')].join(),

    paint(g, S, R) {
        grad(g, 0, 0, 320, 146, [[0, '#0d0b14'], [1, '#2a1a3a']]);
        // the shelves
        for (let s = 0; s < 6; s++) {
            const sy = 8 + s * 22;
            for (const [x0, x1] of [[4, 140], [180, 296]]) {
                rect(g, x0, sy, x1 - x0, 20, '#1c2029');
                // bottles
                let bx = x0 + 2;
                while (bx < x1 - 6) {
                    const col = BOTTLE_COLS[(R() * BOTTLE_COLS.length) | 0];
                    const bh = 9 + ((R() * 6) | 0), bw = 4 + ((R() * 3) | 0);
                    if (s === 0 && bx > 244 && bx < 264) { bx += 6; continue; }  // Gran's bottle's spot
                    glow(g, bx + bw / 2, sy + 19 - bh / 2, 7, col, 0.25);
                    rect(g, bx, sy + 19 - bh, bw, bh, col);
                    rect(g, bx + 1, sy + 17 - bh, bw - 2, 2, col);
                    rect(g, bx + 1, sy + 16 - bh, bw - 2, 1, '#6b4226');
                    rect(g, bx + 1, sy + 20 - bh, 1, 2, '#ffffff');
                    bx += bw + 1 + ((R() * 2) | 0);
                }
                rect(g, x0, sy + 19, x1 - x0, 3, '#6b4226');
                rect(g, x0, sy + 19, x1 - x0, 1, '#a0703c');
            }
        }
        // shelf uprights
        for (const x of [2, 140, 178, 296]) rect(g, x, 0, 4, 142, '#3a2418');
        // brass rail
        rect(g, 4, 5, 292, 2, '#f4c542');

        // Gran's bottle on the top shelf
        if (!S.flag('gotBottle')) {
            glow(g, BOTTLE[0], BOTTLE[1], 18, '#f4c542', 0.6);
            rect(g, BOTTLE[0] - 4, BOTTLE[1] - 5, 8, 12, '#e0782c');
            rect(g, BOTTLE[0] - 3, BOTTLE[1] - 4, 6, 10, '#f4c542');
            rect(g, BOTTLE[0] - 2, BOTTLE[1] - 8, 4, 3, '#f4c542');
            rect(g, BOTTLE[0] - 2, BOTTLE[1] - 9, 4, 1, '#6b4226');
            rect(g, BOTTLE[0] - 3, BOTTLE[1] + 1, 6, 3, '#f4ecd8');
        }

        // the tower door, between the shelves
        rect(g, 142, 0, 36, 142, '#2e3440');
        poly(g, [[146, 138], [146, 80], [160, 66], [174, 80], [174, 138]], '#1c2029');
        if (!S.flag('towerOpen')) {
            poly(g, [[148, 138], [148, 81], [160, 69], [172, 81], [172, 138]], '#3a2418');
            for (const y of [88, 110, 128]) rect(g, 148, y, 24, 2, '#555c6a');
            rect(g, 157, 96, 6, 6, '#c3c7d0');
            poly(g, [[158, 99], [162, 99], [160, 94]], '#555c6a');
            rect(g, 166, 112, 3, 5, '#0d0b14');
        } else {
            poly(g, [[148, 138], [148, 81], [160, 69], [172, 81], [172, 138]], '#0d0b14');
            glow(g, 160, 100, 24, '#a8c8e8', 0.3);
            for (let i = 0; i < 5; i++) rect(g, 150, 132 - i * 10, 20, 2, '#2e3440');
        }

        // the sanctum archway on the right
        rect(g, 298, 30, 22, 116, '#1c2029');
        poly(g, [[302, 146], [302, 50], [311, 38], [320, 44], [320, 146]], '#6e1f24');
        glow(g, 316, 96, 40, '#e0782c', 0.45);

        // floor
        rect(g, 0, 140, 320, 60, '#3a2418');
        planks(g, R, 0, 142, 320, 58, 6, ['#6b4226', '#3a2418'], '#1c2029', true);
        ellipse(g, 176, 176, 90, 16, '#2b3a67');
        ellipse(g, 176, 176, 84, 13, '#3f5f9a');
        ellipse(g, 176, 176, 70, 9, '#2b3a67');
        speckle(g, R, 100, 166, 150, 20, ['#f4c542'], 30);

        // lectern with the journal
        rect(g, 106, 126, 6, 26, '#3a2418');
        rect(g, 100, 150, 18, 3, '#3a2418');
        poly(g, [[96, 128], [122, 122], [124, 128], [98, 134]], '#6b4226');
        poly(g, [[98, 126], [109, 122], [110, 128], [99, 131]], '#f4ecd8');
        poly(g, [[110, 122], [121, 120], [122, 125], [110, 128]], '#f4ecd8');
        rect(g, 118, 110, 3, 10, '#f4ecd8');
        glow(g, 119, 108, 16, '#f4c542', 0.4);

        // the ladder, parked or moved
        if (!S.flag('ladderRolling')) drawLadder(g, S.flag('ladderMoved') ? LADDER_TO : LADDER_FROM);

        const vg = g.createRadialGradient(160, 100, 80, 160, 100, 240);
        vg.addColorStop(0, hexA('#0d0b14', 0));
        vg.addColorStop(1, hexA('#0d0b14', 0.55));
        g.fillStyle = vg;
        g.fillRect(0, 0, 320, 200);
    },

    walk: () => ({
        areas: [[[0, 148], [320, 148], [320, 199], [0, 199]]],
        blockers: [[[94, 146], [126, 146], [126, 156], [94, 156]]],
    }),

    actors(S, t, A) {
        if (!S.flag('ladderRolling')) return [];
        // While it rolls, the background is painted without it and it's drawn here.
        const p = A('ladder');
        const x = LADDER_FROM + (LADDER_TO - LADDER_FROM) * (p * p * (3 - 2 * p));
        return [{ y: 0, draw: (g) => drawLadder(g, x) }];
    },

    overlay(g, S, t) {
        // a few bottles pulse, like breathing
        for (let i = 0; i < 7; i++) {
            const k = Math.floor(t * 0.7 + i * 1.37) % 40;
            const s = k % 6, sx = 10 + ((k * 37 + i * 53) % 270);
            if (sx > 140 && sx < 180) continue;
            px(g, sx, 16 + s * 22, 1, 1, '#ffffff');
        }
        // gold motes drifting toward the sanctum
        for (let i = 0; i < 12; i++) {
            const p = (t * 0.08 + i / 12) % 1;
            const x = 20 + p * 290, y = 40 + ((i * 29) % 90) + Math.sin(t * 2 + i) * 4;
            px(g, x, y, 1, 1, BOTTLE_COLS[i % BOTTLE_COLS.length]);
        }
        if (!S.flag('gotBottle') && Math.sin(t * 3) > 0.3) px(g, BOTTLE[0] - 1, BOTTLE[1] - 3, 1, 2, '#ffffff');
    },

    look: 'A library, but not of books. From floor to ceiling, shelf after shelf, stand bottles — ten thousand of them, maybe more — each one stoppered and labelled and glowing softly, like a town full of lit windows seen from a hill on a cold night. The air hums. It sounds like a great many people very quietly telling you something.',

    hotspots: (S) => [
        {
            id: 'mabbottle', name: 'the golden bottle', shape: { rect: [244, 2, 22, 22] }, at: [254, 164], face: 'up',
            when: () => !S.flag('gotBottle'),
            look: 'High on the very top shelf, one bottle glows the exact gold of Gran\'s hearth. Even from down here you can read its label: MAB ASHBY, BRACKENFORD — ALL OF THEM.',
            use: (G) => (G.flag('ladderMoved') ? climbForBottle(G) : G.say('It\'s far too high to reach. You\'d need a ladder — and the only ladder in here is at the other end of the rail.')),
        },
        {
            id: 'ladder', name: 'the library ladder', shape: { rect: [(S.flag('ladderMoved') ? LADDER_TO : LADDER_FROM) - 10, 4, 22, 140] },
            at: [(S.flag('ladderMoved') ? LADDER_TO : LADDER_FROM), 160], face: 'up',
            look: (G) => G.say(G.flag('ladderMoved')
                ? 'The library ladder, now parked beneath Gran\'s bottle.'
                : 'A library ladder hooked onto the brass rail, so it can be rolled along the shelves. Its little iron wheel is jammed solid with a great lump of old candle-wax.'),
            async use(G) {
                if (G.flag('ladderMoved')) return climbForBottle(G);
                await G.say('You heave at the ladder. It won\'t budge an inch — the wheel is gummed up with old wax. You\'d need something to dig it out.');
                G.set('sawWax');
            },
            items: {
                async poker(G) {
                    if (G.flag('ladderMoved')) return G.say('The wheel\'s free already.');
                    await G.say('You dig the hooked end of Gran\'s poker into the wheel and prise out a lump of old wax the size of a plum. The ladder gives a squeak of pure relief.');
                    await G.say('You roll it along the rail — past a hundred, a thousand glowing bottles — until it stops beneath the one that shines like Gran\'s fire.');
                    G.set('ladderRolling');
                    await G.animate('ladder', 1400);
                    G.set('ladderMoved');
                    G.set('ladderRolling', false);
                    G.award('ladder');
                },
            },
        },
        {
            id: 'journal', name: 'the journal on the lectern', shape: { rect: [94, 104, 32, 50] }, at: [110, 162], face: 'up',
            look: 'A lectern with a heavy blue journal lying open on it, and a candle burned almost to the stub. The pages are crowded with writing.',
            use: readJournal,
            talk: 'You clear your throat and read a line aloud. Somewhere in the shelves, ten thousand stories hush to listen.',
        },
        {
            id: 'towerdoor', name: 'the little door', shape: { rect: [144, 64, 32, 76] }, at: [160, 154], face: 'up',
            exit: S.flag('towerOpen') ? 'tower' : null,
            look: (G) => G.say(G.flag('towerOpen')
                ? 'The little door stands open. A narrow stair winds up into the tower, lit by moonlight from somewhere above.'
                : 'A small arched door between the shelves, bound in iron, with a lighthouse carved on its lock-plate. Locked. There is a keyhole, silver-rimmed.'),
            use: (G) => G.say('It\'s locked. The keyhole is rimmed with silver.'),
            items: {
                async silverkey(G) {
                    await G.say('The silver key slides into the lock as if it had been missing it. It turns with a small, sad click, and the door swings open onto a narrow stair winding up into the tower.');
                    G.take('silverkey');
                    G.set('towerOpen');
                    G.award('towerDoor');
                    G.sfx('door');
                },
                brasskey: 'Much too small. This lock wants something slender, and silver.',
                poker: 'You\'d sooner not break a door with a lighthouse on it. It feels like it belongs to someone.',
            },
        },
        {
            id: 'sanctum', name: 'east, into the red light', shape: { rect: [298, 34, 22, 112] }, at: [314, 172], exit: 'sanctum',
            look: 'Red-gold light pours through an archway to the east, and with it a sound like a thousand people whispering all at once. All the streams of light in the library are drifting that way.',
        },
        {
            id: 'shelves', name: 'the bottled stories', shape: { rect: [4, 6, 292, 136] }, at: null,
            async look(G) {
                const a = TITLES[(Math.random() * TITLES.length) | 0];
                let b = TITLES[(Math.random() * TITLES.length) | 0];
                if (b === a) b = TITLES[(TITLES.indexOf(a) + 3) % TITLES.length];
                await G.say(`Thousands of bottles, each labelled in a tall, spidery hand. *${a}.* *${b}.* Each one glows the colour of a hearth seen through a window on a cold night.`);
                await G.say('Every story in the valley is here. It\'s the most beautiful thing you\'ve ever seen, and it makes you want to cry.');
            },
            async use(G) {
                const t = TITLES[(Math.random() * TITLES.length) | 0];
                await G.say(`You take down a bottle at random. The label reads: *${t}.* It\'s warm, and it hums.`);
                const c = await G.choose(['Pull the cork', 'Put it back'], 'You could let it out...');
                if (c === 1) { await G.say('You put it carefully back. It isn\'t yours to open.'); return; }
                await G.die('Lost in a Story', `You pull the cork. *${t}* pours out in a flood of golden words and sweeps you up into it — and you live happily ever after as a minor character with exactly one line: "Look out! A dragon!"\n\nIt is a good line. You say it very well. You say it every night, forever.`);
            },
            items: {
                book: 'You hold the Book of Tales up to the shelves. The bottles hum a little louder, but these aren\'t Gran\'s stories. Hers glow gold.',
                poker: 'Smash ten thousand bottles in one go? The stories would go everywhere, in a hurry, all at once. You aren\'t sure you want to find out what that looks like.',
            },
        },
        {
            id: 'down', name: 'back down to the hall', shape: { rect: [0, 110, 10, 90] }, at: [4, 174], exit: 'cavern',
            look: 'The stair back down to the Hall of the Hound.',
        },
    ],

    async enter(G, first) {
        if (!first) return;
        await G.say('You step carefully over the sleeping Brimble, climb the stair, pass through the golden archway — and stop.');
        await G.say('It\'s a library, but not of books. From floor to ceiling stand bottles, ten thousand of them, each stoppered and labelled and glowing. Every story in the valley is here, and every one of them is humming.');
    },
};

function drawLadder(g, x) {
    g.fillStyle = '#6b4226';
    g.fillRect(x - 8, 6, 3, 138);
    g.fillRect(x + 6, 6, 3, 138);
    for (let y = 16; y < 140; y += 10) g.fillRect(x - 6, y, 12, 2);
    g.fillStyle = '#a0703c';
    g.fillRect(x - 8, 6, 1, 138);
    g.fillRect(x + 6, 6, 1, 138);
    g.fillStyle = '#f4c542';
    g.fillRect(x - 9, 4, 5, 3);
    g.fillRect(x + 5, 4, 5, 3);
}
