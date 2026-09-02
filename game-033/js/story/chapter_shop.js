/**
 * chapter_shop.js — the apothecary as a place you actually run.
 *
 * Phase 1–5 used the shop as a corridor: one conversation, one cellar, and
 * then out the door forever. The premise ("you inherited an apothecary")
 * was never played. This chapter turns it into a hub you come back to
 * between everything else — a counter with customers who want specific
 * brewed goods, a bed that advances the day and heals you, and Mira, who
 * finally gets an arc instead of a tutorial line.
 */

export const SHOP_NODES = {
    // ------------------------------------------------------------
    // The shop hub. Deliberately effect-free: the player re-enters this
    // node dozens of times over a season, so anything granted here would
    // be granted again on every loop.
    // ------------------------------------------------------------
    shop_hub: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_interior',
        text: 'Your shop. Low beams, forty years of somebody else’s handwriting on the jars, and the particular quiet of a room that expects you to do something with it.',
        choices: [
            { label: 'Take the counter for a while.', next: 'counter_open', requires: null, effects: [] },
            { label: 'Talk to Mira.', next: 'mira_hub', requires: null, effects: [] },
            { label: 'Down to the workroom.', next: 'workroom_first_look', requires: { flag: 'workroomOpen' }, effects: [] },
            {
                label: 'Back down to the cellar — that slime still has the key.',
                next: 'cellar_entry',
                requires: { notItem: 'cellar_key' },
                effects: [],
            },
            {
                label: 'Ask Mira about the locked door at the back of the cellar.',
                next: 'workroom_ask',
                requires: { item: 'cellar_key', flag: 'workroomOpen', negate: true },
                effects: [],
            },
            { label: 'Bank the stove and sleep.', next: 'shop_rest', requires: null, effects: [] },
            {
                label: 'Lift a live coal into the hearth lamp.',
                next: 'shop_take_ember',
                requires: { item: 'hearth_lamp', questActive: 'q_ember' },
                effects: [],
            },
            { label: 'Out to the square.', next: 'village_hub', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // The counter: the actual job. Each customer wants a specific brewed
    // item, which is what finally gives brewing a reason to exist beyond
    // stocking battle healing.
    // ------------------------------------------------------------
    counter_open: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_counter',
        text: 'You put your elbows on the counter the way she used to, and wait to see what the day brings in.',
        choices: [
            {
                label: 'A boy is hovering on the step, not quite knocking.',
                next: 'counter_tobin_burn',
                requires: { flag: 'tobinAskedForSalve', negate: true },
                effects: [],
            },
            {
                label: '(Hand over the burn salve)',
                next: 'counter_salve_deliver',
                requires: { questActive: 'q_burn_salve', item: 'burn_salve' },
                effects: [],
            },
            {
                label: 'Widow Pell is peering through the window at the tonics.',
                next: 'counter_pell',
                requires: { minDay: 2, flag: 'pellAsked', negate: true },
                effects: [],
            },
            {
                label: '(Hand Widow Pell her draught)',
                next: 'counter_pell_deliver',
                requires: { flag: 'pellAsked', item: 'vigor_draught' },
                effects: [],
            },
            {
                label: 'The carter’s girl wants something for a cough that won’t quit.',
                next: 'counter_carter',
                requires: { minDay: 4, flag: 'carterAsked', negate: true },
                effects: [],
            },
            {
                label: '(Give the carter’s girl the cordial)',
                next: 'counter_carter_deliver',
                requires: { flag: 'carterAsked', item: 'deepwood_cordial' },
                effects: [],
            },
            { label: 'Nobody comes. Tidy the shelves instead.', next: 'counter_quiet', requires: null, effects: [] },
            { label: '(Leave the counter)', next: 'shop_hub', requires: null, effects: [] },
        ],
    },

    counter_tobin_burn: {
        speaker: 'Tobin',
        portrait: 'tobin_eager',
        background: 'shop_counter',
        text: [
            'The boy comes in sideways, like the door might bite. Ten years old, maybe eleven, with a stick he is clearly pretending is a sword.',
            '“Are you the new one? Mam put her arm in the hearth — not in it, on it, the bar — and it’s gone all shiny and she says it’s fine and it isn’t fine.”',
            '“Your aunt used to make a green stuff. Cold green stuff, in a pot. Have you got the green stuff?”',
        ],
        effects: [
            { type: 'setFlag', flag: 'tobinAskedForSalve', value: true },
            { type: 'setFlag', flag: 'metTobin', value: true },
            { type: 'startQuest', quest: 'q_burn_salve' },
        ],
        choices: [
            {
                label: 'I can make the green stuff. Give me until this evening.',
                next: 'counter_tobin_promise',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'tobin', amount: 2 } ],
            },
            {
                label: 'Tell her to keep it under cold water and come herself.',
                next: 'counter_tobin_promise',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'tobin', amount: -1 } ],
            },
        ],
    },

    counter_tobin_promise: {
        speaker: 'Tobin',
        portrait: 'tobin_eager',
        background: 'shop_counter',
        text: [
            '“This evening,” he repeats, in the tone of a boy who intends to hold you to it in front of witnesses.',
            'He’s halfway out the door before he swings back. “Also — have you seen a dog? Brown. Stupid. Answers to Biscuit if he feels like it. He went into the wood on Tuesday.” He says *the wood* the way other people say *the war*.',
        ],
        effects: [ { type: 'startQuest', quest: 'q_biscuit' } ],
        choices: [
            { label: 'I’ll keep an eye out for him.', next: 'counter_open', requires: null, effects: [ { type: 'addAffinity', npc: 'tobin', amount: 1 } ] },
            { label: 'Dogs come back, Tobin.', next: 'counter_open', requires: null, effects: [] },
        ],
    },

    counter_salve_deliver: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_counter',
        text: [
            'Tobin’s mother comes herself in the end, with her sleeve rolled up over a burn the length of a spoon handle and a face daring you to make a fuss.',
            'The salve goes on cold. Her shoulders come down an inch. "That’s her recipe," she says. "That’s her exact recipe." She pays you more than it’s worth and won’t hear otherwise.',
        ],
        effects: [
            { type: 'removeItem', item: 'burn_salve', count: 1 },
            { type: 'completeQuest', quest: 'q_burn_salve' },
            { type: 'giveCoin', amount: 20 },
            { type: 'giveXp', amount: 12 },
            { type: 'addAffinity', npc: 'tobin', amount: 2 },
            { type: 'setFlag', flag: 'firstSaleMade', value: true },
        ],
        choices: [
            { label: '(Back to the counter)', next: 'counter_open', requires: null, effects: [] },
        ],
    },

    counter_pell: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_counter',
        text: [
            'Widow Pell has been outside the window for ten minutes, and comes in as though she has been dragged.',
            '“I’m told you brew now.” A pause with a whole argument in it. “My knees. The hill. Your aunt did me a green-brown thing with root in it that got me up the hill.” She means a Vigor Draught, and she means it badly.',
        ],
        effects: [ { type: 'setFlag', flag: 'pellAsked', value: true } ],
        choices: [
            { label: 'I’ll have one for you by tomorrow.', next: 'counter_open', requires: null, effects: [] },
        ],
    },

    counter_pell_deliver: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_counter',
        text: 'Widow Pell drinks half of it standing at the counter, entirely against instruction, and pronounces it "not as good as hers, but nearer than I expected." From her, this is a parade.',
        effects: [
            { type: 'removeItem', item: 'vigor_draught', count: 1 },
            { type: 'giveCoin', amount: 24 },
            { type: 'giveXp', amount: 10 },
            { type: 'setFlag', flag: 'pellServed', value: true },
        ],
        choices: [
            { label: '(Back to the counter)', next: 'counter_open', requires: null, effects: [] },
        ],
    },

    counter_carter: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_counter',
        text: [
            'The carter’s girl has a cough that has outlived two winters and a father who has run out of ideas.',
            'You know the answer, and you know you can’t make it from anything in the village: it wants moonpetal and ashen bark, which means it wants the deep wood.',
        ],
        effects: [ { type: 'setFlag', flag: 'carterAsked', value: true } ],
        choices: [
            { label: 'Tell her the truth: it will take me a few days and a long walk.', next: 'counter_open', requires: null, effects: [ { type: 'addAffinity', npc: 'mira', amount: 1 } ] },
        ],
    },

    counter_carter_deliver: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_counter',
        text: [
            'The cordial is the colour of a pond and smells like the inside of a tree. The girl drinks it with enormous suspicion and then breathes — properly, all the way down — for the first time in two winters.',
            'Her father does not say thank you. He stands in your shop for a full minute not saying it, which in this village is a monument.',
        ],
        effects: [
            { type: 'removeItem', item: 'deepwood_cordial', count: 1 },
            { type: 'giveCoin', amount: 40 },
            { type: 'giveXp', amount: 18 },
            { type: 'setFlag', flag: 'carterServed', value: true },
        ],
        choices: [
            { label: '(Back to the counter)', next: 'counter_open', requires: null, effects: [] },
        ],
    },

    counter_quiet: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_counter',
        text: [
            'No bell. You turn the jars label-out, sweep a floor that didn’t need it, and find three coins in the till drawer that have been there since before you arrived.',
            'It is not exciting. It is, you notice with some surprise, not unpleasant either.',
        ],
        effects: [ { type: 'giveCoin', amount: 3 } ],
        choices: [
            { label: '(Back to the counter)', next: 'counter_open', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // Sleep: the day counter, and the only full heal outside of brewing.
    // ------------------------------------------------------------
    shop_rest: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_interior',
        text: [
            'You bank the stove, blow out the lamp, and lie listening to the shop tick and settle around you.',
            'Morning comes the way it does here — grey, then gold, then somebody’s rooster having opinions.',
        ],
        effects: [ { type: 'rest' } ],
        choices: [
            { label: '(Get up)', next: 'shop_morning', requires: null, effects: [] },
        ],
    },

    shop_morning: {
        speaker: 'Mira',
        portrait: 'mira_smile',
        background: 'shop_interior',
        text: 'Mira is already downstairs with the kettle on, because Mira is always already downstairs with the kettle on. “Right,” she says. “What are we today?”',
        choices: [
            { label: '(Get on with it)', next: 'shop_hub', requires: null, effects: [] },
        ],
    },

    shop_take_ember: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_interior',
        text: [
            'You rake the stove down to its red heart and lift one coal into the brass cage with the tongs. The shutter clicks over it.',
            'It sits there breathing — a little live thing in a lamp, off a hearth that somebody still keeps. That, the journal is very clear about: the fire has to come from a hearth that is still being kept.',
        ],
        effects: [
            { type: 'removeItem', item: 'hearth_lamp', count: 1 },
            { type: 'giveItem', item: 'lit_hearth_lamp', count: 1 },
            { type: 'completeQuest', quest: 'q_ember' },
            { type: 'setFlag', flag: 'hasEmber', value: true },
            { type: 'setFlag', flag: 'emberFromShop', value: true },
        ],
        choices: [
            { label: '(Shoulder the lamp)', next: 'shop_hub', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // Mira. In Phase 1 she was a tutorial with a face. Here she gets the
    // thing the game kept implying and never said: she has been holding
    // this shop together at her own expense and is terrified you'll sell.
    // ------------------------------------------------------------
    mira_hub: {
        speaker: 'Mira',
        portrait: 'mira_neutral',
        background: 'shop_interior',
        text: 'She looks up from the ledger with a pencil behind her ear and another one, forgotten, in her hair.',
        choices: [
            { label: 'How are you, really?', next: 'mira_debts', requires: { flag: 'miraDebtsKnown', negate: true }, effects: [] },
            { label: 'About the ledger — I want to settle up with you.', next: 'mira_repay', requires: { allFlags: ['miraDebtsKnown'], minCoin: 40, flag: 'miraRepaid', negate: true }, effects: [] },
            { label: 'Tell me about my aunt.', next: 'mira_about_wisteria', requires: { flag: 'miraToldAunt', negate: true }, effects: [] },
            { label: 'What do you actually want, Mira?', next: 'mira_dream', requires: { minAffinity: { mira: 5 }, flag: 'miraDreamKnown', negate: true }, effects: [] },
            { label: 'Teach me the brewing corner properly.', next: 'mira_brew_lesson', requires: { allFlags: ['canBrew'], flag: 'miraDeepLesson', negate: true }, effects: [] },
            {
                label: 'I’m going to the heart of the wood. Come with me.',
                next: 'mira_asked_along',
                requires: { questActive: 'q_ward', minAffinity: { mira: 6 }, flag: 'miraAlly', negate: true },
                effects: [],
            },
            { label: '(Leave her to the ledger)', next: 'shop_hub', requires: null, effects: [] },
        ],
    },

    mira_debts: {
        speaker: 'Mira',
        portrait: 'mira_worried',
        background: 'shop_interior',
        text: [
            '“Fine. Busy.” She turns the ledger a quarter-inch away from you, which is how you know to look at it.',
            'There are four months of entries in her handwriting where the column that should say SHOP says M.H. instead. Rent. Coal. The glazier. Her initials, over and over, in her own wages.',
            '“Don’t make a thing of it. Somebody had to keep the door open until you decided whether you wanted it open.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'miraDebtsKnown', value: true },
            { type: 'startQuest', quest: 'q_mira_debt' },
        ],
        choices: [
            {
                label: 'I want it open. I should have said that out loud months ago.',
                next: 'mira_debts_reply',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'mira', amount: 3 } ],
            },
            {
                label: 'You should have told me. I’d have found the money.',
                next: 'mira_debts_reply',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'mira', amount: 1 } ],
            },
            {
                label: 'That was your choice to make, not mine.',
                next: 'mira_debts_reply',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'mira', amount: -2 } ],
            },
        ],
    },

    mira_debts_reply: {
        speaker: 'Mira',
        portrait: 'mira_neutral',
        background: 'shop_interior',
        text: '“Mm,” she says, and writes something in the ledger that is definitely not a number, and does not let you see it.',
        choices: [
            { label: '(Back)', next: 'mira_hub', requires: null, effects: [] },
        ],
    },

    mira_repay: {
        speaker: 'Mira',
        portrait: 'mira_smile',
        background: 'shop_interior',
        text: [
            'You count forty out onto the ledger, on the page with her initials on it, and put the pencil in her hand.',
            '“That’s not all of it,” she says, and her voice does something complicated. “That’s not — you don’t have to—” She writes it in anyway, in the proper column, and underlines it twice, and has to stop for a moment.',
        ],
        effects: [
            { type: 'takeCoin', amount: 40 },
            { type: 'setFlag', flag: 'miraRepaid', value: true },
            { type: 'completeQuest', quest: 'q_mira_debt' },
            { type: 'addAffinity', npc: 'mira', amount: 4 },
            { type: 'giveXp', amount: 14 },
        ],
        choices: [
            { label: '(Back)', next: 'mira_hub', requires: null, effects: [] },
        ],
    },

    mira_about_wisteria: {
        speaker: 'Mira',
        portrait: 'mira_tools',
        background: 'shop_interior',
        text: [
            '“Wisteria? Rude. Brilliant. Rude about being called brilliant.” She smiles at the shelf rather than at you.',
            '“She’d be gone a whole day every few weeks and come back with her boots ruined and nothing in her basket, and if I asked she’d say she’d been *out*. Once a year, always about now, she’d take the brass lamp.”',
            '“And she used to talk to the wood. Not about it. To it. Out the back door, last thing, like you’d say goodnight to a lodger.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'miraToldAunt', value: true },
            { type: 'addLore', lore: 'lore_hearthstone' },
        ],
        choices: [
            { label: '(Back)', next: 'mira_hub', requires: null, effects: [] },
        ],
    },

    mira_dream: {
        speaker: 'Mira',
        portrait: 'mira_worried',
        background: 'shop_interior',
        text: [
            'The question lands harder than you meant it to. She puts the pencil down.',
            '“I want to be the one who knows. Not the one who fetches for the one who knows.” She says it fast and then looks appalled at herself. “I’ve been in this shop nine years. I can name every jar on that wall and I still have to ask permission to open one.”',
        ],
        effects: [ { type: 'setFlag', flag: 'miraDreamKnown', value: true } ],
        choices: [
            {
                label: 'Then be the one who knows. I’ll teach you everything the journal has.',
                next: 'mira_dream_yes',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'mira', amount: 3 } ],
            },
            {
                label: 'One thing at a time. The shop barely stands as it is.',
                next: 'mira_dream_defer',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'mira', amount: -1 } ],
            },
        ],
    },

    mira_dream_yes: {
        speaker: 'Mira',
        portrait: 'mira_smile',
        background: 'shop_interior',
        text: '“Right,” she says, already reaching for a clean page. “Right. Start with the wax one. I’ve watched her do the wax one four hundred times and I still don’t know why she works it cold.”',
        effects: [
            { type: 'setFlag', flag: 'miraApprentice', value: true },
            { type: 'giveXp', amount: 10 },
        ],
        choices: [
            { label: '(Back)', next: 'mira_hub', requires: null, effects: [] },
        ],
    },

    mira_dream_defer: {
        speaker: 'Mira',
        portrait: 'mira_neutral',
        background: 'shop_interior',
        text: '“Course. One thing at a time.” She picks the pencil back up. “That’s what she said, too. For nine years.”',
        choices: [
            { label: '(Back)', next: 'mira_hub', requires: null, effects: [] },
        ],
    },

    mira_brew_lesson: {
        speaker: 'Mira',
        portrait: 'mira_tools',
        background: 'shop_interior',
        text: [
            'She walks you through it properly this time — the order things go in, why the root is bitter if you rush it, how to tell a good moonpetal from a wet one by the sound it makes when you fold it.',
            '“And *this*,” she says, tapping a page of the journal you’d skimmed past, “is a cordial for a cough that won’t quit. Bark and moonpetal. She only ever made it twice, both times for people who couldn’t pay.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'miraDeepLesson', value: true },
            { type: 'learnRecipe', flag: 'knowsCordial' },
            { type: 'giveItem', item: 'dried_mintleaf', count: 2 },
            { type: 'giveXp', amount: 8 },
            { type: 'addAffinity', npc: 'mira', amount: 1 },
        ],
        choices: [
            { label: '(Back)', next: 'mira_hub', requires: null, effects: [] },
        ],
    },

    mira_asked_along: {
        speaker: 'Mira',
        portrait: 'mira_worried',
        background: 'shop_interior',
        text: [
            '“The *heart* of it,” she repeats. “The middle. Of the Whisperwood. Where the — yes. Right.”',
            'She looks at the door, and the ledger, and her own hands, in that order.',
            '“She never asked me. Nine years and she never once asked me to come.” A breath. “Yes. Obviously yes. Let me get my boots and shout at someone about the shop.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'miraAlly', value: true },
            { type: 'addAffinity', npc: 'mira', amount: 3 },
            { type: 'giveItem', item: 'honey_tonic', count: 2 },
            { type: 'giveXp', amount: 12 },
        ],
        choices: [
            { label: '(Back)', next: 'mira_hub', requires: null, effects: [] },
        ],
    },
};
