// The campaign. Pure: no DOM, no renderer, no Math.random, no clock.
//
// newGame(seed) builds the state, step(G, inp, dt) walks the healer around, act(G, action) does
// every discrete thing (talk, scan, buy, learn, travel), and objective(G) says what to do next —
// the HUD's guide and the bot both read it. The view and UI read G and drain G.events.

import { objRng } from '../rng.js';
import { CELL } from '../config.js';
import { MAPS } from './data/maps.js';
import { SPECIES } from './data/species.js';
import { SENSE_ORDER } from './data/ailments.js';
import { SKILL_BY_ID, ITEMS, ITEM_IDS, RELICS, EVIDENCE, UPGRADES, scanMods, canLearn, renownFor, itemMax } from './data/skills.js';
import {
    ACTS, STORY_PATIENTS, QUESTS, INTRO, PIP_TUTORIAL, HOMECOMING, ITEMS_FOUND,
    makeWalkin, scanSpecFor, walkinIntro, walkinThanks, claspLines, ossaLines,
} from './data/story.js';
import * as Scan from './scan.js';
import { mapEnts, facing, stepPlayer, placeAtStart, routeTo, findCells, cellCentre } from './world.js';

export const SAVE_V = 1;

export function newGame(seed = 1) {
    const G = {
        v: SAVE_V,
        seed,
        rs: seed | 0,
        t: 0,
        act: 0,
        day: 1,
        gold: 30,
        renown: 0,
        level: 1,
        points: 0,
        skills: {},
        items: { salts: 1, calm: 0, star: 0 },
        upgrades: {},
        relics: [],
        evidence: [],
        senses: ['kind'],
        codex: [],
        bestiary: {},
        flags: {},
        patients: [],
        quests: {},
        map: 'clinic',
        player: null,
        wv: 0,
        nextPid: 1,
        scan: null,
        talk: null,
        ending: false,
        stats: { healed: 0, stars: 0, scans: 0, tonics: 0, steps: 0 },
        events: [],
    };
    for (const id of Object.keys(QUESTS)) G.quests[id] = { state: 'locked', gate: false, traps: {}, chests: {}, evidence: false, visited: false };
    placeAtStart(G, 'clinic');
    refreshClinic(G);
    say(G, INTRO, { type: 'flag', key: 'intro' });
    G.events.length = 0;
    return G;
}

const rng = (G) => objRng(G, 'rs');
const emit = (G, e) => { G.events.push(e); return e; };
const touch = (G) => { G.wv++; };

function say(G, lines, then = null) {
    G.talk = { lines: lines.map(([who, text]) => ({ who, text })), then };
    emit(G, { type: 'talk' });
}

/** Lines after the current conversation (chained on its `then`). */
function sayAfter(G, lines, then = null) {
    if (!G.talk) return say(G, lines, then);
    const prev = G.talk.then;
    G.talk.then = { type: 'chain', lines, then: then ?? null, prev };
}

export const patientById = (G, id) => G.patients.find((p) => p.id === id);

function addPatient(G, def, extra) {
    const p = {
        id: extra.id ?? `p${G.nextPid++}`,
        species: def.species, name: def.name, ailment: def.ailment,
        scan: JSON.parse(JSON.stringify(def.scan)),
        state: 'waiting', story: !!extra.story, walkin: !!def.walkin, boss: !!extra.boss,
        where: extra.where, slot: extra.slot ?? null, defKey: extra.defKey ?? null,
    };
    G.patients.push(p);
    touch(G);
    return p;
}

/** Story patients appear one after another; when the act's last is healed, its call comes in. */
function refreshClinic(G) {
    const A = ACTS[G.act];
    if (!A) return;
    for (const id of A.story) {
        const p = patientById(G, id);
        if (!p) { addPatient(G, STORY_PATIENTS[id], { id, story: true, where: 'clinic', defKey: id }); emit(G, { type: 'arrive', id }); return; }
        if (p.state !== 'gone' && p.state !== 'healed') return;
    }
    const qid = A.quest;
    if (qid && G.quests[qid].state === 'locked') openQuest(G, qid);
}

