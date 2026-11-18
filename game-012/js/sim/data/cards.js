// The 78 cards of the Great Deck. Pure data: the sim builds fighters from it, the view draws the faces,
// and dev/art/prompts.mjs paints every card from its `art` line, so the picture and the card always agree.
//
// Suits are elements and battle roles:
//   wands     Fire   strikers: high attack, Kindle sets the target burning
//   cups      Water  menders: Pour heals the most hurt ally
//   swords    Air    duellists: fast, Flurry strikes the two front enemies
//   pentacles Earth  wardens: tough, Bulwark shields the most hurt ally
//   major     each Major Arcanum has its own element and its own skill
//
// Rarity: 2–6 Common, 7–10 Uncommon, Ace / Page / Knight Rare, Queen / King Epic, Major Arcana Legendary.
//
// Skills are lists of effects, read by sim/battle.js:
//   { k: 'dmg', to, x }          damage of x × ATK (to: front, back, rand, all, two, low, high)
//   { k: 'heal', to, x }         heal x × ATK (to: self, low, allies)        { k: 'heal', to, pct } pct of max HP
//   { k: 'shield', to, pct }     a shield of pct × the target's max HP
//   { k: 'buff', to, stat, by, n }    stat (atk, def, spd) changed by `by` for n of the target's actions
//   { k: 'debuff', to, stat, by, n }  the same on enemies
//   { k: 'burn', to, x, n }      x × ATK at each of the target's next n actions
//   { k: 'stun', to, p }         the target loses its next action (chance p)
//   { k: 'blind', to, p, n }     the target misses with chance p for n actions
//   { k: 'cleanse', to }         removes burns, poisons, debuffs and blinds
//   { k: 'revive', to, pct, all }   raises one fallen ally (or all) with pct of max HP; once a battle
//   { k: 'execute', to, below, x }  slays a target under `below` of its max HP, else deals x × ATK
//   { k: 'delay', to, s }        pushes the target's next action back s seconds
//   { k: 'dodge', n }            dodges the next n attacks
//   { k: 'taunt', n }            enemies must strike this card for its next n actions
//   { k: 'pierce' } on a dmg effect ignores defence; { k: 'drain' } heals by half the damage dealt
//   { k: 'wheel' }               one of three fortunes at random

export const SUITS = ['wands', 'cups', 'swords', 'pentacles'];
export const SUIT_INFO = {
    wands: { name: 'Wands', el: 'fire', role: 'Striker', glyph: '🜂', color: '#ff7a3d' },
    cups: { name: 'Cups', el: 'water', role: 'Mender', glyph: '🜄', color: '#3fd0d4' },
    swords: { name: 'Swords', el: 'air', role: 'Duellist', glyph: '🜁', color: '#a9c8ff' },
    pentacles: { name: 'Pentacles', el: 'earth', role: 'Warden', glyph: '🜃', color: '#8fd16a' },
    major: { name: 'Major Arcana', el: null, role: 'Legend', glyph: '✦', color: '#ffd166' },
};
export const ELEMENTS = {
    fire: { name: 'Fire', beats: 'air', color: '#ff7a3d' },
    air: { name: 'Air', beats: 'earth', color: '#a9c8ff' },
    earth: { name: 'Earth', beats: 'water', color: '#8fd16a' },
    water: { name: 'Water', beats: 'fire', color: '#3fd0d4' },
    spirit: { name: 'Spirit', beats: null, color: '#e2b6ff' },
};
export const RARITIES = {
    C: { name: 'Common', stars: 1, color: '#b9b4c9' },
    U: { name: 'Uncommon', stars: 2, color: '#7fe0a0' },
    R: { name: 'Rare', stars: 3, color: '#69a8ff' },
    E: { name: 'Epic', stars: 4, color: '#d07bff' },
    L: { name: 'Legendary', stars: 5, color: '#ffc94d' },
};
export const RARITY_ORDER = ['C', 'U', 'R', 'E', 'L'];

