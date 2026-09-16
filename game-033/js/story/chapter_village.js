/**
 * chapter_village.js — the square as an actual hub.
 *
 * Phase 2 called `village_square` a hub and then gave it two exits, one of
 * which was one-way. This is the real thing: a place you come back to
 * between days, with a notice board, a creek to forage, three new
 * neighbours (Granny Sessily, Tobin, and Peddler Ock), and the trading
 * economy that finally gives brewing somewhere to go.
 */

export const VILLAGE_NODES = {
    village_hub: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_square',
        // Clearing `tradeOpen` here is what closes Ock's cart when you walk
        // away from it — the hub is the only way back out of his corner.
        effects: [ { type: 'setFlag', flag: 'tradeOpen', value: false } ],
        text: 'The square, then: the well, the notice board, the bakery throwing heat across the cobbles, and the Whisperwood beyond the last roof, minding its own business or pretending to.',
        choices: [
            { label: 'Cross to the bakery.', next: 'bramwell_hub', requires: { flag: 'metBramwell' }, effects: [] },
            { label: 'Go say hello to the baker.', next: 'bramwell_intro', requires: { flag: 'metBramwell', negate: true }, effects: [] },
            { label: 'Read the notice board.', next: 'notice_board', requires: null, effects: [] },
            { label: 'Granny Sessily is on her step, as always.', next: 'sessily_hub', requires: null, effects: [] },
            {
                label: 'A peddler’s cart has drawn up by the well.',
                next: 'ock_hub',
                requires: { minDay: 2 },
                effects: [],
            },
            { label: 'Tobin is throwing stones at the fence again.', next: 'tobin_hub', requires: { flag: 'metTobin' }, effects: [] },
            { label: 'Walk down to the creek bank and forage.', next: 'creek_gather', requires: null, effects: [] },
            {
                label: 'Spears at the crossroads — the watch has come.',
                next: 'watch_arrives',
                requires: { allFlags: ['calledTheWatch'], flag: 'watchArrived', negate: true, minDay: 3 },
                effects: [],
            },
            { label: 'Out to the Whisperwood.', next: 'whisperwood_gate', requires: { flag: 'metBramwell' }, effects: [] },
            { label: 'Back into the shop.', next: 'shop_hub', requires: null, effects: [] },
            {
                label: '(Sit down with the ledger and think about calling it a season)',
                next: 'call_it_a_season',
                requires: { minDay: 4, flag: 'wardLit', negate: true },
                effects: [],
            },
        ],
    },

    // ------------------------------------------------------------
    // Notice board — the village's to-do list, and the excuse to hand the
    // player leads they'd otherwise have to trip over.
    // ------------------------------------------------------------
    notice_board: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_square',
        text: [
            'Three nails, a warped board, and a great many opinions.',
            '"LOST — brown dog, answers to nothing, belongs to the Ash boy." "WANTED — anyone who can still cut a proper boundary mark. Ask at the far cottage." "The bridge is FINE. Stop asking. — B."',
            'Under all of it, weathered nearly blank, a much older notice in a cramped, impatient hand: *Walk out to the stone every spring. If I am not here, someone must.*',
        ],
        choices: [
            {
                label: '(Take down the old notice and put it in your pocket)',
                next: 'notice_old',
                requires: { flag: 'tookOldNotice', negate: true },
                effects: [],
            },
            { label: '(Back to the square)', next: 'village_hub', requires: null, effects: [] },
        ],
    },

    notice_old: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_square',
        text: 'It is her handwriting. It has been nailed to this board for longer than you have been alive, and nobody has read it in months, and the wood behind it is a different colour to the wood around it.',
        effects: [
            { type: 'setFlag', flag: 'tookOldNotice', value: true },
            { type: 'addLore', lore: 'lore_hearthstone' },
            { type: 'giveXp', amount: 6 },
        ],
        choices: [
            { label: '(Back to the square)', next: 'village_hub', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // Foraging: the one repeatable material source, priced in days rather
    // than coin so it can't be farmed for free.
    // ------------------------------------------------------------
    creek_gather: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_lane',
        text: [
            'The creek bank below the village takes the better part of a day to work properly: knees in the wet, knife under the root crowns, mint growing where the cattle can’t reach it.',
            'You come back up at dusk with a full basket, muddy to the elbow, and — you notice, mildly appalled at yourself — in a very good mood.',
        ],
        effects: [
            { type: 'advanceDay', count: 1 },
            { type: 'giveItem', item: 'river_root', count: 2 },
            { type: 'giveItem', item: 'dried_mintleaf', count: 2 },
        ],
        choices: [
            { label: 'Work the bank again tomorrow.', next: 'creek_gather', requires: null, effects: [] },
            { label: '(Back to the square)', next: 'village_hub', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // Granny Sessily — the oldest person in the village, and the only one
    // who remembers what the hearth-stone was for.
    // ------------------------------------------------------------
    sessily_hub: {
        speaker: 'Granny Sessily',
        portrait: 'sessily_neutral',
        background: 'village_lane',
        text: 'She is on her step with a blanket over her knees in weather that does not warrant one, watching the square the way other people watch a fire.',
        choices: [
            { label: '(Introduce yourself properly)', next: 'sessily_intro', requires: { flag: 'metSessily', negate: true }, effects: [] },
            { label: 'Tell me about my aunt.', next: 'sessily_wisteria', requires: { allFlags: ['metSessily'], flag: 'sessilyToldWisteria', negate: true }, effects: [] },
            { label: 'What do you know about the stone in the wood?', next: 'sessily_stone', requires: { allFlags: ['metSessily'], flag: 'sessilyToldStone', negate: true }, effects: [] },
            { label: 'Why does nobody in this village talk about Hollow?', next: 'sessily_hollow', requires: { allFlags: ['metSessily'], flag: 'sessilyToldHollow', negate: true }, effects: [] },
            {
                label: '(Hand her the Steady-Hand Tea)',
                next: 'sessily_tea_deliver',
                requires: { questActive: 'q_sessily', item: 'steady_hand_tea' },
                effects: [],
            },
            {
                label: 'What did she do, at the end?',
                next: 'sessily_last_walk',
                requires: { allFlags: ['sessilyToldStone', 'hasJournal'], flag: 'sessilyToldLastWalk', negate: true },
                effects: [],
            },
            { label: '(Leave her to her watching)', next: 'village_hub', requires: null, effects: [] },
        ],
    },

    sessily_intro: {
        speaker: 'Granny Sessily',
        portrait: 'sessily_neutral',
        background: 'village_lane',
        text: [
            '“I know who you are. You’ve got her chin and none of her sense.” She pats the step beside her without looking up. “Sit. Standing over people is a young thing.”',
            '“Sessily. I was the midwife here for fifty years, which means I have met everyone in this village at their very worst moment and none of them can look me in the eye.”',
            'Her hands are folded in her lap, and they are shaking, and she has arranged the blanket so it isn’t obvious.',
        ],
        effects: [
            { type: 'setFlag', flag: 'metSessily', value: true },
            { type: 'startQuest', quest: 'q_sessily' },
        ],
        choices: [
            {
                label: 'Your hands. I can make something for that.',
                next: 'sessily_hands',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'sessily', amount: 3 } ],
            },
            {
                label: 'It’s good to meet you, Granny.',
                next: 'sessily_hands',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'sessily', amount: 1 } ],
            },
        ],
    },

    sessily_hands: {
        speaker: 'Granny Sessily',
        portrait: 'sessily_warm',
        background: 'village_lane',
        text: [
            '“Hah.” She unfolds them and holds them up, unembarrassed now that someone has said it out loud. “Fifty years of catching babies and now I can’t hold a cup after noon.”',
            '“Your aunt did me a tea. Mint and one of the pale flowers. Steady-hand, she called it, which was a joke, because it never steadied anything — it just made me not mind so much.” A pause. “I’ve been out four months.”',
        ],
        choices: [
            { label: 'I’ll bring you some.', next: 'sessily_hub', requires: null, effects: [ { type: 'addAffinity', npc: 'sessily', amount: 1 } ] },
        ],
    },

    sessily_tea_deliver: {
        speaker: 'Granny Sessily',
        portrait: 'sessily_warm',
        background: 'village_lane',
        text: [
            'She holds the cup in both hands for a long moment before she drinks any of it, and the shaking doesn’t stop, but her shoulders do that thing where a person stops bracing.',
            '“There she is,” Sessily says, to the cup. Then, to you: “Go in the drawer by the door. The little knotted thing. She made it the year of the bad frost and I’ve had no use for it since, and you will.”',
        ],
        effects: [
            { type: 'removeItem', item: 'steady_hand_tea', count: 1 },
            { type: 'completeQuest', quest: 'q_sessily' },
            { type: 'giveItem', item: 'hearth_knot', count: 1 },
            { type: 'giveCoin', amount: 12 },
            { type: 'giveXp', amount: 14 },
            { type: 'addAffinity', npc: 'sessily', amount: 3 },
        ],
        choices: [
            { label: '(Back)', next: 'sessily_hub', requires: null, effects: [] },
        ],
    },

    sessily_wisteria: {
        speaker: 'Granny Sessily',
        portrait: 'sessily_neutral',
        background: 'village_lane',
        text: [
            '“Wisteria Ashgrove came here at forty-one with a dead husband, a mortar, and a face like a closed door, and stayed forty years and never once said where she was from.”',
            '“She was not kind. People say kind now she’s dead, but she wasn’t. She was *reliable*, which is rarer and worth more.” Sessily’s mouth twists. “She came out in the snow for my sister’s youngest at three in the morning and complained the entire way and saved him.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'sessilyToldWisteria', value: true },
            { type: 'addLore', lore: 'lore_wisteria' },
        ],
        choices: [
            { label: '(Back)', next: 'sessily_hub', requires: null, effects: [] },
        ],
    },

    sessily_stone: {
        speaker: 'Granny Sessily',
        portrait: 'sessily_neutral',
        background: 'village_lane',
        text: [
            'She goes quiet in a way that is not the same as not answering.',
            '“There’s a stone at the heart of the Whisperwood with a bowl cut into the top of it. My grandmother walked out to it. Her mother before that. You take a live coal from a hearth someone still keeps, and you light the bowl, and you sit with it until it catches.”',
            '“That’s all it is. That’s the whole ritual — someone bothering to walk out there once a year and sit with a fire in the dark, so the wood knows the village hasn’t forgotten it exists. Sounds like nothing.” She looks at the tree line. “It has been four months. Have you not noticed how quiet the birds are?”',
        ],
        effects: [
            { type: 'setFlag', flag: 'sessilyToldStone', value: true },
            { type: 'addLore', lore: 'lore_hearthstone' },
            { type: 'addLore', lore: 'lore_unbinding' },
            { type: 'giveXp', amount: 10 },
        ],
        choices: [
            { label: '(Back)', next: 'sessily_hub', requires: null, effects: [] },
        ],
    },

    sessily_hollow: {
        speaker: 'Granny Sessily',
        portrait: 'sessily_neutral',
        background: 'village_lane',
        text: [
            '“Because they’re ashamed, and shame comes out sideways as gossip.”',
            '“Hollow was your aunt’s apprentice. Eleven years. They walked out to that stone together every spring and came back arguing about it and went again the next year.”',
            '“Then there was a bad autumn and a child died who probably could not have been saved, and the village decided somebody had to have done it wrong, and picked the one who lived out past the fence posts. Your aunt did not stand up for her. Not out loud. Not where it counted.” A long pause. “Thirty years of not being spoken to, over a thing she didn’t do, and she *still* keeps the wood off us. Think about that before you knock on her door.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'sessilyToldHollow', value: true },
            { type: 'addLore', lore: 'lore_hollow_past' },
            { type: 'giveXp', amount: 10 },
        ],
        choices: [
            { label: '(Back)', next: 'sessily_hub', requires: null, effects: [] },
        ],
    },

    sessily_last_walk: {
        speaker: 'Granny Sessily',
        portrait: 'sessily_warm',
        background: 'village_lane',
        text: [
            '“She came and sat where you’re sitting, in the spring, and said her hands were too stiff for the walk this year and she’d go when the frost lifted.”',
            '“I said, send the girl. Mira. Send *anyone*.” Sessily’s jaw works. “And she said — and I have thought about this every day since — she said, ‘It’s not a job you can hand to someone who hasn’t got a reason to care.’”',
            '“So she waited for the frost to lift and then she died in June, and the bowl has been full of rainwater ever since. Now. Have you got a reason to care, or haven’t you?”',
        ],
        effects: [
            { type: 'setFlag', flag: 'sessilyToldLastWalk', value: true },
            { type: 'addLore', lore: 'lore_wisteria_end' },
            { type: 'startQuest', quest: 'q_ward' },
            { type: 'startQuest', quest: 'q_ember' },
            { type: 'startQuest', quest: 'q_rune' },
            { type: 'startQuest', quest: 'q_gift' },
            { type: 'giveXp', amount: 12 },
        ],
        choices: [
            {
                label: 'I’ve got one now.',
                next: 'sessily_hub',
                requires: null,
                effects: [
                    { type: 'addAffinity', npc: 'sessily', amount: 3 },
                    { type: 'setFlag', flag: 'acceptedTheWalk', value: true },
                ],
            },
            { label: 'I don’t know yet. I’ll tell you when I do.', next: 'sessily_hub', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // Tobin — the village kid, and the reason the last act has stakes that
    // aren't just the player's own hit points.
    // ------------------------------------------------------------
    tobin_hub: {
        speaker: 'Tobin',
        portrait: 'tobin_eager',
        background: 'village_lane',
        text: 'He is executing a fence post with a stick. The fence post is losing.',
        choices: [
            { label: 'Any sign of Biscuit?', next: 'tobin_dog_talk', requires: { questActive: 'q_biscuit' }, effects: [] },
            { label: '(Give him back Biscuit’s collar)', next: 'tobin_collar', requires: { item: 'biscuit_collar' }, effects: [] },
            { label: 'What do you know about the wood, Tobin?', next: 'tobin_wood', requires: { flag: 'tobinToldWood', negate: true }, effects: [] },
            { label: 'You should stay out of the Whisperwood.', next: 'tobin_warned', requires: { flag: 'tobinWarned', negate: true }, effects: [] },
            { label: '(Leave him to his war)', next: 'village_hub', requires: null, effects: [] },
        ],
    },

    tobin_dog_talk: {
        speaker: 'Tobin',
        portrait: 'tobin_eager',
        background: 'village_lane',
        text: [
            '“He’s not dead.” He says it before you can say anything at all. “Everyone keeps doing the *face*. He’s not dead, he’s stuck, he gets stuck, he’s a stupid dog.”',
            '“He went in past the fern hollow. I followed him to the ferns and then I got — ” He stops. “Then I came back, because Mam.”',
        ],
        choices: [
            { label: 'I’m going that way anyway. I’ll look properly.', next: 'tobin_hub', requires: null, effects: [ { type: 'addAffinity', npc: 'tobin', amount: 2 } ] },
        ],
    },

    tobin_collar: {
        speaker: 'Tobin',
        portrait: 'tobin_scared',
        background: 'village_lane',
        text: [
            'He takes it, and turns it over, and finds the place where the leather is chewed clean through rather than torn.',
            '“He did that himself,” Tobin says, slowly, working it out. “He chewed out. He was tied up and he chewed out and he went *further in*.” He looks up at you with an expression no ten-year-old should have to arrange. “Why would he go further in?”',
        ],
        effects: [
            { type: 'removeItem', item: 'biscuit_collar', count: 1 },
            { type: 'addAffinity', npc: 'tobin', amount: 2 },
            { type: 'setFlag', flag: 'tobinHasCollar', value: true },
        ],
        choices: [
            {
                label: 'Because something in there frightened him worse than being lost. I’ll find him.',
                next: 'tobin_hub',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'tobin', amount: 2 } ],
            },
            { label: 'Dogs don’t have reasons, Tobin.', next: 'tobin_hub', requires: null, effects: [] },
        ],
    },

    tobin_wood: {
        speaker: 'Tobin',
        portrait: 'tobin_eager',
        background: 'village_lane',
        text: [
            '“Loads.” He does not know loads. “There’s wolves. There’s a boar with knives on it, Willem saw it. There’s a witch but she’s only a *witch*, she’s not a monster, she gave me a plum once.”',
            'He lowers the stick. “Mam says don’t go past the fence posts. But it’s different this year. It’s — you know when a room’s gone quiet because someone’s just stopped talking about you?”',
            'You do, in fact, know exactly that.',
        ],
        effects: [ { type: 'setFlag', flag: 'tobinToldWood', value: true } ],
        choices: [
            { label: '(Back)', next: 'tobin_hub', requires: null, effects: [] },
        ],
    },

    tobin_warned: {
        speaker: 'Tobin',
        portrait: 'tobin_eager',
        background: 'village_lane',
        text: '“I *know*.” He says it to the fence post. “Everyone says. You go in it though, don’t you.” It is not really a question, and there is something in how he says it that you will remember later, in the dark, much too late.',
        effects: [ { type: 'setFlag', flag: 'tobinWarned', value: true } ],
        choices: [
            { label: '(Back)', next: 'tobin_hub', requires: null, effects: [] },
        ],
    },

    // ------------------------------------------------------------
    // Peddler Ock — the economy. `tradeOpen` puts the Trade button in the
    // HUD; village_hub clears it again when you walk away from the cart.
    // ------------------------------------------------------------
    ock_hub: {
        speaker: 'Peddler Ock',
        portrait: 'ock_sly',
        background: 'village_square',
        effects: [
            { type: 'setFlag', flag: 'tradeOpen', value: true },
            { type: 'setFlag', flag: 'metOck', value: true },
        ],
        text: '“Apothecary!” He says it like a man laying down a winning card. The cart is small, the awning is optimistic, and everything on it is arranged to look like there is more of it than there is.',
        choices: [
            { label: '(Look over the cart)', next: 'ock_trade', requires: null, effects: [ { type: 'openTrade' } ] },
            { label: 'What’s the road like, out east?', next: 'ock_rumor', requires: { flag: 'ockToldRumor', negate: true }, effects: [] },
            {
                label: '(Talk him into carrying the deep-wood stock)',
                next: 'ock_haggle',
                requires: { minStat: { charm: 5 }, flag: 'peddlerDeepStock', negate: true },
                effects: [],
            },
            {
                label: 'I’ll buy the route off you. Forty coin, and you bring moonpetal and bark.',
                next: 'ock_haggle_pay',
                requires: { minCoin: 40, flag: 'peddlerDeepStock', negate: true },
                effects: [],
            },
            { label: '(Back to the square)', next: 'village_hub', requires: null, effects: [] },
        ],
    },

    ock_trade: {
        speaker: 'Peddler Ock',
        portrait: 'ock_grin',
        background: 'village_square',
        text: '“Take your time. Handle everything. Buy nothing, that’s traditional.”',
        choices: [
            { label: '(Look again)', next: 'ock_trade', requires: null, effects: [ { type: 'openTrade' } ] },
            { label: '(Step back from the cart)', next: 'ock_hub', requires: null, effects: [] },
        ],
    },

    ock_rumor: {
        speaker: 'Peddler Ock',
        portrait: 'ock_sly',
        background: 'village_square',
        text: [
            '“Road’s fine. Road’s *always* fine, that’s the trade.” He lowers his voice to the register men use when they are about to enjoy themselves. “The *wood’s* not fine, though, is it.”',
            '“Three villages down that treeline. Yours is the only one still on speaking terms with it, and I have started going the long way round at Ferny Cross, which costs me a day and a half and I am not a sentimental man.”',
            '“Things are coming out that ought to be going in. That’s all I’ll say. That, and the mintleaf’s four coin.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'ockToldRumor', value: true },
            { type: 'addLore', lore: 'lore_unbinding' },
        ],
        choices: [
            { label: '(Back)', next: 'ock_hub', requires: null, effects: [] },
        ],
    },

    ock_haggle: {
        speaker: 'Peddler Ock',
        portrait: 'ock_grin',
        background: 'village_square',
        text: [
            'You do not argue with him. You ask him, at length and with great interest, about the Ferny Cross detour, and let him complain about it for a full five minutes, and then observe how remarkable it is that nobody in three villages can get hold of moonpetal any more.',
            '“...Ah,” says Ock, watching the shape of it arrive. “Ah, you’re *good*. Fine. Fine! I’ll bring the pale stuff and the grey bark. Don’t tell the man at Ferny Cross I said the wood was fine.”',
        ],
        effects: [
            { type: 'setFlag', flag: 'peddlerDeepStock', value: true },
            { type: 'giveXp', amount: 10 },
        ],
        choices: [
            { label: '(Back)', next: 'ock_hub', requires: null, effects: [] },
        ],
    },

    ock_haggle_pay: {
        speaker: 'Peddler Ock',
        portrait: 'ock_grin',
        background: 'village_square',
        text: '“Coin! Direct! No haggling!” He is genuinely delighted, and slightly disappointed. “Moonpetal and grey bark, every trip, until one of us stops turning up.”',
        effects: [
            { type: 'takeCoin', amount: 40 },
            { type: 'setFlag', flag: 'peddlerDeepStock', value: true },
        ],
        choices: [
            { label: '(Back)', next: 'ock_hub', requires: null, effects: [] },
        ],
    },
};