function openQuest(G, qid) {
    const Q = QUESTS[qid];
    G.quests[qid].state = 'open';
    Q.patients.forEach((def, i) => addPatient(G, def, { id: `${qid}${i + 1}`, where: qid, slot: i, defKey: `${qid}:${i}` }));
    addPatient(G, Q.boss, { id: `${qid}Boss`, where: qid, boss: true, defKey: `${qid}:boss` });
    emit(G, { type: 'call', quest: qid });
}

// ------------------------------------------------------------------ step

export function step(G, inp, dt) {
    G.t += dt;
    if (G.talk || G.scan || G.ending) return;
    const before = G.player.walk || 0;
    stepPlayer(G, inp, dt);
    if (Math.floor((G.player.walk || 0) / 1.7) !== Math.floor(before / 1.7)) { G.stats.steps++; emit(G, { type: 'step', map: G.map }); }
}

// ------------------------------------------------------------------ actions

/** Do one discrete thing. Returns true if it did something. */
export function act(G, a) {
    switch (a.type) {
        case 'interact': return interact(G, a.key ? mapEnts(G).find((e) => e.key === a.key) : facing(G));
        case 'talkEnd': return talkEnd(G);
        case 'travel': return travel(G, a.to);
        case 'learn': return learn(G, a.id);
        case 'buy': return buy(G, a.item);
        case 'scanChain': return scanDo(G, () => Scan.playChain(G.scan.S, a.path));
        case 'scanPower': return scanDo(G, () => Scan.usePower(G.scan.S, a.vial, a.r, a.c));
        case 'scanItem': {
            if (!G.scan || !(G.items[a.item] > 0)) return false;
            const ok = scanDo(G, () => Scan.useItem(G.scan.S, a.item));
            if (ok) { G.items[a.item]--; emit(G, { type: 'useItem', item: a.item }); }
            return ok;
        }
        case 'scanTonic': {
            if (!G.scan || !Scan.drinkTonic(G.scan.S)) return false;
            G.stats.tonics++;
            flushScan(G);
            return true;
        }
        case 'scanQuit': return scanQuit(G);
        case 'scanFinish': return scanFinish(G);
        case 'endingDone': return endingDone(G);
        default: return false;
    }
}