/** Base ★1 numbers by rarity. ATK and HP are scaled by the suit, then by stars. SPD is actions per 10 s. */
export const RARITY_BASE = {
    C: { hp: 110, atk: 18, spd: 10 },
    U: { hp: 128, atk: 21, spd: 10.4 },
    R: { hp: 150, atk: 24, spd: 10.8 },
    E: { hp: 176, atk: 28, spd: 11.2 },
    L: { hp: 205, atk: 32, spd: 11.6 },
};
export const SUIT_MOD = {
    wands: { hp: 0.92, atk: 1.25, spd: 1.0, def: 0.08 },
    cups: { hp: 1.0, atk: 0.85, spd: 1.04, def: 0.1 },
    swords: { hp: 0.82, atk: 1.02, spd: 1.3, def: 0.06 },
    pentacles: { hp: 1.42, atk: 0.74, spd: 0.86, def: 0.22 },
};

const NUM = ['', 'Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'];
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];

/** Suit skills. Aces and Kings take theirs to every target; Queens add a second blessing; Knights are swift. */
const SUIT_SKILL = {
    wands: { name: 'Kindle', cost: 3, fx: [{ k: 'dmg', to: 'front', x: 1.5 }, { k: 'burn', to: 'front', x: 0.3, n: 3 }], text: 'Strikes the front enemy for 150% and sets it burning.' },
    cups: { name: 'Pour', cost: 2, fx: [{ k: 'heal', to: 'low', x: 1.5 }], text: 'Heals the most hurt ally for 150% of ATK.' },
    swords: { name: 'Flurry', cost: 3, fx: [{ k: 'dmg', to: 'two', x: 0.95 }], text: 'Strikes the two front enemies for 95% each.' },
    pentacles: { name: 'Bulwark', cost: 3, fx: [{ k: 'shield', to: 'low', pct: 0.22 }, { k: 'taunt', n: 2 }], text: 'Shields the most hurt ally (22% of its max HP) and draws enemy blows.' },
};
const ACE_SKILL = {
    wands: { name: 'Wildfire', cost: 3, fx: [{ k: 'dmg', to: 'all', x: 0.9 }, { k: 'burn', to: 'all', x: 0.2, n: 3 }], text: 'Strikes every enemy for 90% and sets them all burning.' },
    cups: { name: 'Wellspring', cost: 3, fx: [{ k: 'heal', to: 'allies', x: 0.9 }], text: 'Heals every ally for 90% of ATK.' },
    swords: { name: 'Clarity', cost: 3, fx: [{ k: 'dmg', to: 'front', x: 2.2, pierce: true }], text: 'A piercing strike for 220% that ignores defence.' },
    pentacles: { name: 'Bounty', cost: 3, fx: [{ k: 'shield', to: 'allies', pct: 0.14 }], text: 'Shields every ally for 14% of its max HP.' },
};
const KING_SKILL = {
    wands: { name: 'Sovereign Flame', cost: 3, fx: [{ k: 'dmg', to: 'all', x: 1.1 }, { k: 'burn', to: 'all', x: 0.25, n: 3 }], text: 'Strikes every enemy for 110% and sets them burning.' },
    cups: { name: 'Calm Sea', cost: 3, fx: [{ k: 'heal', to: 'allies', x: 1.0 }, { k: 'cleanse', to: 'allies' }], text: 'Heals every ally for 100% of ATK and washes away their ailments.' },
    swords: { name: 'Edict', cost: 3, fx: [{ k: 'dmg', to: 'all', x: 1.0 }, { k: 'debuff', to: 'all', stat: 'def', by: -0.1, n: 3 }], text: 'Strikes every enemy for 100% and cuts their defence.' },
    pentacles: { name: 'Golden Wall', cost: 3, fx: [{ k: 'shield', to: 'allies', pct: 0.2 }, { k: 'taunt', n: 2 }], text: 'Shields every ally for 20% of max HP and draws enemy blows.' },
};
const QUEEN_EXTRA = {
    wands: { fx: { k: 'buff', to: 'allies', stat: 'atk', by: 0.12, n: 3 }, text: ' Then every ally gains 12% ATK.' },
    cups: { fx: { k: 'heal', to: 'allies', x: 0.4 }, text: ' Then every ally heals 40% of ATK.' },
    swords: { fx: { k: 'debuff', to: 'front', stat: 'spd', by: -0.25, n: 2 }, text: ' Then the front enemy slows.' },
    pentacles: { fx: { k: 'buff', to: 'allies', stat: 'def', by: 0.1, n: 3 }, text: ' Then every ally gains defence.' },
};

