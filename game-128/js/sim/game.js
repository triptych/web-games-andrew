// Gemheart Saga — the game: one hero's tale, the village, quests and battles. Pure: no DOM, no clock, no Math.random.
//
// newGame(seed, heroId) -> G. Everything the player does is a command: act(G, cmd). Battles run in real time:
// step(G, dt). The view reads G and drains G.events; it never writes G.
//
// G.mode: 'village' | 'scene' (story dialogue, G.scene) | 'battle' (G.battle; its phase is intro/fight/won/lost)
// Commands:
//   village  collect{now} daily{day,now} build{id,now} buy{id} sell{uid} equip{uid} upgrade{uid} learn{node}
//            claim{id} story{} patrol{region}
//   scene    next{} skip{}
//   battle   swap{a,b} skill{node} item{id} flee{} continue{} (after won/lost)

import { makeRng } from '../rng.js';
import { START_GOLD, XP_CURVE, MAX_LEVEL, PATROL_FIGHTS, STORY_EASE, QUEST_REST } from '../config.js';
import { HERO, NODE, MAX_RANK, TIER3_LEVEL } from './data/heroes.js';
import { REGION, FOE } from './data/world.js';
import { TALES, OPENING, ENDINGS, CREDITS_LINE } from './data/story.js';
import * as Bt from './battle.js';
import * as V from './village.js';

const START_KIT = {
    kael: ['shortsword', 'jerkin'], sela: ['oakstaff', 'tunic'], fenn: ['huntbow', 'jerkin'], odo: ['oakstaff', 'tunic'],
};
// Each hero starts with the first skill of the first branch learned.
const START_SKILL = { kael: 'k_sunder', sela: 's_bolt', fenn: 'f_volley', odo: 'o_flare' };

export function newGame(seed = 1, heroId = 'kael') {
    const G = {
        v: 1, seed,
        rng: makeRng(seed),
        t: 0,
        mode: 'scene',
        hero: { id: heroId, lv: 1, xp: 0, sp: 0, ranks: { [START_SKILL[heroId]]: 1 }, eq: { weapon: null, armor: null, charm: null } },
        inv: [], nextUid: 1,
        bag: { potion: 2 },
        res: { gold: START_GOLD, wood: 40, ore: 20, grain: 20, crystal: 0 },
        village: V.newVillage(),
        story: { ch: 0, done: false },
        quest: null,
        battle: null,
        scene: null,
        stats: { kills: {}, killsTotal: 0, chainMax: 0, specials: 0, doomCleared: 0, bestPlus: 0, goldSpent: 0, streakBest: 0,
            battlesWon: 0, battlesLost: 0, gems: [0, 0, 0, 0, 0, 0], skills: 0, items: 0, quests: 0, patrols: 0 },
        claimed: {},
        events: [],
    };
    for (const id of START_KIT[heroId]) {
        const inv = V.giveItem(G, id);
        G.hero.eq[inv.slot || slotOf(id)] = inv.uid;
    }
    const h = HERO[heroId];
    openScene(G, [...OPENING, [heroId, h.lines.intro]], { kind: 'village' }, 'opening');
    return G;
}

const slotOf = (id) => ({ shortsword: 'weapon', oakstaff: 'weapon', huntbow: 'weapon', jerkin: 'armor', tunic: 'armor' }[id]);

export const tale = (G) => TALES[G.hero.id];
export const chapter = (G) => tale(G)[G.story.ch] || null;

/** Regions the hero has reached in the tale: patrols can go there. */
export function regionsOpen(G) {
    const out = new Set(['greenmarch']);
    const t = tale(G);
    for (let i = 0; i <= Math.min(G.story.ch, t.length - 1); i++) out.add(t[i].region);
    return [...out];
}

// ---------------------------------------------------------------- scenes
function openScene(G, lines, then, tag = '') {
    if (!lines || !lines.length) { afterScene(G, then); return; }
    G.scene = { lines, i: 0, then, tag };
    G.mode = 'scene';
    G.events.push({ type: 'scene', tag, speaker: lines[0][0], text: lines[0][1] });
}

function afterScene(G, then) {
    G.scene = null;
    if (then.kind === 'fight') startFight(G);
    else if (then.kind === 'ending') {
        G.story.done = true;
        G.mode = 'village';
        G.events.push({ type: 'ending', hero: G.hero.id, credits: CREDITS_LINE });
    } else {
        G.mode = 'village';
        G.events.push({ type: 'village' });
    }
}

