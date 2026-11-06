// The story: the prologue, seven days of clients, the Second Prince's night visits, the grand reading and the
// endings. Pure data (no functions of state), so a test can read all of it.
//
// A line is { w, t, m }: w = who speaks ('c' the person across the table, 'y' you, 'n' narration, 'o' Madame
// Orla's journal), t = the text, m = the speaker's mood ('n' neutral, 'h' happy, 's' sad, 'w' worried, 'a' stern,
// 'l' tender, 'x' startled).

export const L = (w, t, m = 'n') => ({ w, t, m });

export const KINGDOM = { land: 'Verelan', village: 'Hollowmere', king: 'King Osric', first: 'Prince Aldric', second: 'Prince Caspian', fair: 'the Harvest Moon Fair' };

export const PROLOGUE = [
    L('n', 'The Hollowmere road ends where the fields begin, and at its end stands a wagon the colour of a plum at dusk.'),
    L('n', 'Madame Orla Vesper read fortunes from it for forty years. Last spring she took the sea road and left you the wagon, the deck, the crystal ball — and a journal.'),
    L('o', 'Dear one. The cards do not tell the future. The universe whispers it, and the cards are how we answer. Watch the ball. Heed the room. Trust your hands.', 'l'),
    L('o', 'A vision shows its matter by its SYMBOL and its tone by its COLOUR. Lay three cards to answer it: upright for a boon, reversed for a bane. I have written down what I know. The rest, you must learn.', 'l'),
    L('n', 'You smooth the tablecloth, light the candles, and wait. Outside, steps on gravel. The first knock of the morning.'),
];

export const DAY_NAMES = [
    '', 'The Wagon Opens', 'The Hooded Stranger', 'Letters and Songs', 'The Captain’s Rota',
    'A Purse of Silver', 'The Veiled Lady', 'The Harvest Moon Fair',
];

// Who comes on which day, in order. A string starting with '*' is a villager made from the day’s seed.
export const DAYS = [
    null,
    ['marta', 'pip', 'elias1'],
    ['mirabel1', '*', 'stranger'],
    ['oswin', 'wren1', '*'],
    ['hester', 'elias2', '*'],
    ['bram', 'wren2', '*'],
    ['mirabel2', 'seraphine', '*'],
    ['*', '*'],
];

// Difficulty of the villagers by day: how many visions are clouded, and how kindly the dice fall.
export const VILLAGER_BY_DAY = [null, { clouded: 0 }, { clouded: 1 }, { clouded: 1 }, { clouded: 1 }, { clouded: 1 }, { clouded: 2 }, { clouded: 2 }];

const B = (theme, tone) => ({ theme, tone });

