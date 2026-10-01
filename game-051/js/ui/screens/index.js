/** index.js — every screen, registered with the router at boot. */
import { titleScreen } from './title.js';
import { citadelScreen } from './citadel.js';
import { teamScreen } from './team.js';
import { battleScreen } from './battle.js';
import { heroesScreen } from './heroes.js';
import { heroScreen } from './hero.js';
import { summonScreen } from './summon.js';
import { adventureScreen } from './adventure.js';
import { questsScreen } from './quests.js';
import { creatorScreen } from './creator.js';
import { treasuryScreen } from './treasury.js';
import { trainingScreen } from './training.js';
import { marketScreen } from './market.js';
import { bagScreen } from './bag.js';
import { forgeScreen } from './forge.js';
import { tavernScreen } from './tavern.js';
import { overlordScreen } from './overlord.js';
import { settingsScreen } from './settings.js';
import { arenaScreen } from './arena.js';
import { mineScreen } from './mine.js';
import { farmScreen } from './farm.js';
import { spireScreen } from './spire.js';

export const SCREENS = [
    titleScreen, citadelScreen, teamScreen, battleScreen, heroesScreen, heroScreen, summonScreen, adventureScreen, questsScreen, creatorScreen,
    treasuryScreen, trainingScreen, marketScreen, bagScreen, forgeScreen, tavernScreen, overlordScreen, settingsScreen, arenaScreen, mineScreen, farmScreen, spireScreen,
];