function interact(G, e) {
    if (!e || G.talk || G.scan || G.ending) return false;
    emit(G, { type: 'use', kind: e.kind, key: e.key });
    switch (e.kind) {
        case 'npc': return talkNpc(G, e.id);
        case 'patient': return talkPatient(G, patientById(G, e.id), e);
        case 'lens': {
            const p = G.patients.find((q) => q.where === 'clinic' && q.state === 'table');
            if (!p) { say(G, [['pip', 'Nobody on the table! Talk to someone in the waiting room and send them over.']]); return true; }
            if (!G.flags.tutorial) { say(G, PIP_TUTORIAL, { type: 'scan', id: p.id, tutorial: true }); return true; }
            startScan(G, p);
            return true;
        }
        case 'grimoire':
            if (!G.flags.ossaMet) { say(G, [['ossa', 'Come and talk to me before you go reading that, love. It bites.']]); return true; }
            emit(G, { type: 'open', what: 'skills' });
            return true;
        case 'shop': emit(G, { type: 'open', what: 'shop' }); return true;
        case 'cot': return rest(G);
        case 'exit':
            if (G.map === 'clinic') {
                if (!G.flags.met) { say(G, [['ossa', 'Doors first, adventures later. Say hello to Clasp.']]); return true; }
                emit(G, { type: 'open', what: 'map' });
                return true;
            }
            return travel(G, 'clinic');
        case 'gate': say(G, QUESTS[G.map].gateShut); return true;
        case 'trap': {
            const Q = G.quests[G.map];
            Q.traps[e.key] = true;
            G.gold += 15;
            touch(G);
            emit(G, { type: 'trap', key: e.key, x: e.x, y: e.y });
            const lines = {
                bramble: 'You snip the thornwire and coil it away. A little gold tag on it reads "Gilded Co." Under it you find 15 moonpetals somebody dropped.',
                crypt: 'You wipe the hex-ward off the stones with your sleeve. It hisses and goes out. 15 moonpetals lie in the dust beneath it.',
                forge: 'You jam the spike trap with a stone and it folds up with a clank. Someone left 15 moonpetals in its housing.',
                citadel: 'You lift the gilded snare off its hook. A purse of 15 moonpetals is tied to it, bait for a hungry goblin.',
            };
            say(G, [['narrator', lines[G.map]]]);
            return true;
        }
        case 'chest': {
            const Q = G.quests[G.map];
            Q.chests[e.key] = true;
            touch(G);
            if (e.relic) {
                const relic = ACTS[QUESTS[G.map].act].reward.relic;
                if (relic && !G.relics.includes(relic)) {
                    G.relics.push(relic);
                    emit(G, { type: 'relic', id: relic, x: e.x, y: e.y });
                    say(G, [['narrator', `Inside, wrapped in old cloth: the ${RELICS[relic].label}. ${RELICS[relic].desc}`], ['pip', 'Ooh. That was your teacher\'s! I\'d know it anywhere.']]);
                } else {
                    G.gold += 40;
                    emit(G, { type: 'chest', x: e.x, y: e.y });
                    say(G, [['narrator', 'Inside: a heavy purse. 40 moonpetals.']]);
                }
            } else {
                const got = {};
                for (const [k, n] of Object.entries(QUESTS[G.map].remedies)) {
                    const add = Math.min(n, itemMax(G) - G.items[k]);
                    if (add > 0) { G.items[k] += add; got[k] = add; }
                }
                if (!Object.keys(got).length) { G.gold += 20; say(G, [['narrator', 'Remedies, but your satchel is full. You take the 20 moonpetals tucked underneath instead.']]); } else say(G, ITEMS_FOUND(got));
                emit(G, { type: 'chest', x: e.x, y: e.y });
            }
            return true;
        }
        case 'evidence': {
            const Q = G.quests[G.map];
            Q.evidence = true;
            touch(G);
            const id = ACTS[QUESTS[G.map].act].reward.evidence;
            if (!G.evidence.includes(id)) G.evidence.push(id);
            emit(G, { type: 'evidence', id });
            say(G, QUESTS[G.map].evidence ?? [['narrator', EVIDENCE[id].desc]]);
            return true;
        }
        default: return false;
    }
}

function talkNpc(G, id) {
    if (id === 'clasp') {
        say(G, claspLines(G), { type: 'flag', key: 'met' });
        return true;
    }
    if (id === 'ossa') {
        say(G, ossaLines(G), { type: 'flag', key: 'ossaMet' });
        return true;
    }
    const orderly = {
        aldric: [['aldric', 'I was a PALADIN. I had a horse named Glorious.'], ['aldric', '...The slime ate my mop again. Could you, perhaps, heal the mop.']],
        vessa: [['vessa', 'Don\'t look at me like that. I\'m counting bandages. Honestly. Every single one.'], ['vessa', 'Fine. I gave the egg back. The dragon was very... large about it.']],
        corvin: [['corvin', 'The waiting-room skeletons keep asking me to sign their ribs. As an autograph. They think it\'s funny.'], ['corvin', 'It is a little funny.']],
        lumina: [['lumina', 'I\'ve been lighting the lanterns. Just lanterns. Nothing on fire that shouldn\'t be.'], ['lumina', 'The little ghost girl asked me to sing. I didn\'t know any songs that weren\'t about smiting.']],
    };
    if (orderly[id]) { say(G, orderly[id]); return true; }
    return false;
}

