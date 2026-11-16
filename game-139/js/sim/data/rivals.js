// CLEAN SLATE — the visitors. Everyone you once crossed, all arriving at once, all with a grudge,
// most of them secretly hoping you'll offer them a job.
//
// layout:  { peaks, rows } — the rival's pyramid(s). Every rival card is covered by the two below it.
// faceUp:  how many bottom rows start face up (the rest turn over as they are uncovered).
// weights: rank weighting for their cards: 'flat', 'high' (10–K heavy), 'twins' (6s and 7s), 'low'.
// traits:  taint n (settling a tainted card hurts 2 unless you used a Hearth card), bounty n (+3 tips
//          each), warrant (every Blade you use costs 2 Resolve).
// intents: the round-by-round pattern, cycled. hit n · grudge n · lock n · muddle n · drain n ·
//          fluster (hand −1 next round) · restock n (cards come back on the bottom row).
// trust:   the most Blade cards you can use on them and still be offered a partnership.
// lines:   arrive · cleared (you won) · accept (they stay) · refuse (they saw the knife work) — the
//          arrive and accept lines are voiced (dev/audio/).
// art:     the portrait, for dev/art/prompts.mjs.

export const RIVALS = {
    // ================================================================ Act I — Soft Opening
    brannoc: {
        id: 'brannoc', name: 'Brannoc Vell', title: 'the Poisoner of Port Ash', act: 1,
        layout: { peaks: 1, rows: 5 }, faceUp: 2, weights: 'flat', traits: { taint: 3 },
        intents: [{ t: 'hit', n: 3 }, { t: 'hit', n: 4 }, { t: 'grudge', n: 1 }, { t: 'hit', n: 5 }],
        trust: 1, partner: 'p_brannoc', glyph: '☠', color: '#5d8a3a',
        letter: 'I hear you serve food now. I used to put things IN food. Professional curiosity. — B.',
        lines: {
            arrive: "Nightfall. Running a kitchen? Oh, this I have to taste. Relax — I only brought the good poisons.",
            cleared: "Hm. Not a single dead patron. I'm almost disappointed.",
            accept: "A cook. Me. Fine — but I'm doing the bitters my way. Nobody dies. Probably.",
            refuse: "Still reaching for the knife when the soup gets hot? I'll pass.",
        },
        voice: 'a raspy, theatrical middle-aged man, amused',
        art: 'Brannoc Vell, a gaunt middle-aged poisoner with a waxed black moustache, round green-tinted spectacles, a stained leather apron over a fine velvet waistcoat, holding a tiny corked vial and grinning',
    },
    quell: {
        id: 'quell', name: 'Sister Quell', title: 'the Silent Knife', act: 1,
        layout: { peaks: 1, rows: 5 }, faceUp: 1, weights: 'flat', traits: {},
        intents: [{ t: 'lock', n: 2 }, { t: 'hit', n: 4 }, { t: 'hit', n: 3 }, { t: 'lock', n: 1 }, { t: 'hit', n: 5 }],
        trust: 1, partner: 'p_quell', glyph: '✝', color: '#8a8fa6',
        letter: '( A blank page, folded once. On the back, very small: "a room, quiet, if you have one." )',
        lines: {
            arrive: "I took a vow of silence. I am breaking it to say: your door creaks. Fix it.",
            cleared: "...Acceptable.",
            accept: "I will mind the night desk. Nobody will hear me. That is rather the point.",
            refuse: "Your hands still speak louder than you do.",
        },
        voice: 'a calm, low, measured woman, dry',
        art: 'Sister Quell, a tall stern former nun assassin in a grey habit with a dark hood, sharp cheekbones, one finger raised to her lips, a thin knife hilt visible at her belt',
    },
    flint: {
        id: 'flint', name: 'Gideon Flint', title: 'the Bounty Hunter', act: 1,
        layout: { peaks: 1, rows: 5 }, faceUp: 2, weights: 'flat', traits: { bounty: 3 },
        intents: [{ t: 'hit', n: 4 }, { t: 'drain', n: 3 }, { t: 'hit', n: 5 }, { t: 'hit', n: 3 }],
        trust: 1, partner: 'p_flint', glyph: '✠', color: '#a8743a',
        letter: 'There is still a price on your head. It has gone DOWN. I find that insulting on your behalf. — G. Flint',
        lines: {
            arrive: "Your bounty's worth eleven silver now. Eleven. I'm here out of pity, mostly.",
            cleared: "Fine. Fine! The poster was out of date anyway.",
            accept: "I'll keep the books. Somebody in this place should know what things are worth.",
            refuse: "You still settle accounts the old way. I've seen how that ends.",
        },
        voice: 'a gravelly, weary cowboy-ish man, deadpan',
        art: 'Gideon Flint, a weathered bounty hunter with a wide-brimmed hat, grey stubble, a long duster coat, a ledger tucked under one arm and a stack of wanted posters in his hand',
    },
    marrow: {
        id: 'marrow', name: 'The Marrow Twins', title: 'Pell and Pim', act: 1,
        layout: { peaks: 1, rows: 5 }, faceUp: 2, weights: 'twins', traits: {},
        intents: [{ t: 'hit', n: 3 }, { t: 'hit', n: 3 }, { t: 'muddle', n: 2 }, { t: 'hit', n: 5 }],
        trust: 1, partner: 'p_marrow', glyph: '♊', color: '#b56a9a',
        letter: 'We are coming to kill you. Pell says that is rude. Pim says bring dessert. — The Marrows',
        lines: {
            arrive: "We're here to finish the job! — We were never hired for a job. — Then we're here for pie!",
            cleared: "You beat us both. — Technically you beat us once. — Twice, it was twice.",
            accept: "We'll wait tables! — Both of the tables. — We'll need more tables.",
            refuse: "Still scary. — Still very scary. — Let's go.",
        },
        voice: 'two bickering young siblings, quick and cheerful',
        art: 'the Marrow Twins, two identical young acrobat assassins in matching striped harlequin outfits, one grinning and one frowning, standing back to back, one holding a pie',
    },
    corvina: {
        id: 'corvina', name: 'Lady Corvina Ashgrove', title: 'the Critic', act: 1, boss: true,
        layout: { peaks: 1, rows: 6 }, faceUp: 2, weights: 'flat', traits: { taint: 2 },
        intents: [{ t: 'hit', n: 5 }, { t: 'grudge', n: 1 }, { t: 'hit', n: 6 }, { t: 'lock', n: 2 }, { t: 'hit', n: 7 }],
        trust: 1, partner: 'p_corvina', glyph: '★', color: '#c9a83c',
        letter: 'Fifteen years ago you were paid to kill me and did not. I have come to review your establishment. Prepare yourself. — C. A.',
        lines: {
            arrive: "You were hired to end me once. You didn't. Tonight I end your little inn — in print. Two stars. Possibly one.",
            cleared: "The stew was... adequate. The service, murderous. In the nicer sense.",
            accept: "Five stars. I'll be back every week, and I'll tell everyone. That's a threat, darling.",
            refuse: "Charming place. Terrible energy. One star.",
        },
        voice: 'an imperious, posh older woman, cutting',
        art: 'Lady Corvina Ashgrove, an elegant older food critic in a black feathered hat and a high-collared crimson gown, a monocle, a silver fork raised like a weapon, a notebook in her other hand',
    },

    // ================================================================ Act II — The Busy Season
    moss: {
        id: 'moss', name: 'Big Moss', title: 'the Hired Muscle', act: 2,
        layout: { peaks: 1, rows: 6 }, faceUp: 2, weights: 'high', traits: {},
        intents: [{ t: 'hit', n: 9 }, { t: 'fluster' }, { t: 'hit', n: 10 }, { t: 'grudge', n: 1 }],
        trust: 1, partner: 'p_moss', glyph: '✊', color: '#6f8f5c',
        letter: 'Boss sent me to break your legs. I dont want to. I can sing though. — Moss',
        lines: {
            arrive: "Boss says break your legs. I'd rather not. Can we just... do the card thing gently?",
            cleared: "Oh good. Nobody's legs. That's my favourite outcome.",
            accept: "I can sing on Thursdays? And lift kegs. Mostly sing.",
            refuse: "You hit hard. I don't like hitting. Bye.",
        },
        voice: 'a huge, soft-spoken gentle giant, slow and sweet',
        art: 'Big Moss, an enormous gentle hired brute with a shaved head, mossy green beard, scarred knuckles and a tiny flower tucked behind one ear, looking shy',
    },
    rook: {
        id: 'rook', name: 'Rook Daggett', title: 'Number Two', act: 2,
        layout: { peaks: 1, rows: 6 }, faceUp: 2, weights: 'flat', traits: { bounty: 2 },
        intents: [{ t: 'hit', n: 6 }, { t: 'lock', n: 2 }, { t: 'hit', n: 7 }, { t: 'muddle', n: 2 }, { t: 'hit', n: 5 }],
        trust: 2, partner: 'p_rook', glyph: '♜', color: '#5a6a8a',
        letter: 'For twelve years I was the SECOND most feared blade in the city. Tonight, I become first. Please confirm you are home. — R.D.',
        lines: {
            arrive: "Twelve years in your shadow, Nightfall. Twelve! You don't even remember my name, do you? It's Rook. Rook!",
            cleared: "Second again. Of course. Of course it is.",
            accept: "Assistant manager. Number two. You know what? It suits me.",
            refuse: "You still win the old way. I'll find my own number one.",
        },
        voice: 'an insecure, intense, slightly whiny man',
        art: 'Rook Daggett, a wiry intense rival assassin in a dark leather coat covered in too many knives, a silver second-place medal on a chain, a forced smile and a twitching eye',
    },
    oriel: {
        id: 'oriel', name: 'Madame Oriel', title: 'the Cartomancer', act: 2,
        layout: { peaks: 1, rows: 6 }, faceUp: 1, weights: 'flat', traits: {},
        intents: [{ t: 'muddle', n: 3 }, { t: 'hit', n: 6 }, { t: 'grudge', n: 1 }, { t: 'hit', n: 7 }],
        trust: 1, partner: 'p_oriel', glyph: '☾', color: '#7a5ab5',
        letter: 'I have read your cards. They say I am coming tonight. I am rarely wrong. — O.',
        lines: {
            arrive: "I foresaw this evening. I foresaw your face. I did not foresee the wallpaper. Bold.",
            cleared: "The cards said you would win. I hate when they're smug about it.",
            accept: "I'll read fortunes by the fire. Mostly good ones. Business is business.",
            refuse: "Your cards still show a blade. The future is not done with you yet.",
        },
        voice: 'a mysterious, husky, amused woman with a slow cadence',
        art: 'Madame Oriel, a mysterious cartomancer with silver-streaked curly hair, gold hoop earrings, a deep purple shawl with stars, fanning tarot cards in ringed fingers, a knowing smile',
    },
    varr: {
        id: 'varr', name: 'Captain Isolde Varr', title: 'of the City Watch', act: 2,
        layout: { peaks: 1, rows: 6 }, faceUp: 2, weights: 'low', traits: { warrant: 1 },
        intents: [{ t: 'hit', n: 6 }, { t: 'lock', n: 3 }, { t: 'hit', n: 8 }, { t: 'hit', n: 5 }],
        trust: 0, partner: 'p_varr', glyph: '⛨', color: '#3a6ab5',
        letter: 'Eight years I chased you across every rooftop in the city. I am retired too now. I would like to see you try "honest". — Capt. I. Varr',
        lines: {
            arrive: "Eight years of rooftops, Nightfall. I'm off duty. That doesn't mean I'm not watching.",
            cleared: "Clean. Not one knife. I'd have bet my pension against it.",
            accept: "I'll keep the peace on busy nights. Old habits — the good kind.",
            refuse: "I saw the blade. I'm always going to see the blade.",
        },
        voice: 'a firm, tired, authoritative woman, wry',
        art: 'Captain Isolde Varr, a broad-shouldered retired watch captain with a grey braid, a dented steel breastplate over a blue tunic, a captain\'s badge, arms crossed, one eyebrow raised',
    },
    choir: {
        id: 'choir', name: 'The Grey Choir', title: 'your old crew', act: 2, boss: true,
        layout: { peaks: 3, rows: 3 }, faceUp: 1, weights: 'flat', traits: { taint: 2, bounty: 1 },
        intents: [{ t: 'hit', n: 7 }, { t: 'grudge', n: 2 }, { t: 'lock', n: 2 }, { t: 'hit', n: 9 }, { t: 'restock', n: 2 }],
        trust: 0, partner: 'p_choir', glyph: '♫', color: '#8c8c8c',
        letter: 'Three voices, one song. You left the choir mid-verse. We have come to sing the rest. — The Grey Choir',
        lines: {
            arrive: "You left us mid-verse, Nightfall. Three voices, one song. Tonight we finish it — with or without you.",
            cleared: "...You found a different harmony.",
            accept: "Very well. We'll sing on Fridays. All of us. In harmony. You'll regret it.",
            refuse: "Still singing the old song. We'll wait for the next verse.",
        },
        voice: 'three eerie whispering voices speaking in unison',
        art: 'the Grey Choir, three tall silent assassins in identical grey robes and smooth white porcelain masks with painted singing mouths, standing in a triangle, candles at their feet',
    },

    // ================================================================ Act III — The Grand Reopening
    vesper: {
        id: 'vesper', name: 'Vesper Kane', title: 'your old apprentice', act: 3,
        layout: { peaks: 1, rows: 6 }, faceUp: 2, weights: 'flat', traits: {},
        intents: [{ t: 'hit', n: 7 }, { t: 'grudge', n: 2 }, { t: 'hit', n: 8 }, { t: 'fluster' }, { t: 'hit', n: 9 }],
        trust: 1, partner: 'p_vesper', glyph: '✧', color: '#c45a7a',
        letter: 'You taught me everything. Then you left. I have been practising. — V.',
        lines: {
            arrive: "You taught me everything, then you left without a word. I'm not here to kill you. I'm here to ask why.",
            cleared: "...You really are done with it. All of it.",
            accept: "I bake now. Did you know that? Of course you didn't. Teach me the stew, at least.",
            refuse: "You haven't changed. You just bought a building.",
        },
        voice: 'a young earnest woman, hurt but hopeful',
        art: 'Vesper Kane, a young former assassin apprentice with short cropped red hair, flour dusted on her black leather jacket, a rolling pin strapped across her back where a sword would be, determined eyes',
    },
    mott: {
        id: 'mott', name: 'Doctor Halvard Mott', title: 'the Alchemist', act: 3,
        layout: { peaks: 1, rows: 6 }, faceUp: 2, weights: 'flat', traits: { taint: 4 },
        intents: [{ t: 'grudge', n: 1 }, { t: 'hit', n: 8 }, { t: 'muddle', n: 2 }, { t: 'hit', n: 9 }],
        trust: 1, partner: 'p_mott', glyph: '⚗', color: '#4fae9a',
        letter: 'You once destroyed my laboratory. It was on fire at the time, so I suppose you also saved it. I am conflicted. — Dr H. Mott',
        lines: {
            arrive: "You burned down my laboratory. It was already on fire, granted. I've come to settle the ambiguity.",
            cleared: "Fascinating. The variable was kindness. I never control for kindness.",
            accept: "I'll brew tonics. Medicinal ones! I'm reformed. Mostly. Largely.",
            refuse: "The same reagents give the same result. You're still volatile.",
        },
        voice: 'a fussy, eccentric elderly scholar, rapid',
        art: 'Doctor Halvard Mott, an eccentric elderly alchemist with wild white hair, brass multi-lens goggles pushed up on his forehead, singed eyebrows, holding a bubbling green flask',
    },
    tally: {
        id: 'tally', name: 'Penrose Tally', title: 'the Auditor', act: 3,
        layout: { peaks: 1, rows: 6 }, faceUp: 2, weights: 'low', traits: { bounty: 3 },
        intents: [{ t: 'drain', n: 6 }, { t: 'hit', n: 7 }, { t: 'lock', n: 3 }, { t: 'hit', n: 8 }, { t: 'drain', n: 4 }],
        trust: 1, partner: 'p_tally', glyph: '§', color: '#7f7f4a',
        letter: 'RE: Unfiled returns, 14 years. The Crown has sent me. I am far more dangerous than an assassin. I have forms. — P. Tally',
        lines: {
            arrive: "Fourteen years of unfiled returns, Nightfall. Swords are crude. I have paperwork.",
            cleared: "Your books balance. That is the most frightening thing anyone has done to me.",
            accept: "I'll do your accounts. Somebody must. You keep receipts in a knife drawer.",
            refuse: "Undeclared income: one blade, used. I'll be in touch.",
        },
        voice: 'a prim, precise, nasal man, very dry',
        art: 'Penrose Tally, a thin prim royal auditor in a tight grey suit and a high collar, spectacles on a chain, a towering stack of paperwork and a sharp quill held like a dagger',
    },
    garr: {
        id: 'garr', name: 'Garr Hollins', title: 'across the street', act: 3,
        layout: { peaks: 1, rows: 6 }, faceUp: 2, weights: 'high', traits: { bounty: 2 },
        intents: [{ t: 'drain', n: 4 }, { t: 'hit', n: 9 }, { t: 'restock', n: 2 }, { t: 'hit', n: 10 }],
        trust: 1, partner: 'p_garr', glyph: '⚒', color: '#b54a2a',
        letter: 'Retired butcher. Retired, like you. Opened a tavern across the street, like you. Only one of us survives the season. — Garr',
        lines: {
            arrive: "I retired first, Nightfall! I opened a tavern first! Across the street! This town ain't big enough for two reformed killers with a pub.",
            cleared: "...Your ale's better. I hate that your ale's better.",
            accept: "Merge the two? Biggest inn in the five cities. Ha! I'm in.",
            refuse: "You fight dirty. I like that in a rival, not a partner.",
        },
        voice: 'a loud, boisterous, competitive old man',
        art: 'Garr Hollins, a burly loud retired butcher with a bushy grey beard, a bloodless clean apron, a meat cleaver tucked in his belt, holding up a foaming tankard in challenge',
    },
    thorn: {
        id: 'thorn', name: 'Mother Thorn', title: 'the Guildmaster', act: 3, boss: true, final: true,
        layout: { peaks: 1, rows: 7 }, faceUp: 2, weights: 'flat', traits: { taint: 3, bounty: 2 },
        intents: [{ t: 'hit', n: 8 }, { t: 'grudge', n: 2 }, { t: 'lock', n: 3 }, { t: 'hit', n: 10 }, { t: 'restock', n: 2 }, { t: 'hit', n: 12 }],
        trust: 0, partner: null, glyph: '❦', color: '#7a1f2a',
        letter: 'Come home, child. You were made for one thing. — Mother Thorn',
        lines: {
            arrive: "You were the finest thing I ever made, child. A blade does not get to choose to be a spoon. Come home.",
            cleared: "...Then I suppose I'll have the stew.",
            accept: "",
            refuse: "",
        },
        voice: 'a cold, elegant, motherly older woman, terrifyingly calm',
        art: 'Mother Thorn, the elegant silver-haired guildmaster of assassins in a black lace mourning gown with a high collar of thorny vines, a rose in one gloved hand, a cold warm smile',
    },
};

export const ACTS = {
    1: { name: 'Soft Opening', rivals: ['brannoc', 'quell', 'flint', 'marrow'], boss: 'corvina' },
    2: { name: 'The Busy Season', rivals: ['moss', 'rook', 'oriel', 'varr'], boss: 'choir' },
    3: { name: 'The Grand Reopening', rivals: ['vesper', 'mott', 'tally', 'garr'], boss: 'thorn' },
};

/** Rank weights by tendency (index = rank 1..13). */
export const WEIGHTS = {
    flat: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    high: [0, 0.5, 0.5, 0.6, 0.6, 0.7, 0.8, 0.8, 0.9, 1, 1.5, 1.6, 1.6, 1.4],
    low: [0, 1.4, 1.6, 1.6, 1.5, 1, 0.9, 0.8, 0.8, 0.7, 0.6, 0.6, 0.5, 0.5],
    twins: [0, 0.5, 0.5, 0.6, 0.7, 0.9, 2.2, 2.2, 0.9, 0.7, 0.6, 0.5, 0.5, 0.6],
};
