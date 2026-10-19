// The Guild of the Quillsworn: rooms, callings, ranks, talents, relics, foes, genres and plot structures. Pure data.

export const ROOMS = [
    { id: 'hall', name: 'The Great Hall', short: 'Hall', blurb: 'Where Thalion keeps the fire, and the guild keeps its lamps.' },
    { id: 'scriptorium', name: 'The Scriptorium', short: 'Write', blurb: 'Chapters and scenes. The page, the quill, the work.' },
    { id: 'board', name: 'The Quest Board', short: 'Quests', blurb: 'The guild’s quests, side errands and the day’s bounties.' },
    { id: 'faces', name: 'The Hall of Faces', short: 'Characters', blurb: 'Your people: their wants, their wounds, their secrets.' },
    { id: 'grounds', name: 'The Proving Grounds', short: 'Duels', blurb: 'Ink duels: timed sprints against the foes of every writer.' },
    { id: 'loom', name: 'The Plot Loom', short: 'Outline', blurb: 'Beats of a structure, and threads woven through chapters.' },
    { id: 'loft', name: 'The Cartographer’s Loft', short: 'World', blurb: 'Places, peoples, magic and lore. A map, if you dare.' },
    { id: 'well', name: 'The Muse’s Well', short: 'Oracle', blurb: 'Names, seeds, twists and prophecies, drawn up in a bucket.' },
    { id: 'library', name: 'The Library', short: 'Library', blurb: 'Tomes of craft, laurels, the bestiary and your shelf.' },
    { id: 'bindery', name: 'The Bindery', short: 'Bind', blurb: 'Bind your book as a web page, an EPUB or a PDF.' },
];
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

export const CALLINGS = [
    {
        id: 'bard', name: 'Bard', title: 'Bard of the Silver Tongue', stat: 'voice',
        blurb: 'You hear the music of a sentence before you know what it means.',
        perk: '+10% XP for every word written. Starts with the Dialogue Lantern.',
        talent: 'q_dialogue',
    },
    {
        id: 'heartseer', name: 'Heartseer', title: 'Heartseer of the Hearth', stat: 'empathy',
        blurb: 'You know your people better than they know themselves, and you love them anyway.',
        perk: 'Double XP for fleshing out characters. Starts with the Quirk Oracle.',
        talent: 'o_quirk',
    },
    {
        id: 'loremaster', name: 'Loremaster', title: 'Loremaster of the Long Archive', stat: 'imagination',
        blurb: 'You knew the history of the river before you knew who would drown in it.',
        perk: 'Double XP for world entries. Starts with the Arcanist’s Oracle.',
        talent: 'o_magic',
    },
    {
        id: 'weaver', name: 'Weaver', title: 'Weaver of the Long Plot', stat: 'craft',
        blurb: 'You see the shape of the whole tale, and where the twist must fall.',
        perk: 'Double XP for beats and woven threads. Starts with the Twist Oracle.',
        talent: 'o_twist',
    },
];
export const CALLING_BY_ID = Object.fromEntries(CALLINGS.map((c) => [c.id, c]));

/** Guild ranks, by level. */
export const RANKS = [
    { level: 1, name: 'Inkling' },
    { level: 3, name: 'Apprentice' },
    { level: 6, name: 'Scribe' },
    { level: 10, name: 'Journeyman' },
    { level: 15, name: 'Taleweaver' },
    { level: 20, name: 'Loremaster' },
    { level: 26, name: 'Master Talewright' },
    { level: 33, name: 'Grand Bard' },
    { level: 40, name: 'Legend of Vellmere' },
];

export const ATTRS = [
    { id: 'voice', name: 'Voice', blurb: 'Words written. Prose is a muscle.', steps: [0, 300, 1500, 4000, 8000, 15000, 25000, 40000, 60000, 85000] },
    { id: 'empathy', name: 'Empathy', blurb: 'Characters fleshed out, and the bonds between them.', steps: [0, 1, 2, 3, 5, 7, 9, 12, 15, 20] },
    { id: 'imagination', name: 'Imagination', blurb: 'World entries, map pins and draws from the Well.', steps: [0, 2, 4, 7, 10, 14, 19, 25, 32, 40] },
    { id: 'craft', name: 'Craft', blurb: 'Beats filled, scenes summarised, scenes revised.', steps: [0, 2, 5, 9, 14, 20, 28, 37, 48, 60] },
    { id: 'discipline', name: 'Discipline', blurb: 'Days at your goal in a row (best), and duels won.', steps: [0, 1, 3, 5, 8, 12, 17, 23, 30, 40] },
];

