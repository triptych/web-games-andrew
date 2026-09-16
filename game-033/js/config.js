// ============================================================
// Hearthbound — Configuration
// ============================================================

export const SAVE_KEY = 'hearthbound-save-v1';

// --- Starting player stats ---
export const STARTING_STATS = {
    level: 1,
    xp: 0,
    hp: 20,
    maxHp: 20,
    strength: 3,   // affects battle damage dealt
    wit: 3,        // unlocks dialogue options, affects flee/evade
    charm: 3,      // affects affinity gain from choices
    statPoints: 0, // unspent points from leveling up
    coin: 15,      // Phase 6: village currency, spent with Peddler Ock
};

// --- Phase 6: the season is measured in days. Resting at the shop advances
// the day, restores HP, and is what gates a few slow-burning story beats
// (the peddler's cart arriving, the watch riding in, Hollow's patience). ---
export const STARTING_DAY = 1;

// --- XP curve: XP required to reach the NEXT level, indexed by current level ---
export function xpToNextLevel(level) {
    return 20 + (level - 1) * 15;
}

// --- Enemy scaling: enemy stats grow with the player's level so later
// Whisperwood encounters stay meaningful instead of going flat forever.
// Applied multiplicatively on top of the enemy's base hp/strength/xp.
export function enemyScaleForLevel(level) {
    const steps = Math.max(0, level - 1);
    return {
        hp: 1 + steps * 0.18,
        strength: 1 + steps * 0.12,
        xp: 1 + steps * 0.1,
    };
}

export function scaledEnemy(enemyId, level) {
    const base = ENEMY_DEFS[enemyId];
    if (!base) return null;
    const scale = enemyScaleForLevel(level);
    return {
        ...base,
        hp: Math.round(base.hp * scale.hp),
        strength: Math.max(base.strength, Math.round(base.strength * scale.strength)),
        xp: Math.round(base.xp * scale.xp),
    };
}

// --- Starting inventory: array of { id, count } ---
export const STARTING_INVENTORY = [
    { id: 'dried_mintleaf', count: 3 },
];

