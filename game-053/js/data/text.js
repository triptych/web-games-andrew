// Text for the simulated server: player handles, personalities and their
// chat lines, keyword replies, news lines and mail.
// Placeholders: {p} you, {n} a random online player, {who} the subject of a
// news item, {lvl}, {foe}, {item}, {loc}, {me} the speaker.

export const HANDLES = [
    'Kaz', 'Elowen', 'GrimTusk', 'bob the brave', 'xXShadowWolfXx', 'Thessaly', 'Brannigan', 'Mireth', 'Sir Reginald', 'Pip',
    'DarkLordBarry', 'Nyx', 'Oswin', 'Lady Ravenna', 'Tobble', 'Vex', 'Wren', 'Hargrim', 'Seraphine', 'n00bslayer',
    'Duskfang', 'Marigold', 'Bjorn', 'Isolde_2', 'Fizzwick', 'Corvina', 'Thane Aldric', 'Lirael', 'Mudface', 'Quillon',
    'Rowan', 'Ashkettle', 'BigSteve', 'Gwendolyn', 'Talia', 'Ironjaw', 'Yseult', 'Puck', 'Morwen', 'Cedric the Red',
    'Zephyrine', 'Grub', 'Halvard', 'Lyra Moonwhisper', 'Dorran', 'Jinx', 'Ebba', 'Faelan', 'Kragg', 'Odessa',
    'Tamsin', 'wolfie', 'Brynja', 'Lord Fluffington', 'Sable', 'Ingrith', 'Pellam', 'Rook', 'Valka', 'Merriweather',
    'Ansel', 'Scrimshaw', 'Belladonna', 'Taran', 'Gilly', 'Hrothgar', 'Ondine', 'Ferris', 'Ysolda', 'Captain Haddock',
];

export const PERSONALITIES = {
    newbie: { weight: 14, chatty: [0.35, 0.7], aggression: [0, 0.15], skill: [0.2, 0.55] },
    veteran: { weight: 10, chatty: [0.3, 0.6], aggression: [0.1, 0.4], skill: [0.65, 0.95] },
    roleplayer: { weight: 10, chatty: [0.4, 0.8], aggression: [0.05, 0.3], skill: [0.35, 0.75] },
    braggart: { weight: 8, chatty: [0.4, 0.75], aggression: [0.55, 0.95], skill: [0.45, 0.85] },
    bard: { weight: 5, chatty: [0.35, 0.65], aggression: [0, 0.2], skill: [0.3, 0.7] },
    merchant: { weight: 5, chatty: [0.3, 0.55], aggression: [0.05, 0.3], skill: [0.35, 0.7] },
    lurker: { weight: 8, chatty: [0.03, 0.15], aggression: [0.1, 0.6], skill: [0.3, 0.8] },
};