export const TALENT_BRANCHES = [
    { id: 'quill', name: 'The Quill', blurb: 'Tools of the writing desk.' },
    { id: 'lens', name: 'The Lens', blurb: 'Reading your own prose with a cold eye.' },
    { id: 'oracle', name: 'The Oracle', blurb: 'More buckets for the Muse’s Well.' },
    { id: 'binding', name: 'The Binding', blurb: 'Fine bookcraft for the Bindery.' },
    { id: 'blade', name: 'The Blade', blurb: 'Edges for the Proving Grounds.' },
];

export const TALENTS = [
    { id: 'q_focus', branch: 'quill', name: 'Focus Trance', level: 2, blurb: 'A distraction-free desk: the page fills the window and the guild falls quiet.' },
    { id: 'q_goal', branch: 'quill', name: 'Session Vow', level: 2, blurb: 'Swear a word count for this sitting and watch a ring of ink close around it.' },
    { id: 'q_dialogue', branch: 'quill', name: 'Dialogue Lantern', level: 3, blurb: 'Speech glows in the reading view, and a meter shows how much of a scene is talk.' },
    { id: 'q_snap', branch: 'quill', name: 'Chronicle of Drafts', level: 4, blurb: 'Snapshots of a scene you can compare and restore. Revise without fear.' },
    { id: 'q_find', branch: 'quill', name: 'Seeker’s Glass', level: 5, blurb: 'Find and replace across the whole manuscript. Rename a kingdom in one breath.' },
    { id: 'l_one', branch: 'lens', name: 'Scribe’s Lens', level: 2, blurb: 'Thalion reads a scene for adverbs, filter words, hedges and said-bookisms.' },
    { id: 'l_two', branch: 'lens', name: 'Lens of Echoes', level: 4, req: 'l_one', blurb: 'Adds the passive voice, words that echo too close together, and fantasy clichés.' },
    { id: 'l_three', branch: 'lens', name: 'Lens of Rhythm', level: 7, req: 'l_two', blurb: 'Adds sentence rhythm, the five senses, dialogue balance and reading ease.' },
    { id: 'o_twist', branch: 'oracle', name: 'Twist Oracle', level: 3, blurb: 'Reversals, betrayals and revelations, drawn from the deep water.' },
    { id: 'o_quirk', branch: 'oracle', name: 'Quirk Oracle', level: 3, blurb: 'Habits, secrets and contradictions for your characters.' },
    { id: 'o_magic', branch: 'oracle', name: 'Arcanist’s Oracle', level: 4, blurb: 'Magic systems with a source, a cost and a limit.' },
    { id: 'o_prophecy', branch: 'oracle', name: 'Prophecy Engine', level: 6, req: 'o_twist', blurb: 'Ominous verses, deliberately ambiguous, as all good prophecies are.' },
    { id: 'o_title', branch: 'oracle', name: 'Title Oracle', level: 5, blurb: 'Book titles, chapter titles, tavern names and ship names.' },
    { id: 'b_illum', branch: 'binding', name: 'Illuminator', level: 5, blurb: 'Drop caps, fleurons and small-caps openings in your bound books.' },
    { id: 'b_append', branch: 'binding', name: 'Appendices', level: 6, blurb: 'A Dramatis Personae and a Glossary, built from your codex.' },
    { id: 'b_map', branch: 'binding', name: 'Map Plate', level: 8, blurb: 'Bind the map from the Cartographer’s Loft into the front of the book.' },
    { id: 'b_manuscript', branch: 'binding', name: 'Agent’s Format', level: 9, blurb: 'Standard manuscript format, for sending your novel out into the world.' },
    { id: 'd_hourglass', branch: 'blade', name: 'Patient Hourglass', level: 4, blurb: 'Duels last 15% longer.' },
    { id: 'd_ward', branch: 'blade', name: 'Ward of Momentum', level: 6, blurb: 'Foes recover half as fast while you pause.' },
    { id: 'd_surge', branch: 'blade', name: 'Ink Surge', level: 8, req: 'd_ward', blurb: 'Every hundred words in a duel strikes ten more.' },
];
export const TALENT_BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t]));

