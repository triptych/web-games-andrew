// Every word of the story: Elowen's pages, her echoes, Nib, the carvings, the ending.
// Pages that carry a clue are functions of a small context, so the clue fits this seed's laws.
//
// ctx = { L (laws), name (the player's), word(e) ("the warm word"), rname(id), phase(id) }

import { REAGENTS } from './reagents.js';
import { ESSENCE_INFO } from '../../config.js';

const reagentFor = (L, e, prefer) => {
    const ids = Object.keys(L.reagents).filter((id) => L.reagents[id].essence === e);
    return ids.find((id) => REAGENTS[id].region === prefer) || ids[0];
};

export const PAGES = {
    p1: {
        title: 'The First Page',
        where: 'On the desk in the hut',
        text: () => `Day one (again: I keep losing count). I have decided to call this island **Hum**, because it does. Lie on the floor of the hut at night and you'll feel it through the boards: a low note, like a held breath.

Professor Aldane said the note was in my head. Professor Aldane can kiss a goat.

I have built instruments to listen to it: the **alembic**, the **bells** and the **orrery**. Every one of them is held together with string and spite.

If you are reading this I suppose I'm not here, and I suppose you've found my **Focus** on the desk. It's only hazel and a bit of sea glass. Hold it anyway. And look at the **marks carved over the circle**. I didn't make them up. I copied them from the old stones on the moor.

— E. V.`,
    },
    p2: {
        title: 'On Method',
        where: 'Tucked on the shelf by the door',
        text: () => `Notes on method, for when I forget.

The **ALEMBIC** boils a thing down to what it really is. Watch what the vapour does to the glass: it burns, freezes, glows, grows, gusts, or simply *stops*. A thick plume means a strong thing.

The **BELLS** tell you how two things feel about each other. The same note, two notes, or a horrible clash.

The **ORRERY** points to the hour a thing is strongest.

The marks over the circle: the ones inside a ring are **SHAPES**, how a word is thrown. The bare ones are the **words**. Six words, I think, and three shapes. A word has to be **fed** with something that carries it, or it's just a scratch. And the shape goes at one end of the words. Which end? I keep forgetting. Try both.

*(Later, in shakier ink:)* Things that clash on the bells HATE each other. Remember that. I didn't.`,
    },
    p3: {
        title: 'Why I Came',
        where: 'In the stern of a rowing boat',
        text: () => `I rowed here in Da's boat with a trunk of books, a sack of oats and a cat who left me on the first day for a better life in the dunes.

Everyone at the Academy said the hum was nothing. Mam used to sing to it from the cliffs at home. She said the world has a word for everything, and if you listen long enough it will tell you yours.

I am nineteen and I have no word yet. But I've got time, and oats.`,
    },
    p4: {
        title: 'A Thief',
        where: 'Tucked under a stone in Whisperwood',
        text: () => `Something has been stealing my biscuits. I set a trap.

I caught: a GOBLIN. Small, grey-green, ears like sails, eyes like lamps. He looked so offended that I let him go and gave him a biscuit to make up for it.

He comes back every evening now. I've named him **Nib**. He has named me, I think, "Bright Girl". I'll take it.`,
    },
    p5: {
        title: 'The Green Word',
        where: 'Nailed to the seedbed post by the mere',
        text: (c) => `I made a seedbed here by the mere and carved the word I think means *growing* on its post. I fed it **${c.rname(reagentFor(c.L, 'bloom', 'wood'))}**, and by morning the whole bed was green.

There's one of the old stones out on the islet. I can't reach it. Bridges are hard. Plants are easy.

The stones each have a word carved on them, and I think they're waiting to hear it spoken back. Strongly. A whisper won't do.`,
    },
    p6: {
        title: 'A Small Confession',
        where: 'Pinned to a post at the mouth of the gorge',
        text: (c) => `The frozen waterfall in this gorge was me. I was practising ${c.word('rime')} and I sneezed.

It has not melted in a month. Warmth should do it, but it has to be a LOT of warmth: the same word spoken twice in one breath, or spoken at its proper hour. (The cold word is strongest at **${c.phase(c.L.wax.rime)}**. I expect the warm one has its own hour. The orrery would know.)

The fen is lovely once you're in. The springs are hot enough to bathe in. The pool in the middle is hot enough to boil you, and the vents on the causeway spit steam like a kettle with a grudge.`,
    },
    p7: {
        title: 'Older Than Us',
        where: 'In a tin box at the moor camp',
        text: (c) => {
            const [a, b] = c.otherPair;
            return `Somebody carved these stones a very long time ago, and then they stopped. I don't know why. Maybe they found what I'm finding.

The words can be spoken together. **The same word twice** and it's twice as strong. **Two different words** and they grind against each other and come to nothing.

But two words that **hate each other**... The bells clashed between **${c.rname(reagentFor(c.L, a))}** and **${c.rname(reagentFor(c.L, b))}**, so I tried those two together, very small. The air came apart like wet paper, and then it closed again.

I think it *unmakes* things. I think it could unmake a curse, if anyone had one.`;
        },
    },
    p8: {
        title: 'The Loud Place',
        where: 'Snagged on the thorns before the castle',
        text: (c) => `I'm moving my circle to the old castle on the hill. The hum is loudest there, loud enough to rattle my teeth.

I want to try something big. I want to speak **${c.word(c.L.elowen[0])}** and **${c.word(c.L.elowen[1])}** together and see what they make. Nobody has ever spoken two words at once on purpose. If it works I'll be the first person in the world to... well. To do anything at all.`,
    },
    p9: {
        title: 'Last Entry',
        where: 'Under a fallen banner in the courtyard',
        text: (c) => `It's tonight. The circle is chalked, the moon is up, and Nib is sulking because I wouldn't let him come.

${c.word(c.L.elowen[0])[0].toUpperCase() + c.word(c.L.elowen[0]).slice(1)} and ${c.word(c.L.elowen[1])}. I've checked my sums twice.

If something goes wrong (it won't) but if it does: I'm sorry, Nib. Feed the cat if she comes back.`,
    },
    p10: {
        title: 'Written in Light',
        where: 'Glowing on the floor of the keep',
        text: () => `*The words glow faintly on the flagstones, as if a finger of light wrote them and the light stayed.*

THEY HATED EACH OTHER. I DIDN'T CHECK THE BELLS.

Everything stopped. I'm inside the stop. I can't move. I can only feel.

Whoever you are: **unmake it where I made it.** Set the same two words down at my feet, a Seal, not a throw. And make it **strong**. Stronger than I did.`,
    },
};
export const PAGE_IDS = Object.keys(PAGES);