// General chatter by personality. Lines starting with ':' are emotes.
export const CHAT = {
    newbie: [
        'how do i level up?', 'where do u buy armor', 'just died to a goose. a GOOSE', 'what does thrillseeking do exactly',
        'is the wyrm hard?', 'hi everyone!! im new', 'how do i get gems', 'lol i keep dying in the forest',
        'can someone explain the bank', 'whats a master', 'i just bought a hatchet!!', 'what level should i be to fight trolls',
        'why cant i fight anymore today', 'is it worth buying a mule', 'does charm do anything', 'omg i found a gem',
        'what happens if u sleep in the fields', 'who is vorgath and why is he so mean', 'how long does it take to get to 15',
        'i flirted with willa and she threw a drink at me lol', 'ok which specialty is best', 'hi :)',
    ],
    veteran: [
        'Reminder: always bank your gold before heading into the forest.', 'Sleep at the inn if you\'re carrying anything worth stealing.',
        'Master won\'t take you until you\'ve got the XP. Ask him how close you are.', 'Thrillseeking is worth it once you outgear your level.',
        'Charm matters if you want to marry. Gardens once a day, it adds up.', 'Don\'t fight the Wyrm with half HP. Heal first. Trust me.',
        'Gems are worth more at Zorya\'s than anywhere else.', 'The healer gets pricier every level. Budget for it.',
        'Mounts pay for themselves in extra forest fights.', 'First wyrm kill took me 38 days. No shame in slow.',
        'Back in my day the forest had TWO healers.', ':leans on the well, watching the gate.',
        'Use your specialty. Too many people forget they even have one.', 'Flawless fights give you a free forest turn, by the way.',
        'Evening, all.', 'Quiet night.',
    ],
    roleplayer: [
        ':sharpens a blade by the well, humming an old marching song.', ':tips their hood to passers-by.', ':counts a handful of coppers, frowning.',
        ':sits on the edge of the fountain and pulls off a muddy boot.', ':stretches, joints cracking. "Long road from the Deepholds."',
        '"The Gloamwood was restless last night. Did any of ye hear the howling?"', ':scribbles something in a battered journal.',
        ':orders a round for the house, then realises they cannot afford it.', '"Mark me, the Wyrm stirs. The birds have gone quiet."',
        ':carves a small wooden fox and leaves it on the well\'s edge.', '"Fair evening to thee, travellers."', ':nods respectfully to {n}.',
        ':brushes pine needles out of their hair.', '"I have walked the Barrow Field. I do not recommend it."',
    ],
    braggart: [
        'just one-shot a forest troll lol', 'who wants to fight me', 'flawless run in the forest again, too easy',
        'top of the hall soon, watch', 'my sword is bigger than your sword', '{n} you sleeping in the fields tonight? asking for a friend',
        'BOW BEFORE ME', 'the wyrm should be scared tbh', 'got three gems today, how many did you get',
        'anyone level 9 want a beating', 'imagine dying to a wolf spider. couldnt be me', 'gg ez',
    ],
    bard: [
        '🎵 Oh the Wyrm sleeps deep, and the Wyrm sleeps long, but it wakes for a hero\'s song... 🎵', ':strums a lute and clears their throat.',
        '"A ballad for the fallen, friends." :plays something slow and sad.', ':composes a limerick about Brannoc\'s beard.',
        '🎵 There once was a goose by the mere, who struck every farmhand with fear... 🎵', '"Corwin stole my best verse again."',
        ':tunes the lute, badly.', '"Who wants their deeds in song? Five gold a verse."', '🎵 Fa-la, the healer\'s fees, fa-la, have brought me to my knees 🎵',
    ],
    merchant: [
        'selling gems, 600 gold each, mail me', 'buying wolf pelts. also buying anything.', 'anyone want a slightly used pitchfork',
        'Brannoc\'s ale is overpriced, just saying', 'bank interest is the real endgame', 'trading a mule for a pony, any takers',
        ':sets up a little blanket of trinkets by the well.', 'prices at Grimbold\'s went up AGAIN?', 'investment tip: buy low, sell high, don\'t die',
    ],
    lurker: ['...', 'hi', 'afk', 'brb', 'o/', 'yep', 'lol', 'hmm', ':nods.'],
};

export const GREET = ['hi {p}!', 'welcome {p}', 'hey {p}', 'o/ {p}', 'evening {p}', ':waves at {p}.', 'hiya {p}', 'well met, {p}', 'yo {p}'];
export const GREET_NEW = ['welcome to hollowmere {p}!!', 'oh hey, a new face. welcome {p}', 'welcome {p}! bank your gold, sleep at the inn, you\'ll be fine', 'fresh farmhand! hi {p} :)', 'welcome {p}, ask if you need anything'];
export const BYE = ['night all', 'gotta go, cya', 'logging, gn', 'off to bed, sleep at the inn kids', 'bye o/', ':heads off toward the inn.'];

// Reactions to world news. {who} is the subject.
export const REACT = {
    dk: ['GRATS {who}!!!', '{who} killed the wyrm?? respect', 'gz {who} 🐉', 'another one for the hall. well done {who}', 'how many is that now {who}', ':raises a tankard to {who}.'],
    level: ['gz {who}', 'nice {who}', 'grats on the level {who}'],
    death: ['rip {who}', 'f for {who}', '{who} got got lol', 'the forest giveth, the forest taketh. rip {who}'],
    pvp: ['{who} is on a rampage', 'sleep at the inn folks, {who} is out hunting', 'yikes, {who} again'],
    wed: ['congrats to the happy couple!!', 'aww {who} got married', ':throws rice at {who}.'],
};

// Reactions to *you* (the player).
export const REACT_YOU = {
    level: ['gz {p}!', 'nice level {p}', 'grats {p}, level {lvl} already?', ':claps for {p}.'],
    dk: ['{p} SLEW THE WYRM?!', 'HUGE grats {p}!!!', 'all hail {p}, wyrmslayer', 'welcome back to farmhand life {p} lol (gz!!)', ':bows deeply to {p}.'],
    death: ['rip {p}', 'oof {p}', 'happens to all of us {p}', 'lol {p} died to a {foe}', 'get well soon {p}'],
    gear: ['ooh nice {item} {p}', 'shiny {item}, {p}', '{p} looking dangerous with that {item}'],
    pvpwin: ['{p} is out hunting. lock your doors', 'whoa {p} took down {who}', '{p} has teeth!'],
    pvploss: ['{who} wrecked {p} lol', 'rip {p}, {who} is no joke'],
    married: ['congrats {p}!!', '{p} got married?! aww', ':throws flower petals at {p}.'],
    drunk: ['{p} is HAMMERED lol', 'someone take {p}\'s tankard away', 'go home {p} you\'re drunk'],
};