export const RELIC_SLOTS = ['quill', 'inkwell', 'charm'];
/** Relics: one of each slot is worn. An inkwell also sets the colour of the writing desk. */
export const RELICS = [
    { id: 'goose', slot: 'quill', name: 'Goose Quill', blurb: 'Every scribe’s first quill. It squeaks.', fx: {} },
    { id: 'heron', slot: 'quill', name: 'Heron Quill', blurb: 'Grey and patient. +5% XP from words.', fx: { wordXp: 0.05 } },
    { id: 'raven', slot: 'quill', name: 'Raven Quill', blurb: 'Taken from the Wraith’s own wing. +15% damage in duels.', fx: { duelDamage: 0.15 } },
    { id: 'phoenix', slot: 'quill', name: 'Phoenix Quill', blurb: 'It writes warm. +12% XP from words.', fx: { wordXp: 0.12 } },
    { id: 'common', slot: 'inkwell', name: 'Common Inkwell', blurb: 'Oak-gall ink on parchment. The Parchment desk.', fx: {}, theme: 'parchment' },
    { id: 'elvenwood', slot: 'inkwell', name: 'Elvenwood Inkwell', blurb: 'Green ink that smells of rain. The Elvenwood desk.', fx: { questXp: 0.05 }, theme: 'elvenwood' },
    { id: 'midnight', slot: 'inkwell', name: 'Midnight Inkwell', blurb: 'For writing after the candles gutter. The Midnight desk.', fx: {}, theme: 'midnight' },
    { id: 'dragonblood', slot: 'inkwell', name: 'Dragon’s Blood Inkwell', blurb: 'Still warm. +5% XP from words. The Dragonfire desk.', fx: { wordXp: 0.05 }, theme: 'dragonfire' },
    { id: 'moonsilver', slot: 'inkwell', name: 'Moonsilver Inkwell', blurb: 'Thalion’s own, once. +8% XP from quests. The Moonsilver desk.', fx: { questXp: 0.08 }, theme: 'moonsilver' },
    { id: 'ribbon', slot: 'charm', name: 'Thalion’s Ribbon', blurb: 'Silver silk from his hair. “I have plenty.” +5% XP from quests.', fx: { questXp: 0.05 } },
    { id: 'jar', slot: 'charm', name: 'Imp in a Jar', blurb: 'It sulks. Foes recover 25% slower.', fx: { duelRegen: -0.25 } },
    { id: 'spectacles', slot: 'charm', name: 'Goblin’s Spectacles', blurb: 'They see every doubt and dismiss it. +10% XP from the codex.', fx: { codexXp: 0.1 } },
    { id: 'hourglass', slot: 'charm', name: 'Golem’s Hourglass', blurb: 'Sand from a crumbled block. Duels last 10% longer.', fx: { duelTime: 0.1 } },
    { id: 'wyrmscale', slot: 'charm', name: 'Wyrmscale', blurb: 'A scale that once held a thousand facts. +10% duel damage.', fx: { duelDamage: 0.1 } },
    { id: 'lamp', slot: 'charm', name: 'The Lamp of Vellmere', blurb: 'Lit by your finished book. +10% XP from everything.', fx: { wordXp: 0.1, questXp: 0.1, codexXp: 0.1 } },
];
export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));

export const THEMES = {
    parchment: { name: 'Parchment' },
    elvenwood: { name: 'Elvenwood' },
    midnight: { name: 'Midnight' },
    dragonfire: { name: 'Dragonfire' },
    moonsilver: { name: 'Moonsilver' },
};