// ---------------------------------------------------------------- quests
function startFight(G) {
    const q = G.quest;
    const id = q.fights[q.i];
    // a story chapter's finale fights a level up only when it is a real boss (v1.1.1: not chapter 1's elite)
    const boss = q.i === q.fights.length - 1 && q.kind === 'story' && FOE[id].rank === 'boss';
    const lv = q.lv + (boss ? 1 : 0);
    const ease = q.kind === 'story' ? STORY_EASE[q.ch] || null : null;
    Bt.startBattle(G, id, lv, q.hp != null ? { hp: q.hp } : null, ease);
    G.mode = 'battle';
}

function startStory(G) {
    const c = chapter(G);
    if (!c || G.mode !== 'village') return false;
    G.quest = { kind: 'story', ch: G.story.ch, region: c.region, lv: c.lv, fights: c.fights, i: 0, hp: null, revived: false };
    G.events.push({ type: 'quest', kind: 'story', ch: G.story.ch, title: c.title });
    openScene(G, c.before, firstFight(G), `ch${G.story.ch}-before`);
    return true;
}

function firstFight(G) {
    const c = G.quest.kind === 'story' ? tale(G)[G.quest.ch] : null;
    const mid = c?.mid?.[0];
    return mid ? { kind: 'mid' } : { kind: 'fight' };
}

function startPatrol(G, region) {
    if (G.mode !== 'village' || !regionsOpen(G).includes(region)) return false;
    const R = REGION[region];
    const normals = R.monsters.filter((m) => !m.rank);
    const fights = [];
    for (let i = 0; i < PATROL_FIGHTS; i++) fights.push(G.rng.pick(normals).id);
    if (G.rng() < 0.3) fights[fights.length - 1] = R.monsters.find((m) => m.rank === 'elite').id;
    G.quest = { kind: 'patrol', region, lv: Math.max(1, G.hero.lv - 1), fights, i: 0, hp: null, revived: false };
    G.events.push({ type: 'quest', kind: 'patrol', region });
    startFight(G);
    return true;
}

/** After a result screen: the next fight, the next scene, or home. */
function continueQuest(G) {
    const B = G.battle;
    const q = G.quest;
    if (!B || (B.phase !== 'won' && B.phase !== 'lost')) return false;
    if (B.phase === 'lost' || !q) {
        G.battle = null; G.quest = null; G.mode = 'village';
        G.events.push({ type: 'retreat' });
        return true;
    }
    // catch your breath between fights: a share of health back
    q.hp = Math.min(B.hero.max, B.hero.hp + B.hero.max * QUEST_REST);
    G.battle = null;
    q.i++;
    const c = q.kind === 'story' ? tale(G)[q.ch] : null;
    if (q.i < q.fights.length) {
        const mid = c?.mid?.[q.i];
        if (mid) openScene(G, mid, { kind: 'fight' }, `ch${q.ch}-mid${q.i}`);
        else startFight(G);
        return true;
    }
    // quest complete
    G.quest = null;
    if (q.kind === 'patrol') {
        G.stats.patrols++;
        G.mode = 'village';
        G.events.push({ type: 'questDone', kind: 'patrol', region: q.region });
        return true;
    }
    G.stats.quests++;
    G.story.ch++;
    G.events.push({ type: 'questDone', kind: 'story', ch: q.ch });
    const last = G.story.ch >= tale(G).length;
    const lines = [...(c.after || [])];
    if (last) lines.push(['sovereign', SOVEREIGN_FALL], ...ENDINGS[G.hero.id]);
    openScene(G, lines, { kind: last ? 'ending' : 'village' }, last ? 'ending' : `ch${q.ch}-after`);
    return true;
}
export const SOVEREIGN_FALL = 'No… the light… it burns so bright…';

// ---------------------------------------------------------------- the hero
export function gainXp(G, xp) {
    const h = G.hero;
    h.xp += xp;
    while (h.lv < MAX_LEVEL && h.xp >= XP_CURVE(h.lv)) {
        h.xp -= XP_CURVE(h.lv);
        h.lv++;
        h.sp++;
        G.events.push({ type: 'levelup', lv: h.lv });
    }
    if (h.lv >= MAX_LEVEL) h.xp = 0;
}

