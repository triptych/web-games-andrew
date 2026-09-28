/**
 * cottage — Gran's cottage, where the tale begins (and, in one ending, where
 * it ends).
 */

import { rect, grad, glow, planks, stones, poly, ellipse, circle, line, speckle, hexA } from '../paint.js';
import { mab, cat } from '../npcs.js';

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

async function talkMab(G) {
    if (G.flag('giftEnding')) return;
    if (!G.flag('talkedMab')) {
        await G.line('Gran', "It's gone, Rowan. All of it. I opened the Book to tell you the one about the Fox and the Frost Giant — you always liked that one — and look.");
        await G.say('She turns the pages for you. They are clean and white and utterly empty, like new snow nobody has walked on yet.');
        await G.line('Gran', 'Sixty years I\'ve been telling stories. And tonight I opened my mouth and there was nothing in it but my teeth.');
    }
    for (;;) {
        const opts = [
            "What's happening to the stories, Gran?",
            'Who lives up on Greymantle?',
            G.flag('talkedMab') ? "I'll bring them home, Gran. I promise." : "I'm going up the mountain to get them back.",
            'Goodbye, Gran.',
        ];
        const c = await G.choose(opts, null, 'Gran');
        if (c === 0) {
            await G.line('Gran', "They're not being forgotten, love. They're being *taken*. There's a difference. When you forget a thing it leaves a hole the shape of itself — you can feel the edges of it. This leaves nothing at all. As if the story never was.");
            await G.line('Gran', 'It started three winters back. Only a few at first. Old Tam lost the words to his drinking song. The miller lost the end of his ballad. And every winter, on the longest night, more of them go.');
            await G.line('Gran', "And every winter, on the longest night, there's a light burning in the Warlock's tower.");
        } else if (c === 1) {
            await G.line('Gran', 'Corvin Hale. The Warlock of Greymantle, they call him now, but I remember him when he was just Corvin — a gangly young thing with ink on his fingers, who came down every year for the harvest fair.');
            await G.line('Gran', "Later he had a little girl. Elsie. She'd sit right there, where you're standing, and ask me for the one about the lighthouse. I never knew that one. She said her papa was making it up for her, a bit every night.");
            await G.line('Gran', 'Then one winter they didn\'t come down to the fair. And the winter after, the lights came on in the tower.');
            G.set('heardElsieName');
        } else if (c === 2) {
            if (!G.flag('talkedMab')) {
                await G.say('Gran looks at you for a long moment over the tops of her spectacles.');
                await G.line('Gran', "I ought to say no. I ought to say you're too young, and it's too cold, and the mountain's too high.");
                await G.line('Gran', "But you're the stubbornest child in Brackenford, and I haven't got a single story left to keep you here with.");
                await G.line('Gran', 'Take the Book. Every tale I ever told is meant to be written in it. If you find where they\'ve gone — well. A book knows its way home.');
                G.give('book');
                await G.line('Gran', "And this. My lucky penny. Your grandad gave it me the day we were wed. Luck's not much, but it's lighter than a sword.");
                G.give('penny');
                G.set('talkedMab');
                G.award('mabBook');
                G.chron('start', 'Once, on the longest night of the year, the stories of Brackenford began to go out. Old Mab Ashby, who had told them for sixty winters, found her Book of Tales as blank as snow. And her grandchild Rowan — who was stubborn in the way only the very young and the very old can be — took the Book and a lucky penny, and set out to bring the stories home.');
                await G.line('Gran', 'Go on, then, my — my —');
                await G.say('She frowns, and the frown goes on a moment too long.');
                await G.line('Gran', 'My dear. Go on, my dear.');
                await G.say('She has forgotten your name. You don\'t say anything. You don\'t quite trust yourself to.');
                return;
            }
            await G.line('Gran', 'I know you will, dear. Mind the troll on the bridge — he\'s soft as porridge, but he never lets anybody over for nothing. Take something to eat. You\'ll be hungry, and so, I expect, will everyone you meet.');
        } else {
            await G.line('Gran', G.flag('talkedMab') ? 'Wrap up warm, dear. And come home.' : 'Don\'t be long, love. It\'s cold out, and I\'ve nothing to tell you when you get back.');
            return;
        }
    }
}

