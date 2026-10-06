// The turn-based battle engine. Pure: no DOM, no three.js, no Math.random.
//
// const b = new Battle({ kind, player, foe, rng, bag, ... });
// let evs = b.start();                 // send-out events
// while (!b.over) {
//     if (b.need === 'action') evs = b.choose({ k: 'move', i: 0 });   // or switch / item / spike / run
//     else if (b.need === 'switch') evs = b.choose({ k: 'switch', i: 2 });
// }
// Every call returns the events of what happened, in order. The state is already final when the
// events come back; the view replays them with animations, so events carry the numbers to show
// (hp after each hit, and so on) rather than relying on the current state.

import { SPECIES } from './dex.js';
import { MOVES } from './data/moves.js';
import { ITEMS } from './data/items.js';
import { effAgainst, effText } from './data/types.js';
import { ATMOS, STATUS } from '../config.js';
import { calcStats, name as unitName, xpYield, gainXp } from './unit.js';
import { chooseAction } from './ai.js';

const STAGE_MULT = (n) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));
const ACC_MULT = (n) => (n >= 0 ? (3 + n) / 3 : 3 / (3 - n));
const CRIT_CHANCE = [1 / 24, 1 / 8, 1 / 2, 1];
const FOE_FX = new Set(['st', 'glitch', 'foe', 'siphon']);

function freshStages() { return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0, crit: 0 }; }

export class Battle {
    /**
     * opts.kind: 'wild' | 'trainer'
     * opts.player: { name, units: [unit…], dataLink }
     * opts.foe: { name, units: [unit…], ai: 0 wild · 1 trainer · 2 forgemaster · 3 champion, items: { id: n }, title, lines }
     * opts.rng: RNG (shared state), opts.bag: the player's bag { id: count } (spent in place)
     * opts.dark: true inside stations and wrecks (Lantern Spike), opts.canCatch: false for scripted fights
     */
    constructor(opts) {
        this.kind = opts.kind;
        this.rng = opts.rng;
        this.bag = opts.bag || {};
        this.dark = !!opts.dark;
        this.canCatch = opts.canCatch !== false && opts.kind === 'wild';
        this.canRun = opts.kind === 'wild' && opts.canRun !== false;
        this.side = [this.makeSide(opts.player, 0), this.makeSide(opts.foe, 1)];
        this.atm = null;
        this.turn = 0;
        this.over = false;
        this.result = null;
        this.need = null;
        this.caught = null;
        this.runTries = 0;
        this.ev = [];
        this.part = new Map();          // foe uid -> Set(player unit indices that fought it)
        this.pendingLearn = [];         // [{ uid, move }]
        this.salvage = [];              // materials dug out by scavengers
        this.leveled = new Set();
        this.dataLink = !!(opts.player && opts.player.dataLink);
    }

    makeSide(src, i) {
        return {
            i, name: src.name || (i ? 'Foe' : 'You'), units: src.units, ai: src.ai || 0, items: { ...(src.items || {}) },
            title: src.title || '', active: -1, stages: freshStages(), vol: {}, shards: 0, lastProtect: false,
            spent: 0,
        };
    }

    // ------------------------------------------------------------------ helpers
    act(si) { const s = this.side[si]; return s.units[s.active]; }
    foeOf(si) { return 1 - si; }
    S(u) { return SPECIES[u.sp]; }
    has(u, trait) { return SPECIES[u.sp].traits.includes(trait); }
    mod(u) { return u.mod && ITEMS[u.mod] ? ITEMS[u.mod] : null; }
    nm(si) { const u = this.act(si); return (si ? (this.kind === 'wild' ? 'The wild ' : 'The foe\'s ') : '') + unitName(u); }
    push(e) { this.ev.push(e); return e; }
    msg(text) { this.push({ t: 'msg', text }); }
    snap(si) {
        const u = this.act(si), st = calcStats(u);
        return { side: si, uid: u.uid, sp: u.sp, name: unitName(u), lv: u.lv, hp: u.hp, max: st.hp, st: u.st, gilded: !!u.gilded, xpPct: 0 };
    }
    alive(si) { return this.side[si].units.filter((u) => u.hp > 0); }
    stat(si, s) {
        const u = this.act(si), side = this.side[si];
        let v = calcStats(u)[s];
        if (s !== 'hp') v *= STAGE_MULT(side.stages[s] || 0);
        if (s === 'atk' && this.has(u, 'overbuilt')) v *= 1.5;
        if (s === 'atk' && u.st && this.has(u, 'overdrive')) v *= 1.5;
        if (s === 'spa' && this.atm && this.atm.k === 'smog' && this.has(u, 'smog-lungs')) v *= 1.5;
        if (s === 'spd' && this.atm && this.atm.k === 'dust' && SPECIES[u.sp].types.includes('grit')) v *= 1.5;
        if (s === 'spe') {
            if (u.st === 'shc') v *= 0.5;
            const a = this.atm && this.atm.k;
            if ((a === 'rain' && this.has(u, 'bilge-runner')) || (a === 'dust' && this.has(u, 'sand-skimmer')) ||
                (a === 'heat' && this.has(u, 'heat-rider')) || (a === 'static' && this.has(u, 'storm-rider'))) v *= 2;
        }
        return v;
    }

    // ------------------------------------------------------------------ flow
    start() {
        this.ev = [];
        const f = this.side[1];
        if (this.kind === 'trainer') this.msg(`${f.title ? f.title + ' ' : ''}${f.name} wants to battle!`);
        else this.msg(`A wild ${unitName(f.units[0])} ${SPECIES[f.units[0].sp].stage > 1 ? 'lurches' : 'scuttles'} out of the scrap!`);
        this.sendOut(1, 0, true);
        const first = this.side[0].units.findIndex((u) => u.hp > 0);
        this.sendOut(0, first, true);
        this.entryEffects(1); this.entryEffects(0);
        this.need = 'action';
        return this.flush();
    }