export const CLIENTS = {
    // ------------------------------------------------------------------ day 1: only what Orla taught you
    marta: {
        name: 'Granny Marta', role: 'the miller’s widow', day: 1, known: true, likes: 'kind',
        look: { skin: '#e8c3a0', hair: '#cfcfd6', hs: 'bun', hat: 'kerchief', hatc: '#c94a5a', robe: '#6a3a7a', trim: '#e8c14a', body: 'small', wrinkles: true },
        concern: 'family', beats: [B('loss', 'bane'), B('family', 'boon'), B('hope', 'boon')], syms: ['tear', 'house', 'star'], clouded: 0,
        talk: [
            L('c', 'Oh! A new face on Orla’s step. She said she’d send someone kind. Are you kind, dear?', 'h'),
            L('c', 'My Tom has been gone two winters. The mill is quiet. But my grandson writes that he is coming home for the Harvest Moon Fair, and I don’t know whether to light the hearth or keep the door shut.', 's'),
            L('c', 'Be gentle with an old woman. I’ve had my fill of sharp news.', 'w'),
            L('o', 'Journal, first page: Begin with the ball. Let it show you three things — what was, what is, what comes. Then lay your cards in that order.', 'l'),
        ],
        after: {
            3: [L('c', 'Tom’s long shadow, the house full again, the light after — you saw all of it. Orla chose well.', 'h')],
            2: [L('c', 'Yes… yes, that rings true, most of it. I’ll light the hearth.', 'h')],
            1: [L('c', 'Some of that I know, some I don’t. I’ll think on it over tea.', 'n')],
            0: [L('c', 'That doesn’t sound like my house at all, dear. Never mind. Everyone starts somewhere.', 'w')],
        },
    },
    pip: {
        name: 'Pip Dunmore', role: 'a shepherd’s boy', day: 1, known: true, likes: 'bold',
        look: { skin: '#d7a47a', hair: '#8a4a24', hs: 'curly', hat: 'cap', hatc: '#4a7a3a', robe: '#5a7a3a', trim: '#d9b25a', body: 'small' },
        concern: 'journey', beats: [B('change', 'boon'), B('journey', 'boon'), B('danger', 'bane')], syms: ['hourglass', 'ship', 'bolt'], clouded: 0,
        talk: [
            L('c', 'Is it true you can see the future? Properly? With a glass ball and everything?', 'x'),
            L('c', 'I’m going to sail to the capital and be a knight. Or a pirate. Both, maybe. I just need someone to say it’ll happen.', 'h'),
            L('c', 'Make it a good one! Make it exciting!', 'h'),
        ],
        after: {
            3: [L('c', 'A STORM?! And I live?! Brilliant! Wait till I tell the sheep.', 'h')],
            2: [L('c', 'Ooh. Mostly good, mostly. I’ll pack a coat.', 'h')],
            1: [L('c', 'Hm. Less sailing than I’d hoped.', 'n')],
            0: [L('c', 'There wasn’t any ship at all, was there. Still. Good ball.', 'w')],
        },
    },
    elias1: {
        name: 'Elias Thorne', role: 'the blacksmith', day: 1, known: true, likes: 'truth', aff: 'elias',
        look: { skin: '#c68a62', hair: '#2a1c14', hs: 'short', hat: null, robe: '#8a3a1c', trim: '#e0a040', body: 'broad', beard: true },
        concern: 'love', beats: [B('family', 'bane'), B('love', 'boon'), B('wealth', 'boon')], syms: ['house', 'heart', 'coin'], clouded: 0,
        talk: [
            L('n', 'He has to duck under the doorframe, and he does it as if he has apologised to it before.'),
            L('c', 'Elias Thorne. I do the iron at the east end. I’m not… I don’t usually do this sort of thing.', 'w'),
            L('c', 'There’s a person. I won’t say who. I want to know if I’m wasting my breath. Just say it straight. I can take it.', 'a'),
        ],
        after: {
            3: [L('c', 'Straight and true. Hm. Thank you.', 'h'), L('n', 'He nods once, hard, the way a man nods who’s been given something he doesn’t know where to put.')],
            2: [L('c', 'More hope in that than I expected.', 'h')],
            1: [L('c', 'I can’t tell if that was a yes or a no.', 'w')],
            0: [L('c', 'Right. Well. The forge doesn’t lie, at least.', 'a')],
        },
    },

    // ------------------------------------------------------------------ day 2
    mirabel1: {
        name: 'Mirabel Fenn', role: 'the apothecary', day: 2, likes: 'truth', aff: 'mirabel', clue: 'ledger',
        look: { skin: '#f0cfa8', hair: '#6a2a2a', hs: 'long', hat: null, robe: '#2c7a5a', trim: '#d9d27a', body: 'slim', glasses: true },
        concern: 'health', beats: [B('family', 'boon'), B('health', 'bane'), B('danger', 'bane')], syms: ['tree', 'leaf', 'flame'], clouded: [2],
        talk: [
            L('c', 'I should say that I think this is nonsense. Charming nonsense. But I’ve a problem I can’t weigh or measure, and I’m running out of scales.', 'n'),
            L('c', 'Mirabel Fenn — the apothecary. Someone bought far too much nightshade from my stores, three vials, and paid in bright new silver. Palace silver, from the mint. I don’t sell nightshade to anyone for no reason.', 'w'),
            L('c', 'Tell me what’s wrong with my herbs, my shop, my… whatever it is. And no flattery. I can tell.', 'a'),
            L('o', 'Journal: Some visions come clouded. Do not despair. The room itself speaks — watch for an OMEN — and the client’s own worry is a thread you can pull. Or spend a Focus to clear the glass.', 'l'),
        ],
        after: {
            3: [L('c', 'Nightshade. Palace silver. A danger still coming… I wrote the buyer’s details in my ledger. Take a look.', 'a'), L('n', 'She turns the ledger toward you. The vials were bought in the name of a physician who has been dead a year.')],
            2: [L('c', 'You see more than I expected. I’ll check the ledger again.', 'n')],
            1: [L('c', 'Some of that is useful. Most of it I’ll have to test.', 'n')],
            0: [L('c', 'Hm. I’ll stick to scales. Nothing personal.', 'n')],
        },
    },
    stranger: {
        name: 'The Hooded Stranger', role: 'a visitor after dark', day: 2, likes: 'truth', alias: true,
        look: { skin: '#e2b894', hair: '#241812', hs: 'hood', hat: 'hood', hatc: '#2a2a3a', robe: '#2a2a3a', trim: '#8a8aa8', body: 'tall' },
        concern: 'betrayal', beats: [B('family', 'boon'), B('betrayal', 'bane'), B('change', 'boon')], syms: ['tree', 'mask', 'moth'], clouded: [1],
        talk: [
            L('n', 'The last light is going when the knock comes — a quiet one. A tall figure in a travelling cloak, hood drawn low. Good boots. Too good.'),
            L('c', 'I’ll pay double if you don’t ask my name.', 'a'),
            L('c', 'One question. Can a man trust his own blood?', 'w'),
            L('c', 'Don’t soften it. I have been softened to for twenty-four years.', 'a'),
        ],
        after: {
            3: [L('c', 'A false face in a warm house. And change after. You are better than the village knows.', 'x'), L('n', 'His hand tightens on the table, then relaxes. He lays a gold crown beside the ball and, for a moment, forgets to hide his face.')],
            2: [L('c', 'Close. Closer than is comfortable.', 'a')],
            1: [L('c', 'Partly. Partly. I shall have to hear more of you.', 'n')],
            0: [L('c', 'No. Not that. But thank you for the effort.', 'w')],
        },
    },

    // ------------------------------------------------------------------ day 3
    oswin: {
        name: 'Oswin Pike', role: 'a royal courier', day: 3, likes: 'kind', clue: 'orders',
        look: { skin: '#dba783', hair: '#5a3a1a', hs: 'short', hat: 'cap', hatc: '#3a4a8a', robe: '#3a4a8a', trim: '#e8c14a', body: 'slim' },
        concern: 'secret', beats: [B('journey', 'boon'), B('secret', 'bane'), B('betrayal', 'bane')], syms: ['compass', 'eye', 'mask'], clouded: [2],
        talk: [
            L('c', 'I ride letters for the palace. That’s all I do. I ride them and I don’t read them.', 'w'),
            L('c', 'But the last ones… the wax was wrong. Prince Aldric’s ring, but pressed twice. And I was told to give them to a man from Varn, not to the Chancellor.', 'w'),
            L('c', 'I’ve a wife. I’ve a boy. Tell me I haven’t done something terrible. Please. Kindly.', 's'),
        ],
        after: {
            3: [L('c', 'Then it was what I feared. Orders passed in secret. Letters to the Envoy of Varn. Prince Aldric gives commands the King never sees.', 'w'), L('n', 'He wrings his cap. Whatever it cost him to say it, he looks lighter for it.')],
            2: [L('c', 'You’ve put a name to my fear. Thank you.', 'w')],
            1: [L('c', 'I’m none the wiser, but I feel braver.', 'n')],
            0: [L('c', 'I’m sorry. I thought you’d know.', 's')],
        },
    },
    wren1: {
        name: 'Wren Quill', role: 'a wandering minstrel', day: 3, likes: 'bold', aff: 'wren',
        look: { skin: '#e8c8a8', hair: '#3a8aa8', hs: 'long', hat: 'wide', hatc: '#c04ac0', robe: '#7a2a9a', trim: '#7ff0e0', body: 'slim', feather: true },
        concern: 'change', beats: [B('journey', 'bane'), B('change', 'boon'), B('love', 'boon')], syms: ['compass', 'moth', 'rings'], clouded: 0,
        talk: [
            L('n', 'A lute case, a hat with a feather the colour of a peacock’s opinion, and a smile that arrives a moment before the person.'),
            L('c', 'Wren Quill, at your service — they/them, minstrel, liar by trade and sometimes by accident. I heard you’re the new seer. I’ve never been read by a new seer. They haven’t learned to be boring yet.', 'h'),
            L('c', 'Where am I going? I always know where I’m going. It’s where I’ll be that’s a mystery. Impress me.', 'h'),
        ],
        after: {
            3: [L('c', 'Oh, that’s a good one. I’m going to steal it for a song.', 'h')],
            2: [L('c', 'Ha! You’ve got the shape of me, anyway. Rare.', 'h')],
            1: [L('c', 'Fair. A bit off the beat.', 'n')],
            0: [L('c', 'Well. You are a poor liar. I like that in a person.', 'n')],
        },
    },

    // ------------------------------------------------------------------ day 4
    hester: {
        name: 'Captain Hester Crowe', role: 'captain of the King’s Guard', day: 4, likes: 'truth', clue: 'rota',
        look: { skin: '#b8815c', hair: '#1a1a22', hs: 'bun', hat: 'helm', hatc: '#9aa4b8', robe: '#3a4a6a', trim: '#c8d0e0', body: 'broad', scar: true },
        concern: 'change', beats: [B('ambition', 'boon'), B('change', 'bane'), B('danger', 'bane')], syms: ['peak', 'moth', 'bolt'], clouded: [1],
        talk: [
            L('n', 'She doesn’t knock. She stands in the doorway until she has counted the exits, and only then sits.'),
            L('c', 'I command the King’s Guard. Twenty-two years. I came off the road to ask a fortune-teller what I could have asked a priest, if I trusted priests.', 'a'),
            L('c', 'My rota keeps changing. Orders arrive under the First Prince’s seal. My best swords sent to the border, strangers set to the watch on the night of the Fair. I’m told it’s routine. It isn’t.', 'a'),
            L('c', 'Straight, please. I’ll hear it better.', 'a'),
        ],
        after: {
            3: [L('c', 'The watch is hollowed out for the Fair night. Strangers at the King’s door. I thought as much.', 'a'), L('n', 'She presses two fingers to her brow, a salute to herself, and stands taller than when she came.')],
            2: [L('c', 'Enough to act on. Thank you.', 'a')],
            1: [L('c', 'A little. I’ll keep my own counsel.', 'n')],
            0: [L('c', 'Hm. I’ll trust my sword arm instead.', 'n')],
        },
    },
    elias2: {
        name: 'Elias Thorne', role: 'the blacksmith', day: 4, likes: 'truth', aff: 'elias',
        look: { skin: '#c68a62', hair: '#2a1c14', hs: 'short', hat: null, robe: '#8a3a1c', trim: '#e0a040', body: 'broad', beard: true },
        concern: 'ambition', beats: [B('family', 'boon'), B('ambition', 'boon'), B('danger', 'bane')], syms: ['tree', 'peak', 'bolt'], clouded: 0,
        talk: [
            L('c', 'Back again. I know. You must think I’m a nuisance.', 'w'),
            L('c', 'The palace has sent me a commission. Big one. I want it. I’m afraid of wanting it.', 'w'),
            L('c', 'Same terms as before. No sugar.', 'n'),
        ],
        after: {
            3: [L('c', 'Hm. You’ve got me read like a good blade — every fold.', 'h')],
            2: [L('c', 'That’ll do. That’ll do nicely.', 'h')],
            1: [L('c', 'Partly. I’ll sleep on the rest.', 'n')],
            0: [L('c', 'Not your best, then. It happens to smiths too.', 'n')],
        },
    },

    // ------------------------------------------------------------------ day 5
    bram: {
        name: 'Bram Ottley', role: 'the King’s cupbearer', day: 5, likes: 'kind', clue: 'cupbearer',
        look: { skin: '#f0d0b0', hair: '#c8a050', hs: 'short', hat: null, robe: '#7a1a3a', trim: '#e8c14a', body: 'slim', sweat: true },
        concern: 'wealth', beats: [B('family', 'bane'), B('wealth', 'bane'), B('danger', 'bane')], syms: ['tree', 'gem', 'bolt'], clouded: [2],
        talk: [
            L('c', 'I pour the King’s wine. I’ve poured it nine years. Never spilled a drop.', 'w'),
            L('c', 'My sister is ill and we owe the physician forty crowns. And then… then a woman in a veil came to me with a purse. Very heavy. Just to carry a small flask into the cellar. She said it was a gift for the King’s health.', 'w'),
            L('c', 'I haven’t done it. Yet. Please, be gentle. I am a good man, I think. I am trying to be.', 's'),
        ],
        after: {
            3: [L('c', 'A flask for the King’s cup… that’s what it was. I have been a fool. I’ll go to the Captain — tonight.', 'x'), L('n', 'His whole body loosens, like a man who has put down a stone he has carried up a mountain.')],
            2: [L('c', 'I… see it now. I’m afraid, but I see it.', 'w')],
            1: [L('c', 'It helps, a little. I’m still frightened.', 's')],
            0: [L('c', 'I don’t know what to do. I came for answers.', 's')],
        },
    },
    wren2: {
        name: 'Wren Quill', role: 'a wandering minstrel', day: 5, likes: 'bold', aff: 'wren',
        look: { skin: '#e8c8a8', hair: '#3a8aa8', hs: 'long', hat: 'wide', hatc: '#c04ac0', robe: '#7a2a9a', trim: '#7ff0e0', body: 'slim', feather: true },
        concern: 'hope', beats: [B('secret', 'bane'), B('hope', 'boon'), B('journey', 'boon')], syms: ['eye', 'rainbow', 'ship'], clouded: [0],
        talk: [
            L('c', 'Back again! Don’t read anything into it. I was in the neighbourhood. For three days.', 'h'),
            L('c', 'I’ve a tune that won’t finish. It stops in the middle of every verse. I’m told that’s a sign.', 'w'),
            L('c', 'Give me a reading with some drama in it. Slow, then fast. Like a good bridge.', 'h'),
        ],
        after: {
            3: [L('c', 'There it is. The last line. I can hear it.', 'h')],
            2: [L('c', 'Good. A little off the beat, but I’ll take that on a Tuesday.', 'h')],
            1: [L('c', 'Hm. The verse stays unfinished, then.', 'n')],
            0: [L('c', 'Ha. Not a note of it. Remarkable, honestly.', 'h')],
        },
    },

    // ------------------------------------------------------------------ day 6
    mirabel2: {
        name: 'Mirabel Fenn', role: 'the apothecary', day: 6, likes: 'truth', aff: 'mirabel',
        look: { skin: '#f0cfa8', hair: '#6a2a2a', hs: 'long', hat: null, robe: '#2c7a5a', trim: '#d9d27a', body: 'slim', glasses: true },
        concern: 'loss', beats: [B('health', 'boon'), B('loss', 'boon'), B('love', 'boon')], syms: ['staff', 'wilt', 'rings'], clouded: [1],
        talk: [
            L('c', 'I came back to say I was rude. And to ask one more thing, that I’d rather not ask a scale.', 'n'),
            L('c', 'My teacher, old Hargreave… he died the winter I came here. I never found out whether he suffered. It’s ridiculous. A grown woman and a ghost.', 's'),
            L('c', 'Truth, please. I’d rather have it straight and ugly than a kindness.', 'a'),
        ],
        after: {
            3: [L('c', 'It was peaceful, and I mourn him by mending. And something warm comes after. I… thank you.', 'l')],
            2: [L('c', 'That’s more than I hoped for. It helps.', 'l')],
            1: [L('c', 'Half a comfort. I’ll take half.', 'n')],
            0: [L('c', 'Hm. Perhaps I shouldn’t ask a deck to carry a grief.', 's')],
        },
    },
    seraphine: {
        name: 'Lady Seraphine Vane', role: 'a veiled noblewoman', day: 6, likes: 'bold', clue: 'envoy',
        look: { skin: '#f4d8c4', hair: '#101018', hs: 'long', hat: 'veil', hatc: '#4a1a5a', robe: '#4a1a5a', trim: '#ff7ab8', body: 'tall' },
        concern: 'ambition', beats: [B('ambition', 'boon'), B('secret', 'bane'), B('betrayal', 'bane')], syms: ['crown', 'key', 'dagger'], clouded: [1, 2],
        talk: [
            L('n', 'A carriage you could hear coming a mile off. A woman steps down in a veil like spilled ink, and sits as if the chair has already been bought.'),
            L('c', 'I serve a great man. A man who will be greater. I should like to know if the road to it is clear.', 'a'),
            L('c', 'Dazzle me, little seer. I have been bored by oracles for years.', 'h'),
            L('n', 'Her veil does not move when she speaks. Her eyes, behind it, never leave the ball.'),
        ],
        after: {
            3: [L('c', 'You see… a great deal.', 'x'), L('n', 'She stands too quickly. For one heartbeat the veil slips, and you glimpse a bruise of lamplight in her eyes. “The Envoy will not be pleased,” she mutters, to nobody. And is gone.')],
            2: [L('c', 'Ah. You are better than the others. Careful that it does not become a habit.', 'a')],
            1: [L('c', 'Pretty. Pretty and not very true.', 'n')],
            0: [L('c', 'You have wasted a fine carriage ride.', 'n')],
        },
    },
};