// Replies to the player's messages, matched by keyword (first match wins).
export const REPLIES = [
    { k: /\b(hi|hello|hey|yo|evening|morning|greetings|howdy|o\/)\b/i, r: ['hi {p}', 'hey {p}!', 'o/', 'evening {p}', 'well met {p}', ':waves to {p}.', 'hiya'] },
    { k: /\b(bye|gn|goodnight|night|cya|logging|brb)\b/i, r: ['night {p}', 'cya {p}', 'sleep at the inn!', 'gn {p}', 'o/'] },
    { k: /\b(level|xp|exp|master)\b/i, r: ['talk to your master at the Proving Yard, they\'ll tell you how close you are', 'kill stuff your own level, levels come fast early on', 'thrillseek for more xp if you can handle it'] },
    { k: /\b(gem|gems)\b/i, r: ['gems come from forest events mostly', 'fairies love gems, just saying', 'i\'ll buy gems! mail me', 'save gems for a mount'] },
    { k: /\b(wyrm|dragon)\b/i, r: ['level 15, full hp, best gear, then go for it', 'the wyrm breathes fire every few rounds, keep your hp up', 'my first wyrm kill was the best day of my life', 'the wyrm is no joke'] },
    { k: /\b(heal|healer|hp|health)\b/i, r: ['Mother Nettle in the forest. pricey but worth it', 'heal before you fight anything big', 'regen potions from zorya if you have gems'] },
    { k: /\b(gold|money|bank|poor)\b/i, r: ['bank everything before you go in the forest', 'you lose gold on hand when you die, bank it!', 'interest is small but it adds up'] },
    { k: /\b(pvp|kill|attack|fight me|duel)\b/i, r: ['you can only hunt people sleeping in the fields', 'sleep in the inn and no one can touch you', 'come at me {p}', 'not today {p}'] },
    { k: /\b(willa|corwin|flirt|marry|love|charm)\b/i, r: ['charm charm charm. gardens every day', 'willa threw a drink at me once lol', 'corwin is a heartbreaker', 'charm potions at zorya\'s'] },
    { k: /\b(lol|haha|lmao|rofl|xd)\b/i, r: ['lol', 'haha', ':snorts.', 'lmao'] },
    { k: /\b(thanks|thank you|thx|ty)\b/i, r: ['np {p}', 'anytime', 'no problem', 'good luck out there {p}'] },
    { k: /\b(help|how|what|where|why|\?)\b/i, r: ['check the help page, it explains most stuff', 'ask a vet, we don\'t bite (much)', 'hmm good question {p}', 'not sure tbh', 'i think the answer is always "bank your gold"'] },
    { k: /.*/, r: ['true', 'lol', 'hmm', 'fair', 'agreed', 'heh', ':nods at {p}.', 'ya', 'same', 'nice'] },
];

// Mail from simulated players.
export const MAIL_WELCOME = (p, admin) => ({
    from: admin, subject: 'Welcome to Hollowmere!',
    body: `Hello ${p}, and welcome to the realm!\n\nA few things every new warrior should know:\n\n• You have a limited number of forest fights each day. Use them wisely.\n• Gold you carry is lost if you die. The Counting House keeps it safe.\n• Sleeping in the fields is free, but other warriors can attack you there overnight. A room at the Crooked Antler keeps you safe.\n• Your master at the Proving Yard decides when you are ready for the next level.\n• At level 15, the Jade Wyrm awaits in the deepest part of the Gloamwood.\n\nBe kind in the square, and petition me if anything seems broken.\n\n— ${admin}, Keeper of the Realm`,
});

export const MAIL_GIFT = [
    'Saw you in the square. Here\'s a little something to get you started — buy yourself a real weapon. Pay it forward someday.',
    'Everybody needed help at the start. Take this, and stay out of the fields at night.',
    'Found more than I needed in the forest today. Figured you could use it.',
];