/** The foes of the Proving Grounds. hp = words to write; time in minutes; regen = hp per second once you pause. */
export const FOES = [
    {
        id: 'imp', name: 'Procrastination Imp', hp: 100, time: 5, regen: 0.5, xp: 60, drop: 'jar', after: 'q_first_ink',
        blurb: 'Small, pink, persuasive. It would love to show you something on the other side of the room.',
        taunts: ['Wouldn’t a cup of tea be nice first?', 'You could start tomorrow. Tomorrow is lovely.', 'Is that the floor? It needs sweeping.', 'Just check the window. One look.', 'Ooh, you should reorganise your quills.'],
        defeat: 'The Imp pops like a soap bubble, leaving a smell of burnt sugar and a jar it was apparently living in.',
    },
    {
        id: 'wraith', name: 'Wraith of the Blank Page', hp: 250, time: 10, regen: 1, xp: 120, drop: 'raven', after: 'q_first_ink',
        blurb: 'A cold white shape that rises from every unwritten page and asks you, very quietly, what you could possibly say.',
        taunts: ['So much white. So little worth saying.', 'Everyone else has already written this.', 'Shhhhhh.', 'Your words are frost. They melt.', 'Stare a little longer. I like it when you stare.'],
        defeat: 'The Wraith tears like wet paper and blows away in scraps covered in your handwriting. One black feather is left behind.',
    },
    {
        id: 'goblin', name: 'Doubt Goblin', hp: 400, time: 12, regen: 1, xp: 180, drop: 'spectacles', after: 'q_shape',
        blurb: 'It wears spectacles to read over your shoulder, and has never once said anything kind.',
        taunts: ['Who told you you could write?', 'That sentence. Really?', 'A real author would know what happens next.', 'Your mother won’t even read this.', 'Hmm. Hmmmm. HMMMM.'],
        defeat: 'The Goblin reads one last line, bursts into tears and runs off. It leaves its spectacles behind.',
    },
    {
        id: 'golem', name: 'Writer’s Block Golem', hp: 600, time: 15, regen: 1.5, xp: 260, drop: 'hourglass', after: 'q_steel',
        blurb: 'A wall with legs, made of every sentence you didn’t write. It doesn’t attack. It simply stands in the way.',
        taunts: ['...', 'I AM THE WALL.', 'NO FURTHER.', '...stone...', 'TRY GOING AROUND. YOU CANNOT.'],
        defeat: 'You write straight through it. The Golem crumbles into gravel and one hourglass, still running.',
    },
    {
        id: 'hydra', name: 'Mire-Hydra of the Sagging Middle', hp: 1000, time: 25, regen: 1.5, xp: 450, drop: 'dragonblood', after: 'q_binding',
        blurb: 'It lives in the swamp at the centre of every book, where the plot slows and the reader’s boots get stuck.',
        taunts: ['Wasn’t the beginning more exciting?', 'Does anything happen in this part?', 'Another conversation in another tavern?', 'Cut off one head, two more subplots grow.', 'Sink. Sink with me. It’s warm.'],
        defeat: 'The last head slumps into the mire. The swamp drains away and the road beyond is dry and clear and goes somewhere.',
    },
    {
        id: 'wyrm', name: 'The Infodump Wyrm', hp: 1200, time: 30, regen: 1.5, xp: 520, drop: 'wyrmscale', after: 'q_middle',
        blurb: 'An ancient dragon that hoards facts. It would like to tell you about the tax system of the Third Empire. All of it.',
        taunts: ['As you know, Bob, the Third Empire…', 'Let me explain the magic system. In full.', 'Seven hundred years ago, there was a king named—', 'Here is a map. And another map.', 'Before you continue, the genealogy of House Vael…'],
        defeat: 'The Wyrm coils into a heap of scrolls, still muttering dates. You keep a single scale and let the rest go.',
    },
    {
        id: 'critic', name: 'The Inner Critic', hp: 1667, time: 40, regen: 2, xp: 800, drop: 'phoenix', after: 'q_middle',
        blurb: 'It has your face and your voice, and it holds a red quill. It knows exactly where you are weakest, because it is you.',
        taunts: ['I know what you meant to write. This isn’t it.', 'They’ll all see through you.', 'You’re wasting your life on this.', 'Better to never finish than finish badly.', 'Write that again. No. Again.'],
        defeat: 'The Critic lowers its red quill and, for the first time, reads to the end. “Fine,” it says, and it is gone, and somewhere warm a feather is burning without being consumed.',
    },
    {
        id: 'scarecrow', name: 'The Straw Scribe', hp: 0, time: 0, regen: 0, xp: 0, after: 'q_first_ink', training: true,
        blurb: 'A training dummy in a scribe’s cap. Set your own words and minutes; it never fights back.',
        taunts: ['(the straw rustles)', '(a crow lands on its hat)', '(it leans a little)'],
        defeat: 'The Straw Scribe falls over. A crow looks at you with respect.',
    },
];
export const FOE_BY_ID = Object.fromEntries(FOES.map((f) => [f.id, f]));