// What each clue says, in your journal.
export const CLUE_TEXT = {
    ledger:    { name: 'The Nightshade Ledger', text: 'Three vials of nightshade, bought in a dead man’s name and paid in palace silver.' },
    orders:    { name: 'Secret Orders',         text: 'Prince Aldric gives commands the King never sees: sealed letters to the Envoy of Varn, steel without a guild mark.' },
    rota:      { name: 'The Hollow Watch',      text: 'The King’s Guard has been stripped for the Fair night; strangers will stand at the King’s door.' },
    cupbearer: { name: 'The Cupbearer’s Purse', text: 'A veiled woman paid the cupbearer to carry a flask into the cellar — for the King’s cup.' },
    envoy:     { name: 'The Envoy’s Gold',  text: 'The Envoy of Varn pays Lady Vane, who serves Prince Aldric. The poison is for the Fair’s toast.' },
};

// ----------------------------------------------------------------------------------- the Second Prince
export const PRINCE = {
    name: 'Prince Caspian',
    look: { skin: '#e2b894', hair: '#241812', hs: 'short', hat: 'circlet', hatc: '#e8c14a', robe: '#2a2a5a', trim: '#e8c14a', body: 'tall' },
    n2: {
        title: 'After Dark',
        lines: [
            L('n', 'Past midnight. You have almost fallen asleep over the journal when the wagon door opens without a knock. The hooded stranger. He pushes back the hood.'),
            L('c', 'I lied about my name. I am Caspian — second son of King Osric. I came as a stranger because a prince cannot ask honest questions by daylight.', 'a'),
            L('c', 'My father is wasting. The physicians call it a fever; I call it a slow hand. My brother Aldric will be King, and Aldric has been very kind to everyone, lately.', 's'),
            L('c', 'You read me true tonight. Will you help me find who stands behind my brother’s smile?', 'w'),
        ],
        choices: [
            { t: 'I will read for you, and I will look at the room as well as the ball.', tr: 2, r: [L('c', 'Then you are a better ally than half my court.', 'l')] },
            { t: 'Why would a prince trust a village fortune-teller?', tr: 1, r: [L('c', 'Because no one in the palace would dare tell me the truth. You just did.', 'n')] },
            { t: 'What do I get for it?', tr: 0, r: [L('c', 'A seer’s wage, and, if I live, a wagon with a royal warrant. Does that satisfy you?', 'a')] },
        ],
        end: [L('c', 'The Harvest Moon Fair is in five days. The King will drink the Toast before the whole court. If it is to happen, it will happen then. Watch the village, seer. Everything touches everything.', 'a'), L('n', 'He pulls up his hood and is gone into the dark between the lanterns.')],
    },
    n4: {
        title: 'The Second Night',
        lines: [
            L('n', 'He comes again, in the small hours, with mud on his good boots and no one with him.'),
            L('c', 'My father could not stand this morning. Aldric held his arm and called it brotherly tenderness.', 's'),
            L('c', '{clues}', 'w'),
            L('c', 'I do not know how to be a good son and a brave prince at once. Tell me something true, seer.', 'w'),
        ],
        choices: [
            { t: 'Courage is just fear that keeps walking. Walk, Caspian.', tr: 2, r: [L('c', 'That is… yes. That is more use than a regiment.', 'l')] },
            { t: 'Fear is wise. It keeps you alive until the Fair.', tr: 1, r: [L('c', 'Cautious comfort. I shall take it.', 'n')] },
            { t: 'You should leave the country while you can.', tr: -1, r: [L('c', 'And leave my father to the cup? No. Never ask me that again.', 'a')] },
        ],
        end: [L('c', 'Whatever you learn, tell me. And, seer — thank you for being someone who does not flinch at a crown.', 'l')],
    },
    n6: {
        title: 'The Last Night Before',
        lines: [
            L('n', 'The night before the Fair the whole village hums like a struck bell. At the edge of it, he waits by the wagon steps, no hood at all.'),
            L('c', 'Aldric knows someone is asking questions. He has put guards on every road. Mine, mostly.', 'a'),
            L('c', '{clues}', 'w'),
            L('c', 'Tomorrow, at dusk, after the Toast is set, come to me for one last reading. The biggest of your life. Will you?', 'w'),
        ],
        choices: [
            { t: 'I’ll be there. Whatever the ball shows.', tr: 2, r: [L('c', 'Then I fear nothing from the sky, at least.', 'l')] },
            { t: 'I’ll read it. I can’t promise you the answer you want.', tr: 1, r: [L('c', 'It is the answer I need that matters.', 'n')] },
            { t: 'Reading for princes is dangerous. I’ll think about it.', tr: -1, r: [L('c', 'Then think quickly. We all have.', 'w')] },
        ],
        end: [L('n', 'He touches the wagon’s painted wheel as if for luck, and goes.')],
    },
};

