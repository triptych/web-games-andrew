// The simulation: the month, the Free Day, the planner, the periods, expeditions, the festival, Starfall Night,
// scenes and the ending. Pure: no DOM, no Math.random, no clock. Everything the player can do is a command to
// act(G, cmd); the UI, the bot and the tests all go through it. The UI renders G and drains G.events.

import {
    START_AGE, END_AGE, PERIODS, FREE_AP, START_STATS, START_GOLD, STIPEND, STRESS, HEARTS,
    FESTIVAL_MONTH, STARFALL_MONTH, AUDIENCE_MONTH, GAIN_SCALE,
} from '../config.js';
import { makeRng } from '../rng.js';
import { FRIENDS, CAST, PRINCE_DEFAULT } from './data/cast.js';
import { ACT } from './data/activities.js';
import { ITEM } from './data/items.js';
import { QUESTS, QUEST } from './data/quests.js';
import { REGION, APPROACH } from './data/adventures.js';
import { STORY } from './data/story.js';
import { HEART_SCENES } from './data/hearts.js';
import { CONTESTS, CONTEST } from './data/events.js';
import { PLACE } from './data/places.js';
import { ENDING } from './data/endings.js';
import { bump, bumpAff, applyFx, evalCond, questChance, encounterChance, power, chooseEnding, nearestEnding } from './rules.js';
import { beginScene, advance as advLine, choose as chooseLine, runTo } from './scene.js';
import { sceneDef, chatLine, talkLine } from './scenes.js';

export const SAVE_VERSION = 1;

export function newGame(seed = 1, { name = PRINCE_DEFAULT, gname = 'Aldous', title = 'Father' } = {}) {
    const G = {
        v: SAVE_VERSION, seed, rng: makeRng(seed),
        name: String(name).slice(0, 16) || PRINCE_DEFAULT, gname: String(gname).slice(0, 16) || 'Aldous', title: String(title).slice(0, 16) || 'Father',
        age: START_AGE, month: 1, turn: 0,
        phase: 'free', ap: FREE_AP, done: {},            // done: actions used today (one per kind)
        stats: { ...START_STATS }, gold: START_GOLD,
        flags: {}, aff: Object.fromEntries(FRIENDS.map((f) => [f, 0])), hearts: Object.fromEntries(FRIENDS.map((f) => [f, 0])), partner: null,
        inv: {}, keep: {},
        board: [], quests: [],
        plan: null, lastPlan: null, period: 0, results: [],
        adv: null, sick: 0,
        count: {},
        scene: null, queue: [], seen: [],
        hist: [],
        ending: null, over: false,
        events: [],
    };
    startMonth(G, true);
    return G;
}

// ====================================================================== the month
function startMonth(G, first = false) {
    if (!first) {
        G.month++;
        if (G.month > 12) { G.month = 1; G.age++; }
    }
    G.turn++;
    if (G.month === 1) G.hist.push({ age: G.age, stats: { ...G.stats }, gold: G.gold });
    if (G.age >= END_AGE) { beginEnding(G); return; }
    if (!first) {
        const pay = Math.round(STIPEND.base + G.stats.fav * STIPEND.per);
        G.gold += pay;
        G.events.push({ type: 'stipend', gold: pay });
    }
    G.phase = 'free';
    G.ap = FREE_AP;
    G.done = {};
    G.period = 0;
    G.plan = null;
    refreshBoard(G);
    // scenes for this month, in order
    for (const s of STORY) if (s.when.age === G.age && s.when.month === G.month && !G.seen.includes(s.id) && (!s.need || G.flags[s.need])) queueScene(G, s.id);
    if (G.month === 1 && G.age > START_AGE && G.age < END_AGE) queueScene(G, 'birthday', { age: G.age });
    if (G.month === AUDIENCE_MONTH && G.age > START_AGE && G.age < 17) queueScene(G, 'audience', { fav: G.stats.fav });
    G.events.push({ type: 'month', age: G.age, month: G.month });
    pump(G);
}

function refreshBoard(G) {
    const ok = QUESTS.filter((q) => q.minAge <= G.age && (!q.need || G.flags[q.need]) && !G.quests.includes(q.id));
    const board = [];
    const pool = [...ok];
    while (board.length < 3 && pool.length) board.push(pool.splice(G.rng.int(0, pool.length - 1), 1)[0].id);
    G.board = board;
}