    flush() { const e = this.ev; this.ev = []; return e; }

    sendOut(si, idx, quiet = false) {
        const s = this.side[si];
        s.active = idx;
        s.stages = freshStages();
        s.vol = { justIn: true };
        const u = this.act(si);
        if (si === 1 && this.kind === 'trainer' && !quiet) this.msg(`${s.name} sends out ${unitName(u)}!`);
        if (si === 0) {
            this.msg(`Go, ${unitName(u)}!`);
            for (const fu of this.side[1].units) if (fu.hp > 0 && this.side[1].units[this.side[1].active] === fu) this.markPart(fu);
        }
        if (si === 1 && this.kind === 'trainer' && quiet) this.msg(`${s.name} sends out ${unitName(u)}!`);
        this.push({ t: 'send', ...this.snap(si) });
        if (si === 1) this.markPart(u);
        // Scrap Shards on the incoming side.
        if (s.shards > 0 && !this.has(u, 'hover')) {
            const frac = [0, 1 / 8, 1 / 6, 1 / 4][s.shards];
            this.chip(si, Math.max(1, Math.floor(calcStats(u).hp * frac)), `${unitName(u)} is cut by scrap shards!`);
        }
    }

    markPart(foeUnit) {
        if (!this.part.has(foeUnit.uid)) this.part.set(foeUnit.uid, new Set());
        const pa = this.side[0].active;
        if (pa >= 0 && this.side[0].units[pa].hp > 0) this.part.get(foeUnit.uid).add(pa);
    }

    entryEffects(si) {
        const u = this.act(si);
        if (!u || u.hp <= 0) return;
        const S = SPECIES[u.sp];
        if (this.has(u, 'menacing-grind')) {
            this.push({ t: 'trait', side: si, trait: 'menacing-grind' });
            this.msg(`${this.nm(si)}'s grinding gears rattle the foe!`);
            this.changeStage(1 - si, 'atk', -1, true);
        }
        const setters = { smokestack: 'smog', 'furnace-core': 'heat', cloudseeder: 'rain', 'dust-maker': 'dust', 'storm-coil': 'static' };
        for (const [tr, a] of Object.entries(setters)) if (S.traits.includes(tr)) { this.push({ t: 'trait', side: si, trait: tr }); this.setAtm(a); }
        if (this.has(u, 'event-horizon')) { this.push({ t: 'trait', side: si, trait: 'event-horizon' }); this.msg(`Space bends around ${this.nm(si)}…`); }
    }

    setAtm(k, turns = 5) {
        if (this.atm && this.atm.k === k) { this.atm.n = turns; return false; }
        this.atm = { k, n: turns };
        this.push({ t: 'atm', k });
        this.msg(ATMOS[k].text);
        return true;
    }

    /** Player input. */
    choose(action) {
        this.ev = [];
        if (this.over) return [];
        if (this.need === 'switch') {
            if (action.k !== 'switch') return [];
            const u = this.side[0].units[action.i];
            if (!u || u.hp <= 0) return [];
            this.sendOut(0, action.i);
            this.entryEffects(0);
            this.afterFaintSwitches();
            return this.flush();
        }
        if (this.need !== 'action') return [];
        // Validate.
        if (action.k === 'run' && !this.canRun) { this.msg(this.kind === 'trainer' ? 'There\'s no running from a Circuit battle!' : 'You can\'t run from this one!'); return this.flush(); }
        if (action.k === 'spike' && !this.canCatch) { this.msg(this.kind === 'trainer' ? 'The trainer swats your spike away! Don\'t be a scrap thief!' : 'It can\'t be rebooted.'); return this.flush(); }
        if ((action.k === 'item' || action.k === 'spike') && !(this.bag[action.id] > 0)) return this.flush();
        if (action.k === 'switch') {
            const u = this.side[0].units[action.i];
            if (!u || u.hp <= 0 || action.i === this.side[0].active) return this.flush();
        }
        this.runTurn(action);
        return this.flush();
    }

    runTurn(pAction) {
        this.turn++;
        const actions = [];
        const p = this.side[0], f = this.side[1];
        // Locked-in moves (recharge) override the choice.
        if (p.vol.recharge) pAction = { k: 'move', i: -1, recharge: true };
        actions.push({ si: 0, a: pAction });
        let fa = f.vol.recharge ? { k: 'move', i: -1, recharge: true } : chooseAction(this, 1);
        actions.push({ si: 1, a: fa });
        // Order.
        const prio = (x) => {
            if (x.a.k !== 'move') return 7;
            if (x.a.recharge) return 0;
            const id = this.moveIdFor(x.si, x.a);
            return MOVES[id] ? MOVES[id].pri : 0;
        };
        for (const x of actions) {
            x.p = prio(x);
            x.s = this.stat(x.si, 'spe');
            const m = this.mod(this.act(x.si));
            x.q = m && m.mod === 'quick' && this.rng.next() < 0.2 ? 1 : 0;
            x.r = this.rng.next();
        }
        actions.sort((a, b) => b.p - a.p || b.q - a.q || b.s - a.s || a.r - b.r);
        if (actions[0].q && actions[0].p < 7) this.msg(`${this.nm(actions[0].si)}'s Hair Trigger fires first!`);
        this.moved = [false, false];
        for (const x of actions) {
            if (this.over) break;
            const u = this.act(x.si);
            if (!u || u.hp <= 0) continue;
            this.doAction(x.si, x.a);
            this.moved[x.si] = true;
            if (this.checkFaints()) { if (this.over) return; }
        }
        if (this.over) return;
        this.endTurn();
        if (this.over) return;
        this.checkFaints();
        if (!this.over) this.afterFaintSwitches();
    }

    moveIdFor(si, a) {
        if (a.recharge) return null;
        const u = this.act(si);
        const mv = u.moves[a.i];
        if (!mv) return 'sputter';
        if (u.moves.every((m) => m.pp <= 0)) return 'sputter';
        return mv.id;
    }

