/**
 * story.js — the authored storyline: "Tomebound".
 *
 * Scenes are arrays of { who, text }. who: 'owl' (Professor Hootsworth), 'hero', 'boss'
 * (the foe in context), 'unwriter', 'narrator'. {name} is the hero's name, {cls} the class.
 * game.js queues scenes on the profile (profile.story.queue) so a reload resumes them.
 */

export const SPEAKERS = {
    owl:      { name: 'Professor Hootsworth', icon: '🦉', color: '#ffcf6a' },
    hero:     { name: '{name}', icon: '{icon}', color: '#7fe3ff' },
    boss:     { name: '{boss}', icon: '👹', color: '#ff7a7a' },
    unwriter: { name: 'The Unwriter', icon: '✒️', color: '#b48cff' },
    narrator: { name: '', icon: '📖', color: '#ffffff' },
};

export const SCENES = {
    prologue: [
        { who: 'narrator', text: 'Once upon a time — which is how the best times start — the Great Library of Lumenhall held every story ever told.' },
        { who: 'narrator', text: 'Then one quiet Tuesday, a smudge of living ink crept out of a forgotten footnote. It called itself the Unwriter, and it did not like stories one bit.' },
        { who: 'narrator', text: 'It blotted the thirteen greatest books, flung them into the Library\'s wings, and the wings grew wild without their stories.' },
        { who: 'owl', text: 'Ah! A visitor! Please mind the rubble, and the slime, and — oh, you\'re the new {cls} from the Academy? Splendid. Absolutely splendid. I am Professor Hootsworth, Keeper of the Library. Currently Keeper of a pile.' },
        { who: 'hero', text: 'Graduated top of my class! Well, top half. Well — I graduated. Where do I start?' },
        { who: 'owl', text: 'With enthusiasm like that? Anywhere! But let\'s start with a roof over the village. The townsfolk fled when the colour drained out of things. Build them a Lumber Camp and they\'ll come back.' },
        { who: 'owl', text: 'Then into the Sunlit Atrium. The monsters in there fight with the Library\'s own magic: gems. Match three in a row to take their power. Match skulls to bonk. Match more than three and you go again. Simple! Mostly.' },
        { who: 'owl', text: 'Every book you bring home will teach this town something wonderful. Thirteen books, {name}. Let\'s write a happy ending.' },
    ],
    tutorial: [
        { who: 'owl', text: 'Swap two neighbouring gems to make a line of three. Drag a gem, or tap it and then a neighbour.' },
        { who: 'owl', text: 'Coloured gems fill your mana. Skulls hurt your foe. Coins are gold and stars are experience. And the monster plays the very same board — every gem you take is one it can\'t!' },
        { who: 'owl', text: 'When a spell glows, it\'s ready. Tap it! Most spells end your turn; the ones marked "Quick" don\'t.' },
    ],
    wing_0: [
        { who: 'owl', text: 'The Sunlit Atrium! It used to be the reading garden. Now it\'s... a slightly more aggressive reading garden.' },
        { who: 'owl', text: 'Two books are hiding in here. Slime Sovereign Bramblegob is sitting on one, and I\'d bet my spectacles Grandmother Thornback has the other.' },
    ],
    keeper_pre_0: [
        { who: 'boss', text: 'BLORP. This shiny book is MINE. It goes "fzzt" when I sit on it.' },
        { who: 'hero', text: 'That\'s the Primer of Sparks! Children learn their first spells from it!' },
        { who: 'boss', text: 'Then come and learn your LAST spell. Blorp.' },
    ],
    keeper_post_0: [
        { who: 'boss', text: 'Blorp... fine. It was getting itchy anyway.' },
        { who: 'owl', text: 'The Primer of Sparks! Look — the light in the Atrium is coming back already. Every Spark you match will crackle a little brighter now.' },
    ],
    guardian_pre_0: [
        { who: 'boss', text: 'Hoo-RRRR. Little one. This is my nest, and this almanac is my nest\'s favourite pillow.' },
        { who: 'owl', text: 'Grandmother Thornback! It\'s me, Hootsworth! We used to share a branch!' },
        { who: 'boss', text: 'The ink got into my feathers, Hootsworth. Everything is so very grey. Make it bright again — if you can.' },
    ],
    guardian_post_0: [
        { who: 'boss', text: '...Oh. Oh, the colours. I had forgotten green could be so green.' },
        { who: 'owl', text: 'The Gardener\'s Almanac! The townsfolk will want to plant an herb garden immediately. Gardeners are like that.' },
        { who: 'unwriter', text: 'Little {cls}. You are colouring outside the lines. I will rub you out.' },
        { who: 'owl', text: '...That was the Unwriter. It\'s noticed you. Which means you\'re doing wonderfully! Probably.' },
    ],
    wing_1: [
        { who: 'owl', text: 'The Ember Archives. Toasty. The imps in here have filed every single book under "F" for "Fire". Which is a problem, in an archive.' },
    ],
    keeper_pre_1: [
        { who: 'boss', text: 'Halt! Have you a library card? Have you a FIRE library card? Then you shall be filed. Under "F". For "Fried".' },
    ],
    keeper_post_1: [
        { who: 'boss', text: 'My filing system... ruined... it was so beautifully on fire...' },
        { who: 'owl', text: 'The Ember Codex! Smiths in the village will be able to forge real gear now. Shiny gear. Gear with names!' },
    ],
    guardian_pre_1: [
        { who: 'boss', text: 'I am Pyrrhax, the Footnote Drake! I live at the bottom of every page, and I have READ EVERYTHING.' },
        { who: 'hero', text: 'Then you know how this story ends.' },
        { who: 'boss', text: 'I skipped to the end. It said "the hero was very crispy". ROAR!' },
    ],
    guardian_post_1: [
        { who: 'boss', text: 'Hmph. Perhaps I misread. The print down here is very small.' },
        { who: 'owl', text: 'The Bestiary of Bright Beasts! It knows what every monster is weak to. And it has a lovely chapter on their feelings.' },
        { who: 'unwriter', text: 'Four. You have four. I have nine. Arithmetic favours me, {name}.' },
    ],
    wing_2: [
        { who: 'owl', text: 'The Tidal Stacks. Someone left a tap running in about the year 800. Bring a towel. Bring two.' },
    ],
    keeper_pre_2: [
        { who: 'boss', text: 'Arrr! Captain Clatterclaw, terror of the Stacks! These Tide Tables be MY treasure map!' },
        { who: 'hero', text: 'It\'s a book about tides.' },
        { who: 'boss', text: 'And I be a crab who LOVES tides! Have at ye!' },
    ],
    keeper_post_2: [
        { who: 'boss', text: 'Ye fight like a whole lighthouse. Take it, take it.' },
        { who: 'owl', text: 'The Tide Tables! Our alchemist — well, our future alchemist — will be thrilled. Potions, {name}! Bubbly, glowing potions!' },
    ],
    guardian_pre_2: [
        { who: 'boss', text: 'I am the Abyssal Errata. Every mistake ever printed sinks down to me. I am VERY large.' },
        { who: 'owl', text: 'It is the typos of a thousand years, {name}. Be brave. Be accurate.' },
    ],
    guardian_post_2: [
        { who: 'boss', text: 'Corrected... I have been... corrected...' },
        { who: 'owl', text: 'The Ledger of Lost Coins! Our market will never be short of change again.' },
        { who: 'unwriter', text: 'Do you know what is on a page before it is written, {name}? Peace. Quiet. Nothing. I am only taking it back.' },
        { who: 'hero', text: 'Blank pages aren\'t peaceful. They\'re waiting.' },
    ],
    wing_3: [
        { who: 'owl', text: 'The Storm Gallery. The portraits in here gossip, and the lightning keeps interrupting them. Nobody gets a word in.' },
    ],
    keeper_pre_3: [
        { who: 'boss', text: 'Zzzt! Voltessa is FASTEST. Voltessa is BRIGHTEST. Voltessa is borrowing this book forever!' },
    ],
    keeper_post_3: [
        { who: 'boss', text: 'Zzz... okay, you\'re a little bit fast too.' },
        { who: 'owl', text: 'The Thunder Psalter! With this, we can raise a Mage Tower and teach your spells to sing. Literally. They\'ll hum.' },
    ],
    guardian_pre_3: [
        { who: 'boss', text: '...' },
        { who: 'owl', text: 'Old Granite Gargantua hasn\'t spoken in four hundred years. He used to hold up the Gallery roof.' },
        { who: 'boss', text: '...TIRED... OF... HOLDING.' },
    ],
    guardian_post_3: [
        { who: 'boss', text: '...THANK... YOU.' },
        { who: 'owl', text: 'The Atlas of Winds. Our storehouses will keep twice as much now — the winds will mind them while you\'re away.' },
        { who: 'narrator', text: 'Halfway. The village has colour again, and chimneys, and a baker who will not stop giving you buns.' },
    ],
    wing_4: [
        { who: 'owl', text: 'The Clockwork Scriptorium. The copying machines have been copying copies of copies. Most of the books in here now just say "the the the".' },
    ],
    keeper_pre_4: [
        { who: 'boss', text: 'TICK. TOCK. IT IS TIME FOR YOU TO STOP.' },
        { who: 'hero', text: 'Is that... the only thing you say?' },
        { who: 'boss', text: 'TICK.' },
    ],
    keeper_post_4: [
        { who: 'boss', text: 'TOCK...' },
        { who: 'owl', text: 'The Clockmaker\'s Manual! We can build a Clocktower — every building in town will work faster. The bakers are going to be unstoppable.' },
    ],
    guardian_pre_4: [
        { who: 'boss', text: 'Welcome, welcome, customer! Everything in my hoard is for sale, and the price is EVERYTHING YOU OWN.' },
    ],
    guardian_post_4: [
        { who: 'boss', text: 'A refund?! Nobody gets a refund! ...Oh, very well.' },
        { who: 'owl', text: 'The Grimoire of Gears! It\'s ticking. It\'s ticking at you, {name}. I think it likes you.' },
        { who: 'unwriter', text: 'Ten. Ten books returned. You are making this... difficult. I will be waiting at the top.' },
    ],
    wing_5: [
        { who: 'owl', text: 'The Starlit Observatory. The top of the Library, open to the sky. The Unwriter has been eating the stars, {name}. One by one.' },
    ],
    keeper_pre_5: [
        { who: 'boss', text: 'Shhhhh. This is a LIBRARY. And you are being... very... LOUD.' },
        { who: 'owl', text: 'The Pale Librarian! She shushed me in 1312 and I still haven\'t recovered.' },
    ],
    keeper_post_5: [
        { who: 'boss', text: '...You may check this one out. Return it on time.' },
        { who: 'owl', text: 'The Star Chart! You\'ll be able to carry one more spell into every fight.' },
    ],
    guardian_pre_5: [
        { who: 'boss', text: 'I AM STARMAW. I have swallowed nine constellations and I am still PECKISH.' },
        { who: 'hero', text: 'Then let\'s give you something to chew on.' },
    ],
    guardian_post_5: [
        { who: 'boss', text: 'Urp. ...I may have overdone it.' },
        { who: 'narrator', text: 'Out of Starmaw\'s mouth tumble nine constellations, blinking and bewildered, and they float back up to where they belong.' },
        { who: 'owl', text: 'The Lexicon of Light. Twelve books, {name}. Only one left. The First Book. And the Unwriter is holding it.' },
    ],
    final_pre: [
        { who: 'narrator', text: 'Past the last shelf, past the last page, there is a margin. White, wide and silent.' },
        { who: 'unwriter', text: 'Here we are. The edge of the story. Look how clean it is. No monsters. No heroes. No endings to be sad about.' },
        { who: 'hero', text: 'No beginnings, either. No buns. No Hootsworth. No colour.' },
        { who: 'unwriter', text: 'Every story ends, {name}. I only want them to end... sooner.' },
        { who: 'owl', text: 'Then let\'s show it a good one! For Lumenhall, {name}! For every book!' },
    ],
    final_post: [
        { who: 'unwriter', text: 'Why... does it feel... warm?' },
        { who: 'narrator', text: 'The ink of the Unwriter runs and swirls, and where it falls, it writes. Not blots — words. A first line. Then another.' },
        { who: 'unwriter', text: '"Once upon a time"... I was a footnote nobody read. I was so lonely at the bottom of the page.' },
        { who: 'hero', text: 'Then come up and join the story.' },
        { who: 'owl', text: 'The First Book. The very first. Oh, {name}. Oh, well done. Well, WELL done.' },
    ],
    ending: [
        { who: 'narrator', text: 'The Great Library of Lumenhall is full again: thirteen books on thirteen shelves, and every one of them glowing.' },
        { who: 'narrator', text: 'The village has a market and a forge and a clocktower and far too many buns. The Unwriter now works in the Library as a fact-checker. It is very, very good at it.' },
        { who: 'owl', text: 'And you, {name}? There\'s a staircase at the back of the First Book that goes down forever. The Endless Stacks. Nobody has ever seen the bottom.' },
        { who: 'hero', text: 'Sounds like the start of a story.' },
        { who: 'narrator', text: 'THE END — and, as always, the beginning.' },
    ],
};