function minorSkill(suit, n) {
    if (n === 1) return ACE_SKILL[suit];
    if (n === 14) return KING_SKILL[suit];
    const base = SUIT_SKILL[suit];
    if (n === 13) return { ...base, name: 'Royal ' + base.name, fx: [...base.fx, QUEEN_EXTRA[suit].fx], text: base.text + QUEEN_EXTRA[suit].text };
    return base;
}

// The art lines: one character per card, from the card's traditional image, posed as a fighter.
const MINOR_ART = {
    wands: [null,
        'a hand of living flame bursting from a dark cloud, gripping a sprouting wooden staff ablaze with fire',
        'a young noble scout on castle battlements at dusk, one flaming staff in hand and a small glowing globe in the other, planning a campaign',
        'a cloaked merchant-warrior on a cliff edge watching ships with sails of fire sail away, three burning staves planted beside them',
        'two joyful dancers beneath a garland arch held up by four flaming staves, a festive castle behind',
        'five young brawlers sparring with burning staves in a whirl of sparks and dust',
        'a victorious rider on a white horse, crowned with laurel, a flaming staff with a laurel wreath held high, cheering crowd',
        'a defiant fighter on a hilltop, fending off six staves thrust up from below with one blazing staff',
        'eight flaming staves flying like comets in a fan across an orange sky over a river valley',
        'a bandaged, weary veteran guard leaning on a flaming staff before a palisade of eight staves, still standing watch',
        'a strong porter hunched under a heavy bundle of ten burning staves, trudging toward a town',
        'a bold young herald in a tunic embroidered with salamanders, gazing at the flame on her staff in a red desert',
        'an armoured knight on a rearing chestnut horse, helmet plume of fire, burning staff raised for the charge',
        'a fiery queen on a lion-carved throne holding a sunflower and a blazing staff, a black cat at her feet',
        'a powerful king in a cloak of salamanders on a throne, a flaming sceptre in his fist, an intense gaze',
    ],
    cups: [null,
        'a hand from a cloud holding a golden chalice that overflows with five streams of water into a lotus pool, a white dove above',
        'two young lovers pledging golden cups to each other beneath a winged lion above a caduceus',
        'three healer-maidens dancing in a circle raising golden cups, flowers and fruit at their feet',
        'a brooding young man under a tree, arms crossed, three cups before him and a ghostly hand offering a fourth from a cloud',
        'a black-cloaked mourner looking down at three spilled cups, two cups still standing behind, a river and a bridge',
        'two children in a sunny old courtyard, one handing the other a golden cup filled with white flowers',
        'a figure gazing up at seven golden cups floating in clouds, each holding a wonder: a castle, jewels, a laurel, a dragon, a veiled spirit',
        'a cloaked traveller with a staff walking away up a rocky path under the moon, leaving eight stacked cups behind',
        'a jolly, satisfied healer seated with crossed arms before an arc of nine golden cups on a blue cloth',
        'a happy family under a rainbow of ten golden cups, two children dancing, a cottage by a river',
        'a young page in a lotus-patterned tunic by the sea, a little fish peeking out of the cup he holds',
        'a graceful knight in winged helm on a calm white horse, holding a golden cup forward, beside a river',
        'a gentle sea queen on a scallop-shell throne at the shore, gazing into an ornate lidded chalice',
        'a calm king on a stone throne floating on a rough sea, a cup and sceptre in hand, a ship and a leaping dolphin behind',
    ],
    swords: [null,
        'a hand from a cloud gripping an upright silver sword whose tip pierces a golden crown, wind and light',
        'a blindfolded swordswoman in white seated by a moonlit sea, two swords crossed over her heart',
        'a red heart pierced by three silver swords beneath grey storm clouds and slanting rain',
        'a weary knight meditating on a stone bench in a quiet chapel, three swords hung on the wall above him',
        'a smirking duellist gathering up swords while two defeated rivals walk away under a jagged sky',
        'a ferryman poling a boat across calm water carrying a cloaked woman and child, six swords standing upright in the bow',
        'a sly thief tiptoeing away from a camp carrying five swords, two left planted behind',
        'a bound, blindfolded woman among eight swords stuck in muddy ground, straining to break free',
        'a figure sitting up in bed at night with face in hands, nine swords hanging on the dark wall',
        'ten swords planted in a dark ridge around a fallen red cloak, a golden dawn breaking on the horizon',
        'an alert young scout on a windswept hill holding a sword aloft, birds wheeling in the clouds',
        'a knight charging at full gallop on a white horse into a gale, sword raised, cloak streaming',
        'a stern queen on a throne carved with butterflies, sword held upright, one hand extended, clouds behind',
        'a wise king on a throne holding an upright sword, deep blue robes, cumulus clouds and birds behind',
    ],
    pentacles: [null,
        'a hand from a cloud holding a large golden coin engraved with a five-pointed star above a garden archway of roses',
        'a cheerful juggler dancing with two golden coins in a ribbon looped like a figure eight, ships riding tall waves behind',
        'a stonemason on a bench carving a cathedral arch with three golden coins, two robed architects consulting plans',
        'a stout guardian clutching a golden coin to his chest, one on his crown and two under his feet, a city behind',
        'two ragged travellers trudging through snow past a glowing stained-glass window of five golden coins',
        'a wealthy merchant holding balanced scales, dropping golden coins to two kneeling travellers',
        'a farmer leaning on a hoe, regarding a lush vine bearing seven golden coins',
        'an apprentice smith at a workbench hammering a golden coin, finished coins hung on a post',
        'an elegant lady in a vineyard with a hooded falcon on her gloved hand, golden coins among the grapes',
        'an old patriarch with two white dogs under a stone archway, a family behind, ten golden coins glowing',
        'a studious young page in a green field holding up a single golden coin, gazing at it',
        'a heavy armoured knight on a sturdy black draught horse holding a golden coin, ploughed fields behind',
        'a nurturing queen on a throne in a rose garden, cradling a golden coin in her lap, a rabbit nearby',
        'a prosperous king in a robe of grapevines on a bull-carved throne, a golden coin and sceptre, a castle behind',
    ],
};

