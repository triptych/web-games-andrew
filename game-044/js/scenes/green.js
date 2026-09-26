/**
 * green — Brackenford village green at dusk: the well, the notice board,
 * Pell and her doll, and the road north to Greymantle.
 */

import { rect, grad, glow, planks, stones, poly, ellipse, circle, line, speckle, tufts, ridge, stars, pine, mountain, hexA } from '../paint.js';
import { pell } from '../npcs.js';

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

async function talkPell(G) {
    if (G.flag('pellHappy')) {
        await G.line('Pell', 'Shh! I\'m at the good bit. The princess has just made friends with the something, and now it\'s going to fly her home, and she\'s going to be *extremely* rude to the tower on the way out.');
        if (!G.flag('pellButtonBack') && !G.has('button')) await G.line('Pell', 'If you see that magpie, tell her she\'s a thief. She took my red button. Mam says she\'ll swap, sometimes, if you give her something shinier.');
        return;
    }
    if (!G.flag('metPell')) {
        G.set('metPell');
        await G.line('Pell', 'Rowan! Rowan, look. My doll\'s a princess, and she\'s locked in a tower by a — by a —');
        await G.say('Pell scrunches up her whole face with effort.');
        await G.line('Pell', '— by a *something*. And she\'s meant to be rescued by a — ' + "a — I can't remember who rescues her. Gran Mab would know. Gran Mab knows everything.");
    }
    for (;;) {
        const c = await G.choose([
            "Gran's forgotten too, Pell.",
            'Maybe the princess rescues herself.',
            'Have you seen anything strange tonight?',
            'Bye, Pell.',
        ], null, 'Pell');
        if (c === 0) {
            await G.say('Pell\'s lip wobbles dangerously.');
            await G.line('Pell', 'Then — then the princess is just going to stay in the tower *forever*?');
        } else if (c === 1) {
            await G.say('Pell stares at her doll as though it had just grown a second head.');
            await G.line('Pell', '...Can she *do* that?');
            await G.line('Rowan', 'In the best ones, she does.');
            await G.line('Pell', 'She could climb down her hair! No — she ties her bedsheets together! No, no, no — she makes *friends* with the something, and it flies her home!');
            await G.say('Pell bends over her doll and begins whispering furiously. You have the odd, prickling feeling that you have just watched a story being born.');
            G.set('pellHappy');
            G.award('pellEnding');
            G.chron('pell', 'On the village green, Rowan met a small girl whose doll was stuck in a story with no ending, and told her the princess could rescue herself. It was the first new story Brackenford had heard in three winters.');
            return;
        } else if (c === 2) {
            await G.line('Pell', 'The magpie from the Whispering Pines came and stole my button! Right off my coat! My best red one!');
            await G.line('Pell', 'Mam says that magpie takes anything shiny. She\'ll swap, sometimes, if you give her something shinier.');
        } else {
            await G.line('Pell', 'Bye, Rowan. If you find the end of my story, bring it back.');
            return;
        }
    }
}