export const MAIL_REPLY = {
    newbie: ['omg thanks for the mail!! im still figuring stuff out lol', 'hey! do u know how to get gems? i have like 1', 'thanks!! maybe we can hunt together sometime (can we do that??)'],
    veteran: ['Good to hear from you. Keep your gold banked and you\'ll do fine.', 'Thanks for writing. If you ever want advice on the Wyrm, ask.', 'Appreciated. See you in the square.'],
    roleplayer: ['*unfolds the letter by candlelight* Thy words reached me well, friend. May the Gloamwood spare thee.', 'Greetings and well met. I shall raise a cup to thee at the Antler.', 'Thy raven found me at the well. I thank thee for the kindness.'],
    braggart: ['lol why are you mailing me', 'cool. still gonna beat you in the hall tho', 'you want lessons? its gonna cost you'],
    bard: ['A letter! I shall set it to music. 🎵', 'Thank you, friend — you\'ve inspired a verse or two.', 'Delightful! Come hear me play at the Antler sometime.'],
    merchant: ['Thanks! Interested in buying gems by any chance? Good prices.', 'Always happy to do business. What can I sell you?', 'Got your mail. Remember: buy low, sell high.'],
    lurker: ['ok', 'thx', 'hey'],
};

export const MAIL_GUILD_INVITE = (guild, from) => `Hey! We\'ve had our eye on you. ${guild} is recruiting and we think you\'d fit right in. Visit Guildhall Row if you want in.\n\n— ${from}`;

export const PETITION_REPLIES = [
    'Thank you for your petition. I\'ve looked into it and I believe everything is working as intended, but I appreciate you taking the time. Good luck out there!',
    'Petition received! The realm thanks you. If the goose is giving you trouble, I suggest heading to the healer first.',
    'Thanks for writing in. I\'ve passed this on to the gnomes who maintain the realm. They say "hrm".',
];

// Overheard gossip at the bar.
export const GOSSIP = [
    'They say {n} slept in the fields three nights running and nobody touched them. Lucky, or dangerous?',
    'Word is the healer charges double if she doesn\'t like your face. Be nice to Mother Nettle.',
    'Someone saw the Wyrm\'s eyes glowing in the mountain last night. Big, green and awake.',
    'I heard {n} is sweet on Willa. Or Corwin. Or both. Hard to keep track.',
    'Grimbold swears his new stock came from a dwarven armoury. Pell swears it fell off a cart.',
    'If you ever find a fairy in the forest, give it a gem. Trust me on this one.',
    'There\'s an old outhouse in the Gloamwood. Don\'t ask. Just... choose wisely.',
    'Ezra Quill has never once been robbed. They say the vault door has teeth.',
    'Madame Zorya told {n} their fortune and they haven\'t smiled since.',
    'The Proving Yard\'s last master, Aurelion, is older than the village. Nobody knows how.',
    'They say if you strike the Wyrm while it\'s drawing breath, you get a free swing. Something to remember.',
    '{n} has been hunting in the fields every night this week. Sleep inside, friend.',
    'The Standing Stone only speaks to those who\'ve slain the Wyrm. It hums, they say.',
];

// Zorya's fortunes: real hints dressed up as prophecy.
export const FORTUNES = [
    'I see... a ledger. Gold that sleeps in the vault does not die with you.',
    'The cards show a sword above a sword. Those who seek danger find greater reward — but only when their steel outmatches their foes.',
    'A crown of thorns, then a garden in bloom. Walk among the flowers each day and hearts will open to you.',
    'The Tower, reversed. Do not sleep beneath the open sky with gold in your purse.',
    'I see a horse, and a road that stretches longer. A mount carries you deeper into each day.',
    'The Hermit. Your master waits in the Yard. Ask how far you have left to walk.',
    'A dragon coiled around a heart. The Wyrm burns hottest when you are already wounded. Come to it whole.',
    'A fairy with a jewel in its hands. Generosity in the forest is repaid in strange coin.',
    'The Wheel. Specialties are a well that refills each dawn. Drink from it.',
    'Death, upright. The Ferryman can be persuaded by those who serve him well in the Barrow Field.',
];

export const SLUR = (s) => s.replace(/s/g, 'sh').replace(/([aeiou])/gi, (m) => (Math.random() < 0.15 ? m + m : m)) + (Math.random() < 0.5 ? ' *hic*' : '');

export const ADMIN = 'Mirelle';

export const GUILDS = [
    { tag: 'TJF', name: 'The Jade Flame', motto: 'Burn bright, burn together.', perk: 'atk', perkDesc: '+5% attack in every fight' },
    { tag: 'LNT', name: 'Lanternwatch', motto: 'We keep the lights on.', perk: 'def', perkDesc: '+5% defence in every fight' },
    { tag: 'CRW', name: 'Order of the Crow', motto: 'Patience. Then the strike.', perk: 'gold', perkDesc: '+10% gold from the forest' },
    { tag: 'MOS', name: 'Mossback Brotherhood', motto: 'Slow is smooth. Smooth is fast.', perk: 'hp', perkDesc: '+5% maximum hit points' },
    { tag: 'GBL', name: 'Gilded Blades', motto: 'Rich, pretty and dangerous.', perk: 'charm', perkDesc: '+1 charm every day you are a member (to 30)' },
];
