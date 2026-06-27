/**
 * quests.js — Quest definitions.
 *
 * Each quest has:
 *   id, title, giver (npc id), chapter, description,
 *   objectives (array of { type, id/qty, label }),
 *   rewards { xp, gold, items[] }
 *
 * Objective types: 'defeat', 'collect', 'talk', 'visit', 'story'
 * Quest progress is tracked in state._storyFlags.
 */

export const QUEST_DEFS = {
    // --- Chapter 1 ---
    the_missing_merchant: {
        id: 'the_missing_merchant',
        title: 'The Missing Merchant',
        giver: 'elder_varec',
        chapter: 1,
        desc: 'Elder Varec\'s trusted merchant Borin has gone missing on the road to Thornwood. Find him and return safely.',
        objectives: [
            { type: 'defeat', id: 'bandit', qty: 2, label: 'Defeat Thornwood Bandits (0/2)' },
            { type: 'talk',   id: 'borin',          label: 'Find Borin the merchant' },
        ],
        rewards: { xp: 80, gold: 60, items: ['potion', 'potion'] },
    },
    slime_infestation: {
        id: 'slime_infestation',
        title: 'Slime Infestation',
        giver: 'farmer_holt',
        chapter: 1,
        desc: 'Farmer Holt\'s crops are being ravaged by slimes. Clear them out and bring back the slime cores as proof.',
        objectives: [
            { type: 'collect', id: 'slime_core', qty: 3, label: 'Collect Slime Cores (0/3)' },
        ],
        rewards: { xp: 50, gold: 40, items: ['antidote', 'antidote'] },
    },
    lyras_past: {
        id: 'lyras_past',
        title: "Lyra's Past",
        giver: 'lyra',
        chapter: 1,
        desc: 'Lyra speaks of a scroll hidden in the old Academy ruins — the prophecy that shattered her life. Retrieve it before the Lich\'s servants do.',
        objectives: [
            { type: 'visit',   id: 'map_ruins',         label: 'Reach the Academy Ruins' },
            { type: 'collect', id: 'elder_scroll', qty: 1, label: 'Recover the Elder Scroll' },
        ],
        rewards: { xp: 120, gold: 0, items: ['ether'] },
    },

    // --- Chapter 2 ---
    broken_oath: {
        id: 'broken_oath',
        title: "Orin's Broken Oath",
        giver: 'orin',
        chapter: 2,
        desc: 'Orin reveals why he was exiled from the Solarian Order. A corrupted paladin named Korvas now leads the chapter. Confront him in the old chapel.',
        objectives: [
            { type: 'defeat', id: 'golem', qty: 1, label: 'Defeat the Stone Sentinel (guardian golem)' },
            { type: 'story',  id: 'flag_korvas_confronted', label: 'Confront Korvas in the chapel' },
        ],
        rewards: { xp: 200, gold: 80, items: ['chain_mail'] },
    },
    spirit_of_the_wood: {
        id: 'spirit_of_the_wood',
        title: 'Spirit of the Wood',
        giver: 'npc_dryad',
        chapter: 2,
        desc: 'An ancient dryad asks you to cleanse the corruption spreading from the Thornwood\'s heart — place tainted lich shards near the World Tree.',
        objectives: [
            { type: 'collect', id: 'soul_gem', qty: 3, label: 'Gather Soul Gems (0/3)' },
            { type: 'visit',   id: 'map_world_tree',   label: 'Reach the World Tree' },
        ],
        rewards: { xp: 180, gold: 60, items: ['hi_potion', 'ether'] },
    },

    // --- Chapter 3 ---
    the_third_shard: {
        id: 'the_third_shard',
        title: 'The Third Shard',
        giver: 'npc_scholar',
        chapter: 3,
        desc: 'Scholar Aneth believes a third lich shard powers the sealing lock on the Aethermoor ruins. You must find and destroy it.',
        objectives: [
            { type: 'defeat', id: 'lich_shard', qty: 5, label: 'Destroy Lich Shards (0/5)' },
            { type: 'story',  id: 'flag_seal_broken',   label: 'Break the seal on the Aethermoor ruins' },
        ],
        rewards: { xp: 300, gold: 100, items: ['mage_robe', 'ether'] },
    },

    // --- Chapter 4 ---
    echoes_end: {
        id: 'echoes_end',
        title: 'Echoes End',
        giver: 'story',
        chapter: 4,
        desc: 'The Lich of Aethermoor has risen. The echoes of the prophecy have become real. You must enter the Aethermoor ruins and end this — for good.',
        objectives: [
            { type: 'defeat', id: 'aethermoor_lich', qty: 1, label: 'Defeat the Lich of Aethermoor' },
        ],
        rewards: { xp: 500, gold: 200, items: ['lich_crown'] },
    },
};

export function getQuest(id) { return QUEST_DEFS[id]; }

export function getQuestsByChapter(chapter) {
    return Object.values(QUEST_DEFS).filter(q => q.chapter === chapter);
}
