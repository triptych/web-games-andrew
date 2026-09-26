/**
 * gate — the door into Greymantle, and Graniteface, who wants three riddles
 * answered. Elsie taught it half of them.
 */

import { rect, grad, glow, stones, poly, ellipse, circle, line, speckle, ridge, stars, pine, hexA, withAlpha } from '../paint.js';
import { graniteface } from '../npcs.js';

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

const RIDDLES = [
    {
        q: 'I have a spine, but no bones. I have leaves, but no roots. I hold a thousand lives, and I have never lived one. WHAT AM I?',
        a: ['A tree in winter', 'A book', 'A dragon, asleep', 'A ghost'], right: 1,
    },
    {
        q: 'You go into me every night and come out of me every morning, and not one person has ever seen my door. WHAT AM I?',
        a: ['A house', 'A bed', 'Sleep', 'The dark'], right: 2,
    },
    {
        q: 'I am told, but I am never heard alone. I end, but I am never over. And the more of me you give away, the more of me there is. WHAT AM I?',
        a: ['A secret', 'A song', 'A lie', 'A story'], right: 3,
    },
];

const WRONG = [
    'WRONG! Elsie got that one when she was five.',
    'WRONG! Oh, *dear*. Oh dear, oh dear. From the top.',
    'WRONG! And you were doing so well. That\'s the tragedy of it.',
];

async function riddles(G) {
    await G.line('Graniteface', 'VERY WELL. THREE RIDDLES. Answer all three and I open. Answer one wrong and we start again from the beginning, and I shall be *extremely* disappointed in you.');
    for (let i = 0; i < RIDDLES.length; i++) {
        const r = RIDDLES[i];
        const c = await G.choose(r.a, `*"${r.q}"*`, 'Graniteface');
        if (c !== r.right) {
            G.sfx('wrong');
            await G.line('Graniteface', WRONG[i]);
            return false;
        }
        G.sfx('right');
        await G.line('Graniteface', ['CORRECT. Hmph. Beginner\'s luck.', 'CORRECT. Well, well.', 'CORRECT!'][i]);
    }
    return true;
}

async function talkFace(G) {
    if (G.flag('doorOpen')) {
        await G.line('Graniteface', 'IN YOU GO. And if you see the little one — tell her Graniteface misses her riddles. Nobody sits on my nose any more.');
        return;
    }
    if (!G.flag('faceAwake')) {
        G.set('faceAwake');
        G.sfx('stone');
        await G.say('With a noise like a landslide clearing its throat, the great stone face opens its eyes.');
        await G.line('Graniteface', 'WHO KNOCKS? No — don\'t answer. Nobody ever answers that one well.');
    }
    for (;;) {
        const c = await G.choose(['Ask me your riddles.', 'Who are you?', 'Who made you?', 'Goodbye.'], null, 'Graniteface');
        if (c === 0) {
            if (await riddles(G)) {
                await G.line('Graniteface', 'ALL THREE. Well! It has been a very long time since anybody got all three. It has been three winters.');
                G.sfx('stone');
                await G.say('With a grinding that you feel in your teeth, the great stone door slides down into the mountain, and a breath of warm air comes out of the dark beyond, smelling of candles and old paper.');
                await G.animate('doorOpen', 1600);
                G.set('doorOpen');
                G.award('riddles');
                G.chron('riddles', 'At the door of Greymantle, a stone face asked Rowan three riddles, and the answers were a book, and sleep, and a story — for the face had learned its riddles from a little girl at bedtime.');
                return;
            }
        } else if (c === 1) {
            await G.line('Graniteface', 'I AM THE DOOR. Also the face on the door. It\'s a fine distinction, but I\'m attached to it.');
        } else if (c === 2) {
            await G.line('Graniteface', 'THE WARLOCK MADE ME TO KEEP PEOPLE OUT. THE LITTLE ONE TAUGHT ME TO LET THE CLEVER ONES IN. She used to sit right on my nose, swinging her feet, and make up riddles for me. I liked her rule better.');
        } else {
            await G.line('Graniteface', 'COME BACK WHEN YOU\'RE CLEVERER. Or colder. Colder usually works.');
            return;
        }
    }
}