    doAction(si, a) {
        switch (a.k) {
            case 'move': this.useMove(si, a); break;
            case 'switch': this.switchOut(si, a.i); break;
            case 'item': this.useItem(si, a.id, a.target); break;
            case 'spike': this.throwSpike(a.id); break;
            case 'run': this.tryRun(); break;
        }
    }

    switchOut(si, idx) {
        const s = this.side[si];
        const u = this.act(si);
        if (u.hp > 0) {
            if (this.has(u, 'hot-swap')) u.hp = Math.min(calcStats(u).hp, u.hp + Math.floor(calcStats(u).hp / 3));
            if (this.has(u, 'auto-reset') && u.st) { u.st = null; u.stT = 0; }
        }
        this.push({ t: 'recall', side: si, name: unitName(u) });
        this.msg(si === 0 ? `${unitName(u)}, come back!` : `${s.name} recalls ${unitName(u)}.`);
        this.sendOut(si, idx);
        this.entryEffects(si);
    }

    tryRun() {
        const ps = this.stat(0, 'spe'), fs = this.stat(1, 'spe');
        this.runTries++;
        const f = Math.floor((ps * 128) / Math.max(1, fs)) + 30 * this.runTries;
        if (f > 255 || this.rng.int(0, 255) < f) {
            this.push({ t: 'run' });
            this.msg('You slip away into the scrap!');
            this.finish('run');
        } else this.msg('Couldn\'t get away!');
    }

    // ------------------------------------------------------------------ items
    useItem(si, id, target) {
        const s = this.side[si];
        const bag = si === 0 ? this.bag : s.items;
        if (!(bag[id] > 0)) return;
        const it = ITEMS[id];
        const tIdx = target === undefined ? s.active : target;
        const u = s.units[tIdx];
        if (!u) return;
        bag[id]--;
        const who = si === 0 ? 'You' : s.name;
        this.push({ t: 'item', side: si, id });
        if (it.boost) {
            this.msg(`${who} used a ${it.name} on ${unitName(this.act(si))}.`);
            this.changeStage(si, it.boost, 2, false);
            return;
        }
        this.msg(`${who} used a ${it.name}${tIdx === s.active ? '' : ` on ${unitName(u)}`}.`);
        const max = calcStats(u).hp;
        if (it.revive) {
            if (u.hp > 0) { this.msg('It had no effect.'); return; }
            u.hp = Math.max(1, Math.floor(max * it.revive));
            this.push({ t: 'revive', side: si, idx: tIdx, hp: u.hp, max });
            this.msg(`${unitName(u)} rattles back to life!`);
            return;
        }
        if (u.hp <= 0) { this.msg('It had no effect.'); return; }
        if (it.heal) {
            const before = u.hp;
            u.hp = Math.min(max, u.hp + it.heal);
            if (tIdx === s.active) this.push({ t: 'heal', side: si, hp: u.hp, max });
            this.msg(`${unitName(u)} recovered ${u.hp - before} Hull.`);
        }
        if (it.cure && u.st && (it.cure === 'all' || it.cure === u.st)) {
            this.msg(`${unitName(u)} is no longer ${STATUS[u.st].name.toLowerCase()}.`);
            u.st = null; u.stT = 0;
            if (tIdx === s.active) this.push({ t: 'status', side: si, st: null });
        }
        if (it.pp) { for (const m of u.moves) m.pp = Math.min(MOVES[m.id].pp, m.pp + it.pp); this.msg(`${unitName(u)}'s techniques are recharged.`); }
    }

    throwSpike(id) {
        this.bag[id]--;
        const it = ITEMS[id];
        const u = this.act(1), S = SPECIES[u.sp];
        const max = calcStats(u).hp;
        let rate = it.rate;
        if (it.vs && S.types.some((t) => it.vs.includes(t))) rate = it.vsRate;
        if (it.firstTurn && this.turn <= 1) rate = it.firstTurn;
        if (it.dark && this.dark) rate = it.dark;
        const stb = u.st === 'pdn' || u.st === 'frz' ? 2 : u.st ? 1.5 : 1;
        const a = (((3 * max - 2 * u.hp) * S.catchRate * rate) / (3 * max)) * stb;
        let shakes = 0, caught = false;
        if (a >= 255 || rate >= 255) { shakes = 4; caught = true; }
        else {
            const bb = 1048560 / Math.sqrt(Math.sqrt(16711680 / Math.max(1, a)));
            for (shakes = 0; shakes < 4; shakes++) if (this.rng.int(0, 65535) >= bb) break;
            caught = shakes >= 4;
        }
        this.push({ t: 'spike', id, shakes: Math.min(3, shakes), caught });
        this.msg(`You threw a ${it.name}!`);
        if (caught) {
            this.msg(`Reboot complete! ${unitName(u)} now answers to you!`);
            this.caught = u;
            this.awardXp(u, true);
            this.finish('caught');
        } else {
            this.msg(['It shook the spike loose instantly!', 'Argh! It almost rebooted!', 'So close! The controller rejected the override!', 'Aargh! The final check failed!'][Math.min(3, shakes)]);
        }
    }

