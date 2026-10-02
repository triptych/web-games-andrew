// Races, specialties, titles, masters and the level curve.

export const MAX_LEVEL = 15;

// XP needed to *reach* level index+2 (LoGD's table). EXP_TABLE[level-1] = XP for next level.
export const EXP_TABLE = [100, 400, 1002, 1912, 3140, 4707, 6641, 8985, 11795, 15143, 19121, 23840, 29437, 36071];

export function expForNext(level, dk = 0) {
    if (level >= MAX_LEVEL) return Infinity;
    return Math.round(EXP_TABLE[level - 1] * (1 + 0.04 * dk));
}

export const PRONOUNS = {
    m: { label: 'He / him', sub: 'he', obj: 'him', pos: 'his', ref: 'himself', noun: 'man' },
    f: { label: 'She / her', sub: 'she', obj: 'her', pos: 'her', ref: 'herself', noun: 'woman' },
    n: { label: 'They / them', sub: 'they', obj: 'them', pos: 'their', ref: 'themself', noun: 'person' },
};

export const RACES = {
    human: {
        name: 'Human', color: '`&', icon: '🛡️',
        blurb: 'Stubborn, adaptable and always up before dawn. Humans squeeze `^two extra forest fights`0 out of every day.',
        arrive: 'You were raised on a farm on the edge of the Gloamwood, where the cows were nervous and the wolves were not.',
        turns: 2,
    },
    elf: {
        name: 'Elf', color: '`@', icon: '🌿',
        blurb: 'Light-footed and long-lived. Elves gain `^+1 defence`0 and `^+1 charm`0 — they make it look effortless.',
        arrive: 'You came down from the high birches of Silverleaf, where the trees still remember your grandmother\'s name.',
        def: 1, charm: 1,
    },
    dwarf: {
        name: 'Dwarf', color: '`6', icon: '⛏️',
        blurb: 'Broad, bearded (mostly) and drawn to anything that glitters. Dwarves find `^20% more gold`0 on fallen foes.',
        arrive: 'You walked up out of the Deepholds with a pick, a grudge and an unusually accurate sense for coin.',
        gold: 0.2,
    },
    troll: {
        name: 'Troll', color: '`2', icon: '🪨',
        blurb: 'Huge, green and hard to keep down. Trolls hit for `^+1 attack`0 and `^regenerate 1 HP`0 every round of combat.',
        arrive: 'You crawled out of the bog below Grimfen, chewed a rock for breakfast, and decided to see the world.',
        atk: 1, regen: 1,
    },
    halfling: {
        name: 'Halfling', color: '`Q', icon: '🍀',
        blurb: 'Small, cheerful and impossibly lucky. Halflings stumble into `^forest events twice as often`0 and start with `^+2 charm`0.',
        arrive: 'You left the Burrowdowns with three pies, a borrowed walking stick and absolutely no plan.',
        events: 2, charm: 2,
    },
};