// ====================================================================== scenes
export function queueScene(G, id, args = {}) {
    G.queue.push({ id, args });
}

/** Start the next queued scene if none is playing. */
function pump(G) {
    while (!G.scene && G.queue.length) {
        const { id, args } = G.queue.shift();
        const def = sceneDef(id, args);
        const alive = beginScene(G, { id, args, title: def.title, kind: def.kind, album: !!def.album }, def.lines);
        if (!alive) finishScene(G);
    }
}

function finishScene(G) {
    const S = G.scene;
    if (!S) return;
    if (!G.seen.includes(S.id) && S.kind !== 'visit' && S.kind !== 'talk' && S.kind !== 'place' && S.kind !== 'event') G.seen.push(S.id);
    G.events.push({ type: 'sceneEnd', id: S.id, args: S.args, title: S.title, kind: S.kind, album: S.album, age: G.age });
    G.scene = null;
    if (S.id === 'ending') { G.over = true; G.phase = 'over'; G.events.push({ type: 'over', ending: G.ending }); return; }
    pump(G);
    if (!G.scene && G.after === 'month') { G.after = null; startMonth(G); }
}

export function sceneLines(G) {
    return G.scene ? sceneDef(G.scene.id, G.scene.args).lines : null;
}

// ====================================================================== commands
/** Apply one command. Returns true if it was accepted. */
export function act(G, cmd) {
    if (G.over) return false;
    if (G.scene) {
        const lines = sceneLines(G);
        if (cmd.t === 'advance') { if (!advLine(G, lines)) finishScene(G); return true; }
        if (cmd.t === 'choose') {
            if (!G.scene.cur?.choice) return false;
            const ok = G.scene.cur.choice.some((o) => o.i === cmd.i);
            if (!ok) return false;
            if (!chooseLine(G, lines, cmd.i)) finishScene(G);
            return true;
        }
        if (cmd.t === 'skip') {
            // skip to the next choice (or the end), applying every effect on the way
            while (G.scene && !G.scene.cur?.choice) { if (!advLine(G, sceneLines(G))) finishScene(G); }
            return true;
        }
        return false;
    }
    switch (G.phase) {
        case 'free': return freeCmd(G, cmd);
        case 'plan': return planCmd(G, cmd);
        case 'run': return runCmd(G, cmd);
        case 'adventure': return advCmd(G, cmd);
        case 'festival': return festivalCmd(G, cmd);
        case 'starfall': return starfallCmd(G, cmd);
        default: return false;
    }
}

// ====================================================================== the Free Day
export function placeOpen(G, p) {
    const P = PLACE[p];
    if (!P) return false;
    if (P.need && !G.flags[P.need]) return false;
    if (P.minAge && G.age < P.minAge) return false;
    return true;
}

/** The next heart event a friend is ready for, or null. */
export function heartReady(G, f) {
    const k = G.hearts[f];
    if (k >= 4 || !G.flags['met_' + f]) return null;
    const h = HEARTS[k];
    return G.aff[f] >= h.aff && G.age >= h.age ? HEART_SCENES[f][k].id : null;
}

function spend(G) {
    if (G.ap <= 0) return false;
    G.ap--;
    return true;
}

function freeCmd(G, c) {
    switch (c.t) {
        case 'buy': {
            const it = ITEM[c.item];
            if (!it || G.gold < it.price || (it.minAge && G.age < it.minAge)) return false;
            if (it.kind === 'keepsake' && G.keep[it.id]) return false;
            G.gold -= it.price;
            if (it.kind === 'keepsake') G.keep[it.id] = true;
            else G.inv[it.id] = (G.inv[it.id] || 0) + 1;
            G.events.push({ type: 'buy', item: it.id });
            return true;
        }
        case 'use': {
            const it = ITEM[c.item];
            if (!it || it.kind !== 'tonic' || !G.inv[it.id]) return false;
            G.inv[it.id]--;
            const out = {};
            for (const k in it.fx) out[k] = bump(G, k, it.fx[k]);
            G.events.push({ type: 'use', item: it.id, fx: out });
            return true;
        }
        case 'accept': {
            if (!G.board.includes(c.quest) || G.quests.length >= 2) return false;
            G.quests.push(c.quest);
            G.board = G.board.filter((q) => q !== c.quest);
            G.events.push({ type: 'accept', quest: c.quest });
            return true;
        }
        case 'drop': {
            if (!G.quests.includes(c.quest)) return false;
            G.quests = G.quests.filter((q) => q !== c.quest);
            return true;
        }
        case 'visit': return visit(G, c);
        case 'talk': return talk(G, c.topic);
        case 'do': return placeAction(G, c.place, c.action);
        case 'endFree':
            G.phase = 'plan';
            G.events.push({ type: 'phase', phase: 'plan' });
            return true;
        default: return false;
    }
}

