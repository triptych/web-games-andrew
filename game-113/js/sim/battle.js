// The rhythm duel. Pure: song time comes in as dt, presses come in with the song time they were made at.
//
// A battle is a song in phrases of PHRASE_BARS bars, after a one-bar count-in:
//   PLAY  — the band's notes fall in each princess's lane. A hit is a blow (and a heal, a ward or resonance).
//   GUARD — the enemy plays a riff across the same lanes. A hit blocks it; a PERFECT parries; a miss hurts that princess.
// The two alternate until the enemy or the whole band falls. Crescendo (Space / ★) is the band's limit break.
//
// The final battle is scripted: at 45% the Hush knocks out the band, Lyra keeps the beat alone, Otto leaves, and the
// Colossus AUREL-ONE arrives; the last verse adds its golden notes, played on the Crescendo key.

import {
    WINDOWS, DIFF, JUDGE, ROLE, WARD_MAX, RESO_MAX, COMBO_CAP, CRES, BLOCK, HOLD_RELEASE_GRACE,
    BEATS_PER_BAR, PHRASE_BARS, COUNT_IN_BEATS,
} from '../config.js';
import { ENEMIES } from './data/enemies.js';
import { CHARS } from './data/chars.js';
import { BATTLE_TALK } from './data/script.js';
import { MAPS } from './data/maps.js';
import { composeSong, phraseNotes } from './song.js';
import { hash3 } from '../rng.js';
import { maxHp, power, charmFx, gainXp, giveItem, healAll } from './party.js';

const LANE_IDS = ['lyra', 'sera', 'mari', 'ingrid'];

export function startBattle(G, enemyId, opts = {}) {
    const e = ENEMIES[enemyId];
    const diff = DIFF[G.difficulty] || DIFF.normal;
    G.stats.battles = (G.stats.battles || 0) + 1;
    const seed = Math.floor(hash3(G.seed, G.stats.battles, enemyId.length * 97 + enemyId.charCodeAt(0)) * 4294967296);
    const song = composeSong(seed, { bpm: e.bpm, scale: e.scale, lyrics: MAPS[G.map]?.music?.lyrics || 'hope' });
    const spb = song.spb;
    const lanes = LANE_IDS.map((id) => (G.party.members.includes(id) ? id : null));
    const B = {
        enemy: enemyId, name: e.name,
        maxHp: Math.round(e.hp * diff.enemyHp), hp: 0, atk: e.atk * diff.enemyAtk,
        song, spb,
        t: -COUNT_IN_BEATS * spb,
        lanes,
        ph: { kind: 'count', start: -COUNT_IN_BEATS * spb, len: COUNT_IN_BEATS * spb, k: -1 },
        next: null, kc: 0, queue: [],
        notes: [], nid: 1,
        combo: 0, maxCombo: 0,
        counts: { perfect: 0, great: 0, good: 0, miss: 0, block: 0, parry: 0, hurt: 0, total: 0 },
        cres: 0, cresUntil: -1e9, ward: 0, reso: 1,
        holds: [null, null, null, null],
        state: 'run', talk: null, endAt: 0,
        tutorial: !!opts.tutorial, final: !!e.final, boss: !!e.boss,
        stage: e.final ? 'fight' : 'none', colossus: false,
        from: opts.from || 'field', fieldEnemy: opts.fieldEnemy ?? null, opts: { ...opts },
        dealt: 0, encoreUsed: false,
    };
    B.hp = B.maxHp;
    // KO'd princesses get back up for a new fight with a quarter of their HP: the band picks each other up
    for (const m of G.party.members) { const s = G.party.st[m]; if (s.hp <= 0) s.hp = Math.ceil(maxHp(G, m) * 0.25); }
    G.battle = B;
    G.mode = 'battle';
    G.events.push({ type: 'battleStart', enemy: enemyId, boss: B.boss, final: B.final });
    if (B.tutorial) {
        // Otto explains first; the count-in follows the last line
        B.ph = { kind: 'talk:tutorial', start: B.t, len: Infinity, k: -1, talk: 'tutorial' };
        B.queue = ['count'];
        beginTalk(G, B, 'tutorial');
    } else B.next = makeNext(G, B);
    return B;
}

