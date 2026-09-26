/**
 * hut — Wenna's cottage in the pines. She was Elsie's nurse, and she knows
 * the truth about the Warlock. She also brews a very good sleeping draught.
 */

import { rect, grad, glow, planks, stones, poly, ellipse, circle, line, speckle, hexA } from '../paint.js';
import { wenna } from '../npcs.js';

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

async function brew(G) {
    G.take('moonbells');
    await G.line('Wenna', 'Moonbells! Oh, and fresh ones. Give them here, dear.');
    await G.say('Wenna strips the petals into her cauldron with quick, knotty fingers, muttering what might be a recipe and might be a rhyme. The steam turns the exact blue of the flowers and smells of clean sheets.');
    await G.animate('brew', 1600);
    await G.say('She ladles a little of it into a glass vial, stoppers it, and presses it into your hand.');
    await G.line('Wenna', 'Three drops for a hound. A whole vial for anything bigger. And don\'t you go drinking it.');
    G.give('draught');
    G.set('gotDraught');
    G.award('draught');
}

async function talkWenna(G) {
    for (;;) {
        const opts = [], acts = [];
        opts.push('Do you know the Warlock?'); acts.push('warlock');
        if (G.flag('wennaWarlock')) { opts.push('What happened to Elsie?'); acts.push('elsie'); }
        opts.push('How do I get inside Greymantle?'); acts.push('door');
        if (G.flag('wennaDoor') && !G.flag('gotDraught')) { opts.push('Could you make me a sleeping draught?'); acts.push('draught'); }
        opts.push('Goodbye, Wenna.'); acts.push('bye');
        const a = acts[await G.choose(opts, null, 'Wenna')];
        if (a === 'warlock') {
            await G.line('Wenna', 'Corvin? *Know* him! I was nurse to his girl for seven years. Elsie. Sweetest child in the county, and the worst in the world at bedtimes.');
            await G.line('Wenna', 'She\'d not close her eyes till her papa had told her a story, and it always had to be the same one — the lighthouse at the end of the world. He made it up for her, a bit at a time. A new piece every night.');
            G.set('wennaWarlock');
        } else if (a === 'elsie') {
            await G.say('Wenna\'s needles slow, and stop.');
            await G.line('Wenna', 'The winter her mother died, Corvin stopped telling it. Couldn\'t bear to, I think. It had been a story for the three of them, and now there were only two, and he didn\'t know how it went any more.');
            await G.line('Wenna', 'Elsie waited up for the next part. Night after night she waited. And then one night she fell asleep waiting — and she never woke up.');
            await G.line('Wenna', 'That was three winters ago. He\'s tried every spell in every book. And when the spells ran out, he started on the stories. Every story in the valley, I shouldn\'t wonder, by now. Looking for the one that\'ll wake her.');
            if (!G.flag('wennaStory')) {
                G.set('wennaStory');
                G.award('wennaStory');
                G.chron('wenna', 'In a cottage in the pines, old Wenna told Rowan the truth about the Warlock: that he had a daughter, Elsie, who fell asleep waiting for the end of a story and never woke; and that every tale in the valley had been taken to find the one that would wake her.');
            }
        } else if (a === 'door') {
            await G.line('Wenna', 'The front door\'s the only door. It has a face, and the face asks riddles, and it won\'t open to anybody who can\'t answer them. Elsie used to sit on its nose and make up new ones for it. Think like a child at bedtime and you\'ll not go far wrong.');
            await G.line('Wenna', 'And mind Brimble, once you\'re in. Corvin\'s hound. Big as a pony and soft as butter, and he\'ll knock you clean off the stair out of pure friendliness. Only thing that ever calmed him was a good bone — and at bath-time, I\'ll admit, I used to put a drop of sleeping draught on it.');
            G.set('wennaDoor');
        } else if (a === 'draught') {
            if (G.has('moonbells')) { await brew(G); continue; }
            await G.line('Wenna', 'I could, if I had moonbells. They only bloom on the longest night — which is tonight, lucky for you. There\'s a patch of them under the pines, down by the old signpost.');
        } else {
            await G.line('Wenna', 'Mind how you go, dear. And if you see Corvin — tell him Wenna says he\'s to eat something.');
            return;
        }
    }
}