/** The Major Arcana: their element, base numbers (multipliers on the Legendary base) and skill. */
const MAJORS = [
    ['The Fool', 'air', { hp: 0.85, atk: 1.0, spd: 1.35, def: 0.06 }, 'Leap of Faith', 3,
        [{ k: 'dmg', to: 'rand', x: 2.4 }, { k: 'dodge', n: 2 }], 'Leaps at a random enemy for 240%, then dodges the next two attacks.',
        'a carefree young wanderer with a bindle and a white rose, laughing as he steps off a cliff edge into starlight, a small white dog leaping beside him'],
    ['The Magician', 'fire', { hp: 0.9, atk: 1.15, spd: 1.0, def: 0.08 }, 'Fourfold Will', 4,
        [{ k: 'dmg', to: 'all', x: 1.3 }], 'Strikes every enemy for 130%.',
        'a confident young sorcerer in a red robe raising a glowing wand to the sky, a wand, cup, sword and golden coin floating around him, an infinity halo above his head'],
    ['The High Priestess', 'water', { hp: 0.95, atk: 0.85, spd: 1.0, def: 0.12 }, 'Veil of Mysteries', 4,
        [{ k: 'shield', to: 'allies', pct: 0.22 }, { k: 'blind', to: 'all', p: 0.3, n: 2 }], 'Shields every ally (22% of max HP) and veils the enemies, who miss 30% of attacks for a while.',
        'a serene veiled priestess in flowing blue robes seated between a black pillar and a white pillar, a scroll in her lap, a crescent moon at her feet'],
    ['The Empress', 'earth', { hp: 1.1, atk: 0.85, spd: 0.95, def: 0.14 }, 'Bloom', 3,
        [{ k: 'heal', to: 'allies', x: 1.0 }, { k: 'buff', to: 'allies', stat: 'def', by: 0.08, n: 3 }], 'Heals every ally for 100% of ATK and hardens them.',
        'a radiant empress crowned with twelve stars reclining in a golden wheat field, a sceptre in her hand, a robe patterned with pomegranates'],
    ['The Emperor', 'fire', { hp: 1.45, atk: 0.8, spd: 0.85, def: 0.26 }, 'Iron Decree', 3,
        [{ k: 'shield', to: 'self', pct: 0.3 }, { k: 'taunt', n: 3 }, { k: 'buff', to: 'allies', stat: 'atk', by: 0.1, n: 3 }], 'Shields himself (30% of max HP), commands every enemy to strike him, and spurs the party (+10% ATK).',
        'a stern bearded emperor in red robes over armour on a massive stone throne carved with ram heads, an ankh sceptre and a golden orb, barren mountains behind'],
    ['The Hierophant', 'earth', { hp: 1.05, atk: 0.85, spd: 1.0, def: 0.14 }, 'Benediction', 3,
        [{ k: 'cleanse', to: 'allies' }, { k: 'heal', to: 'allies', x: 0.8 }, { k: 'shield', to: 'low', pct: 0.15 }], 'Washes away every ailment, heals every ally for 80% of ATK and shields the most hurt.',
        'a robed high priest in a triple crown raising two fingers in blessing between two stone pillars, two crossed golden keys at his feet, two acolytes kneeling'],
    ['The Lovers', 'air', { hp: 1.0, atk: 0.95, spd: 1.05, def: 0.1 }, 'Twin Hearts', 3,
        [{ k: 'heal', to: 'low', x: 1.6 }, { k: 'buff', to: 'allies', stat: 'atk', by: 0.2, n: 2 }], 'Heals the most hurt ally for 160% and fills every ally with courage (+20% ATK).',
        'two lovers reaching for each other in a sunlit garden beneath a radiant winged angel in the clouds, a fruit tree and a tree of flames behind them'],
    ['The Chariot', 'water', { hp: 1.05, atk: 1.15, spd: 1.1, def: 0.14 }, 'Triumphal Charge', 3,
        [{ k: 'dmg', to: 'front', x: 2.2 }, { k: 'delay', to: 'front', s: 1.5 }], 'Charges the front enemy for 220% and knocks its next action back.',
        'an armoured charioteer with a star-crowned helm charging in a star-canopied chariot drawn by a black sphinx and a white sphinx'],
    ['Strength', 'fire', { hp: 1.2, atk: 1.05, spd: 0.95, def: 0.16 }, 'Tamed Lion', 3,
        [{ k: 'dmg', to: 'front', x: 1.8 }, { k: 'stun', to: 'front', p: 1 }], 'Strikes the front enemy for 180% and stuns it.',
        'a gentle woman in white with a garland of flowers calmly closing the jaws of a great golden lion, an infinity halo above her head'],
    ['The Hermit', 'earth', { hp: 0.9, atk: 1.2, spd: 0.95, def: 0.1 }, 'Lantern of Truth', 3,
        [{ k: 'dmg', to: 'back', x: 2.6, pierce: true }], 'Finds the rearmost enemy for 260%, ignoring defence.',
        'an old hooded hermit in grey robes alone on a snowy mountain peak at night, holding up a lantern with a shining six-pointed star inside, a tall staff'],
    ['Wheel of Fortune', 'fire', { hp: 1.0, atk: 1.05, spd: 1.05, def: 0.1 }, 'Turn of the Wheel', 3,
        [{ k: 'wheel' }], 'Spins: strikes every enemy for 160%, heals every ally for 120%, or stuns every enemy.',
        'a great golden wheel inscribed with alchemical symbols turning in the clouds, a sphinx with a sword seated on top, a serpent descending and a jackal-headed figure rising around it'],
    ['Justice', 'air', { hp: 1.05, atk: 1.05, spd: 1.0, def: 0.14 }, 'Scales of Judgement', 3,
        [{ k: 'dmg', to: 'high', x: 1.4, pierce: true }, { k: 'debuff', to: 'high', stat: 'atk', by: -0.2, n: 3 }], 'Strikes the healthiest enemy for 140%, ignoring defence, and weakens it.',
        'a crowned judge in red robes seated between two pillars, a raised double-edged sword in one hand and balanced golden scales in the other'],
    ['The Hanged Man', 'water', { hp: 1.15, atk: 0.9, spd: 0.95, def: 0.16 }, 'Surrender', 3,
        [{ k: 'debuff', to: 'all', stat: 'atk', by: -0.25, n: 3 }, { k: 'heal', to: 'self', pct: 0.2 }], 'Every enemy loses 25% ATK for a while; he restores 20% of his own HP.',
        'a calm young man hanging upside down by one ankle from a living T-shaped tree, hands behind his back, a golden halo glowing around his head'],
    ['Death', 'earth', { hp: 1.05, atk: 1.2, spd: 0.95, def: 0.14 }, 'Reaping', 3,
        [{ k: 'execute', to: 'low', below: 0.3, x: 2.0 }], 'Ends the most hurt enemy if it is under 30% HP; otherwise strikes it for 200%.',
        'a skeletal knight in black armour riding a pale white horse, carrying a black banner bearing a white rose, a sunrise between two towers behind'],
    ['Temperance', 'fire', { hp: 1.0, atk: 0.9, spd: 1.05, def: 0.12 }, 'Alchemy', 3,
        [{ k: 'heal', to: 'allies', x: 0.7 }, { k: 'cleanse', to: 'allies' }, { k: 'buff', to: 'allies', stat: 'spd', by: 0.15, n: 3 }], 'Heals every ally for 70%, cleanses them and quickens them (+15% SPD).',
        'a tall winged angel in white pouring water between two golden cups, one foot on land and one in a pool, irises growing, a path to a golden crown in the hills'],
    ['The Devil', 'earth', { hp: 1.1, atk: 1.1, spd: 0.95, def: 0.14 }, 'Chains of Desire', 3,
        [{ k: 'burn', to: 'all', x: 0.45, n: 4 }, { k: 'dmg', to: 'front', x: 1.0, drain: true }], 'Poisons every enemy (45% of ATK at each of their next four actions) and drains the front one.',
        'a horned goat-headed devil with bat wings crouched on a dark pedestal, an inverted torch in one claw, two chained horned figures below'],
    ['The Tower', 'fire', { hp: 0.95, atk: 1.3, spd: 0.9, def: 0.08 }, 'Lightning Strike', 4,
        [{ k: 'dmg', to: 'all', x: 1.9 }, { k: 'stun', to: 'all', p: 0.3 }], 'Lightning strikes every enemy for 190% and may stun them.',
        'a tall grey stone tower on a crag struck by a bolt of lightning, its golden crown blown off the top, flames from the windows, two figures falling'],
    ['The Star', 'air', { hp: 1.0, atk: 0.9, spd: 1.05, def: 0.1 }, 'Hope Renewed', 3,
        [{ k: 'revive', to: 'fallen', pct: 0.5 }, { k: 'heal', to: 'allies', x: 0.9 }], 'Raises the first fallen ally at 50% HP (once a battle), then heals every ally for 90%.',
        'a gentle maiden kneeling by a starlit pool pouring water from two jugs, one onto the land and one into the pool, a great eight-pointed star and seven small stars above'],
    ['The Moon', 'water', { hp: 1.0, atk: 1.05, spd: 1.05, def: 0.1 }, 'Lunacy', 3,
        [{ k: 'blind', to: 'all', p: 0.45, n: 3 }, { k: 'dmg', to: 'all', x: 0.8 }], 'Every enemy is struck for 80% and loses itself in illusions (45% to miss).',
        'a full moon with a sleeping face over a winding path between two towers, a wolf and a dog howling up at it, a crayfish crawling out of a pool'],
    ['The Sun', 'fire', { hp: 1.05, atk: 1.1, spd: 1.05, def: 0.12 }, 'Radiance', 3,
        [{ k: 'buff', to: 'allies', stat: 'atk', by: 0.3, n: 3 }, { k: 'heal', to: 'allies', x: 0.6 }, { k: 'dmg', to: 'all', x: 0.6 }], 'Every ally gains 30% ATK and heals 60%; every enemy is scorched for 60%.',
        'a joyful child with a feathered crown riding a white horse beneath a huge radiant sun with a calm face, a tall red banner, sunflowers over a garden wall'],
    ['Judgement', 'fire', { hp: 1.05, atk: 1.0, spd: 1.0, def: 0.12 }, 'The Last Trumpet', 4,
        [{ k: 'revive', to: 'fallen', pct: 0.35, all: true }, { k: 'dmg', to: 'all', x: 1.1 }], 'Raises every fallen ally at 35% HP (once a battle) and strikes every enemy for 110%.',
        'a great winged angel blowing a golden trumpet with a white banner from the clouds, pale figures rising joyfully from open stone coffins on a sea below'],
    ['The World', 'earth', { hp: 1.2, atk: 1.2, spd: 1.05, def: 0.16 }, 'Completion', 4,
        [{ k: 'dmg', to: 'all', x: 1.4 }, { k: 'heal', to: 'allies', x: 0.8 }, { k: 'shield', to: 'allies', pct: 0.12 }], 'Strikes every enemy for 140%, heals every ally for 80% and shields them.',
        'a joyous dancer wrapped in a violet sash floating inside a great green laurel wreath tied with red ribbons, a wand in each hand, an angel, an eagle, a lion and a bull in the clouds at the corners'],
];