// Skills unlock at skill level `need` and cost `cost` uses. Effects are interpreted by combat.js.
export const SPECIALTIES = {
    shadow: {
        name: 'Shadow Arts', color: '`5', icon: '💀',
        blurb: 'Grave-dirt and whispered names. Raise the dead to fight for you and curse what still breathes.',
        child: 'As a child you kept a jar of beetles, talked to the crows, and once made the cat\'s skeleton sit up. You were not invited to many parties.',
        skills: [
            { id: 'bones', name: 'Bone Servants', need: 1, cost: 1, desc: 'Skeletal servants claw from the earth and fight beside you for 5 rounds.' },
            { id: 'hex', name: 'Hex of Rot', need: 3, cost: 2, desc: 'Your foe\'s strength rots: its attack drops to 60% and it festers each round.' },
            { id: 'wither', name: 'Withering Curse', need: 6, cost: 3, desc: 'The curse eats at your foe\'s guard: its defence falls to 40% for 5 rounds.' },
            { id: 'soulrend', name: 'Soulrend', need: 10, cost: 5, desc: 'Tear at the soul itself for heavy damage, and drink some of what spills.' },
        ],
    },
    arcane: {
        name: 'Arcane Lore', color: '`#', icon: '✨',
        blurb: 'Patterns in the starlight. Heal yourself, harden your fists to stone, and wrap yourself in storms.',
        child: 'As a child you read every book in the chapel, then the ones the priest kept locked away, and made the candles dance when you were bored.',
        skills: [
            { id: 'mend', name: 'Mending Light', need: 1, cost: 1, desc: 'Warm light knits your wounds for 5 rounds.' },
            { id: 'stonefist', name: 'Stonefist', need: 3, cost: 2, desc: 'Your hands turn to granite: double attack for 5 rounds.' },
            { id: 'drain', name: 'Lifedrain', need: 6, cost: 3, desc: 'For 5 rounds, every blow you land feeds you half its damage.' },
            { id: 'aegis', name: 'Storm Aegis', need: 10, cost: 5, desc: 'A crackling ward: defence ×1.5 and lightning lashes back at whatever strikes you.' },
        ],
    },
    thief: {
        name: 'Thievery', color: '`^', icon: '🗡️',
        blurb: 'Quick hands, quicker wit. Taunt, poison, vanish — and put a blade where it hurts most.',
        child: 'As a child you lifted apples, purses and once an entire goose, and talked your way out of every single one.',
        skills: [
            { id: 'taunt', name: 'Cutting Taunt', need: 1, cost: 1, desc: 'An insult so cruel your foe loses its nerve: attack and defence ×0.8 for 5 rounds.' },
            { id: 'venom', name: 'Venom Blade', need: 3, cost: 2, desc: 'Coat your weapon: attack ×1.6 and lingering poison for 5 rounds.' },
            { id: 'vanish', name: 'Vanish', need: 6, cost: 3, desc: 'Melt into the shadows: your foe\'s attack falls to 30% for 5 rounds.' },
            { id: 'backstab', name: 'Backstab', need: 10, cost: 5, desc: 'One perfect blow between the ribs, for enormous damage.' },
        ],
    },
};

// Titles by Wyrm kills: [he, she, they]
export const TITLES = [
    ['Farmhand', 'Farmhand', 'Farmhand'],
    ['Page', 'Page', 'Page'],
    ['Squire', 'Squire', 'Squire'],
    ['Gladiator', 'Gladiatrix', 'Gladiator'],
    ['Legionnaire', 'Legionnaire', 'Legionnaire'],
    ['Centurion', 'Centurion', 'Centurion'],
    ['Sir', 'Dame', 'Knight'],
    ['Reeve', 'Reeve', 'Reeve'],
    ['Steward', 'Steward', 'Steward'],
    ['Warden', 'Warden', 'Warden'],
    ['Baron', 'Baroness', 'Baronet'],
    ['Count', 'Countess', 'Margrave'],
    ['Viscount', 'Viscountess', 'Viscount'],
    ['Marquess', 'Marchioness', 'Marquis'],
    ['Earl', 'Countess Palatine', 'Palatine'],
    ['Duke', 'Duchess', 'Sovereign'],
    ['Prince', 'Princess', 'Royal'],
    ['King', 'Queen', 'Monarch'],
    ['High King', 'High Queen', 'High Monarch'],
    ['Emperor', 'Empress', 'Imperator'],
    ['Wyrmbane', 'Wyrmbane', 'Wyrmbane'],
    ['Legend', 'Legend', 'Legend'],
    ['Demigod', 'Demigoddess', 'Demigod'],
    ['Ascendant', 'Ascendant', 'Ascendant'],
    ['Immortal', 'Immortal', 'Immortal'],
];

export function titleFor(dk, sex) {
    const row = TITLES[Math.min(dk, TITLES.length - 1)];
    return row[sex === 'm' ? 0 : sex === 'f' ? 1 : 2];
}