/** Lines Hootsworth says the first time a building becomes available. */
export const UNLOCK_LINES = {
    market: 'The traders are back! Build a Market and the coins will roll in. Mostly roll. Some bounce.',
    quarry: 'You\'re strong enough to help at the Quarry now. Stone, {name}! For walls and towers and very sturdy shelves.',
    guild: 'Adventurers are asking for a Guild Hall. More quests on the board, and better rewards!',
    herbs: 'The Gardener\'s Almanac says the soil here is perfect for an Herb Garden.',
    forge: 'With the Ember Codex we can build a Forge! Craft gear with names like "Blazing Oak Staff of the Owl".',
    training: 'A Training Yard is ready to be built. You\'ll get stronger even while you\'re off doing other things.',
    alchemist: 'The Tide Tables let us build an Alchemist. Potions! Bring them into battle for a quick boost.',
    storehouse: 'A Storehouse keeps the town working longer while you\'re away.',
    crystal: 'Crystals under the hill! A Crystal Mine will help with potions and spell ranks.',
    magetower: 'The Thunder Psalter teaches us to raise a Mage Tower — rank up your spells there.',
    scriptorium: 'Our scribes want a Scriptorium. They make ink, and they can study the books you\'ve rescued to make them even stronger.',
    clocktower: 'With the Clockmaker\'s Manual we can build a Clocktower. Everything in town will run faster!',
};

export function sceneFor(key) {
    if (key && key.startsWith('unlock_')) {
        const line = UNLOCK_LINES[key.slice(7)];
        return line ? [{ who: 'owl', text: line }] : null;
    }
    return SCENES[key] || null;
}
