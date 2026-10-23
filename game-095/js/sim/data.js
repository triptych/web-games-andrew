// The tables: items, rooms, clues, suspects, the talk with Winnie. Plain data and small text
// functions of the seeded layout; no state, so the view and the tests can read them freely.

export const ROOMS = {
    foyer: { name: 'Grand Foyer', icon: '🚪' },
    parlor: { name: 'Parlor', icon: '🛋️' },
    kitchen: { name: 'Kitchen', icon: '🍳' },
    library: { name: 'Library', icon: '📚' },
    attic: { name: 'Attic', icon: '🕸️' },
    ballroom: { name: 'Ballroom', icon: '🎈' },
};

export const ITEMS = {
    card: { name: 'Blank card', desc: 'A cream-colored card. Blank, a little dusty, very invitation-shaped.' },
    candles: { name: 'Birthday candles', desc: 'A box of tiny rainbow candles, kid-sized and never used.' },
    brass_key: { name: 'Brass key', desc: 'A little key with a flower-shaped handle.' },
    broom: { name: 'Broom', desc: 'Long, bristly and handy for reaching things.' },
    quill: { name: 'Quill pen', desc: 'A feather pen. It needs ink.' },
    ink: { name: 'Bottle of ink', desc: 'Midnight-blue ink, still wet after a hundred years. Spooky.' },
    inked_quill: { name: 'Inked quill', desc: 'A quill dripping with ink. Ready to write.' },
    invitation: { name: 'Party invitation', desc: '"You are invited to Winnie\'s birthday party! Bring a friend. Bring all your friends."' },
    winding_key: { name: 'Winding key', desc: 'A tiny silver key with a crank. It must wind something.' },
    trunk_key: { name: 'Star key', desc: 'A key with a star-shaped bow.' },
    music_box: { name: 'Music box', desc: 'It plays Winnie\'s lullaby when wound. A birthday needs music.' },
    streamers: { name: 'Party streamers', desc: 'Rolls of paper streamers and a bundle of balloons, faded but cheerful.' },
    cake_mix: { name: 'Cake mix', desc: 'A tin of vanilla cake mix. The label says "Just add oven".' },
    frosting: { name: 'Jar of frosting', desc: 'Pink frosting. Somehow it has not gone off.' },
    plain_cake: { name: 'Plain cake', desc: 'A golden, wobbly, plain little cake. It needs something sweet on top.' },
    frosted_cake: { name: 'Frosted cake', desc: 'Pink and swirly. Something is missing on top.' },
    birthday_cake: { name: 'Birthday cake', desc: 'Frosted, with rainbow candles. The best cake in the house, and the only one.' },
};

/** Two items that combine in the pack. Order does not matter. */
export const RECIPES = [
    { a: 'ink', b: 'quill', out: 'inked_quill', say: [['June', 'Dip, dip, dribble. Now it\'s a proper pen!']] },
    { a: 'inked_quill', b: 'card', out: 'invitation', say: [['Maya', 'I wrote it in my best handwriting.'], ['Dev', 'Add "snacks provided".'], ['Maya', 'Fine. "Snacks provided."']] },
    { a: 'frosting', b: 'plain_cake', out: 'frosted_cake', say: [['June', 'Swirl, swirl, swoosh. I\'m an artist.'], ['Dev', 'I\'m the taste tester.'], ['Theo', 'No you\'re not.']] },
    { a: 'frosted_cake', b: 'candles', out: 'birthday_cake', say: [['Theo', 'Seven candles... nine... okay, enough candles.'], ['Maya', 'It\'s perfect.']] },
];

export const NOTE_NAMES = ['rose', 'amber', 'mint', 'sky', 'violet'];

/** Five books on the library shelf. The seed decides which title sits where. */
export const BOOK_TITLES = ['Moonlit Riddles', 'The Cat Who Sneezed', 'Owl Almanac', 'Pumpkin Atlas', 'Spiders in Sweaters'];

export const ordinal = (n) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

/** Everything the journal can hold. kind: evidence (the case board uses it), diary, code, clue. */
export const CLUES = {
    cold: {
        kind: 'evidence', title: 'A cold spot', where: 'foyer',
        text: () => 'Theo\'s thermometer says it is 70 degrees everywhere except one spot under the chandelier, where it is 41. Drafts do not hold still like that.',
    },
    footprints: {
        kind: 'evidence', title: 'Tiny footprints', where: 'kitchen',
        text: () => 'Bare kid-sized footprints in spilled flour. They start in the middle of the room and stop in the middle of the room, as if whoever made them floated in and floated out.',
    },
    giggle: {
        kind: 'evidence', title: 'A giggle', where: 'parlor',
        text: () => 'The music box tinkled by itself, and Dev\'s phone recorded a very small giggle right after.',
    },
    diary1: {
        kind: 'evidence', title: 'A girl\'s diary', where: 'library',
        text: () => '"Oct 31. My birthday. I stood at the window all day. Nobody came. Mama says it was the storm. Maybe next year. Love, Winnie."',
    },
    mirror: {
        kind: 'evidence', title: 'Five in the mirror', where: 'attic',
        text: () => 'There were five of us in the attic mirror: four kids and one small, sheet-shaped friend, waving.',
    },
    portrait: {
        kind: 'code', title: 'The family portrait', where: 'foyer',
        text: (L) => `The brass plate under the portrait reads: "Winifred Hauntly, aged ${L.age}." Pantry code, first number: ${L.age}.`,
    },
    partyday: {
        kind: 'code', title: 'The kitchen calendar', where: 'kitchen',
        text: (L) => `One day on the October calendar is circled three times: "MY PARTY!!!" It is the ${ordinal(L.day)}. Pantry code, second number: ${L.day}.`,
    },
    guests: {
        kind: 'code', title: 'The guest list', where: 'parlor',
        text: (L) => `"Winnie's Birthday Party: ${L.guests} little guests invited." Every name is crossed out with the same note: "So sorry, the storm!" Pantry code, third number: ${L.guests}.`,
    },
    diary2: {
        kind: 'diary', title: 'Diary page: the cake', where: 'kitchen',
        text: () => '"Oct 30. Mama is baking my cake tomorrow and she locked the recipe in the pantry so I can\'t sneak a lick. The lock goes: how old I am, which day my party is, how many friends I invited. Easy peasy."',
    },
    rhyme: {
        kind: 'clue', title: 'The shelf rhyme', where: 'library',
        text: (L) => `"Pull ${L.bookTitles[L.bookOrder[0]]}, then ${L.bookTitles[L.bookOrder[1]]}, then ${L.bookTitles[L.bookOrder[2]]}, and the shelf will say hello."`,
    },
    lullaby: {
        kind: 'clue', title: 'Winnie\'s lullaby', where: 'attic',
        text: (L) => `Sheet music with crayon notes: ${L.melody.map((n) => `{{n:${n}}}${NOTE_NAMES[n]}`).join(', ')}. Mama's lullaby, in four notes.`,
    },
    diary3: {
        kind: 'diary', title: 'Diary page: after the party', where: 'attic',
        text: () => '"Oct 31, late. The party is over and nobody came, but I can\'t seem to go to bed. I think I\'ll stay and wait. Someone has to be here when friends finally come. I\'ll leave the doors open."',
    },
};