// Masters of the Proving Yard: you face masters[level-1] to reach level+1.
export const MASTERS = [
    { name: 'Bartholomew Hay', weapon: 'a well-worn pitchfork', intro: 'a broad farmer with forearms like hams, who taught half the village to fight', lose: 'Bartholomew chuckles and hands you a cup of water. "Again tomorrow, farmhand."', win: '"Ha! You\'ve got a real arm on you," Bartholomew laughs, rubbing his jaw.' },
    { name: 'Ysolde Brightwater', weapon: 'a willow quarterstaff', intro: 'a lean river-woman who never seems to stand still', lose: 'Ysolde sweeps your legs out one last time. "Water goes around rocks. Think on it."', win: 'Ysolde lowers her staff and bows. "You flowed. Well done."' },
    { name: 'Garrick Stonehand', weapon: 'iron knuckles', intro: 'a retired prizefighter with a nose broken in at least three directions', lose: 'Garrick hauls you up by the collar. "Keep your guard up, kid."', win: 'Garrick spits out a tooth and grins. "Now THAT was a punch."' },
    { name: 'Lysander Vale', weapon: 'twin silver daggers', intro: 'a dandy in a plumed hat whose daggers move faster than gossip', lose: 'Lysander flicks a speck of dust from his sleeve. "Charming effort. Truly."', win: 'Lysander\'s hat falls off. He stares at it, then at you. "...Well, well."' },
    { name: 'Thora Ironvein', weapon: 'a dwarven war-pick', intro: 'a dwarf veteran of the Deephold wars, braids knotted with iron rings', lose: 'Thora plants her pick in the dirt. "Stone doesn\'t give up. Neither should you."', win: 'Thora roars with laughter and slaps your back hard enough to bruise. "Good steel in you!"' },
    { name: 'Fenwick the Fox', weapon: 'a curved sabre', intro: 'a red-haired duellist with a reputation in four kingdoms and warrants in three', lose: 'Fenwick taps your nose with the flat of his blade. "Predictable."', win: 'Fenwick sheathes his sabre with a flourish. "The student bites! Marvellous."' },
    { name: 'Odalys Nightbloom', weapon: 'a serpent-scale whip', intro: 'a tall, silent woman in black lacquered armour, smelling faintly of jasmine', lose: 'Odalys coils her whip and walks away without a word, which is somehow worse.', win: 'Odalys inclines her head a fraction of an inch. From her, it is a standing ovation.' },
    { name: 'Brannagh Oakheart', weapon: 'a great oaken maul', intro: 'a mountain of a man who once held a bridge alone for an afternoon', lose: 'Brannagh sets you gently on a bench like a sack of grain. "Rest. Then again."', win: 'Brannagh laughs a laugh like rolling barrels. "You felled the oak!"' },
    { name: 'Silas Grimward', weapon: 'a soulsteel longsword', intro: 'a grey-eyed knight of a fallen order, armour etched with the names of the dead', lose: '"Not yet," Silas says quietly, helping you up. "But soon."', win: 'Silas salutes with his blade. "Your name would not shame the old order."' },
    { name: 'Isolde the Unbowed', weapon: 'a lance of starlight', intro: 'a champion of a hundred tourneys, her shield scarred by every one of them', lose: 'Isolde lowers her lance. "You lack only patience. Come back with it."', win: 'Isolde removes her helm and offers her hand. "Well ridden, champion."' },
    { name: 'Kaelen Duskmantle', weapon: 'shadow-forged glaives', intro: 'a hooded warden of the Gloamwood whose footsteps make no sound at all', lose: 'Kaelen is suddenly behind you. "You looked where I was. Look where I will be."', win: 'Kaelen\'s hood falls back, revealing a rare smile. "The forest has noticed you."' },
    { name: 'Mother Ashka', weapon: 'a staff of storm-bark', intro: 'an ancient orc shaman whose staff hums with trapped thunder', lose: 'Mother Ashka pats your cheek with a calloused hand. "Little one. Not today."', win: 'Mother Ashka thumps her staff and the sky rumbles approval. "The storm knows you now."' },
    { name: 'Vaelin Stormcrow', weapon: 'a thunder-edged greatsword', intro: 'the last commander of the Crow Guard, who has faced wyverns and won', lose: '"The Wyrm will not stop to help you up," Vaelin says, helping you up.', win: 'Vaelin drives his sword into the ground and kneels. "Go. Finish what we could not."' },
    { name: 'Aurelion, the Last Dragonguard', weapon: 'the Wyrmfang Blade', intro: 'an ageless warrior in jade-green scale armour who swore, long ago, to guard the village from the Wyrm', lose: 'Aurelion sheathes the Wyrmfang. "When you can best me, you will be ready for it."', win: 'Aurelion looks at you for a long moment. "Then it is time. Go into the deep wood, and seek the Jade Wyrm."' },
];

export function masterStats(level) {
    const L = level;
    return {
        level: L + 1,
        hp: Math.round(7 * L + 6 + L * L * 0.12),
        atk: +(1.75 * L + 0.3).toFixed(1),
        def: +(1.2 * L).toFixed(1),
    };
}