// Caspian's mood about your progress, in his words ({clues} above).
export function clueSummary(n) {
    if (n <= 0) return 'I have nothing but a feeling, and a prince cannot arrest a feeling.';
    if (n === 1) return 'One thread, now. One. And it leads to a dark room I cannot yet see into.';
    if (n === 2) return 'Two threads. It is a cloth that begins to look like a net.';
    if (n === 3) return 'Three threads — I can feel the weave of it. Aldric is deeper in than I feared.';
    if (n === 4) return 'Four threads, and they all run to my brother. Almost, almost enough to hang a crown on.';
    return 'Every thread leads to him. We have it — almost all of it. The only thing missing is the hour.';
}

// ----------------------------------------------------------------------------------- the grand reading
export const GRAND = {
    name: 'Prince Caspian', role: 'the Second Prince', likes: 'truth',
    look: PRINCE.look,
    concern: 'secret',
    beats: [B('betrayal', 'bane'), B('secret', 'bane'), B('hope', 'boon')],
    syms: ['mask', 'eye', 'star'],
    pre: [
        L('n', 'Dusk on the day of the Fair. Lanterns are going up along the lane and somewhere a fiddle is warming. In the wagon, the prince sits across from you with his circlet in his hands.'),
        L('c', 'Everything you have found is in the ball tonight, or it is not. Read me the Toast, seer. Past, present, future. Speak plain.', 'a'),
    ],
    after: {
        3: [L('c', 'The mask, the cup, the dawn after. You have given me the hour.', 'x')],
        2: [L('c', 'Enough. Enough to act on, and act we shall.', 'a')],
        1: [L('c', 'I… half of it. I shall have to trust my instincts, and Captain Crowe.', 'w')],
        0: [L('c', 'I see. I shall have to guess.', 's')],
    },
};