export const CARDS = {};

MAJORS.forEach(([name, el, mod, skillName, cost, fx, text, art], n) => {
    const id = 'm' + String(n).padStart(2, '0');
    CARDS[id] = {
        id, name, suit: 'major', n, numeral: ROMAN[n], rarity: 'L', el, mod,
        skill: { name: skillName, cost, fx, text }, art,
    };
});
for (const suit of SUITS) {
    for (let n = 1; n <= 14; n++) {
        const id = suit[0] + String(n).padStart(2, '0');
        const rarity = n === 1 || n === 11 || n === 12 ? 'R' : n >= 13 ? 'E' : n >= 7 ? 'U' : 'C';
        const mod = { ...SUIT_MOD[suit] };
        // a little more with each pip; Knights are swift, Pages quick to learn
        const pip = n <= 10 ? 1 + 0.025 * (n - (n >= 7 ? 7 : 2)) : 1;
        mod.hp *= pip; mod.atk *= pip;
        if (n === 12) mod.spd *= 1.15;
        CARDS[id] = {
            id, name: `${NUM[n]} of ${SUIT_INFO[suit].name}`, suit, n, numeral: n === 1 ? 'A' : n <= 10 ? String(n) : NUM[n][0],
            rarity, el: SUIT_INFO[suit].el, mod, skill: { ...minorSkill(suit, n), cost: n === 11 ? 2 : minorSkill(suit, n).cost },
            art: MINOR_ART[suit][n],
        };
    }
}

export const CARD_IDS = Object.keys(CARDS);
export const BY_RARITY = Object.fromEntries(Object.keys(RARITIES).map((r) => [r, CARD_IDS.filter((id) => CARDS[id].rarity === r)]));