export const GENRES = [
    { id: 'epic', name: 'Epic fantasy', blurb: 'Kingdoms, wars, prophecies and maps with mountains on them.', thalion: 'The grand tradition. Big stakes, many points of view. Mind the map does not swallow the people.' },
    { id: 'sword', name: 'Sword & sorcery', blurb: 'A rogue, a blade, a temple of a forgotten god. Fast, close, dangerous.', thalion: 'Small stakes, sharp edges. One hero, one night, one terrible idol. I approve.' },
    { id: 'cozy', name: 'Cozy fantasy', blurb: 'A bakery, a found family, a dragon who is mostly misunderstood.', thalion: 'Low stakes are still stakes. The fear of losing a home is as old as the fear of dragons.' },
    { id: 'dark', name: 'Dark fantasy', blurb: 'Horror at the edges, moral rot at the centre.', thalion: 'Darkness needs a candle somewhere, or the reader stops looking.' },
    { id: 'fairytale', name: 'Fairy-tale retelling', blurb: 'An old tale, turned in the hand until it shows a new face.', thalion: 'Everyone knows how the story goes. Your power is that you know it too, and can break it.' },
    { id: 'mythic', name: 'Mythic fantasy', blurb: 'Gods walk, rivers speak, and the rules are older than people.', thalion: 'Write it as if it were true, and as if it were very, very old.' },
    { id: 'portal', name: 'Portal fantasy', blurb: 'A door, a wardrobe, a well. Someone from here goes there.', thalion: 'Your hero is the reader’s eyes. Their ignorance is your excuse to explain, so spend it wisely.' },
    { id: 'romantasy', name: 'Romantic fantasy', blurb: 'Two hearts, one kingdom, and a great deal of longing.', thalion: 'The love story is the plot, not the decoration. Give it obstacles worthy of a siege.' },
    { id: 'flintlock', name: 'Flintlock fantasy', blurb: 'Muskets and magic, revolutions and runes.', thalion: 'When the world changes, the magic must change with it. Who loses what when gunpowder arrives?' },
    { id: 'coming', name: 'Coming-of-age fantasy', blurb: 'A young person, a magic school or a hard road, and growing up.', thalion: 'The real quest is becoming someone. The dragon is a deadline.' },
];
export const GENRE_BY_ID = Object.fromEntries(GENRES.map((g) => [g.id, g]));