    // ------------------------------------------------------------------ moves
    useMove(si, a) {
        const s = this.side[si], u = this.act(si);
        const ti = 1 - si, tside = this.side[ti];
        if (a.recharge) { s.vol.recharge = false; this.msg(`${this.nm(si)} must cool down!`); return; }
        // Status that stops a turn.
        if (u.st === 'pdn') {
            u.stT--;
            if (u.stT > 0) { this.push({ t: 'statusTick', side: si, st: 'pdn' }); this.msg(`${this.nm(si)} is powered down.`); return; }
            u.st = null; this.push({ t: 'status', side: si, st: null }); this.msg(`${this.nm(si)} reboots and powers up!`);
        }
        let moveId = this.moveIdFor(si, a);
        let mv = MOVES[moveId];
        if (u.st === 'frz') {
            if (mv.type === 'blaze' || this.rng.chance(0.2)) { u.st = null; this.push({ t: 'status', side: si, st: null }); this.msg(`${this.nm(si)}'s gears thaw out!`); }
            else { this.push({ t: 'statusTick', side: si, st: 'frz' }); this.msg(`${this.nm(si)} is seized solid!`); return; }
        }
        if (s.vol.stagger) { s.vol.stagger = false; this.push({ t: 'stagger', side: si }); this.msg(`${this.nm(si)} staggered and couldn't act!`); return; }
        if (u.st === 'shc' && this.rng.chance(0.25)) { this.push({ t: 'statusTick', side: si, st: 'shc' }); this.msg(`${this.nm(si)} is short-circuited! It can't move!`); return; }
        if (s.vol.glitch > 0) {
            s.vol.glitch--;
            if (s.vol.glitch <= 0) { this.msg(`${this.nm(si)}'s systems stabilise.`); }
            else {
                this.msg(`${this.nm(si)} is glitching!`);
                if (this.rng.chance(1 / 3)) {
                    const base = Math.floor(Math.floor((Math.floor((2 * u.lv) / 5 + 2) * 40 * this.stat(si, 'atk')) / this.stat(si, 'def')) / 50) + 2;
                    const dmg = Math.max(1, Math.floor(base * this.rng.range(0.85, 1)));
                    this.msg('It struck itself in confusion!');
                    this.damage(si, dmg, { self: true });
                    return;
                }
            }
        }
        // Spend a charge.
        const slot = u.moves[a.i];
        if (moveId !== 'sputter' && slot) slot.pp = Math.max(0, slot.pp - 1);
        if (moveId === 'sputter') this.msg(`${this.nm(si)} has no charges left!`);
        s.vol.last = moveId;
        this.push({ t: 'move', side: si, move: moveId, mtype: mv.type, cat: mv.cat });
        this.msg(`${this.nm(si)} used ${mv.name}!`);

        const hitsFoe = mv.cat !== 'U' || mv.fx.some((f) => FOE_FX.has(f.k));
        const target = this.act(ti);
        if (hitsFoe && (!target || target.hp <= 0)) { this.msg('But there was no target…'); return; }
        // Protect.
        if (hitsFoe && tside.vol.protect) { this.push({ t: 'protected', side: ti }); this.msg(`${this.nm(ti)} braced behind its plating!`); return; }
        // Accuracy.
        if (hitsFoe && mv.acc > 0) {
            let acc = mv.acc * ACC_MULT((s.stages.acc || 0) - (tside.stages.eva || 0));
            if (this.has(u, 'lens-array')) acc *= 1.3;
            if (this.atm && this.atm.k === 'smog' && !this.S(u).types.includes('toxic') && !this.S(u).types.includes('steam') && !this.has(u, 'smog-lungs')) acc *= 0.85;
            const sure = (this.atm && this.atm.k === 'static' && mv.type === 'volt') || (this.atm && this.atm.k === 'heat' && mv.id === 'furnace-blast');
            if (!sure && this.rng.next() * 100 >= acc) { this.push({ t: 'miss', side: ti }); this.msg(`${this.nm(si)}'s attack missed!`); return; }
        }

        if (mv.cat === 'U') { this.utility(si, mv); return; }

        // --- damaging
        const eff = this.effectiveness(mv, target);
        if (eff.absorb) {
            const max = calcStats(target).hp;
            this.push({ t: 'trait', side: ti, trait: eff.absorb });
            if (target.hp < max) { target.hp = Math.min(max, target.hp + Math.floor(max / 4)); this.push({ t: 'heal', side: ti, hp: target.hp, max }); }
            this.msg(`${this.nm(ti)}'s ${({ 'ground-wire': 'Ground Wire', 'heat-sink': 'Heat Sink', 'bilge-pump': 'Bilge Pump' })[eff.absorb]} soaks it up!`);
            return;
        }
        if (eff.m === 0) { this.push({ t: 'immune', side: ti }); this.msg(`It doesn't affect ${this.nm(ti)}…`); return; }

        const multi = mv.fx.find((f) => f.k === 'multi');
        const nHits = multi ? this.rng.weighted([[2, 35], [3, 35], [4, 15], [5, 15]]) : 1;
        let total = 0, hits = 0;
        for (let h = 0; h < nHits; h++) {
            if (target.hp <= 0) break;
            const { dmg, crit } = this.calcDamage(si, mv, { eff: eff.m });
            const dealt = this.damage(ti, dmg, { eff: eff.m, crit, mtype: mv.type, cat: mv.cat });
            total += dealt; hits++;
            if (crit) this.msg('A critical hit!');
        }
        if (multi) this.msg(`It hit ${hits} time${hits > 1 ? 's' : ''}!`);
        const et = effText(eff.m);
        if (et) this.msg(et);

        // After-effects on the user.
        for (const f of mv.fx) {
            if (f.k === 'recoil' && total > 0 && u.hp > 0) {
                const r = mv.id === 'sputter' ? calcStats(u).hp * f.f : total * f.f;
                this.chip(si, Math.max(1, Math.floor(r)), `${this.nm(si)} is hurt by the recoil!`);
            }
            if (f.k === 'drain' && total > 0 && u.hp > 0) this.healUnit(si, Math.max(1, Math.floor(total * f.f)), `${this.nm(ti)} had its energy siphoned!`);
        }
        if (mv.tags.includes('bite') && this.has(u, 'siphon-fangs') && total > 0 && u.hp > 0) this.healUnit(si, Math.max(1, Math.floor(total / 4)), `${this.nm(si)}'s Siphon Fangs drink deep.`);
        const vc = this.mod(u);
        if (vc && vc.mod === 'orb' && total > 0 && u.hp > 0) this.chip(si, Math.max(1, Math.floor(calcStats(u).hp / 10)), `${this.nm(si)}'s Volatile Core sparks!`);
        // Contact traits.
        if (mv.cat === 'K' && total > 0 && u.hp > 0 && target) this.contact(si, ti);
        // Secondary effects on the target.
        if (target.hp > 0) for (const f of mv.fx) this.secondary(si, ti, f, mv);
        for (const f of mv.fx) if (f.k === 'self' && u.hp > 0 && this.rng.next() * 100 < f.p) this.changeStage(si, f.stat, f.n, false);
        if (mv.fx.some((f) => f.k === 'recharge')) s.vol.recharge = true;
        if (mv.fx.some((f) => f.k === 'boom') && u.hp > 0) { this.msg(`${this.nm(si)} vents its core and shuts down!`); this.damage(si, u.hp, { self: true }); }
        if (target.hp <= 0 && this.has(u, 'momentum-engine') && u.hp > 0) this.changeStage(si, 'atk', 1, false);
    }

