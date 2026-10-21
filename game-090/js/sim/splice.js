// Splicing: two daemons go into the Greenhouse, one comes out. The race of the result comes from
// the table in data/fusion.js, its level from the average of the parents', and it can inherit
// skills from them. Pure.

import { DAEMONS, daemonList } from './data/daemons.js';
import { SKILLS } from './data/skills.js';
import { fuseRace, RECIPES, spliceCost } from './data/fusion.js';
import { newDaemon } from './units.js';
import { SKILL_SLOTS } from '../config.js';
import { bondPerk } from './perks.js';

const pool = () => daemonList().filter((d) => !d.boss && !d.special);

/** What would come out? Does not change anything. */
export function splicePreview(G, aUid, bUid) {
    const a = G.stock.find((u) => u.uid === aUid), b = G.stock.find((u) => u.uid === bUid);
    if (!a || !b) return { ok: false, why: 'pick two daemons' };
    if (a.uid === b.uid) return { ok: false, why: 'pick two different daemons' };
    const sa = DAEMONS[a.sp], sb = DAEMONS[b.sp];
    let out = null, recipe = null;
    for (const r of RECIPES) {
        if ((r.in[0] === a.sp && r.in[1] === b.sp) || (r.in[1] === a.sp && r.in[0] === b.sp)) { out = DAEMONS[r.out]; recipe = r; }
    }
    let lv;
    if (!out) {
        const race = fuseRace(sa.race, sb.race);
        const list = pool().filter((d) => d.race === race).sort((x, y) => x.lv - y.lv);
        if (sa.race === sb.race) {
            out = list.find((d) => d.lv > Math.max(a.lv, b.lv));
            if (!out) return { ok: false, why: 'they are already at the top of their line' };
        } else {
            const L = Math.floor((a.lv + b.lv) / 2) + 1;
            out = list.find((d) => d.lv >= L) || list[list.length - 1];
        }
        lv = Math.max(out.lv, 1);
    } else lv = out.lv;
    const cost = Math.round(spliceCost(a.lv, b.lv) * (1 - bondPerk(G, 'maple', 'discount')));
    const base = [...out.skills];
    for (const [l, s] of out.learn) if (l <= lv && !base.includes(s)) base.push(s);
    const inherit = [];
    for (const u of [a, b]) for (const s of u.skills) if (!SKILLS[s].unique && !base.includes(s) && !inherit.includes(s)) inherit.push(s);
    return {
        ok: true, out: out.id, lv, race: out.race, cost, recipe: recipe ? recipe.note : null,
        base, inherit, slots: 2 + bondPerk(G, 'maple', 'extraSkill'), afford: G.scrap >= cost,
    };
}

export function doSplice(G, aUid, bUid, keep = []) {
    const pv = splicePreview(G, aUid, bUid);
    if (!pv.ok) return pv.why;
    if (G.scrap < pv.cost) return 'not enough Scrap';
    const picks = [...new Set(keep)].filter((s) => pv.inherit.includes(s)).slice(0, pv.slots);
    const a = G.stock.find((u) => u.uid === aUid), b = G.stock.find((u) => u.uid === bUid);
    G.scrap -= pv.cost;
    const nu = newDaemon(G, pv.out, pv.lv);
    const room = Math.max(0, SKILL_SLOTS - picks.length);
    nu.skills = [...pv.base.slice(-room), ...picks].slice(-SKILL_SLOTS);
    // pass on half of what the parents were given by Seeds
    for (const k of ['st', 'ma', 'vi', 'ag', 'lu']) nu.mods[k] = Math.floor((a.mods[k] + b.mods[k]) / 2);
    const wasParty = G.party.filter((u) => u === a.uid || u === b.uid).length > 0;
    G.stock = G.stock.filter((u) => u.uid !== a.uid && u.uid !== b.uid);
    G.party = G.party.filter((u) => u !== a.uid && u !== b.uid);
    G.stock.push(nu);
    if (wasParty && G.party.length < 3) G.party.push(nu.uid);
    const dex = G.dex[nu.sp] || (G.dex[nu.sp] = { seen: 0, aff: {}, pers: false, recoded: 0 });
    dex.seen++; dex.recoded = Math.max(1, dex.recoded || 0); dex.pers = true;
    G.events.push({ type: 'splice', uid: nu.uid, sp: nu.sp, from: [a.sp, b.sp], lv: nu.lv });
    return '';
}