const phraseLen = (B) => PHRASE_BARS * BEATS_PER_BAR * B.spb;
export const memberAt = (B, lane) => B.lanes[lane];
const livingLanes = (G, B) => B.lanes.map((id) => !!id && G.party.st[id].hp > 0);

/** The phrase after the current one, with its notes written now (one phrase is always longer than the note lead). */
function makeNext(G, B) {
    const prev = B.ph;
    let kind = B.queue.length ? B.queue.shift() : prev.kind === 'play' ? 'guard' : prev.kind === 'count' ? 'play' : prev.kind === 'solo' ? 'guard' : 'play';
    const start = prev.start + prev.len;
    if (kind.startsWith('talk:')) return { kind, start, len: Infinity, k: -1, talk: kind.slice(5) };
    if (kind === 'count') return { kind, start, len: BEATS_PER_BAR * B.spb, k: -1 };
    const k = B.kc++;
    const ph = { kind, start, len: phraseLen(B), k };
    const diff = DIFF[G.difficulty] || DIFF.normal;
    let lanes = livingLanes(G, B);
    if (kind === 'solo') lanes = [true, false, false, false];
    const side = kind === 'guard' ? 'guard' : kind === 'solo' ? 'solo' : 'play';
    const list = phraseNotes(B.song, k, { side, lanes, density: diff.density, enemy: ENEMIES[B.enemy], colossus: B.colossus && kind === 'play' });
    for (const n of list) {
        B.notes.push({
            id: B.nid++, t: start + n.beat * B.spb, lane: n.lane, kind: n.kind, len: n.len * B.spb,
            pitch: n.pitch, syl: n.syl || null, drum: n.drum || null, side: kind === 'guard' ? 'enemy' : 'party', j: null, holding: false, done: false,
        });
    }
    B.notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
    return ph;
}

function windowsFor(G, B, lane) {
    const W = WINDOWS[G.difficulty] || WINDOWS.normal;
    const id = lane >= 0 ? B.lanes[lane] : null;
    const k = (id && charmFx(G, id).window) || 1;
    return { perfect: W.perfect * k, great: W.great * k, good: W.good * k };
}
const judgeOf = (d, W) => (d <= W.perfect ? 'perfect' : d <= W.great ? 'great' : 'good');

// ---------------------------------------------------------------- step
/**
 * inp: { lanes: [{ lane, t }] presses, held: [bool × 4], cres: { t } | true, a: bool (talk) }.
 */
export function stepBattle(G, inp, dt) {
    const B = G.battle;
    if (!B) return;
    if (B.state === 'talk') { stepTalk(G, B, inp); return; }
    B.t += dt;
    if (B.state === 'run') {
        for (const p of inp.lanes || []) press(G, B, p.lane, clampT(B, p.t));
        if (inp.cres) cresPress(G, B, clampT(B, inp.cres.t));
        holds(G, B, inp.held || []);
        misses(G, B);
    }
    if ((B.state === 'win' || B.state === 'lose') && B.t >= B.endAt) { finishBattle(G, B.state); return; }
    // the phrase clock
    while (B.state === 'run' && B.t >= B.ph.start + B.ph.len) {
        B.ph = B.next;
        if (B.ph.kind.startsWith('talk:')) { beginTalk(G, B, B.ph.talk); break; }
        B.next = makeNext(G, B);
        G.events.push({ type: 'phrase', kind: B.ph.kind, start: B.ph.start, len: B.ph.len });
        if (B.ph.kind === 'guard') B.reso = Math.max(1, B.reso - 0.12);
    }
    // drop finished notes from the list once they are well behind
    if (B.notes.length > 80) B.notes = B.notes.filter((n) => !(n.j && !n.holding && n.t + n.len < B.t - 2));
}

const clampT = (B, t) => (typeof t === 'number' ? Math.max(B.t - 0.25, Math.min(B.t, t)) : B.t);