export default {
    id: 'green',
    name: 'Brackenford Green',
    ambience: 'village',
    scale: [118, 0.6, 198, 1.02],
    entries: { default: [160, 178, 'down'], cottage: [53, 146, 'down'], bridge: [212, 124, 'down'] },
    bgKey: () => '',

    paint(g, S, R) {
        grad(g, 0, 0, 320, 120, [[0, '#2a1a3a'], [0.45, '#7d4a78'], [0.8, '#c86f8f'], [1, '#f0a878']]);
        stars(g, R, 40, 0, 0, 320, 40, ['#a8c8e8', '#fbe7a1']);
        glow(g, 150, 118, 140, '#f0a878', 0.35);
        // Greymantle
        glow(g, 216, 60, 70, '#c86f8f', 0.25);
        const [px0, pk] = mountain(g, R, 216, 26, 110, 124, '#4a2f5a', '#2a1a3a', '#c3c7d0', '#8a90a0');
        rect(g, px0 - 2, pk - 12, 5, 13, '#1b1f3b');
        poly(g, [[px0 - 3, pk - 12], [px0 + 4, pk - 12], [px0 + 0.5, pk - 18]], '#1b1f3b');
        // far hills and trees
        const h = ridge(g, R, 110, 8, '#2b3a67', 0.5, 0, 320, 130);
        for (let i = 0; i < 40; i++) {
            const x = R() * 320;
            pine(g, x, h(x) + 8, 8 + R() * 8, 5 + R() * 3, '#16301f', '#0d0b14');
        }
        // ground
        grad(g, 0, 116, 320, 84, [[0, '#255b33'], [1, '#3f8a3a']]);
        tufts(g, R, 0, 120, 320, 80, ['#74b94a', '#255b33', '#16301f'], 260);
        // low stone wall at the back, with a gap for the road
        stones(g, R, 90, 112, 104, 8, 8, 4, ['#555c6a', '#8a90a0'], '#2e3440');
        stones(g, R, 232, 114, 10, 8, 8, 4, ['#555c6a', '#8a90a0'], '#2e3440');
        // the road
        poly(g, [[196, 116], [228, 116], [250, 150], [300, 200], [150, 200], [180, 150]], '#6b4226');
        poly(g, [[40, 138], [66, 138], [120, 158], [160, 176], [150, 200], [110, 200], [80, 166]], '#6b4226');
        speckle(g, R, 150, 118, 150, 82, ['#a0703c', '#8a90a0', '#3a2418'], 300, 2);
        speckle(g, R, 40, 138, 110, 60, ['#a0703c', '#8a90a0', '#3a2418'], 160, 2);

        // Gran's cottage (left)
        rect(g, 4, 72, 98, 66, '#cfa168');
        speckle(g, R, 4, 72, 98, 66, ['#a0703c', '#f4ecd8'], 160);
        for (const x of [4, 36, 68, 98]) rect(g, x, 72, 4, 66, '#3a2418');
        rect(g, 4, 100, 98, 3, '#3a2418');
        poly(g, [[-8, 76], [53, 28], [114, 76]], '#a0703c');
        for (let i = 0; i < 40; i++) {
            const x = -4 + R() * 114;
            line(g, x, 76, 53 + (x - 53) * 0.55, 42, R() < 0.5 ? '#6b4226' : '#cfa168', 1);
        }
        poly(g, [[-8, 76], [114, 76], [110, 80], [-4, 80]], '#6b4226');
        rect(g, 78, 34, 10, 24, '#555c6a');
        rect(g, 76, 32, 14, 4, '#2e3440');
        rect(g, 42, 102, 22, 36, '#3a2418');
        planks(g, R, 44, 104, 18, 34, 5, ['#6b4226', '#a0703c'], '#3a2418');
        rect(g, 58, 120, 2, 2, '#f4c542');
        for (const wx of [12, 72]) {
            glow(g, wx + 10, 90, 22, '#f4c542', 0.4);
            rect(g, wx, 82, 20, 16, '#3a2418');
            rect(g, wx + 2, 84, 16, 12, '#f4c542');
            rect(g, wx + 9, 84, 2, 12, '#3a2418');
            rect(g, wx + 2, 89, 16, 2, '#3a2418');
        }

        // the Sleeping Bear inn (right)
        stones(g, R, 238, 92, 84, 42, 10, 6, ['#555c6a', '#8a90a0', '#555c6a'], '#2e3440');
        rect(g, 238, 56, 84, 38, '#cfa168');
        for (const x of [238, 262, 290, 316]) rect(g, x, 56, 4, 38, '#3a2418');
        rect(g, 238, 74, 84, 3, '#3a2418');
        poly(g, [[230, 58], [282, 22], [330, 58]], '#6e1f24');
        for (let y = 30; y < 58; y += 4) line(g, 230 + (58 - y) * 0.2, y, 330, y, '#b8332f', 1);
        poly(g, [[230, 58], [330, 58], [330, 62], [232, 62]], '#3a2418');
        for (const [wx, wy] of [[246, 62], [296, 62], [296, 102]]) {
            glow(g, wx + 7, wy + 6, 18, '#f4c542', 0.35);
            rect(g, wx, wy, 14, 12, '#3a2418');
            rect(g, wx + 2, wy + 2, 10, 8, '#e0782c');
            rect(g, wx + 6, wy + 2, 2, 8, '#3a2418');
        }
        rect(g, 256, 100, 20, 34, '#3a2418');
        planks(g, R, 258, 102, 16, 32, 4, ['#6b4226'], '#3a2418');
        line(g, 256, 112, 276, 124, '#2e3440', 2);
        // sign on a bracket
        rect(g, 226, 78, 14, 2, '#3a2418');
        line(g, 228, 80, 228, 84, '#2e3440'); line(g, 238, 80, 238, 84, '#2e3440');
        rect(g, 224, 84, 18, 12, '#6b4226');
        rect(g, 225, 85, 16, 10, '#a0703c');
        ellipse(g, 233, 92, 5, 2.5, '#3a2418'); circle(g, 229, 89, 2, '#3a2418');

        // the old well
        ellipse(g, 164, 146, 20, 5, '#2e3440');
        stones(g, R, 144, 126, 40, 20, 8, 5, ['#555c6a', '#8a90a0', '#555c6a'], '#2e3440');
        ellipse(g, 164, 146, 20, 4, '#555c6a');
        ellipse(g, 164, 126, 20, 5, '#8a90a0');
        ellipse(g, 164, 126, 16, 3.5, '#0d0b14');
        rect(g, 147, 94, 3, 34, '#3a2418');
        rect(g, 178, 94, 3, 34, '#3a2418');
        rect(g, 147, 108, 34, 3, '#6b4226');
        line(g, 181, 109, 186, 104, '#2e3440', 2);
        poly(g, [[139, 98], [164, 82], [189, 98], [186, 101], [164, 87], [142, 101]], '#6e1f24');
        poly(g, [[142, 101], [164, 87], [186, 101]], '#b8332f');
        line(g, 162, 111, 162, 122, '#6b4226', 1);   // the rotted rope end

        // lamp post (unlit), by the inn
        rect(g, 243, 100, 3, 48, '#1c2029');
        rect(g, 239, 146, 11, 3, '#1c2029');
        rect(g, 239, 92, 11, 9, '#2e3440');
        rect(g, 241, 94, 7, 5, '#555c6a');
        poly(g, [[238, 92], [251, 92], [244.5, 87]], '#1c2029');

        // notice board, by Gran's gate
        rect(g, 98, 118, 3, 30, '#3a2418');
        rect(g, 86, 102, 28, 20, '#3a2418');
        rect(g, 88, 104, 24, 16, '#6b4226');
        rect(g, 89, 105, 8, 10, '#f4ecd8');
        rect(g, 99, 106, 7, 7, '#fbe7a1');
        rect(g, 103, 112, 8, 7, '#f4ecd8');
        rect(g, 92, 114, 6, 5, '#cfa168');
        for (const [x, y] of [[90, 107], [90, 109], [90, 111], [100, 108], [104, 114], [104, 116]]) rect(g, x, y, 5, 1, '#8a90a0');

        // dusk light and vignette
        const vg = g.createRadialGradient(160, 120, 80, 160, 120, 240);
        vg.addColorStop(0, hexA('#0d0b14', 0));
        vg.addColorStop(1, hexA('#0d0b14', 0.5));
        g.fillStyle = vg;
        g.fillRect(0, 0, 320, 200);
    },

    walk: () => ({
        areas: [[[0, 142], [40, 142], [44, 140], [64, 140], [70, 142], [104, 140], [140, 128], [196, 118], [228, 118], [236, 136], [320, 138], [320, 199], [0, 199]]],
        blockers: [
            [[141, 130], [187, 130], [187, 150], [141, 150]],
            [[94, 142], [105, 142], [105, 150], [94, 150]],
            [[114, 152], [138, 152], [138, 165], [114, 165]],
            [[237, 142], [252, 142], [252, 150], [237, 150]],
        ],
    }),

    actors(S, t, A, sp) {
        return [{ y: 162, draw: (g, tt) => pell(g, 126, 162, tt, sp === 'Pell', S.flag('pellHappy')) }];
    },

    overlay(g, S, t) {
        // chimney smoke from Gran's cottage
        for (let i = 0; i < 6; i++) {
            const p = (t * 0.18 + i / 6) % 1;
            const x = 83 + Math.sin(p * 6 + i) * 3 + p * 14;
            const y = 30 - p * 30;
            const r = 2 + p * 4;
            g.fillStyle = p < 0.5 ? '#8a90a0' : '#555c6a';
            g.fillRect(Math.round(x - r / 2), Math.round(y), Math.round(r), Math.round(r * 0.7));
        }
        // the tower light on Greymantle
        if (Math.sin(t * 2.3) > -0.6) px(g, 216, 18, 2, 2, '#f4c542');
    },

    look: 'Brackenford Green, at the tail end of dusk. Every window is lit and every chimney is smoking, and not a single soul is singing — which, on the longest night of the year, is the eeriest thing you have ever heard.',

    hotspots: [
        {
            id: 'pell', name: 'Pell', shape: { rect: [114, 132, 26, 32] }, at: [104, 170], face: 'right',
            look: 'Pell, the miller\'s youngest, sitting cross-legged in the cold with a rag doll in her lap. She is frowning at the doll as if it has personally let her down.',
            talk: talkPell,
            use: 'You ruffle Pell\'s hair. She swats you away without looking up.',
            items: {
                async button(G) {
                    G.take('button');
                    G.set('pellButtonBack');
                    G.award('pellButton');
                    await G.line('Pell', 'My BUTTON! You got it back from that thieving bird! Rowan, you\'re a — you\'re a —');
                    await G.say('She can\'t think of the word, either. She settles for flinging both arms around your middle.');
                    await G.line('Pell', 'I\'m going to give it to the princess. For being brave.');
                    G.chron('button', 'Rowan brought Pell her red button back from the magpie\'s nest. It was a small thing. The best things in stories often are.');
                },
                cake: '"Mam says I can\'t have cake before supper," says Pell, looking at it longingly. "Or after supper. Or instead of supper."',
                penny: 'Pell regards the penny with deep suspicion. "Is that for the magpie? She likes shiny things. She\'s a *thief*, though."',
                book: 'You show Pell the blank Book of Tales. "That\'s the most boring book I\'ve ever seen," she says, with feeling.',
                poker: 'You are not threatening a small child with a fire-poker. There are limits, even on a quest.',
            },
        },
        {
            id: 'well', name: 'the old well', shape: { rect: [140, 82, 50, 68] }, at: [164, 156], face: 'up',
            look: (G) => G.say(G.flag('wellKey')
                ? 'The village well, older than the village. Nothing glints in it now. You\'ve had the only interesting thing out of it.'
                : 'The village well is older than the village. A tiny tiled roof, a winch, and the end of a rope that rotted through last spring. You lean over the edge: far below, something glints — not in the water, but on a ledge of stone just above it.'),
            async use(G) {
                if (G.flag('wellKey')) { await G.say('You\'ve had quite enough of the well for one night.'); return; }
                await G.say('You peer down. The glint winks back up at you. It\'s far too far to reach, and the stones inside are slick with moss.');
                const c = await G.choose(['Climb down anyway', 'Better not'], 'Well?');
                if (c === 1) { await G.say('You step back from the edge. Somewhere, a sensible version of you nods approvingly.'); return; }
                await G.die('A Well-Deserved End', 'You swing a leg over the edge and start down the slick stones. For about four feet, it goes very well.\n\nThe Book of Tales, which is honest to a fault, records that you reached the bottom considerably faster than you intended, and that it was not a *wishing* well, whatever the village children say.');
            },
            talk: 'You call "Hello?" down the well. "Hello?" says the well, unhelpfully.',
            items: {
                async rope(G) {
                    if (G.flag('wellKey')) { await G.say('There\'s nothing else down there. You checked. It was cold.'); return; }
                    await G.say('You knot Gran\'s washing-line rope around the winch post — twice, and then once more for luck — and lower yourself hand over hand into the dark.');
                    G.hide(true);
                    await G.wait(600);
                    await G.say('It\'s cold down here, and it smells of stone and old pennies. Moss. Echoes. And there, on a ledge just above the black water: the glint.');
                    await G.say('It\'s a tiny brass key — the winding kind, for a clock or a toy — with a thread of faded blue ribbon still knotted through its bow. Somebody dropped this here to make a wish, and never came back for it.');
                    G.give('brasskey');
                    G.set('wellKey');
                    G.award('wellKey');
                    await G.wait(300);
                    G.hide(false);
                    await G.say('You climb back up, untie Gran\'s rope, and coil it over your shoulder again. Your hands smell of well.');
                    G.chron('well', 'Rowan climbed down the Brackenford well, where wishes go, and found one that nobody had ever come back for: a little brass key on a blue ribbon.');
                },
                penny: 'You could toss Gran\'s penny in and make a wish. But you suspect the penny will be more use to you than a wish. Most things are.',
                bone: 'You could drop the bone down the well. But why would you?',
            },
        },
        {
            id: 'board', name: 'the notice board', shape: { rect: [84, 100, 32, 48] }, at: [100, 156], face: 'up',
            async look(G) {
                await G.say('Notices, nailed up in a dozen different hands:');
                await G.say('*LOST: The Ballad of Brackenford, all nine verses. If found please return to the Miller, who is Very Upset.*\n*LOST: How to make pie crust. Reward. — Baker*\n*LOST: The name of that song. You know the one. — Tam*');
                await G.say('And, at the very bottom, in a hand you don\'t recognise: *FOUND: One happy ending, unclaimed. Enquire within.* There is no address. Nobody has taken it down.');
            },
            use: 'You leave the notices where they are. It\'s the only place the village\'s stories still exist — as a list of everything it has lost.',
        },
        {
            id: 'lamp', name: 'the lamp post', shape: { rect: [237, 86, 16, 62] }, at: [236, 156], face: 'up',
            look: 'The lamp on the green is dark. Hob the lamplighter always sang the lighting-song as he went round; this year he couldn\'t remember how it started, so he couldn\'t start. The whole village is lit by nothing but its windows.',
            use: 'You haven\'t a match, a ladder, or the lighting-song. The lamp stays dark.',
        },
        {
            id: 'inn', name: 'the Sleeping Bear', shape: { rect: [224, 22, 96, 114] }, at: [266, 146], face: 'up',
            look: 'The Sleeping Bear, Brackenford\'s only inn. On any other longest night it would be bursting at the seams with singing. Tonight it\'s as quiet as a held breath.',
            use: 'The door is barred. A sign has been chalked on it: *CLOSED TONIGHT. NOBODY CAN REMEMBER ANY OF THE SONGS.*',
            talk: 'You knock. From inside, a muffled voice says: "Go away. Unless you know the second verse of *The Plough and the Pheasant*." You don\'t. Nobody does. That\'s rather the problem.',
        },
        {
            id: 'door', name: 'into Gran\'s cottage', shape: { rect: [42, 100, 24, 40] }, at: [53, 144], exit: 'cottage', door: true,
            look: 'The door of Gran\'s cottage. Warm light leaks out around the edges.',
        },
        {
            id: 'cottage', name: 'Gran\'s cottage', shape: { rect: [0, 28, 114, 112] }, at: [70, 150],
            look: 'Gran\'s cottage, low and thatched, with smoke curling out of the chimney. It has been your home for as long as you can remember, which is exactly as long as you\'ve been alive.',
            use: 'The door\'s the best way in. The chimney is for Midwinter visitors only.',
        },
        {
            id: 'road', name: 'north to the Grumblewater bridge', shape: { rect: [192, 104, 44, 18] }, at: [212, 120], exit: 'bridge',
            look: 'The road north runs out of the village, over the Grumblewater, through the Whispering Pines, and up — a long way up — to Greymantle.',
        },
        {
            id: 'mountain', name: 'Greymantle', shape: { rect: [150, 8, 130, 88] }, far: true,
            look: 'Greymantle. Every child in Brackenford grows up in its shadow, and every one of them has been told not to go up there. At its very peak, a light is burning in the Warlock\'s tower.',
            use: 'It\'s rather a long way away to use. That is, you suppose, the point of walking.',
        },
        {
            id: 'sky', name: 'the sky', shape: { rect: [0, 0, 320, 70] }, far: true,
            look: 'The sun has gone down on the shortest day of the year. It won\'t be back for a long, long night.',
        },
    ],

    async enter(G, first) {
        if (!first) return;
        await G.say('You step out into the cold. Brackenford Green is lit only by its windows, and it is quiet — so quiet you can hear the Grumblewater muttering to itself away to the north.');
    },
};