// ----------------------------------------------------------------------------------- endings
// plotScore = clues (0–5) + the grand reading’s stars (0–3).
export const ENDINGS = [
    {
        id: 'oracle', min: 7, title: 'The Crown’s Oracle',
        text: [
            'At the Toast, Captain Crowe’s loyal guards stand where you said they must, and the cupbearer who came to you hands Prince Caspian the flask, still sealed. When King Osric lifts his cup, the court hears Aldric’s own letters read aloud.',
            'The First Prince is taken in chains before the lanterns. The King lives, thinner and humbler, and calls Caspian to his side before the whole court.',
            'A month later a royal warrant is painted on the wheel of a plum-coloured wagon: SEER TO THE CROWN. You keep the ball by the window and the journal on your knee. Orla would have laughed to see it.',
        ],
    },
    {
        id: 'quiet', min: 5, title: 'A Quiet Victory',
        text: [
            'You do not know every thread, but you know enough. At the Toast, Caspian is already at his father’s elbow. The flask is found in the cellar, and Lady Vane is stopped at the gate.',
            'Aldric does not hang. He rides out at dawn “for his health” and does not return. The King lives. The court whispers. The village forgets, as villages do, and goes on loving its Fair.',
            'Caspian visits the wagon twice a year, always in a plain cloak, always to ask a question he already knows the answer to.',
        ],
    },
    {
        id: 'narrow', min: 3, title: 'A Near Thing',
        text: [
            'You see enough to save the King’s life, and not enough to save his peace. At the Toast Caspian knocks the cup from his father’s hand; wine and glass go across the floor and every eye in the hall.',
            'Aldric calls it clumsiness. Caspian is wounded in the scuffle that follows, and the crowd at the Fair never knows how near it came.',
            'The King lives. The plot lives too, waiting. You pack the wagon by lantern-light, and the ball, wrapped in silk, hums softly all night.',
        ],
    },
    {
        id: 'black', min: 0, title: 'The Black Feast',
        text: [
            'The threads were too thin. At the Toast, King Osric lifts his cup, and the court cheers, and the Fair goes on with its fiddles and lanterns while a King dies at the high table.',
            'Aldric is crowned before the next full moon. Caspian vanishes from the palace in the night; some say a plum-coloured wagon crossed the border the same morning.',
            'The deck is yours still. You shuffle it on the road, and the cards, one by one, begin to tell you what you could not hear in time.',
        ],
    },
];
export function endingFor(score) { return ENDINGS.find((e) => score >= e.min); }