const GIFT_GAIN = { loves: 10, likes: 6, neutral: 3, hates: -4 };
export function giftTaste(f, item) {
    const C = CAST[f];
    return C.loves.includes(item) ? 'loves' : C.likes.includes(item) ? 'likes' : C.hates.includes(item) ? 'hates' : 'neutral';
}

function visit(G, { who, gift }) {
    const C = CAST[who];
    if (!C?.friend || !G.flags['met_' + who]) return false;
    const place = C.place;
    if (!placeOpen(G, place)) return false;
    if (G.done['visit:' + who]) return false;
    if (gift && (!G.inv[gift] || ITEM[gift].kind !== 'gift')) return false;
    if (!spend(G)) return false;
    G.done['visit:' + who] = true;
    let giftReact = null;
    if (gift) {
        G.inv[gift]--;
        const taste = giftTaste(who, gift);
        bumpAff(G, who, GIFT_GAIN[taste]);
        giftReact = {
            loves: `${who}.happy: This is... how did you know? This is perfect.`,
            likes: `${who}.happy: For me? Thank you!`,
            neutral: `${who}: Oh. Thank you. That\'s kind.`,
            hates: `${who}: ...Ah. It\'s, um. It\'s the thought that counts.`,
        }[taste];
        G.events.push({ type: 'gift', who, item: gift, taste });
    }
    // a little affection for the visit itself, more if the prince is good at what they admire
    const admire = C.admires.reduce((a, k) => a + G.stats[k], 0) / C.admires.length;
    bumpAff(G, who, 3 + admire / 25);
    const heart = heartReady(G, who);
    if (heart) {
        G.hearts[who]++;
        if (giftReact) queueScene(G, 'visit', { friend: who, place, line: chatLine(who, G.age, G.rng.int(0, 9)), gift, giftReact });
        queueScene(G, heart);
        G.events.push({ type: 'heart', who, n: G.hearts[who] });
    } else {
        queueScene(G, 'visit', { friend: who, place, line: chatLine(who, G.age, G.rng.int(0, 9)), gift, giftReact });
    }
    pump(G);
    return true;
}

function talk(G, topic) {
    if (G.done.talk) return false;
    if (!['praise', 'scold', 'feel', 'mother', 'future'].includes(topic)) return false;
    if (!spend(G)) return false;
    G.done.talk = true;
    const fx = { praise: 'bond+3 sts-6 mor-0.5', scold: 'mor+2 sts+6 bond-2 drc-0.5', feel: 'bond+2 sts-5', mother: 'drc+1.5 bond+2 sts-2', future: 'bond+1' }[topic];
    applyFx(G, fx);
    const line = topic === 'future' ? `cael: ${ENDING[nearestEnding(G)].hint}` : talkLine(G, topic, G.rng.int(0, 9));
    queueScene(G, 'talk', { topic, age: G.age, line });
    pump(G);
    return true;
}

