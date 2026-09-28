/**
 * cavern — the great hall inside Greymantle, and Brimble, the hound who
 * guards the stair by being far too pleased to see you.
 */

import { rect, grad, glow, stones, poly, ellipse, circle, line, speckle, hexA } from '../paint.js';
import { brimble } from '../npcs.js';

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

const HOUND = [236, 172];

export default {
    id: 'cavern',
    name: 'The Hall of the Hound',
    ambience: 'cave',
    scale: [146, 0.86, 198, 1.06],
    entries: { default: [40, 176, 'right'], gate: [22, 172, 'right'], library: [184, 166, 'left'] },
    bgKey: () => '',

    paint(g, S, R) {
        // rough cavern walls
        grad(g, 0, 0, 320, 150, [[0, '#0d0b14'], [1, '#2e3440']]);
        stones(g, R, 0, 0, 320, 148, 18, 12, ['#1c2029', '#2e3440', '#1c2029', '#555c6a'], '#0d0b14');
        grad(g, 0, 0, 320, 60, [[0, hexA('#0d0b14', 0.9)], [1, hexA('#0d0b14', 0)]]);
        // stalactites
        for (let i = 0; i < 18; i++) {
            const x = R() * 320, h = 6 + R() * 18;
            poly(g, [[x - 3, 0], [x + 3, 0], [x, h]], '#1c2029');
        }

        // entrance passage on the left, cold moonlight from outside
        poly(g, [[0, 80], [18, 84], [26, 110], [24, 150], [0, 150]], '#0d0b14');
        glow(g, 6, 128, 34, '#a8c8e8', 0.25);

        // carvings on the wall: a lighthouse with three figures
        rect(g, 44, 46, 56, 64, '#555c6a');
        rect(g, 46, 48, 52, 60, '#2e3440');
        poly(g, [[66, 96], [70, 58], [74, 58], [78, 96]], '#8a90a0');
        rect(g, 68, 52, 8, 6, '#c3c7d0');
        poly(g, [[66, 52], [78, 52], [72, 47]], '#8a90a0');
        for (const [dx, dy] of [[-18, -6], [-14, 2], [18, -6], [14, 2], [-16, -14], [16, -14]]) line(g, 72, 55, 72 + dx, 55 + dy, '#8a90a0', 1);
        poly(g, [[48, 100], [96, 100], [96, 106], [48, 106]], '#555c6a');
        for (let i = 0; i < 6; i++) rect(g, 48 + i * 8, 98 + (i % 2), 5, 1, '#8a90a0');
        // three figures holding hands; the third worn smooth
        for (const [x, c] of [[52, '#c3c7d0'], [58, '#c3c7d0'], [88, '#8a90a0']]) {
            rect(g, x, 88, 3, 8, c); circle(g, x + 1.5, 86, 2, c);
        }
        rect(g, 55, 91, 3, 1, '#c3c7d0');

        // the great stair up the right-hand wall
        for (let i = 0; i < 12; i++) {
            const x = 206 + i * 8, y = 148 - i * 8;
            rect(g, x, y, 120, 8, i % 2 ? '#555c6a' : '#8a90a0');
            rect(g, x, y, 120, 1, '#c3c7d0');
        }
        poly(g, [[206, 150], [300, 56], [320, 56], [320, 150]], hexA('#1c2029', 0.35));
        // the arch at the top of the stair
        rect(g, 274, 20, 44, 40, '#1c2029');
        poly(g, [[278, 58], [278, 34], [296, 22], [314, 34], [314, 58]], '#0d0b14');
        glow(g, 296, 46, 30, '#f4c542', 0.45);
        poly(g, [[282, 58], [282, 36], [296, 26], [310, 36], [310, 58]], '#6b4226');
        glow(g, 296, 44, 12, '#fbe7a1', 0.6);

        // floor: flagstones
        rect(g, 0, 146, 320, 54, '#2e3440');
        let y = 148, hh = 6;
        while (y < 200) {
            rect(g, 0, y, 320, 1, '#1c2029');
            for (let x = (y * 13) % 30; x < 320; x += 26 + (y % 5) * 3) rect(g, x, y - hh, 1, hh, '#1c2029');
            y += hh; hh += 2;
        }
        speckle(g, R, 0, 146, 320, 54, ['#555c6a', '#1c2029'], 300);

        // braziers
        for (const x of [120, 188]) {
            line(g, x - 6, 150, x, 132, '#1c2029', 2);
            line(g, x + 6, 150, x, 132, '#1c2029', 2);
            ellipse(g, x, 130, 10, 4, '#2e3440');
            ellipse(g, x, 128, 8, 2.5, '#e0782c');
            glow(g, x, 120, 70, '#f0a878', 0.35);
        }

        const vg = g.createRadialGradient(160, 120, 70, 160, 120, 240);
        vg.addColorStop(0, hexA('#0d0b14', 0));
        vg.addColorStop(1, hexA('#0d0b14', 0.6));
        g.fillStyle = vg;
        g.fillRect(0, 0, 320, 200);
    },

    walk: () => ({
        areas: [[[0, 152], [206, 152], [320, 152], [320, 199], [0, 199]]],
        blockers: [
            [[196, 150], [292, 150], [292, 176], [196, 176]],
            [[112, 146], [128, 146], [128, 156], [112, 156]],
            [[180, 146], [196, 146], [196, 156], [180, 156]],
        ],
    }),

    actors(S, t, A, sp) {
        const asleep = S.flag('houndAsleep') || A('houndSleep') >= 0.6;
        return [{ y: HOUND[1], draw: (g, tt) => brimble(g, HOUND[0], HOUND[1], tt, asleep, sp === 'Brimble') }];
    },

    overlay(g, S, t) {
        for (const x of [120, 188]) {
            for (let i = 0; i < 4; i++) {
                const h = 7 + Math.sin(t * 10 + i * 1.9 + x) * 3;
                px(g, x - 5 + i * 3, 128 - h, 3, h, i % 2 ? '#f4c542' : '#e0782c');
            }
            const sp = (t * 1.5 + x) % 1;
            px(g, x + Math.sin(t * 3 + x) * 4, 118 - sp * 30, 1, 1, '#f4c542');
        }
    },

    look: 'A great hall hollowed out of the heart of the mountain, lit by braziers. A stair has been carved up one wall to an archway full of golden light. At the foot of the stair, sprawled like a dropped fur coat, lies the biggest dog you have ever seen.',

    hotspots: [
        {
            id: 'hound', name: 'the hound', shape: { rect: [200, 134, 104, 42] }, at: [184, 178], face: 'right',
            look: (G) => G.say(G.flag('houndAsleep')
                ? 'Brimble is fast asleep across the foot of the stair, snoring like a blacksmith\'s bellows, his great paws twitching as he dreams of chasing something enormous and delicious.'
                : 'The hound is enormous: grey and shaggy, with a head like a hearthrug and a tail going like a threshing flail. His collar tag says BRIMBLE. He would very much like to be your friend, and has no idea at all that he weighs as much as a haycart.'),
            async talk(G) {
                if (G.flag('houndAsleep')) { await G.say('"Good boy," you whisper. Brimble\'s tail thumps once, in his sleep.'); return; }
                await G.line('Rowan', 'Good boy?');
                G.sfx('woof');
                await G.line('Brimble', 'WOOF!');
                await G.say('The echo goes round the cavern twice and nearly knocks you over. Brimble looks enormously pleased with himself.');
            },
            use: (G) => G.say(G.flag('houndAsleep')
                ? 'You give Brimble a gentle pat. He smiles in his sleep.'
                : 'You pat Brimble on the nose. He licks you from your knees to your eyebrows in one enthusiastic swipe.'),
            items: {
                async bone(G) {
                    if (G.flag('houndAsleep')) return;
                    await G.say('Brimble\'s eyes go as round as saucers. He lunges — you snatch the bone back just in time, and he dances on the spot, whining.');
                    await G.say('A plain bone would only make him *bouncier*. You need him calmer, not keener.');
                },
                draught: 'You could hardly pour it down his throat. It needs to go *in* something he\'d want to eat.',
                async drowsybone(G) {
                    if (G.flag('houndAsleep')) return;
                    G.take('drowsybone');
                    await G.say('You toss the drowsy bone. Brimble catches it out of the air with a snap like a door slamming, flops down, and begins to gnaw it with enormous contentment.');
                    G.sfx('munch');
                    await G.wait(900);
                    await G.say('He gnaws more slowly. He yawns — a yawn you could have parked a cart in. His head sinks onto his paws. His tail gives one last, happy thump.');
                    await G.animate('houndSleep', 1200);
                    G.sfx('snore');
                    G.set('houndAsleep');
                    G.award('hound');
                    await G.say('Brimble is asleep. The stair is clear — as long as you step over him quietly.');
                    G.chron('hound', 'Inside Greymantle, Rowan met Brimble, the Warlock\'s hound: big as a pony, soft as butter, and dangerous only in the way that very large, very friendly things are. A drowsy bone put him to sleep across the foot of the stair.');
                },
                poker: 'You are not going to hit a dog. Least of all one who is looking at you like *that*.',
                cake: 'Brimble would love it. It\'s gone, though, isn\'t it? Gubbins had it.',
                default: (G) => G.say('Brimble sniffs it hopefully, decides it isn\'t food, and goes back to wagging.'),
            },
        },
        {
            id: 'stair', name: 'up the stair', shape: { poly: [[206, 150], [300, 56], [320, 56], [320, 150]] }, at: [184, 168], exit: 'library',
            exitIf: (S) => S.flag('houndAsleep'),
            async blocked(G) {
                await G.say('You edge toward the stair. Brimble\'s tail starts thumping the floor — *thud, thud, THUD* — and he gathers his enormous legs underneath him.');
                const c = await G.choose(['Make a dash for it', 'Back away slowly'], 'He is getting up.');
                if (c === 1) { await G.say('You back away slowly. Brimble settles down again, looking slightly disappointed in the both of you.'); return; }
                G.sfx('woof');
                await G.die('Loved to Death', 'You make a dash for the stair. Brimble, delighted, makes a dash for you.\n\nThe stair is narrow. Brimble is not. The Book of Tales notes, in fairness to him, that he was only trying to say hello.');
            },
            look: 'A stair cut into the wall of the cavern, climbing up to an archway full of warm golden light. At the bottom of it: dog.',
        },
        {
            id: 'carving', name: 'the carving', shape: { rect: [42, 44, 60, 66] }, at: [72, 162], face: 'up',
            look: 'A carving, cut deep and careful into the rock: a lighthouse on a crag in a stormy sea, with rays of light spreading from its lamp. Beneath it, three small figures stand holding hands. The third figure has been touched so often that it has worn almost smooth.',
            use: 'You touch the third figure. The stone is warm, as if somebody\'s hand was on it not long ago.',
        },
        {
            id: 'brazier', name: 'the brazier', shape: { rect: [108, 116, 24, 36] }, at: [120, 164], face: 'up',
            look: 'An iron brazier full of coals that never seem to burn down. Either it\'s magic or it\'s very good coal.',
            use: 'You warm your hands. Your fingers come back to you one at a time.',
        },
        {
            id: 'brazier2', name: 'the brazier', shape: { rect: [176, 116, 24, 36] }, at: [174, 164], face: 'up',
            look: 'An iron brazier full of coals that never seem to burn down.',
            use: 'You warm your hands. It is a very comforting brazier.',
        },
        {
            id: 'arch', name: 'the golden archway', shape: { rect: [274, 20, 44, 40] }, far: true,
            look: 'At the top of the stair, an archway glows with warm golden light — the colour of every lit window you have ever come home to.',
        },
        {
            id: 'out', name: 'back outside', shape: { rect: [0, 80, 24, 72] }, at: [6, 170], exit: 'gate',
            look: 'The passage back out to the door and the snow.',
        },
    ],

    async enter(G, first) {
        if (!first) return;
        await G.say('Beyond the door, a passage leads into a great hall inside the mountain, lit by braziers. A stair climbs one wall to an archway full of golden light.');
        await G.say('At the foot of the stair, sprawled like a dropped fur coat, lies the biggest dog you have ever seen. His head comes up. His ears come up. His tail comes up — and starts to go.');
        G.sfx('woof');
    },
};
