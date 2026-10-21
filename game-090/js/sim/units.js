// Units: the Agent and the daemons they keep. A unit is plain data; calc() derives everything the
// battle needs from it (stats from species growth and level, gear, passives, affinities).

import { DAEMONS, statsAt } from './data/daemons.js';
import { SKILLS } from './data/skills.js';
import { GEAR } from './data/items.js';
import { MAX_LEVEL, SKILL_SLOTS, AGENT_SKILL_SLOTS, xpToNext } from '../config.js';

export const AGENT_G = { balanced: [4.4, 4.4, 4.4, 4.4, 4.4], blade: [5.6, 3.6, 4.6, 4.2, 4.2], mage: [3.4, 5.8, 3.8, 4.4, 4.6], quick: [4.2, 4.2, 3.8, 5.8, 4.6], guard: [4.4, 3.6, 5.8, 3.8, 4.2] };
export const AGENT_LEARN = [[1, 'snapshot'], [1, 'slash'], [3, 'mend'], [5, 'scan'], [8, 'overclock'], [12, 'fortify'], [16, 'pierce'], [22, 'mendplus'], [28, 'dispel'], [34, 'deadeye']];

const LADDER = ['w', '', 'r', 'n'];

let uidSeq = 1;
export const nextUid = (G) => G.uid++;

export function newAgent(name) {
    return { uid: 1, sp: 'agent', name, lv: 1, xp: 0, hp: 0, mp: 0, skills: ['snapshot', 'slash'], mods: { st: 0, ma: 0, vi: 0, ag: 0, lu: 0 }, foc: 'balanced', agent: true };
}

export function newDaemon(G, id, lv = null) {
    const sp = DAEMONS[id];
    const L = lv ?? sp.lv;
    const u = { uid: nextUid(G), sp: id, name: sp.name, lv: L, xp: 0, hp: 0, mp: 0, skills: [], mods: { st: 0, ma: 0, vi: 0, ag: 0, lu: 0 }, recoded: true };
    // the skills it would know at this level
    u.skills = [...sp.skills];
    for (const [sl, sk] of sp.learn) if (sl <= L && !u.skills.includes(sk)) u.skills.push(sk);
    u.skills = u.skills.slice(-SKILL_SLOTS);
    const c = calc(G, u);
    u.hp = c.maxhp; u.mp = c.maxmp;
    return u;
}

/** Everything derived from a unit and (for the Agent) the gear. */
export function calc(G, u) {
    const sp = u.agent ? null : DAEMONS[u.sp];
    let s;
    if (u.agent) {
        const g = AGENT_G[u.foc] || AGENT_G.balanced;
        const k = (u.lv + 4) * 0.5;
        s = { st: Math.round(4 + g[0] * k), ma: Math.round(4 + g[1] * k), vi: Math.round(4 + g[2] * k), ag: Math.round(4 + g[3] * k), lu: Math.round(4 + g[4] * k) };
    } else s = statsAt(sp, u.lv);
    for (const k of ['st', 'ma', 'vi', 'ag', 'lu']) s[k] += u.mods[k];
    const out = { ...s, aff: sp ? { ...sp.aff } : {}, pass: [], gunBonus: 0, critBonus: 0, slots: u.agent ? AGENT_SKILL_SLOTS : SKILL_SLOTS };
    if (u.agent && G) {
        for (const slot of ['blade', 'sidearm', 'coat', 'charm']) {
            const gr = GEAR[G.gear[slot]];
            if (!gr) continue;
            for (const k of ['st', 'ma', 'vi', 'ag', 'lu']) if (gr[k]) out[k] += gr[k];
            if (gr.gun) out.gunBonus += gr.gun;
            if (gr.crit) out.critBonus += gr.crit;
            if (gr.aff) for (const [el, v] of Object.entries(gr.aff)) out.aff[el] = better(out.aff[el], v);
            if (gr.pass) out.pass.push(SKILLS[gr.pass].pass);
        }
    }
    for (const id of u.skills) { const sk = SKILLS[id]; if (sk && sk.kind === 'pass') out.pass.push(sk.pass); }
    // wards step an affinity one rung up the ladder
    for (const p of out.pass) {
        if (p.k !== 'ward') continue;
        const cur = out.aff[p.el];
        if (cur === 'd' || cur === 'p' || cur === 'n') continue;
        const i = LADDER.indexOf(cur || '');
        out.aff[p.el] = LADDER[Math.min(3, i + 1)] || undefined;
        if (!out.aff[p.el]) delete out.aff[p.el];
    }
    const vital = out.pass.filter((p) => p.k === 'vital').reduce((a, p) => a + p.v, 0);
    out.maxhp = Math.round((22 + u.lv * 7.5 + out.vi * 1.4) * (1 + vital));
    out.maxmp = Math.round(10 + u.lv * 2 + out.ma * 0.8);
    return out;
}

function better(cur, v) {
    const a = LADDER.indexOf(cur || ''), b = LADDER.indexOf(v);
    if (cur === 'd' || cur === 'p') return cur;
    return v === 'd' || v === 'p' ? v : LADDER[Math.max(a, b)] || v;
}

export function fullHeal(G, u) { const c = calc(G, u); u.hp = c.maxhp; u.mp = c.maxmp; }

/** Add XP, level up as many times as it earns. Returns the list of levels gained and skills offered. */
export function gainXp(G, u, amount) {
    const out = { levels: [], learn: [] };
    if (u.lv >= MAX_LEVEL) return out;
    u.xp += amount;
    while (u.lv < MAX_LEVEL && u.xp >= xpToNext(u.lv)) {
        u.xp -= xpToNext(u.lv);
        u.lv++;
        out.levels.push(u.lv);
        const before = calc(G, { ...u, lv: u.lv - 1 });
        const c = calc(G, u);
        u.hp = Math.min(c.maxhp, u.hp + (c.maxhp - before.maxhp));
        u.mp = Math.min(c.maxmp, u.mp + (c.maxmp - before.maxmp));
        const table = u.agent ? AGENT_LEARN : (DAEMONS[u.sp].learn || []);
        for (const [sl, sk] of table) if (sl === u.lv && !u.skills.includes(sk)) out.learn.push(sk);
    }
    if (u.lv >= MAX_LEVEL) u.xp = 0;
    return out;
}

/** Offer a new skill: it goes in if there is room, else it waits in G.pendingLearn for the player to choose. */
export function offerSkill(G, u, sk) {
    if (u.skills.includes(sk)) return false;
    const cap = u.agent ? AGENT_SKILL_SLOTS : SKILL_SLOTS;
    if (u.skills.length < cap) { u.skills.push(sk); return true; }
    G.pendingLearn.push({ uid: u.uid, skill: sk });
    return null;
}

export const findUnit = (G, uid) => (G.agent.uid === uid ? G.agent : G.stock.find((u) => u.uid === uid)) || null;
export const partyUnits = (G) => [G.agent, ...G.party.map((uid) => G.stock.find((u) => u.uid === uid)).filter(Boolean)];
