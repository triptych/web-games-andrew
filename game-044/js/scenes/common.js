/**
 * common.js — interactions that don't belong to one place: combining items,
 * using items on yourself, examining items, and the fallback lines for
 * things that don't work.
 */

import { ITEMS } from '../items.js';

export const TALE_TEXT = [
    'Once upon a time, at the very end of the world, where the map runs out and the sea keeps going anyway, there was a lighthouse.',
    'In the lighthouse lived a keeper, and the keeper\'s wife, and their daughter, whose job it was to keep the light from getting lonely. Every night she told it a story, and every night it shone a little brighter to hear the end.',
    'One night a great storm came. The waves climbed the rocks and the wind climbed the stairs, and the light went out. The keeper\'s wife took a lantern and went down to the shore to guide the lost ships in — and when the storm was over, she did not come back.',
    'And the keeper and his daughter',
];

async function readTale(G) {
    await G.say('You open the little hand-sewn book. The handwriting is careful and tall, the handwriting of someone who wanted it read aloud.');
    for (const p of TALE_TEXT.slice(0, 3)) await G.say(`*${p}*`);
    await G.say(`*${TALE_TEXT[3]}* — `);
    await G.say('And there it stops, mid-sentence. The last word trails off into a long, shaky line of ink, as if the pen had simply been put down and never picked up again. The rest of the pages are blank.');
    if (!G.flag('readTale')) {
        G.set('readTale');
        G.award('readTale');
        G.chron('readTale', 'In the book, a keeper and his daughter were left standing in the dark of a story with no ending. Rowan understood, then, what the Warlock had been looking for in everyone else\'s tales.');
    }
}

export const ITEM_LOOK = {
    async book(G) {
        if (!G.S.chronicle.length) {
            await G.say(ITEMS.book.desc);
            return;
        }
        G.openBook();
    },
    tale: readTale,
    async bottle(G) {
        await G.say(ITEMS.bottle.desc);
        await G.say('You hold it to your ear. Very small and very far away, Gran\'s voice is saying, *"Once upon a time—"*');
    },
    async quill(G) {
        await G.say(ITEMS.quill.desc);
        if (G.flag('wennaStory')) await G.say('Corvin Hale. Wenna said he stopped writing the night Elsie fell asleep. So this is where his pen went.');
    },
};

export const COMBOS = {
    async 'bone+draught'(G) {
        G.take('bone');
        G.take('draught');
        await G.say('You unstopper the vial and dribble the sleeping draught over the soup bone — three drops for a hound, Wenna said, so you use rather more than that, on account of Brimble being the size of a pony.');
        await G.say('The bone glistens a faint moonbell blue. Even the smell is sleepy.');
        G.give('drowsybone');
        G.award('drowsyBone');
    },
    async 'book+bottle'(G) {
        await G.say('You open the Book of Tales to its blank pages, pull the cork from Gran\'s bottle, and tip it.');
        G.sfx('pour');
        await G.flash('#f4c542', 700);
        G.take('bottle');
        G.set('pouredBottle');
        G.award('pourBottle');
        await G.say('The light pours out like warm honey, and where it touches the pages, words bloom — hundreds of them, thousands, in Gran\'s round handwriting. The Fox and the Frost Giant. The Miller\'s Three Wishes. How the Moon Lost Her Shoe. They settle onto the paper like birds coming home to roost.');
        await G.say('The last page fills more slowly than the rest. It is the only story in the book that you have never heard.');
        await G.say('*On the longest night of the year, twelve winters ago, there came a knock at my door. When I opened it, there was nobody there — only a basket, and in the basket a baby wrapped in a blue-green shawl, with a note pinned to it that said only: ROWAN.*');
        await G.say('*I never found out who left you. I stopped wondering, after a while. I had decided you were a story that had come to me to be told, and I meant to tell you properly — every night, for as long as I had breath. That is what grandmothers are for.*');
        await G.say('You close the Book. Somewhere down in the valley, you are fairly sure, an old woman by a fire has just remembered your name.');
        G.chron('pourBottle', 'In the Warlock\'s library, Rowan poured Mab\'s stories home into the Book of Tales — and found among them one they had never been told: how a baby named Rowan came to a grandmother\'s door on the longest night, and was kept, and was loved.');
    },
    async 'quill+tale'(G) {
        await G.say('You open the Unfinished Tale to where the ink runs out, and lift the golden quill.');
        await G.say('*And the keeper and his daughter* — you begin, and stop.');
        await G.say('You don\'t know what they did. You could make something up, but it would be a story about *somebody else\'s* keeper, and *somebody else\'s* daughter. This one isn\'t yours to finish.');
        await G.say('You have a feeling you know whose it is.');
    },
    async 'book+tale'(G) {
        await G.say('You tuck the Unfinished Tale between the pages of the Book of Tales. The Book promptly spits it out again, like a cat declining medicine. It seems to think the story isn\'t finished enough to keep.');
    },
    async 'book+quill'(G) {
        await G.say('You could write in the Book of Tales — but it appears to be writing itself, thank you, and would rather not be interrupted.');
    },
    async 'cake+draught'(G) {
        await G.say('Drug a honey cake? Gran would never forgive you. Some things are sacred.');
    },
    async 'draught+moonbells'(G) {
        await G.say('The moonbells are already in the draught. That\'s rather the point of it.');
    },
    async 'bone+cake'(G) {
        await G.say('A bone and a cake. It would make an interesting sandwich, but not a useful one.');
    },
};