function placeAction(G, p, a) {
    if (!placeOpen(G, p)) return false;
    const A = PLACE[p].actions.find((x) => x.id === a);
    if (!A || A.free) return false;               // free actions (shop, board) are UI only
    const key = p + ':' + a;
    if (G.done[key]) return false;
    if (a === 'donate' && G.gold < 50) return false;
    if (a === 'play' && G.gold < 15) return false;
    if (a === 'feed' && G.gold < 20) return false;
    if (a === 'talk') return talk(G, 'feel');
    if (!spend(G)) return false;
    G.done[key] = true;
    const bg = PLACE[p].bg;
    let lines;
    const s = G.stats;
    switch (a) {
        case 'nap': applyFx(G, 'sts-10 bond+3'); lines = ['@bg garden', '@show cael.happy l', 'n: An afternoon of nothing: the garden swing, a pot of tea, a book read aloud.', 'cael.happy: Can we do this every week?']; break;
        case 'gossip': {
            const f = s.fav;
            lines = ['@bg ' + bg, 'n: You listen in the galleries and corridors of the castle.',
                f >= 55 ? 'n: The talk is all of the prince: his manners, his courage. Even the Duke\'s friends are careful what they say.'
                    : f >= 30 ? 'n: The court is divided. Some speak warmly of the prince. Many still flinch at the word "dragon".'
                        : 'n: The talk is cold. "Beast." "Danger." "Tower." The Duke\'s faction grows bolder.',
                G.age >= 13 && !G.flags.duke_plot ? 'n: Duke Mordrain is said to be gathering signatures for something. Nobody will say what.' : 'n: The King, they say, asks after his grandson every week.'];
            applyFx(G, 'int+0.5');
            break;
        }
        case 'petition': {
            const p2 = (s.grc + s.elo) / 2;
            const ok = G.rng() < 0.15 + p2 / 160;
            applyFx(G, ok ? 'fav+2 sts+3' : 'sts+4');
            lines = ['@bg throne', '@show cael l', ok ? 'n: The prince presents himself to the Chancellor with grace. The court takes note.' : 'n: The prince waits all day in an antechamber. Nobody sees him.'];
            break;
        }
        case 'spar': applyFx(G, 'cmb+1 sts+3'); bumpAff(G, 'rowan', 1); lines = ['@bg yard', '@show cael l', 'n: He spars with the squires until the sun goes down.']; break;
        case 'consult': {
            const top = nearestEnding(G);
            lines = ['@bg spire', '@show velis r', 'velis: You want to know what I see in him? Hm.',
                `velis: ${s.mag >= 40 ? 'Power. A great deal of it, still asleep.' : 'A mind that has not yet chosen its magic.'} ${s.drc >= 60 ? 'And a fire that grows louder every month. Watch it.' : 'His fire is calm. For now.'}`,
                `velis: If he goes on as he is, I think he will become... "${ENDING[top].title}". Make of that what you will.`];
            break;
        }
        case 'pray': applyFx(G, 'sts-8 fth+1'); lines = ['@bg temple', '@show cael l', 'n: You pray side by side before the eternal flame. It leans toward the prince, as it always does.']; break;
        case 'donate': G.gold -= 50; applyFx(G, 'mor+2 fame+1'); lines = ['@bg temple', '@show ilsabet r', 'ilsabet: Fifty crowns will feed the Rookery for a week. The Flame sees you, Warden.']; break;
        case 'play': G.gold -= 15; applyFx(G, 'sts-8 art+1'); lines = ['@bg theater', '@show cael.happy l', 'n: Tonight\'s play is a comedy about a knight afraid of geese. The prince laughs so hard he snorts smoke.']; break;
        case 'feed': G.gold -= 20; applyFx(G, 'mor+2'); bumpAff(G, 'pip', 2); lines = ['@bg rookery', '@show cael l', 'n: You bring bread and stew to the Rookery. The children swarm the prince, and he lets them climb him like a tree.']; break;
        default: return false;
    }
    queueScene(G, 'place', { lines, title: PLACE[p].name });
    pump(G);
    return true;
}

// ====================================================================== the planner
/** Can this activity be scheduled now? */
export function canDo(G, id) {
    if (id.startsWith('quest:')) return G.quests.includes(id.slice(6));
    if (id.startsWith('adv:')) {
        const R = REGION[id.slice(4)];
        return !!R && G.age >= R.minAge && (!R.need || G.flags[R.need]);
    }
    const A = ACT[id];
    if (!A || A.kind === 'adventure' || A.kind === 'quest') return false;
    if (G.age < A.minAge) return false;
    if (A.need && !G.flags[A.need]) return false;
    if (A.months && !A.months.includes(G.month)) return false;
    return true;
}

export function costOf(id) {
    const A = ACT[id];
    return A ? (A.cost || 0) : 0;
}