// --- Item definitions ---
// type: 'material' (quest/crafting), 'equip' (wearable, grants stat bonus), 'consumable'
// Equip items declare a `slot` ('trinket' or 'charm' — two independent slots as of Phase 3).
// Some equip items trade a bonus for a penalty (e.g. +Strength/-Wit) rather than a flat gain.
export const ITEM_DEFS = {
    dried_mintleaf: {
        name: 'Dried Mintleaf',
        type: 'material',
        icon: '🌿',
        desc: 'A common herb. Smells faintly of tea. Used in brewing.',
        value: 4,
    },
    silver_thimble: {
        name: "Grandmother's Thimble",
        type: 'equip',
        slot: 'trinket',
        icon: '🪡',
        desc: 'A tarnished silver thimble. Wearing it steadies your hands. (+2 Wit)',
        bonus: { wit: 2 },
    },
    oak_charm: {
        name: 'Oak Charm',
        type: 'equip',
        slot: 'trinket',
        icon: '🌰',
        desc: 'A carved charm from the Whisperwood. (+2 Strength)',
        bonus: { strength: 2 },
    },
    honey_tonic: {
        name: 'Honey Tonic',
        type: 'consumable',
        icon: '🍯',
        desc: 'A sweet restorative. Heals 10 HP when used in battle.',
        heal: 10,
        value: 14,
    },
    cellar_key: {
        name: 'Cellar Key',
        type: 'material',
        icon: '🗝️',
        desc: 'A rust-spotted iron key. Opens the shop cellar.',
    },

    // --- Phase 3: brewing materials ---
    river_root: {
        name: 'River Root',
        type: 'material',
        icon: '🥕',
        desc: 'A pale, bitter root pulled from the creek bank. Used in brewing.',
        value: 7,
    },
    thornback_quill: {
        name: 'Thornback Quill',
        type: 'material',
        icon: '🪶',
        desc: 'A barbed quill shed by a Whisperwood thornback. Used in brewing.',
        value: 9,
    },
    moonpetal: {
        name: 'Moonpetal',
        type: 'material',
        icon: '🌸',
        desc: 'A pale flower that only blooms in deep shade. Used in brewing.',
        value: 16,
    },

    // --- Phase 3: brewed consumables ---
    vigor_draught: {
        name: 'Vigor Draught',
        type: 'consumable',
        icon: '🧪',
        desc: 'A brewed tonic, stronger than a simple Honey Tonic. Heals 18 HP in battle.',
        heal: 18,
        value: 22,
    },
    steady_hand_tea: {
        name: 'Steady-Hand Tea',
        type: 'consumable',
        icon: '🍵',
        desc: 'Calms the nerves before a fight. Heals 8 HP and never fails to help you flee this turn.',
        heal: 8,
        guaranteedFlee: true,
        value: 18,
    },

    // --- Phase 3: trade-off equip items (a second "charm" slot) ---
    thornback_bracer: {
        name: 'Thornback Bracer',
        type: 'equip',
        slot: 'charm',
        icon: '🩹',
        desc: 'Stiff, barbed leather. Hits harder, but the bulk slows your reflexes. (+3 Strength, -1 Wit)',
        bonus: { strength: 3 },
        penalty: { wit: 1 },
    },
    moonpetal_locket: {
        name: 'Moonpetal Locket',
        type: 'equip',
        slot: 'charm',
        icon: '🔮',
        desc: 'Pressed moonpetal under glass. Sharpens the mind, softens the swing. (+3 Wit, -1 Strength)',
        bonus: { wit: 3 },
        penalty: { strength: 1 },
    },
    bakers_locket: {
        name: "Baker's Locket",
        type: 'equip',
        slot: 'charm',
        icon: '📿',
        desc: 'A small locket Bramwell pressed on you "for luck." Warms people to you, but you fight a little more timidly wearing it. (+3 Charm, -1 Strength)',
        bonus: { charm: 3 },
        penalty: { strength: 1 },
    },

    // --- Phase 6: quest items, deep-wood materials, and the long-season gear ---
    wisteria_journal: {
        name: "Wisteria's Journal",
        type: 'material',
        icon: '📔',
        desc: 'Your aunt\u2019s working journal, water-stained and crammed with forty years of notes. Read it from the Journal panel.',
    },
    hearth_lamp: {
        name: 'Hearth Lamp',
        type: 'material',
        icon: '🏮',
        desc: 'A squat brass lamp built to carry a live coal a long way without letting it die. Currently cold.',
    },
    lit_hearth_lamp: {
        name: 'Lamp (Lit)',
        type: 'material',
        icon: '🕯️',
        desc: 'The hearth lamp with a living ember inside it, ticking gently as it breathes.',
    },
    beeswax: {
        name: 'Beeswax',
        type: 'material',
        icon: '🕯️',
        desc: 'A knuckle of pale wax off Bramwell\u2019s shelf. Binds a salve so it stays where you put it.',
        value: 6,
    },
    spice_root: {
        name: 'Spice Root',
        type: 'material',
        icon: '🫚',
        desc: 'A knotted, peppery root that only grows past the fern hollow. Smells like a kitchen you half remember.',
        value: 22,
    },
    ash_bark: {
        name: 'Ashen Bark',
        type: 'material',
        icon: '🪵',
        desc: 'Bark sloughed from a deep-wood ash, grey as cold coals. Steeps into something steadying.',
        value: 10,
    },
    burn_salve: {
        name: 'Burn Salve',
        type: 'consumable',
        icon: '🧴',
        desc: 'Cool, green, and faintly numbing. Heals 6 HP — and it is what people actually come to an apothecary for.',
        heal: 6,
        value: 12,
    },
    ninebark_loaf: {
        name: 'Ninebark Loaf',
        type: 'consumable',
        icon: '🍞',
        desc: 'Dense, dark, and spiced — the loaf Bramwell\u2019s old company ate the night before bad days. Heals 14 HP.',
        heal: 14,
        value: 16,
    },
    deepwood_cordial: {
        name: 'Deep-Wood Cordial',
        type: 'consumable',
        icon: '🍶',
        desc: 'Moonpetal and ashen bark, steeped slow. The strongest thing in your bag. Heals 30 HP.',
        heal: 30,
        value: 34,
    },
    hearthbound_tea: {
        name: 'Hearthbound Tea',
        type: 'consumable',
        icon: '☕',
        desc: 'Your aunt\u2019s last recipe. Heals 20 HP, and something in the smell of it makes frightened things stop and listen.',
        heal: 20,
        calming: true,
        value: 40,
    },
    wisteria_pendant: {
        name: "Wisteria's Pendant",
        type: 'equip',
        slot: 'trinket',
        icon: '💠',
        desc: 'A flat river stone your aunt wore on a bootlace for forty years. (+1 Wit, +2 Charm)',
        bonus: { wit: 1, charm: 2 },
    },
    tin_compass: {
        name: 'Tin Compass',
        type: 'equip',
        slot: 'trinket',
        icon: '🧭',
        desc: 'Peddler stock. The needle is honest about north and vague about everything else. (+1 Wit, +1 Strength)',
        bonus: { wit: 1, strength: 1 },
        value: 55,
    },
    wolfmother_tooth: {
        name: "Wolfmother's Tooth",
        type: 'equip',
        slot: 'charm',
        icon: '🦷',
        desc: 'Shed, not taken — she left it at the den mouth like a coin on a counter. (+3 Strength, -1 Charm)',
        bonus: { strength: 3 },
        penalty: { charm: 1 },
    },
    watch_pin: {
        name: "Sergeant's Pin",
        type: 'equip',
        slot: 'charm',
        icon: '📌',
        desc: 'Dorne\u2019s spare rank pin, pressed on you with a grunt. Steadies a fight, but people watch what they say near it. (+3 Strength, -1 Charm)',
        bonus: { strength: 3 },
        penalty: { charm: 1 },
    },
    hearth_knot: {
        name: 'Hearth Knot',
        type: 'equip',
        slot: 'trinket',
        icon: '🪢',
        desc: 'Cord, ash, and one grey hair of your aunt\u2019s, knotted the way the journal describes. (+2 Wit, +2 Charm)',
        bonus: { wit: 2, charm: 2 },
    },
    biscuit_collar: {
        name: "Biscuit's Collar",
        type: 'material',
        icon: '🦴',
        desc: 'A boy\u2019s dog\u2019s collar, chewed through rather than torn. Whatever happened, the dog did it to itself.',
    },
    ward_rune: {
        name: 'Cut Rune',
        type: 'material',
        icon: '🪧',
        desc: 'A palm-sized slate with the boundary mark freshly cut into it. One of the three things a hearth-stone needs.',
    },
    woods_gift: {
        name: "The Wood's Gift",
        type: 'material',
        icon: '🍂',
        desc: 'Something the Whisperwood gave up willingly rather than something you took. It matters which.',
    },
};