/** Plot structures for the Loom. pct = roughly where the beat falls in the book. */
export const STRUCTURES = [
    {
        id: 'three', name: 'The Three Acts', blurb: 'Beginning, middle, end, with doors between them. The spine of most tales.',
        beats: [
            { id: 'ordinary', act: 1, pct: 0, name: 'The Ordinary World', guide: 'Show the hero’s life before. What do they want, what are they missing, and what will they lose?' },
            { id: 'inciting', act: 1, pct: 10, name: 'The Inciting Incident', guide: 'Something happens that cannot be undone. A letter, a death, a dragon on the roof.' },
            { id: 'door1', act: 1, pct: 25, name: 'The First Door', guide: 'The hero chooses to step into the story. There is no going back after this.' },
            { id: 'trials', act: 2, pct: 35, name: 'Rising Trials', guide: 'The promise of the premise: the adventures your reader came for. Try, fail, try again.' },
            { id: 'midpoint', act: 2, pct: 50, name: 'The Midpoint', guide: 'A false victory or a false defeat. The hero learns something that changes the shape of the quest.' },
            { id: 'noose', act: 2, pct: 65, name: 'The Tightening Noose', guide: 'The enemy strikes back. Allies falter. Every choice now costs something.' },
            { id: 'darkest', act: 2, pct: 75, name: 'The Darkest Hour', guide: 'All is lost. The hero must face the flaw they have been carrying since page one.' },
            { id: 'climax', act: 3, pct: 90, name: 'The Climax', guide: 'The final confrontation, won by the person the hero has become, not the one they were.' },
            { id: 'resolution', act: 3, pct: 100, name: 'The Resolution', guide: 'Show the new world. Mirror the opening, and let the reader breathe.' },
        ],
    },
    {
        id: 'journey', name: 'The Hero’s Journey', blurb: 'Campbell’s monomyth, as Vogler told it: twelve stages from the hearth to the abyss and home.',
        beats: [
            { id: 'ordinary', act: 1, pct: 0, name: 'The Ordinary World', guide: 'Home, as it is. Plant what the hero lacks.' },
            { id: 'call', act: 1, pct: 8, name: 'The Call to Adventure', guide: 'A herald arrives: a message, a stranger, a strange light in the woods.' },
            { id: 'refusal', act: 1, pct: 12, name: 'Refusal of the Call', guide: 'Fear speaks first. Why would any sensible person say no?' },
            { id: 'mentor', act: 1, pct: 18, name: 'Meeting the Mentor', guide: 'Someone wise gives advice, a gift or a push. Handsome elves are traditional.' },
            { id: 'threshold', act: 1, pct: 25, name: 'Crossing the Threshold', guide: 'The hero leaves the known world. Make the border vivid: a gate, a river, a song.' },
            { id: 'tests', act: 2, pct: 35, name: 'Tests, Allies, Enemies', guide: 'The new world’s rules are learned the hard way. Friends are made. So are enemies.' },
            { id: 'approach', act: 2, pct: 45, name: 'Approach to the Inmost Cave', guide: 'Preparation for the great ordeal. Plans are made, and the reader feels them fraying.' },
            { id: 'ordeal', act: 2, pct: 55, name: 'The Ordeal', guide: 'Death, or something like it. The hero is broken open.' },
            { id: 'reward', act: 2, pct: 65, name: 'The Reward', guide: 'The sword is seized, the secret learned. A moment of triumph, and its shadow.' },
            { id: 'road', act: 3, pct: 75, name: 'The Road Back', guide: 'The consequences give chase. The hero must choose to finish the quest.' },
            { id: 'resurrection', act: 3, pct: 90, name: 'Resurrection', guide: 'The final test, where everything learned is spent. The old self dies.' },
            { id: 'elixir', act: 3, pct: 100, name: 'Return with the Elixir', guide: 'Home again, changed, carrying something that heals the world they left.' },
        ],
    },
    {
        id: 'cat', name: 'Save the Cat', blurb: 'Blake Snyder’s fifteen beats, built for screenplays, beloved by novelists who like a map.',
        beats: [
            { id: 'image', act: 1, pct: 0, name: 'Opening Image', guide: 'A snapshot of the hero’s world and flaw, before.' },
            { id: 'theme', act: 1, pct: 5, name: 'Theme Stated', guide: 'Someone, often in passing, says what the story is really about. The hero doesn’t listen.' },
            { id: 'setup', act: 1, pct: 8, name: 'Set-Up', guide: 'The hero’s life, friends and things that need fixing.' },
            { id: 'catalyst', act: 1, pct: 10, name: 'Catalyst', guide: 'The life-changing moment.' },
            { id: 'debate', act: 1, pct: 15, name: 'Debate', guide: 'Should I go? Can I? The last chance to stay home.' },
            { id: 'break2', act: 2, pct: 25, name: 'Break into Two', guide: 'The hero chooses the new world, actively.' },
            { id: 'bstory', act: 2, pct: 30, name: 'B Story', guide: 'A second story, often a love or friendship, that carries the theme.' },
            { id: 'fun', act: 2, pct: 40, name: 'Fun and Games', guide: 'The promise of the premise. Why the reader picked up the book.' },
            { id: 'midpoint', act: 2, pct: 50, name: 'Midpoint', guide: 'Stakes are raised; a false win or a false loss.' },
            { id: 'badguys', act: 2, pct: 60, name: 'Bad Guys Close In', guide: 'External enemies regroup; internal doubts multiply.' },
            { id: 'lost', act: 2, pct: 75, name: 'All Is Lost', guide: 'The whiff of death. Often a mentor falls here. (I am not volunteering.)' },
            { id: 'dark', act: 2, pct: 80, name: 'Dark Night of the Soul', guide: 'The hero wallows, then finds the truth they were missing.' },
            { id: 'break3', act: 3, pct: 82, name: 'Break into Three', guide: 'A solution, born from the A and B stories together.' },
            { id: 'finale', act: 3, pct: 90, name: 'Finale', guide: 'The plan, the storming of the castle, the high tower surprise, the new plan.' },
            { id: 'final', act: 3, pct: 100, name: 'Final Image', guide: 'The opposite of the opening image. Proof of change.' },
        ],
    },
    {
        id: 'seven', name: 'The Seven Points', blurb: 'Start at the end and work backwards: a hook, two turns, two pinches, a midpoint and a resolution.',
        beats: [
            { id: 'hook', act: 1, pct: 0, name: 'The Hook', guide: 'The hero in a state opposite to how they end. If they end brave, begin afraid.' },
            { id: 'turn1', act: 1, pct: 20, name: 'Plot Turn One', guide: 'The world changes and moves the hero from the hook toward the midpoint.' },
            { id: 'pinch1', act: 2, pct: 35, name: 'Pinch One', guide: 'Apply pressure. The villain shows teeth; the hero must act.' },
            { id: 'midpoint', act: 2, pct: 50, name: 'The Midpoint', guide: 'The hero moves from reacting to acting.' },
            { id: 'pinch2', act: 2, pct: 65, name: 'Pinch Two', guide: 'More pressure, until it seems the hero must fail. The plan collapses.' },
            { id: 'turn2', act: 3, pct: 80, name: 'Plot Turn Two', guide: 'The hero finds the last piece: “The power was in you all along,” but earned.' },
            { id: 'resolution', act: 3, pct: 100, name: 'Resolution', guide: 'Everything the story has been building towards. Mirror the hook.' },
        ],
    },
    {
        id: 'kishotenketsu', name: 'Kishōtenketsu', blurb: 'Four movements from East Asian poetry and story. Conflict is optional; a twist of perspective is not.',
        beats: [
            { id: 'ki', act: 1, pct: 0, name: 'Ki: Introduction', guide: 'Introduce the people and their world, plainly and well.' },
            { id: 'sho', act: 2, pct: 25, name: 'Shō: Development', guide: 'Deepen them. Follow their days. Nothing has to go wrong.' },
            { id: 'ten', act: 3, pct: 60, name: 'Ten: The Turn', guide: 'Something unexpected, unrelated even, that changes how everything before it looks.' },
            { id: 'ketsu', act: 4, pct: 100, name: 'Ketsu: Reconciliation', guide: 'Bring the first two parts and the turn together into a new understanding.' },
        ],
    },
    {
        id: 'quest', name: 'The Fellowship Road', blurb: 'The guild’s own shape for a quest fantasy: a company gathers, travels, breaks and comes home.',
        beats: [
            { id: 'home', act: 1, pct: 0, name: 'The Hearth', guide: 'The small, beloved place the hero will fight for. Make the reader want to live there.' },
            { id: 'summons', act: 1, pct: 8, name: 'The Summons', guide: 'An object, a messenger or a shadow on the road: the quest arrives.' },
            { id: 'gathering', act: 1, pct: 18, name: 'The Gathering of the Company', guide: 'Companions with different gifts and conflicting reasons. Give each one a secret.' },
            { id: 'peril', act: 2, pct: 28, name: 'The First Peril', guide: 'The road bites. The company learns what each member is made of.' },
            { id: 'haven', act: 2, pct: 40, name: 'The Haven', guide: 'Rest, lore and a feast. The calm where the true size of the task is revealed.' },
            { id: 'breaking', act: 2, pct: 55, name: 'The Breaking of the Company', guide: 'A loss, a betrayal or a fork in the road. The company scatters.' },
            { id: 'dark', act: 2, pct: 70, name: 'The Long Dark', guide: 'Separate roads, each darker. The hero walks without the people who made them brave.' },
            { id: 'gate', act: 3, pct: 82, name: 'The Gate of the Enemy', guide: 'The scattered threads converge at the enemy’s door.' },
            { id: 'price', act: 3, pct: 92, name: 'The Price Paid', guide: 'Victory is bought with something precious. Never let it be free.' },
            { id: 'homecoming', act: 3, pct: 100, name: 'The Homecoming', guide: 'The hearth again, but the hero no longer fits it quite the same.' },
        ],
    },
];
export const STRUCTURE_BY_ID = Object.fromEntries(STRUCTURES.map((s) => [s.id, s]));