function planCmd(G, c) {
    if (c.t !== 'plan') return false;
    const slots = c.slots;
    if (!Array.isArray(slots) || slots.length !== PERIODS) return false;
    if (!slots.every((s) => typeof s === 'string' && canDo(G, s))) return false;
    // a quest can only be scheduled once; holidays only once a month
    const qs = slots.filter((s) => s.startsWith('quest:'));
    if (new Set(qs).size !== qs.length) return false;
    if (slots.filter((s) => s === 'holiday').length > 1) return false;
    G.plan = [...slots];
    G.lastPlan = [...slots];
    G.phase = 'run';
    G.period = 0;
    G.results = [];
    G.events.push({ type: 'phase', phase: 'run' });
    return true;
}

// ====================================================================== running the periods
function runCmd(G, c) {
    if (c.t !== 'next') return false;
    const id = G.plan[G.period];
    if (id.startsWith('adv:') && !(G.sick > 0)) {
        startAdventure(G, id.slice(4));
        return true;
    }
    resolvePeriod(G, id);
    afterPeriod(G);
    return true;
}

function afterPeriod(G) {
    G.period++;
    if (G.period >= PERIODS) endMonth(G);
}

/** Resolve one non-expedition period and record its result. */
export function resolvePeriod(G, id) {
    const s = G.stats;
    const res = { id, outcome: 'ok', text: '', fx: {}, gold: 0 };
    const add = (k, d) => { if (d) res.fx[k] = Math.round(((res.fx[k] || 0) + d) * 100) / 100; };

    // illness and rebellion come first
    if (G.sick > 0) {
        G.sick--;
        res.id = 'rest'; res.outcome = 'sick';
        res.text = 'He is ill, and spends the period in bed. Hobb makes soup. The physician sends a bill.';
        add('sts', bump(G, 'sts', -30));
        res.gold = -Math.min(G.gold, 30); G.gold += res.gold;
        G.results.push(res);
        G.events.push({ type: 'period', ...res });
        return res;
    }
    const A = id.startsWith('quest:') ? null : ACT[id];
    const isRest = A?.kind === 'rest';
    if (!isRest && s.sts >= STRESS.rebel && G.rng() < (s.sts - STRESS.rebel) / 55) {
        res.outcome = 'rebel';
        res.text = ['He never turns up. Hobb finds him on the manor roof at sunset, staring at the Peaks.',
            'He slams the door and refuses to come out of his room.',
            'He flies off without a word and comes back at midnight, smelling of smoke.'][G.rng.int(0, 2)];
        add('sts', bump(G, 'sts', -8));
        add('bond', bump(G, 'bond', -1.5));
        add('mor', bump(G, 'mor', -0.5));
        G.results.push(res);
        G.events.push({ type: 'period', ...res });
        return res;
    }

    if (id.startsWith('quest:')) {
        const q = QUEST[id.slice(6)];
        G.quests = G.quests.filter((x) => x !== q.id);
        const ok = G.rng() < questChance(G, q);
        res.quest = q.id;
        res.outcome = ok ? 'great' : 'fail';
        res.text = ok ? q.ok : q.fail;
        const fx = ok ? q.reward : (q.penalty || {});
        for (const k in fx) {
            if (k === 'aff') for (const f in fx.aff) add('aff.' + f, bumpAff(G, f, fx.aff[f]));
            else if (k === 'gold') { G.gold = Math.max(0, G.gold + fx.gold); res.gold += fx.gold; }
            else add(k, bump(G, k, (k === 'fame' || k === 'fav' ? 0.5 : 1) * fx[k], { trained: true }));
        }
        add('sts', bump(G, 'sts', ACT.quest.sts));
        G.count.quest = (G.count.quest || 0) + (ok ? 1 : 0);
        G.results.push(res);
        G.events.push({ type: 'period', ...res });
        return res;
    }

    // lessons, jobs and rest
    if (A.cost) {
        if (G.gold < A.cost) {
            res.outcome = 'broke';
            res.text = 'There is no money to pay the tutor. He spends the period at home instead.';
            add('sts', bump(G, 'sts', -6));
            G.results.push(res);
            G.events.push({ type: 'period', ...res });
            return res;
        }
        G.gold -= A.cost; res.gold -= A.cost;
    }
    let mult = 1;
    if (A.kind !== 'rest') {
        const failP = Math.max(0, (s.sts - STRESS.failAt) / 70);
        const r = G.rng();
        if (r < failP) { res.outcome = 'fail'; mult = 0.45; }
        else if (r > 0.88) { res.outcome = 'great'; mult = 1.5; }
    } else if (G.rng() > 0.8) res.outcome = 'great';
    const boost = Object.keys(G.keep).some((k) => ITEM[k].boosts?.includes(A.id)) ? 1.2 : 1;
    for (const k in A.fx) add(k, bump(G, k, A.fx[k] * GAIN_SCALE * (A.fx[k] > 0 ? mult * boost : 1), { trained: true }));
    if (A.sts) add('sts', bump(G, 'sts', A.sts * (A.kind === 'rest' && res.outcome === 'great' ? 1.3 : 1)));
    if (A.bond) add('bond', bump(G, 'bond', A.bond));
    if (A.kind === 'job') {
        let pay;
        if (A.gamble) pay = Math.round(-40 + G.rng() * (60 + s.cun * 3));
        else pay = Math.round(A.pay * (0.7 + s[A.skill] / 125) * (res.outcome === 'great' ? 1.5 : res.outcome === 'fail' ? 0.5 : 1) + (A.drcPay ? s.drc * 0.5 : 0));
        G.gold = Math.max(0, G.gold + pay); res.gold += pay;
    }
    if (A.friend && G.flags['met_' + A.friend]) add('aff.' + A.friend, bumpAff(G, A.friend, 1.2));
    if (A.friendAny) {
        const met = FRIENDS.filter((f) => G.flags['met_' + f]);
        for (let i = 0; i < A.friendAny && met.length; i++) { const f = met.splice(G.rng.int(0, met.length - 1), 1)[0]; add('aff.' + f, bumpAff(G, f, 2)); }
    }
    // stress stirs the dragon
    if (G.stats.sts >= STRESS.drakeAt) add('drc', bump(G, 'drc', STRESS.drakeGain));
    if (G.stats.sts >= STRESS.sick) { G.sick = 1; res.sickNext = true; }
    const pool = res.outcome === 'great' && A.great?.length ? A.great : res.outcome === 'fail' && A.fail?.length ? A.fail : A.ok;
    res.text = pool[G.rng.int(0, pool.length - 1)];
    G.count[A.id] = (G.count[A.id] || 0) + 1;
    G.results.push(res);
    G.events.push({ type: 'period', ...res });
    return res;
}