// --- Brewing recipes: material items consumed to produce a result item. ---
// requires: array of { item, count }. result: { item, count }.
export const BREW_RECIPES = {
    vigor_draught: {
        name: 'Vigor Draught',
        result: { item: 'vigor_draught', count: 1 },
        requires: [
            { item: 'dried_mintleaf', count: 2 },
            { item: 'river_root', count: 1 },
        ],
    },
    steady_hand_tea: {
        name: 'Steady-Hand Tea',
        result: { item: 'steady_hand_tea', count: 1 },
        requires: [
            { item: 'dried_mintleaf', count: 1 },
            { item: 'moonpetal', count: 1 },
        ],
    },
    thornback_bracer: {
        name: 'Thornback Bracer',
        result: { item: 'thornback_bracer', count: 1 },
        requires: [
            { item: 'thornback_quill', count: 2 },
            { item: 'river_root', count: 1 },
        ],
    },
    moonpetal_locket: {
        name: 'Moonpetal Locket',
        result: { item: 'moonpetal_locket', count: 1 },
        requires: [
            { item: 'moonpetal', count: 2 },
            { item: 'dried_mintleaf', count: 1 },
        ],
    },

    // --- Phase 6 recipes. Recipes with a `flag` stay hidden from the brewing
    // panel until the story sets that flag — the journal, Hollow, and Granny
    // Sessily each teach one, so the recipe list grows as the season does. ---
    burn_salve: {
        name: 'Burn Salve',
        result: { item: 'burn_salve', count: 1 },
        requires: [
            { item: 'dried_mintleaf', count: 1 },
            { item: 'beeswax', count: 1 },
        ],
        flag: 'knowsBurnSalve',
    },
    deepwood_cordial: {
        name: 'Deep-Wood Cordial',
        result: { item: 'deepwood_cordial', count: 1 },
        requires: [
            { item: 'moonpetal', count: 1 },
            { item: 'ash_bark', count: 2 },
        ],
        flag: 'knowsCordial',
    },
    hearthbound_tea: {
        name: 'Hearthbound Tea',
        result: { item: 'hearthbound_tea', count: 1 },
        requires: [
            { item: 'spice_root', count: 1 },
            { item: 'moonpetal', count: 2 },
            { item: 'ash_bark', count: 1 },
        ],
        flag: 'knowsHearthboundTea',
    },
};

