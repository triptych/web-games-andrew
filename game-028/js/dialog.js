/**
 * dialog.js — NPC dialogue trees and dialog box display.
 *
 * Dialog trees are keyed by npc id. Each node has:
 *   text    — what the NPC says
 *   speaker — who is talking (npc name or party member name)
 *   choices — optional array of { label, next, condition?, action? }
 *   next    — id of next node (if no choices), or 'end'
 *   action  — optional { type, payload } side-effect
 *   routes  — optional array of { condition?, next }, checked in order; first
 *             match is jumped to silently (no text shown) — used to make a
 *             tree branch on live game state when the NPC is revisited
 *
 * Condition strings (see DialogScene._checkCondition):
 *   chapter_N, quest_done_ID, quest_active_ID, has_item_ID, has_qty:ID:N,
 *   flag_NAME, not_flag_NAME, party_has_ID
 *
 * Action types: 'giveQuest', 'completeQuest', 'giveItem', 'setFlag', 'setChapter',
 *   'joinParty', 'shop', 'turnInItems' ({itemId, qty, questId}), 'multi' (array of actions), 'rest'
 */

export const NPC_DEFS = {
    orin: {
        id: 'orin', name: 'Orin', portrait: '🛡️', color: '#64c8ff',
        title: 'Iron Vanguard',
        bio: 'A disgraced knight who carries an oath-debt to protect the innocent.',
    },
    sera: {
        id: 'sera', name: 'Sera', portrait: '🏹', color: '#64dc8c',
        title: 'Thornwood Ranger',
        bio: 'An elf ranger who knows the Thornwood better than anyone.',
    },
    thane: {
        id: 'thane', name: 'Thane', portrait: '💀', color: '#ff8050',
        title: 'Soulbrand Warlock',
        bio: 'A former imperial warlock seeking redemption in the ruins.',
    },
    elder_varec: {
        id: 'elder_varec', name: 'Elder Varec', portrait: '🧓', color: '#c8a060',
        title: 'Village Elder',
        bio: 'The wise elder of Thornhaven. He has watched the darkness spreading from Aethermoor with growing dread.',
    },
    farmer_holt: {
        id: 'farmer_holt', name: 'Farmer Holt', portrait: '👨‍🌾', color: '#a0c870',
        title: 'Thornhaven Farmer',
        bio: 'A simple farmer whose fields border the enchanted forest. The slimes are destroying his livelihood.',
    },
    borin: {
        id: 'borin', name: 'Borin', portrait: '🧔', color: '#c8a060',
        title: 'Wandering Merchant',
        bio: 'An itinerant merchant who trades between the villages. He was ambushed by bandits on the road.',
    },
    npc_dryad: {
        id: 'npc_dryad', name: 'Sylvara', portrait: '🌳', color: '#64dc8c',
        title: 'Ancient Dryad',
        bio: 'Spirit guardian of the Thornwood. She has watched the forest for a thousand years, and wept as it began to die.',
    },
    npc_scholar: {
        id: 'npc_scholar', name: 'Scholar Aneth', portrait: '📚', color: '#a0b0ff',
        title: 'Aethermoor Scholar',
        bio: 'A survivor of the Academy who has pieced together the truth of the Lich\'s awakening from forbidden texts.',
    },
    blacksmith: {
        id: 'blacksmith', name: 'Marta', portrait: '⚒️', color: '#d06030',
        title: 'Village Blacksmith',
        bio: 'The no-nonsense blacksmith of Thornhaven. Her weapons have armed three generations of adventurers.',
    },
    innkeeper: {
        id: 'innkeeper', name: 'Aldric', portrait: '🏠', color: '#c0a050',
        title: 'Innkeeper',
        bio: 'The jovial innkeeper of the Ember Hearth Inn. A rest here restores the party\'s HP and MP.',
    },
};

