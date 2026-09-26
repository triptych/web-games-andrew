/**
 * sanctum — the heart of the mountain, where the Story Loom weaves ten
 * thousand stolen stories into endings, and Corvin Hale looks for the one
 * that will wake his daughter. All three endings begin here.
 */

import { rect, grad, glow, stones, poly, ellipse, circle, line, speckle, stars, hexA } from '../paint.js';
import { corvin } from '../npcs.js';

function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }

const CORVIN = [252, 176];
const THREADS = ['#f4c542', '#6fc7c0', '#c86f8f', '#a8c8e8', '#b6d97a', '#f0a878', '#fbe7a1'];

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

const KEEPER_ENDING = [
    '*And the keeper and his daughter kept the light burning together, every night, so that anyone lost at sea could find the way home.*',
    '*It was hard at first. The lamp was heavy and the stairs were long, and some nights the dark seemed much bigger than the light. But the daughter told the lamp stories, and the keeper told the daughter stories — about her mother, mostly: how brave she was, and how she laughed, and how she always, always knew how things would end.*',
    '*And that, it turned out, was the way to bring her back. Not all the way. But enough.*',
    '*They were sad, and then less sad, and then one morning they found that they were happy again — and that the light was brighter than it had ever been.*',
    '*The end.*',
];

async function keeperEnding(G) {
    await G.say('Corvin Hale sits down, right there on the cold stone floor, with the Unfinished Tale on his knee and the golden quill in his hand. For a long moment he doesn\'t move at all.');
    await G.line('Corvin', 'I don\'t know how it ends.');
    await G.choose([
        'You don\'t have to know. You only have to write the next part.',
        'She doesn\'t need the right ending. She needs yours.',
    ], null, 'Corvin');
    await G.say('He looks at you as if you had said something in a language he used to speak.');
    await G.say('Then he dips the golden quill — in what, you can\'t see; there\'s no ink anywhere — and begins to write. His hand shakes at first. Then it doesn\'t.');
    G.sfx('write');
    await G.wait(900);
    await G.say('He writes for a long time. The Loom slows, and slows, and stops. When he finally looks up, his face is wet, and he is almost smiling.');
    await G.line('Corvin', 'Come with me.');

    G.set('finale');
    G.set('corvinHere');
    G.set('gaveBoth');
    await G.go('tower');
    G.place(152, 184, 'right');
    await G.say('He kneels by the bed and opens the little book, and reads aloud, in the voice of a man who has read a great many bedtime stories.');
    for (const p of KEEPER_ENDING) await G.line('Corvin', p);
    await G.wait(600);
    G.sfx('magic');
    await G.flash('#fbe7a1', 900);
    G.set('elsieAwake');
    await G.say('In the bed, Elsie Hale opens her eyes.');
    await G.line('Elsie', 'Papa?');
    await G.wait(400);
    await G.line('Elsie', '...That\'s a good ending.');
    await G.line('Elsie', 'Can we have it again tomorrow?');
    await G.line('Corvin', 'Every night. Every single night, for as long as you like.');
    await G.say('He is laughing and crying at the same time, which you have noticed grown-ups can only do when something very good has happened.');
    await G.say('Far below you, down through the whole mountain, there comes a sound like ten thousand corks popping at once.');
    G.sfx('pour');
    G.set('released');
    await G.flash('#f4c542', 1200);
    G.chron('keeper', 'And in the tower at the top of the mountain, Corvin Hale sat down on his daughter\'s bed with a golden quill and finished the story he had stopped telling. It was not the right ending. It was his. And it was enough: Elsie woke, and the Loom let go, and ten thousand stories went home.');
    await G.pages([
        { art: G.sceneArt('tower', { elsieAwake: true, corvinHere: true, released: true }), text: 'All that night, the stories came home. They poured out of Greymantle in a river of light and ran down the mountain like water finding its level — through the Whispering Pines, where a magpie woke up and couldn\'t think why she was so happy; over the Grumblewater bridge, where a troll sat up and said *"Pies!"* to nobody at all; and into Brackenford, where they went in at every window.' },
        { art: G.sceneArt('green', {}), text: 'In the Sleeping Bear, somebody remembered the second verse of *The Plough and the Pheasant*, and then everybody did. Hob the lamplighter remembered how his song started, and started. On the green, a small girl was already explaining to her doll that the princess didn\'t *need* rescuing, thank you, but she\'d take a lift home.\n\nAnd by her own fire, an old woman opened a book that was no longer blank, and put her hand to her mouth, and said: *"Rowan. Oh — Rowan."*' },
        { text: 'Corvin Hale finished the lighthouse story that winter, a page every night, and read each one to his daughter before she went to sleep. And she did go to sleep — and every single morning, she woke up.\n\nIn the spring they walked down the mountain together for the fair. Elsie rode on the troll\'s shoulders. And she asked Gran Mab for a story, and got one.' },
        { text: 'As for the Book of Tales — it was full by the time you got it home. Gran\'s stories, every one of them. And at the very end, in a hand nobody recognised, one new one: about a child who climbed a mountain on the longest night of the year, and brought the stories home.\n\nYou\'re reading it now.' },
    ]);
    await G.ending('keeper');
}

