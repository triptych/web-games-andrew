// Expeditions beyond the walls. An expedition takes one period and is played as a run of encounters: each
// shows a danger and the approaches the prince can take; the player picks one and it is rolled against the
// encounter's difficulty using the approach's stats (APPROACH). The last encounter of each run is the region's
// master. Rewards and losses are applied as they happen.

export const APPROACH = {
    fight: { name: 'Fight', icon: '⚔️', stats: { cmb: 0.6, str: 0.4 } },
    magic: { name: 'Spellcraft', icon: '✨', stats: { mag: 0.65, int: 0.35 } },
    talk: { name: 'Talk', icon: '💬', stats: { elo: 0.5, cha: 0.5 } },
    sneak: { name: 'Sneak', icon: '🌑', stats: { cun: 0.7, vit: 0.3 } },
    dragon: { name: 'Dragonfire', icon: '🔥', stats: { drc: 0.65, vit: 0.35 } },
    faith: { name: 'Pray', icon: '🕯️', stats: { fth: 0.6, mor: 0.4 } },
};

export const REGIONS = [
    {
        id: 'whisperwood', name: 'The Whisperwood', bg: 'forest', minAge: 10, base: 12, need: null,
        desc: 'The old forest north of the capital. Wolves, will-o\'-wisps and woodcutters\' tales.',
        steps: [
            { text: 'A pack of grey wolves blocks the deer trail, hackles up.', opts: ['fight', 'dragon', 'sneak'], reward: { gold: 30 }, ok: 'The wolves melt back into the trees.', fail: 'He comes away with scratches and a torn cloak.' },
            { text: 'Will-o\'-wisps dance over a bog, beckoning.', opts: ['magic', 'faith', 'sneak'], reward: { mag: 0.6 }, ok: 'He follows the true light and finds a fairy ring full of silver mushrooms.', fail: 'He spends hours walking in circles, soaked to the knee.' },
            { text: 'A lost woodcutter\'s child is crying in a hollow oak.', opts: ['talk', 'faith', 'dragon'], reward: { mor: 1, fame: 1 }, ok: 'He carries her home on his shoulders, tail and all.', fail: 'She is too frightened of his horns to come out until her father arrives.' },
            { text: 'Wild boars root in a clearing scattered with old coins.', opts: ['fight', 'sneak', 'talk'], reward: { gold: 60 }, ok: 'He pockets the coins while the boars are busy with acorns.', fail: 'A boar chases him up a tree for an hour.' },
            { text: 'A ring of standing stones hums with old magic.', opts: ['magic', 'dragon', 'faith'], reward: { int: 0.6, drc: 0.4 }, ok: 'The stones show him a vision of dragons and men dancing together, long ago.', fail: 'The hum gives him a three-day headache.' },
        ],
        boss: { name: 'The Antlered Hag', text: 'A crooked witch with a stag\'s skull for a face steps out of the fog. "Pretty horns. I\'ll have those."', opts: ['fight', 'magic', 'talk', 'dragon'], bonus: 8, reward: { gold: 150, fame: 4 }, ok: 'The Hag shrieks and dissolves into a flock of crows. Her hut holds a small fortune.', fail: 'He flees with the Hag\'s laughter echoing through the trees.' },
    },
    {
        id: 'ruins', name: 'The Sunken Ruins of Old Vael', bg: 'ruins', minAge: 12, base: 24, need: null,
        desc: 'A drowned city of the first kings, half under the lake. Traps, spirits and treasure.',
        steps: [
            { text: 'A corridor of pressure plates and rusted spear traps.', opts: ['sneak', 'magic', 'fight'], reward: { gold: 70 }, ok: 'He dances through the traps and finds a strongbox at the far end.', fail: 'A spear grazes his shoulder.' },
            { text: 'The ghost of a drowned knight still guards the bridge.', opts: ['faith', 'talk', 'fight'], reward: { fth: 0.8, mor: 0.6 }, ok: 'He tells the knight the war is long over. The knight bows and fades.', fail: 'The ghost\'s cold blade sends him reeling back.' },
            { text: 'A riddle carved on a sealed door: "I am the fire that warms and the fire that kills."', opts: ['magic', 'talk', 'dragon'], reward: { int: 0.8 }, ok: '"A dragon," he answers. The door opens. Of course it does.', fail: 'The door stays shut. He never learns the answer.' },
            { text: 'Giant eels stir in the flooded hall.', opts: ['fight', 'dragon', 'sneak'], reward: { str: 0.6, gold: 40 }, ok: 'He boils the water and the eels flee.', fail: 'He swims for his life.' },
            { text: 'A library of waterlogged scrolls about the Treaty of Ash.', opts: ['magic', 'talk', 'sneak'], reward: { int: 1, elo: 0.4 }, ok: 'He salvages a scroll: the first treaty between men and dragons, signed in fire.', fail: 'The scrolls crumble in his hands.' },
        ],
        boss: { name: 'The Drowned King', text: 'On a throne of coral sits a crowned corpse. Its eyes open. "Who wakes the King of Vael?"', opts: ['fight', 'faith', 'talk', 'magic'], bonus: 10, reward: { gold: 260, fame: 5 }, ok: 'He lays the old king to rest. The treasury of Vael is his.', fail: 'The waters rise, and he barely escapes the hall.' },
    },
    {
        id: 'hills', name: 'The Redcap Hills', bg: 'hills', minAge: 12, base: 26, need: null,
        desc: 'Bandit country on the east road. Ambushes, rough camps, and the Redcap Gang.',
        steps: [
            { text: 'Bandits spring from the gorse. "Your purse or your horns, lad!"', opts: ['fight', 'talk', 'dragon'], reward: { gold: 60 }, ok: 'The bandits run, dropping a sack of stolen coin.', fail: 'He loses his purse. He keeps his horns.' },
            { text: 'A merchant wagon lies overturned, the driver trapped beneath.', opts: ['fight', 'dragon', 'faith'], reward: { mor: 1, fame: 1 }, ok: 'He lifts the wagon single-handed. The merchant swears to tell everyone.', fail: 'It takes all afternoon to dig him out.' },
            { text: 'A bandit lookout dozes on a crag above the camp.', opts: ['sneak', 'magic', 'talk'], reward: { cun: 0.8 }, ok: 'He steals the lookout\'s horn and the camp\'s plans.', fail: 'The lookout wakes and sounds the alarm.' },
            { text: 'The bandits\' cook offers him stew. It smells suspicious.', opts: ['talk', 'sneak', 'faith'], reward: { cha: 0.6, gold: 30 }, ok: 'The cook turns out to be a deserter who wants out. He gives up the gang\'s hiding place.', fail: 'The stew is drugged. He wakes up with lighter pockets.' },
            { text: 'A rope bridge over a gorge, half the planks missing.', opts: ['dragon', 'sneak', 'magic'], reward: { vit: 0.6 }, ok: 'He crosses with ease and cuts the rope behind him.', fail: 'He crosses. Eventually. Shaking.' },
        ],
        boss: { name: 'Red Jack, Bandit King', text: 'A scarred giant in a red cap rests a greataxe on his shoulder. "I heard they hatched you. I hear you\'re worth a fortune."', opts: ['fight', 'talk', 'dragon', 'sneak'], bonus: 10, reward: { gold: 300, fame: 6, fav: 2 }, ok: 'Red Jack goes back to the capital in chains, and the east road is safe again.', fail: 'Red Jack laughs as he flees. "Next time, little lizard."' },
    },
    {
        id: 'wastes', name: 'The Ashen Wastes', bg: 'wastes', minAge: 14, base: 40, need: null,
        desc: 'The old battlefield of the Dragon War. Nothing grows. Things walk.',
        steps: [
            { text: 'A field of rusted armour and dragon bones. Something is moving among them.', opts: ['faith', 'fight', 'magic'], reward: { fth: 1 }, ok: 'Restless soldiers\' ghosts. He gives them the rites and they sleep.', fail: 'He runs from the clattering dead.' },
            { text: 'An ash storm rolls across the plain like a wall.', opts: ['dragon', 'magic', 'sneak'], reward: { vit: 1 }, ok: 'He shelters inside a dragon\'s ribcage until it passes.', fail: 'He comes home grey with ash and coughing.' },
            { text: 'Scavengers are digging up a dragon\'s skull to sell.', opts: ['talk', 'fight', 'dragon'], reward: { drc: 1, mor: 0.6 }, ok: 'He buries the skull properly. The scavengers decide not to argue.', fail: 'The scavengers drive him off and take the skull.' },
            { text: 'A burned watchtower holds a soldier\'s diary from the last battle.', opts: ['sneak', 'magic', 'talk'], reward: { int: 0.8, gold: 80 }, ok: 'The diary speaks of a prince who walked into the dragon\'s camp unarmed. His father.', fail: 'The tower collapses as he climbs.' },
            { text: 'A lake of black glass where a dragon\'s fire once fell. It hums.', opts: ['dragon', 'magic', 'faith'], reward: { mag: 1, drc: 0.6 }, ok: 'He touches it and hears his mother\'s voice, very faint, singing.', fail: 'The glass cuts his hands.' },
        ],
        boss: { name: 'The Ash Revenant', text: 'From the cinders rises a knight of ash and fury, the war\'s last soldier. "DRAGONSPAWN."', opts: ['fight', 'faith', 'dragon', 'magic'], bonus: 12, reward: { gold: 380, fame: 7 }, ok: 'The Revenant falls to cinders, and for the first time in eighteen years, the wind on the Wastes is warm.', fail: 'He retreats. The Revenant does not follow beyond the bones.' },
    },
    {
        id: 'peaks', name: 'The Dragon Peaks', bg: 'peaks', minAge: 14, base: 44, need: 'wings',
        desc: 'The home of the dragons. Only a creature with wings can reach the high eyries.',
        steps: [
            { text: 'A young dragon challenges him to a race through the canyons.', opts: ['dragon', 'fight', 'sneak'], reward: { vit: 1, drc: 0.8 }, ok: 'He wins by a wingspan. The young dragon bows its head.', fail: 'He loses badly. The young dragons laugh for days.' },
            { text: 'An avalanche roars down on a herd of mountain goats.', opts: ['dragon', 'magic', 'fight'], reward: { mor: 1, fame: 1 }, ok: 'His fire melts a channel and the snow pours past the herd.', fail: 'He is buried to the neck and dug out by an amused dragon.' },
            { text: 'A dragon elder demands he recite the Lay of the First Flame.', opts: ['talk', 'magic', 'dragon'], reward: { drc: 1, elo: 0.6 }, ok: 'He recites it, then sings the human verse his father wrote. The elder is moved.', fail: 'He forgets the fourth stanza and is sent away.' },
            { text: 'A hoard cave guarded by a sleeping drake.', opts: ['sneak', 'talk', 'dragon'], reward: { gold: 150 }, ok: 'The drake sleeps on, and his pockets are heavier.', fail: 'The drake wakes. He leaves quickly.' },
            { text: 'Ice crystals on the high glacier sing in the wind.', opts: ['magic', 'faith', 'dragon'], reward: { mag: 1, art: 0.6 }, ok: 'He learns their song and brings it home in his heart.', fail: 'He gets frostbite in his tail.' },
        ],
        boss: { name: 'Skarrith the Storm-Scaled', text: 'A great blue dragon lands, and the mountain shakes. "A half-thing in our sky. Prove you belong in it."', opts: ['dragon', 'fight', 'talk', 'magic'], bonus: 14, reward: { gold: 200, fame: 6, drc: 2 }, ok: 'Skarrith lowers its great head. "You belong."', fail: 'Skarrith knocks him out of the sky. He limps home.' },
    },
    {
        id: 'shadowmere', name: 'The Shadowmere', bg: 'shadowmere', minAge: 16, base: 56, need: null,
        desc: 'A mist-drowned marsh where the old dark things went to sleep. Some of them are waking.',
        steps: [
            { text: 'Mist shapes whisper his name in his mother\'s voice.', opts: ['faith', 'magic', 'talk'], reward: { fth: 1, mag: 0.6 }, ok: 'He knows the voice is false, and says so. The mist recoils.', fail: 'He follows the voice for hours.' },
            { text: 'A bog troll demands a toll at a rotten bridge.', opts: ['fight', 'talk', 'dragon'], reward: { gold: 120 }, ok: 'The troll pays HIM a toll, to be left alone.', fail: 'He pays the toll. All of it.' },
            { text: 'A cult of shadow-worshippers chants around a black altar.', opts: ['sneak', 'fight', 'faith'], reward: { fame: 2, mor: 1 }, ok: 'He breaks the altar and scatters the cult.', fail: 'He is chased deep into the marsh.' },
            { text: 'A drowned library of a dark sorcerer, the books still dry.', opts: ['magic', 'sneak', 'talk'], reward: { mag: 1.2, int: 0.6 }, ok: 'He takes a grimoire and leaves the darkest books where they lie.', fail: 'The books scream when he opens them.' },
            { text: 'Something enormous moves under the black water.', opts: ['dragon', 'fight', 'sneak'], reward: { str: 1, vit: 0.6 }, ok: 'He meets its eye and it sinks away. Not today.', fail: 'A tentacle drags him under for a terrible moment.' },
        ],
        boss: { name: 'The Pale Wyrm', text: 'A colourless dragon, ancient and starving, uncoils from the mist. "A prince of two bloods. Twice the feast."', opts: ['dragon', 'magic', 'fight', 'faith'], bonus: 16, reward: { gold: 500, fame: 9, mag: 1 }, ok: 'The Pale Wyrm falls into the mere, and the mists lift for the first time in a hundred years.', fail: 'He escapes with his life and little else.' },
    },
];

export const REGION = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