function press(G, B, lane, t) {
    if (lane < 0 || lane > 3 || !B.lanes[lane] || G.party.st[B.lanes[lane]].hp <= 0) return;
    if (B.holds[lane]) return;
    const W = windowsFor(G, B, lane);
    let best = null;
    for (const n of B.notes) {
        if (n.lane !== lane || n.j || n.kind === 'colossus') continue;
        const d = t - n.t;
        if (d < -W.good) break;
        if (d > W.good) continue;
        best = n; break;
    }
    G.events.push({ type: 'tap', lane, hit: !!best });
    if (!best) return;
    const j = judgeOf(Math.abs(t - best.t), W);
    best.j = j;
    best.dt = t - best.t;
    if (best.kind === 'hold') { best.holding = true; B.holds[lane] = best; }
    if (best.side === 'party') partyHit(G, B, best, j, best.kind === 'hold' ? 0 : 1);
    else enemyBlock(G, B, best, j, best.kind === 'hold' ? 0 : 1);
}

function holds(G, B, held) {
    for (let lane = 0; lane < 4; lane++) {
        const n = B.holds[lane];
        if (!n) continue;
        const end = n.t + n.len;
        if (B.t >= end || (held[lane] === false && B.t >= end - HOLD_RELEASE_GRACE)) finishHold(G, B, n, 1);
        else if (!held[lane]) finishHold(G, B, n, Math.max(0, (B.t - n.t) / n.len));
    }
}
function finishHold(G, B, n, frac) {
    n.holding = false; n.done = true; B.holds[n.lane] = null;
    if (frac < 1) n.dropped = true;
    G.events.push({ type: 'holdEnd', lane: n.lane, ok: frac >= 1, side: n.side });
    if (n.side === 'party') partyHit(G, B, n, n.j, frac, true);
    else enemyBlock(G, B, n, n.j, frac, true);
}

function misses(G, B) {
    for (const n of B.notes) {
        if (n.j) continue;
        const W = windowsFor(G, B, n.lane);
        if (n.t > B.t) break;
        if (B.t - n.t <= W.good) continue;
        n.j = 'miss'; n.done = true;
        if (n.kind === 'colossus') { G.events.push({ type: 'miss', lane: -1, side: 'party', colossus: true }); continue; }
        B.counts.miss++; B.counts.total++;
        if (n.side === 'party') {
            B.combo = 0;
            G.events.push({ type: 'miss', lane: n.lane, side: 'party' });
        } else {
            enemyHurts(G, B, n, n.kind === 'hold' ? 1.5 : 1);
        }
    }
}

// ---------------------------------------------------------------- effects
const comboMult = (B) => 1 + Math.min(B.combo, COMBO_CAP) / COMBO_CAP;
const cresOn = (B) => B.t < B.cresUntil;

function addCres(G, B, j, lane) {
    const id = B.lanes[lane];
    const k = (id && charmFx(G, id).cres) || 1;
    B.cres = Math.min(100, B.cres + JUDGE[j].cres * CRES.gain * k * (B.tutorial ? 1.6 : 1));
}

/** A party note landed. frac < 1: a hold let go early. `end`: this call finishes a hold. */
function partyHit(G, B, n, j, frac, end = false) {
    const id = B.lanes[n.lane];
    if (!id) return;
    if (!end) {
        B.combo++; B.maxCombo = Math.max(B.maxCombo, B.combo);
        B.counts[j]++; B.counts.total++;
        addCres(G, B, j, n.lane);
        if (j === 'perfect' && charmFx(G, id).leech) heal(G, B, id, charmFx(G, id).leech);
        G.events.push({ type: 'judge', lane: n.lane, j, side: 'party', hold: n.kind === 'hold' && frac === 0, pitch: n.pitch, drum: n.drum, syl: n.syl, noteT: n.t, len: n.len, who: id });
    }
    if (frac <= 0) return;
    const role = CHARS[id].role;
    const R = ROLE[role];
    let dmg = power(G, id) * R.dmg * JUDGE[j].dmg * comboMult(B) * B.reso * (cresOn(B) ? CRES.mult : 1) * frac;
    if (n.kind === 'hold' && role !== 'harmony') dmg *= 1.6;
    if (role === 'melody') {
        const tgt = mostHurt(G, B);
        if (tgt) heal(G, B, tgt, Math.max(1, Math.round(maxHp(G, tgt) * R.heal * JUDGE[j].dmg * frac * (cresOn(B) ? 1.5 : 1))));
    } else if (role === 'lyrics') {
        const cap = Math.round(maxHp(G, id) * 0.6 + WARD_MAX * 0.2);
        B.ward = Math.min(cap, B.ward + power(G, id) * 0.32 * R.ward * JUDGE[j].dmg * frac);
    } else if (role === 'harmony') {
        if (frac >= 1) B.reso = Math.min(RESO_MAX, B.reso + R.reso * JUDGE[j].dmg * 2);
    }
    damageEnemy(G, B, dmg, n.lane, id);
}