    effectiveness(mv, target) {
        const tt = SPECIES[target.sp].types;
        if (mv.id === 'sputter') return { m: 1 };      // typeless, so two walls out of charges still finish
        if (mv.type === 'volt' && this.has(target, 'ground-wire')) return { m: 0, absorb: 'ground-wire' };
        if (mv.type === 'blaze' && this.has(target, 'heat-sink')) return { m: 0, absorb: 'heat-sink' };
        if (mv.type === 'hydro' && this.has(target, 'bilge-pump')) return { m: 0, absorb: 'bilge-pump' };
        if (mv.type === 'grit' && this.has(target, 'hover')) return { m: 0 };
        return { m: effAgainst(mv.type, tt) };
    }

    /** Damage of one hit. Exported logic is reused by the AI (with roll = 0.925 and no crit). */
    calcDamage(si, mv, { eff = null, roll = null, noCrit = false } = {}) {
        const ti = 1 - si;
        const u = this.act(si), t = this.act(ti);
        const us = this.side[si], ts = this.side[ti];
        const S = SPECIES[u.sp];
        if (eff === null) eff = this.effectiveness(mv, t).m;
        if (mv.fx.some((f) => f.k === 'fixed')) return { dmg: u.lv, crit: false };
        let pow = mv.pow;
        if (mv.fx.some((f) => f.k === 'lowhp')) pow = Math.max(20, Math.floor(200 * (1 - u.hp / calcStats(u).hp)));
        const kin = mv.cat === 'K';
        // Critical hit.
        let cs = Math.min(3, (us.stages.crit || 0) + (mv.fx.some((f) => f.k === 'crit') ? 1 : 0) + (this.has(u, 'targeting-optics') ? 1 : 0) + (this.mod(u) && this.mod(u).mod === 'crit' ? 1 : 0));
        const crit = !noCrit && this.rng.next() < CRIT_CHANCE[cs];
        let A = calcStats(u)[kin ? 'atk' : 'spa'], D = calcStats(t)[kin ? 'def' : 'spd'];
        const as = us.stages[kin ? 'atk' : 'spa'], ds = ts.stages[kin ? 'def' : 'spd'];
        A *= STAGE_MULT(crit ? Math.max(0, as) : as);
        D *= STAGE_MULT(crit ? Math.min(0, ds) : ds);
        if (kin && this.has(u, 'overbuilt')) A *= 1.5;
        if (kin && u.st && this.has(u, 'overdrive')) A *= 1.5;
        if (!kin && this.atm && this.atm.k === 'smog' && this.has(u, 'smog-lungs')) A *= 1.5;
        if (!kin && this.atm && this.atm.k === 'dust' && SPECIES[t.sp].types.includes('grit')) D *= 1.5;
        let dmg = Math.floor(Math.floor((Math.floor((2 * u.lv) / 5 + 2) * pow * A) / Math.max(1, D)) / 50) + 2;
        let m = 1;
        if (crit) m *= 1.5;
        m *= roll !== null ? roll : this.rng.range(0.85, 1);
        if (S.types.includes(mv.type)) m *= this.has(u, 'specialist') ? 1.75 : 1.5;
        m *= eff;
        if (kin && u.st === 'ovh' && !this.has(u, 'overdrive')) m *= 0.5;
        const a = this.atm && this.atm.k;
        if (a === 'heat') { if (mv.type === 'blaze') m *= 1.5; if (mv.type === 'hydro') m *= 0.5; }
        if (a === 'rain') { if (mv.type === 'hydro') m *= 1.5; if (mv.type === 'blaze') m *= 0.5; }
        if (a === 'static' && mv.type === 'volt') m *= 1.5;
        if (a === 'smog' && mv.type === 'toxic') m *= 1.3;
        // Attacker traits.
        const frac = u.hp / calcStats(u).hp;
        if (this.has(u, 'redline') && frac < 1 / 3 && S.types.includes(mv.type)) m *= 1.5;
        if (this.has(u, 'hydraulics') && mv.tags.includes('punch')) m *= 1.25;
        if (this.has(u, 'honed-edges') && (mv.tags.includes('saw') || mv.tags.includes('claw'))) m *= 1.25;
        if (this.has(u, 'carbide-bits') && mv.tags.includes('drill')) m *= 1.3;
        if (this.has(u, 'amplifier') && (mv.tags.includes('wave') || mv.type === 'signal')) m *= 1.3;
        if (this.has(u, 'fine-tuning') && pow <= 60) m *= 1.5;
        if (this.has(u, 'second-gear') && this.moved && this.moved[ti]) m *= 1.3;
        // Defender traits.
        if (kin && this.has(t, 'thick-plating')) m *= 0.8;
        if (!kin && this.has(t, 'field-emitter')) m *= 0.8;
        if (eff > 1 && this.has(t, 'damper')) m *= 0.75;
        if (this.has(t, 'shell-plating') && t.hp >= calcStats(t).hp) m *= 0.5;
        // Modules.
        const md = this.mod(u);
        if (md) {
            if (md.boostType === mv.type) m *= 1.2;
            if (md.mod === 'kinetic' && kin) m *= 1.2;
            if (md.mod === 'energy' && !kin) m *= 1.2;
            if (md.mod === 'orb') m *= 1.3;
        }
        dmg = Math.max(1, Math.floor(dmg * m));
        return { dmg, crit };
    }

