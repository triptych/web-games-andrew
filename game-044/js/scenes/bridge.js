/**
 * bridge — the Grumblewater bridge, and Gubbins, who wants a story for a toll.
 */

import { rect, grad, glow, stones, poly, ellipse, circle, line, speckle, tufts, ridge, stars, pine, ripples, hexA } from '../paint.js';
import { gubbins } from '../npcs.js';

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

const TROLL_AT = [244, 142], TROLL_SIT = [288, 186];

async function talkTroll(G) {
    if (G.flag('trollMoved')) {
        await G.line('Gubbins', 'Gubbins is thinking about the cake. It\'s a good thought. Gubbins is going to keep having it for a long time.');
        return;
    }
    if (!G.flag('metTroll')) {
        G.set('metTroll');
        G.sfx('grumble');
        await G.line('Gubbins', 'HALT! Who goes over Gubbins\'s bridge?');
        await G.choose(['Rowan Ashby, of Brackenford.'], null, 'Gubbins');
        await G.line('Gubbins', 'Well then, Rowan-Ashby-of-Brackenford. Toll\'s a story. You tell Gubbins a story, and Gubbins lets you over. That\'s the rule. Been the rule since Gubbins was a pebble.');
    }
    for (;;) {
        const c = await G.choose([
            'Once upon a time…',
            'Why do you want a story?',
            'Would you take something else instead?',
            'Never mind.',
        ], null, 'Gubbins');
        if (c === 0) {
            await G.line('Rowan', 'Once upon a time there was a — a —');
            await G.say('Your head is as blank as Gran\'s book. You try again.');
            await G.line('Rowan', 'There was once a... king? Who had a... thing?');
            await G.say('Gubbins lets out a sigh that ruffles your hair.');
            await G.line('Gubbins', 'Same as all the rest. Nobody\'s got any left. Three winters Gubbins has sat on this bridge and not heard one single story. Not one.');
            G.set('trollSad');
        } else if (c === 1) {
            await G.line('Gubbins', 'Gubbins *likes* stories. Travellers used to tell Gubbins all sorts. Knights and witches and clever foxes. Gubbins liked the ones with dinners in them best. Great big feasts. Pies.');
            await G.say('There is a long, hollow rumble, which you realise after a moment is Gubbins\'s stomach.');
            await G.line('Gubbins', 'Nobody comes by any more. Gubbins is ever so hungry.');
        } else if (c === 2) {
            await G.line('Gubbins', 'Gubbins doesn\'t want *money*, if that\'s what you\'re thinking. What\'s Gubbins going to buy? Another bridge?');
            await G.line('Gubbins', 'Gubbins wants a story. Or something as good as a story. Gubbins would know it if he tasted it.');
        } else {
            await G.line('Gubbins', 'Come back when you\'ve got a story.');
            return;
        }
    }
}