// Elowen's echoes: only Lumen shows them, and only after dark.
export const ECHOES = {
    e1: { where: 'hut', text: (c) => `...is someone in my hut? I can feel the circle humming. You're learning the words. One by one, like I did. Oh, please be careful, ${c.name}.`, needs: 'Speak to her' },
    e2: { where: 'islet', text: () => `You found Nib. I can feel him close to you, chattering. He's so much braver than he looks. Thank you for being kind to him.` },
    e3: { where: 'herald', text: () => `It's strange, being inside a stopped moment. I can't see you, but I can feel you think. You think in such a tidy, patient way. I like it. I like it a lot, actually.` },
    e4: { where: 'court', text: () => `You're so close now. I'm frightened of what you'll find, and what you'll think of me. I did this. Will you still... no. Never mind. Just come. Please.` },
};
export const ECHO_IDS = Object.keys(ECHOES);

// What you read when you look at things.
export const INSPECT = {
    lintel: 'Six marks are carved above the circle: three bare, three inside rings. When you trace one with a finger it seems to make a sound in your head.',
    stone: (reg, awake) => awake ? 'The stone is awake. Its mark burns steadily, and a thread of light runs from it toward the castle.' : 'An old standing stone, taller than you. One mark is carved deep into it. It feels like it is waiting to hear its own word, spoken strongly.',
    icewall: 'A waterfall frozen solid, blue and groaning. It blocks the gorge completely. It would take a great deal of warmth to melt.',
    vent: 'A vent in the causeway, spitting scalding steam. Nobody is walking past that.',
    thorn: 'A wall of black thorns, taller than trees, wrapped all the way around the castle. Burn them and they grow back as you watch. This is no ordinary bramble: it is the curse itself.',
    door: 'A blank stretch of wall where a door ought to be. The stone here is too smooth, and it hums, as if something is hiding in plain sight. Hiding from what?',
    gallery: 'The stair to the upper hall has fallen in. The gallery is far too high to climb.',
    heart: 'Elowen hangs in the air inside a bubble of stopped time: a girl about your age, mid-step, her hair lifted by a wind that stopped blowing a year ago. Her eyes are open.',
    seedbed: 'A neat seedbed edged with stones, gone to weeds. A post at one end has a mark carved into it.',
    cage: 'A small goblin is trapped inside a ball of black thorns, which squeeze tighter whenever he wriggles.',
    sign: 'A weathered signpost. West: WHISPERWOOD. East: EMBER FEN. North: CASTLE (do not). Far north: THE HIGHMOOR. South: home (hut).',
    storm: 'A ring of standing stones in a howling wind that never stops. The wind shoves you back however hard you lean into it.',
    hearthCold: 'A stone hearth, cold. There is flint and steel on the mantel. It needs wood.',
    wreck: 'What is left of the ship you were on. Nothing aboard is worth saving now.',
};