    /** Apply damage to side ti's active unit. Returns damage dealt. */
    damage(ti, dmg, info = {}) {
        const t = this.act(ti);
        const max = calcStats(t).hp;
        if (!info.self) {
            if (dmg >= t.hp && t.hp >= max) {
                if (this.has(t, 'reinforced')) { dmg = t.hp - 1; this.push({ t: 'trait', side: ti, trait: 'reinforced' }); this.msg(`${this.nm(ti)} held on with its Reinforced frame!`); }
                else if (this.mod(t) && this.mod(t).mod === 'sash') { dmg = t.hp - 1; t.mod = null; this.msg(`${this.nm(ti)}'s Shock Absorber took the blow and broke!`); }
            }
        }
        dmg = Math.min(t.hp, dmg);
        t.hp -= dmg;
        this.push({ t: 'hit', side: ti, dmg, hp: t.hp, max, eff: info.eff ?? 1, crit: !!info.crit, mtype: info.mtype || null, cat: info.cat || null, self: !!info.self });
        // Spare Battery.
        const md = this.mod(t);
        if (t.hp > 0 && md && md.mod === 'berry' && t.hp < max / 2) {
            t.mod = null;
            t.hp = Math.min(max, t.hp + Math.floor(max / 4));
            this.push({ t: 'heal', side: ti, hp: t.hp, max });
            this.msg(`${this.nm(ti)} plugged in its Spare Battery!`);
        }
        return dmg;
    }

    chip(si, dmg, text) {
        const u = this.act(si);
        if (!u || u.hp <= 0) return;
        if (text) this.msg(text);
        dmg = Math.min(u.hp, dmg);
        u.hp -= dmg;
        this.push({ t: 'hit', side: si, dmg, hp: u.hp, max: calcStats(u).hp, eff: 1, crit: false, chip: true });
    }

    healUnit(si, amt, text) {
        const u = this.act(si);
        const max = calcStats(u).hp;
        if (u.hp <= 0 || u.hp >= max) return;
        u.hp = Math.min(max, u.hp + amt);
        this.push({ t: 'heal', side: si, hp: u.hp, max });
        if (text) this.msg(text);
    }

    contact(si, ti) {
        const t = this.act(ti);
        const roll = this.rng.next();
        if (this.has(t, 'static-hull') && roll < 0.3) { this.push({ t: 'trait', side: ti, trait: 'static-hull' }); this.inflict(si, 'shc', `${this.nm(ti)}'s Static Hull zaps back!`); }
        else if (this.has(t, 'hot-plating') && roll < 0.3) { this.push({ t: 'trait', side: ti, trait: 'hot-plating' }); this.inflict(si, 'ovh', `${this.nm(ti)}'s Hot Plating sears!`); }
        else if (this.has(t, 'acid-weep') && roll < 0.3) { this.push({ t: 'trait', side: ti, trait: 'acid-weep' }); this.inflict(si, 'cor', `${this.nm(ti)} weeps acid!`); }
        else if (this.has(t, 'rime-plating') && roll < 0.1) { this.push({ t: 'trait', side: ti, trait: 'rime-plating' }); this.inflict(si, 'frz', `${this.nm(ti)}'s Rime Plating bites with cold!`); }
        if (this.has(t, 'spiked-plating')) this.chip(si, Math.max(1, Math.floor(calcStats(this.act(si)).hp / 8)), `${this.nm(si)} is cut on the spiked plating!`);
    }

    secondary(si, ti, f, mv) {
        const roll = this.rng.next() * 100;
        switch (f.k) {
            case 'st': if (roll < f.p) this.inflict(ti, f.s, null, true); break;
            case 'glitch': if (roll < f.p) this.glitch(ti, true); break;
            case 'stagger': if (roll < f.p && !this.moved[ti] && !this.has(this.act(ti), 'gyro-stabilizer')) this.side[ti].vol.stagger = true; break;
            case 'foe': if (roll < f.p) this.changeStage(ti, f.stat, f.n, true); break;
        }
        void mv;
    }

    canHaveStatus(u, st) {
        const types = SPECIES[u.sp].types;
        if (u.st) return false;
        if (st === 'ovh' && (types.includes('blaze') || this.has(u, 'heat-sink'))) return false;
        if (st === 'cor' && (types.includes('toxic') || types.includes('rust') || this.has(u, 'rustproof'))) return false;
        if (st === 'shc' && (types.includes('volt') || types.includes('grit') || this.has(u, 'insulated'))) return false;
        if (st === 'frz' && (types.includes('frost') || (this.atm && this.atm.k === 'heat'))) return false;
        return true;
    }

    inflict(ti, st, text, quietFail = false) {
        const t = this.act(ti);
        if (!t || t.hp <= 0) return false;
        if (!this.canHaveStatus(t, st)) { if (!quietFail) this.msg(`It didn't affect ${this.nm(ti)}.`); return false; }
        if (text) this.msg(text);
        t.st = st;
        t.stT = st === 'pdn' ? this.rng.int(2, 4) : 0;
        this.push({ t: 'status', side: ti, st });
        this.msg(`${this.nm(ti)} is ${STATUS[st].name.toLowerCase()}!`);
        const md = this.mod(t);
        if (md && md.mod === 'lum') { t.mod = null; t.st = null; t.stT = 0; this.push({ t: 'status', side: ti, st: null }); this.msg(`${this.nm(ti)}'s Reset Fuse blew and cleared it!`); }
        return true;
    }

    glitch(ti, quiet = false) {
        const s = this.side[ti];
        if (s.vol.glitch > 0 || this.has(this.act(ti), 'gyro-stabilizer')) { if (!quiet) this.msg('But it failed!'); return false; }
        s.vol.glitch = this.rng.int(2, 5);
        this.push({ t: 'glitch', side: ti });
        this.msg(`${this.nm(ti)} is glitching!`);
        return true;
    }