// ====================================================================== expeditions
function startAdventure(G, region) {
    const R = REGION[region];
    const idx = R.steps.map((_, i) => i);
    const pick = [];
    while (pick.length < 3) pick.push(idx.splice(G.rng.int(0, idx.length - 1), 1)[0]);
    G.adv = { region, steps: pick, k: 0, log: [], gold: 0, fx: {}, won: 0 };
    G.phase = 'adventure';
    G.events.push({ type: 'advStart', region });
}

export function advStep(G) {
    const A = G.adv;
    if (!A) return null;
    const R = REGION[A.region];
    return A.k < 3 ? R.steps[A.steps[A.k]] : R.boss;
}

export function advDiff(G) {
    const A = G.adv, R = REGION[A.region];
    return R.base + A.k * 3 + (A.k >= 3 ? R.boss.bonus : 0);
}

export function advChance(G, approach) {
    return encounterChance(G, APPROACH[approach].stats, advDiff(G));
}

function advCmd(G, c) {
    const A = G.adv;
    if (c.t === 'retreat') { finishAdventure(G, true); return true; }
    if (c.t !== 'approach') return false;
    const step = advStep(G);
    if (!step.opts.includes(c.a)) return false;
    const ok = G.rng() < advChance(G, c.a);
    const entry = { k: A.k, a: c.a, ok, text: ok ? step.ok : step.fail, fx: {} };
    const add = (k, d) => { if (d) { entry.fx[k] = (entry.fx[k] || 0) + d; A.fx[k] = Math.round(((A.fx[k] || 0) + d) * 100) / 100; } };
    if (ok) {
        A.won++;
        for (const k in step.reward) {
            if (k === 'gold') { const g = Math.round(step.reward.gold * 0.6); G.gold += g; A.gold += g; entry.gold = g; }
            else add(k, bump(G, k, step.reward[k], { trained: true }));
        }
        // the approach itself teaches a little
        const main = Object.keys(APPROACH[c.a].stats)[0];
        add(main, bump(G, main, 0.6, { trained: true }));
    } else {
        add('sts', bump(G, 'sts', 5));
        add('vit', bump(G, 'vit', -0.4));
    }
    A.log.push(entry);
    G.events.push({ type: 'encounter', ...entry, boss: A.k >= 3 });
    A.k++;
    if (A.k > 3) finishAdventure(G, false);
    return true;
}

