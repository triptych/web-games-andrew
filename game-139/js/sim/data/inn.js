// CLEAN SLATE — the inn itself: rooms you can build, the days between nights, the narrator.

/** Rooms: run-long upgrades bought with tips. One unbuilt room is on offer each day. */
export const ROOMS = {
    snug: { id: 'snug', name: 'The Snug', price: 26, text: 'Draw one more card each round.', art: 'a tiny wood-panelled snug room with two armchairs, a low table and a crackling stove' },
    cellar: { id: 'cellar', name: 'Wine Cellar', price: 20, text: 'Start every round with 2 Composure.', art: 'a vaulted stone wine cellar lined with barrels and dusty bottles, lit by one lantern' },
    kitchen: { id: 'kitchen', name: 'Big Kitchen', price: 18, text: 'Heal 5 after every night you win.', art: 'a bustling inn kitchen with copper pots hanging, herbs drying and a huge iron stove' },
    garden: { id: 'garden', name: 'Quiet Garden', price: 16, text: 'Pour one out twice a round.', art: 'a small walled herb garden behind an inn with a stone bench and a little fountain at dusk' },
    board: { id: 'board', name: 'Notice Board', price: 14, text: 'Rivals deal one more row face up.', art: 'a cork notice board crowded with room notices, a lost cat poster and a torn old wanted poster' },
    fireplace: { id: 'fireplace', name: 'Great Fireplace', price: 22, text: '+10 most Resolve, and heal 10 now.', art: 'a huge carved stone fireplace with a roaring fire and stockings drying on the mantel' },
    sign: { id: 'sign', name: 'New Signboard', price: 15, text: '+5 tips for every night you win.', art: 'a freshly painted blank wooden hanging inn sign swinging over a door, no writing on it' },
};

/** The days between nights: one of these happens (or none) before the letters arrive. */
export const INTERLUDES = [
    {
        id: 'stranger', text: 'A hooded figure in the corner has been brooding over one drink for an hour. Cloaks, it seems, are mandatory for brooding.',
        options: [
            { label: 'Bring them a free refill', fx: { heal: 5 }, result: 'It was a lost pilgrim. They cried a little. You feel lighter.' },
            { label: 'Brood back, professionally', fx: { notoriety: 1, tips: 6 }, result: 'They left a large tip and a larger rumour.' },
        ],
    },
    {
        id: 'sword', text: 'There is a sword stuck in a stone in your cellar. This is not even your genre.',
        options: [
            { label: 'Pull it out', fx: { card: 'hidden', notoriety: 1 }, result: 'It slides free. Of course it does. Your hands remember.' },
            { label: 'Use it as a coat rack', fx: { maxResolve: 4 }, result: 'It is an excellent coat rack. Somewhere, a prophecy weeps.' },
        ],
    },
    {
        id: 'bard', text: 'A bard wants to write a ballad about "the legendary Nightfall".',
        options: [
            { label: 'Pay them to write about the stew', fx: { tips: -5, notoriety: -1 }, result: '"Ode to a Stew" is, frankly, a banger.' },
            { label: 'Let them', fx: { tips: 8, notoriety: 1 }, result: 'Fans come. They want autographs. On knives.' },
        ],
    },
    {
        id: 'merchant', text: 'The Narrator would like to point out that this is the part of the story where a mysterious travelling merchant appears.',
        options: [
            { label: 'Fine. Hello, merchant.', fx: { card: 'random' }, result: 'The merchant leaves something on the bar and vanishes. Very on-brand.' },
            { label: 'Not today, Narrator', fx: { heal: 6 }, result: 'You take a nap instead. The Narrator sulks.' },
        ],
    },
    {
        id: 'poster', text: 'Your old wanted poster has been pinned to the Notice Board. The likeness is deeply unflattering.',
        options: [
            { label: 'Tear it down', fx: { notoriety: -1 }, result: 'You burn it in the fireplace. It smells like the past.' },
            { label: 'Frame it behind the bar', fx: { tips: 10, notoriety: 1 }, result: 'Tourists love it. You hate that tourists love it.' },
        ],
    },
    {
        id: 'cat', text: 'A cat has moved into the inn. It did not ask. It sits on the guest book like it owns the place.',
        options: [
            { label: 'Adopt it', fx: { maxResolve: 4, heal: 4 }, result: 'You name it Ledger. It knocks a mug off the bar. Home.' },
            { label: 'Name it "Dagger"', fx: { notoriety: 1, tips: 4 }, result: 'Dagger catches three mice and one pickpocket.' },
        ],
    },
    {
        id: 'client', text: 'A letter from a former client: "Are you still in business?" You are. A different business.',
        options: [
            { label: 'Reply: "Rooms from two silver"', fx: { tips: 6 }, result: 'They booked a week. They were very confused.' },
            { label: 'Burn it', fx: { notoriety: -1 }, result: 'The ash floats up the chimney. Good riddance.' },
        ],
    },
    {
        id: 'mirror', text: 'You catch your reflection while polishing glasses. You look... happy? Deeply unsettling.',
        options: [
            { label: 'Keep polishing', fx: { polish: 1 }, result: 'One of your cards gleams a little brighter.' },
            { label: 'Practise your old scowl', fx: { card: 'habit', notoriety: 1 }, result: 'Still got it. That is the problem.' },
        ],
    },
    {
        id: 'tutorial', text: 'The Narrator clears its throat. "Reminder: pairs add up to thirteen. Kings settle alone. Blades are very, very tempting."',
        options: [
            { label: '"I know. I live here."', fx: { tips: 3 }, result: 'The Narrator mutters something about ungrateful protagonists.' },
            { label: '"Thank you, Narrator."', fx: { heal: 3 }, result: 'The Narrator is visibly moved. It is a voice. It manages.' },
        ],
    },
];