    changeStage(si, stat, n, byFoe) {
        const s = this.side[si], u = this.act(si);
        if (!u || u.hp <= 0) return false;
        if (byFoe && n < 0 && this.has(u, 'locked-gauges')) { this.push({ t: 'trait', side: si, trait: 'locked-gauges' }); this.msg(`${this.nm(si)}'s Locked Gauges hold steady!`); return false; }
        if (n > 0 && this.has(this.act(1 - si), 'event-horizon')) { this.msg(`The Event Horizon swallows ${this.nm(si)}'s boost!`); return false; }
        const max = stat === 'crit' ? 3 : 6;
        const before = s.stages[stat] || 0;
        const after = Math.max(-6, Math.min(max, before + n));
        if (after === before) { this.msg(`${this.nm(si)}'s ${statWord(stat)} won't go any ${n > 0 ? 'higher' : 'lower'}!`); return false; }
        s.stages[stat] = after;
        this.push({ t: 'stat', side: si, stat, n: after - before });
        const amt = Math.abs(after - before) >= 2 ? (n > 0 ? 'rose sharply' : 'fell harshly') : (n > 0 ? 'rose' : 'fell');
        this.msg(`${this.nm(si)}'s ${statWord(stat)} ${amt}!`);
        return true;
    }

    utility(si, mv) {
        const s = this.side[si], u = this.act(si), ti = 1 - si;
        let did = false;
        for (const f of mv.fx) {
            switch (f.k) {
                case 'st': did = this.inflict(ti, f.s) || did; break;
                case 'glitch': did = this.glitch(ti) || did; break;
                case 'self': did = this.changeStage(si, f.stat, f.n, false) || did; break;
                case 'foe': did = this.changeStage(ti, f.stat, f.n, true) || did; break;
                case 'heal': {
                    const max = calcStats(u).hp;
                    if (u.hp >= max) { this.msg(`${this.nm(si)}'s Hull is already full!`); break; }
                    this.healUnit(si, Math.floor(max * f.f), `${this.nm(si)} patched itself up.`); did = true; break;
                }
                case 'protect':
                    if (s.lastProtect && this.rng.chance(0.67)) { this.msg('But it failed!'); s.lastProtect = false; break; }
                    s.vol.protect = true; s.protectUsed = true;
                    this.push({ t: 'protect', side: si });
                    this.msg(`${this.nm(si)} braced itself!`); did = true; break;
                case 'atm': did = this.setAtm(f.a) || did; if (!did) this.msg('But the sky didn\'t change!'); break;
                case 'shards': {
                    const ts = this.side[ti];
                    if (ts.shards >= 3) { this.msg('But it failed!'); break; }
                    ts.shards++; this.push({ t: 'shards', side: ti, n: ts.shards });
                    this.msg('Sharp scrap is scattered around the foe!'); did = true; break;
                }
                case 'siphon': {
                    const ts = this.side[ti], t = this.act(ti);
                    if (ts.vol.siphon || SPECIES[t.sp].types.includes('moss')) { this.msg(`It didn't affect ${this.nm(ti)}.`); break; }
                    ts.vol.siphon = true; this.push({ t: 'siphon', side: ti });
                    this.msg(`A siphon seed takes root in ${this.nm(ti)}!`); did = true; break;
                }
                case 'rest': {
                    const max = calcStats(u).hp;
                    if (u.hp >= max && !u.st) { this.msg('But it failed!'); break; }
                    u.hp = max; u.st = 'pdn'; u.stT = 3;
                    this.push({ t: 'heal', side: si, hp: u.hp, max });
                    this.push({ t: 'status', side: si, st: 'pdn' });
                    this.msg(`${this.nm(si)} shut down for a cold restart and came back good as new!`); did = true; break;
                }
                case 'purge':
                    this.side[0].stages = freshStages(); this.side[1].stages = freshStages();
                    this.push({ t: 'purge' });
                    this.msg('Every stat change was vented away!'); did = true; break;
            }
        }
        void did;
    }

    // ------------------------------------------------------------------ end of turn
    endTurn() {
        // Atmosphere.
        if (this.atm) {
            if (this.atm.k === 'dust') {
                for (const si of [0, 1]) {
                    const u = this.act(si);
                    if (!u || u.hp <= 0) continue;
                    const T = SPECIES[u.sp].types;
                    if (T.includes('grit') || T.includes('iron') || T.includes('gear') || this.has(u, 'sand-skimmer') || this.has(u, 'hover')) continue;
                    this.chip(si, Math.max(1, Math.floor(calcStats(u).hp / 16)), `${this.nm(si)} is buffeted by the dust storm!`);
                }
            }
            this.atm.n--;
            if (this.atm.n <= 0) { this.msg(`The ${ATMOS[this.atm.k].name.toLowerCase()} clears.`); this.push({ t: 'atm', k: null }); this.atm = null; }
        }
        for (const si of [0, 1]) {
            const u = this.act(si);
            if (!u || u.hp <= 0) continue;
            const max = calcStats(u).hp;
            if (u.st === 'ovh') this.chip(si, Math.max(1, Math.floor(max / 16)), `${this.nm(si)} is overheating!`);
            else if (u.st === 'cor') this.chip(si, Math.max(1, Math.floor(max / 8)), `${this.nm(si)} is eaten by corrosion!`);
            if (u.hp > 0 && this.side[si].vol.siphon) {
                const amt = Math.max(1, Math.floor(max / 8));
                const before = u.hp;
                this.chip(si, amt, `The siphon seed drains ${this.nm(si)}!`);
                const o = this.act(1 - si);
                if (o && o.hp > 0) this.healUnit(1 - si, before - u.hp, null);
            }
            if (u.hp <= 0) continue;
            if (this.has(u, 'self-repair')) this.healUnit(si, Math.max(1, Math.floor(max / 16)), `${this.nm(si)} repairs itself.`);
            if (this.has(u, 'perpetual')) { this.healUnit(si, Math.max(1, Math.floor(max / 8)), `${this.nm(si)} never stops turning.`); }
            if (this.has(u, 'photosynth-skin') && !this.atm) this.healUnit(si, Math.max(1, Math.floor(max / 16)), `${this.nm(si)} soaks up the light.`);
            const md = this.mod(u);
            if (md && md.mod === 'leftovers') this.healUnit(si, Math.max(1, Math.floor(max / 16)), `${this.nm(si)}'s Solar Coil hums.`);
            if (this.has(u, 'turbo') || this.has(u, 'perpetual')) { if ((this.side[si].stages.spe || 0) < 6) this.changeStage(si, 'spe', 1, false); }
            if (u.st && this.has(u, 'flaking-plates') && this.rng.chance(0.3)) { this.msg(`${this.nm(si)} flakes off its ${STATUS[u.st].name.toLowerCase()} plating!`); u.st = null; u.stT = 0; this.push({ t: 'status', side: si, st: null }); }
        }
        for (const s of this.side) {
            s.lastProtect = !!s.protectUsed;
            s.protectUsed = false;
            s.vol.protect = false;
            s.vol.stagger = false;
            s.vol.justIn = false;
        }
    }