function talkPatient(G, p, e) {
    if (!p) return false;
    if (p.state === 'healed') {
        say(G, p.boss ? [[p.id, 'Thank you, healer. Truly.']] : [[p.id, 'Feeling much better. Thank you!']]);
        return true;
    }
    const intro = introFor(p);
    if (p.where === 'clinic') {
        if (p.state === 'table') { say(G, [[p.id, 'Ready when you are! Use the Lens by the table.']]); return true; }
        const busy = G.patients.find((q) => q.where === 'clinic' && q.state === 'table');
        if (busy) { say(G, [[p.id, `I'll wait. ${busy.name} is on the table.`]]); return true; }
        say(G, intro, { type: 'toTable', id: p.id });
        return true;
    }
    say(G, intro, { type: 'scan', id: p.id });
    return true;
}

function introFor(p) {
    if (p.story) return STORY_PATIENTS[p.defKey].intro;
    if (p.defKey && p.defKey.includes(':')) {
        const [qid, i] = p.defKey.split(':');
        return i === 'boss' ? QUESTS[qid].boss.intro : QUESTS[qid].patients[+i].intro;
    }
    return walkinIntro(p);
}

function thanksFor(p, stars) {
    if (p.story) return STORY_PATIENTS[p.defKey].thanks;
    if (p.defKey && p.defKey.includes(':')) {
        const [qid, i] = p.defKey.split(':');
        return i === 'boss' ? QUESTS[qid].boss.thanks : QUESTS[qid].patients[+i].thanks;
    }
    return walkinThanks(p, stars);
}

function talkEnd(G) {
    if (!G.talk) return false;
    const then = G.talk.then;
    G.talk = null;
    emit(G, { type: 'talkEnd' });
    runThen(G, then);
    return true;
}

function runThen(G, then) {
    if (!then) return;
    switch (then.type) {
        case 'chain':
            runThen(G, then.prev);
            if (G.talk) sayAfter(G, then.lines, then.then);
            else say(G, then.lines, then.then);
            break;
        case 'flag': G.flags[then.key] = true; touch(G); break;
        case 'toTable': {
            const p = patientById(G, then.id);
            if (p && p.state === 'waiting') { p.state = 'table'; touch(G); emit(G, { type: 'toTable', id: p.id }); }
            break;
        }
        case 'scan': {
            if (then.tutorial) G.flags.tutorial = true;
            const p = patientById(G, then.id);
            if (p && p.state !== 'healed') startScan(G, p);
            break;
        }
        case 'leave': {
            const p = patientById(G, then.id);
            if (p) { p.state = 'gone'; touch(G); emit(G, { type: 'leave', id: p.id }); }
            refreshClinic(G);
            break;
        }
        case 'ending':
            G.ending = true;
            emit(G, { type: 'ending' });
            break;
        default: break;
    }
}

// ------------------------------------------------------------------ scans

export function currentMods(G) {
    return scanMods(G.skills, G.relics, G.senses, G.upgrades);
}

function startScan(G, p) {
    const spec = scanSpecFor(p);
    const seed = Math.floor(rng(G)() * 2 ** 31);
    const senses = SENSE_ORDER.filter((s) => G.senses.includes(s));
    G.scan = { pid: p.id, S: Scan.newScan(spec, { seed, senses, mods: currentMods(G) }) };
    G.stats.scans++;
    emit(G, { type: 'scanStart', id: p.id });
    return true;
}

function flushScan(G) {
    const S = G.scan.S;
    if (S.events.length) emit(G, { type: 'scanEvents', list: S.events.splice(0) });
}

function scanDo(G, fn) {
    if (!G.scan) return false;
    const ev = fn();
    if (!ev) { G.scan.S.events.length = 0; return false; }
    flushScan(G);
    return true;
}