function damageEnemy(G, B, dmg, lane, who, big = false) {
    dmg = Math.max(1, Math.round(dmg));
    B.hp -= dmg;
    B.dealt += dmg;
    // the Hush can't be beaten before the Colossus wakes
    if (B.final && B.stage !== 'colossus') B.hp = Math.max(Math.round(B.maxHp * 0.44), B.hp);
    G.events.push({ type: 'hit', lane, dmg, who, cres: cresOn(B), big });
    if (B.final && B.stage === 'fight' && B.hp <= B.maxHp * 0.45) startHush(G, B);
    if (B.hp <= 0 && B.state === 'run') win(G, B);
}

function enemyBlock(G, B, n, j, frac, end = false) {
    const id = B.lanes[n.lane];
    if (!end) {
        B.combo++; B.maxCombo = Math.max(B.maxCombo, B.combo);
        B.counts[j]++; B.counts.total++;
        if (j === 'perfect') B.counts.parry++; else B.counts.block++;
        addCres(G, B, j, n.lane);
        G.events.push({ type: 'judge', lane: n.lane, j, side: 'enemy', hold: n.kind === 'hold' && frac === 0, pitch: n.pitch, noteT: n.t, len: n.len, who: id });
        if (j === 'good' && n.kind !== 'hold') enemyHurts(G, B, n, BLOCK.good, true);
        if (j === 'perfect' && id && n.kind !== 'hold') damageEnemy(G, B, power(G, id) * 0.6 * (cresOn(B) ? CRES.mult : 1), n.lane, id);
        return;
    }
    // a held block that was let go early lets the rest of the roar through
    if (frac < 1) enemyHurts(G, B, n, (1 - frac) * 1.5, true);
    else if (j === 'perfect' && id) damageEnemy(G, B, power(G, id) * 1.2, n.lane, id);
}

function enemyHurts(G, B, n, mult, blocked = false) {
    const id = B.lanes[n.lane];
    if (!id) return;
    const s = G.party.st[id];
    if (s.hp <= 0) return;
    if (!blocked) { B.combo = 0; B.counts.hurt++; }
    let dmg = B.atk * mult * (0.85 + hash3(n.id, B.kc, 5) * 0.3) * (charmFx(G, id).guard || 1);
    dmg = Math.max(1, Math.round(dmg));
    const soak = Math.min(B.ward, dmg);
    B.ward -= soak;
    dmg -= Math.round(soak);
    if (dmg > 0) s.hp -= dmg;
    // the tutorial can't be lost, and in the Hush Lyra never falls
    if ((B.tutorial || (B.final && B.stage === 'hush')) && id === 'lyra') s.hp = Math.max(1, s.hp);
    G.events.push({ type: 'hurt', lane: n.lane, who: id, dmg: Math.max(0, dmg), soak: Math.round(soak), blocked });
    if (s.hp <= 0) ko(G, B, id);
}

function heal(G, B, id, amt) {
    const s = G.party.st[id];
    if (!s || s.hp <= 0) return;
    const mx = maxHp(G, id);
    const before = s.hp;
    s.hp = Math.min(mx, s.hp + amt);
    if (s.hp > before) G.events.push({ type: 'heal', who: id, amt: s.hp - before });
}
function mostHurt(G, B) {
    let best = null, br = 1;
    for (const id of B.lanes) {
        if (!id) continue;
        const s = G.party.st[id];
        if (s.hp <= 0) continue;
        const r = s.hp / maxHp(G, id);
        if (r < br) { br = r; best = id; }
    }
    return best;
}