export const CHARACTER_ROLES = ['Protagonist', 'Antagonist', 'Mentor', 'Ally', 'Love interest', 'Rival', 'Trickster', 'Herald', 'Threshold guardian', 'Shapeshifter', 'Sidekick', 'Foil', 'Other'];
export const PEOPLES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Orc', 'Gnome', 'Fae', 'Dragon', 'Dragonkin', 'Giant', 'Merfolk', 'Spirit', 'Undead', 'Construct', 'Beastfolk'];

export const WORLD_KINDS = [
    { id: 'place', name: 'Place', icon: 'tower', blurb: 'Cities, ruins, forests, taverns, the cave behind the waterfall.' },
    { id: 'faction', name: 'Faction', icon: 'banner', blurb: 'Guilds, houses, cults, kingdoms, the thieves under the bridge.' },
    { id: 'magic', name: 'Magic', icon: 'star', blurb: 'A system of power with a source, a cost and a limit.' },
    { id: 'creature', name: 'Creature', icon: 'claw', blurb: 'Beasts, monsters, spirits, the cat that is more than a cat.' },
    { id: 'artifact', name: 'Artifact', icon: 'gem', blurb: 'Swords with names, cursed rings, the crown no one should wear.' },
    { id: 'lore', name: 'Lore', icon: 'scroll', blurb: 'Histories, legends, gods, the war everyone pretends to forget.' },
    { id: 'culture', name: 'Culture', icon: 'mask', blurb: 'Customs, faiths, foods, how people marry and bury their dead.' },
];
export const KIND_BY_ID = Object.fromEntries(WORLD_KINDS.map((k) => [k.id, k]));