/** A recipe with no `flag` is known from the start; one with a flag is only
 *  brewable (and only listed) once the story has taught it. */
export function recipeIsKnown(recipeId, hasFlag) {
    const recipe = BREW_RECIPES[recipeId];
    if (!recipe) return false;
    if (!recipe.flag) return true;
    return !!hasFlag(recipe.flag);
}

// --- Enemy definitions (for light battle encounters) ---
// Base stats only — actual encounters scale these via scaledEnemy() based on
// player level (see enemyScaleForLevel above) so the Whisperwood stays a threat.
export const ENEMY_DEFS = {
    cellar_slime: {
        name: 'Cellar Slime',
        icon: '🟢',
        hp: 14,
        strength: 2,
        xp: 12,
        fleeable: true,
    },
    hedge_wolf: {
        name: 'Hedge Wolf',
        icon: '🐺',
        hp: 22,
        strength: 4,
        xp: 20,
        fleeable: true,
    },
    thornback_boar: {
        name: 'Thornback Boar',
        icon: '🐗',
        hp: 30,
        strength: 5,
        xp: 26,
        fleeable: true,
    },
    deep_wood_stalker: {
        name: 'Deep-Wood Stalker',
        icon: '🦉',
        hp: 40,
        strength: 6,
        xp: 34,
        fleeable: false,
    },

    // --- Phase 6 ---
    thorn_hound: {
        name: 'Thorn Hound',
        icon: '🐕',
        hp: 36,
        strength: 6,
        xp: 32,
        fleeable: true,
    },
    bramble_wight: {
        name: 'Bramble Wight',
        icon: '🌾',
        hp: 46,
        strength: 7,
        xp: 42,
        fleeable: false,
    },
    thorn_crowned: {
        name: 'The Thorn-Crowned',
        icon: '🦌',
        hp: 64,
        strength: 9,
        xp: 70,
        fleeable: false,
    },
};

// --- Color palette (DOM/CSS hex strings) ---
export const COLORS = {
    bg:      '#161320',
    panel:   '#211d2e',
    text:    '#f0e9da',
    accent:  '#e0a458',
    danger:  '#d1495b',
    success: '#7fb069',
    gold:    '#ffd166',
};

// --- Typewriter text speed default lives in settings.js (Phase 4: user-adjustable) ---

// ============================================================
// Phase 6 — trading, quests, and journal lore
// ============================================================

// --- Peddler Ock's cart. `stock` is what he sells (price = the item's own
// `value`); anything in the player's bag with a `value` can be sold back to
// him at SELL_RATE of that value. Some stock only appears once a story flag
// is set, so his cart grows more interesting as the season goes on. ---
export const SELL_RATE = 0.5;

export function buyPrice(itemId) {
    const def = ITEM_DEFS[itemId];
    return def && def.value ? def.value : null;
}

export function sellPrice(itemId) {
    const def = ITEM_DEFS[itemId];
    if (!def || !def.value) return null;
    return Math.max(1, Math.floor(def.value * SELL_RATE));
}

export const TRADE_STOCK = [
    { item: 'dried_mintleaf' },
    { item: 'river_root' },
    { item: 'beeswax' },
    { item: 'honey_tonic' },
    { item: 'ash_bark', flag: 'peddlerDeepStock' },
    { item: 'moonpetal', flag: 'peddlerDeepStock' },
    { item: 'tin_compass' },
];