function ko(G, B, id) {
    const s = G.party.st[id];
    s.hp = 0;
    const lane = CHARS[id].lane;
    // a silenced princess's notes go with her
    B.notes = B.notes.filter((n) => n.lane !== lane || n.j);
    if (B.holds[lane]) { B.holds[lane].holding = false; B.holds[lane] = null; }
    G.events.push({ type: 'ko', who: id, lane });
    if (B.lanes.every((m) => !m || G.party.st[m].hp <= 0)) lose(G, B);
}

function cresPress(G, B, t) {
    // in the last verse the Crescendo key plays the Colossus's golden notes
    if (B.colossus) {
        const W = windowsFor(G, B, -1);
        const n = B.notes.find((x) => x.kind === 'colossus' && !x.j && Math.abs(t - x.t) <= W.good * 1.3);
        if (n) {
            const j = judgeOf(Math.abs(t - n.t), W);
            n.j = j; n.done = true;
            B.combo++; B.maxCombo = Math.max(B.maxCombo, B.combo);
            G.events.push({ type: 'colossusHit', j });
            damageEnemy(G, B, B.maxHp * 0.065 * JUDGE[j].dmg, -1, 'colossus', true);
            return;
        }
    }
    if (B.cres < 100 || cresOn(B)) return;
    B.cres = 0;
    const len = phraseLen(B);
    // the rest of this PLAY phrase and all of the next one
    const inPlay = B.ph.kind === 'play' || B.ph.kind === 'solo';
    const nextPlayEnd = inPlay ? B.ph.start + B.ph.len + len * 2 : B.ph.start + B.ph.len + len;
    B.cresUntil = nextPlayEnd;
    for (const m of G.party.members) {
        const s = G.party.st[m];
        if (s.hp <= 0 && B.lanes.includes(m) && !(B.final && B.stage === 'hush')) { s.hp = Math.ceil(maxHp(G, m) * CRES.revive); G.events.push({ type: 'revive', who: m }); }
        else if (s.hp > 0) heal(G, B, m, Math.round(maxHp(G, m) * 0.15));
    }
    G.events.push({ type: 'crescendo', until: B.cresUntil });
}

// ---------------------------------------------------------------- the end
function win(G, B) {
    B.state = 'win';
    B.endAt = B.t + 2.2;
    for (const n of B.notes) if (!n.j) { n.j = 'gone'; n.done = true; }
    B.holds = [null, null, null, null];
    G.events.push({ type: 'enemyDown', enemy: B.enemy, boss: B.boss, final: B.final });
}
function lose(G, B) {
    if (G.party.items.encore > 0 && !B.encoreUsed) {
        G.party.items.encore--; B.encoreUsed = true;
        for (const m of B.lanes) if (m) { G.party.st[m].hp = Math.ceil(maxHp(G, m) * 0.5); G.events.push({ type: 'revive', who: m }); }
        G.events.push({ type: 'encore' });
        return;
    }
    B.state = 'lose';
    B.endAt = B.t + 2;
    for (const n of B.notes) if (!n.j) { n.j = 'gone'; n.done = true; }
    G.events.push({ type: 'bandDown' });
}

export function accuracy(B) {
    const c = B.counts;
    if (!c.total) return 1;
    return (c.perfect + c.great * 0.8 + c.good * 0.5) / c.total;
}
export function rankOf(B) {
    const a = accuracy(B);
    return a >= 0.95 && !B.counts.hurt ? 'S' : a >= 0.9 ? 'A' : a >= 0.75 ? 'B' : a >= 0.55 ? 'C' : 'D';
}

function finishBattle(G, result) {
    const B = G.battle;
    if (result === 'win') {
        const e = ENEMIES[B.enemy];
        const acc = accuracy(B);
        const xp = Math.round(e.xp * (0.7 + 0.5 * acc));
        const ups = gainXp(G, xp);
        const drops = [];
        for (const [item, p] of Object.entries(e.drop || {})) if (G.rng() < p) { giveItem(G, item); drops.push(item); }
        if (e.charm && !G.party.charms.includes(e.charm)) { giveItem(G, e.charm); drops.push(e.charm); }
        for (const m of G.party.members) { const s = G.party.st[m]; if (s.hp <= 0) s.hp = Math.ceil(maxHp(G, m) * 0.25); }
        G.stats.won = (G.stats.won || 0) + 1;
        G.stats.perfects = (G.stats.perfects || 0) + B.counts.perfect;
        G.stats.bestCombo = Math.max(G.stats.bestCombo || 0, B.maxCombo);
        G.results = { enemy: B.enemy, name: B.name, xp, ups, drops, rank: rankOf(B), acc, counts: { ...B.counts }, maxCombo: B.maxCombo, dealt: B.dealt, boss: B.boss, final: B.final };
        G.mode = 'results';
        G.events.push({ type: 'victory', rank: G.results.rank, boss: B.boss, final: B.final });
    } else {
        G.mode = 'defeat';
        G.events.push({ type: 'defeat' });
    }
}

