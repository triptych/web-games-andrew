// The endings. On the eighteenth hatch-day (sim/endings.js) the bad endings are checked first; then every
// career ending whose requirements are met is scored by how far the prince clears them, and the best wins.
// `req` minimums, `max` maximums, `count` minimum times an activity was done, `flag` story flags.
// Each ending plays the coming-of-age scene, then its own lines, then the betrothed's epilogue (or a solo one).

export const ENDINGS = [
    {
        id: 'king', title: 'The First Dragon King', cg: 'end-king', music: 'triumph',
        req: { fav: 72, grc: 50, elo: 45, cha: 45, mor: 50, fame: 50 }, max: { drc: 72 }, min: { drc: 22 }, partner: true,
        hint: 'I think... I think I could be a real prince. Grandfather\'s kind. If the court would have me. If someone would stand beside me.',
        lines: [
            'n: The Lord Chancellor speaks for the court. The Archmage for the Spire. Mother Ilsabet for the temple. Guildmaster Orsolo for the city. Even, at the high window, the Elder Wyrm Ashkar, for the dragons.',
            'n: Every one of them says the same word.',
            'king: Then it is decided. Come here, grandson.',
            'n: The old King takes the crown from his own head with shaking hands.',
            'king: I have worn this for fifty years. It never fit. I think it was waiting for you.',
            '@cg end-king',
            'cael: Grandfather, I can\'t. You\'re still...',
            'king: Alive? For a little while. Long enough to watch. Let me watch, boy.',
            'n: The Dragon Prince kneels. The crown of Aurelmere settles between his horns, and fits.',
            '@sfx bells',
            'n: Outside, the bells of the capital ring. And from the Peaks, for the first time in three hundred years, the dragons answer: a great roar that rolls across the sky like summer thunder.',
            'cael.happy: {you}. I did it. We did it.',
            'n: His first decree is the Treaty of Two Fires, which makes the Dragon Peaks and the kingdom of Aurelmere one realm, under one crown, at peace.',
            'n: His second is a royal wedding.',
        ],
    },
    {
        id: 'crown', title: 'The Crown Prince of Two Bloods', cg: 'end-crown', music: 'triumph',
        req: { fav: 70, grc: 42, elo: 38, mor: 45, fame: 35 }, max: { drc: 78 }, min: { drc: 18 },
        hint: 'Grandfather says the court is turning. Maybe one day they\'ll call me prince and mean it.',
        lines: [
            'n: The court debates for an hour. Then the Chancellor rises.',
            'n: "The court recognises the Dragon Prince as a prince of the blood of Aurelmere, heir to the throne, with all rights and honours of that station."',
            '@cg end-crown',
            'n: There is no crown today. That will come later, when the old King is gone, and the prince is ready, and has someone to share it with.',
            'n: But there is a ring of state on his clawed finger, and a seat at the King\'s right hand, and the whole court rising to bow.',
            'cael.happy: They\'re bowing. {you}, they\'re actually bowing.',
            'you: So they should.',
            'n: Crown Prince {name} of Aurelmere serves his grandfather for six more years: in council, in court, on embassies to the Peaks. When the old King dies, the kingdom mourns him, and turns, without fear, to his heir.',
        ],
    },
    {
        id: 'archmage', title: 'Archmage of the Spire', cg: 'end-archmage', music: 'arcane',
        req: { mag: 68, int: 52 },
        hint: 'Velis says I have two rivers of magic. I want to see where they go. All the way to the sea.',
        lines: [
            'n: Archmage Velis does not wait for the court. She stands, leaning on her staff, and speaks over the Chancellor.',
            'velis: The Spire claims him. He is the most gifted mage I have taught in a hundred and twelve years, and I am too old to waste time.',
            'n: She takes the violet orb from her staff and places it in his hands. It blazes like a sun.',
            '@cg end-archmage',
            'velis: Dragon fire and human will. A magic no one has ever studied, because no one has ever been you. Go and study it.',
            'n: He becomes the youngest Archmage in the Spire\'s history. Under his hands, dragonfire and spellcraft are woven together for the first time: wards that warm the poor quarters in winter, lights that never fail, a bridge of living flame across the Silverrun.',
            'n: Scholars come from every kingdom to learn from the Dragon Archmage. Dragons, too. He teaches them all in the same classroom, and makes them share their notes.',
        ],
    },
    {
        id: 'diplomat', title: 'Ambassador of Two Worlds', cg: 'end-diplomat', music: 'triumph',
        req: { elo: 62, grc: 38, cha: 40, mor: 50 }, min: { drc: 35 }, max: { drc: 85 }, anyFlag: ['border_peace', 'bridge'],
        hint: 'Someone has to stand between the dragons and the court and make them listen. Why not me?',
        lines: [
            'n: The court\'s judgment is interrupted by a shadow across the high windows. Ashkar, the Elder Wyrm, has come in person.',
            'ashkar: Before you decide what he is, hear what he has been to us. He has spoken for men in the Peaks and for dragons in your court. He has kept a peace that should have broken ten times over.',
            'n: The King looks from the old dragon to his grandson, and smiles.',
            'king: Then let him keep it. By the authority of this crown, I name him Ambassador of Aurelmere to the Dragon Peaks, and Speaker of the Two Peoples.',
            '@cg end-diplomat',
            'n: He spends his life in the sky between two homes: carrying letters, settling feuds, translating insults into compliments and back again when necessary.',
            'n: The Treaty of the Ember Table, which he writes at twenty-three, is still read in schools in both tongues. It begins: "We were never two peoples. We were one family, waiting to be introduced."',
        ],
    },
    {
        id: 'warrior', title: 'Knight-Commander of Aurelmere', cg: 'end-warrior', music: 'epic',
        req: { cmb: 68, str: 52, vit: 45, mor: 40 },
        hint: 'Captain Brannoc says I\'m the best he\'s ever trained. I want to protect people. With a sword. With wings.',
        lines: [
            'n: Captain Brannoc Hale, grey now in his beard, steps forward and drops to one knee before the throne.',
            'brannoc: Majesty. The Guard has a request. We would like him. The lad has the best sword arm in the kingdom, and he can fly. You can\'t teach that.',
            'n: The soldiers in the hall begin to stamp their feet. Then to cheer.',
            '@cg end-warrior',
            'n: He is knighted that afternoon, and at twenty-two he becomes the youngest Knight-Commander in Aurelmere\'s history, the first to lead the Order of the Tower on the wing.',
            'n: Bandits learn to fear a crimson shape in the sky. Raiders stop raiding. In twelve years of command, he never loses a soldier he could have saved.',
            'n: They call him the Dragon Knight. He makes them stop saying "dragon" like it\'s a warning.',
        ],
    },
    {
        id: 'merchant', title: 'Merchant Prince of the Golden Harbor', cg: 'end-merchant', music: 'harbor',
        req: { com: 66, cun: 32, gold: 2000 },
        hint: 'Orsolo says I have a nose for a deal. Imagine the whole harbor, ships from every country...',
        lines: [
            'n: Before the court can speak, Guildmaster Orsolo coughs, loudly, and unrolls a very long scroll.',
            'n: It is a list of the businesses the prince now owns, part-owns or has advised. It takes eleven minutes to read.',
            '@cg end-merchant',
            'n: The court\'s judgment, in the end, is mostly irrelevant. You cannot cage the man who holds the mortgage on your cage.',
            'n: He founds the Ember Trading Company with three ships. In ten years he has sixty, sailing to Qasirah, the Isles and the far East, and dragons fly the fastest post across the mountains.',
            'n: He is the richest man in Aurelmere by thirty. He builds schools in the Rookery, an orphanage for every quarter of the city, and a very large vault, which he occasionally swims in. For tradition.',
        ],
    },
    {
        id: 'entertainer', title: 'Star of the Moonlit Stage', cg: 'end-entertainer', music: 'romance',
        req: { art: 68, cha: 55 },
        hint: 'When I sing, nobody looks at my horns. They look at me. Is that strange?',
        lines: [
            'n: The court\'s deliberations are interrupted by a commotion at the doors. The entire company of the Moonlit Theatre has come, in costume, uninvited.',
            'n: They have written him a song. They sing it to the throne. By the second verse, half the court is weeping.',
            '@cg end-entertainer',
            'n: He becomes the most celebrated performer in the world. "The Dragon and the Rose", which he writes and stars in at twenty, plays for nine years without closing.',
            'n: Kings send for him. So do dragons, who never cared for human music until they heard his. He sings in the Peaks to an audience of three hundred dragons, and when he finishes, the mountains roar.',
            'n: Children all over Aurelmere play at being dragons now. It is the most popular game in every schoolyard.',
        ],
    },
    {
        id: 'overlord', title: 'The Dragon Overlord', cg: 'end-overlord', music: 'dark',
        req: { drc: 70, str: 42, fame: 35 }, max: { mor: 30 },
        hint: 'They\'re all afraid of me. Maybe they should be. Maybe I\'m done asking permission.',
        lines: [
            'n: The Duke rises to read the judgment. He never finishes.',
            '@sfx roar',
            'n: The doors of the throne room blow inwards in a gale of fire. On the roof, on the walls, at every window: dragons. Hundreds of them. Waiting for his word.',
            '@cg end-overlord',
            'cael.angry: You were going to judge me? You? Who stoned me in the market? Who wanted me in a tower?',
            'cael.angry: No. I am done being judged.',
            'n: Aurelmere falls in a single afternoon. Not with a battle; there is no one brave enough to fight. The court kneels. The Duke flees north and is never seen again.',
            'n: The Dragon Overlord rules from a throne of black glass, with dragons in his skies and fear in every street. The kingdom is orderly, efficient, and very, very quiet.',
            'n: Sometimes, at night, he goes to Emberhold Manor and sits in the study where he grew up. Nobody else is allowed in. Nobody knows what he does there.',
        ],
    },
    {
        id: 'assassin', title: 'The Hush\'s Blade', cg: 'end-assassin', music: 'dark',
        req: { cun: 68, cmb: 42 }, max: { mor: 42 }, flag: 'hush',
        hint: 'Vey says the real power in a city is the hand nobody sees. I\'ve gotten very good at not being seen.',
        lines: [
            'n: The court gathers to judge the Dragon Prince. But the prince is not in the hall.',
            'n: They search the castle, the city, the Peaks. They find nothing. Only a note on the throne, pinned there with a silver knife.',
            'n: "Thank you for the judgment. I decline it."',
            '@cg end-assassin',
            'n: In the years that follow, the Duke\'s schemes collapse one by one. Corrupt lords resign suddenly. Slavers vanish. A plot against the King is foiled before anyone knew there was a plot.',
            'n: When Mistress Vey retires, the Hush has a new master. Nobody knows his face. Everybody knows his shadow has wings.',
            'n: Once a year, on Starfall Night, someone leaves a single honey sweet on your windowsill at Emberhold. You always leave the window open.',
        ],
    },
    {
        id: 'priest', title: 'Saint of the Ember Flame', cg: 'end-priest', music: 'holy',
        req: { fth: 68, mor: 68 },
        hint: 'Mother Ilsabet says the flame leans toward me when I pray. I think it\'s trying to tell me something.',
        lines: [
            'n: Mother Ilsabet speaks for the temple, and asks the court a simple question.',
            'n: "Who among you has fed the poor of the Rookery every week for eight years? Who sat with the fever-sick? Who has never once turned away a beggar, a thief, or a frightened child?"',
            'n: No one answers. Everyone looks at the prince.',
            '@cg end-priest',
            'n: He takes the vows of the Ember Flame at nineteen. The eternal flame of the High Temple, which has burned for six hundred years, turns gold the day he is ordained, and never turns back.',
            'n: He becomes the first High Priest of dragon blood. He preaches that fire is a promise, not a weapon. Dragons come down from the Peaks to hear him, and sit in the temple square, their great heads bowed.',
            'n: Long after, people will call him a saint. He always says he was just a boy who was taught to be kind.',
        ],
    },
    {
        id: 'scholar', title: 'The Royal Sage', cg: 'end-scholar', music: 'arcane',
        req: { int: 70, elo: 32 },
        hint: 'There are so many books. There\'s nobody who\'s read the dragon ones AND the human ones. Except me.',
        lines: [
            'n: The Royal Archivist, a tiny old man nobody has ever heard speak, stands up in the middle of the judgment.',
            'n: "The prince has read every book in the Royal Library. Twice. He has translated the Draconic Codex, which was thought untranslatable. I would like him to have my job. Immediately. I am very tired."',
            '@cg end-scholar',
            'n: He becomes the Royal Sage at twenty. His great work, "A History of Two Peoples", takes him thirty years and runs to nine volumes, written in both tongues.',
            'n: It proves, beyond doubt, that dragons and men were allies once, long ago, before a forgotten king\'s lie began the war. It changes everything. Schoolchildren hate it, because it is very long. But they read it.',
        ],
    },
    {
        id: 'dragonlord', title: 'Lord of the Dragon Peaks', cg: 'end-dragonlord', music: 'dragon',
        req: { drc: 76, mor: 50, vit: 45 },
        hint: 'The Peaks feel like home when I fly there. Mother\'s there. Maybe that\'s where I belong.',
        lines: [
            'n: Before the court can speak, the prince speaks first.',
            'cael: I love this city. I love the people who raised me. But I am not only a man, and you have all spent eight years reminding me.',
            'cael: The dragons have asked me to take my mother\'s place. I have said yes.',
            'n: He walks out of the throne room and into the sky, and for the first time, takes the full shape of his mother\'s kind: a great crimson dragon, wings wide over the city.',
            '@cg end-dragonlord',
            'n: He rules the Peaks for a thousand years. Wise, patient, and stubborn as his father.',
            'n: There is never war between dragons and men again. Every Hatchmoon, a crimson dragon lands in the garden of Emberhold Manor, and sits by the window of the study, and talks for hours with whoever lives there now.',
        ],
    },
    {
        id: 'adventurer', title: 'The Wandering Hero', cg: 'end-adventurer', music: 'epic',
        req: { fame: 58, cmb: 38 }, count: { adventure: 10 },
        hint: 'Every time I come back from the wilds, I\'m already thinking about going out again. Is that bad?',
        lines: [
            'n: The judgment is long and complicated, and halfway through it, the prince realises he does not care what they decide.',
            'cael.happy: {you}. There\'s a whole world out there. I\'ve only seen the edges.',
            '@cg end-adventurer',
            'n: He leaves the next morning with a sword, a pack and a map with no edges. The ballads follow him everywhere: the Drowned King, the Pale Wyrm, the Siege of Highmarsh, the Dragon of the Southern Sea.',
            'n: He fights monsters. He saves villages. He comes home every Hatchmoon to tell you every story, and they are all true, and some of them are even modest.',
            'n: Somewhere in the second decade, people stop calling him the Dragon Prince. They just call him the Hero.',
        ],
    },
    {
        id: 'ranger', title: 'Warden of the Wild', cg: 'end-ranger', music: 'dragon',
        req: { vit: 52, str: 42, cun: 32, mor: 48 }, max: { drc: 75 }, count: { adventure: 5, hunting: 4 },
        hint: 'I like the forest best. The animals don\'t care what I am. They just care if I\'m kind.',
        lines: [
            'n: The forest wardens of the Whisperwood have sent a delegation to the court. They are muddy, and smell of pine, and they are not going to leave until they are heard.',
            'n: "He knows every trail from here to the Peaks. Wolves follow him. Bears bow to him. We want him."',
            '@cg end-ranger',
            'n: He becomes the Warden of the Wild, protector of the forests and mountains between the kingdom and the Peaks: the borderland where dragons and men must share.',
            'n: Poachers fear him. Lost travellers bless him. He builds a lodge in the Whisperwood where wounded creatures come to heal, dragons and griffons and the occasional furious goose.',
            'n: Every spring, you visit. The lodge is full of animals, and he is always, always happy.',
        ],
    },
    {
        id: 'smith', title: 'The Dragonfire Smith', cg: 'end-smith', music: 'town',
        req: { str: 52, art: 38 }, count: { smithy: 14 },
        hint: 'When I breathe on the forge, the steel sings. Old Garrow says nobody\'s ever made blades like mine.',
        lines: [
            'n: The court\'s judgment is interrupted by a smith from the Ironmongers\' Row, carrying a sword wrapped in leather.',
            'n: He unwraps it on the steps of the throne. The blade glows faintly red, even in the cold hall. It has been folded in dragonfire one thousand times.',
            'n: "He made this. At seventeen. There is not a sword like it in the world. Let the boy work."',
            '@cg end-smith',
            'n: He opens his own forge in the shadow of the castle. Kings wait years for a Dragonfire blade. Knights go into debt for them.',
            'n: But mostly, he makes horseshoes for the farmers of Brookhollow, and ploughshares, and pots, and toys for the children of the Rookery. He says the toys are the hard part.',
        ],
    },
    {
        id: 'exile', title: 'The Caged Ember', cg: 'end-exile', music: 'sad', bad: true,
        hint: 'Everyone in the court looks at me like I\'m going to burn them. Maybe they\'re right.',
        lines: [
            'n: The judgment is read by the Duke, and he does not trouble to hide his satisfaction.',
            'duke: The court finds the creature a danger to the realm. It is to be confined to the Tower of Saint Orrin, for the safety of all, for the rest of its days.',
            'n: The King is too weak to argue. The court is too afraid to.',
            '@cg end-exile',
            'cael.sad: {you}... I tried. I did try.',
            'n: For three years he lives in the tower, looking out at the Peaks through bars. Then, one winter night, the bars melt, and the tower is empty.',
            'n: Nobody knows where he went. On clear nights, the shepherds of the high valleys say, a lonely crimson dragon flies along the mountain ridges, never landing, never coming home.',
            'n: You leave a lamp burning in the study window at Emberhold, every night, for the rest of your life.',
        ],
    },
    {
        id: 'runaway', title: 'The Empty Nest', cg: 'end-runaway', music: 'sad', bad: true,
        hint: 'I\'m tired. I\'m so tired. Sometimes I just want to fly away and not stop.',
        lines: [
            'n: On the morning of his eighteenth hatch-day, his bed has not been slept in.',
            'n: There is a note on your desk in the study, written in a hand that shakes.',
            '@cg end-runaway',
            'n: "I can\'t be what they want. I can\'t be what you want. I\'m so tired of trying. Please don\'t look for me. I\'m sorry. Thank you for everything. I mean it."',
            'n: The court\'s judgment is delivered to an empty room.',
            'n: You look for him anyway. For years. Sometimes there are rumours: a horned traveller on the southern roads, a crimson shape over the eastern sea.',
            'n: Once, eleven years later, a letter comes with no name and no return address. It says only: "I\'m happy now. I hope you are too." You keep it in your breast pocket until the day you die.',
        ],
    },
    {
        id: 'quiet', title: 'A Quiet Hearth', cg: 'end-quiet', music: 'manor',
        hint: 'I don\'t know what I want to be yet. Is that all right?',
        lines: [
            'n: The court debates. It cannot decide. He is not quite a prince, not quite a dragon, not quite a danger, not quite anything at all.',
            'n: In the end, they leave him be.',
            '@cg end-quiet',
            'n: He stays at Emberhold. He tends the garden, and keeps bees, and mends the roof, and helps the farmers of Brookhollow with the harvest every autumn.',
            'n: It is not the life of the songs. Nobody writes ballads about him. But he laughs a lot, and sleeps well, and Hobb\'s grandchildren ride on his back through the orchards every summer.',
            'n: When you are old, he carries you out into the garden on warm evenings so you can watch the sun go down behind the Peaks together. He says it is the best view in the world. He is right.',
        ],
    },
];

