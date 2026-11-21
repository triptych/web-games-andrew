// Quests. Every objective is checked from the live game state (js/sim/rules.js questProgress), so the journal can
// never drift from what the player has actually done:
//   kill  { id, n }    foes of that kind beaten since the quest was taken
//   have  { id, n }    items carried
//   flag  { id }       a story flag
// `auto` quests complete themselves the moment every objective is met; the rest are turned in by talking.

export const QUESTS = {
    main_gear: {
        title: 'The Golden Gear', giver: 'trina', main: true,
        desc: 'Mayor Pilcrow\'s six-generation heirloom has gone missing. Hear the Mayor out, then bring his Golden Gear home.',
        objectives: [
            { t: 'flag', id: 'briefed', label: 'Hear the Mayor out at the Hall' },
            { t: 'flag', id: 'bertha_down', label: 'Get the Gear back from Big Bertha' },
            { t: 'flag', id: 'gear_returned', label: 'Return it to Mayor Pilcrow' },
        ],
        reward: { xp: 120, gold: 150, items: { scone: 3 } },
    },
    side_scraps: {
        title: 'Spare Parts for Trina', giver: 'trina',
        desc: 'Trina is building something marvellous and needs five bits of scrap metal. Cog Sprites and Rust Crabs drop plenty.',
        objectives: [{ t: 'have', id: 'scrap', n: 5, label: 'Scrap metal' }],
        reward: { xp: 40, gold: 30, items: { sparkrod: 1 } },
    },
    side_kettle: {
        title: 'Mabel\'s Missing Kettle', giver: 'mabel',
        desc: 'A nasty Rust Crab dragged Mabel\'s copper kettle into Gutter Gully, south of the Whistling Wilds.',
        objectives: [{ t: 'have', id: 'kettle', n: 1, label: 'Find the kettle in Gutter Gully' }],
        reward: { xp: 60, gold: 50, items: { scone: 2 } },
    },
    side_springs: {
        title: 'Springs for Bertram', giver: 'bertram',
        desc: 'Bertram\'s shop clock has stopped for want of three Coiled Springs. Gear-Wolves and Rust Crabs carry them.',
        objectives: [{ t: 'have', id: 'spring', n: 3, label: 'Coiled Springs' }],
        reward: { xp: 70, gold: 40, items: { charm: 1 } },
    },
};
