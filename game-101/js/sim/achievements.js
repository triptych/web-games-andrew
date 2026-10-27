// Achievements: milestones across every system, checked after each command. Each pays a little gold the
// first time. Pure: they read G only (the journal and the counters), so a loaded game earns what it
// already deserves on its next command.

import { completion, REG } from './journal.js';
import { BIZ_IDS } from './town.js';
import { UNIQUES } from './uniques.js';
import { say, ev } from './core.js';
import { calc } from './party.js';

const reward = { bronze: 150, silver: 600, gold: 2500 };
const m = (G, k) => G.journal.misc[k] || 0;
const maxLvl = (G) => Math.max(0, ...G.party.map((p) => p.lvl));
const bizLv = (G) => BIZ_IDS.reduce((a, k) => a + G.biz[k].lvl, 0);
const kills = (G) => G.stats.kills;
const bestRar = (G) => Math.max(-1, ...Object.values(G.journal.best).map((b) => b.rar));
const gathered = (G) => Object.values(G.journal.gather).reduce((a, e) => a + (e.gathered || 0), 0);
const sold = (G) => Object.values(G.journal.items).reduce((a, e) => a + (e.sold || 0), 0);
const artifacts = (G) => Object.keys(G.uniques).length;

/** [id, name, description, tier, current(G) → number, goal] */
export const ACHIEVEMENTS = [
    ['d2', 'Down the Stairs', 'Reach floor 2.', 'bronze', (G) => G.maxDepth, 2],
    ['d5', 'Five Floors Down', 'Reach floor 5.', 'bronze', (G) => G.maxDepth, 5],
    ['d10', 'Double Digits', 'Reach floor 10.', 'silver', (G) => G.maxDepth, 10],
    ['d20', 'Deep Diver', 'Reach floor 20.', 'silver', (G) => G.maxDepth, 20],
    ['d35', 'Look Up', 'Reach floor 35.', 'gold', (G) => G.maxDepth, 35],
    ['d50', 'Half a Hundred', 'Reach floor 50.', 'gold', (G) => G.maxDepth, 50],
    ['d100', 'There Is No Bottom', 'Reach floor 100.', 'gold', (G) => G.maxDepth, 100],
    ['k1', 'First Blood', 'Defeat a monster.', 'bronze', kills, 1],
    ['k100', 'Exterminator', 'Defeat 100 monsters.', 'bronze', kills, 100],
    ['k1000', 'Cull', 'Defeat 1,000 monsters.', 'silver', kills, 1000],
    ['k10000', 'Plague', 'Defeat 10,000 monsters.', 'gold', kills, 10000],
    ['b1', 'Guardian Slayer', 'Defeat a guardian.', 'bronze', (G) => m(G, 'bossesSlain'), 1],
    ['b5', 'Keeper of Keepers', 'Defeat 5 guardians.', 'silver', (G) => m(G, 'bossesSlain'), 5],
    ['b20', 'Regicide', 'Defeat 20 guardians.', 'gold', (G) => m(G, 'bossesSlain'), 20],
    ['p6', 'Full House', 'Have six in the party.', 'bronze', (G) => G.party.length, 6],
    ['l10', 'Seasoned', 'Get a member to level 10.', 'bronze', maxLvl, 10],
    ['l25', 'Veteran', 'Get a member to level 25.', 'silver', maxLvl, 25],
    ['l50', 'Legend', 'Get a member to level 50.', 'gold', maxLvl, 50],
    ['l100', 'Myth', 'Get a member to level 100.', 'gold', maxLvl, 100],
    ['ch10', 'Treasure Hunter', 'Open 10 chests.', 'bronze', (G) => m(G, 'chests'), 10],
    ['ch100', 'Hoarder', 'Open 100 chests.', 'silver', (G) => m(G, 'chests'), 100],
    ['tr10', 'Clumsy', 'Spring 10 traps.', 'bronze', (G) => m(G, 'trapsSprung'), 10],
    ['sd5', 'Wall Whisperer', 'Find 5 secret doors.', 'silver', (G) => m(G, 'secretsFound'), 5],
    ['ga25', 'Forager', 'Gather 25 things.', 'bronze', gathered, 25],
    ['cu1', 'Oh No', 'Equip a cursed item.', 'bronze', (G) => m(G, 'cursedFound'), 1],
    ['cu2', 'Cleansed', 'Have a curse lifted by the church.', 'bronze', (G) => m(G, 'dispelled'), 1],
    ['leg', 'Epic Find', 'Find a legendary item.', 'silver', bestRar, 4],
    ['ar1', 'Artifact', 'Find a unique artifact.', 'silver', artifacts, 1],
    ['ar6', 'Collector of Relics', 'Find 6 unique artifacts.', 'gold', artifacts, 6],
    ['arall', 'Every Legend', 'Find every unique artifact.', 'gold', artifacts, UNIQUES.length],
    ['so50', 'Market Day', 'Sell 50 items.', 'bronze', sold, 50],
    ['iv1', 'Stakeholder', 'Invest in a business.', 'bronze', bizLv, 1],
    ['iv10', 'Small Empire', 'Reach 10 total business levels.', 'silver', bizLv, 10],
    ['iv50', 'Tycoon', 'Reach 50 total business levels.', 'gold', bizLv, 50],
    ['pi10k', 'Passive Income', 'Collect 10,000 gold from your businesses.', 'silver', (G) => m(G, 'collected'), 10000],
    ['ge100k', 'Six Figures', 'Earn 100,000 gold.', 'silver', (G) => G.stats.goldEarned, 100000],
    ['d30', 'A Month of Sundays', 'Live through 30 days.', 'bronze', (G) => G.stats.days, 30],
    ['d100d', 'Old Hand', 'Live through 100 days.', 'silver', (G) => G.stats.days, 100],
    ['q1', 'Odd Jobs', 'Complete a quest.', 'bronze', (G) => G.quests.done, 1],
    ['q10', 'Dependable', 'Complete 10 quests.', 'silver', (G) => G.quests.done, 10],
    ['q50', 'Guild Hero', 'Complete 50 quests.', 'gold', (G) => G.quests.done, 50],
    ['bes10', 'Naturalist', 'Defeat 10 kinds of monster.', 'bronze', (G) => completion(G).monsters[0], 10],
    ['besall', 'Bestiary', 'Defeat every kind of monster.', 'gold', (G) => completion(G).monsters[0], REG.monsters.length],
    ['str', 'Good Listener', 'Meet every kind of stranger.', 'silver', (G) => completion(G).npcs[0], REG.npcs.length],
    ['trall', 'Know Your Traps', 'Find every kind of trap.', 'silver', (G) => completion(G).traps[0], REG.traps.length],
    ['wipe', 'Back From the Dead', 'Wake up in town after a wipe.', 'bronze', (G) => G.stats.deaths, 1],
    ['flee', 'Discretion', 'Flee 10 battles.', 'bronze', (G) => m(G, 'fled'), 10],
    ['tab1', 'Reader', 'Read a lore tablet.', 'bronze', (G) => m(G, 'tablets'), 1],
    ['tab10', 'Archivist', 'Read 10 lore tablets.', 'silver', (G) => m(G, 'tablets'), 10],
    ['st1', 'The Lantern Goes Out', 'Finish the first chapter of the saga.', 'bronze', (G) => m(G, 'chapters'), 1],
    ['st9', 'Lantern Lit', 'Finish every chapter of the saga.', 'gold', (G) => m(G, 'chapters'), 9],
    ['hp1k', 'Sturdy', 'Have a member with 1,000 max HP.', 'silver', (G) => Math.max(0, ...G.party.map((p) => calc(p).maxhp)), 1000],
];
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a[0], a]));
export const ACH_COLOR = { bronze: 6, silver: 7, gold: 14 };

/** Unlock whatever has been earned. Returns the ids newly unlocked. */
export function checkAchievements(G) {
    const out = [];
    for (const [id, name, , tier, cur, goal] of ACHIEVEMENTS) {
        if (G.ach[id]) continue;
        if (cur(G) >= goal) {
            G.ach[id] = G.day;
            const g = reward[tier];
            G.gold += g; G.stats.goldEarned += g;
            say(G, `★ Achievement: ${name} (+${g}g)`, 14);
            ev(G, 'achievement', { id, name, tier });
            out.push(id);
        }
    }
    return out;
}
