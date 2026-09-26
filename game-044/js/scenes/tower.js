/**
 * tower — Elsie's chamber at the top of the Warlock's tower. She is asleep,
 * waiting for the end of a story. The music box holds it.
 */

import { rect, grad, glow, stones, planks, poly, ellipse, circle, line, speckle, ridge, stars, hexA } from '../paint.js';
import { elsie, corvin } from '../npcs.js';

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

const PILLOW = [226, 128];

export default {
    id: 'tower',
    name: "Elsie's Chamber",
    ambience: 'wind',
    scale: [146, 0.9, 198, 1.08],
    entries: { default: [150, 176, 'right'], library: [18, 174, 'right'] },
    bgKey: (S) => [S.flag('boxOpen'), S.flag('released')].join(),

    paint(g, S, R) {
        // curved stone wall
        stones(g, R, 0, 0, 320, 146, 16, 9, ['#2e3440', '#555c6a', '#2e3440', '#1c2029'], '#1c2029');
        grad(g, 0, 0, 320, 146, [[0, hexA('#0d0b14', 0.6)], [0.5, hexA('#0d0b14', 0)], [1, hexA('#0d0b14', 0.3)]], true);

        // the great window
        poly(g, [[118, 110], [118, 36], [134, 16], [160, 8], [186, 16], [202, 36], [202, 110]], '#1c2029');
        g.save();
        g.beginPath();
        g.moveTo(122, 106); g.lineTo(122, 38); g.lineTo(136, 20); g.lineTo(160, 12); g.lineTo(184, 20); g.lineTo(198, 38); g.lineTo(198, 106);
        g.closePath();
        g.clip();
        grad(g, 118, 8, 84, 100, [[0, '#0d0b14'], [0.6, '#1b1f3b'], [1, '#2b3a67']]);
        stars(g, R, 50, 118, 8, 84, 60);
        circle(g, 180, 32, 7, '#f4ecd8');
        circle(g, 177, 30, 2, '#c3c7d0');
        ridge(g, R, 86, 8, '#16301f', 0.5, 118, 204, 110);
        for (let i = 0; i < 9; i++) {
            const x = 130 + R() * 60, y = 92 + R() * 12;
            rect(g, x, y, 1, 1, S.flag('released') ? '#fbe7a1' : '#f4c542');
            if (S.flag('released')) glow(g, x, y, 4, '#f4c542', 0.5);
        }
        g.restore();
        rect(g, 159, 10, 2, 100, '#1c2029');
        rect(g, 118, 64, 84, 2, '#1c2029');
        rect(g, 114, 108, 92, 6, '#555c6a');

        // tapestry of a lighthouse
        rect(g, 30, 22, 60, 80, '#2b3a67');
        rect(g, 32, 24, 56, 76, '#3f5f9a');
        for (let y = 80; y < 100; y += 4) line(g, 32, y + ((y / 4) % 2), 88, y, '#6d93c9', 1);
        poly(g, [[54, 84], [58, 40], [64, 40], [68, 84]], '#f4ecd8');
        rect(g, 56, 52, 10, 4, '#b8332f'); rect(g, 55, 68, 12, 4, '#b8332f');
        rect(g, 56, 34, 10, 6, '#f4c542');
        poly(g, [[55, 34], [67, 34], [61, 28]], '#b8332f');
        for (const [dx, dy] of [[-20, -8], [-18, 4], [20, -8], [18, 4]]) line(g, 61, 37, 61 + dx, 37 + dy, '#fbe7a1', 1);
        rect(g, 28, 20, 64, 3, '#a0703c');
        for (let x = 32; x < 90; x += 6) rect(g, x, 100, 2, 4, '#f4c542');

        // floor
        rect(g, 0, 142, 320, 58, '#3a2418');
        planks(g, R, 0, 144, 320, 56, 6, ['#6b4226', '#3a2418', '#6b4226'], '#1c2029', true);
        ellipse(g, 150, 178, 76, 13, '#7d4a78');
        ellipse(g, 150, 178, 70, 10, '#c86f8f');
        ellipse(g, 150, 178, 54, 6, '#7d4a78');

        // the bed
        rect(g, 206, 92, 16, 64, '#6b4226');
        circle(g, 214, 92, 7, '#6b4226');
        rect(g, 208, 94, 12, 54, '#a0703c');
        rect(g, 296, 112, 10, 44, '#6b4226');
        rect(g, 216, 128, 86, 22, '#f4ecd8');
        // patchwork quilt
        for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) {
            rect(g, 238 + i * 9, 130 + j * 9, 9, 9, ['#b8332f', '#3f5f9a', '#f4c542', '#74b94a', '#c86f8f'][(i + j * 3) % 5]);
        }
        rect(g, 216, 148, 86, 8, '#cfa168');
        ellipse(g, 226, 128, 12, 5, '#ffffff');

        // nightstand with diary and candle
        rect(g, 184, 128, 20, 30, '#6b4226');
        rect(g, 184, 128, 20, 2, '#a0703c');
        rect(g, 188, 124, 11, 4, '#b8332f');
        rect(g, 188, 124, 11, 1, '#f4ecd8');
        rect(g, 199, 114, 3, 10, '#f4ecd8');
        glow(g, 200, 112, 26, '#f4c542', 0.35);

        // the music box on its little table
        rect(g, 56, 124, 32, 4, '#6b4226');
        rect(g, 70, 128, 4, 26, '#3a2418');
        rect(g, 62, 152, 20, 3, '#3a2418');
        poly(g, [[64, 124], [66, 100], [78, 100], [80, 124]], '#f4ecd8');
        rect(g, 66, 106, 12, 4, '#b8332f'); rect(g, 65, 116, 14, 4, '#b8332f');
        rect(g, 67, 94, 10, 6, S.flag('boxOpen') ? '#fbe7a1' : '#f4c542');
        if (S.flag('boxOpen')) glow(g, 72, 96, 14, '#f4c542', 0.5);
        poly(g, [[66, 94], [78, 94], [72, 88]], '#b8332f');
        rect(g, 71, 120, 2, 2, '#0d0b14');

        // toy horse
        rect(g, 108, 166, 16, 7, '#e0782c');
        rect(g, 120, 160, 6, 8, '#e0782c');
        rect(g, 109, 173, 2, 5, '#6b4226'); rect(g, 121, 173, 2, 5, '#6b4226');
        rect(g, 106, 166, 3, 3, '#f4ecd8');
        ellipse(g, 116, 180, 14, 2, '#3a2418');

        // stair down on the left
        rect(g, 0, 90, 16, 56, '#0d0b14');
        for (let i = 0; i < 4; i++) rect(g, 0, 134 - i * 10, 14 - i * 3, 2, '#2e3440');

        glow(g, 160, 60, 90, '#a8c8e8', 0.15);
        const vg = g.createRadialGradient(160, 110, 80, 160, 110, 240);
        vg.addColorStop(0, hexA('#0d0b14', 0));
        vg.addColorStop(1, hexA('#0d0b14', 0.5));
        g.fillStyle = vg;
        g.fillRect(0, 0, 320, 200);
    },

    walk: () => ({
        areas: [[[4, 148], [316, 148], [318, 199], [2, 199]]],
        blockers: [
            [[200, 144], [308, 144], [308, 166], [200, 166]],
            [[54, 146], [90, 146], [90, 158], [54, 158]],
            [[182, 146], [206, 146], [206, 162], [182, 162]],
            [[104, 162], [128, 162], [128, 180], [104, 180]],
        ],
    }),

    actors(S, t, A, sp) {
        const list = [{ y: 150, draw: (g, tt) => elsie(g, PILLOW[0], PILLOW[1], tt, S.flag('elsieAwake'), sp === 'Elsie') }];
        if (S.flag('corvinHere')) list.push({ y: 172, draw: (g, tt) => corvin(g, 196, 172, tt, sp === 'Corvin', 'right', true) });
        return list;
    },

    overlay(g, S, t) {
        // paper birds on threads, turning in the draught from the window
        const birds = [[40, 30], [96, 18], [110, 40], [214, 26], [240, 44], [268, 20], [292, 36], [228, 60], [262, 70]];
        birds.forEach(([bx, len], i) => {
            const sway = Math.sin(t * 0.8 + i * 1.3) * 2;
            px(g, bx, 0, 1, len, '#8a90a0');
            const x = bx + sway, y = len;
            const flap = Math.sin(t * 2 + i) > 0;
            px(g, x - 3, y + (flap ? 0 : 1), 3, 1, '#f4ecd8');
            px(g, x + 1, y + (flap ? 0 : 1), 3, 1, '#f4ecd8');
            px(g, x - 1, y + 1, 3, 2, '#ffffff');
        });
        const fl = Math.sin(t * 11) > 0 ? 1 : 0;
        px(g, 200, 110 + fl, 2, 4 - fl, '#f4c542');
    },

    look: 'A round room at the very top of the tower, full of moonlight and toys. Paper birds hang from the ceiling on threads, turning slowly. In the bed, under a patchwork quilt, a little girl is asleep. It is the quietest room you have ever been in.',

    hotspots: [
        {
            id: 'elsie', name: 'the sleeping girl', shape: { rect: [212, 110, 44, 30] }, at: [226, 172], face: 'up',
            async look(G) {
                await G.say('She\'s seven — no. She *was* seven, three winters ago, when she fell asleep, and she hasn\'t aged a day since. Golden hair spread across the pillow. A small crease between her eyebrows, as though she\'s listening hard for something.');
                if (G.flag('wennaStory') || G.flag('heardElsieName')) await G.say('Elsie Hale.');
            },
            async talk(G) {
                await G.say('You kneel by the bed and whisper her name.');
                await G.say('In her sleep, very softly, Elsie murmurs: *"...and then what happened, Papa?"*');
            },
            use: 'You tuck the quilt in a little more firmly around her. She sighs, but doesn\'t wake.',
            items: {
                async tale(G) {
                    await G.say('You hold the Unfinished Tale up by her pillow. Her eyelids flicker.');
                    await G.line('Elsie', '...Papa? Is that the next part?');
                    await G.say('And then she is still again. It isn\'t your voice she\'s listening for.');
                },
                async quill(G) {
                    await G.say('You lay the golden quill on the quilt beside her hand. Her fingers curl toward it in her sleep, the way they must have curled around her father\'s pen when she was tiny.');
                    await G.say('You pick it up again. It wants a hand that knows the story.');
                },
                book: 'You open the Book of Tales and begin to read to her — but it\'s not her story, and she doesn\'t stir.',
                bottle: 'You hold up Gran\'s glowing bottle. The light falls across her face, warm and gold. But these are Gran\'s stories. Elsie is waiting for someone else\'s.',
                poker: 'Absolutely not.',
            },
        },
        {
            id: 'box', name: 'the music box', shape: { rect: [60, 86, 24, 40] }, at: [74, 166], face: 'up',
            look: (G) => G.say(G.flag('boxOpen')
                ? 'The lighthouse music box stands open, its lamp glowing faintly, its little tune long since run down.'
                : 'A music box shaped like a lighthouse, painted red and white, with a golden lamp at the top. There\'s a tiny keyhole in its base — the winding kind.'),
            use: (G) => G.say(G.flag('boxOpen') ? 'It has played its tune. It has given up its secret. It seems content.' : 'The lid is shut fast, and it won\'t play without winding. The keyhole in the base is tiny.'),
            items: {
                async brasskey(G) {
                    await G.say('You fit the little brass key from the well into the keyhole. It turns sweetly, as if it has been waiting for exactly this.');
                    const dur = G.lullaby();
                    await G.wait(Math.min(3500, dur * 1000));
                    await G.say('A tune spills out — slow and silvery and a little sad, the kind of tune that sounds like somebody tucking you in.');
                    await G.say('Behind you, in the bed, Elsie smiles in her sleep.');
                    await G.say('With a click, the lighthouse\'s lamp swings open. Inside, folded small, is a thin, hand-sewn book.');
                    G.take('brasskey');
                    G.set('boxOpen');
                    G.give('tale');
                    G.award('musicBox');
                    G.chron('box', 'The little brass key from the Brackenford well fitted Elsie\'s music box exactly. She had dropped it down the well long ago, wishing that the lighthouse story would never end — and inside the box, folded small, was the lighthouse story itself: unfinished.');
                },
                silverkey: 'Too big, and the wrong shape. This keyhole wants something tiny and brass.',
            },
        },
        {
            id: 'diary', name: 'the diary', shape: { rect: [186, 120, 16, 10] }, at: [194, 170], face: 'up',
            look: 'A small red diary on the nightstand, with a lock that isn\'t locked.',
            async use(G) {
                await G.say('Most of the pages are about ordinary things: a fox seen from the window, a pie, how much Brimble weighs (A LOT, underlined three times), a riddle for Graniteface that doesn\'t quite work.');
                await G.say('The last entry is written very carefully, in her best letters:');
                await G.say('*Papa has not told the rest of the lighthouse story since Mama. When I ask, he goes all quiet and looks out of the window. I think he does not know how it ends.*\n\n*So I am going to wait up for it. I am going to wait up for as long as it takes.*');
                if (!G.flag('readDiary')) {
                    G.set('readDiary');
                    G.award('diary');
                    G.chron('diary', 'In the tower, Rowan read the last page of Elsie Hale\'s diary and understood that she had never been enchanted at all — not really. She was waiting. She had fallen asleep waiting for her father to finish the story.');
                }
            },
        },
        {
            id: 'birds', name: 'the paper birds', shape: { rect: [20, 0, 290, 20] }, far: true,
            look: 'Hundreds of paper birds, folded from the pages of spell-books and hung from the ceiling on threads. Each one has a single word written on its wing. *Wake. Please. Wake. Please. Elsie. Wake.*',
        },
        {
            id: 'window', name: 'the window', shape: { rect: [118, 8, 84, 104] }, at: [160, 152], face: 'up',
            look: (G) => G.say(G.flag('released')
                ? 'Down in the valley, every light in Brackenford is burning, and more are coming on all the time.'
                : 'The whole valley is spread out below the window: the dark pines, the silver thread of the Grumblewater, and the tiny lit windows of Brackenford. From up here it looks like something out of a story.'),
            use: 'The window doesn\'t open. Somebody has made very sure of that.',
        },
        {
            id: 'tapestry', name: 'the tapestry', shape: { rect: [28, 20, 64, 84] }, at: [60, 166], face: 'up',
            look: 'A tapestry of a lighthouse on a crag, its lamp throwing gold across a dark blue sea. The stitching is clumsy in places — a child helped with it, and nobody unpicked her work.',
        },
        {
            id: 'horse', name: 'the toy horse', shape: { rect: [104, 158, 24, 22] }, at: [132, 178], face: 'left',
            look: 'A little wooden horse, orange paint worn pale where small hands held it.',
            use: 'You give the horse a push. It rocks, and settles, and waits for someone who will be better at playing with it.',
        },
        {
            id: 'down', name: 'back down the stair', shape: { rect: [0, 90, 16, 110] }, at: [4, 174], exit: 'library',
            look: 'The narrow stair back down to the library.',
        },
    ],

    async enter(G, first) {
        if (!first) return;
        await G.say('The stair winds up and up, and comes out at last in a round room full of moonlight.');
        await G.say('There are toys on the floor. There are paper birds hanging from the ceiling. And in a bed under a patchwork quilt, a little girl is fast asleep.');
    },
};