export default {
    id: 'gate',
    name: 'The Door of Greymantle',
    ambience: 'wind',
    scale: [148, 0.82, 198, 1.05],
    entries: { default: [60, 180, 'right'], pines: [18, 184, 'right'], cavern: [160, 150, 'down'] },
    bgKey: (S) => String(S.flag('doorOpen')),

    paint(g, S, R) {
        grad(g, 0, 0, 320, 200, [[0, '#0d0b14'], [0.5, '#1b1f3b'], [1, '#2b3a67']]);
        stars(g, R, 120, 0, 0, 320, 120);
        // the valley far below, off the cliff to the right
        ridge(g, R, 150, 12, '#1b1f3b', 0.5, 220, 320, 200);
        for (let i = 0; i < 10; i++) {
            const x = 250 + R() * 66, y = 170 + R() * 22;
            glow(g, x, y, 5, '#f4c542', 0.5);
            rect(g, x, y, 1, 1, '#f4c542');
        }
        // mountain face
        poly(g, [[0, 0], [250, 0], [262, 60], [276, 110], [272, 160], [0, 160]], '#2e3440');
        stones(g, R, 0, 0, 270, 160, 22, 14, ['#2e3440', '#1c2029', '#2e3440', '#555c6a'], '#1c2029');
        poly(g, [[250, 0], [330, 0], [330, 150], [276, 110], [262, 60]], '#1b1f3b');
        stars(g, R, 30, 270, 0, 50, 100);
        // soften the right edge of the cliff
        poly(g, [[244, 0], [256, 0], [270, 60], [282, 112], [276, 162], [266, 162], [270, 112], [258, 60]], '#1c2029');
        // snow ledges on the rock
        for (let i = 0; i < 18; i++) {
            const x = R() * 250, y = R() * 140;
            rect(g, x, y, 6 + R() * 12, 1, '#8a90a0');
        }

        // the arch and the carved face on the lintel
        poly(g, [[112, 160], [112, 50], [124, 26], [160, 12], [196, 26], [208, 50], [208, 160]], '#555c6a');
        poly(g, [[118, 160], [118, 52], [128, 32], [160, 20], [192, 32], [202, 52], [202, 160]], '#8a90a0');
        // face carving
        ellipse(g, 160, 54, 30, 28, '#8a90a0');
        ellipse(g, 160, 54, 26, 24, '#c3c7d0');
        rect(g, 140, 34, 14, 4, '#555c6a');          // brows
        rect(g, 166, 34, 14, 4, '#555c6a');
        rect(g, 142, 38, 8, 6, '#2e3440');           // eye sockets
        rect(g, 170, 38, 8, 6, '#2e3440');
        poly(g, [[156, 42], [164, 42], [168, 60], [152, 60]], '#8a90a0');   // nose
        rect(g, 154, 58, 12, 2, '#555c6a');
        rect(g, 146, 62, 28, 5, '#555c6a');          // lip line
        ellipse(g, 140, 58, 3, 5, '#8a90a0');         // cheeks
        ellipse(g, 180, 58, 3, 5, '#8a90a0');
        speckle(g, R, 132, 30, 56, 50, ['#8a90a0', '#555c6a'], 70);
        // the door slabs, or the open passage
        if (!S.flag('doorOpen')) {
            rect(g, 126, 84, 68, 76, '#555c6a');
            rect(g, 128, 86, 64, 74, '#8a90a0');
            rect(g, 159, 86, 2, 74, '#2e3440');
            for (let y = 96; y < 160; y += 14) { rect(g, 130, y, 28, 1, '#555c6a'); rect(g, 162, y, 28, 1, '#555c6a'); }
            circle(g, 150, 124, 3, '#2e3440'); circle(g, 170, 124, 3, '#2e3440');
        } else {
            rect(g, 126, 84, 68, 76, '#0d0b14');
            glow(g, 160, 140, 40, '#f0a878', 0.35);
            for (let i = 0; i < 4; i++) rect(g, 136 + i * 3, 148 - i * 12, 48 - i * 6, 2, '#2e3440');
            rect(g, 126, 156, 68, 4, '#555c6a');
        }
        // steps
        for (let i = 0; i < 3; i++) rect(g, 114 - i * 6, 158 + i * 4, 92 + i * 12, 4, i % 2 ? '#555c6a' : '#8a90a0');

        // torches in brackets
        for (const x of [100, 220]) {
            rect(g, x - 1, 88, 3, 16, '#2e3440');
            rect(g, x - 3, 86, 7, 3, '#1c2029');
            glow(g, x, 80, 34, '#f0a878', 0.4);
        }

        // snowy ground and the path down
        poly(g, [[0, 160], [276, 160], [290, 200], [0, 200]], '#8a90a0');
        grad(g, 0, 160, 280, 40, [[0, '#8a90a0'], [1, '#c3c7d0']]);
        poly(g, [[0, 172], [60, 166], [112, 170], [80, 186], [0, 198]], '#555c6a');
        speckle(g, R, 0, 160, 280, 40, ['#ffffff', '#a8c8e8', '#555c6a'], 260);
        // cliff edge rocks
        poly(g, [[262, 158], [290, 162], [300, 200], [276, 200]], '#555c6a');
        poly(g, [[270, 156], [284, 150], [296, 158], [288, 164]], '#8a90a0');
        // a few stunted pines on the left
        pine(g, 22, 162, 34, 18, '#16301f', '#0d0b14', '#c3c7d0');
        pine(g, 44, 160, 22, 12, '#16301f', '#0d0b14', '#c3c7d0');

        const vg = g.createRadialGradient(160, 110, 80, 160, 110, 250);
        vg.addColorStop(0, hexA('#0d0b14', 0));
        vg.addColorStop(1, hexA('#0d0b14', 0.55));
        g.fillStyle = vg;
        g.fillRect(0, 0, 320, 200);
    },

    walk: (S) => ({
        areas: [
            [[0, 172], [40, 164], [110, 166], [210, 166], [264, 166], [270, 199], [0, 199]],
            ...(S.flag('doorOpen') ? [[[140, 148], [180, 148], [180, 168], [140, 168]]] : []),
        ],
        blockers: [[[8, 160], [54, 160], [54, 170], [8, 170]]],
    }),

    actors(S, t, A, sp) {
        return [];
    },

    overlay(g, S, t, A) {
        // eyes and mouth of the face
        graniteface(g, 160, 64, t, false, S.flag('doorOpen'));
        // the door sliding down into the ground
        const p = A('doorOpen');
        if (p > 0 && p < 1 && !S.flag('doorOpen')) {
            const h = Math.round(76 * (1 - p));
            px(g, 126, 84, 68, 76, '#0d0b14');
            px(g, 128, 160 - h, 64, h, '#8a90a0');
            px(g, 159, 160 - h, 2, h, '#2e3440');
        }
        // torch flames
        for (const x of [100, 220]) {
            for (let i = 0; i < 3; i++) {
                const h = 6 + Math.sin(t * 11 + i * 2 + x) * 2;
                px(g, x - 2 + i * 2, 86 - h, 2, h, i === 1 ? '#f4c542' : '#e0782c');
            }
        }
        // snow
        for (let i = 0; i < 60; i++) {
            const sx = ((i * 53.7 + t * (8 + (i % 5) * 3)) % 340) - 10;
            const sy = ((i * 31.3 + t * (14 + (i % 7) * 2)) % 210) - 5;
            px(g, sx + Math.sin(t + i) * 3, sy, 1, 1, i % 4 ? '#ffffff' : '#a8c8e8');
        }
    },

    look: 'High on Greymantle, where the pines give up and the snow begins, a door as tall as a house has been cut into the living rock. Above it a great stone face has been carved into the lintel. The wind up here is thin and very cold and it goes straight through Gran\'s scarf.',

    hotspots: [
        {
            id: 'face', name: 'the stone face', shape: { rect: [128, 24, 64, 48] }, at: [160, 170], face: 'up',
            look: (G) => G.say(G.flag('faceAwake')
                ? 'Graniteface: a huge stone face with a nose like a church door and eyes that glow a faint, patient teal. It is watching you with the air of a schoolmaster who has seen a great many wrong answers.'
                : 'A great stone face carved into the lintel above the door: heavy brows, a nose like a church door, a long mouth set in a straight line. Its eyes seem to be closed. Seem to be.'),
            talk: talkFace,
            use: async (G) => { await G.say('You reach up and knock on the stone chin.'); await talkFace(G); },
            items: {
                poker: 'You rap the poker on the stone lip. The face looks down at you with enormous, geological disappointment.',
                book: (G) => G.line('Graniteface', G.flag('doorOpen') ? 'A BOOK. Yes. That was the first answer. Well done. Again.' : 'THAT IS A BOOK. I did not ask you a question yet. Hold that thought.'),
                default: (G) => G.line('Graniteface', 'THAT IS NOT AN ANSWER. That is a *thing*.'),
            },
        },
        {
            id: 'door', name: 'into Greymantle', shape: { rect: [124, 80, 72, 80] }, at: [160, 160], exit: 'cavern', face: 'up',
            exitIf: (S) => S.flag('doorOpen'),
            blocked: async (G) => {
                await G.say('You push against the great stone door. It is as shut as a door can be. Above you, the stone face clears its throat meaningfully.');
            },
            look: (G) => G.say(G.flag('doorOpen')
                ? 'The door has sunk into the mountain. Beyond it, a passage leads into warm, candle-smelling dark.'
                : 'Two slabs of stone, each as big as a barn door, fitted so closely you couldn\'t slide a hair between them. There is no handle and no keyhole.'),
            items: {
                poker: 'You try to lever the slabs apart with the poker. You might as well try to lever the mountain apart with a spoon.',
                silverkey: 'There\'s no keyhole. This door opens to cleverness, not keys.',
                brasskey: 'There\'s no keyhole. This door opens to cleverness, not keys.',
            },
        },
        {
            id: 'edge', name: 'the cliff edge', shape: { poly: [[262, 150], [320, 130], [320, 200], [268, 200]] }, at: [252, 182], face: 'right',
            look: 'The mountainside drops away into nothing. Far, far below, the lights of Brackenford twinkle like somebody has spilled a jewellery box down the valley. One of those lights is Gran\'s window.',
            async use(G) {
                const c = await G.choose(['Step closer to the edge', 'Stay well back'], 'The view is very fine. The drop is very long.');
                if (c === 1) { await G.say('You stay well back. Heroes in stories are always leaning over things. It never ends well.'); return; }
                await G.die('A Long Way Down', 'You step right up to the edge to admire the view. The view, it turns out, is best admired from a little further back.\n\nThe Book of Tales records that you reached Brackenford again in record time, by the most direct route available.');
            },
        },
        {
            id: 'torch', name: 'the torches', shape: { rect: [92, 70, 16, 36] }, at: [100, 172], face: 'up',
            look: 'Torches burn in iron brackets either side of the door. They don\'t seem to burn down. Somebody, somewhere, is keeping the lights on.',
            use: 'The torches are bolted into the rock, and hot at the business end.',
        },
        {
            id: 'torch2', name: 'the torches', shape: { rect: [212, 70, 16, 36] }, at: [220, 172], face: 'up',
            look: 'Torches burn in iron brackets either side of the door. They don\'t seem to burn down. Somebody, somewhere, is keeping the lights on.',
            use: 'The torches are bolted into the rock, and hot at the business end.',
        },
        {
            id: 'down', name: 'back down to the pines', shape: { rect: [0, 164, 12, 36] }, at: [4, 188], exit: 'pines',
            look: 'The path winds back down the mountain to the Whispering Pines.',
        },
        {
            id: 'snow', name: 'the snow', shape: { rect: [0, 164, 270, 36] }, at: null,
            look: 'Fresh snow, still falling. Yours are the only footprints. Nobody has come this way in a long time.',
            use: 'You make a small snowball, and then, lacking anyone to throw it at, eat it. It tastes of cold.',
        },
    ],

    async enter(G, first) {
        if (!first) return;
        await G.say('The road climbs and climbs until the pines give up and the snow begins. At the top of the path, cut into the living rock of Greymantle, is a door as tall as a house — and above the door, carved into the stone, an enormous face.');
        await G.say('It appears to be asleep.');
    },
};
