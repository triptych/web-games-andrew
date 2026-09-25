// ============================================================
// Turn-based battles. A round: you pick an action, your companion
// and every monster act in speed order, and each monster shows its
// intent for the NEXT round before you choose. Events are returned
// for the UI to animate.
// ============================================================

import { rngFor } from '../core/rng.js';
import { ITEM } from '../data/items.js';
import { elemMult, ELEM_ICON } from '../data/monsters.js';
import { JOBS } from '../data/jobs.js';
import { makeMonster } from '../gen/monsters.js';

export const SKILLS = [
    { id: 'power', name: 'Power Strike', lv: 2, sp: 3, pow: 1.8, target: 'one', desc: '1.8× damage to one foe.' },
    { id: 'whirl', name: 'Whirl', lv: 4, sp: 5, pow: 1.0, target: 'all', desc: 'Hit every foe.' },
    { id: 'bolt', name: 'Glimmer Bolt', lv: 6, sp: 4, pow: 1.6, target: 'one', elem: true, pierce: true, desc: 'Magic bolt: your weapon\'s element (or light). Ignores half DEF.' },
    { id: 'mend', name: 'Mend', lv: 8, sp: 6, heal: 0.4, target: 'self', desc: 'Heal 40% HP and clear burns.' },
    { id: 'starfall', name: 'Starfall', lv: 10, sp: 10, pow: 2.0, target: 'all', light: true, desc: 'Light damage to every foe.' },
];
export const INTENT_ICON = { attack: '⚔', charge: '💢', unleash: '💥', guard: '🛡', elemental: '✦', heal: '✚', debuff: '↯', double: '⚔⚔', summon: '☄', stunned: '💫' };
const BEATER = { leaf: 'ember', storm: 'leaf', frost: 'storm', ember: 'frost', shadow: 'light', light: 'shadow', none: 'light' };