export default {
    id: 'bridge',
    name: 'The Grumblewater Bridge',
    ambience: 'river',
    scale: [130, 0.86, 198, 1.05],
    entries: { default: [30, 170, 'right'], green: [10, 168, 'right'], pines: [310, 168, 'left'] },
    bgKey: (S) => String(S.flag('trollMoved')),

    paint(g, S, R) {
        grad(g, 0, 0, 320, 120, [[0, '#0d0b14'], [0.6, '#1b1f3b'], [1, '#2b3a67']]);
        stars(g, R, 90, 0, 0, 320, 90);
        glow(g, 58, 32, 36, '#a8c8e8', 0.3);
        circle(g, 58, 32, 10, '#f4ecd8');
        circle(g, 55, 30, 3, '#c3c7d0'); circle(g, 61, 35, 2, '#c3c7d0');
        // far hills and trees
        const h = ridge(g, R, 104, 14, '#1b1f3b', 0.5, 0, 320, 130);
        for (let i = 0; i < 50; i++) {
            const x = R() * 320;
            pine(g, x, h(x) + 10, 12 + R() * 14, 7 + R() * 4, '#16301f', '#0d0b14');
        }
        // the river, running toward you and widening
        grad(g, 0, 112, 320, 88, [[0, '#1b1f3b'], [1, '#2b3a67']]);
        poly(g, [[110, 112], [236, 112], [262, 200], [80, 200]], '#1e4a50');
        grad(g, 90, 112, 170, 88, [[0, hexA('#2b3a67', 0.8)], [1, hexA('#1e4a50', 0)]]);
        ripples(g, R, 96, 116, 156, 84, ['#2f8a8a', '#6fc7c0', '#3f5f9a'], 110);
        // moon's reflection
        for (let y = 150; y < 200; y += 3) rect(g, 150 + Math.sin(y) * 4, y, 8 + R() * 8, 1, '#a8c8e8');
        // banks
        poly(g, [[0, 112], [110, 112], [98, 150], [84, 200], [0, 200]], '#255b33');
        poly(g, [[236, 112], [320, 112], [320, 200], [262, 200], [250, 150]], '#255b33');
        tufts(g, R, 0, 120, 100, 80, ['#3f8a3a', '#16301f', '#74b94a'], 110);
        tufts(g, R, 252, 120, 68, 80, ['#3f8a3a', '#16301f', '#74b94a'], 80);
        speckle(g, R, 70, 150, 30, 50, ['#555c6a', '#8a90a0'], 40, 2);
        speckle(g, R, 250, 150, 20, 50, ['#555c6a', '#8a90a0'], 30, 2);
        // road on each bank
        poly(g, [[0, 140], [100, 134], [96, 148], [0, 178]], '#6b4226');
        poly(g, [[250, 134], [320, 140], [320, 178], [256, 148]], '#6b4226');
        speckle(g, R, 0, 136, 100, 40, ['#a0703c', '#3a2418'], 90, 2);
        speckle(g, R, 250, 136, 70, 40, ['#a0703c', '#3a2418'], 70, 2);

        // the bridge: back parapet, deck, front face with arch
        stones(g, R, 92, 118, 166, 16, 10, 5, ['#555c6a', '#8a90a0', '#555c6a'], '#2e3440');
        rect(g, 92, 116, 166, 3, '#8a90a0');
        rect(g, 92, 134, 166, 10, '#555c6a');
        speckle(g, R, 92, 134, 166, 10, ['#8a90a0', '#2e3440'], 120);
        stones(g, R, 92, 144, 166, 30, 12, 6, ['#555c6a', '#8a90a0', '#2e3440'], '#1c2029');
        // arch opening shows the water
        g.save();
        g.beginPath();
        g.ellipse(175, 176, 50, 26, 0, Math.PI, 0);
        g.closePath();
        g.clip();
        grad(g, 120, 150, 110, 30, [[0, '#0d0b14'], [1, '#1e4a50']]);
        ripples(g, R, 125, 166, 100, 12, ['#2f8a8a', '#3f5f9a'], 20);
        g.restore();
        g.strokeStyle = '#8a90a0';
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(175, 176, 51, 27, 0, Math.PI, 0);
        g.stroke();
        // footings
        rect(g, 88, 150, 10, 30, '#2e3440');
        rect(g, 252, 150, 10, 30, '#2e3440');
        // moss
        speckle(g, R, 92, 144, 166, 30, ['#3f8a3a', '#255b33'], 50, 2);

        // a milestone
        rect(g, 20, 118, 10, 16, '#8a90a0');
        ellipse(g, 25, 118, 5, 3, '#8a90a0');
        rect(g, 22, 123, 6, 1, '#2e3440'); rect(g, 22, 126, 6, 1, '#2e3440');

        // night vignette
        const vg = g.createRadialGradient(170, 130, 80, 170, 130, 240);
        vg.addColorStop(0, hexA('#0d0b14', 0));
        vg.addColorStop(1, hexA('#0d0b14', 0.55));
        g.fillStyle = vg;
        g.fillRect(0, 0, 320, 200);
    },

    // The front parapet is drawn over Rowan, so the bridge reads as a bridge.
    paintFg(g, S, R) {
        stones(g, R, 94, 140, 162, 7, 9, 4, ['#8a90a0', '#555c6a'], '#2e3440');
        rect(g, 94, 139, 162, 2, '#c3c7d0');
    },

    walk: (S) => ({
        areas: [
            [[0, 134], [102, 132], [92, 199], [0, 199]],
            [[94, 136], [256, 136], [256, 144], [94, 144]],
            [[248, 132], [320, 134], [320, 199], [260, 199]],
        ],
        blockers: S.flag('trollMoved')
            ? [[[270, 176], [306, 176], [306, 196], [270, 196]]]
            : [[[226, 126], [266, 126], [266, 152], [226, 152]]],
    }),

    actors(S, t, A, sp) {
        let [x, y] = TROLL_AT;
        let sitting = false;
        if (S.flag('trollMoved')) { [x, y] = TROLL_SIT; sitting = true; } else {
            const p = A('trollMove');
            if (p > 0) {
                x = TROLL_AT[0] + (TROLL_SIT[0] - TROLL_AT[0]) * p;
                y = TROLL_AT[1] + (TROLL_SIT[1] - TROLL_AT[1]) * p;
            }
        }
        const munch = A('trollMunch') > 0 && A('trollMunch') < 1;
        return [{ y, draw: (g, tt) => gubbins(g, x, y, tt, sp === 'Gubbins', sitting, munch) }];
    },

    overlay(g, S, t) {
        // glints travelling down the river
        for (let i = 0; i < 14; i++) {
            const p = (t * 0.25 + i / 14) % 1;
            const x = 116 + ((i * 37) % 120) + p * (i % 2 ? 14 : -14);
            const y = 116 + p * 84;
            if (y > 142 && y < 176 && x > 92 && x < 258) continue;   // behind the bridge
            px(g, x, y, 3 + p * 4, 1, i % 3 ? '#6fc7c0' : '#a8c8e8');
        }
    },

    look: 'The road north crosses the Grumblewater by a humpbacked bridge of grey stone. The river is fast and black and full of the moon. On the far side, the Whispering Pines begin.',

    hotspots: [
        {
            id: 'troll', name: 'the troll', at: [212, 141], face: 'right',
            get shape() { return { rect: [222, 76, 44, 70] }; },
            when: (S) => !S.flag('trollMoved'),
            look: 'A bridge troll: green as moss, wide as a haycart, with a nose like a turnip and small, sad yellow eyes. He wears a tunic made of old sacks, patched with more sacks. He is sitting — standing — *existing* squarely across the far end of the bridge.',
            talk: talkTroll,
            use: 'You try to squeeze past the troll. The troll is roughly the size and shape of a garden shed, and exactly as easy to squeeze past.',
            items: {
                async cake(G) {
                    G.take('cake');
                    await G.say('You unwrap Gran\'s honey cake and hold it out on your palm.');
                    await G.say('The troll goes very still. He sniffs. His yellow eyes go wide.');
                    await G.line('Gubbins', 'Is that — is that a *proper* cake?');
                    await G.say('He takes it as delicately as a troll can take anything, and eats it in one enormous bite, and then sits there for a long moment with his eyes shut.');
                    G.sfx('munch');
                    await G.animate('trollMunch', 1200);
                    await G.line('Gubbins', 'That\'s... that\'s a *story*, that is. That tastes like the one where the old woman bakes on the longest night, and the whole village comes round, and nobody is cold.');
                    await G.line('Gubbins', 'Gubbins remembers that one. Gubbins remembers it *in his mouth*.');
                    await G.say('He wipes his eyes with a hand the size of a spade.');
                    await G.line('Gubbins', 'Go on over, Rowan-Ashby-of-Brackenford. Toll\'s paid. Toll\'s paid twice.');
                    G.sfx('grumble');
                    await G.animate('trollMove', 1400);
                    G.set('trollMoved');
                    G.award('troll');
                    G.chron('troll', 'At the Grumblewater bridge, a hungry troll named Gubbins asked for a story as his toll. Rowan had none left to give — but paid him in Gran\'s honey cake, which, Gubbins said, tasted exactly like one.');
                },
                penny: (G) => G.line('Gubbins', 'Gubbins doesn\'t want *money*. What\'s Gubbins going to buy? Another bridge?'),
                book: async (G) => { await G.say('You show him the Book of Tales. The troll peers at the blank pages for a long time.'); await G.line('Gubbins', 'Nothing in it. Same as everybody.'); },
                rope: 'Tie up a troll? With washing line? You admire your own optimism.',
                async poker(G) {
                    const c = await G.choose(['Poke the troll', 'Think better of it'], 'The troll is very big. The poker is very pointy.');
                    if (c === 1) { await G.say('You think better of it. The troll, who saw all of that, thinks slightly less of you.'); return; }
                    await G.die('Troll Toll', 'You give the troll a sharp poke with Gran\'s poker. He looks down at the poker, and then at you, with an expression of deep and sorrowful disappointment.\n\nThen he picks you up, very gently, and drops you in the Grumblewater — which carries you all the way to the sea. You have a great many adventures there, but none of them are this one.');
                },
            },
        },
        {
            id: 'trollSat', name: 'Gubbins', shape: { rect: [264, 150, 48, 44] }, at: [256, 176], face: 'right',
            when: (S) => S.flag('trollMoved'),
            look: 'Gubbins is sitting on the riverbank with his feet in the Grumblewater, looking happier than a troll has any right to look.',
            talk: talkTroll,
            use: 'You pat Gubbins on the knee. It is like patting a hillside that has feelings.',
        },
        {
            id: 'river', name: 'the Grumblewater', shape: { poly: [[104, 112], [240, 112], [262, 200], [84, 200]] }, at: [80, 180], face: 'right',
            look: 'The Grumblewater: fast and black and grumbling to itself, as it always is. Nobody has ever worked out what about.',
            async use(G) {
                const c = await G.choose(['Swim across', 'Stay dry'], 'The water is fast, black and bitterly cold.');
                if (c === 1) { await G.say('Staying dry, you decide, is an underrated virtue.'); return; }
                await G.die('Swept Away', 'You wade into the Grumblewater, which immediately stops grumbling and starts *shouting*. It sweeps you off your feet, under the bridge, and away down the valley in a great deal of a hurry.\n\nYou are found three days later on a sandbar, very wet, very cross, and very much too late.');
            },
            items: { rope: 'There\'s nothing on the far side to tie it to. Besides, there\'s a perfectly good bridge right here.' },
        },
        {
            id: 'bridge', name: 'the bridge', shape: { rect: [92, 116, 166, 60] }, at: [150, 141],
            look: 'An old humpbacked bridge of grey stone, built by nobody-knows-who back in nobody-remembers-when. Moss has been patiently eating it for centuries and is in no hurry to finish.',
        },
        {
            id: 'milestone', name: 'the milestone', shape: { rect: [18, 112, 14, 24] }, at: [26, 142], face: 'up',
            look: 'An old milestone. BRACKENFORD 1, it says on one side, and GREYMANTLE 7 on the other. Somebody has scratched a small frowning face next to the 7.',
        },
        {
            id: 'moon', name: 'the moon', shape: { circle: [58, 32, 14] }, far: true,
            look: 'The moon is up over the valley, fat and silver. In Gran\'s stories the moon once lost her shoe and had to hop across the sky for a whole month. You\'re not sure, tonight, how that one ended.',
        },
        {
            id: 'back', name: 'back to Brackenford', shape: { rect: [0, 110, 12, 90] }, at: [4, 166], exit: 'green',
            look: 'The road runs back south to Brackenford. You can see the lit windows from here.',
        },
        {
            id: 'on', name: 'on into the Whispering Pines', shape: { rect: [308, 110, 12, 90] }, at: [316, 166], exit: 'pines',
            exitIf: (S) => S.flag('trollMoved'),
            blocked: (G) => G.line('Gubbins', 'TOLL.'),
            look: 'Beyond the bridge the road climbs into the Whispering Pines.',
        },
    ],

    async enter(G, first) {
        if (!first) return;
        await G.say('The road north brings you to the Grumblewater, and the old stone bridge across it. Something very large is standing at the far end of the bridge.');
        await G.say('It is, you are almost certain, a troll.');
    },
};