export const SELF = {
    '@look': 'You are Rowan Ashby: twelve winters old, apprentice to nobody, and grandchild of the best storyteller in the valley. Your scarf is Gran\'s knitting, your boots are borrowed, and your courage is mostly your own.',
    '@use': 'You straighten your scarf and square your shoulders. Courage restored — slightly.',
    '@talk': '"You can do this," you tell yourself. You are almost convinced.',
    '@walk': null,
    async draught(G) {
        await G.say('You unstopper the little blue vial. It smells of moonbells and warm blankets and every Sunday afternoon you ever napped through.');
        const c = await G.choose(['Drink it', 'Put the stopper back'], '"And don\'t you go drinking it," Wenna said. But what would one little sip hurt?');
        if (c === 1) { await G.say('Wenna, you decide, probably knows best.'); return; }
        await G.die('The Longest Sleep', 'You take one little sip. Then, because it is delicious, another.\n\nYou wake up a hundred years later, which in a fairy story would be the beginning of something. Unfortunately, the Book of Tales records that you slept through the rest of your own adventure, the Warlock, the end of the world, and a very nice breakfast.');
    },
    book: (G) => ITEM_LOOK.book(G),
    tale: readTale,
    async bottle(G) {
        await G.say('You could pull the cork right here — but a story let loose needs somewhere to go. Somewhere that knows the way home.');
    },
    cake: "You're tempted. But Gran always said a honey cake is for sharing, and you have a feeling somebody out there needs it more than you do.",
    moonbells: 'You sniff the moonbells and give an enormous yawn. Best not do that again until you\'re somewhere with a pillow.',
    bone: 'You are not *that* hungry.',
    drowsybone: 'You are not that hungry, and you would like to stay awake for the rest of the story.',
    poker: 'You give yourself a cautious prod. Yes. It is definitely pointy enough.',
    penny: 'You flip the penny. Heads. You decide that means something good.',
    quill: 'You tickle your own nose with the golden quill and sneeze. The magpie would be ashamed of you.',
    rope: 'You consider tying yourself up for safekeeping, and decide against it.',
    brasskey: 'You try to wind yourself up with the little key. You are, it turns out, already wound up quite enough.',
    silverkey: 'You are not locked. At least, not in any way a key could help with.',
    button: 'It would look very fetching on a coat half your size.',
};

function hash(s) {
    let h = 7;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h;
}

/** A varied "that doesn't work" line for using item `id` on `spot`. */
export function genericFail(id, spot) {
    const it = ITEMS[id].name.toLowerCase();
    const tgt = spot ? spot.name : 'that';
    const lines = [
        `Using the ${it} on ${tgt} achieves nothing, apart from a slight feeling of embarrassment.`,
        `You wave the ${it} at ${tgt}. Nothing happens. You put it away before anyone notices.`,
        `The ${it} and ${tgt} have nothing to say to one another.`,
        `You can't think how the ${it} would help with ${tgt}.`,
    ];
    return lines[hash(id + tgt) % lines.length];
}