async function giftEnding(G) {
    await G.say('Corvin looks at you for a long, long time. Then he takes your hand — his is cold, and ink-stained, and shaking — and turns you gently toward the Loom.');
    await G.line('Corvin', 'I\'m sorry. I\'m so sorry. Thank you.');
    await G.say('It doesn\'t hurt. It feels like moonbells — like the moment just before sleep. You feel the story of you being drawn out, thread by shining thread: the cottage, the fire, the honey cake, the troll, the magpie, the well —');
    await G.say('— and Gran. Gran last of all, holding on longest.');
    G.sfx('magic');
    await G.flash('#ffffff', 1400);
    G.set('giftEnding');
    G.set('released');
    G.chron('gift', 'And at the heart of the mountain, Rowan Ashby gave the Loom the only story that was theirs to give — their own — so that a little girl could wake and ten thousand stories could go home. The Book of Tales does not know what happened next. Only Gran does.');
    await G.pages([
        { text: 'Somebody walked down Greymantle in the grey light of the morning after the longest night.\n\nThey didn\'t know their own name. They had a red scarf, and a satchel with a book in it, and the book was full of stories — but none of them seemed to be about anyone in particular.' },
        { art: G.sceneArt('tower', { elsieAwake: true, corvinHere: true, released: true }), text: 'Behind them, at the top of a tower, a little girl had woken to a brand-new story, woven out of shining thread: about a lighthouse, and a keeper, and a child in a red scarf who climbed a mountain to bring the light back. Her father was holding her so tightly she complained.\n\nAhead of them, all down the valley, the stories were coming home.' },
        { art: G.sceneArt('cottage', { giftEnding: true }, [150, 172, 'left']), text: 'At the edge of the village, an old woman was waiting at a cottage door with a lamp. When she saw them coming up the path she put her hand to her mouth.\n\n*"Rowan,"* she said. *"Oh, Rowan. Come in, love, come in and sit down — you look as though you\'ve lost something."*\n\nShe sat them by the fire, and tucked a blanket round their knees, and opened the Book of Tales on her lap.\n\n*"Now, then,"* said Gran. *"Let me tell you a story. It starts on the longest night of the year, a long time ago, with a knock at my door..."*' },
    ]);
    await G.ending('gift');
}