/** Why a skill node can't be learned (or ranked up), or null. */
export function learnBlock(G, id) {
    const n = NODE[id];
    if (!n || n.hero !== G.hero.id) return 'Not this hero\'s skill.';
    const r = G.hero.ranks[id] || 0;
    if (r >= MAX_RANK) return 'Mastered.';
    if (G.hero.sp < 1) return 'No skill points. Level up to earn them.';
    if (n.tier > 0) {
        const prev = HERO[G.hero.id].tree[n.bi].nodes[n.tier - 1];
        if (!(G.hero.ranks[prev.id] > 0)) return `Learn ${prev.name} first.`;
    }
    if (n.tier === 2 && G.hero.lv < TIER3_LEVEL) return `Needs level ${TIER3_LEVEL}.`;
    return null;
}

function learn(G, id) {
    if (learnBlock(G, id)) return false;
    G.hero.ranks[id] = (G.hero.ranks[id] || 0) + 1;
    G.hero.sp--;
    G.events.push({ type: 'learn', id, rank: G.hero.ranks[id] });
    return true;
}

/** The active skills the hero has learned, in tree order. */
export function actives(G) {
    return HERO[G.hero.id].tree.map((b) => b.nodes[0]).filter((n) => G.hero.ranks[n.id] > 0).map((n) => n.id);
}

// ---------------------------------------------------------------- commands
export function act(G, cmd) {
    const t = cmd.t;
    if (G.mode === 'scene') {
        if (t === 'next') {
            G.scene.i++;
            if (G.scene.i >= G.scene.lines.length) { const then = G.scene.then; resolveThen(G, then); }
            else { const [sp, text] = G.scene.lines[G.scene.i]; G.events.push({ type: 'line', speaker: sp, text }); }
            return true;
        }
        if (t === 'skip') { resolveThen(G, G.scene.then); return true; }
        return false;
    }
    if (G.mode === 'battle') {
        if (t === 'swap') return Bt.swap(G, cmd.a, cmd.b) === 'ok';
        if (t === 'skill') return Bt.useSkill(G, cmd.node);
        if (t === 'item') return Bt.useItem(G, cmd.id);
        if (t === 'continue') return continueQuest(G);
        if (t === 'flee') {
            const B = G.battle;
            if (!B || B.phase === 'won' || B.phase === 'lost') return false;
            B.phase = 'lost';
            G.events.push({ type: 'fled' });
            return true;
        }
        return false;
    }
    // village
    if (t === 'collect') return !!Object.keys(V.collect(G, cmd.now)).length;
    if (t === 'daily') return !!V.claimDaily(G, cmd.day, cmd.now);
    if (t === 'build') return V.build(G, cmd.id, cmd.now);
    if (t === 'buy') return V.buy(G, cmd.id);
    if (t === 'sell') return V.sell(G, cmd.uid);
    if (t === 'equip') return V.equip(G, cmd.uid);
    if (t === 'unequip') return V.unequip(G, cmd.slot);
    if (t === 'equipBest') return V.equipBest(G);
    if (t === 'unequipAll') return V.unequipAll(G);
    if (t === 'upgrade') return V.upgrade(G, cmd.uid);
    if (t === 'learn') return learn(G, cmd.node);
    if (t === 'claim') return V.claim(G, cmd.id);
    if (t === 'story') return startStory(G);
    if (t === 'patrol') return startPatrol(G, cmd.region);
    return false;
}

function resolveThen(G, then) {
    if (then.kind === 'mid') {
        const c = tale(G)[G.quest.ch];
        openScene(G, c.mid[0], { kind: 'fight' }, `ch${G.quest.ch}-mid0`);
        return;
    }
    afterScene(G, then);
}

/** Advance real time (battles only; the village runs on the wall clock passed into commands). */
export function step(G, dt) {
    G.t += dt;
    if (G.mode !== 'battle' || !G.battle) return;
    Bt.stepBattle(G, dt);
    const B = G.battle;
    if (B.phase === 'won' && B.rewards && !B.paid) {
        B.paid = true;
        const r = B.rewards;
        G.res.gold += r.gold;
        for (const [k, v] of Object.entries(r.res)) G.res[k] += v;
        for (const id of r.items) V.giveItem(G, id);
        gainXp(G, r.xp);
    }
}

// ---------------------------------------------------------------- saving
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    if (!HERO[d.hero?.id]) throw new Error('unknown hero');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
