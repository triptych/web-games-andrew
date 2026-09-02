/**
 * chapter_workroom.js — Act I expansion: the room behind the cellar door.
 *
 * The Phase 1–5 story handed the player a Cellar Key and then never used it
 * again, and it never once asked who the aunt actually was. This chapter is
 * the payoff for both: the key opens Wisteria's sealed workroom, which is
 * where the journal (and therefore the Journal panel, the Burn Salve recipe,
 * and the whole hearth-stone plot) comes from.
 */

export const WORKROOM_NODES = {
    workroom_ask: {
        speaker: 'Mira',
        portrait: 'mira_neutral',
        background: 'shop_interior',
        text: [
            'The door at the back of the cellar? Oh. That’s — that was your aunt’s workroom.',
            'She locked it the week she got ill and never said why, and I never asked, and then it was too late to ask. I’ve been pretending it’s a wall.',
        ],
        effects: [ { type: 'startQuest', quest: 'q_workroom' } ],
        choices: [
            {
                label: 'Come down with me. We’ll open it together.',
                next: 'workroom_door',
                requires: null,
                effects: [
                    { type: 'addAffinity', npc: 'mira', amount: 2 },
                    { type: 'setFlag', flag: 'miraCameToWorkroom', value: true },
                ],
            },
            {
                label: 'I’ll go alone. You’ve got the counter.',
                next: 'workroom_door',
                requires: null,
                effects: [],
            },
        ],
    },

    workroom_door: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_cellar',
        text: [
            'The far door is oak, swollen into its frame, with forty years of shelf-dust drifted along the sill.',
            'The rust-spotted key goes in like it never left. The lock turns on the second try, with a sound like someone clearing their throat.',
        ],
        choices: [
            { label: 'Push it open.', next: 'workroom_first_look', requires: null, effects: [] },
        ],
    },

    workroom_first_look: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_workroom',
        text: [
            'A small room, colder than the cellar, with a slate workbench under a shuttered window and a chair pushed back as though someone had just stood up from it.',
            'Everything is exactly where she left it. A mortar with something long dried in the bottom. A brass lamp. A wall of jars, each labelled in a cramped, impatient hand.',
        ],
        choices: [
            { label: 'Go through the workbench.', next: 'workroom_desk', requires: { flag: 'hasJournal', negate: true }, effects: [] },
            { label: 'Take down the brass lamp.', next: 'workroom_lamp', requires: { flag: 'tookHearthLamp', negate: true }, effects: [] },
            { label: 'Read the jar labels.', next: 'workroom_jars', requires: { flag: 'lootedJars', negate: true }, effects: [] },
            { label: 'The bootlace hung on the chair back.', next: 'workroom_pendant', requires: { allFlags: ['hasJournal'], flag: 'tookPendant', negate: true }, effects: [] },
            { label: 'Go back up to the shop.', next: 'workroom_leave', requires: { flag: 'hasJournal' }, effects: [] },
        ],
    },

    workroom_desk: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_workroom',
        text: [
            'Under a slab of pressed felt, wrapped in oilcloth against the damp, there is a journal — fat, swollen, held shut with a bootlace.',
            'It starts forty-one years ago and stops in the spring. Recipes, weather, arguments with people who are mostly dead now. Halfway through, a page of careful diagrams you don’t understand at all: a flat stone, a bowl of fire, three marks around it.',
            'Tucked at the front is a recipe so simple she clearly wrote it for someone else to follow. Burn salve. Mintleaf and wax, worked cold.',
        ],
        effects: [
            { type: 'giveItem', item: 'wisteria_journal', count: 1 },
            { type: 'setFlag', flag: 'hasJournal', value: true },
            { type: 'addLore', lore: 'lore_wisteria' },
            { type: 'learnRecipe', flag: 'knowsBurnSalve' },
            { type: 'completeQuest', quest: 'q_workroom' },
            { type: 'giveXp', amount: 10 },
        ],
        choices: [
            { label: '(Keep looking around the room)', next: 'workroom_first_look', requires: null, effects: [] },
        ],
    },

    workroom_lamp: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_workroom',
        text: [
            'The lamp is squat brass, heavier than it looks, with a hinged shutter and a cage inside sized for exactly one coal.',
            'It isn’t built to give light. It’s built to carry fire a long way without letting it die — the sort of thing you make when you have somewhere to be, on foot, at night, with a hearth waiting at the far end.',
        ],
        effects: [
            { type: 'giveItem', item: 'hearth_lamp', count: 1 },
            { type: 'setFlag', flag: 'tookHearthLamp', value: true },
        ],
        choices: [
            { label: '(Keep looking around the room)', next: 'workroom_first_look', requires: null, effects: [] },
        ],
    },

    workroom_jars: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_workroom',
        text: [
            'MINTLEAF, DRIED — GOOD YEAR. RIVER ROOT — BITTER, USE HALF. WAX. WAX. WAX AGAIN, BECAUSE MIRA WILL FORGET.',
            'You take what’s still good. Behind the wax there is a jar labelled only FOR THE WALK, and it is empty, and it has been empty a long time.',
        ],
        effects: [
            { type: 'giveItem', item: 'beeswax', count: 3 },
            { type: 'giveItem', item: 'river_root', count: 2 },
            { type: 'giveItem', item: 'dried_mintleaf', count: 2 },
            { type: 'setFlag', flag: 'lootedJars', value: true },
        ],
        choices: [
            { label: '(Keep looking around the room)', next: 'workroom_first_look', requires: null, effects: [] },
        ],
    },

    workroom_pendant: {
        speaker: null,
        portrait: 'narrator',
        background: 'shop_workroom',
        text: [
            'A flat grey river stone on a bootlace, worn smooth in one spot by a thumb that went back to it for forty years.',
            'In the journal she calls it "my worry stone, which is cheaper than a vice." You put it round your neck. It is exactly as unremarkable as she was, which is to say not at all.',
        ],
        effects: [
            { type: 'giveItem', item: 'wisteria_pendant', count: 1 },
            { type: 'setFlag', flag: 'tookPendant', value: true },
            { type: 'addLore', lore: 'lore_wisteria_end' },
        ],
        choices: [
            { label: '(Keep looking around the room)', next: 'workroom_first_look', requires: null, effects: [] },
        ],
    },

    workroom_leave: {
        speaker: 'Mira',
        portrait: 'mira_worried',
        background: 'shop_workroom',
        text: [
            'Mira has been standing in the doorway for a while without coming in, arms crossed the way people do when they’re holding themselves together rather than being cross.',
            '“She used to be down here half the night. I thought it was stocktaking.” She looks at the journal under your arm. “It wasn’t stocktaking, was it.”',
        ],
        choices: [
            {
                label: 'No. I don’t think it was. I’ll find out what it was.',
                next: 'workroom_mira_promise',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'mira', amount: 2 } ],
            },
            {
                label: 'It’s just an old woman’s notebook, Mira.',
                next: 'workroom_mira_deflect',
                requires: null,
                effects: [ { type: 'addAffinity', npc: 'mira', amount: -1 } ],
            },
        ],
    },

    workroom_mira_promise: {
        speaker: 'Mira',
        portrait: 'mira_smile',
        background: 'shop_workroom',
        text: [
            '“Good.” She says it fast, like she’d been holding it ready. “Because I’ve had four months of not knowing and I’d rather have one bad answer than another four.”',
            'She shuts the shutters, and the lamp, and the door behind you both, and does not lock it again.',
        ],
        effects: [ { type: 'setFlag', flag: 'workroomOpen', value: true } ],
        choices: [
            { label: '(Back up to the shop)', next: 'shop_hub', requires: null, effects: [] },
        ],
    },

    workroom_mira_deflect: {
        speaker: 'Mira',
        portrait: 'mira_neutral',
        background: 'shop_workroom',
        text: '“Right.” She doesn’t believe you, and she doesn’t push, and somehow that’s worse than an argument. “Well. Mind the step on the way up.”',
        effects: [ { type: 'setFlag', flag: 'workroomOpen', value: true } ],
        choices: [
            { label: '(Back up to the shop)', next: 'shop_hub', requires: null, effects: [] },
        ],
    },
};