function scanQuit(G) {
    if (!G.scan) return false;
    const p = patientById(G, G.scan.pid);
    G.scan = null;
    emit(G, { type: 'scanEnd', id: p?.id, won: false });
    if (p) say(G, [[p.id, p.where === 'clinic' ? 'I\'ll stay on the table. Try again when you\'re ready.' : 'Please... come back when you can.']]);
    return true;
}

function scanFinish(G) {
    if (!G.scan || G.scan.S.status !== 'won') return false;
    const S = G.scan.S;
    const p = patientById(G, G.scan.pid);
    G.scan = null;
    p.state = 'healed';
    touch(G);
    const actIdx = Math.min(G.act, 3);
    const boss = p.boss;
    const mult = boss ? 2.5 : p.story ? 1.4 : 1;
    const gold = Math.round((6 + actIdx * 3 + S.stars * 3 + Math.floor(S.bonus / 150)) * mult);
    const renown = Math.round((22 + actIdx * 8 + S.stars * 6) * mult * (G.upgrades.vase ? 1.25 : 1));
    G.gold += gold;
    G.stats.healed++;
    G.stats.stars += S.stars;
    for (const k of S.found) if (!G.codex.includes(k)) G.codex.push(k);
    G.bestiary[p.species] = (G.bestiary[p.species] || 0) + 1;
    emit(G, { type: 'scanEnd', id: p.id, won: true, stars: S.stars, gold, renown });
    gainRenown(G, renown);

    const lines = thanksFor(p, S.stars).slice();
    let then = p.where === 'clinic' ? { type: 'leave', id: p.id } : null;
    if (boss) {
        const qid = p.where;
        const A = ACTS[QUESTS[qid].act];
        G.quests[qid].state = 'done';
        G.points += 1;
        emit(G, { type: 'points', n: 1, why: 'boss' });
        if (A.reward.evidence && qid !== 'citadel' && !G.evidence.includes(A.reward.evidence)) {
            G.evidence.push(A.reward.evidence);
            emit(G, { type: 'evidence', id: A.reward.evidence });
        }
        if (A.reward.sense && !G.senses.includes(A.reward.sense)) {
            G.senses.push(A.reward.sense);
            emit(G, { type: 'sense', sense: A.reward.sense });
        }
        if (qid === 'citadel') then = { type: 'ending' };
    } else if (p.where !== 'clinic') {
        const Q = G.quests[p.where];
        const others = G.patients.filter((q) => q.where === p.where && !q.boss);
        if (!Q.gate && others.every((q) => q.state === 'healed')) {
            Q.gate = true;
            touch(G);
            emit(G, { type: 'gate', map: p.where });
            lines.push(...QUESTS[p.where].gateOpen);
        }
    }
    say(G, lines, then);
    return true;
}

function gainRenown(G, n) {
    G.renown += n;
    while (G.renown >= renownFor(G.level)) {
        G.renown -= renownFor(G.level);
        G.level++;
        G.points++;
        emit(G, { type: 'levelUp', level: G.level });
    }
}

// ------------------------------------------------------------------ the clinic

function rest(G) {
    const pending = G.patients.filter((p) => p.where === 'clinic' && (p.state === 'waiting' || p.state === 'table'));
    if (pending.length) { say(G, [['ossa', 'Not with patients waiting, love. Sleep is for when the benches are empty.']]); return true; }
    G.day++;
    for (const p of G.patients) if (p.where === 'clinic' && p.state === 'healed') p.state = 'gone';
    G.patients = G.patients.filter((p) => !(p.walkin && p.state === 'gone'));
    const n = G.act === 0 ? 2 : 3;
    const r = rng(G);
    for (let i = 0; i < n; i++) {
        const id = `w${G.nextPid++}`;
        addPatient(G, makeWalkin(Math.min(G.act, 4), r, id), { id, where: 'clinic' });
    }
    let brewed = null;
    if (G.upgrades.still) {
        const open = ITEM_IDS.filter((k) => G.items[k] < itemMax(G));
        if (open.length) { brewed = open[G.day % open.length]; G.items[brewed]++; }
    }
    touch(G);
    emit(G, { type: 'rest', day: G.day, brewed });
    say(G, [['narrator', `Day ${G.day}. The lanterns are lit, and ${n} patients are waiting on the benches.`]]);
    refreshClinic(G);
    return true;
}