// Nib, talking.
export const NIB = {
    caged: 'Help! Help! Nib is stuck! The thorns are squeezing!',
    rescue: [
        { who: 'nib', text: 'Eek! Hot! Cold? Something! Oh, oh! The thorns are gone! You... you spoke a word! A real word, like the Bright Girl!' },
        { who: 'you', choices: [{ label: 'Who is the Bright Girl?', to: 2 }, { label: 'Are you hurt?', to: 3 }] },
        { who: 'nib', text: 'She lived in the hut on the cliff. She gave Nib biscuits and called him an excellent assistant.', next: 4 },
        { who: 'nib', text: 'Nib is fine. Nib is very small and very fine. Thank you. Nobody has been kind to Nib since the Bright Girl.', next: 4 },
        { who: 'nib', text: 'One night she went to the castle with her chalk and her candles, and the whole castle went STILL. Then the thorns grew, and the black water, and the dark things that come out at night.' },
        { who: 'nib', text: 'She is still in there. Nib has seen her through the gate, standing in the air, not moving. Not even blinking.' },
        { who: 'nib', text: 'You speak the words like her. Maybe you can bring her back! Nib will help. Nib is an excellent assistant. Nib can carry things, and find things, and be brave. Mostly.' },
        { who: 'sys', text: 'Nib joins you. He carries what you can\'t, picks up reagents he spots, and gives advice if you talk to him.' },
    ],
    barks: {
        firstspell: 'You did a magic! Nib felt it in his ears!',
        stone: 'The stone woke up! Look, it is shining at the castle!',
        icewall: 'Drip drip drip! The Bright Girl\'s icicle is gone!',
        bridge: 'Leaves! A bridge made of leaves! Nib is not sure about walking on salad.',
        thorns: 'The thorns are shrinking! They hate that! Good!',
        gate: 'The gate! The gate is open! Nib has not been inside since... since.',
        door: 'A door! It was hiding!',
        night: 'It is getting dark. The dark things come out at night. Nib would like a fire, please.',
        cold: 'Your teeth are chattering. Nib can hear them. Find a fire!',
        hungry: 'Your tummy is growling louder than Nib. Eat something!',
        shade: 'A dark thing! Light makes them go away. Nib read that. Nib cannot read. Nib guessed.',
        fizzle: 'Pfft. The words fell over. Try again!',
        unweave: 'The air went funny. Like a page tearing. Nib\'s ears hurt.',
        found: (n) => `Nib found ${n}! Into the bag it goes.`,
    },
};

// Hints, by goal: the first speaks to method, the second nudges harder. Never the answer.
export const HINTS = {
    shelter: ['It is getting dark and cold. There is a hut up on the bluff to the east of the beach.'],
    fire: ['A hearth needs wood. Driftwood washes up all along the beach. Three pieces should do.'],
    sleep: ['The bed in the hut will see you through to morning.'],
    journal: ['There is a journal open on the desk in the hut.'],
    lintel: ['The marks carved over the circle in the hut. Look at them closely.'],
    distill: ['Put something you found on the beach into the alembic and watch what the vapour does.'],
    firstspell: [
        'Open your book (Tab) and write a spell: one ringed shape and one bare word, and feed the word a reagent that carries it.',
        'If the words tangle, the shape is at the wrong end. If a word starves, it was fed the wrong thing: the alembic tells you what a reagent carries.',
    ],
    nib: ['Someone was crying in Whisperwood, to the west. Thorns are tough, but they burn, freeze and tear.'],
    stones: [
        'Each standing stone has its word carved on it. Learn which word it is, feed it, and speak it strongly at the stone.',
        'Strong means two copies of the same word in one spell, or one copy spoken at the hour that word waxes. The orrery knows the hours.',
    ],
    thorns: [
        'The thornwall is the curse itself. Burning won\'t hold it. Elowen\'s pages talk about words that unmake.',
        'Two words that clash on the bells, spoken together, unmake things. Throw them at the thorns.',
    ],
    moat: ['Black water. Not for swimming. The cold word might let you walk where you couldn\'t, if you wore it.'],
    gate: ['The gate has three locks, one for each standing stone.'],
    door: ['A wall with no door is a door that is hiding. Hiding things don\'t like light.'],
    stair: ['Too high for legs. Wind goes up, though, if you set it down and stand in it.'],
    heart: [
        'Read what is written on the keep floor. Same two words, set at her feet, and strong.',
        'Her two words are in her last pages. Which glyphs are they? Feed both, seal them at her feet, and make the spell strong: a strong reagent, or one word at its waxing hour.',
    ],
    done: ['You did it. Nib is very proud. Nib is going to have a biscuit.'],
};