/** The case board. Each wrong guess is answered with the evidence that rules it out. */
export const SUSPECTS = {
    raccoon: {
        name: 'A raccoon in the walls', icon: '🦝',
        no: (G) => (G.clues.includes('footprints')
            ? ['Maya', 'A raccoon wouldn\'t leave bare kid-sized footprints. And it wouldn\'t giggle.']
            : ['Maya', 'Raccoons don\'t giggle. Or play music boxes. Or float.']),
    },
    pipes: {
        name: 'Drafty old pipes', icon: '🔧',
        no: (G) => (G.clues.includes('cold')
            ? ['Theo', 'Pipes don\'t make one 41-degree spot that stays put. I measured.']
            : ['Theo', 'Pipes don\'t giggle, Dev. Pipes also don\'t write diaries.']),
    },
    caretaker: {
        name: 'A prankster caretaker', icon: '🧹',
        no: () => ['June', 'Nobody has lived here for a hundred years. The caretaker would be... very, very old.'],
    },
    ghost: { name: 'A lonely ghost', icon: '👻' },
};

// ---------------------------------------------------------------- the party and the talk

/** Replies stay kind whichever choice is made: every line leads to the same warm ending. */
export const TALK = {
    meet: {
        lines: [
            ['', 'The music box starts to play. Every candle on the cake lights itself. And in the middle of the dance floor, a small glowing shape in a bedsheet appears, hugging her elbows.'],
            ['Winnie', '...Hello. Are you real? Are you really here for my party?'],
        ],
        choices: [
            { id: 'warm', text: 'Happy birthday, Winnie! We made you a cake.', who: 'Maya', reply: [['Winnie', 'A cake! With candles! Nobody ever... I mean... thank you.']] },
            { id: 'funny', text: 'Hi! We\'re the sleepover. Dev brought snacks.', who: 'Dev', reply: [['Winnie', 'Snacks! I haven\'t had a snack in a hundred and thirty years!'], ['Dev', 'Then you are going to love the gummy bear I found in the sofa.']] },
            { id: 'brave', text: 'Sorry we woke the house up. We were scared, but we\'re not now.', who: 'Theo', reply: [['Winnie', 'I\'m sorry I was so noisy. I only wanted someone to come and see me.']] },
        ],
        next: 'ask',
    },
    ask: {
        lines: [['Winnie', 'It\'s just... I\'ve been waiting such a long time. Would you... would you stay a little while?']],
        choices: [
            { id: 'warm', text: 'We\'ll stay till sunrise. And come back every Halloween.', who: 'June', reply: [['Winnie', 'Every Halloween? I\'ll start planning the party now.']] },
            { id: 'funny', text: 'Stay? You\'re coming to the afterparty. In my backpack.', who: 'Dev', reply: [['Winnie', 'I fit in a backpack! I\'m very good at being small.'], ['Theo', 'Please don\'t put a ghost in your backpack, Dev.']] },
            { id: 'brave', text: 'We\'ll be your friends. Not just tonight.', who: 'Maya', reply: [['Winnie', 'Friends. I never got to say that word out loud to anyone.']] },
        ],
        next: 'wish',
    },
    wish: {
        lines: [
            ['Winnie', 'Wait, I have to blow out the candles. Everyone make a wish!'],
            ['', 'Winnie takes the biggest breath a ghost has ever taken. Every candle in the manor flares gold, and the old house hums like a happy cat.'],
        ],
        choices: [],
        end: true,
    },
};

export const EPILOGUE = {
    warm: 'The kids stay until the sun comes up, and Winnie stays too, and for the first time in a hundred and thirty years the manor smells like cake instead of dust. Every Halloween after that, there is a party at Hauntly Manor, and everybody comes.',
    funny: 'By sunrise Winnie has taught Dev to float (a little), taught Theo to laugh at the cold spot (a little), and eaten the gummy bear (all of it). Dev swears the backpack feels lighter and warmer on the walk home. Theo has stopped checking.',
    brave: 'When the sun comes up, the front door finally swings open. Winnie waves from the porch, a small glow in a bedsheet, and for the first time she isn\'t waiting for anybody. Her friends walk out into the morning, and they know exactly where to come back.',
};