/** The narrator's voiced lines (dev/audio/ holds the recordings, vo-narrator-<key>.mp3). */
export const NARRATOR = {
    intro: "Once upon a time, the deadliest assassin in the five cities hung up the knives, bought a crumbling inn, and painted a fresh sign. This is not that kind of story. Well. It's a little bit that kind of story.",
    tutorial: "Pair cards that add up to thirteen. Meet them halfway. You used to meet people very differently.",
    blade: "Ah. Old habits. Very efficient. Very... you.",
    partner: "And just like that, the staff got bigger and the body count stayed exactly the same.",
    refuse: "They saw the knife work. Trust, like stew, takes time.",
    act2: "Word gets around. The Busy Season begins, and so do the visitors who want a word. Or a fight. Usually both.",
    act3: "The Grand Reopening. Everyone you ever wronged has accepted the invitation.",
    thorn: "And here she is. Every story about leaving home ends with someone from home showing up.",
    over: "And so the innkeeper picked up the blade again. The end. Or, as the sequel would put it, the beginning.",
    slate: "The sign stayed clean. It turns out the past doesn't get a vote.",
    nightfall: "The inn survived. Its reputation did not. Some stains don't come out with ale.",
    open: "The doors stayed open. Not everyone stayed for a drink. But enough did.",
};

export const ENDINGS = {
    slate: {
        title: 'A Clean Slate',
        text: 'Mother Thorn takes the corner seat, the one by the fire. She orders the stew. She orders it again the next night, and the next. The knives stay in the river. Your staff argue about the menu, and the Choir sings on Fridays, badly. Nobody asks for Nightfall any more. They ask for the innkeeper.',
    },
    open: {
        title: 'Open for Business',
        text: 'Mother Thorn leaves without a word, but she leaves a coin on the bar. The inn stays open. Some nights are quiet and some nights someone from the old life knocks. You answer the door with a mug instead of a blade, most of the time. It is enough. It is more than enough.',
    },
    nightfall: {
        title: 'Nightfall, Innkeeper',
        text: 'You won. Of course you won: you were always the best at the old work. The inn stands, but the town crosses the street to avoid it, and the regulars sit with their backs to the wall. The sign is clean. Your hands are not. Maybe next season.',
    },
};

/** How the run ends: the more you let go, the better it goes. */
export function endingFor({ notoriety, partners, blades }) {
    if (notoriety >= 10) return 'nightfall';
    if (partners >= 6 && blades <= 2) return 'slate';
    return 'open';
}