async function loomEnding(G) {
    const c = await G.choose(['Smash the Loom', 'Not yet'], 'The Loom hums under your hand like something alive. If you break it, the stories will go free — and whatever hope Corvin has left will go with them.');
    if (c === 1) { await G.say('You lower the poker. Corvin, who had turned at the sound of it, lets out a breath he didn\'t know he was holding.'); return; }
    await G.say('You lift Gran\'s poker and bring it down on the Loom with everything you\'ve got.');
    G.sfx('shatter');
    await G.flash('#fbe7a1', 500);
    await G.line('Corvin', 'NO —');
    G.set('loomBroken');
    await G.say('The threads snap one after another, singing like harp strings, and the stories tear loose — ten thousand threads of light unravelling at once, streaming up through the great round window and out into the night. Down the mountain. Home.');
    G.set('released');
    G.sfx('pour');
    await G.wait(800);
    await G.say('Corvin Hale sinks to his knees among the broken threads.');
    await G.line('Corvin', 'That was — that was everything. That was every chance she had left.');
    await G.say('You don\'t know what to say. You aren\'t sure there is anything.');
    G.chron('loom', 'And at the heart of the mountain, Rowan broke the Story Loom with Gran\'s iron poker, and every stolen story in the valley flew home at once. It was the right thing to do. It was not, perhaps, the whole of the right thing.');
    await G.pages([
        { art: G.sceneArt('green', {}), text: 'The stories came home to Brackenford that night, every one. The Sleeping Bear sang until dawn. The lamplighter lit the lamps. Pell\'s princess got an ending, and then several more.\n\nAnd Gran — Gran knew your name before you had even opened the door.' },
        { art: G.sceneArt('tower', {}), text: 'But high on Greymantle, in a round room at the top of the tower, Elsie Hale slept on.\n\nCorvin Hale sat by her bed for the rest of that winter. You would like to think that in the end he found the words — that one night he picked up a pen and finished the story himself, and that she woke up to hear it.\n\nThe Book of Tales doesn\'t say. Perhaps that part hasn\'t been written yet.' },
    ]);
    await G.ending('loom');
}

// ---------------------------------------------------------------------------
// Corvin
// ---------------------------------------------------------------------------

async function checkBoth(G) {
    if (G.flag('gaveTale') && G.flag('gaveQuill')) await keeperEnding(G);
}

async function talkCorvin(G) {
    for (;;) {
        const opts = [], acts = [];
        opts.push('Give the stories back. They aren\'t yours.'); acts.push('back');
        opts.push('Why are you doing this?'); acts.push('why');
        if (G.flag('wennaStory') || G.flag('readDiary') || G.flag('readTale')) {
            opts.push('Have you tried finishing *her* story? The lighthouse one.'); acts.push('lighthouse');
        }
        if (G.flag('askedWhy')) { opts.push('Take my story instead.'); acts.push('gift'); }
        opts.push('Goodbye.'); acts.push('bye');
        const a = acts[await G.choose(opts, null, 'Corvin')];
        if (a === 'back') {
            await G.line('Corvin', 'When I\'ve finished. When she wakes. What are a few ballads against my daughter?');
            await G.line('Rowan', 'They\'re not a few ballads. They\'re *everyone\'s*. My gran doesn\'t know my name.');
            await G.say('For a moment his hands stop on the threads.');
            await G.line('Corvin', '...I know. I know what I\'m doing. Do you think I don\'t know?');
        } else if (a === 'why') {
            G.set('askedWhy');
            if (!G.flag('wennaStory')) {
                await G.line('Corvin', 'My daughter is asleep in the tower above us. She has been asleep for three winters. No spell will wake her. I have tried them all.');
                await G.line('Corvin', 'She fell asleep waiting for a story. So I thought — a story will wake her. I only have to find the right one.');
            } else {
                await G.line('Corvin', 'Wenna told you, I suppose. Then you know.');
            }
            await G.line('Corvin', 'There are ten thousand stories in this valley. I have woven an ending out of every one of them. Happy, sad, clever, strange. And not one — *not one* — is hers.');
        } else if (a === 'lighthouse') {
            await G.say('Corvin goes absolutely still.');
            await G.line('Corvin', '...How do you know about that?');
            await G.line('Corvin', 'I can\'t finish that one. I don\'t know how it ends. I never knew — I only ever made up the next part, and the next. Her mother always said she\'d tell me how it ended when we got there.');
            await G.line('Corvin', 'And then we got there without her.');
            G.set('askedLighthouse');
            if (!G.has('tale') && !G.flag('gaveTale')) await G.line('Corvin', 'I don\'t even know what became of the pages. I couldn\'t bear to look for them.');
            if (!G.has('quill') && !G.flag('gaveQuill')) await G.line('Corvin', 'And I threw my pen out of the window the night she fell asleep. So. There it is.');
        } else if (a === 'gift') {
            await G.line('Rowan', 'Your Loom takes stories. Take mine. All of it — tonight, and Gran, and everything. Weave Elsie an ending out of me, and give the rest back.');
            await G.say('Corvin turns round to face you properly for the first time.');
            await G.line('Corvin', 'Do you understand what you\'re asking? The Loom would take *all* of it. Your name. Your grandmother. You\'d walk out of this mountain without the faintest idea who you are.');
            const c = await G.choose(['Do it.', 'Wait — not yet.'], null, 'Corvin');
            if (c === 0) { await giftEnding(G); return; }
            await G.line('Corvin', 'Good. Good. Don\'t — don\'t say that again unless you mean it. I might not be strong enough to say no twice.');
        } else {
            await G.line('Corvin', 'Go home, child. Tell them I\'m sorry. I am sorry. It doesn\'t change anything.');
            return;
        }
    }
}

