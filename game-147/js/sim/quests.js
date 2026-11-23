// The main story: chapters of goals checked every step, the strangers who arrive at the front desk, and which bosses
// are open. Pure.

import { CHAPTERS, RECRUITS, REGIONS, TIERS } from './data.js';
import { newGuest } from './hotel.js';

function goalDone(G, [check, arg]) {
    if (check === 'sweptRoom') return G.stats.swept >= 4 || G.rooms.some((r) => r.open && r.dust === 0);
    if (check === 'checkedIn') return G.stats.checkins >= arg;
    if (check === 'cooked') return G.stats.cooked >= arg;
    if (check === 'recruited') return G.heroes[arg]?.joined;
    if (check === 'tierPaid') return G.debt.tier >= arg;
    if (check === 'bossBeaten') return G.bossesBeaten.includes(arg);
    return false;
}

/** The current goal, or null when the story is over. */
export function currentGoal(G) {
    const ch = CHAPTERS[G.quest.chapter];
    if (!ch) return null;
    const g = ch.goals[G.quest.goal];
    return g ? { chapter: G.quest.chapter, title: ch.title, index: G.quest.goal, check: g[0], arg: g[1], text: g[2] } : null;
}

/** Advance through every goal that is already met (several can be at once). */
export function questStep(G) {
    for (let guard = 0; guard < 20; guard++) {
        const ch = CHAPTERS[G.quest.chapter];
        if (!ch) break;
        const g = ch.goals[G.quest.goal];
        if (!g || !goalDone(G, g)) break;
        G.events.push({ type: 'goalDone', text: g[2] });
        G.quest.goal++;
        if (G.quest.goal >= ch.goals.length) {
            G.quest.chapter++;
            G.quest.goal = 0;
            G.gold += 150 * G.quest.chapter;
            G.events.push({ type: 'chapterDone', chapter: G.quest.chapter, gold: 150 * G.quest.chapter, next: CHAPTERS[G.quest.chapter]?.title || null });
        }
    }
    arrivals(G);
}

/** Strangers turn up at the desk when the story reaches them. */
function arrivals(G) {
    for (const [hero, R] of Object.entries(RECRUITS)) {
        const s = G.recruits[hero];
        if (s.stage !== 'none') continue;
        const [kind, a, b] = R.arrive;
        let due = false;
        if (kind === 'goal') due = G.quest.chapter > a || (G.quest.chapter === a && G.quest.goal >= b);
        if (kind === 'tier') due = G.debt.tier >= a;
        if (kind === 'boss') due = G.bossesBeaten.includes(a);
        if (!due) continue;
        s.stage = 'arrived';
        newGuest(G, hero);
        G.scenes.push('recruit_' + hero);
        G.events.push({ type: 'stranger', hero });
    }
}

/** Is the region's boss open? The meadow's from chapter 2, the grove's from 3, the cave's from 4 (or once beaten). */
export function bossOpen(G, region) {
    const k = REGIONS[region].boss;
    if (G.bossesBeaten.includes(k)) return true;
    const need = { meadow: 1, grove: 2, cave: 3 }[region];
    return G.quest.chapter >= need;
}

export const storyOver = (G) => G.debt.tier >= TIERS.length;