export default {
    id: 'hut',
    name: "Wenna's Cottage",
    ambience: 'hearth',
    scale: [144, 0.95, 198, 1.12],
    entries: { default: [60, 172, 'right'], pines: [34, 168, 'right'] },
    bgKey: (S) => String(S.flag('boneTaken')),

    paint(g, S, R) {
        // walls: wattle and daub, greenish in the herb-smoke
        grad(g, 0, 0, 320, 146, [[0, '#3a2418'], [0.25, '#6b4226'], [1, '#a0703c']]);
        speckle(g, R, 0, 20, 320, 124, ['#6b4226', '#a0703c', '#3f8a3a'], 500);
        rect(g, 0, 0, 320, 16, '#3a2418');
        for (const x of [40, 150, 206, 308]) rect(g, x, 0, 6, 146, '#3a2418');
        rect(g, 0, 16, 320, 4, '#16301f');
        // herbs hanging from the beam
        for (let i = 0; i < 16; i++) {
            const x = 50 + i * 16 + ((R() * 6) | 0);
            if (x > 300) break;
            line(g, x, 18, x, 26, '#3a2418', 1);
            const c = ['#3f8a3a', '#74b94a', '#7d4a78', '#b6d97a', '#a0703c'][(R() * 5) | 0];
            poly(g, [[x - 3, 26], [x + 3, 26], [x + 1, 40 + R() * 8], [x - 1, 40 + R() * 8]], c);
        }

        // floor
        rect(g, 0, 142, 320, 58, '#3a2418');
        planks(g, R, 0, 144, 320, 56, 7, ['#6b4226', '#3a2418', '#6b4226'], '#1c2029', true);
        ellipse(g, 150, 176, 70, 14, '#255b33');
        ellipse(g, 150, 176, 62, 11, '#3f8a3a');
        ellipse(g, 150, 176, 44, 7, '#255b33');

        // door (left)
        rect(g, 4, 54, 34, 92, '#1c2029');
        planks(g, R, 8, 58, 26, 88, 6, ['#3a2418', '#6b4226'], '#1c2029');
        rect(g, 28, 98, 3, 4, '#8a90a0');

        // hearth, fire and cauldron
        stones(g, R, 52, 60, 80, 84, 10, 6, ['#555c6a', '#2e3440', '#8a90a0'], '#1c2029');
        rect(g, 64, 96, 56, 48, '#0d0b14');
        rect(g, 48, 56, 88, 6, '#3a2418');
        rect(g, 70, 136, 44, 6, '#3a2418');
        ellipse(g, 92, 122, 16, 12, '#1c2029');
        ellipse(g, 92, 112, 16, 4, '#2e3440');
        ellipse(g, 92, 112, 13, 2.6, S.flag('gotDraught') ? '#3f5f9a' : '#3f8a3a');
        line(g, 76, 100, 108, 100, '#2e3440', 2);
        line(g, 92, 100, 92, 108, '#2e3440', 1);
        // jars on the mantel
        for (const [x, c] of [[56, '#b6d97a'], [66, '#7d4a78'], [112, '#e0782c'], [122, '#6fc7c0']]) {
            rect(g, x, 46, 7, 10, c); rect(g, x, 44, 7, 2, '#a0703c');
        }

        // small window with the moon
        rect(g, 108, 26, 30, 26, '#3a2418');
        grad(g, 111, 29, 24, 20, [[0, '#0d0b14'], [1, '#2b3a67']]);
        circle(g, 128, 36, 4, '#f4ecd8');
        rect(g, 122, 29, 2, 20, '#3a2418');

        // Elsie's portrait
        rect(g, 166, 40, 32, 38, '#e0782c');
        rect(g, 168, 42, 28, 34, '#f4c542');
        grad(g, 170, 44, 24, 30, [[0, '#6d93c9'], [1, '#a8c8e8']]);
        rect(g, 179, 58, 6, 16, '#1b1f3b');           // Corvin's coat
        rect(g, 180, 52, 4, 6, '#e8b89a');            // his face
        rect(g, 180, 50, 4, 2, '#8a90a0');
        rect(g, 179, 45, 6, 6, '#f4c542');            // Elsie on his shoulders
        rect(g, 180, 47, 4, 3, '#e8b89a');
        rect(g, 176, 58, 3, 1, '#1b1f3b'); rect(g, 185, 58, 3, 1, '#1b1f3b');
        rect(g, 170, 70, 24, 4, '#74b94a');

        // shelves of jars
        for (let s = 0; s < 3; s++) {
            const sy = 44 + s * 22;
            rect(g, 222, sy + 14, 80, 3, '#3a2418');
            for (let i = 0; i < 8; i++) {
                const x = 224 + i * 10;
                const c = ['#3f8a3a', '#6fc7c0', '#7d4a78', '#e0782c', '#b6d97a', '#f4c542', '#c86f8f', '#a8c8e8'][(R() * 8) | 0];
                const hh = 8 + ((R() * 5) | 0);
                rect(g, x, sy + 14 - hh, 7, hh, '#c3c7d0');
                rect(g, x + 1, sy + 16 - hh, 5, hh - 3, c);
                rect(g, x + 1, sy + 13 - hh, 5, 2, '#6b4226');
            }
        }

        // table with the soup pot
        rect(g, 214, 118, 60, 6, '#6b4226');
        rect(g, 214, 118, 60, 2, '#a0703c');
        rect(g, 218, 124, 4, 30, '#3a2418');
        rect(g, 266, 124, 4, 30, '#3a2418');
        ellipse(g, 240, 112, 14, 8, '#2e3440');
        rect(g, 226, 104, 28, 10, '#2e3440');
        ellipse(g, 240, 104, 14, 3, '#555c6a');
        if (!S.flag('boneTaken')) {
            line(g, 236, 104, 248, 92, '#f4ecd8', 3);
            circle(g, 249, 91, 2, '#f4ecd8'); circle(g, 247, 89, 2, '#f4ecd8');
        }
        rect(g, 258, 112, 10, 6, '#a0703c'); // bread

        // light
        glow(g, 92, 120, 130, '#f0a878', 0.3);
        glow(g, 92, 112, 40, '#b6d97a', 0.2);
        const vg = g.createRadialGradient(150, 110, 90, 150, 110, 250);
        vg.addColorStop(0, hexA('#0d0b14', 0));
        vg.addColorStop(1, hexA('#0d0b14', 0.55));
        g.fillStyle = vg;
        g.fillRect(0, 0, 320, 200);
    },

    walk: () => ({
        areas: [[[4, 148], [316, 148], [318, 199], [2, 199]]],
        blockers: [
            [[124, 150], [158, 150], [158, 170], [124, 170]],
            [[48, 142], [134, 142], [134, 152], [48, 152]],
            [[210, 144], [276, 144], [276, 158], [210, 158]],
        ],
    }),

    actors(S, t, A, sp) {
        return [{ y: 168, draw: (g, tt) => wenna(g, 144, 168, tt, sp === 'Wenna') }];
    },

    overlay(g, S, t, A) {
        for (let i = 0; i < 6; i++) {
            const h = 6 + Math.sin(t * 9 + i * 1.3) * 3;
            px(g, 78 + i * 5, 134 - h, 4, h, '#e0782c');
            px(g, 79 + i * 5, 134 - h * 0.6, 2, h * 0.6, '#f4c542');
        }
        const blue = S.flag('gotDraught') || A('brew') > 0;
        for (let i = 0; i < 5; i++) {
            const p = (t * 0.3 + i / 5) % 1;
            const x = 86 + ((i * 7) % 14) + Math.sin(t * 2 + i) * 3;
            px(g, x, 108 - p * 40, 2 + p * 3, 2, blue ? (p < 0.5 ? '#6d93c9' : '#a8c8e8') : (p < 0.5 ? '#74b94a' : '#b6d97a'));
        }
        if (A('brew') > 0 && A('brew') < 1) {
            for (let i = 0; i < 8; i++) px(g, 80 + Math.random() * 24, 100 + Math.random() * 12, 1, 1, '#ffffff');
        }
    },

    look: 'Wenna\'s cottage is small and warm and entirely full: of herbs hanging from the beams, of jars on every shelf, of steam from the cauldron and the smell of soup. It\'s the sort of room where nothing bad has ever happened, or at least never been allowed to stay.',

    hotspots: [
        {
            id: 'wenna', name: 'Wenna', shape: { rect: [124, 120, 30, 50] }, at: [112, 174], face: 'right',
            look: 'Old Wenna: a small, round, apple-cheeked woman with a white bun and a green shawl, knitting something long and red at a tremendous speed. She has a face that has told a great many children to go to sleep, and meant it kindly every time.',
            talk: talkWenna,
            use: 'Wenna swats your hand away without dropping a stitch. "Hands off the knitting, dear."',
            items: {
                moonbells: brew,
                async quill(G) {
                    await G.say('Wenna\'s needles stop dead.');
                    await G.line('Wenna', 'Where did you — that\'s *Corvin\'s*. His golden quill. He wrote Elsie\'s story with it, every night, a page at a time.');
                    await G.line('Wenna', 'The night she fell asleep, he threw it out of the tower window. Swore he\'d never write another word.');
                    await G.say('She turns it over in her fingers, and gives it back.');
                    await G.line('Wenna', 'Seems to me, dear, a pen that\'s thrown away is still a pen.');
                    G.set('knowQuill');
                },
                async brasskey(G) {
                    await G.line('Wenna', 'Why — that\'s the key to Elsie\'s music box! The little lighthouse. She lost it at the harvest fair, years ago. Made a wish on it and dropped it down the village well, and cried all the way home.');
                    await G.line('Wenna', 'She wished the lighthouse story would never end. Children don\'t understand what they\'re wishing for. Neither do grown-ups, mostly.');
                    G.set('knowKey');
                },
                async tale(G) {
                    await G.say('Wenna\'s hands go very still.');
                    await G.line('Wenna', 'He never finished it. She used to ask me how it ended, and I\'d say, "Your papa will tell you, pet." I never thought —');
                    await G.say('She presses it back into your hands, hard.');
                    await G.line('Wenna', 'Take it to him. It\'s his. It was always his.');
                },
                async bottle(G) {
                    await G.line('Wenna', 'Oh — that\'s Mab Ashby\'s. I\'d know that glow anywhere. She told me a story once, when I was a girl, about a hedgehog who —');
                    await G.say('She trails off.');
                    await G.line('Wenna', 'No. It\'s gone. Get it home, dear.');
                },
                button: (G) => G.line('Wenna', 'That\'s the miller\'s girl\'s, isn\'t it? Everything shiny in this forest ends up in that magpie\'s nest sooner or later.'),
                penny: (G) => G.line('Wenna', 'Keep your penny, dear. I\'ve no use for money out here — the forest doesn\'t take it.'),
                bone: (G) => G.line('Wenna', 'Keep it, keep it. The soup doesn\'t want it back.'),
                draught: (G) => G.line('Wenna', 'Three drops, mind. *Three.*'),
                drowsybone: (G) => G.line('Wenna', 'Ha! That\'ll put Brimble down like a sack of flour. Clever child.'),
                poker: (G) => G.line('Wenna', 'You put that down before you have somebody\'s eye out.'),
            },
        },
        {
            id: 'bone', name: 'the soup pot', shape: { rect: [224, 86, 32, 30] }, at: [240, 164], face: 'up',
            look: (G) => G.say(G.flag('boneTaken')
                ? 'A soup pot, now boneless.'
                : 'A soup pot, and sticking out of it, a large bone — boiled clean of soup, but very much not of smell.'),
            async use(G) {
                if (G.flag('boneTaken')) { await G.say('The soup is soup. You leave it be.'); return; }
                await G.say('You reach for the bone.');
                await G.line('Wenna', 'Take it, take it, dear. The soup\'s done with it.');
                G.set('boneTaken');
                G.give('bone');
                G.award('bone');
            },
        },
        {
            id: 'portrait', name: 'the little painting', shape: { rect: [164, 38, 36, 42] }, at: [180, 158], face: 'up',
            async look(G) {
                await G.say('A little painting in a gilt frame: a tall man in a coat stitched with stars, and on his shoulders a gap-toothed girl with hair like a haystack in August, both of them laughing at something outside the frame. In the corner, someone has written: *E. & Papa — the harvest fair.*');
                if (G.flag('wennaStory')) await G.say('Elsie Hale. She\'d be ten now, if she had grown at all.');
            },
            use: 'You straighten the frame. It was already straight. Wenna keeps it that way.',
        },
        {
            id: 'cauldron', name: 'the cauldron', shape: { rect: [70, 96, 44, 40] }, at: [100, 160], face: 'up',
            look: (G) => G.say(G.flag('gotDraught')
                ? 'The cauldron is still steaming a sleepy moonbell blue.'
                : 'A black iron cauldron simmering over a small, bright fire. It smells of nettles and something sweet.'),
            use: (G) => G.line('Wenna', 'Clockwise, dear, if you\'re going to stir it. Never widdershins. Unless you want frogs.'),
            items: {
                moonbells: brew,
                draught: 'You\'d rather keep it. It took moonbells to make.',
            },
        },
        {
            id: 'shelves', name: 'the shelves of jars', shape: { rect: [220, 28, 84, 56] }, at: [262, 164], face: 'up',
            look: 'Jars of every herb in the forest, each labelled in a spidery hand: FEVERFEW. SELF-HEAL. HEARTSEASE. FORGET-ME-NOT. And one, empty, labelled MOONBELLS — FOR THE LONGEST NIGHT ONLY.',
            use: (G) => G.line('Wenna', 'Ask before you take, dear. Half of those will cure you and the other half will turn you into a newt.'),
        },
        {
            id: 'herbs', name: 'the drying herbs', shape: { rect: [44, 16, 260, 30] }, far: true,
            look: 'Bundles of herbs hang drying from every beam: rosemary, sage, lavender, and several things you are fairly sure are illegal in towns.',
        },
        {
            id: 'window', name: 'the window', shape: { rect: [106, 24, 34, 30] }, far: true,
            look: 'Through the little window, the moon, snagged in the branches of the pines like a kite.',
        },
        {
            id: 'door', name: 'back out to the pines', shape: { rect: [4, 54, 34, 92] }, at: [30, 166], exit: 'pines', door: true,
            look: 'The door back out into the Whispering Pines.',
        },
    ],

    async enter(G, first) {
        if (!first) return;
        await G.say('You knock. The door flies open before your knuckles have finished, and an old woman peers up at you through a cloud of steam.');
        await G.line('Wenna', 'A visitor! On the longest night! Come in, come in, shut the door behind you — the cold\'s got opinions tonight.');
    },
};