export const ENDING = Object.fromEntries(ENDINGS.map((e) => [e.id, e]));

// The betrothed's epilogue, after any ending but the King (whose wedding replaces it) and the bad endings.
export const EPILOGUES = {
    isolde: { cg: 'epi-isolde', king: 'wed-isolde', lines: [
        'n: Isolde Varre stands beside him, as she promised: in court, on the road, at the end of every day.',
        'isolde.happy: My father still won\'t speak to me. I find I don\'t miss him nearly as much as I miss you when you\'re gone for a day.',
        'n: She never does learn to stop calling him "lizard". He never asks her to.'] },
    rowan: { cg: 'epi-rowan', king: 'wed-rowan', lines: [
        'n: Sir Rowan Hale keeps his vow every day of his life. Where the dragon flies, his knight follows, on horseback, on foot, and once, memorably, clinging to his back.',
        'rowan.happy: Sworn on the broom. Told you. No take-backs.'] },
    pip: { cg: 'epi-pip', king: 'wed-pip', lines: [
        'n: Pip Thistlewood never steals another thing. Mostly. The brass ring goes everywhere on his finger, polished until it shines like gold.',
        'pip.happy: Eleven kids, one dragon, and a house with a roof that doesn\'t leak. Not bad for a Rookery rat.'] },
    theo: { cg: 'epi-theo', king: 'wed-theo', lines: [
        'n: Theo Marchbank builds him an observatory on the roof of their home and names every star he discovers after something the dragon has said to him.',
        'theo.happy: There are three hundred and twelve now. You talk a lot. I\'m not complaining.'] },
    saffi: { cg: 'epi-saffi', king: 'wed-saffi', lines: [
        'n: Saffi al-Rashid and her dragon sail the map with no edges. Every port, every coast, every island. They always come home in time for Hatchmoon.',
        'saffi.happy: Forty-one ports! And in every single one, he was still the most interesting thing there.'] },
    lumi: { cg: 'epi-lumi', king: 'wed-lumi', lines: [
        'n: Lumi of the Frostpeaks chose once, for a thousand years. She has never once regretted it.',
        'lumi.happy: Every Starfall, we go above the clouds and try to catch a star. Still haven\'t. We\'ve got time.'] },
};

// The King ending's royal wedding, with whoever he is betrothed to.
export const WEDDING = [
    'n: The royal wedding is held in the High Temple, beneath the golden flame, before the whole court, the whole city, and the dragons of the Peaks, who crowd the temple square in their hundreds.',
    '@cg {wedcg}',
    'n: {partner} walks up the aisle to the First Dragon King. The old King, wrapped in furs in the front row, weeps openly and does not care who sees.',
    'n: And when the vows are said, and the flame leans gold over the two of them, the whole hall rises, and the dragons outside roar, and the bells of the capital ring from noon until midnight.',
];

export const SOLO_EPILOGUE = [
    'n: And you? You grow old at Emberhold, with Hobb complaining about your knees and the garden full of scorch marks that no one will let the gardener repair.',
    'n: He visits often. He brings stories. He always, always says thank you.',
];

export const FAREWELL = [
    '@cg',
    '@bg study',
    '@music dream',
    'n: That night, after everything, he finds you in the study, where he stood in the doorway with flour on his horns eight years ago.',
    'cael: {you}. Whatever they decided... whatever I am now... I\'m what you made me.',
    'cael.happy: Thank you for raising me.',
    'n: THE END',
];