/** Character fields: the six core ones must all be filled, plus the backstory, for a character to count as fleshed. */
export const CHAR_FIELDS = [
    { id: 'name', label: 'Name', core: true, hint: 'A name is a promise. Say it aloud. Does it fit their mother’s mouth?' },
    { id: 'role', label: 'Role', core: true, select: 'roles', hint: 'What they do for the story, not what they do for a living.' },
    { id: 'people', label: 'People', list: 'peoples', hint: 'Elf, dwarf, human, something new. Their people shape how they see everything.' },
    { id: 'age', label: 'Age', hint: 'Not a number so much as a stage: young and certain, old and tired, ageless and bored.' },
    { id: 'appearance', label: 'Appearance', long: true, hint: 'One or two details the reader will remember. A burn scar; a laugh too loud for the room.' },
    { id: 'want', label: 'Want', core: true, hint: 'What they are chasing on the outside. The crown, the cure, the way home.' },
    { id: 'need', label: 'Need', core: true, hint: 'What they truly lack on the inside, and usually don’t know. To forgive; to be seen.' },
    { id: 'flaw', label: 'Flaw', core: true, hint: 'The lie they believe, or the habit that hurts them. The story will test it.' },
    { id: 'wound', label: 'Wound', core: true, hint: 'The old hurt the flaw grew from. The fire, the betrayal, the war.' },
    { id: 'secret', label: 'Secret', hint: 'What they would never say at the table.' },
    { id: 'voice', label: 'Voice', hint: 'How they talk. Clipped? Ornate? Never finishes a sentence? Swears by an odd god?' },
    { id: 'arcStart', label: 'Arc: begins as…', hint: 'Who they are on page one.' },
    { id: 'arcEnd', label: 'Arc: ends as…', hint: 'Who they are on the last page. Or who they fail to become.' },
    { id: 'backstory', label: 'Backstory', long: true, big: true, hint: 'Their history before the book. Write more than you will ever use: the reader feels the weight.' },
    { id: 'notes', label: 'Notes', long: true, hint: 'Anything else. Favourite food. What they dream about.' },
];