export const DIALOG_TREES = {
    elder_varec_ch1: {
        start: 'route',
        nodes: {
            route: {
                routes: [
                    { condition: 'flag_borin_found', next: 'report_borin' },
                ],
                next: 'greet',
            },
            greet: {
                speaker: 'Elder Varec',
                text: 'Ah, travelers. The stars guided you to Thornhaven, I think. We are in dire need of those willing to protect the innocent.',
                choices: [
                    { label: 'What troubles you, Elder?', next: 'troubles' },
                    { label: 'We are just passing through.', next: 'passing' },
                ],
            },
            troubles: {
                speaker: 'Elder Varec',
                text: 'A darkness stirs in the old Academy ruins — Aethermoor. My merchant Borin went missing on the Thornwood road three days ago. The bandits have grown bold.',
                choices: [
                    { label: "We will find Borin.", next: 'accept_quest', action: { type: 'giveQuest', payload: 'the_missing_merchant' } },
                    { label: 'Tell me about Aethermoor.', next: 'about_aethermoor' },
                ],
            },
            about_aethermoor: {
                speaker: 'Elder Varec',
                text: 'Long ago the Academy studied the Aether — the raw magic that binds worlds. A great Lich was sealed there when its masters fell. Rumor says the seals weaken. I pray it is only rumor.',
                next: 'troubles',
            },
            accept_quest: {
                speaker: 'Elder Varec',
                text: 'Bless you. Borin was last seen near the old mill bridge. Be wary — the bandits are desperate. Return safely, and I will see you rewarded.',
                next: 'end',
            },
            passing: {
                speaker: 'Elder Varec',
                text: 'Of course. But perhaps you will reconsider if you hear of our troubles? The Ember Hearth Inn will give you a warm bed.',
                next: 'end',
            },
            report_borin: {
                speaker: 'Elder Varec',
                text: 'Borin lives! And "the Lich\'s hand" directs the bandits, you say... This is graver than I feared. Thornhaven owes you a great debt.',
                next: 'advance_ch2',
                action: { type: 'completeQuest', payload: 'the_missing_merchant' },
            },
            advance_ch2: {
                speaker: 'Elder Varec',
                text: 'The road to the Thornwood should be safer now, but the corruption runs deeper than bandits. The trees themselves are dying. Seek out whatever spirit still watches over that forest — and take care. I sense your party will need more hands before this is through.',
                next: 'end',
                action: { type: 'setChapter', payload: 2 },
            },
        },
    },

    farmer_holt_ch1: {
        start: 'route',
        nodes: {
            route: {
                routes: [
                    { condition: 'quest_done_slime_infestation', next: 'farewell' },
                    { condition: 'has_qty:slime_core:3', next: 'turn_in' },
                    { condition: 'quest_active_slime_infestation', next: 'reminder' },
                ],
                next: 'greet',
            },
            greet: {
                speaker: 'Farmer Holt',
                text: 'Oh thank the gods, adventurers! Those blasted slimes have eaten half my turnips. If something is not done I will lose the whole harvest!',
                choices: [
                    { label: 'We can clear the slimes for you.', next: 'accept', action: { type: 'giveQuest', payload: 'slime_infestation' } },
                    { label: 'Sorry, not our problem.', next: 'refuse' },
                ],
            },
            accept: {
                speaker: 'Farmer Holt',
                text: 'Wonderful! Bring me their cores — three should do it. I need proof for the Elder\'s ledger, you see. I cannot pay much, but I will share what I can.',
                next: 'end',
            },
            reminder: {
                speaker: 'Farmer Holt',
                text: 'Still overrun with slimes, I\'m afraid. Bring me three cores and I\'ll square you away.',
                next: 'end',
            },
            turn_in: {
                speaker: 'Farmer Holt',
                text: 'Three cores, just as I asked! You have my thanks, and the little I can spare besides.',
                next: 'end',
                action: { type: 'turnInItems', payload: { itemId: 'slime_core', qty: 3, questId: 'slime_infestation' } },
            },
            refuse: {
                speaker: 'Farmer Holt',
                text: '... Fine. I will manage somehow.',
                next: 'end',
            },
            farewell: {
                speaker: 'Farmer Holt',
                text: 'The turnips are safe now, thanks to you. My family won\'t go hungry this winter.',
                next: 'end',
            },
        },
    },

    borin_found: {
        start: 'greet',
        nodes: {
            greet: {
                speaker: 'Borin',
                text: 'You found me! Those bandits took everything — my coin, my goods. I thought I was done for.',
                next: 'info',
            },
            info: {
                speaker: 'Borin',
                text: 'I heard them mention a name — "the Lich\' s hand." Someone is directing them. This is bigger than mere banditry, friends.',
                next: 'end',
                action: { type: 'setFlag', payload: { name: 'flag_borin_found', value: true } },
            },
        },
    },

    blacksmith_shop: {
        start: 'greet',
        nodes: {
            greet: {
                speaker: 'Marta',
                text: 'Need weapons or armor? You have come to the right forge. I keep only the finest stock — none of that bandit junk.',
                choices: [
                    { label: 'Show me your wares.', next: 'shop', action: { type: 'shop', payload: 'blacksmith_stock' } },
                    { label: 'Maybe later.', next: 'end' },
                ],
            },
            shop: { speaker: 'Marta', text: '...', next: 'end' },
        },
    },

    innkeeper_rest: {
        start: 'greet',
        nodes: {
            greet: {
                speaker: 'Aldric',
                text: 'Welcome to the Ember Hearth! A room and a hot meal will set you right. Only 30 gold for the party — shall I make up the beds?',
                choices: [
                    { label: 'Yes, we need rest. (30 gold)', next: 'rest', action: { type: 'rest', payload: { cost: 30 } } },
                    { label: 'Show me your traveling goods.', next: 'shop', action: { type: 'shop', payload: 'general_stock' } },
                    { label: 'Perhaps later.', next: 'end' },
                ],
            },
            rest: {
                speaker: 'Aldric',
                text: 'Wonderful! Sleep well, brave ones. Tomorrow\'s troubles can wait until tomorrow.',
                next: 'end',
            },
            shop: { speaker: 'Aldric', text: '...', next: 'end' },
        },
    },

    npc_scholar_ch3: {
        start: 'route',
        nodes: {
            route: {
                routes: [
                    { condition: 'flag_seal_broken', next: 'farewell' },
                    { condition: 'has_qty:soul_gem:2', next: 'turn_in' },
                    { condition: 'quest_active_the_third_shard', next: 'reminder' },
                ],
                next: 'greet',
            },
            greet: {
                speaker: 'Scholar Aneth',
                text: 'You made it to the ruins. Good. There is no time — the lich shards are the key. Three of them power the sealing lock on the inner sanctum.',
                next: 'explain',
            },
            explain: {
                speaker: 'Scholar Aneth',
                text: 'Destroy the shards anywhere in these ruins and bring me two soul gems as proof — the resonance will shatter the seal. It will also wake whatever is inside. Are you prepared for that?',
                choices: [
                    { label: 'We are ready.', next: 'accept', action: { type: 'giveQuest', payload: 'the_third_shard' } },
                    { label: 'Tell me more about the Lich.', next: 'lore' },
                ],
            },
            lore: {
                speaker: 'Scholar Aneth',
                text: 'The Lich was once the Academy\'s headmaster — Vaelthas. He sought to bind the Aether permanently to this world. The other masters stopped him, but could not destroy him. They sealed him here instead, hoping time would do what they could not.',
                next: 'explain',
            },
            accept: {
                speaker: 'Scholar Aneth',
                text: 'Then go. I will stay here and keep the entry clear for your return. Do not die — I am not much of a fighter.',
                next: 'end',
            },
            reminder: {
                speaker: 'Scholar Aneth',
                text: 'The shards still animate in these halls. Bring me two soul gems and the seal will break.',
                next: 'end',
            },
            turn_in: {
                speaker: 'Scholar Aneth',
                text: 'This is it — the resonance is already building. Stand back!',
                next: 'seal_break',
                action: { type: 'multi', payload: [
                    { type: 'turnInItems', payload: { itemId: 'soul_gem', qty: 2, questId: 'the_third_shard' } },
                    { type: 'setFlag', payload: { name: 'flag_seal_broken', value: true } },
                ] },
            },
            seal_break: {
                speaker: 'Scholar Aneth',
                text: 'The seal is broken. Gods help us — I can feel it waking below. Vaelthas stirs. The sanctum doors stand open to the south now. I will give you what strength I have.',
                next: 'advance_ch4',
                action: { type: 'giveItem', payload: { id: 'phoenix_down', qty: 1 } },
            },
            advance_ch4: {
                speaker: 'Scholar Aneth',
                text: 'This is the last of it. Go — end what my order began, one way or another.',
                next: 'end',
                action: { type: 'multi', payload: [
                    { type: 'setChapter', payload: 4 },
                    { type: 'giveQuest', payload: 'echoes_end' },
                ] },
            },
            farewell: {
                speaker: 'Scholar Aneth',
                text: 'The depths await, when you are ready to face them.',
                next: 'end',
            },
        },
    },

    orin_recruit: {
        start: 'greet',
        nodes: {
            greet: {
                speaker: 'Orin',
                text: 'You there. Are you heading into the Thornwood? The bandits have been bold lately — someone with a sword arm would be useful to you.',
                choices: [
                    { label: 'Join us, then. We could use you.', next: 'join', action: { type: 'joinParty', payload: 'orin' } },
                    { label: 'We can handle ourselves.', next: 'refuse' },
                ],
            },
            join: {
                speaker: 'Orin',
                text: 'Hah. I had hoped you would say that. My oath demands I protect those who cannot protect themselves — and right now, that means stopping whatever stirs in those ruins. Let us go.',
                next: 'end',
            },
            refuse: {
                speaker: 'Orin',
                text: 'As you wish. If you change your mind, I will be here. The darkness ahead is not something to face alone.',
                next: 'end',
            },
        },
    },

    sera_recruit: {
        start: 'greet',
        nodes: {
            greet: {
                speaker: 'Sera',
                text: 'Careful — the wolf pack has moved east again. I\'ve been tracking them for a week. You look like you\'re heading deeper into the wood. Mind if I guide you?',
                choices: [
                    { label: 'Please — we need someone who knows this forest.', next: 'join', action: { type: 'joinParty', payload: 'sera' } },
                    { label: 'We have a map. We will manage.', next: 'refuse' },
                ],
            },
            join: {
                speaker: 'Sera',
                text: 'Good. My people cast me out for walking with humans — so I may as well walk with humans worth following. Stay behind me and keep quiet when I raise my hand.',
                next: 'end',
            },
            refuse: {
                speaker: 'Sera',
                text: 'Brave or foolish — hard to tell the difference in the Thornwood. Find me if you reconsider.',
                next: 'end',
            },
        },
    },

    thane_recruit: {
        start: 'greet',
        nodes: {
            greet: {
                speaker: 'Thane',
                text: 'You are here for the Lich. I can feel its resonance from here — it woke when you broke those shards. Do not look at me like that. I am not your enemy.',
                choices: [
                    { label: 'Then help us. We need every edge we can get.', next: 'join', action: { type: 'joinParty', payload: 'thane' } },
                    { label: 'How do we know we can trust you?', next: 'trust' },
                ],
            },
            trust: {
                speaker: 'Thane',
                text: 'You cannot — not entirely. I was bound to a demon once. I broke that bond. The darkness still clings, but I direct it. What I am offering is my power against a greater darkness. That is all.',
                choices: [
                    { label: 'Good enough. Come with us.', next: 'join', action: { type: 'joinParty', payload: 'thane' } },
                    { label: 'We will face the Lich without you.', next: 'refuse' },
                ],
            },
            join: {
                speaker: 'Thane',
                text: 'Then let us end this. I have waited long enough for a chance at redemption.',
                next: 'end',
            },
            refuse: {
                speaker: 'Thane',
                text: 'Admirable stubbornness. I will be here if the Lich proves more than you bargained for.',
                next: 'end',
            },
        },
    },

    npc_dryad_ch2: {
        start: 'route',
        nodes: {
            route: {
                routes: [
                    // Orin's thread can trigger on any visit once he's recruited, even after the main quest is done —
                    // e.g. if the player recruits him only after already cleansing the grove.
                    { condition: 'not_flag_flag_broken_oath_offered', next: 'orin_check' },
                    { condition: 'quest_done_spirit_of_the_wood', next: 'farewell' },
                    { condition: 'all_flags:flag_grove_anchor_1,flag_grove_anchor_2,flag_grove_anchor_3', next: 'turn_in' },
                    { condition: 'quest_active_spirit_of_the_wood', next: 'reminder' },
                ],
                next: 'greet',
            },
            orin_check: {
                routes: [
                    { condition: 'party_has_orin', next: 'orin_thread_text' },
                ],
                next: 'post_orin_check',
            },
            post_orin_check: {
                routes: [
                    { condition: 'quest_done_spirit_of_the_wood', next: 'farewell' },
                    { condition: 'all_flags:flag_grove_anchor_1,flag_grove_anchor_2,flag_grove_anchor_3', next: 'turn_in' },
                    { condition: 'quest_active_spirit_of_the_wood', next: 'reminder' },
                ],
                next: 'greet',
            },
            greet: {
                speaker: 'Sylvara',
                text: 'Mortals... you carry the smell of lich-shadow on you. But also light. You are not enemies of the forest.',
                next: 'plea',
            },
            plea: {
                speaker: 'Sylvara',
                text: 'The corruption seeps from the ruins and poisons my roots through three anchor points scattered around this grove. I cannot cleanse them myself. Carry soul gems to each anchor and press them into the wood — the lich-shards in the Thornwood carry the gems within them.',
                choices: [
                    { label: 'We will cleanse the anchor points.', next: 'accept', action: { type: 'giveQuest', payload: 'spirit_of_the_wood' } },
                    { label: 'What is the World Tree?', next: 'world_tree' },
                ],
            },
            world_tree: {
                speaker: 'Sylvara',
                text: 'I am the World Tree — or rather, its voice. My roots reach the heart of this land. If I fall, the ley lines that feed Thornwood\'s magic die with me.',
                next: 'plea',
            },
            accept: {
                speaker: 'Sylvara',
                text: 'Bless you. Look for the roots that pulse faintly with corruption — those are the anchor points. You will need three soul gems, one for each.',
                next: 'end',
            },
            reminder: {
                speaker: 'Sylvara',
                text: 'The anchor points still ache with corruption. Hunt lich-shards in the Thornwood for soul gems, then press one into each pulsing root.',
                next: 'end',
            },
            turn_in: {
                speaker: 'Sylvara',
                text: 'I feel it — all three anchors cleansed. The poison recedes from my roots at last. Thank you, mortals. Take this token of the forest\'s gratitude.',
                next: 'farewell',
                action: { type: 'multi', payload: [
                    { type: 'completeQuest', payload: 'spirit_of_the_wood' },
                    { type: 'giveItem', payload: { id: 'hi_potion', qty: 1 } },
                ] },
            },
            orin_thread_text: {
                speaker: 'Sylvara',
                text: 'The path south, past my deepest roots, now lies open — a shattered chapel. I felt a name echo from it just now: Korvas. The iron-hearted one among you will know it.',
                next: 'end',
                action: { type: 'multi', payload: [
                    { type: 'giveQuest', payload: 'broken_oath' },
                    { type: 'setFlag', payload: { name: 'flag_broken_oath_offered', value: true } },
                ] },
            },
            farewell: {
                speaker: 'Sylvara',
                text: 'The wood breathes easier because of you. Walk safely, friends of the forest.',
                next: 'end',
            },
        },
    },
};

/** Get dialog tree by id */
export function getDialog(treeId) { return DIALOG_TREES[treeId]; }

/** Get NPC definition */
export function getNPC(id) { return NPC_DEFS[id]; }

/** Shop stock definitions (for blacksmith, etc.) */
export const SHOP_STOCKS = {
    blacksmith_stock: ['iron_dagger', 'mage_staff', 'longbow', 'leather_vest', 'chain_mail', 'mage_robe'],
    general_stock:    ['potion', 'hi_potion', 'ether', 'antidote', 'phoenix_down'],
};
