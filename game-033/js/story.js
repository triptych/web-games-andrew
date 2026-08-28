/**
 * story.js — the story graph. Pure data: nodes keyed by id.
 *
 * Node shape:
 * {
 *   speaker:    string | null       — name shown above the dialogue box (null = narration)
 *   portrait:   string | null       — key into PORTRAITS (css class / emoji stand-in for art)
 *   background: string              — key into BACKGROUNDS
 *   text:       string | string[]   — one or more lines shown in sequence before choices appear
 *   choices:    Array<{
 *       label:    string
 *       next:     string                              — id of the node to go to
 *       requires: { flag?, minAffinity?: {npcId:n}, item? } | null
 *       effects:  Array<{ type, ... }>                — applied when this choice is picked
 *   }>
 *   effects:    Array<...>          — applied automatically on node entry (before choices render)
 *   battle:     string | null       — enemy id from ENEMY_DEFS; if set, entering this node starts a battle first
 *   onWin / onLose: string          — next node id depending on battle outcome (only used if `battle` set)
 * }
 *
 * Effect types:
 *   { type: 'setFlag', flag, value }
 *   { type: 'addAffinity', npc, amount }
 *   { type: 'giveItem', item, count }
 *   { type: 'removeItem', item, count }
 *   { type: 'giveXp', amount }
 */

export const PORTRAITS = {
    mira_neutral:  { emoji: '🧑‍🌾', label: 'Mira' },
    mira_worried:  { emoji: '😟', label: 'Mira' },
    mira_smile:    { emoji: '🙂', label: 'Mira' },
    narrator:      { emoji: '📖', label: '' },
};

export const BACKGROUNDS = {
    shop_interior: { gradient: 'linear-gradient(180deg, #2b2440, #1a1626)', label: 'The Apothecary' },
    shop_cellar:   { gradient: 'linear-gradient(180deg, #14121c, #0a0910)', label: 'The Cellar' },
    village_square:{ gradient: 'linear-gradient(180deg, #3a4a5c, #1c2733)', label: 'Village Square' },
};

export const STORY = {
    start: {
        speaker: null,
        portrait: null,
        background: 'shop_interior',
        text: [
            'The bell above the door hasn’t rung in three days.',
            'You inherited your aunt’s apothecary shop last spring, and you are still learning where everything is kept — and what everything does.',
        ],
        choices: [
            { label: 'Continue.', next: 'mira_intro', requires: null, effects: [] },
        ],
    },

    mira_intro: {
        speaker: 'Mira',
        portrait: 'mira_worried',
        background: 'shop_interior',
        text: 'Oh — good, you’re up. Listen, I keep hearing something squelching around down in the cellar. I didn’t want to go alone.',
        choices: [
            {
                label: 'I’ll go take a look right now.',
                next: 'mira_grateful',
                requires: null,
                effects: [
                    { type: 'setFlag', flag: 'helpedMiraImmediately', value: true },
                    { type: 'addAffinity', npc: 'mira', amount: 2 },
                ],
            },
            {
                label: 'Squelching? That doesn’t sound dangerous. Can it wait?',
                next: 'mira_hesitant',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'mira', amount: -1 } ],
            },
        ],
    },

    mira_grateful: {
        speaker: 'Mira',
        portrait: 'mira_smile',
        background: 'shop_interior',
        text: 'Really? Thank you — you didn’t have to say yes so fast. You’re already better at this than your aunt was, some days.',
        choices: [
            { label: 'Head down to the cellar.', next: 'cellar_entry', requires: null, effects: [] },
            {
                label: '(Ask about the herb garden first)',
                next: 'herb_garden_chat',
                requires: { minAffinity: { mira: 2 } },
                effects: [],
            },
        ],
    },

    mira_hesitant: {
        speaker: 'Mira',
        portrait: 'mira_neutral',
        background: 'shop_interior',
        text: 'It can... probably wait. But if it eats through another sack of mintleaf, that’s coming out of your share of the profits.',
        choices: [
            { label: 'Fine, fine — I’ll check the cellar.', next: 'cellar_entry', requires: null, effects: [] },
        ],
    },

    herb_garden_chat: {
        speaker: 'Mira',
        portrait: 'mira_smile',
        background: 'shop_interior',
        text: 'The herb garden? It’s doing well, actually — the mintleaf came in early this year. You have a good hand with growing things.',
        choices: [
            { label: '(Head to the cellar)', next: 'cellar_entry', requires: null, effects: [] },
        ],
    },

    cellar_entry: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_cellar',
        text: 'The cellar stairs creak underfoot. Somewhere in the dark, something wet shifts against a shelf.',
        choices: [
            { label: 'Light the lantern and press on.', next: 'cellar_slime_fight', requires: null, effects: [] },
        ],
    },

    cellar_slime_fight: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_cellar',
        text: 'A cellar slime rears up between the shelves, dripping something faintly minty.',
        battle: 'cellar_slime',
        onWin: 'cellar_slime_won',
        onLose: 'cellar_slime_lost',
        choices: [],
    },

    cellar_slime_won: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_cellar',
        text: 'The slime splits apart with a wet pop, leaving behind a rust-spotted key and a few scraps of chewed mintleaf.',
        effects: [
            { type: 'giveItem', item: 'cellar_key', count: 1 },
            { type: 'giveItem', item: 'dried_mintleaf', count: 2 },
        ],
        choices: [
            { label: 'Bring the key back up to Mira.', next: 'mira_thanks', requires: null, effects: [] },
        ],
    },

    cellar_slime_lost: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_cellar',
        text: 'The slime gets the better of you this time. You retreat up the stairs, singed and sticky, to lick your wounds.',
        choices: [
            { label: 'Rest, then try again later.', next: 'mira_thanks', requires: null, effects: [] },
        ],
    },

    mira_thanks: {
        speaker: 'Mira',
        portrait: 'mira_smile',
        background: 'shop_interior',
        text: 'You’re back! Oh — is that the old cellar key? I thought we’d lost that years ago. Thank you, truly.',
        effects: [ { type: 'addAffinity', npc: 'mira', amount: 1 }, { type: 'giveXp', amount: 12 } ],
        choices: [
            { label: '(End of Phase 1 preview)', next: 'end_preview', requires: null, effects: [] },
        ],
    },

    end_preview: {
        speaker: null,
        portrait: 'narrator',
        background: 'village_square',
        text: [
            'That’s the end of this preview slice of Hearthbound.',
            'More of the village, its people, and the Whisperwood beyond are still to come.',
        ],
        choices: [],
        ending: true,
    },
};