function finishAdventure(G, retreated) {
    const A = G.adv;
    const R = REGION[A.region];
    bump(G, 'sts', ACT.adventure.sts);
    A.fx.sts = Math.round(((A.fx.sts || 0) + ACT.adventure.sts) * 100) / 100;
    if (!retreated) {
        G.count.adventure = (G.count.adventure || 0) + 1;
        G.count['adv_' + A.region] = (G.count['adv_' + A.region] || 0) + 1;
        if (A.won >= 3) { A.fx.fame = (A.fx.fame || 0) + bump(G, 'fame', 1); }
    }
    const res = {
        id: 'adv:' + A.region, outcome: retreated ? 'retreat' : A.won >= 3 ? 'great' : A.won >= 2 ? 'ok' : 'fail',
        text: retreated ? `He turns back from ${R.name} before the end.` : `${R.name}: ${A.won} of 4 dangers overcome.`,
        fx: A.fx, gold: A.gold, region: A.region, log: A.log,
    };
    G.adv = null;
    G.results.push(res);
    G.events.push({ type: 'period', ...res });
    G.phase = 'run';
    afterPeriod(G);
}

// ====================================================================== the end of the month
function endMonth(G) {
    G.events.push({ type: 'monthEnd' });
    if (G.month === FESTIVAL_MONTH) { G.phase = 'festival'; return; }
    if (G.month === STARFALL_MONTH && G.age >= 11) { G.phase = 'starfall'; return; }
    startMonth(G);
}

export function contestOpen(G, id) {
    const C = CONTEST[id];
    return !!C && (!C.minAge || G.age >= C.minAge);
}

/** The prince's festival score and the field. Deterministic given the rng. */
function contestScores(G, C) {
    const me = power(G, C.stats) + G.rng() * 12;
    const rivals = C.rivals.map(([name, who, base]) => ({ name, who, score: base + (G.age - 10) * 6.2 + G.rng() * 12 }));
    return { me, rivals };
}

function festivalCmd(G, c) {
    if (c.t !== 'contest') return false;
    if (c.id === null) { G.events.push({ type: 'festival', skipped: true }); startMonth(G); return true; }
    if (!contestOpen(G, c.id)) return false;
    const C = CONTEST[c.id];
    const { me, rivals } = contestScores(G, C);
    const rank = 1 + rivals.filter((r) => r.score > me).length;
    const won = rank === 1;
    applyFx(G, won ? 'fame+4 fav+2 sts-4 gold+250' : rank === 2 ? 'fame+1 gold+80' : 'sts+4');
    if (won) G.count['win_' + C.id] = (G.count['win_' + C.id] || 0) + 1;
    G.events.push({ type: 'festival', contest: C.id, rank, won });
    queueScene(G, 'festival', { contest: C.id, won, rank, rivals: C.rivals.map((r) => [r[0], r[1]]) });
    G.phase = 'monthEnd';
    G.after = 'month';
    pump(G);
    return true;
}

function starfallCmd(G, c) {
    if (c.t !== 'starfall') return false;
    if (c.who === null) { startMonth(G); return true; }
    if (!FRIENDS.includes(c.who) || !G.flags['met_' + c.who] || G.aff[c.who] < 20) return false;
    bumpAff(G, c.who, G.partner === c.who ? 8 : 6);
    bump(G, 'sts', -8);
    queueScene(G, 'starfall', { friend: c.who, grown: G.age >= 14 });
    G.phase = 'monthEnd';
    G.after = 'month';
    pump(G);
    return true;
}

// ====================================================================== the ending
function beginEnding(G) {
    const id = chooseEnding(G);
    const partner = ENDING[id].bad ? null : G.partner;
    G.ending = { id, partner };
    G.phase = 'ending';
    G.events.push({ type: 'ending', id, partner });
    queueScene(G, 'ending', { ending: id, partner });
    pump(G);
}

// ====================================================================== saving
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_VERSION) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    // the current scene's script is rebuilt from its id (sceneLines); check it still exists
    if (G.scene) sceneLines(G);
    return G;
}

// Re-export for the UI and tests.
export { runTo, evalCond };
