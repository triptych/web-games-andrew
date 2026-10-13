// The Trophy Case: forty achievements in four tiers. `stat` ones read lifetime
// counters, `hook` ones fire on something that happened in a playtest, `check`
// ones inspect the open project, `flag` ones are set by the Atelier itself.
import { cmds } from './quests.js';

export const TIER_INK = { bronze: 15, silver: 30, gold: 60, platinum: 100 };

const textChars = (p) => { let n = 0; cmds(p, (c) => { if (c.t === 'text') n += (c.text || '').length; return false; }); return n; };
const count = (p, t) => cmds(p, (c) => c.t === t);
const events = (p) => p.maps.reduce((n, m) => n + m.events.length, 0);

export const ACHIEVEMENTS = [
    { id: 'first_stroke', name: 'First Stroke', tier: 'bronze', desc: 'Paint a tile.', stat: 'painted', goal: 1 },
    { id: 'painter', name: 'Painter', tier: 'silver', desc: 'Paint 1,000 tiles.', stat: 'painted', goal: 1000 },
    { id: 'muralist', name: 'Muralist', tier: 'gold', desc: 'Paint 10,000 tiles.', stat: 'painted', goal: 10000 },
    { id: 'bucket', name: 'Bucket Brigade', tier: 'bronze', desc: 'Use the Fill tool 10 times.', stat: 'fills', goal: 10 },
    { id: 'cartographer', name: 'Cartographer', tier: 'silver', desc: 'Have 5 maps in one project.', check: (p) => [p.maps.length, 5] },
    { id: 'atlas', name: 'Atlas', tier: 'gold', desc: 'Have 15 maps in one project.', check: (p) => [p.maps.length, 15] },
    { id: 'vast', name: 'Vast Lands', tier: 'silver', desc: 'Make a map of at least 60×60.', check: (p) => [p.maps.some((m) => m.w * m.h >= 3600) ? 1 : 0, 1] },
    { id: 'chatter', name: 'Chatterbox', tier: 'bronze', desc: 'Write 10 messages.', check: (p) => [count(p, 'text'), 10] },
    { id: 'novelist', name: 'Novelist', tier: 'gold', desc: 'Write 5,000 characters of dialogue.', check: (p) => [textChars(p), 5000] },
    { id: 'forks', name: 'Garden of Forking Paths', tier: 'silver', desc: 'Use Show Choices 5 times.', check: (p) => [count(p, 'choice'), 5] },
    { id: 'crowd', name: 'Crowd Scene', tier: 'silver', desc: 'Put 25 events on one map.', check: (p) => [Math.max(0, ...p.maps.map((m) => m.events.length)), 25] },
    { id: 'eventsmith', name: 'Eventsmith', tier: 'gold', desc: 'Have 100 events in one project.', check: (p) => [events(p), 100] },
    { id: 'hoarder', name: 'Hoarder', tier: 'silver', desc: 'Have 20 items in the Database.', check: (p) => [p.items.length, 20] },
    { id: 'bestiary', name: 'Bestiary', tier: 'silver', desc: 'Have 10 enemies in the Database.', check: (p) => [p.enemies.length, 10] },
    { id: 'party4', name: 'Party of Four', tier: 'bronze', desc: 'Start a game with four heroes.', check: (p) => [p.system.party.length, 4] },
    { id: 'spellbook', name: 'Spellbook', tier: 'silver', desc: 'Have 10 skills in the Database.', check: (p) => [p.skills.length, 10] },
    { id: 'qa', name: 'Quality Assurance', tier: 'silver', desc: 'Playtest 25 times.', stat: 'playtests', goal: 25 },
    { id: 'firstblood', name: 'First Blood', tier: 'bronze', desc: 'Win a battle in a playtest.', hook: 'battleWin' },
    { id: 'teacher', name: 'Defeat Is a Teacher', tier: 'bronze', desc: 'See the Game Over screen in a playtest.', hook: 'gameover' },
    { id: 'shopper', name: 'Window Shopping', tier: 'bronze', desc: 'Buy something in a playtest.', hook: 'shopBuy' },
    { id: 'ding', name: 'Ding!', tier: 'bronze', desc: 'Level up in a playtest.', hook: 'levelUp' },
    { id: 'ending', name: 'Happily Ever After', tier: 'gold', desc: 'Reach The End in a playtest.', hook: 'ending' },
    { id: 'publisher', name: 'Publisher', tier: 'gold', desc: 'Export a standalone game.', stat: 'exports', goal: 1 },
    { id: 'bookshelf', name: 'Bookshelf', tier: 'platinum', desc: 'Export 5 times.', stat: 'exports', goal: 5 },
    { id: 'archivist', name: 'Archivist', tier: 'bronze', desc: 'Download a project file.', stat: 'downloads', goal: 1 },
    { id: 'forger', name: 'Forger', tier: 'bronze', desc: 'Make a sprite in the Sprite Forge.', check: (p) => [p.sprites.length, 1] },
    { id: 'fashion', name: 'Fashion House', tier: 'silver', desc: 'Have 8 Forge sprites in one project.', check: (p) => [p.sprites.length, 8] },
    { id: 'secondthoughts', name: 'Second Thoughts', tier: 'bronze', desc: 'Undo 50 times.', stat: 'undos', goal: 50 },
    { id: 'patron', name: 'Patron of the Emporium', tier: 'silver', desc: 'Buy 5 things from Mott.', stat: 'bought', goal: 5 },
    { id: 'tycoon', name: 'Ink Tycoon', tier: 'gold', desc: 'Earn 3,000 Ink in all.', ink: 3000 },
    { id: 'studious', name: 'Studious', tier: 'bronze', desc: 'Open the sample game to see how it\'s made.', flag: 'sample' },
    { id: 'director', name: 'Director', tier: 'silver', desc: 'Have 3 Autorun events.', check: (p) => { let n = 0; for (const m of p.maps) for (const e of m.events) for (const pg of e.pages) if (pg.trigger === 'autorun') n++; return [n, 3]; } },
    { id: 'composer', name: 'Composer', tier: 'silver', desc: 'Use 4 different songs on your maps.', check: (p) => [new Set(p.maps.map((m) => m.music).filter((x) => x && x !== 'none')).size, 4] },
    { id: 'weather', name: 'Weather Witch', tier: 'bronze', desc: 'Tint the screen.', check: (p) => [count(p, 'tint'), 1] },
    { id: 'earthquake', name: 'Earthquake', tier: 'bronze', hidden: true, desc: 'Shake the screen at power 10 or more.', check: (p) => [cmds(p, (c) => c.t === 'shake' && c.power >= 10), 1] },
    { id: 'nightowl', name: 'Night Owl', tier: 'bronze', hidden: true, desc: 'Work in the Atelier after midnight.', flag: 'nightowl' },
    { id: 'freespirit', name: 'Free Spirit', tier: 'bronze', hidden: true, desc: 'Unlock everything with Free Mode.', flag: 'free' },
    { id: 'mottfriend', name: 'Friend of Mott', tier: 'bronze', hidden: true, desc: 'Say hello to Mott ten times.', flag: 'mott10' },
    { id: 'completionist', name: 'Completionist', tier: 'platinum', desc: 'Finish every quest.', flag: 'allquests' },
    { id: 'worldsmith', name: 'Worldsmith', tier: 'platinum', desc: 'Finish the Atelier\'s story.', flag: 'storydone' },
];

/** [progress, goal] or null for an achievement, given the context. */
export function progressOf(a, x) {
    try {
        if (a.stat) return [x.stats[a.stat] || 0, a.goal];
        if (a.hook) return [x.flags['hook.' + a.hook] ? 1 : 0, 1];
        if (a.flag) return [x.flags[a.flag] ? 1 : 0, 1];
        if (a.ink) return [x.inkEarned, a.ink];
        if (a.check) return a.check(x.p);
    } catch { /* a malformed project can't break the trophy case */ }
    return [0, 1];
}