    // ------------------------------------------------------------------ fainting, xp, the end
    /** Handle any fainted actives. Returns true if something fainted. */
    checkFaints() {
        let any = false;
        for (const si of [1, 0]) {
            const s = this.side[si];
            const u = this.act(si);
            if (!u || u.hp > 0 || s.vol.fainted) continue;
            s.vol.fainted = true;
            any = true;
            this.push({ t: 'faint', side: si, name: unitName(u) });
            this.msg(`${this.nm(si)} shut down!`);
            if (si === 1) this.awardXp(u, false);
            else u.sync = Math.max(0, u.sync - 2);
        }
        if (!any) return false;
        if (!this.alive(1).length) { this.winBattle(); return true; }
        if (!this.alive(0).length) { this.loseBattle(); return true; }
        return true;
    }

    /** After a turn: replace fainted actives. The foe replaces immediately; the player chooses. */
    afterFaintSwitches() {
        const f = this.side[1];
        if (f.vol.fainted && !this.over) {
            const next = chooseReplacement(this, 1);
            this.sendOut(1, next);
            this.entryEffects(1);
        }
        const p = this.side[0];
        if (p.vol.fainted && !this.over) { this.need = 'switch'; this.push({ t: 'needSwitch' }); return; }
        this.need = this.over ? null : 'action';
    }

    awardXp(foeUnit, caught) {
        const trainer = this.kind === 'trainer';
        const base = xpYield(foeUnit, trainer);
        const parts = this.part.get(foeUnit.uid) || new Set([this.side[0].active]);
        const units = this.side[0].units;
        units.forEach((u, idx) => {
            if (u.hp <= 0) return;
            let amt = 0;
            if (parts.has(idx)) amt = base;
            else if (this.dataLink) amt = Math.floor(base / 2);
            if (!amt) return;
            if (u.mod === 'learning-chip') amt = Math.floor(amt * 1.5);
            if (caught) amt = Math.floor(amt * 0.5);
            const r = gainXp(u, amt);
            this.push({ t: 'xp', uid: u.uid, idx, amt, name: unitName(u), lv: u.lv, active: idx === this.side[0].active, levels: r.levels.map((l) => l.lv) });
            this.msg(`${unitName(u)} gained ${amt} experience!`);
            for (const l of r.levels) {
                this.leveled.add(u.uid);
                this.push({ t: 'level', uid: u.uid, idx, lv: l.lv, active: idx === this.side[0].active, hp: u.hp, max: calcStats(u).hp });
                this.msg(`${unitName(u)} reached level ${l.lv}!`);
                for (const m of l.learned) { this.push({ t: 'learned', uid: u.uid, move: m }); this.msg(`${unitName(u)} learned ${MOVES[m].name}!`); }
                for (const m of l.pending) this.pendingLearn.push({ uid: u.uid, move: m });
            }
        });
        // Scavenger salvage.
        const lead = units.find((u) => u.hp > 0);
        if (!caught && lead && this.has(lead, 'scavenger') && this.rng.chance(0.3)) this.salvage.push('scav');
    }

    winBattle() {
        const f = this.side[1];
        if (this.kind === 'trainer') this.msg(`You beat ${f.title ? f.title + ' ' : ''}${f.name}!`);
        this.finish('win');
    }
    loseBattle() {
        this.msg('Every one of your COM-bots has shut down…');
        this.finish('lose');
    }
    finish(result) {
        this.over = true;
        this.result = result;
        this.need = null;
        this.push({ t: 'end', result });
    }
}

function statWord(s) { return ({ atk: 'Torque', def: 'Plating', spa: 'Arc', spd: 'Shield', spe: 'Clock', acc: 'accuracy', eva: 'evasion', crit: 'targeting' })[s] || s; }

/** Which bot the AI sends in after a faint: the one with the best matchup. */
export function chooseReplacement(b, si) {
    const s = b.side[si];
    const opp = b.act(1 - si);
    let best = -1, bs = -1e9;
    s.units.forEach((u, i) => {
        if (u.hp <= 0) return;
        let score = u.lv * 2 + (u.hp / calcStats(u).hp) * 20;
        if (opp && s.ai >= 1) {
            const myT = SPECIES[u.sp].types, opT = SPECIES[opp.sp].types;
            let off = 0;
            for (const m of u.moves) { const mv = MOVES[m.id]; if (mv.cat !== 'U') off = Math.max(off, effAgainst(mv.type, opT) * (myT.includes(mv.type) ? 1.5 : 1)); }
            let def = 1;
            for (const t of opT) def = Math.max(def, effAgainst(t, myT));
            score += off * 15 - def * 12;
        }
        if (score > bs) { bs = score; best = i; }
    });
    return best;
}
