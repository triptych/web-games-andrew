/**
 * dialog.js — NPC dialogue trees and dialog box display.
 *
 * Dialog trees are keyed by npc id. Each node has:
 *   text   — what the NPC says
 *   speaker — who is talking (npc name or party member name)
 *   choices — optional array of { label, next, condition?, action? }
 *   next    — id of next node (if no choices), or 'end'
 *   action  — optional { type, payload } side-effect
 *
 * Action types: 'giveQuest', 'completeQuest', 'giveItem', 'setFlag', 'joinParty', 'shop'
 */

export const NPC_DEFS = {
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
        start: 'greet',
        nodes: {
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
        },
    },

    farmer_holt_ch1: {
        start: 'greet',
        nodes: {
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
            refuse: {
                speaker: 'Farmer Holt',
                text: '... Fine. I will manage somehow.',
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
                    { label: 'Perhaps later.', next: 'end' },
                ],
            },
            rest: {
                speaker: 'Aldric',
                text: 'Wonderful! Sleep well, brave ones. Tomorrow\'s troubles can wait until tomorrow.',
                next: 'end',
            },
        },
    },

    npc_scholar_ch3: {
        start: 'greet',
        nodes: {
            greet: {
                speaker: 'Scholar Aneth',
                text: 'You made it to the ruins. Good. There is no time — the lich shards are the key. Three of them power the sealing lock on the inner sanctum.',
                next: 'explain',
            },
            explain: {
                speaker: 'Scholar Aneth',
                text: 'Destroy five shards anywhere in these ruins and the resonance will shatter the seal. It will also wake whatever is inside. Are you prepared for that?',
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
        },
    },

    npc_dryad_ch2: {
        start: 'greet',
        nodes: {
            greet: {
                speaker: 'Sylvara',
                text: 'Mortals... you carry the smell of lich-shadow on you. But also light. You are not enemies of the forest.',
                next: 'plea',
            },
            plea: {
                speaker: 'Sylvara',
                text: 'The corruption seeps from the ruins. Lich-shards animate in the wood and poison my roots. I cannot halt it alone. Bring me soul gems from the shards — three will be enough to begin the cleansing.',
                choices: [
                    { label: 'We will gather the soul gems.', next: 'accept', action: { type: 'giveQuest', payload: 'spirit_of_the_wood' } },
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
                text: 'Bless you. I will mark the path to my deepest roots on your map. The gems must be placed at each anchor point. Go swiftly.',
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