function travel(G, to) {
    if (G.talk || G.scan || !MAPS[to]) return false;
    if (to !== 'clinic' && G.map !== 'clinic') return false;
    if (to !== 'clinic' && G.quests[to].state === 'locked') return false;
    const from = G.map;
    placeAtStart(G, to);
    emit(G, { type: 'travel', from, to });
    if (to === 'clinic') {
        const qid = from;
        const Q = G.quests[qid];
        if (Q && Q.state === 'done' && QUESTS[qid].act === G.act && G.act < 3) {
            G.act++;
            emit(G, { type: 'act', act: G.act });
            say(G, HOMECOMING[G.act - 1]);
            refreshClinic(G);
        }
        return true;
    }
    const Q = G.quests[to];
    if (!Q.visited) { Q.visited = true; say(G, QUESTS[to].arrive); }
    return true;
}

function endingDone(G) {
    if (!G.ending) return false;
    G.ending = false;
    G.act = 4;
    G.flags.won = true;
    placeAtStart(G, 'clinic');
    emit(G, { type: 'act', act: 4 });
    say(G, [
        ['clasp', 'Welcome home, Healer of Gloamhollow! That\'s what they\'re calling you. I had it engraved on a plaque. The plaque is me.'],
        ['ossa', 'Rest when you like, love. The clinic is open, and it\'ll stay open. There will always be another thorn.'],
    ]);
    return true;
}

// ------------------------------------------------------------------ meta

function learn(G, id) {
    if (!canLearn(G, id)) return false;
    G.points -= SKILL_BY_ID[id].cost;
    G.skills[id] = true;
    emit(G, { type: 'learn', id });
    return true;
}

function buy(G, item) {
    const up = UPGRADES[item];
    if (up) {
        if (G.upgrades[item] || G.gold < up.price) return false;
        G.gold -= up.price;
        G.upgrades[item] = true;
        touch(G);
        emit(G, { type: 'upgrade', id: item });
        return true;
    }
    const it = ITEMS[item];
    if (!it || G.gold < it.price || G.items[item] >= itemMax(G)) return false;
    G.gold -= it.price;
    G.items[item]++;
    emit(G, { type: 'buy', item });
    return true;
}

// ------------------------------------------------------------------ objective

/**
 * What to do next: { text, x, y } on the current map (x, y a cell), or { text } with no target.
 * opt.bot also sends the bot after chests and optional walk-ins.
 */