export const CombatMethods = {
    // ------------------------------------------------------------ start
    startBattle(foesSpec, opt = {}) {
        const p = this.p, st = this.stats;
        const r = rngFor(this.s.seed, 'battle', this.day, this.s.stats.steps, this.s.stats.kills);
        const foes = foesSpec.map((f, k) => {
            const m = makeMonster(this.species[f.sp], f.depth ?? 0, k);
            m.ref = 'f' + k;
            return m;
        });
        const allies = [{ ref: 'p', name: p.name, hp: p.hp, maxHp: p.maxHp, sp: p.sp, maxSp: p.maxSp, atk: st.atk, def: st.def, spd: st.spd, elem: st.elem, luck: st.luck, status: {} }];
        if (p.companion && this.s.villagers[p.companion]) {
            const v = this.s.villagers[p.companion];
            const L = v.level + this.hearts(p.companion) / 2;
            allies.push({ ref: 'c', job: p.companion, name: this.people[p.companion].name, hp: Math.round(40 + 12 * L), maxHp: Math.round(40 + 12 * L), atk: Math.round(5 + 2.2 * L), def: Math.round(2 + 1.2 * L), spd: Math.round(5 + 0.8 * L), elem: 'none', status: {}, skill: JOBS[p.companion].skill });
        }
        const B = { foes, allies, round: 1, over: null, boss: !!opt.boss, canFlee: !opt.boss, region: opt.region ?? 1, site: opt.site ?? null, bg: opt.bg ?? 'field', firstStrike: !!opt.firstStrike, seed: r.int(1, 1e9), entity: opt.entity ?? null, log: [] };
        for (const f of foes) f.intent = B.firstStrike ? 'stunned' : this.rollIntent(B, f, r);
        this.rt.battle = B;
        this.emit('battle', B);
        this.sfx(B.boss ? 'boss' : 'encounter');
        return B;
    },
    battleRng(B) { B.seed = (B.seed * 1103515245 + 12345) >>> 0; return rngFor(B.seed, B.round); },

    rollIntent(B, f, r) {
        const hpf = f.hp / f.maxHp;
        if (f.status.charged) return 'unleash';
        switch (f.ai) {
            case 'slime': return r.weighted([['attack', 5], ['guard', 2], ['charge', 2]]);
            case 'brute': return r.weighted([['attack', 6], ['charge', 3]]);
            case 'swift': return r.weighted([['attack', 5], ['double', 4]]);
            case 'healer': { const hurt = B.foes.some(o => o.hp > 0 && o.hp / o.maxHp < 0.6); return hurt && r.chance(0.6) ? 'heal' : r.weighted([['attack', 7], ['elemental', 3]]); }
            case 'guarder': return r.weighted([['attack', 6], ['guard', 3], ['charge', 1]]);
            case 'caster': return r.weighted([['elemental', 5], ['attack', 3], ['debuff', 2]]);
            case 'charger': return r.weighted([['charge', 5], ['attack', 4]]);
            case 'debuff': return r.weighted([['debuff', 4], ['attack', 6]]);
            case 'boss': {
                if (hpf > 0.66) return r.weighted([['attack', 5], ['charge', 3], ['elemental', 2]]);
                if (hpf > 0.33) return B.foes.filter(o => o.hp > 0).length < 2 && r.chance(0.35) ? 'summon' : r.weighted([['attack', 4], ['charge', 3], ['elemental', 3], ['debuff', 2]]);
                return r.weighted([['double', 4], ['elemental', 3], ['charge', 3]]);
            }
        }
        return 'attack';
    },

    // ------------------------------------------------------------ helpers
    alive(list) { return list.filter(x => x.hp > 0); },
    actorByRef(B, ref) { return ref[0] === 'f' ? B.foes[+ref.slice(1)] : B.allies.find(a => a.ref === ref); },
    damage(B, att, def, pow, elem, opt = {}) {
        const r = this.battleRng(B);
        const em = elemMult(elem, def.elem);
        const crit = r.chance(0.06 + (att.luck ?? 0) / 200) ? 1.6 : 1;
        const d = opt.pierce ? def.def * 0.25 : def.def * 0.5;
        let dmg = (att.atk * pow - d) * em * crit * r.range(0.9, 1.1);
        if (def.status.guard) dmg *= 0.5;
        if (def.ref === 'p' && this.s.blessings.includes('guard')) dmg *= 0.9;
        if (att.ref === 'c' && this.s.blessings.includes('companion')) dmg *= 1.25;
        if (att.status.atkUp) dmg *= 1.25;
        if (def.status.defDown) dmg *= 1.25;
        return { dmg: Math.max(1, Math.round(dmg)), crit: crit > 1, weak: em > 1, resist: em < 1 };
    },
    hurt(B, ev, att, tgt, pow, elem, opt = {}) {
        const res = this.damage(B, att, tgt, pow, elem, opt);
        tgt.hp = Math.max(0, tgt.hp - res.dmg);
        ev.push({ t: 'hit', a: att.ref, target: tgt.ref, dmg: res.dmg, crit: res.crit, weak: res.weak, resist: res.resist, elem, skill: opt.skill });
        if (tgt.hp <= 0) ev.push({ t: 'die', target: tgt.ref });
        return res;
    },
    pickFoeTarget(B, ref) {
        const t = ref ? B.foes.find(f => f.ref === ref && f.hp > 0) : null;
        return t ?? this.alive(B.foes)[0];
    },
    pickAllyTarget(B, r) {
        const al = this.alive(B.allies);
        const taunt = al.find(a => a.status.taunt);
        if (taunt) return taunt;
        return al.length > 1 && r.chance(0.35) ? al[1] : al[0];
    },

    // ------------------------------------------------------------ a round
    /** action: {type:'attack'|'skill'|'item'|'guard'|'flee', target?, skill?, id?} */
    battleAct(action) {
        const B = this.rt.battle;
        if (!B || B.over) return [];
        const ev = [];
        const r = this.battleRng(B);
        const P = B.allies[0];
        for (const a of B.allies) { a.status.guard = false; }
        for (const f of B.foes) f.status.guard = false;
        // flee resolves first
        if (action.type === 'flee') {
            if (!B.canFlee) { ev.push({ t: 'text', text: "You can't run from this fight!" }); }
            else {
                const avg = this.alive(B.foes).reduce((s, f) => s + f.spd, 0) / Math.max(1, this.alive(B.foes).length);
                const ch = Math.max(0.25, Math.min(0.95, 0.6 + (P.spd - avg) * 0.05));
                if (r.chance(ch)) { ev.push({ t: 'flee-ok' }); B.over = 'flee'; B.log.push(...ev); return this.finishRound(B, ev); }
                ev.push({ t: 'flee-fail' });
            }
            action = { type: 'none' };
        }
        if (action.type === 'guard') { P.status.guard = true; P.sp = Math.min(P.maxSp, P.sp + 2); ev.push({ t: 'guard', a: 'p' }); }
        // who acts, in order
        const actors = [];
        if (action.type !== 'guard' && action.type !== 'none') actors.push({ who: P, act: action, spd: P.spd + r.range(0, 2) });
        const C = B.allies.find(a => a.ref === 'c' && a.hp > 0);
        if (C) actors.push({ who: C, act: this.companionChoice(B, C, r), spd: C.spd + r.range(0, 2) });
        for (const f of B.foes) if (f.hp > 0) {
            if (f.intent === 'guard') { f.status.guard = true; ev.push({ t: 'guard', a: f.ref }); continue; }
            actors.push({ who: f, act: { type: 'foe', intent: f.intent }, spd: f.spd + r.range(0, 2) });
        }
        actors.sort((a, b) => b.spd - a.spd);
        for (const { who, act } of actors) {
            if (who.hp <= 0 || !this.alive(B.foes).length || B.allies[0].hp <= 0) continue;
            if (who.ref === 'p') this.playerAction(B, act, ev);
            else if (who.ref === 'c') this.companionAction(B, who, act, ev);
            else this.foeAction(B, who, ev);
        }
        return this.finishRound(B, ev);
    },
    finishRound(B, ev) {
        const r = this.battleRng(B);
        // burns tick
        for (const x of [...B.allies, ...B.foes]) {
            if (x.hp > 0 && x.status.burn) {
                const d = Math.max(1, Math.round(x.maxHp * 0.06));
                x.hp = Math.max(1, x.hp - d); ev.push({ t: 'burn', target: x.ref, dmg: d });
                if (--x.status.burn <= 0) delete x.status.burn;
            }
            for (const k of ['atkUp', 'defDown', 'taunt']) if (x.status[k] && --x.status[k] <= 0) delete x.status[k];
        }
        if (!B.over) {
            if (B.allies[0].hp <= 0) B.over = 'lose';
            else if (!this.alive(B.foes).length) B.over = 'win';
        }
        if (!B.over) {
            B.round++;
            B.firstStrike = false;
            for (const f of B.foes) if (f.hp > 0) f.intent = this.rollIntent(B, f, r);
        }
        // mirror HP/SP back to the player record
        this.p.hp = B.allies[0].hp; this.p.sp = B.allies[0].sp;
        B.log.push(...ev);
        if (B.over) this.battleOver(B, ev);
        return ev;
    },
    playerAction(B, act, ev) {
        const P = B.allies[0];
        if (act.type === 'attack') {
            const t = this.pickFoeTarget(B, act.target);
            this.hurt(B, ev, P, t, 1, P.elem);
        } else if (act.type === 'skill') {
            const S = SKILLS.find(s => s.id === act.skill);
            if (!S || P.sp < S.sp || this.p.level < S.lv) { ev.push({ t: 'text', text: 'Not enough SP!' }); return; }
            P.sp -= S.sp;
            ev.push({ t: 'skill', a: 'p', name: S.name });
            if (S.heal) { const amt = Math.round(P.maxHp * S.heal); P.hp = Math.min(P.maxHp, P.hp + amt); delete P.status.burn; ev.push({ t: 'heal', a: 'p', target: 'p', amt }); return; }
            const elem = S.light ? 'light' : S.elem ? (P.elem !== 'none' ? P.elem : 'light') : P.elem;
            const targets = S.target === 'all' ? this.alive(B.foes) : [this.pickFoeTarget(B, act.target)];
            for (const t of targets) if (t && t.hp > 0) this.hurt(B, ev, P, t, S.pow, elem, { pierce: S.pierce, skill: S.id });
        } else if (act.type === 'item') {
            const it = ITEM[act.id];
            if (!it?.food || !this.take(act.id, 1)) { ev.push({ t: 'text', text: "You don't have that." }); return; }
            const f = it.food;
            const mult = act.id === 'tonic' && this.s.blessings.includes('herb') ? 2 : (it.cat === 'dish' && this.s.blessings.includes('cook') ? 1.25 : 1);
            if (f.hp) { const amt = Math.round(f.hp * mult); P.hp = Math.min(P.maxHp, P.hp + amt); ev.push({ t: 'heal', a: 'p', target: 'p', amt, item: it.name }); }
            if (f.sp) { P.sp = Math.min(P.maxSp, P.sp + f.sp); ev.push({ t: 'sp', target: 'p', amt: f.sp }); }
            if (f.en) this.p.energy = Math.min(this.p.maxEnergy, this.p.energy + Math.round(f.en * 0.5));
        }
    },
    companionChoice(B, C, r) {
        const S = C.skill;
        const P = B.allies[0];
        if (S.kind === 'heal' && P.hp / P.maxHp < 0.55) return { type: 'skill' };
        if (B.round % 2 === 0 || S.taunt && B.round === 1) return { type: 'skill' };
        return { type: 'attack' };
    },
    companionAction(B, C, act, ev) {
        const S = C.skill;
        const r = this.battleRng(B);
        const tgt = () => { const al = this.alive(B.foes); return al.sort((a, b) => a.hp - b.hp)[0]; };
        if (act.type === 'attack') { const t = tgt(); if (t) this.hurt(B, ev, C, t, 1, 'none'); return; }
        ev.push({ t: 'skill', a: 'c', name: S.name });
        switch (S.kind) {
            case 'hit': { const t = tgt(); if (!t) return; this.hurt(B, ev, C, t, S.pow, 'none'); if (S.taunt) { C.status.taunt = 2; ev.push({ t: 'text', text: `${C.name} draws the monsters' attention!` }); } if (S.stun && r.chance(0.5) && t.hp > 0) { t.intent = 'stunned'; t.status.charged = false; ev.push({ t: 'text', text: `${t.name} is tangled up!` }); } if (S.gold) { const g = r.int(5, 20); this.p.gold += g; ev.push({ t: 'text', text: `Found ${g} gold!` }); } break; }
            case 'heal': { const al = this.alive(B.allies).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; const amt = Math.round(al.maxHp * S.pow); al.hp = Math.min(al.maxHp, al.hp + amt); if (al.ref === 'p' && S.name === 'Snack Break') { al.sp = Math.min(al.maxSp, al.sp + 3); } ev.push({ t: 'heal', a: 'c', target: al.ref, amt }); break; }
            case 'all': for (const t of this.alive(B.foes)) this.hurt(B, ev, C, t, S.pow, 'none'); break;
            case 'elem': { const t = tgt(); if (t) this.hurt(B, ev, C, t, S.pow, BEATER[t.elem] ?? 'light'); break; }
            case 'buff': { const P = B.allies[0]; P.status.atkUp = 3; ev.push({ t: 'buff', a: 'c', target: 'p', text: 'ATK up!' }); break; }
        }
    },
    foeAction(B, f, ev) {
        const r = this.battleRng(B);
        const intent = f.intent;
        switch (intent) {
            case 'stunned': ev.push({ t: 'text', text: `${f.name} is caught off guard!` }); return;
            case 'attack': { const t = this.pickAllyTarget(B, r); this.hurt(B, ev, f, t, 1, 'none'); return; }
            case 'double': { for (let k = 0; k < 2; k++) { const t = this.pickAllyTarget(B, r); if (t) this.hurt(B, ev, f, t, 0.65, 'none'); } return; }
            case 'charge': f.status.charged = true; ev.push({ t: 'charge', a: f.ref }); return;
            case 'unleash': { f.status.charged = false; const t = this.pickAllyTarget(B, r); this.hurt(B, ev, f, t, 2.2, f.elem); return; }
            case 'elemental': { ev.push({ t: 'cast', a: f.ref, elem: f.elem }); for (const t of this.alive(B.allies)) this.hurt(B, ev, f, t, 0.8, f.elem); return; }
            case 'heal': { const t = this.alive(B.foes).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; const amt = Math.round(Math.min(t.maxHp * 0.25, f.maxHp * 0.5)); t.hp = Math.min(t.maxHp, t.hp + amt); ev.push({ t: 'heal', a: f.ref, target: t.ref, amt }); return; }
            case 'debuff': { const t = this.pickAllyTarget(B, r); if (r.chance(0.5)) { t.status.burn = 3; ev.push({ t: 'debuff', a: f.ref, target: t.ref, text: f.elem === 'frost' ? 'Frostbite!' : f.elem === 'ember' ? 'Burned!' : 'Poisoned!' }); } else { t.status.defDown = 3; ev.push({ t: 'debuff', a: f.ref, target: t.ref, text: 'DEF down!' }); } return; }
            case 'summon': {
                if (B.foes.filter(x => x.hp > 0).length >= 3) { const t = this.pickAllyTarget(B, r); this.hurt(B, ev, f, t, 1, 'none'); return; }
                const sp = r.pick(this.byRegion[B.region]);
                const m = makeMonster(this.species[sp], 0, B.foes.length);
                m.ref = 'f' + B.foes.length; m.intent = 'attack';
                B.foes.push(m);
                ev.push({ t: 'summon', a: f.ref, foe: m.ref, name: m.name });
                return;
            }
        }
    },

    // ------------------------------------------------------------ the end
    battleOver(B, ev) {
        if (B.over === 'win') {
            let xp = 0, gold = 0; const drops = [];
            const r = this.battleRng(B);
            for (const f of B.foes) {
                xp += f.xp; gold += f.gold;
                this.s.stats.kills++; this.s.stats.killsBy[f.species] = (this.s.stats.killsBy[f.species] ?? 0) + 1;
                const n = f.boss ? 3 : r.chance(0.6 + (this.stats.luck ?? 0) / 100) ? 1 : 0;
                if (n) drops.push([f.drop, n]);
                if (!f.boss && r.chance(0.08)) drops.push([r.pick(['tonic', 'mushroom', 'wild_berry', 'coal', 'sap']), 1]);
            }
            if (B.boss) this.s.stats.bossKills++;
            this.p.gold += gold;
            for (const [id, n] of drops) this.give(id, n, true);
            if (this.p.companion) this.villagerXp(this.p.companion, Math.round(xp / 3));
            B.rewards = { xp, gold, drops };
            ev.push({ t: 'win', xp, gold, drops });
            this.gainXp(xp);
        } else if (B.over === 'lose') {
            ev.push({ t: 'lose' });
        }
    },
    /** The UI calls this after the win/lose/flee screen is dismissed. */
    battleDone() {
        const B = this.rt.battle;
        if (!B) return;
        this.rt.battle = null;
        const ent = B.entity;
        if (B.over === 'win') {
            if (ent) this.rt.monsters = this.rt.monsters.filter(m => !B.entities?.includes(m) && m !== ent);
            if (B.boss) this.bossDefeated?.(B);
            this.emit('battle-end', { result: 'win' });
            this.checkStory?.();
        } else if (B.over === 'flee') {
            for (const m of this.rt.monsters) if (B.entities?.includes(m) || m === ent) { m.stun = 2.5; }
            this.rt.cooldown = 0.5;
            this.emit('battle-end', { result: 'flee' });
        } else {
            const lost = this.isResident('herbalist') ? 0 : Math.min(250, Math.floor(this.p.gold * 0.1));
            this.p.gold -= lost;
            this.emit('battle-end', { result: 'lose' });
            this.faint(lost);
        }
    },
};
export { ELEM_ICON };
