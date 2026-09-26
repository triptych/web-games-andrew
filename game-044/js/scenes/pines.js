/**
 * pines — the Whispering Pines crossroads: the signpost, the moonbells, and
 * Tatters the magpie, who trades.
 */

import { rect, grad, glow, poly, ellipse, circle, line, speckle, tufts, stars, pine, withAlpha, hexA } from '../paint.js';
import { tatters } from '../npcs.js';

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

async function talkTatters(G) {
    G.sfx('caw');
    await G.line('Tatters', G.flag('tradedPenny')
        ? 'Shiny! Tatters has the loved penny. Tatters is the richest bird in the forest. Go away now, Tatters is admiring it.'
        : 'Shiny? *Shiny?* Tatters trades. Tatters is a fair bird. Mostly. Occasionally. On Tuesdays.');
    if (G.flag('tradedPenny')) return;
    for (;;) {
        const c = await G.choose([
            'What have you got?',
            'Did you steal Pell\'s button?',
            'What would you want for the golden feather?',
            'Goodbye, Tatters.',
        ], null, 'Tatters');
        if (c === 0) {
            await G.line('Tatters', 'Spoon! Thimble! Fork, bent! Buttons, three! And the golden feather — Tatters\'s *best*. It fell out of the tall tower on the mountain, three winters back. Came down through the snow like a little sun. Tatters caught it before it landed.');
            G.set('quillOrigin');
        } else if (c === 1) {
            await G.line('Tatters', '"Steal" is an ugly word. Tatters *collected* it. From a coat. That was moving at the time.');
        } else if (c === 2) {
            await G.line('Tatters', 'Something shiny. Something round and shiny and warm from somebody\'s pocket. Something that\'s been *loved*. Tatters knows it when Tatters sees it.');
        } else {
            await G.line('Tatters', 'Shiny!');
            return;
        }
    }
}

