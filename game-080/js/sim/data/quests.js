// Side quests, for the journal. Their logic lives in the people's dialogue (npcs.js); this is what
// the journal shows. A quest's state is G.quests[id]: undefined (not started), 'active' or 'done'.
// `step(G)` says what to do next while it is active.

export const QUESTS = {
    overdue: {
        name: 'Overdue!', giver: 'Mayor Thistlewood',
        text: 'Eight people in Vellumvale have had library books out for years. Collect them.',
        step: (G) => {
            const left = OVERDUE.filter((o) => !G.flags['od_' + o.npc]);
            return left.length ? `Still out: ${left.map((o) => o.who).join(', ')}.` : 'All eight collected! Tell the Mayor.';
        },
    },
    flour: {
        name: 'A Baker Without Flour', giver: 'Bramwell the baker',
        text: 'Bramwell can\'t bake without flour, and the mill road is crawling with runaway books.',
        step: (G) => (G.bag.flour ? 'Take the flour back to Bramwell in Quillford.' : 'Fetch a sack of flour from Hearthfield Mill, west of the village.'),
    },
    cat: {
        name: 'Where Is Biscuit?', giver: 'Tam',
        text: 'Tam\'s cat Biscuit chased a moth into Whisperwood and hasn\'t come home.',
        step: (G) => (G.flags.catFound ? 'Biscuit has gone home. Go and see Tam.' : 'Look for an orange cat in Whisperwood, west of the farms.'),
    },
    letter: {
        name: 'A Letter for Saltmere', giver: 'Hattie',
        text: 'Hattie hasn\'t heard from her sister Meg, the netmaker in Saltmere, since the coast road closed.',
        step: (G) => (G.bag.reply ? 'Bring Meg\'s reply back to Hattie in Quillford.' : 'Deliver the letter to Meg, the netmaker in Saltmere, on the east coast.'),
    },
    poem: {
        name: 'Verses for a Bard', giver: 'Sir Percival',
        text: 'Sir Percival has written a poem for Lark the court bard, but is far too shy to deliver it.',
        step: (G) => 'Give Sir Percival\'s poem to Lark, who lives in Aubade.',
    },
    scarf: {
        name: 'A Cold Snowman', giver: 'The snowman',
        text: 'A snowman in Frostmantle West looks dreadfully cold. Snowmen shouldn\'t, but this one does.',
        step: (G) => (G.bag.scarf ? 'Give the scarf to the snowman in Frostmantle West.' : 'Ask the Weaver in Aubade Market about a scarf.'),
    },
    cheese: {
        name: 'Cheese for the Mayor', giver: 'Mayor Whiskerton',
        text: 'The Mouse Mayor\'s wheel of Starlight Cheese was carried off into the Great Burrow.',
        step: (G) => (G.bag.cheese ? 'Bring the cheese to Mayor Whiskerton in Mousehold.' : 'Find the Starlight Cheese somewhere in the Great Burrow.'),
    },
    pearls: {
        name: 'Moon Pearls', giver: 'Queen Isolde',
        text: 'The Queen collects moon pearls from Lumen Lake. Two are said to be out there.',
        step: (G) => `Pearls given: ${G.flags.pearls || 0} of 2. Look on the lake's islands, and deeper.`,
    },
    seeds: {
        name: 'Glass Flowers', giver: 'Old Fennimore',
        text: 'Fennimore wants to grow glass flowers like the ones in the old Glasshouse, south of Mousehold.',
        step: (G) => (G.bag.seeds ? 'Bring the seeds to Fennimore in the Eastern Downs.' : 'Find glass-flower seeds in the Glasshouse of Verdure.'),
    },
    lens: {
        name: 'A Lens for the Stars', giver: 'Orrin the hermit',
        text: 'The hermit of Skyreach Steps cracked his telescope lens. There\'s a spare in the Observatory.',
        step: (G) => (G.bag.lens ? 'Bring the Star Lens to Orrin in Skyreach Steps.' : 'Find the Star Lens in Skyreach Observatory.'),
    },
    bell: {
        name: 'The Silent Bell', giver: 'Brother Cairn',
        text: 'The Abbey bell hasn\'t rung in years. Its rope must be somewhere inside Gloaming Abbey.',
        step: (G) => (G.bag.bellrope ? 'Bring the bell rope to Brother Cairn on Mistmoor Heights.' : 'Find the bell rope in Gloaming Abbey.'),
    },
};

export const OVERDUE = [
    { npc: 'oldben', who: 'Old Ben (Quillford)', book: 'b13' },
    { npc: 'percival', who: 'Sir Percival (Aubade)', book: 'b40' },
    { npc: 'shepherd', who: 'the shepherd (Hearthfield Hills)', book: 'b25' },
    { npc: 'fennimore', who: 'Fennimore (Eastern Downs)', book: 'b28' },
    { npc: 'bogman', who: 'the bog-man (Mistmoor Fen)', book: 'b38' },
    { npc: 'harbourmaster', who: 'the harbourmaster (Saltmere)', book: 'b16' },
    { npc: 'lodgekeeper', who: 'the lodge keeper (Frostmantle)', book: 'b33' },
    { npc: 'mousegran', who: 'Granny Thimbleton (Mousehold)', book: 'b11' },
];