// The ending, in the hut at dawn. Choices add to affection; the last choice decides the ending.
export const EPILOGUE = [
    { who: 'sys', text: 'The bubble cracks like ice on a pond in spring. Time rushes back into the keep all at once, and Elowen falls, and you catch her.' },
    { who: 'elowen', text: '...Oh. Oh, it moved. Everything moved.' },
    { who: 'nib', text: 'BRIGHT GIRL!' },
    { who: 'elowen', text: 'Nib! Nib, you\'ve got so round. Who has been feeding you?' },
    { who: 'nib', text: 'Biscuits are a sometimes food. Nib has been having a lot of sometimes.' },
    { who: 'sys', text: 'Later, in the hut, with the fire lit and the sun coming up over the sea...' },
    { who: 'elowen', text: (c) => `You're the one I felt. Learning the words, one at a time, in my hut, with my instruments. ${c.name}, isn't it? Nib told me. Several times.` },
    { who: 'you', choices: [
        { label: 'I had a good teacher. Your notes.', to: 8, aff: 1 },
        { label: 'You owe me a biscuit. Several biscuits.', to: 9, aff: 1 },
        { label: 'I couldn\'t leave you in there.', to: 10, aff: 2 },
    ] },
    { who: 'elowen', text: 'My notes are a disgrace and you know it. You worked it out yourself. All of it.', next: 11 },
    { who: 'elowen', text: '*She laughs, properly, for what sounds like the first time in a long while.* I\'ll bake. I owe you a lifetime of biscuits.', next: 11 },
    { who: 'elowen', text: '*She looks at you for a long moment, and doesn\'t say anything, and then has to look at the fire instead.*', next: 11 },
    { who: 'elowen', text: 'Do you know what you are? You\'re the first. Not me. I found the door; you walked through it. The first person in the world to really learn magic.' },
    { who: 'you', choices: [
        { label: 'We both are. You found it. I just listened.', to: 13, aff: 1 },
        { label: 'Then you\'ve got some catching up to do.', to: 14, aff: 1 },
    ] },
    { who: 'elowen', text: 'That\'s a very kind lie. I\'m going to let you tell it.', next: 15 },
    { who: 'elowen', text: 'Oh, it\'s like that, is it? Right. Tomorrow. The bells. You and me.', next: 15 },
    { who: 'elowen', text: 'Da\'s boat is still on the beach. You could go home, you know. Tell the Academy. Tell everyone. They\'d have to believe you.' },
    { who: 'you', choices: [
        { label: 'I\'d rather stay. Here. With you.', end: 'heart' },
        { label: 'Stay, and study? There\'s a whole island of words left.', end: 'study' },
        { label: 'Someday. Not yet.', end: 'study' },
    ] },
];

export const ENDINGS = {
    heart: {
        high: { title: 'Two Voices', text: 'Elowen goes very pink. Then she laughs, and takes your hand, and doesn\'t let go.\n\n"Good," she says. "Because I have a theory about the sunrise, and I\'m going to need an assistant."\n\n"Nib is the assistant," says Nib.\n\n"A second assistant," says Elowen, and leans her head on your shoulder, and for the first time in a year the island of Hum hums in two voices.' },
        low: { title: 'We\'ll See', text: 'Elowen goes very pink and looks at her hands.\n\n"Stay," she says. "I\'d like that. And... we\'ll see. I only just got back. Let me get to know the person who learned my words."\n\nShe smiles, a little shy, a little hopeful. Outside, the sun climbs over Hum, and the island hums along.' },
    },
    study: {
        high: { title: 'The Island of Words', text: '"Good," says Elowen, a little too quickly, and then, more quietly: "I\'m glad. I\'m really glad."\n\nYou spend the morning at the bells together, arguing happily about the hum, and when your hands brush over the same reagent neither of you moves away at once.\n\nThe island of Hum hums in three voices now: hers, yours, and a very small goblin\'s.' },
        low: { title: 'The Island of Words', text: '"Good," says Elowen. "Good. Because I have about four hundred questions and you\'re the only one who knows the answers."\n\nThe island of Hum hums in three voices now: hers, yours, and a very small goblin\'s.' },
    },
};

export const WORDS = (e) => ESSENCE_INFO[e].word;