export default {
    id: 'pines',
    name: 'The Whispering Pines',
    ambience: 'forest',
    scale: [108, 0.55, 198, 1.0],
    entries: { default: [60, 176, 'right'], bridge: [14, 172, 'right'], hut: [306, 172, 'left'], gate: [163, 114, 'down'] },
    bgKey: (S) => [S.flag('tradedPenny'), S.flag('moonbells')].join(),

    paint(g, S, R) {
        grad(g, 0, 0, 320, 110, [[0, '#0d0b14'], [1, '#1b1f3b']]);
        stars(g, R, 50, 0, 0, 320, 60);
        // three depths of pines
        for (let i = 0; i < 26; i++) {
            const x = R() * 330 - 5;
            pine(g, x, 110 + R() * 6, 50 + R() * 30, 22 + R() * 8, '#1b1f3b', '#0d0b14');
        }
        for (let i = 0; i < 16; i++) {
            const x = R() * 330 - 5;
            if (x > 138 && x < 190) continue;          // keep the north road open
            pine(g, x, 118 + R() * 8, 70 + R() * 30, 30 + R() * 10, '#16301f', '#0d0b14');
        }
        // moonlight shafts
        withAlpha(g, 0.12, () => {
            poly(g, [[200, 0], [226, 0], [270, 200], [214, 200]], '#a8c8e8');
            poly(g, [[40, 0], [56, 0], [110, 200], [70, 200]], '#a8c8e8');
        });
        // clearing floor
        poly(g, [[0, 140], [120, 112], [200, 112], [320, 140], [320, 200], [0, 200]], '#16301f');
        grad(g, 0, 112, 320, 88, [[0, hexA('#16301f', 0)], [1, hexA('#255b33', 0.9)]]);
        tufts(g, R, 0, 120, 320, 80, ['#255b33', '#3f8a3a', '#0d0b14'], 220);
        // needles carpet + paths
        poly(g, [[150, 108], [176, 108], [196, 130], [240, 160], [320, 172], [320, 190], [220, 184], [140, 190], [0, 184], [0, 166], [120, 150], [140, 128]], '#3a2418');
        speckle(g, R, 0, 110, 320, 90, ['#6b4226', '#3a2418', '#a0703c'], 500);
        // near trunks framing the scene
        for (const [x, w] of [[6, 14], [300, 16], [262, 8]]) {
            rect(g, x, 0, w, 150, '#1c2029');
            rect(g, x + 2, 0, 3, 150, '#2e3440');
        }

        // the dead tree and the magpie's nest
        poly(g, [[74, 150], [80, 40], [88, 40], [94, 150]], '#2e3440');
        poly(g, [[82, 40], [85, 16], [88, 40]], '#2e3440');
        line(g, 86, 70, 116, 58, '#2e3440', 3);
        line(g, 110, 60, 124, 46, '#2e3440', 2);
        line(g, 82, 90, 56, 70, '#2e3440', 3);
        line(g, 60, 72, 50, 58, '#2e3440', 2);
        line(g, 84, 50, 100, 36, '#2e3440', 2);
        rect(g, 78, 40, 2, 108, '#555c6a');
        ellipse(g, 96, 58, 13, 6, '#6b4226');
        speckle(g, R, 84, 53, 24, 10, ['#3a2418', '#a0703c'], 60);
        // nest treasures
        rect(g, 88, 51, 3, 2, '#c3c7d0');
        rect(g, 93, 52, 2, 2, '#c3c7d0');
        rect(g, 101, 51, 2, 2, '#6d93c9');
        if (!S.flag('tradedPenny')) {
            line(g, 104, 54, 112, 42, '#f4c542', 2);
            ellipse(g, 110, 45, 2, 4, '#fbe7a1');
            rect(g, 97, 52, 2, 2, '#b8332f');
        }

        // signpost, beside the fork (not on it)
        rect(g, 203, 110, 4, 42, '#6b4226');
        rect(g, 204, 110, 1, 42, '#a0703c');
        poly(g, [[207, 114], [230, 114], [234, 118], [230, 122], [207, 122]], '#a0703c');
        poly(g, [[203, 124], [180, 124], [176, 128], [180, 132], [203, 132]], '#a0703c');
        rect(g, 200, 100, 10, 10, '#a0703c');
        poly(g, [[200, 100], [210, 100], [205, 95]], '#a0703c');
        for (const [x, y, w] of [[210, 117, 16], [182, 127, 18], [202, 104, 6]]) rect(g, x, y, w, 1, '#3a2418');

        // moonbells
        if (!S.flag('moonbells')) {
            glow(g, 248, 178, 30, '#6d93c9', 0.35);
        } else {
            glow(g, 248, 178, 18, '#6d93c9', 0.2);
        }
        const n = S.flag('moonbells') ? 9 : 16;
        for (let i = 0; i < n; i++) {
            const x = 226 + R() * 44, y = 170 + R() * 16;
            line(g, x, y + 4, x, y, '#3f8a3a', 1);
            ellipse(g, x, y, 2, 1.6, '#a8c8e8');
        }

        // mushrooms & a fallen log
        rect(g, 12, 184, 60, 8, '#3a2418');
        ellipse(g, 12, 188, 3, 4, '#6b4226');
        for (const [x, y] of [[30, 182], [38, 183], [120, 190]]) { rect(g, x, y, 1, 3, '#f4ecd8'); ellipse(g, x, y, 3, 1.6, '#b8332f'); }

        const vg = g.createRadialGradient(170, 140, 70, 170, 140, 250);
        vg.addColorStop(0, hexA('#0d0b14', 0));
        vg.addColorStop(1, hexA('#0d0b14', 0.6));
        g.fillStyle = vg;
        g.fillRect(0, 0, 320, 200);
    },

    walk: () => ({
        areas: [[[0, 152], [40, 148], [120, 118], [150, 108], [176, 108], [200, 118], [280, 146], [320, 152], [320, 199], [0, 199]]],
        blockers: [
            [[70, 142], [98, 142], [98, 154], [70, 154]],
            [[198, 146], [212, 146], [212, 154], [198, 154]],
            [[8, 180], [74, 180], [74, 194], [8, 194]],
        ],
    }),

    actors(S, t, A, sp) {
        return [{ y: 64, draw: (g, tt) => tatters(g, 116, 60, tt, sp === 'Tatters') }];
    },

    overlay(g, S, t) {
        // nest glints
        const k = Math.floor(t * 3) % 5;
        const spots = [[89, 51], [94, 52], [102, 51], [110, 44], [98, 52]];
        const [sx, sy] = spots[k];
        if (!(k >= 3 && S.flag('tradedPenny'))) {
            px(g, sx, sy - 2, 1, 5, '#ffffff');
            px(g, sx - 2, sy, 5, 1, '#ffffff');
        }
        // moonbell motes drifting up
        for (let i = 0; i < 6; i++) {
            const p = (t * 0.15 + i / 6) % 1;
            px(g, 230 + ((i * 29) % 40) + Math.sin(t + i) * 3, 180 - p * 50, 1, 1, p < 0.6 ? '#a8c8e8' : '#6d93c9');
        }
    },

    look: 'The Whispering Pines. Moonlight comes down between the trunks in long silver slices, and the trees whisper — tonight, if you listen very hard, it sounds almost as if they\'re trying to remember something.',

    hotspots: [
        {
            id: 'magpie', name: 'the magpie', shape: { rect: [102, 44, 22, 22] }, at: [104, 150], face: 'up',
            look: (G) => G.say(G.flag('tradedPenny')
                ? 'Tatters the magpie, admiring Gran\'s penny from every possible angle. She has tucked it into the very middle of the nest, where the best things go.'
                : 'A magpie, glossy black and white with a sheen of blue along her tail, sitting beside an enormous untidy nest. She watches you with one bright, calculating eye.'),
            talk: talkTatters,
            use: 'The magpie is well out of reach, and in any case looks like she bites.',
            items: {
                async penny(G) {
                    if (G.flag('tradedPenny')) return;
                    G.sfx('caw');
                    await G.say('You hold up Gran\'s lucky penny. It catches the moonlight.');
                    await G.say('The magpie goes absolutely rigid. Then she drops out of the tree, snatches it from your fingers, and is back on her branch before you have finished flinching.');
                    G.take('penny');
                    await G.line('Tatters', 'Ooh. *Ooh.* It\'s been loved, this one. Sixty years of thumbs. You can always tell. Loved things shine different.');
                    await G.line('Tatters', 'Tatters is feeling generous. Feather AND button. Don\'t tell the other magpies.');
                    await G.say('Two things drop out of the nest and land at your feet: a quill of real gold, and a small red button.');
                    G.give('quill');
                    G.give('button');
                    G.set('tradedPenny');
                    G.award('quill');
                    G.chron('quill', 'In the Whispering Pines, a magpie named Tatters traded Gran\'s lucky penny for a golden quill that had fallen from the Warlock\'s tower three winters before. Gran had said luck was lighter than a sword. It turned out to be about as heavy as a pen.');
                },
                async brasskey(G) {
                    await G.say('You hold up the little brass key. Tatters looks at it for a long time, head on one side.');
                    await G.line('Tatters', 'No. That one\'s already somebody\'s. Tatters can tell.');
                },
                silverkey: (G) => G.line('Tatters', 'Silver\'s cold. Tatters likes shiny things that are *warm*.'),
                async bottle(G) {
                    await G.say('Tatters shies away from the glowing bottle, feathers flat.');
                    await G.line('Tatters', 'Too shiny. That\'s somebody\'s whole *life* in there. Put it away.');
                },
                quill: (G) => G.line('Tatters', 'No backsies.'),
                poker: 'You swipe at the nest with the poker. The magpie screams bloody murder and dive-bombs your head until you stop.',
                default: (G) => G.line('Tatters', 'Not shiny. Not shiny at *all*.'),
            },
        },
        {
            id: 'nest', name: 'the magpie\'s nest', shape: { rect: [82, 42, 30, 20] }, at: [104, 150], face: 'up',
            look: (G) => G.say(G.flag('tradedPenny')
                ? 'The nest still glitters — a spoon, a thimble, a bent fork, two ordinary buttons — and now, in pride of place, Gran\'s lucky penny.'
                : 'The nest glitters in the moonlight: a spoon, a thimble, a bent fork, three buttons (one of them a bright, familiar red), and sticking out of the top like a flag, a quill made of real gold.'),
            use: 'The nest is well out of reach, and guarded by a magpie with very strong opinions about property.',
        },
        {
            id: 'moonbells', name: 'the moonbells', shape: { rect: [222, 164, 52, 26] }, at: [240, 172], face: 'down',
            look: 'A drift of moonbells, glowing faintly blue in the dark under the pines. They only ever open on the longest night. Gran used to say they smell like the moment just before you fall asleep.',
            async use(G) {
                if (G.flag('moonbells')) { await G.say('You\'ve picked a posy already. Leave the rest to glow.'); return; }
                G.set('moonbells');
                G.give('moonbells');
                G.award('moonbells');
                await G.say('You pick a small posy of moonbells. They go on glowing in your hand, and you yawn so widely your jaw clicks.');
            },
        },
        {
            id: 'sign', name: 'the signpost', shape: { rect: [178, 94, 60, 58] }, at: [214, 158], face: 'up',
            look: 'Three arms. WEST: BRACKENFORD. EAST: WENNA\'S. NORTH: GREYMANTLE. Somebody has scratched *TURN BACK* underneath, and somebody else has scratched underneath *that*: *don\'t be so dramatic*.',
            use: 'You give the signpost a push. It points the same way, but slightly more firmly.',
        },
        {
            id: 'tree', name: 'the dead tree', shape: { rect: [66, 14, 32, 136] }, at: [104, 156], face: 'left',
            look: 'A dead pine, silver with age, standing among the living ones like a grandfather at a party. Its branches are much too high to climb.',
            use: 'The trunk is smooth as bone and the lowest branch is twice your height. You aren\'t getting up there.',
        },
        {
            id: 'mushrooms', name: 'the toadstools', shape: { rect: [24, 176, 22, 10] }, at: [48, 178],
            look: 'Red toadstools with white spots, straight out of a story. In the stories you are never, ever supposed to eat them.',
            use: 'You leave them alone. You know how *that* story goes, at least.',
        },
        {
            id: 'pinetrees', name: 'the pines', shape: { rect: [0, 0, 320, 104] }, far: true,
            look: 'The pines whisper. If you listen hard, it almost sounds like *once... once... once...* — the first word of a story nobody can finish.',
            talk: 'You whisper back. The pines fall quiet, as if embarrassed to have been overheard.',
        },
        {
            id: 'west', name: 'west to the bridge', shape: { rect: [0, 120, 12, 80] }, at: [4, 172], exit: 'bridge',
            look: 'The road back to the Grumblewater bridge.',
        },
        {
            id: 'east', name: 'east to Wenna\'s cottage', shape: { rect: [308, 120, 12, 80] }, at: [316, 172], exit: 'hut',
            look: 'A narrow path winds away east through the trees. There\'s a light at the end of it, low and warm — a window.',
        },
        {
            id: 'north', name: 'north, up to Greymantle', shape: { rect: [144, 92, 36, 20] }, at: [163, 108], exit: 'gate',
            look: 'The road north begins to climb in earnest, switching back and forth up the flank of Greymantle.',
        },
    ],

    async enter(G, first) {
        if (!first) return;
        await G.say('The road climbs into the Whispering Pines, where the moonlight comes down in long silver slices between the trunks. The path forks at an old signpost.');
        await G.say('Somewhere overhead, something is chattering happily to itself about spoons.');
    },
};