export default {
    id: 'sanctum',
    name: 'The Heart of the Mountain',
    ambience: 'magic',
    scale: [156, 0.9, 198, 1.06],
    entries: { default: [30, 178, 'right'], library: [16, 178, 'right'] },
    bgKey: (S) => [S.flag('loomBroken'), S.flag('released')].join(),

    paint(g, S, R) {
        grad(g, 0, 0, 320, 160, [[0, '#0d0b14'], [1, '#2a1a3a']]);
        stones(g, R, 0, 0, 320, 156, 20, 12, ['#1c2029', '#2e3440', '#1c2029'], '#0d0b14');
        grad(g, 0, 0, 320, 156, [[0, hexA('#0d0b14', 0.5)], [1, hexA('#4a2f5a', 0.3)]]);
        // the great round window
        circle(g, 170, 30, 30, '#1c2029');
        circle(g, 170, 30, 27, '#0d0b14');
        g.save();
        g.beginPath(); g.arc(170, 30, 26, 0, Math.PI * 2); g.clip();
        grad(g, 140, 4, 60, 60, [[0, '#0d0b14'], [1, '#1b1f3b']]);
        stars(g, R, 40, 142, 6, 56, 56);
        g.restore();
        for (let a = 0; a < 8; a++) {
            const an = a / 8 * Math.PI * 2;
            line(g, 170, 30, 170 + Math.cos(an) * 27, 30 + Math.sin(an) * 27, '#1c2029', 1);
        }
        // shelves of bottles on the side walls, feeding the Loom
        for (const x0 of [8, 272]) {
            rect(g, x0, 40, 40, 110, '#1c2029');
            for (let s = 0; s < 5; s++) {
                rect(g, x0, 60 + s * 20, 40, 2, '#6b4226');
                for (let b = 0; b < 6; b++) {
                    const col = THREADS[(R() * THREADS.length) | 0];
                    const empty = S.flag('released') || S.flag('loomBroken');
                    rect(g, x0 + 3 + b * 6, 50 + s * 20, 4, 10, empty ? '#2e3440' : col);
                    if (!empty) glow(g, x0 + 5 + b * 6, 55 + s * 20, 5, col, 0.3);
                }
            }
        }

        // the Story Loom
        const broken = S.flag('loomBroken');
        rect(g, 106, 58, 8, 98, '#6b4226');
        rect(g, 226, 58, 8, 98, '#6b4226');
        if (!broken) {
            rect(g, 100, 58, 140, 8, '#a0703c');
        } else {
            poly(g, [[100, 58], [170, 58], [174, 70], [100, 66]], '#a0703c');
            poly(g, [[176, 72], [240, 58], [240, 66], [180, 78]], '#a0703c');
        }
        rect(g, 100, 124, 140, 8, '#a0703c');
        rect(g, 100, 150, 140, 6, '#6b4226');
        rect(g, 108, 66, 4, 84, '#a0703c');
        rect(g, 228, 66, 4, 84, '#a0703c');
        // carved finials
        for (const x of [110, 230]) { circle(g, x, 54, 6, '#a0703c'); circle(g, x, 54, 3, '#f4c542'); }
        // warp threads of light
        if (!broken && !S.flag('released')) {
            for (let i = 0; i < 26; i++) {
                const x = 118 + i * 4.3;
                line(g, x, 66, x, 124, THREADS[i % THREADS.length], 1);
            }
            glow(g, 170, 96, 70, '#f4c542', 0.25);
        } else if (broken) {
            for (let i = 0; i < 26; i++) {
                const x = 118 + i * 4.3;
                line(g, x, 124, x + (i % 2 ? 3 : -3), 124 - 8 - (i * 7) % 20, '#555c6a', 1);
            }
        }
        // the half-woven tapestry
        rect(g, 116, 132, 108, 18, '#2b3a67');
        for (let i = 0; i < 12; i++) rect(g, 118 + i * 9, 134 + (i % 3) * 4, 6, 3, THREADS[i % THREADS.length]);
        if (!broken) {
            // a lighthouse, half-made, in the weave
            rect(g, 166, 134, 6, 14, '#f4ecd8');
            rect(g, 166, 132, 6, 3, '#f4c542');
        }

        // floor with a rune circle
        rect(g, 0, 152, 320, 48, '#1c2029');
        grad(g, 0, 152, 320, 48, [[0, '#1c2029'], [1, '#2e3440']]);
        g.strokeStyle = broken ? '#555c6a' : '#7d4a78';
        g.lineWidth = 1;
        g.beginPath(); g.ellipse(170, 172, 100, 18, 0, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.ellipse(170, 172, 88, 14, 0, 0, Math.PI * 2); g.stroke();
        for (let i = 0; i < 16; i++) {
            const an = i / 16 * Math.PI * 2;
            rect(g, 170 + Math.cos(an) * 94, 172 + Math.sin(an) * 16, 2, 2, broken ? '#555c6a' : '#c86f8f');
        }
        speckle(g, R, 0, 152, 320, 48, ['#2e3440', '#0d0b14'], 200);

        // the exit, back west to the library
        rect(g, 0, 90, 14, 66, '#0d0b14');
        glow(g, 4, 124, 20, '#f4c542', 0.2);

        const vg = g.createRadialGradient(170, 100, 80, 170, 100, 250);
        vg.addColorStop(0, hexA('#0d0b14', 0));
        vg.addColorStop(1, hexA('#0d0b14', 0.6));
        g.fillStyle = vg;
        g.fillRect(0, 0, 320, 200);
    },

    walk: () => ({
        areas: [[[0, 160], [320, 160], [320, 199], [0, 199]]],
        blockers: [
            [[98, 154], [242, 154], [242, 166], [98, 166]],
            [[242, 166], [264, 166], [264, 182], [242, 182]],
        ],
    }),

    actors(S, t, A, sp) {
        if (S.flag('corvinHere') || S.flag('giftEnding')) return [];
        const kneel = S.flag('loomBroken');
        return [{ y: CORVIN[1], draw: (g, tt) => corvin(g, CORVIN[0], CORVIN[1], tt, sp === 'Corvin', 'left', kneel) }];
    },

    overlay(g, S, t) {
        if (S.flag('loomBroken') || S.flag('released')) {
            // stories streaming out through the window
            if (S.flag('released')) {
                for (let i = 0; i < 30; i++) {
                    const p = (t * 0.3 + i / 30) % 1;
                    const x = 170 + Math.sin(i * 2.1) * 60 * (1 - p);
                    const y = 130 - p * 110;
                    px(g, x, y, 1, 2, THREADS[i % THREADS.length]);
                }
            }
            return;
        }
        // light streaming from the shelves into the Loom
        for (let i = 0; i < 40; i++) {
            const p = (t * 0.25 + i / 40) % 1;
            const left = i % 2 === 0;
            const sx = left ? 48 : 272, sy = 60 + (i * 13) % 80;
            const ex = left ? 116 : 224, ey = 70 + (i * 7) % 54;
            const x = sx + (ex - sx) * p;
            const y = sy + (ey - sy) * p - Math.sin(p * Math.PI) * 14;
            px(g, x, y, 1, 1, THREADS[i % THREADS.length]);
        }
        // threads shimmer
        for (let i = 0; i < 6; i++) {
            const k = Math.floor(t * 8 + i * 5) % 26;
            px(g, 118 + k * 4.3, 66 + ((t * 60 + i * 17) % 56), 1, 3, '#ffffff');
        }
    },

    look: 'The heart of the mountain: a round chamber as tall as a church, with a great round window open to the stars. In the middle stands a loom the size of a house, and on it, thread by glowing thread, stories are being woven — pouring in streams of light from the bottles on the walls, crossing, knotting, becoming cloth.',

    hotspots: [
        {
            id: 'corvin', name: 'the Warlock', shape: { rect: [238, 112, 28, 66] }, at: [226, 184], face: 'right',
            when: (S) => !S.flag('corvinHere') && !S.flag('giftEnding'),
            look: (G) => G.say(G.flag('loomBroken')
                ? 'Corvin Hale kneels among the broken threads with his head in his hands.'
                : 'Corvin Hale, the Warlock of Greymantle: tall, grey, and much thinner than a warlock ought to be, in a long blue coat stitched all over with little gold stars. There is ink on his fingers. He looks like a man who has not slept in three years, because he hasn\'t.'),
            talk: talkCorvin,
            use: 'You tug at the Warlock\'s sleeve. He looks down at you, briefly, as if you were a very small interruption in a very long night.',
            items: {
                async tale(G) {
                    G.take('tale');
                    G.set('gaveTale');
                    await G.say('You hold out the little hand-sewn book. Corvin takes it as if it might crumble.');
                    await G.line('Corvin', 'Where did you — she *kept* it. In the music box. Of course she kept it. I made her that box.');
                    await G.say('He turns the pages slowly until he comes to the place where the ink trails away.');
                    await G.line('Corvin', '*And the keeper and his daughter* — that\'s where I stopped. The night Marian died. I sat down to write the next part and there wasn\'t a single word left in me.');
                    if (!G.flag('gaveQuill')) {
                        await G.line('Corvin', 'I couldn\'t even if I wanted to. I haven\'t a pen worth writing it with. I threw mine out of the window, that night. Swore I\'d never write another word.');
                        return;
                    }
                    await checkBoth(G);
                },
                async quill(G) {
                    G.take('quill');
                    G.set('gaveQuill');
                    await G.say('You hold out the golden quill. Corvin stares at it as if it were a ghost.');
                    await G.line('Corvin', 'Where did you get that?');
                    await G.line('Rowan', 'A magpie. She said it came down through the snow like a little sun.');
                    await G.say('He takes it. His fingers close around it exactly where the gold is worn smooth.');
                    await G.line('Corvin', 'I threw this out of the window the night Elsie fell asleep.');
                    if (!G.flag('gaveTale')) {
                        await G.line('Corvin', 'But what would I write with it? I\'ve written a thousand endings on that Loom. None of them were hers.');
                        return;
                    }
                    await checkBoth(G);
                },
                async poker(G) {
                    const c = await G.choose(['Attack the Warlock', 'Think better of it'], 'He hasn\'t even turned around.');
                    if (c === 1) { await G.say('You lower the poker. Whatever this is, it isn\'t going to be solved by hitting it.'); return; }
                    await G.die('Bound in Calfskin', 'You swing Gran\'s poker at the Warlock of Greymantle. Corvin Hale doesn\'t even turn round. He flicks two fingers, and you become a book: slim, handsomely bound in blue calfskin, with gilt edges and a ribbon bookmark.\n\nYou are shelved in the library between *The Miller\'s Ballad* and *How the Baker\'s Grandmother Met a Bear*, and are very occasionally dusted.');
                },
                async book(G) {
                    if (G.flag('pouredBottle')) {
                        await G.say('Corvin glances at the Book of Tales, and then looks again, and sees that it\'s full.');
                        await G.line('Corvin', 'Mab Ashby\'s book. You took hers back. Good. Good — somebody ought to have something back.');
                    } else {
                        await G.line('Corvin', 'Mab Ashby\'s book. I\'d know it anywhere. I\'m sorry about that, too.');
                    }
                },
                bottle: (G) => G.line('Corvin', 'Mab Ashby\'s. Take it. Take it home. I — just take it.'),
                button: (G) => G.line('Corvin', 'A button? I don\'t — no. Thank you. No.'),
                default: (G) => G.say('Corvin barely glances at it.'),
            },
        },
        {
            id: 'loom', name: 'the Story Loom', shape: { rect: [98, 48, 144, 108] }, at: [170, 182], face: 'up',
            look: (G) => G.say(G.flag('loomBroken')
                ? 'The Story Loom stands broken, its beam cracked in two, its threads hanging dead and grey.'
                : 'The Story Loom: a frame of dark carved wood as big as a house, strung with ten thousand threads of light. Every thread is a story — you can hear them, faintly, as they cross: a verse of a song, a line of a joke, *once upon a time* over and over. On the cloth at the bottom, half-woven, is a lighthouse.'),
            use: (G) => G.say(G.flag('loomBroken')
                ? 'There\'s nothing left of it to use.'
                : 'You reach toward the threads. They are warm, and they hum, and for a moment you hear Pell\'s mother singing a lullaby you had forgotten you knew. You snatch your hand back.'),
            items: {
                poker: (G) => (G.flag('loomBroken') ? G.say('It\'s broken already.') : loomEnding(G)),
                book: 'You hold the Book of Tales up to the Loom. The threads bend toward it like plants toward a window — but they\'re caught fast. The Book can\'t take them home while the Loom holds them.',
                tale: 'You could feed the Unfinished Tale to the Loom — but it\'s tried a thousand endings. This one needs a person, not a machine.',
            },
        },
        {
            id: 'window', name: 'the round window', shape: { circle: [170, 30, 30] }, far: true,
            look: 'A great round window at the top of the chamber, open to the stars. The wind comes through it smelling of snow.',
        },
        {
            id: 'shelves', name: 'the bottles on the walls', shape: { rect: [6, 38, 44, 114] }, at: [60, 176], face: 'left',
            look: (G) => G.say(G.flag('released') || G.flag('loomBroken') ? 'Empty bottles. Every one of them.' : 'More bottles, their stories unspooling in streams of light across the chamber and into the Loom.'),
        },
        {
            id: 'shelves2', name: 'the bottles on the walls', shape: { rect: [270, 38, 44, 114] }, far: true,
            look: (G) => G.say(G.flag('released') || G.flag('loomBroken') ? 'Empty bottles. Every one of them.' : 'More bottles, their stories unspooling in streams of light across the chamber and into the Loom.'),
        },
        {
            id: 'back', name: 'back to the library', shape: { rect: [0, 90, 14, 110] }, at: [4, 178], exit: 'library',
            look: 'The archway back to the library.',
        },
    ],

    async enter(G, first) {
        if (!first) {
            if (!G.flag('loomBroken')) await G.line('Corvin', 'You again. Have you brought me a story this time?');
            return;
        }
        await G.say('The archway opens into a chamber at the very heart of the mountain. In the middle of it stands a loom as big as a house, and on the loom, thread by glowing thread, stories are being woven — pouring in streams of light from the bottles on the walls, crossing, knotting, becoming cloth.');
        await G.say('A tall man in a coat stitched with stars is standing beside the Loom. He doesn\'t look round.');
        await G.line('Corvin', 'Another one. The miller\'s boy came last winter — he got as far as the troll. You\'ve come further than anybody.');
        await G.line('Corvin', 'Have you brought me a story?');
    },
};
