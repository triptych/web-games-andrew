// Quests. Every objective is checked from the live game state (js/sim/quests.js), so the journal can never
// drift from what the player has actually done:
//   kill  { id, n }    foes of that kind beaten since the quest was taken
//   have  { id, n }    items carried
//   flag  { id }       a story flag
//   flags { ids }      several flags (shows a count)
//   visit { id }       a map entered since the quest was taken (or ever)
// `auto` quests complete themselves the moment every objective is met; the rest are turned in by talking.

export const QUESTS = {
    the_missing_merchant: {
        title: 'The Missing Merchant', giver: 'varec', chapter: 1, main: true,
        desc: 'Borin, the merchant who keeps Thornhaven supplied, vanished on the Thornwood road three days ago. Bandits have been seen near the old camp east of the path.',
        objectives: [
            { t: 'kill', id: 'bandit', n: 2, label: 'Drive off the bandits at their camp' },
            { t: 'flag', id: 'borin_found', label: 'Find Borin' },
            { t: 'flag', id: 'told_varec', label: 'Tell Elder Varec' },
        ],
        reward: { xp: 70, gold: 60, items: { potion: 2 } },
    },
    slime_infestation: {
        title: 'Slime Infestation', giver: 'holt', chapter: 1,
        desc: 'Slimes from the Thornwood are eating Farmer Holt\'s turnips. He wants three slime cores as proof for the Elder\'s ledger.',
        objectives: [{ t: 'have', id: 'slime_core', n: 3, label: 'Slime cores' }],
        reward: { xp: 45, gold: 40, items: { antidote: 2, leather_vest: 1 } },
    },
    pelts_for_the_forge: {
        title: 'Pelts for the Forge', giver: 'marta', chapter: 1,
        desc: 'Marta needs wolf pelts to line her bellows and armour. Bring three and she will forge you something worth having.',
        objectives: [{ t: 'have', id: 'wolf_pelt', n: 3, label: 'Wolf pelts' }],
        reward: { xp: 50, gold: 30, items: { steel_sword: 1 } },
    },
    lyras_past: {
        title: 'Lyra\'s Past', giver: 'lyra', chapter: 1, auto: true,
        desc: 'The Academy ruins lie west of the Thornwood path. Somewhere in them is the copy of the prophecy Lyra made the night she fled.',
        objectives: [
            { t: 'visit', id: 'academy', label: 'Reach the Academy Ruins' },
            { t: 'have', id: 'elder_scroll', n: 1, label: 'Recover the Elder Scroll' },
        ],
        reward: { xp: 90, gold: 0, items: { ether: 2 } },
    },
    spirit_of_the_wood: {
        title: 'Spirit of the Wood', giver: 'sylvara', chapter: 2, main: true,
        desc: 'Lich corruption seeps into the World Tree through three anchor roots. Press a soul gem into each one. Lich Shards in the Thornwood carry the gems.',
        objectives: [
            { t: 'flags', ids: ['anchor_1', 'anchor_2', 'anchor_3'], label: 'Cleanse the anchor roots' },
            { t: 'flag', id: 'told_sylvara', label: 'Return to Sylvara' },
        ],
        reward: { xp: 160, gold: 80, items: { hi_potion: 2 } },
    },
    broken_oath: {
        title: 'Orin\'s Broken Oath', giver: 'sylvara', chapter: 2, main: true,
        desc: 'Korvas, the paladin who cast Orin out of the Solarian Order, waits in the shattered chapel beyond the grove, wholly taken by the corruption.',
        objectives: [{ t: 'flag', id: 'korvas_defeated', label: 'Face Korvas in the Shattered Chapel' }],
        reward: { xp: 0, gold: 60, items: { chain_mail: 1 } }, auto: true,
    },
    the_third_shard: {
        title: 'The Sealed Sanctum', giver: 'aneth', chapter: 3, main: true,
        desc: 'Two soul gems, resonating with the Elder Scroll, will crack the seal on the Sanctum, where Vaelthas sleeps. The Lich Shards in these ruins carry the gems.',
        objectives: [
            { t: 'have', id: 'soul_gem', n: 2, label: 'Soul gems' },
            { t: 'have', id: 'elder_scroll', n: 1, label: 'Carry the Elder Scroll' },
            { t: 'flag', id: 'seal_broken', label: 'Break the seal with Aneth' },
        ],
        reward: { xp: 220, gold: 100, items: { mage_robe: 1, ether: 2 } },
    },
    echoes_end: {
        title: 'Echoes End', giver: 'aneth', chapter: 4, main: true, auto: true,
        desc: 'The seal is broken. Vaelthas wakes in the Sanctum below the ruins. End it.',
        objectives: [{ t: 'flag', id: 'lich_defeated', label: 'Defeat Vaelthas' }],
        reward: { xp: 0, gold: 0, items: {} },
    },
};