// --- Quests: the journal's "asked of you" page. Purely a tracker — the
// story graph still gates everything on flags and items — but it is what
// keeps an hour-long season legible when you put it down and come back. ---
export const QUEST_DEFS = {
    q_workroom:   { name: "Your Aunt's Workroom", desc: 'The far cellar door has been locked since spring. The rust-spotted key should fit it.' },
    q_burn_salve: { name: "Tobin's Mother", desc: 'A hearth burn up the whole forearm. Brew a Burn Salve and bring it to the shop counter.' },
    q_mira_debt:  { name: "Mira's Ledger", desc: 'Four months of shop costs paid out of her own wages, in her own handwriting. She would rather you did not make a thing of it.' },
    q_sessily:    { name: "Granny Sessily's Hands", desc: 'Her knuckles seize up in the cold. She asks for Steady-Hand Tea, and will pay in something better than coin.' },
    q_biscuit:    { name: 'Biscuit', desc: "Tobin's dog went into the Whisperwood four days ago and hasn't come back." },
    q_spice_root: { name: "The Captain's Loaf", desc: 'Bramwell needs spice root from past the fern hollow to bake his old captain\u2019s recipe one more time.' },
    q_wolf:       { name: 'The Hedge Wolf', desc: 'Something is denning too close to the path. Hollow says it needs moving, not killing.' },
    q_watch:      { name: "The Watch's Spears", desc: 'Sergeant Dorne and three spears are beating the hedgerows. Whatever they push out has to go somewhere.' },
    q_ward:       { name: 'The Unbound Hearth', desc: 'The boundary hearth at the heart of the Whisperwood has been cold since your aunt died. It needs an ember, a cut rune, and a gift freely given.' },
    q_ember:      { name: 'An Ember That Still Burns', desc: 'Carry live fire from a hearth someone still keeps — the shop stove, or Bramwell\u2019s oven.' },
    q_rune:       { name: 'The Cut Rune', desc: 'The boundary mark has to be cut fresh into slate. Hollow can do it; so can you, with a steady enough hand.' },
    q_gift:       { name: 'Freely Given', desc: 'The wood has to hand something over of its own accord. It cannot be taken.' },
    q_tobin_lost: { name: 'Tobin Went In', desc: 'The boy followed you past the fence posts. Find him before the wood does.' },
};

// --- Lore: journal entries and things people tell you, collected into the
// Journal panel so the backstory is readable rather than only overheard. ---
export const LORE_DEFS = {
    lore_wisteria:    { title: 'Wisteria, First Entry', text: '"Took the shop today. Forty-one years old and frightened of a doorbell. Hollow says the trick is to answer it anyway."' },
    lore_hearthstone: { title: 'The Hearth-Stone', text: 'A flat stone at the heart of the Whisperwood with a firebowl cut into it. Village and wood agreed a boundary there, long ago, and the agreement is kept by keeping the fire lit.' },
    lore_unbinding:   { title: 'The Unbinding', text: 'A hearth-fire left cold does not go out all at once. It goes out the way a friendship does: nobody notices until something that used to stay on its own side comes across.' },
    lore_hollow_past: { title: 'Hollow and Wisteria', text: 'They kept the stone together for eleven years, and then quarrelled about who the wood belonged to, and then kept it apart for thirty more.' },
    lore_ninebark:    { title: 'The Ninebark Nine', text: 'Bramwell\u2019s old company. Nine went out to the Ninebark passes; four came home; one of them opened a bakery and never said the other names out loud again.' },
    lore_thorn:       { title: 'The Thorn-Crowned', text: 'Not a beast that lives in the wood — the shape the wood takes when it is grieving and nobody is holding the other end of the agreement.' },
    lore_wolfden:     { title: 'The Wolfmother', text: 'Not a monster. A mother with three cubs and no range left to hunt, pushed out of the deep wood by something worse than herself.' },
    lore_wisteria_end:{ title: 'Wisteria, Last Entry', text: '"Hands too stiff for the walk out to the stone this spring. Will go when the frost lifts. Mira keeps asking what I am writing. Tell her, one of these days."' },
};