// ---------------------------------------------------------------- the final battle's script
function startHush(G, B) {
    B.stage = 'hush';
    // the phrase already written next is replaced by the Hush
    const nx = B.next;
    B.notes = B.notes.filter((n) => n.t < nx.start || n.j);
    B.queue = ['count', 'solo', 'talk:otto', 'count', 'solo', 'guard', 'talk:colossus', 'count'];
    B.next = { kind: 'talk:hush', start: nx.start, len: Infinity, k: -1, talk: 'hush' };
    G.events.push({ type: 'hushNear' });
}

function beginTalk(G, B, key) {
    B.state = 'talk';
    B.talk = { key, i: 0 };
    for (let l = 0; l < 4; l++) if (B.holds[l]) { B.holds[l].holding = false; B.holds[l] = null; }
    G.events.push({ type: 'talkStart', key });
    talkLine(G, B);
}
function talkLine(G, B) {
    const line = BATTLE_TALK[B.talk.key][B.talk.i];
    if (!line) return;
    G.events.push({ type: 'talkLine', who: line.who, text: line.text });
    if (line.ko) { const s = G.party.st[line.ko]; if (s) { s.hp = 0; G.events.push({ type: 'ko', who: line.ko, lane: CHARS[line.ko].lane, scripted: true }); } }
    if (line.fx === 'revive') { healAll(G, 1); for (const m of B.lanes) if (m) G.events.push({ type: 'revive', who: m }); B.cres = 100; }
    if (line.fx === 'colossus') { B.colossus = true; B.stage = 'colossus'; }
    if (line.fx) G.events.push({ type: 'fx', name: line.fx });
}
function stepTalk(G, B, inp) {
    if (!inp.a) return;
    B.talk.i++;
    if (B.talk.i < BATTLE_TALK[B.talk.key].length) { talkLine(G, B); return; }
    // back to the song: the talk phrase ends now
    G.events.push({ type: 'talkEnd', key: B.talk.key });
    B.state = 'run';
    B.ph.len = Math.max(0, B.t - B.ph.start);
    B.talk = null;
    B.next = makeNext(G, B);
    if (B.colossus) B.queue = [];
}

/** After the results screen. */
export function endBattle(G) {
    const B = G.battle;
    G.battle = null;
    G.results = null;
    G.safeT = 1.5;
    if (B.from === 'scene') G.mode = 'scene';
    else {
        G.mode = 'field';
        if (B.fieldEnemy != null) { const fe = G.field.enemies.find((x) => x.id === B.fieldEnemy); if (fe) fe.alive = false; }
    }
    G.events.push({ type: 'battleEnd', from: B.from });
}

/** Defeat: 'retry' the same duel at full health, or go back to the last Song Crystal. */
export function afterDefeat(G, choice, warp) {
    const B = G.battle;
    healAll(G, 1);
    if (choice === 'retry') {
        G.battle = null;
        startBattle(G, B.enemy, { ...B.opts, from: B.from, fieldEnemy: B.fieldEnemy });
        return;
    }
    G.battle = null;
    G.scene = null;
    warp(G);
}

/** Back out of a duel with a roaming monster (never a boss): it stays on the map, and the band gets a moment's head start. */
export function retreat(G) {
    const B = G.battle;
    if (!B || B.from !== 'field' || B.boss || G.mode !== 'battle') return false;
    G.battle = null;
    G.mode = 'field';
    G.safeT = 2.5;
    G.events.push({ type: 'battleEnd', from: 'field', retreat: true });
    return true;
}