// What the festival looks like with each partner. {name} is theirs.
export const FESTIVAL_NONE = [
    L('n', 'You watch the fireworks from the top step of the wagon, alone, and not unhappily. The first gold chrysanthemum blooms over the lane and a hundred faces tilt up at once.'),
    L('n', 'You are a seer. You know you are not meant to read your own cards. Tonight, you do not need to.'),
];

// ----------------------------------------------------------------------------------- villagers
export const VILLAGER_NAMES = ['Tilda', 'Hob', 'Corwin', 'Maude', 'Bryn', 'Edda', 'Jory', 'Lisbet', 'Fenwick', 'Agnes', 'Rufus', 'Sorrel', 'Dilys', 'Garrick', 'Posy', 'Ned', 'Cecily', 'Moss', 'Ivo', 'Winnie'];
export const VILLAGER_SURNAMES = ['Cobb', 'Marsh', 'Fletcher', 'Thatcher', 'Wick', 'Barrow', 'Hale', 'Dunn', 'Tanner', 'Pell', 'Rook', 'Sedge'];
export const VILLAGER_ROLES = ['the cooper', 'a weaver', 'the ferryman', 'a farrier’s wife', 'the miller’s son', 'a beekeeper', 'the innkeeper', 'a goose-girl', 'the cobbler', 'a tinker', 'the baker', 'a reeve’s clerk'];