export function objective(G, opt = {}) {
    if (G.ending) return { text: 'The Lantern Court' };
    const ents = mapEnts(G);
    const find = (pred) => ents.find(pred);
    const at = (e, text, extra = {}) => (e ? { text, x: e.x, y: e.y, key: e.key, ...extra } : { text });
    if (G.map === 'clinic') {
        if (!G.flags.met) return at(find((e) => e.kind === 'npc' && e.id === 'clasp'), 'Say hello to Clasp at the desk');
        const table = G.patients.find((p) => p.where === 'clinic' && p.state === 'table');
        if (table) return at(find((e) => e.kind === 'lens'), `Use the Lumen Lens to treat ${table.name}`);
        const story = G.patients.find((p) => p.where === 'clinic' && p.state === 'waiting' && p.story);
        if (story) return at(find((e) => e.kind === 'patient' && e.id === story.id), `Talk to ${story.name} in the waiting room`);
        if (!G.flags.ossaMet && G.act >= 0 && G.patients.some((p) => p.id === 'nib' && p.state !== 'waiting')) {
            return at(find((e) => e.kind === 'npc' && e.id === 'ossa'), 'Talk to Ossa in the study');
        }
        const qid = ACTS[G.act]?.quest;
        const walk = G.patients.find((p) => p.where === 'clinic' && p.state === 'waiting');
        if (walk && (opt.bot ? opt.walkins !== false : !(qid && G.quests[qid].state === 'open'))) {
            return at(find((e) => e.kind === 'patient' && e.id === walk.id), `Treat ${walk.name} (waiting)`);
        }
        if (qid && G.quests[qid].state === 'open') return at(find((e) => e.kind === 'exit'), `Head out to ${QUESTS[qid].label}`, { travel: qid });
        if (walk) return at(find((e) => e.kind === 'patient' && e.id === walk.id), `Treat ${walk.name} (waiting)`);
        return at(find((e) => e.kind === 'cot'), 'Rest at the cot for a new day of patients', { rest: true });
    }
    const Q = G.quests[G.map];
    if (!Q) return { text: '' };
    if (Q.state === 'done') return at(find((e) => e.kind === 'exit'), 'Ride home to the clinic');
    // the nearest reachable thing worth doing; traps only when they block the way
    const wants = ents.filter((e) =>
        (e.kind === 'patient' && !e.healed && (!e.boss || Q.gate)) ||
        (e.kind === 'evidence') ||
        (e.kind === 'chest' && !e.open));
    const routed = wants.map((e) => ({ e, r: routeTo(G, e.x, e.y) }));
    const reach = routed.filter((o) => o.r).sort((a, b) => a.r.length - b.r.length);
    const blockedWant = routed.some((o) => !o.r && !(o.e.boss));
    // patients first, then evidence, then chests; traps in the way before the boss
    const first = reach.find((o) => o.e.kind === 'patient' && !o.e.boss) || reach.find((o) => o.e.kind === 'evidence') ||
        reach.find((o) => o.e.kind === 'chest') || null;
    if (first) {
        const e = first.e;
        const p = e.kind === 'patient' ? patientById(G, e.id) : null;
        const text = p ? `Find and treat ${p.name}` : e.kind === 'evidence' ? 'Something glints on the floor' : 'Open the chest';
        return at(e, text);
    }
    const trapsIn = ents.filter((e) => e.kind === 'trap' && !e.disarmed).map((e) => ({ e, r: routeTo(G, e.x, e.y) })).filter((o) => o.r);
    trapsIn.sort((a, b) => a.r.length - b.r.length);
    if (blockedWant && trapsIn.length) return at(trapsIn[0].e, 'Disarm the Company trap in the way');
    const boss = reach.find((o) => o.e.boss);
    if (boss) return at(boss.e, `Treat ${patientById(G, boss.e.id).name}`);
    const traps = ents.filter((e) => e.kind === 'trap' && !e.disarmed).map((e) => ({ e, r: routeTo(G, e.x, e.y) })).filter((o) => o.r);
    traps.sort((a, b) => a.r.length - b.r.length);
    if (traps.length) return at(traps[0].e, 'Disarm the Company trap in the way');
    const gate = find((e) => e.kind === 'gate' && !e.open);
    if (gate) return at(gate, 'Find a way past the gate');
    return { text: 'Explore' };
}

/** The route for the HUD's guide arrow. */
export function objectiveRoute(G) {
    const o = objective(G);
    if (o.x == null) return null;
    return { o, path: routeTo(G, o.x, o.y) };
}

// ------------------------------------------------------------------ save

export function serialize(G) {
    const out = {};
    for (const k of Object.keys(G)) if (k !== 'events' && k[0] !== '_') out[k] = G[k];
    const d = JSON.parse(JSON.stringify(out));
    if (d.scan) d.scan.S.events = [];
    return d;
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    const G = JSON.parse(JSON.stringify(d));
    G.events = [];
    if (G.scan) G.scan.S.events = [];
    if (!MAPS[G.map]) throw new Error('bad map');
    return G;
}

/** Shorthand for tests and the UI. */
export const speciesOf = (p) => SPECIES[p.species];
export { cellCentre, findCells, CELL };