export default {
    id: 'cottage',
    name: "Gran's Cottage",
    ambience: 'hearth',
    scale: [142, 0.95, 198, 1.12],
    entries: { default: [168, 172, 'left'], green: [288, 164, 'left'] },
    bgKey: (S) => [S.flag('cakeTaken'), S.flag('ropeTaken'), S.flag('pokerTaken')].join(),

    paint(g, S, R) {
        // back wall: plaster between timber frames
        grad(g, 0, 0, 320, 142, [[0, '#6b4226'], [1, '#a0703c']]);
        speckle(g, R, 0, 12, 320, 128, ['#a0703c', '#6b4226', '#cfa168'], 700);
        for (const x of [104, 196, 264]) rect(g, x, 0, 6, 142, '#3a2418');
        rect(g, 0, 0, 320, 12, '#3a2418');
        rect(g, 0, 12, 320, 3, '#6b4226');
        for (let x = 10; x < 320; x += 46) rect(g, x, 0, 8, 12, '#16301f');

        // floor
        rect(g, 0, 138, 320, 62, '#6b4226');
        let y = 140, h = 3;
        while (y < 200) {
            rect(g, 0, y, 320, 1, '#3a2418');
            for (let x = (y * 7) % 40; x < 320; x += 40 + (y % 3) * 7) rect(g, x, y - h, 1, h, '#3a2418');
            y += h; h += 1.2;
        }
        rect(g, 0, 138, 320, 3, '#3a2418');

        // rug
        ellipse(g, 74, 166, 46, 14, '#6e1f24');
        ellipse(g, 74, 166, 42, 12, '#b8332f');
        ellipse(g, 74, 166, 30, 8, '#6e1f24');
        ellipse(g, 74, 166, 26, 6, '#e0782c');

        // hearth & chimney
        stones(g, R, 16, 0, 84, 140, 12, 7, ['#555c6a', '#8a90a0', '#2e3440', '#555c6a'], '#1c2029');
        rect(g, 10, 52, 96, 7, '#3a2418');
        rect(g, 10, 52, 96, 2, '#6b4226');
        rect(g, 30, 80, 56, 58, '#1c2029');
        rect(g, 34, 84, 48, 54, '#0d0b14');
        rect(g, 38, 128, 40, 6, '#3a2418');
        rect(g, 42, 124, 32, 5, '#6b4226');
        // mantel ornaments
        rect(g, 20, 40, 3, 12, '#f4c542'); rect(g, 19, 38, 5, 2, '#fbe7a1');
        rect(g, 92, 40, 3, 12, '#f4c542'); rect(g, 91, 38, 5, 2, '#fbe7a1');
        rect(g, 50, 38, 16, 14, '#6b4226'); circle(g, 58, 44, 5, '#f4ecd8');
        line(g, 58, 44, 58, 41, '#0d0b14'); line(g, 58, 44, 61, 44, '#0d0b14');
        rect(g, 74, 44, 8, 8, '#2f8a8a');

        // window onto Greymantle
        rect(g, 136, 34, 56, 60, '#3a2418');
        grad(g, 140, 38, 48, 52, [[0, '#2a1a3a'], [0.5, '#7d4a78'], [1, '#f0a878']]);
        poly(g, [[140, 90], [140, 76], [156, 62], [166, 48], [178, 64], [188, 72], [188, 90]], '#2b3a67');
        poly(g, [[162, 54], [166, 48], [170, 54]], '#8a90a0');
        rect(g, 165, 42, 2, 7, '#1b1f3b');
        rect(g, 140, 62, 48, 2, '#3a2418');
        rect(g, 163, 38, 2, 52, '#3a2418');
        rect(g, 132, 92, 64, 5, '#6b4226');
        // flowerpot on the sill
        rect(g, 176, 86, 8, 6, '#b8332f');
        circle(g, 178, 83, 2.5, '#3f8a3a'); circle(g, 182, 82, 2.5, '#74b94a');

        // peg and rope
        rect(g, 122, 56, 3, 3, '#3a2418');
        if (!S.flag('ropeTaken')) {
            for (let i = 0; i < 4; i++) {
                g.strokeStyle = i % 2 ? '#cfa168' : '#a0703c';
                g.lineWidth = 2;
                g.beginPath();
                g.ellipse(124, 72, 8 - i, 12 - i * 1.5, 0, 0, Math.PI * 2);
                g.stroke();
            }
            line(g, 126, 82, 128, 92, '#a0703c', 2);
        }

        // bookshelf
        rect(g, 200, 22, 58, 90, '#3a2418');
        for (let s = 0; s < 4; s++) {
            const sy = 26 + s * 21;
            rect(g, 203, sy, 52, 18, '#1c2029');
            let bx = 204;
            while (bx < 252) {
                const bw = 3 + ((R() * 3) | 0), bh = 12 + ((R() * 6) | 0);
                const col = ['#b8332f', '#2b3a67', '#3f8a3a', '#6b4226', '#7d4a78', '#a0703c', '#2f8a8a'][(R() * 7) | 0];
                if (bx + bw > 254) break;
                rect(g, bx, sy + 18 - bh, bw, bh, col);
                rect(g, bx, sy + 20 - bh, bw, 1, '#f4c542');
                bx += bw + (R() < 0.15 ? 3 : 0);
            }
            rect(g, 201, sy + 18, 56, 3, '#6b4226');
        }
        // a book lying open and blank on top
        poly(g, [[212, 22], [228, 20], [244, 22], [244, 18], [228, 16], [212, 18]], '#f4ecd8');

        // table
        rect(g, 192, 112, 76, 7, '#a0703c');
        rect(g, 192, 112, 76, 2, '#cfa168');
        rect(g, 194, 119, 72, 6, '#6b4226');
        rect(g, 198, 125, 5, 30, '#3a2418');
        rect(g, 257, 125, 5, 30, '#3a2418');
        rect(g, 226, 125, 4, 22, '#3a2418');
        // candle on the table
        rect(g, 250, 102, 4, 10, '#f4ecd8');
        rect(g, 247, 110, 10, 2, '#f4c542');
        if (!S.flag('cakeTaken')) {
            ellipse(g, 222, 112, 11, 3, '#c3c7d0');
            rect(g, 214, 104, 16, 7, '#cfa168');
            ellipse(g, 222, 104, 8, 3, '#f4c542');
            ellipse(g, 220, 103, 4, 1.4, '#fbe7a1');
            rect(g, 216, 106, 1, 3, '#f4c542'); rect(g, 227, 106, 1, 4, '#f4c542');
        }
        // mug
        rect(g, 204, 105, 7, 7, '#2f8a8a'); rect(g, 211, 107, 2, 3, '#2f8a8a');

        // door (right)
        rect(g, 268, 42, 46, 98, '#3a2418');
        planks(g, R, 272, 46, 38, 94, 6, ['#6b4226', '#6b4226', '#a0703c'], '#3a2418');
        rect(g, 272, 62, 38, 3, '#2e3440');
        rect(g, 272, 118, 38, 3, '#2e3440');
        rect(g, 276, 90, 4, 6, '#8a90a0');

        // poker & fire tools
        rect(g, 98, 108, 2, 30, '#2e3440');
        rect(g, 94, 136, 10, 3, '#2e3440');
        if (!S.flag('pokerTaken')) {
            line(g, 91, 138, 95, 100, '#2e3440', 2);
            line(g, 95, 100, 98, 103, '#2e3440', 2);
        }

        // warm light from fire and candle, cool from the window
        glow(g, 58, 110, 150, '#f0a878', 0.35);
        glow(g, 58, 118, 60, '#f4c542', 0.35);
        glow(g, 252, 102, 40, '#f4c542', 0.3);
        glow(g, 164, 64, 60, '#7d4a78', 0.18);
        // corners fall into shadow
        const vg = g.createRadialGradient(140, 110, 90, 140, 110, 260);
        vg.addColorStop(0, hexA('#0d0b14', 0));
        vg.addColorStop(1, hexA('#0d0b14', 0.55));
        g.fillStyle = vg;
        g.fillRect(0, 0, 320, 200);
    },

    walk: () => ({
        areas: [[[6, 142], [314, 142], [318, 199], [2, 199]]],
        blockers: [
            [[190, 138], [270, 138], [270, 158], [190, 158]],
            [[90, 148], [126, 148], [126, 168], [90, 168]],
            [[46, 144], [74, 144], [74, 156], [46, 156]],
        ],
    }),

    actors(S, t, A, sp) {
        return [
            { y: 164, draw: (g, tt) => mab(g, 108, 164, tt, sp === 'Gran') },
            { y: 153, draw: (g, tt) => cat(g, 60, 153, tt) },
        ];
    },

    overlay(g, S, t) {
        // fire
        for (let i = 0; i < 7; i++) {
            const fx = 44 + i * 5;
            const h = 10 + Math.sin(t * 9 + i * 1.7) * 4 + Math.sin(t * 13 + i) * 3;
            px(g, fx, 124 - h, 4, h, '#e0782c');
            px(g, fx + 1, 124 - h * 0.7, 2, h * 0.7, '#f4c542');
            px(g, fx + 1, 124 - h * 0.35, 2, h * 0.35, '#fbe7a1');
        }
        // candle flame
        const fl = Math.sin(t * 11) > 0 ? 1 : 0;
        px(g, 251, 97 + fl, 2, 4 - fl, '#f4c542');
        px(g, 251, 99, 2, 2, '#fbe7a1');
        // the light in the tower, far off through the window
        if (Math.sin(t * 2.3) > -0.6) px(g, 165, 44, 2, 2, '#f4c542');
    },

    look: 'Gran\'s cottage: one room, one fire, one rocking chair, and more books than any cottage has a right to. It has always smelled of woodsmoke and honey. Tonight it smells of woodsmoke, honey, and something missing.',

    hotspots: [
        {
            id: 'mab', name: 'Gran', shape: { rect: [92, 118, 30, 48] }, at: [134, 170], face: 'left',
            look: 'Gran — Mab Ashby, storyteller of Brackenford — in her rocking chair by the fire, with the empty Book of Tales in her lap. She looks smaller tonight. Stories, you realise, took up a lot of room in her.',
            talk: talkMab,
            use: 'You give Gran a hug. She hugs you back a little too carefully, the way you\'d hug someone you\'d only just met.',
            items: {
                cake: '"That\'s for your journey, dear," says Gran, pushing it back to you. "You\'ll meet someone hungrier than me."',
                book: '"No, dear, you keep it. It knows where it\'s going better than I do."',
                penny: '"Keep it, keep it. I\'ve had my share of luck. I had you."',
                bottle: 'You hold up the glowing bottle. Gran leans toward it like a plant toward a window, but frowns. "Not in the bottle, love. Stories don\'t go back in through your ears. They go in the Book."',
                default: (G) => G.line('Gran', "What's that, dear? No, you hang on to it."),
            },
        },
        {
            id: 'cat', name: 'Button the cat', shape: { rect: [46, 142, 28, 14] }, at: [82, 162], face: 'left',
            look: 'Button, Gran\'s marmalade cat, asleep on the hearthrug in the exact shape of a cinnamon bun. Button has never had a story taken, because Button has never listened to one.',
            talk: (G) => G.line('Button', 'Mrrp.'),
            use: 'You scratch Button behind the ears. Button purrs like a small, furry kettle and does not wake up.',
            items: {
                cake: 'Button opens one eye, sniffs the honey cake, and closes the eye again. Cats have no interest in anything you actually want them to have.',
                poker: 'Absolutely not. Button is the only one in this cottage who is having a good night.',
            },
        },
        {
            id: 'cake', name: 'the honey cake', shape: { rect: [212, 100, 22, 14] }, at: [226, 164], face: 'up',
            when: (S) => !S.flag('cakeTaken'),
            look: 'A honey cake on Gran\'s best plate, sticky and golden and still faintly warm. She baked it this morning, before she forgot the recipe. There may never be another.',
            async use(G) {
                G.set('cakeTaken');
                G.give('cake');
                G.award('cake');
                await G.say('You wrap the honey cake in a handkerchief and tuck it in your satchel. Your stomach makes an objection, which you overrule.');
            },
        },
        {
            id: 'rope', name: 'the coil of rope', shape: { rect: [112, 56, 24, 38] }, at: [132, 150], face: 'up',
            when: (S) => !S.flag('ropeTaken'),
            look: 'A coil of good hemp rope hanging on a peg by the window. Gran uses it for the washing line in summer.',
            async use(G) {
                G.set('ropeTaken');
                G.give('rope');
                G.award('rope');
                await G.say('You lift the rope off its peg and sling it over your shoulder. Every adventurer in every one of Gran\'s stories carried a rope. You never found out why. Perhaps tonight you will.');
            },
        },
        {
            id: 'poker', name: 'the iron poker', shape: { rect: [88, 98, 14, 42] }, at: [86, 150], face: 'right',
            when: (S) => !S.flag('pokerTaken'),
            look: 'A black iron poker with a hooked end, leaning against the hearth.',
            async use(G) {
                G.set('pokerTaken');
                G.give('poker');
                G.award('poker');
                await G.say('You take the poker. It is heavy and black and it makes you feel about four inches taller. You would not, of course, *hit* anybody with it.');
            },
        },
        {
            id: 'fire', name: 'the fire', shape: { rect: [30, 80, 56, 58] }, at: [96, 172],
            look: 'The fire crackles and spits and throws your shadow up the wall, twice as tall as you. Gran used to make shadow-animals in that light — a rabbit, a wolf, a dragon — and tell you what they were thinking.',
            use: 'You hold your hands out to the fire. It helps, a little.',
            items: {
                book: 'Never. Not in a hundred years.',
                poker: 'You give the fire a poke. It sends up a fountain of sparks, which is satisfying, and nothing else, which is not.',
                cake: 'Toasted honey cake would be delicious. It would also be gone.',
            },
        },
        {
            id: 'mantel', name: 'the mantelpiece', shape: { rect: [10, 36, 96, 24] }, at: [96, 172],
            look: 'Two brass candlesticks, a clock that stopped the year Grandad died and has never been wound since, and a little teal jar where Gran keeps her buttons and her grudges.',
            use: 'You don\'t touch Gran\'s mantelpiece. Nobody touches Gran\'s mantelpiece.',
        },
        {
            id: 'window', name: 'the window', shape: { rect: [136, 34, 56, 60] }, at: [164, 148], face: 'up',
            look: 'Through the window, the last of the sunset is draining out of the sky, and Greymantle stands against it like a sleeping giant with its collar turned up. At its very peak, a single light burns in the Warlock\'s tower.',
            use: 'The window is painted shut, and has been since before you were born.',
        },
        {
            id: 'shelf', name: 'the bookshelf', shape: { rect: [200, 16, 58, 96] }, at: [230, 164], face: 'up',
            look: 'Gran\'s books — hundreds of them, fat and thin and leather and cloth. Every one of them, you already know without looking, has gone as white inside as a fresh snowfall.',
            async use(G) {
                await G.say('You pull one down and flip through it. Blank. And another. Blank. In a third, the title page says *The* — just *The* — as if even the rest of the title ran off in the night.');
            },
        },
        {
            id: 'table', name: 'the table', shape: { rect: [190, 100, 80, 56] }, at: [230, 164], face: 'up',
            look: 'Gran\'s kitchen table, scrubbed white, with a candle, a mug of cold tea, and the ghost of a thousand suppers.',
        },
        {
            id: 'door', name: 'outside', shape: { rect: [268, 42, 46, 98] }, at: [290, 160], exit: 'green', door: true,
            exitIf: (S) => S.flag('talkedMab'),
            blocked: 'You can\'t go without saying goodbye to Gran. You\'ve never once gone out of that door without saying goodbye to Gran.',
            look: 'The front door. Beyond it: the village green, the road, the bridge, the forest, and the mountain.',
        },
    ],

    async enter(G, first) {
        if (!first) return;
        await G.say('The fire is lit. The kettle has boiled. Gran is in her rocking chair with the Book of Tales open on her knees, and she is staring at it as if it were written in a language she has never seen.');
        await G.line('Gran', 'Rowan? Is that you, love? Come here. Come and look at this.');
    },
};