// What a villager says about the thing that is on their mind. Two per theme.
export const OPENERS = {
    love:     ['There is someone. I think. I keep walking past their door and not knocking.', 'My heart has been loud lately, and I can’t tell if it’s hope or foolishness.'],
    loss:     ['It has been a year since I lost her, and the days still feel borrowed.', 'Something ended, and no one will say it to my face.'],
    wealth:   ['The harvest was thin and the rent is not. Tell me there is coin somewhere.', 'I’ve a chance to buy a share in a mill. Is it luck, or a trap with a bow on it?'],
    betrayal: ['Someone has been telling tales about me in the market.', 'A friend of twenty years has stopped meeting my eye. I want to know why.'],
    journey:  ['I’m thinking of leaving the village — or perhaps the road is thinking of me.', 'My brother sailed in spring. There has been no word since.'],
    health:   ['My cough will not leave, and the apothecary only shrugs.', 'I’m weary in a way that sleep does not mend.'],
    family:   ['My daughter and I haven’t spoken since the wedding.', 'The farm is to be split between my sons, and they’re sharpening their words.'],
    ambition: ['I’ve been offered the foremanship. I want it. I’m afraid of wanting it.', 'I mean to rise in this world. Does the world agree?'],
    secret:   ['There is a thing I haven’t told anyone, and it’s growing teeth.', 'Someone is hiding something from me, and I can feel the shape of it.'],
    danger:   ['I keep dreaming of fire at the mill.', 'There are strange men on the north road, and the dogs will not settle.'],
    change:   ['Everything is shifting under my feet, and I can’t tell if it’s the ground or me.', 'The shop is to be sold, the lease is up, and I’m meant to be glad.'],
    hope:     ['I’m not sure why I came. I just want to be told there’s light ahead.', 'I’ve had a long, dull winter of a year. Tell me it turns.'],
};
export const STYLE_ASK = {
    truth: ['And please, no sugar. Say it plain.', 'Don’t dress it up. I’d rather know.'],
    kind:  ['Be gentle with me, if you can. I’m brittle today.', 'Tell it softly, will you? I’ve had a hard week.'],
    bold:  ['Make it grand! I came for a bit of wonder.', 'Give me a show! I’ll pay in applause.'],
};
export const VILLAGER_AFTER = {
    3: ['That’s… exactly it. How could you possibly know?', 'You’ve read me like an open book. Thank you.'],
    2: ['Yes. Yes, that rings true — most of it.', 'More right than wrong. I’ll take that home.'],
    1: ['Hm. Some of that I recognise. Some I don’t.', 'Parts of it fit. I’ll mull the rest.'],
    0: ['That doesn’t sound like me at all. Perhaps the stars were busy.', 'Not a word of it fits. But it was a pretty show.'],
};
export const STYLE_REPLY = {
    match: { truth: 'You didn’t flinch. I like that.', kind: 'Thank you for being gentle with me.', bold: 'What a show! I’ll be telling everyone.' },
    miss:  { truth: 'I… would have liked it plainer.', kind: 'That was a touch sharp. But I’ll live.', bold: 'A little dry, perhaps. I hoped for sparkle.' },
};
