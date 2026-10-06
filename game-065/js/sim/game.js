// The whole game state and everything you can do with it. The UI (js/main.js, js/ui/) and the test
// pilot (js/sim/pilot.js) drive the same API:
//
//   game.update(dt, { dir, run, a })    walk and interact (ignored while something is pending)
//   game.pending                        a prompt to answer: say · ask · learn · evolve · evolved ·
//                                       repair · shop · bench · locker · ending
//   game.respond(value)                 answer it
//   game.battle                         the current Battle (js/sim/battle.js), or null
//   game.battleChoose(action) / game.closeBattle()
//   game.craft · buy · sell · useItem · useKit · teach · setMod · swap · deposit · withdraw · build …
//   game.serialize() / new Game(JSON.parse(json))

import { RNG, sub, hashStr } from '../rng.js';
import { MAPS } from './data/maps.js';
import { World, isDigit } from './world.js';
import { Battle } from './battle.js';
import { SPECIES, BY_NAME, canLearnCard } from './dex.js';
import { MOVES } from './data/moves.js';
import { ITEMS, RECIPES, BLUEPRINTS, SHOP_TIERS, CARDS, SALVAGE } from './data/items.js';
import { makeUnit, healFull, maxHp, learnMove, evolutionTarget, evolve, name as unitName, calcStats } from './unit.js';
import { SCRIPTS, CLASSES, LEADERS, LEADER_STORY, ENTER_STORY, OBJECTIVES, rivalTeam, SEAL_NAMES } from './data/story.js';
import { ENCOUNTER_RATE, PARTY_SIZE, LOCKER_SIZE, SYNC_MAX, MAX_MOVES } from '../config.js';

export function newState({ name = 'Rivet', look = {}, seed = 1 } = {}) {
    return {
        v: 1, name, look, seed, rng: { s: (seed >>> 0) || 1 }, uid: 1,
        map: 'home', x: 5, y: 2, dir: 'down',
        party: [], locker: [], bag: {}, cogs: 3000,
        flags: {}, seals: 0, story: -1,
        seen: {}, owned: {}, taken: {}, removed: {}, visited: {},
        lastHeal: { map: 'workshop', x: 7, y: 6 },
        steps: 0, repel: 0, playtime: 0, battles: 0, caught: 0, wrecks: 0, built: 0, evolved: 0,
    };
}

export class Game {
    constructor(state) {
        this.state = state;
        this.rng = new RNG(state.rng);
        this.events = [];
        this.pending = null;
        this.queue = [];
        this.frames = [];
        this.battle = null;
        this.battleSpec = null;
        this.battleEv = [];
        this.waitEnts = false;
        this.world = new World(this, state.map, state.x, state.y, state.dir);
        if (state.story < 0) { state.story = 0; this.runScript(SCRIPTS.intro); }
    }

    // ------------------------------------------------------------------ basics
    emit(e) { this.events.push(e); if (this.events.length > 400) this.events.splice(0, 100); }
    toast(text) { this.emit({ t: 'toast', text }); }
    busy() { return !!(this.pending || this.battle || this.frames.length || this.waitEnts); }
    lead() { return this.state.party.find((u) => u.hp > 0) || this.state.party[0]; }
    nextUid() { return this.state.uid++; }
    has(id) { return (this.state.bag[id] || 0) > 0; }
    give(id, n = 1) { this.state.bag[id] = (this.state.bag[id] || 0) + n; }
    take(id, n = 1) { if ((this.state.bag[id] || 0) < n) return false; this.state.bag[id] -= n; if (this.state.bag[id] <= 0) delete this.state.bag[id]; return true; }

    cond(c) {
        if (!c) return true;
        if (c.startsWith('!')) return !this.cond(c.slice(1));
        const st = this.state;
        let m;
        if ((m = c.match(/^flag:(.+)$/))) return !!st.flags[m[1]];
        if ((m = c.match(/^item:(.+)$/))) return this.has(m[1]);
        if ((m = c.match(/^seals>=(\d+)$/))) return st.seals >= +m[1];
        if ((m = c.match(/^story>=(\d+)$/))) return st.story >= +m[1];
        return false;
    }

    objective() {
        const o = [...OBJECTIVES].reverse().find((x) => x.s <= this.state.story) || OBJECTIVES[0];
        return { text: o.text, goal: o.goal(this.state) };
    }

    markSeen(sp) { this.state.seen[sp] = 1; }
    markOwned(sp) { this.state.seen[sp] = 1; this.state.owned[sp] = 1; }

    /** Add a unit you now own: to the team, or the locker if the team is full. */
    addUnit(u) {
        u.uid = this.nextUid();
        this.markOwned(u.sp);
        if (this.state.party.length < PARTY_SIZE) { this.state.party.push(u); return 'party'; }
        if (this.state.locker.length < LOCKER_SIZE) { this.state.locker.push(u); return 'locker'; }
        return null;
    }

    // ------------------------------------------------------------------ frame update
    update(dt, input = {}) {
        this.state.playtime += dt;
        if (this.battle) return;
        if (this.waitEnts) {
            this.world.updateEnts(dt);
            if (this.world.entsSettled()) { this.waitEnts = false; this.pump(); }
            return;
        }
        if (this.pending || this.frames.length) { this.world.updateEnts(dt); if (!this.pending && this.frames.length) this.pump(); return; }
        if (!this.pending && this.queue.length) { this.pending = this.queue.shift(); return; }
        this.world.update(dt, input);
        if (input.a && !this.busy() && !this.world.player.move) this.interact();
        const p = this.world.player;
        this.state.x = p.x; this.state.y = p.y; this.state.dir = p.dir; this.state.map = this.world.id;
    }

    // ------------------------------------------------------------------ scripts
    runScript(cmds, ctx = {}) {
        if (!cmds || !cmds.length) return;
        this.frames.push({ cmds, i: 0, ctx });
        this.pump();
    }

    pump() {
        let guard = 0;
        while (this.frames.length && !this.pending && !this.battle && !this.waitEnts && guard++ < 500) {
            const f = this.frames[this.frames.length - 1];
            if (f.i >= f.cmds.length) { this.frames.pop(); continue; }
            const c = f.cmds[f.i++];
            this.exec(c, f.ctx);
        }
        if (!this.frames.length && !this.pending && this.queue.length) this.pending = this.queue.shift();
    }

    exec(c, ctx) {
        const st = this.state;
        switch (c[0]) {
            case 'say': this.pending = { type: 'say', who: c[1], text: this.fmt(c[2]) }; break;
            case 'ask': this.pending = { type: 'ask', text: this.fmt(c[1]), opts: ['Yes', 'No'], yes: c[2] || [], no: c[3] || [], ctx }; break;
            case 'give': {
                const it = ITEMS[c[1]];
                this.give(c[1], c[2] || 1);
                this.emit({ t: 'item', id: c[1] });
                this.pending = { type: 'say', who: null, text: `You received ${c[2] > 1 ? c[2] + '× ' : ''}${it.name}!`, item: c[1] };
                break;
            }
            case 'giveBot': {
                const sp = BY_NAME[c[1].toLowerCase()].id;
                const u = makeUnit(this.rng, sp, c[2], { met: { map: this.world.id, lv: c[2] } });
                if (c[3]) u.cal = u.cal.map(() => c[3]);
                const where = this.addUnit(u);
                this.emit({ t: 'gotBot', sp });
                this.pending = { type: 'say', who: null, text: `${unitName(u)} joined your ${where === 'party' ? 'team' : 'locker'}!`, bot: sp };
                break;
            }
            case 'flag': st.flags[c[1]] = c[2]; this.world.refreshVisibility(); break;
            case 'story': st.story = Math.max(st.story, c[1]); this.world.refreshVisibility(); this.emit({ t: 'objective' }); break;
            case 'heal': this.healAll(); break;
            case 'seal': st.seals = Math.max(st.seals, c[1]); this.emit({ t: 'seal', n: c[1] }); this.world.refreshVisibility(); break;
            case 'cogs': st.cogs += c[1]; break;
            case 'if': this.frames.push({ cmds: this.cond(c[1]) ? c[2] : (c[3] || []), i: 0, ctx }); break;
            case 'fx': this.emit({ t: 'fx', name: c[1] }); break;
            case 'music': this.emit({ t: 'music', theme: c[1] }); break;
            case 'battle': this.startTrainer(c[1], ctx.ent || null); break;
            case 'wild': this.startStatic(c[1], c[2], c[3]); break;
            case 'approach': {
                const e = this.world.ents.find((x) => x.key === c[1]);
                if (e && this.world.approach(e)) this.waitEnts = true;
                break;
            }
            case 'faceEnt': { const e = this.world.ents.find((x) => x.key === c[1]); if (e) this.world.faceToPlayer(e); break; }
            case 'ending': this.pending = { type: 'ending' }; this.emit({ t: 'ending' }); break;
            case 'end': this.frames.length = 0; break;
        }
    }

    fmt(t) { return String(t).replace(/\{name\}/g, this.state.name); }

    respond(v) {
        const p = this.pending;
        if (!p) return;
        this.pending = null;
        switch (p.type) {
            case 'ask': this.frames.push({ cmds: v === 0 || v === true ? p.yes : p.no, i: 0, ctx: p.ctx }); break;
            case 'learn': {
                const u = this.unitByUid(p.uid);
                if (u && v !== null && v !== undefined && v >= 0) {
                    const old = u.moves[v] ? MOVES[u.moves[v].id].name : null;
                    learnMove(u, p.move, v);
                    this.queue.unshift({ type: 'say', who: null, text: old ? `1, 2, and… Poof! ${unitName(u)} forgot ${old} and learned ${MOVES[p.move].name}!` : `${unitName(u)} learned ${MOVES[p.move].name}!` });
                } else if (u) this.queue.unshift({ type: 'say', who: null, text: `${unitName(u)} did not learn ${MOVES[p.move].name}.` });
                break;
            }
            case 'evolve': {
                const u = this.unitByUid(p.uid);
                if (u && v) {
                    const r = evolve(u);
                    this.markOwned(u.sp);
                    this.state.evolved++;
                    this.emit({ t: 'evolved', uid: u.uid, from: r.from, to: r.to });
                    const learns = r.pending.map((m) => ({ type: 'learn', uid: u.uid, move: m }));
                    this.queue.unshift({ type: 'evolved', uid: u.uid, ...r }, ...learns);
                } else if (u) {
                    if (p.kit) this.give(p.kit);
                    this.queue.unshift({ type: 'say', who: null, text: `${unitName(u)} stopped evolving.` });
                }
                break;
            }
            case 'repair': this.finishRepair(p, v); break;
        }
        if (!this.pending && this.queue.length) this.pending = this.queue.shift();
        this.pump();
    }

    unitByUid(uid) { return this.state.party.find((u) => u.uid === uid) || this.state.locker.find((u) => u.uid === uid) || null; }

    // ------------------------------------------------------------------ the map
    onStep(hop) {
        const st = this.state;
        st.steps++;
        this.emit({ t: 'step', hop, run: this.world.player.run });
        if (st.repel > 0) { st.repel--; if (st.repel === 0) this.toast('The repeller sputters out.'); }
        if (st.steps % 96 === 0) for (const u of st.party) if (u.hp > 0) u.sync = Math.min(SYNC_MAX, u.sync + 1);
        if (st.steps % 256 === 0) this.checkSyncEvolutions();
    }

    onWarp(mapId, d, x, y) {
        const m = MAPS[mapId];
        const tgt = m.w[d];
        if (!tgt) return;
        const idx = this.world.warpIndex(d, x, y);
        this.enterMap(tgt[0], tgt[1], idx);
    }

    enterMap(id, digit, idx = 0, how = 'warp') {
        const m = MAPS[id];
        const tiles = [];
        for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.rows[y][x] === String(digit)) tiles.push([x, y]);
        const [x, y] = tiles[Math.min(idx, tiles.length - 1)] || [1, 1];
        const dir = y === 0 ? 'down' : y === m.H - 1 ? 'up' : x === 0 ? 'right' : x === m.W - 1 ? 'left' : 'down';
        this.placeAt(id, x, y, dir, how);
    }

    placeAt(id, x, y, dir, how = 'warp') {
        const st = this.state;
        const prev = this.world ? this.world.id : null;
        this.world = new World(this, id, x, y, dir);
        st.map = id; st.x = x; st.y = y; st.dir = dir;
        const first = !st.visited[id];
        st.visited[id] = 1;
        const es = ENTER_STORY[id];
        if (es && st.story === es[0]) { st.story = es[1]; this.emit({ t: 'objective' }); }
        this.world.refreshVisibility();
        this.emit({ t: 'enterMap', id, prev, first, how });
    }

    onTrigger(e) {
        const s = SCRIPTS[e.def.id];
        if (s) this.runScript(s, { ent: e });
    }

    onSpotted(e) {
        this.emit({ t: 'spotted', key: e.key });
        this.runScript([['approach', e.key], ['faceEnt', e.key], ['battle', e.key]], { ent: e });
    }

    onDrift(sludge) {
        const m = this.world.map;
        const table = sludge ? m.encS : m.enc;
        if (!table || !m.lv) return;
        let rate = ENCOUNTER_RATE;
        const lead = this.lead();
        if (lead) {
            const T = SPECIES[lead.sp].traits;
            if (T.includes('glow-lamp') || lead.mod === 'glow-bulb') rate *= 1.6;
            if (T.includes('muffled') || lead.mod === 'muffler') rate *= 0.5;
        }
        if (!this.rng.chance(rate)) return;
        const name = this.rng.weighted(table);
        const sp = BY_NAME[name.toLowerCase()].id;
        const lv = this.rng.int(m.lv[0], m.lv[1]) + (sludge ? 1 : 0);
        if (this.state.repel > 0 && lead && lv < lead.lv) return;
        const u = makeUnit(this.rng, sp, lv, { uid: -this.nextUid() });
        this.startBattle('wild', [u], { kind: 'wild' });
    }

    // ------------------------------------------------------------------ talking to things
    interact() {
        const w = this.world;
        const e = w.facing();
        if (!e) {
            const f = w.facingTile();
            if (f.c === 'X') this.toast(this.has('cutter-torch') ? 'Walk into the fence to cut it.' : 'A chained metal fence. A cutting torch could get through.');
            else if (f.c === 'O') this.toast(this.has('lift-coil') ? 'Walk into the block to lift it.' : 'A huge engine block. You\'d need a magnetic lift to move it.');
            else if (f.c === '~' && !this.has('hover-skiff')) this.toast('Thick, bubbling sludge.');
            return;
        }
        w.faceToPlayer(e);
        this.emit({ t: 'talk', key: e.key });
        const d = e.def, st = this.state;
        const say = (t, who = d.name || null) => ['say', who, t];
        switch (d.k) {
            case 'sign': this.runScript([say(d.text, null)]); break;
            case 'npc': {
                if (d.capsule) return this.capsule(e);
                if (d.script) return this.runScript(SCRIPTS[d.script], { ent: e });
                const lines = Array.isArray(d.say) ? d.say : [d.say];
                this.runScript(lines.map((t) => say(t)));
                break;
            }
            case 'marshal': this.runScript([say(d.say)]); break;
            case 'trainer': {
                if (st.flags[`beat:${e.key}`]) {
                    const L = d.leader ? LEADERS[d.leader] : null;
                    this.runScript([say(L ? (L.after ? L.after[L.after.length - 1] : L.lose) : (d.lose || 'Good battle.'))]);
                } else this.runScript([['battle', e.key]], { ent: e });
                break;
            }
            case 'item': {
                st.taken[e.key] = 1;
                w.refreshVisibility();
                this.runScript([['give', d.item, d.n || 1]]);
                break;
            }
            case 'heap': {
                st.taken[e.key] = 1;
                w.refreshVisibility();
                const got = [];
                for (const [id, n] of d.loot) { if (n > 0) { this.give(id, n); got.push(`${n}× ${ITEMS[id].name}`); } }
                this.emit({ t: 'dig' });
                this.runScript([say(`You dug through the heap and found ${got.join(', ')}!`, null)]);
                break;
            }
            case 'wreck': return this.wreck(e);
            case 'healer': {
                this.runScript([say('Welcome to the Boiler Station! Let me fire up the boilers and patch up your team.', d.name), ['heal'], ['fx', 'heal'], say('All done! Your COM-bots are fighting fit. Come back any time!', d.name)]);
                st.lastHeal = { map: w.id, x: w.player.x, y: w.player.y };
                break;
            }
            case 'locker': this.pending = { type: 'locker' }; break;
            case 'bench': this.pending = { type: 'bench' }; break;
            case 'clerk': this.pending = { type: 'shop', stock: this.shopStock(), cards: this.cardStock(d.cards) }; break;
            case 'titan': this.runScript([say(d.say, null), ['ask', `Approach the ${SPECIES[BY_NAME[d.sp.toLowerCase()].id].name}?`, [['wild', d.sp, d.lv, d.flag]], []]]); break;
        }
    }

    capsule(e) {
        const d = e.def;
        if (!this.state.flags.maTalked) { this.runScript([['say', null, 'A COM-bot on a workbench, still warm from the welder. Better talk to Ma Bellows first.']]); return; }
        const sp = BY_NAME[d.capsule.toLowerCase()];
        const blurb = { Embrit: 'Embrit, the little furnace bot (Blaze)', Bubblet: 'Bubblet, the diving bell (Hydro)', Mossbit: 'Mossbit, the moss-grown seed pod (Moss)' }[d.capsule];
        this.markSeen(sp.id);
        this.runScript([
            ['ask', `Take ${blurb}?`, [
                ['giveBot', d.capsule, 5, 20], ['flag', 'starter', d.capsule], ['flag', 'vexHere', true],
                ['say', 'Ma Bellows', `${d.capsule}! Good choice. Treat it well, and it\'ll grow into something special.`],
                ...SCRIPTS.rival1Intro, ['battle', 'rival1'], ['flag', 'vexHere', false], ...SCRIPTS.rival1Win,
            ], []],
        ], { ent: e });
    }

    healAll() {
        for (const u of this.state.party) healFull(u);
        this.emit({ t: 'healed' });
    }

    // ------------------------------------------------------------------ wrecks (repair)
    wreck(e) {
        const d = e.def;
        const sp = BY_NAME[d.sp.toLowerCase()];
        this.markSeen(sp.id);
        const need = Object.entries(d.mats).filter(([, n]) => n > 0);
        const missing = need.filter(([id, n]) => (this.state.bag[id] || 0) < n);
        const list = need.map(([id, n]) => `${n}× ${ITEMS[id].name}`).join(', ');
        if (missing.length) {
            this.runScript([['say', null, `A dormant ${sp.name}, half-buried in junk. Its core still flickers. To repair it you need: ${list}.`], ['say', null, `You're short of ${missing.map(([id, n]) => `${n - (this.state.bag[id] || 0)}× ${ITEMS[id].name}`).join(', ')}.`]]);
            return;
        }
        this.runScript([['say', null, `A dormant ${sp.name}, half-buried in junk. Its core still flickers.`], ['ask', `Repair it? (${list})`, [['repairStart']], []]], { ent: e });
        // The 'repairStart' command is handled here, after the ask resolves.
        this._repairEnt = e;
    }
    finishRepair(p, quality) {
        const e = p.ent, d = e.def;
        for (const [id, n] of Object.entries(d.mats)) if (n > 0) this.take(id, n);
        const sp = BY_NAME[d.sp.toLowerCase()].id;
        const q = Math.max(0, Math.min(3, quality | 0));
        const floor = [6, 14, 20, 26][q];
        const u = makeUnit(this.rng, sp, d.lv, { met: { map: this.world.id, lv: d.lv, wreck: true } });
        u.cal = u.cal.map((c) => Math.max(c, floor + this.rng.int(0, 31 - floor)));
        u.sync = 120;
        healFull(u);
        this.state.taken[e.key] = 1;
        this.state.wrecks++;
        this.world.refreshVisibility();
        const where = this.addUnit(u);
        this.emit({ t: 'repaired', sp, q });
        this.queue.unshift({ type: 'say', who: null, text: `${['Rough', 'Decent', 'Fine', 'Perfect'][q]} calibration! The ${SPECIES[sp].name} shudders, blinks, and powers up. It joined your ${where === 'party' ? 'team' : 'locker'}!`, bot: sp });
    }

    // ------------------------------------------------------------------ battles
    teamFrom(list, cal, lvBonus = 0) {
        return list.map(([n, lv]) => {
            const S = BY_NAME[n.toLowerCase()];
            if (!S) throw new Error(`unknown bot ${n}`);
            const u = makeUnit(this.rng, S.id, lv + lvBonus, { uid: -this.nextUid(), gilded: false });
            u.cal = u.cal.map(() => cal);
            u.temper = 0;
            return u;
        });
    }

    trainerSpec(key, ent) {
        const st = this.state;
        if (key === 'rival1' || key === 'rival2' || key === 'rival3') {
            const n = +key.slice(-1);
            return { key, name: 'Vex', title: n === 1 ? '' : 'Rival', cls: 'rival', look: 'vex', team: rivalTeam(n, st.flags.starter), ai: n === 1 ? 0 : 1, items: n === 3 ? { 'rivet-kit': 1 } : {}, cogs: [0, 200, 1200, 3500][n], noLoss: n === 1, cal: 12 + n * 4, lose: null };
        }
        const d = ent.def;
        if (d.leader) {
            const L = d.leader === 13 ? { name: 'Vex Coppervane', team: rivalTeam(4, st.flags.starter), items: { 'full-rebuild': 3 }, cogs: 20000, say: null, lose: null } : LEADERS[d.leader];
            const C = CLASSES[d.cls];
            return { key, name: L.name, title: C.title, cls: d.cls, look: d.look, team: L.team, ai: C.ai, items: L.items || {}, cogs: L.cogs, leader: d.leader, say: L.say, lose: L.lose, cal: d.leader >= 9 ? 26 : 18 + d.leader };
        }
        const C = CLASSES[d.cls];
        const maxLv = Math.max(...d.team.map((t) => t[1]));
        return { key, name: d.name, title: C.title, cls: d.cls, look: d.look || null, team: d.team, ai: C.ai, items: d.items || {}, cogs: d.cogs || C.pay * maxLv, say: d.say, lose: d.lose, after: d.after, cal: d.cls === 'veteran' || d.cls === 'exec' || d.cls === 'baron' ? 20 : 10 };
    }

    startTrainer(key, ent) {
        const e = ent && ent.key === key ? ent : this.world.ents.find((x) => x.key === key);
        const spec = this.trainerSpec(key, e);
        spec.ent = e || null;
        // Pre-battle line, then the battle (the 'say' blocks, so queue the battle behind it).
        const intro = key === 'champion' ? SCRIPTS.championIntro : spec.say ? [['say', spec.title ? `${spec.title} ${spec.name}` : spec.name, spec.say]] : [];
        this.frames.push({ cmds: [...intro, ['battleNow', key]], i: 0, ctx: { spec } });
    }

    startStatic(name, lv, flag) {
        const S = BY_NAME[name.toLowerCase()];
        const u = makeUnit(this.rng, S.id, lv, { uid: -this.nextUid() });
        u.cal = u.cal.map((c) => Math.max(c, 20));
        this.startBattle('wild', [u], { kind: 'wild', titan: flag, music: 'titan' });
    }

    startBattle(kind, foeUnits, spec) {
        for (const u of foeUnits) if (kind === 'wild') this.markSeen(u.sp);
        this.state.battles++;
        const C = spec.cls ? CLASSES[spec.cls] : null;
        this.battle = new Battle({
            kind, rng: this.rng, bag: this.state.bag, dark: !!this.world.map.dark,
            player: { name: this.state.name, units: this.state.party, dataLink: this.has('data-link') },
            foe: { name: spec.name || 'Wild', title: spec.title || '', units: foeUnits, ai: kind === 'wild' ? 0 : spec.ai ?? (C ? C.ai : 1), items: spec.items || {} },
            canRun: kind === 'wild',
        });
        this.battleSpec = spec;
        this.battleEv = this.battle.start();
        this.noteSeen(this.battleEv);
        this.emit({ t: 'battleStart', kind, spec: { name: spec.name, title: spec.title, look: spec.look, cls: spec.cls, leader: spec.leader || 0, titan: spec.titan || null, music: spec.music || null } });
    }

    noteSeen(evs) { for (const e of evs) if (e.t === 'send' && e.side === 1) this.markSeen(e.sp); }

    /** Events produced since the battle started (for the view to replay). */
    takeBattleEvents() { const e = this.battleEv; this.battleEv = []; return e; }

    battleChoose(action) {
        if (!this.battle) return [];
        const evs = this.battle.choose(action);
        this.noteSeen(evs);
        if (this.battle.over) this.settleBattle(evs);
        return evs;
    }

    /** Apply a finished battle's results to the state. Adds messages to evs. */
    settleBattle(evs) {
        const b = this.battle, spec = this.battleSpec, st = this.state;
        if (b.settled) return;
        b.settled = true;
        const say = (text) => evs.push({ t: 'msg', text });
        if (b.result === 'caught') {
            const u = b.caught;
            u.met = { map: this.world.id, lv: u.lv };
            u.st = null; u.sync = 70;
            for (const m of u.moves) m.pp = MOVES[m.id].pp;
            const where = this.addUnit(u);
            st.caught++;
            if (where === 'locker') say(`${unitName(u)} was sent to your locker.`);
            if (spec.titan) st.flags[spec.titan] = true;
        }
        if (b.result === 'win') {
            if (b.kind === 'trainer') {
                st.cogs += spec.cogs || 0;
                if (spec.cogs) say(`You got ⚙${spec.cogs} for winning!`);
                st.flags[`beat:${spec.key}`] = true;
            } else {
                // Salvage: a part off the defeated bot.
                const foe = b.side[1].units[0];
                const S = SPECIES[foe.sp];
                const pool = [];
                for (const slot of ['c', 'a', 'b', 'o']) { const k = S.parts[slot]; if (k && SALVAGE[slot][k]) pool.push(SALVAGE[slot][k]); }
                if (S.types.includes('void')) pool.push('void-shard');
                const extra = b.salvage.length;
                const n = (this.rng.chance(0.35) ? 1 : 0) + extra;
                for (let i = 0; i < n && pool.length; i++) {
                    const id = pool[this.rng.int(0, pool.length - 1)];
                    this.give(id);
                    say(`You salvaged ${ITEMS[id].name} from the wreckage!`);
                }
                if (spec.titan) st.flags[spec.titan] = true;
            }
        }
        if (b.result === 'lose') {
            if (spec.noLoss) { say('Your bots are out of action… but Ma Bellows patches them up.'); }
            else {
                const lost = Math.floor(st.cogs / 2);
                st.cogs -= lost;
                say(`You panicked and dropped ⚙${lost}…`);
                say('You hurry back to safety, carrying your shut-down bots…');
            }
        }
        // Prompts after the battle: learning, then evolving.
        for (const pl of b.pendingLearn) this.queue.push({ type: 'learn', uid: pl.uid, move: pl.move });
        for (const u of st.party) {
            if (!b.leveled.has(u.uid) || u.hp <= 0) continue;
            const to = evolutionTarget(u);
            if (to) this.queue.push({ type: 'evolve', uid: u.uid, from: u.sp, to });
        }
        for (const u of st.party) u.sync = Math.min(SYNC_MAX, u.sync + (b.result === 'win' ? 2 : 0));
    }

    /** The view has finished replaying: leave the battle screen. */
    closeBattle() {
        const b = this.battle, spec = this.battleSpec;
        if (!b) return;
        if (!b.settled) this.settleBattle([]);
        this.battle = null;
        this.battleSpec = null;
        this.emit({ t: 'battleEnd', result: b.result });
        if (b.result === 'lose' && !spec.noLoss) {
            this.frames.length = 0;
            this.waitEnts = false;
            this.healAll();
            const h = this.state.lastHeal;
            this.placeAt(h.map, h.x, h.y, 'up', 'blackout');
            this.queue.unshift({ type: 'say', who: null, text: 'Your COM-bots have been restarted. Be more careful out there!' });
            this.pump();
            return;
        }
        if (b.result === 'lose' && spec.noLoss) this.healAll();
        if (b.kind === 'trainer') {
            const post = [];
            const who = spec.title ? `${spec.title} ${spec.name}` : spec.name;
            if (b.result === 'win' && spec.lose) post.push(['say', who, spec.lose]);
            if (b.result === 'win' && spec.leader && spec.leader <= 8) {
                const L = LEADERS[spec.leader];
                post.push(['seal', spec.leader], ['say', null, `You received the ${SEAL_NAMES[spec.leader - 1]}!`]);
                if (L.give) post.push(['give', L.give, 1]);
                if (L.card) post.push(['give', `card-${L.card}`, 1]);
                for (const t of L.after || []) post.push(['say', who, t]);
                const ls = LEADER_STORY[spec.leader];
                if (ls) post.push(['story', ls[1]]);
            }
            if (b.result === 'win' && spec.leader >= 9 && spec.leader <= 12) post.push(['flag', `beat:${spec.key}`, true], ['heal']);
            if (b.result === 'win' && spec.leader === 13) post.push(...SCRIPTS.ending);
            if (b.result === 'win' && spec.after) post.push(['flag', spec.after, true], ...(SCRIPTS[spec.after] || []));
            if (post.length) this.frames.push({ cmds: post, i: 0, ctx: {} });
        }
        this.world.refreshVisibility();
        if (!this.pending && this.queue.length && !this.frames.length) this.pending = this.queue.shift();
        this.pump();
    }

    checkSyncEvolutions() {
        for (const u of this.state.party) {
            const S = SPECIES[u.sp];
            if (S.evolves && S.evolves.k === 'sync' && u.sync >= 220 && !this.queue.some((q) => q.uid === u.uid)) this.queue.push({ type: 'evolve', uid: u.uid, from: u.sp, to: S.evolves.to });
        }
    }

    // ------------------------------------------------------------------ menu actions (outside battle)
    useItem(id, idx) {
        const it = ITEMS[id], u = this.state.party[idx];
        if (!it || !this.has(id)) return { ok: false, msg: 'You have none.' };
        if (it.repel) { this.take(id); this.state.repel = it.repel; return { ok: true, msg: `${it.name} switched on. Weaker wild bots will keep away.` }; }
        if (it.flare) {
            if (this.world.map.kind !== 'dungeon' && this.world.map.kind !== 'route') return { ok: false, msg: 'Better save that for the wilds.' };
            this.take(id);
            const h = this.state.lastHeal;
            this.placeAt(h.map, h.x, h.y, 'up', 'flare');
            return { ok: true, msg: 'The flare arcs into the sky, and you follow it home.' };
        }
        if (!u) return { ok: false, msg: 'Choose a bot.' };
        const max = maxHp(u);
        if (it.revive) {
            if (u.hp > 0) return { ok: false, msg: 'It is not shut down.' };
            this.take(id); u.hp = Math.max(1, Math.floor(max * it.revive)); return { ok: true, msg: `${unitName(u)} rattles back to life!` };
        }
        if (u.hp <= 0) return { ok: false, msg: `${unitName(u)} is shut down. Restart it first.` };
        let did = false; const msgs = [];
        if (it.heal && u.hp < max) { const b = u.hp; u.hp = Math.min(max, u.hp + it.heal); msgs.push(`${unitName(u)} recovered ${u.hp - b} Hull.`); did = true; }
        if (it.cure && u.st && (it.cure === 'all' || it.cure === u.st)) { u.st = null; u.stT = 0; msgs.push(`${unitName(u)} is good as new.`); did = true; }
        if (it.pp) { let any = false; for (const m of u.moves) { const mx = MOVES[m.id].pp; if (m.pp < mx) { m.pp = Math.min(mx, m.pp + it.pp); any = true; } } if (any) { msgs.push(`${unitName(u)}'s techniques are recharged.`); did = true; } }
        if (!did) return { ok: false, msg: 'It would have no effect.' };
        this.take(id);
        return { ok: true, msg: msgs.join(' ') };
    }

    /** Install an evolution kit. Sets pending 'evolve' when it fits. */
    useKit(id, idx) {
        const u = this.state.party[idx];
        if (!u || !this.has(id)) return { ok: false, msg: 'Nothing to install.' };
        const to = evolutionTarget(u, id);
        if (!to) return { ok: false, msg: `The ${ITEMS[id].name} doesn't fit ${unitName(u)}.` };
        this.take(id);
        this.pending = { type: 'evolve', uid: u.uid, from: u.sp, to, kit: id };
        return { ok: true };
    }

    canTeach(cardId, idx) {
        const it = ITEMS[cardId], u = this.state.party[idx];
        return !!(it && u && canLearnCard(u.sp, it.teach) && !u.moves.some((m) => m.id === it.teach));
    }
    /** Teach a program card's technique (cards are reusable). slot = index to replace, or -1 to add. */
    teach(cardId, idx, slot = -1) {
        const it = ITEMS[cardId], u = this.state.party[idx];
        if (!this.has(cardId) || !this.canTeach(cardId, idx)) return { ok: false, msg: 'It can\'t run that card.' };
        if (u.moves.length >= MAX_MOVES && slot < 0) return { ok: false, needSlot: true };
        learnMove(u, it.teach, slot);
        return { ok: true, msg: `${unitName(u)} learned ${MOVES[it.teach].name}!` };
    }

    setMod(idx, id) {
        const u = this.state.party[idx];
        if (!u) return { ok: false };
        if (u.mod) { this.give(u.mod); u.mod = null; }
        if (id) { if (!this.take(id)) return { ok: false, msg: 'You have none.' }; u.mod = id; }
        return { ok: true };
    }

    canCraft(r, times = 1) { return Object.entries(r.mats).every(([id, n]) => (this.state.bag[id] || 0) >= n * times); }
    craft(i, times = 1) {
        const r = RECIPES[i];
        if (!r || !this.canCraft(r, times)) return { ok: false, msg: 'Not enough materials.' };
        for (const [id, n] of Object.entries(r.mats)) this.take(id, n * times);
        this.give(r.out, r.n * times);
        this.emit({ t: 'crafted', id: r.out });
        return { ok: true, msg: `Crafted ${r.n * times}× ${ITEMS[r.out].name}.` };
    }
    canBuild(bp) { const B = BLUEPRINTS[bp]; return !!(B && this.has(bp) && Object.entries(B.mats).every(([id, n]) => (this.state.bag[id] || 0) >= n)); }
    build(bp) {
        if (!this.canBuild(bp)) return { ok: false, msg: 'You\'re missing materials.' };
        const B = BLUEPRINTS[bp];
        for (const [id, n] of Object.entries(B.mats)) this.take(id, n);
        this.take(bp);
        const sp = BY_NAME[B.bot.toLowerCase()].id;
        const u = makeUnit(this.rng, sp, B.lv, { met: { map: this.world.id, lv: B.lv, built: true } });
        u.cal = u.cal.map((c) => Math.max(c, 16));
        u.sync = 140;
        const where = this.addUnit(u);
        this.state.built++;
        this.emit({ t: 'built', sp });
        return { ok: true, msg: `You built a ${SPECIES[sp].name}! It joined your ${where === 'party' ? 'team' : 'locker'}.`, sp };
    }

    shopStock() {
        const out = [];
        for (const t of SHOP_TIERS) if (this.state.seals >= t.seals) out.push(...t.items);
        return out;
    }
    cardStock(kind) {
        if (!kind) return [];
        const list = kind === 'all' ? CARDS : CARDS.slice(0, 22);
        return list.map((m) => `card-${m}`);
    }
    buy(id, n = 1) {
        const it = ITEMS[id];
        const cost = it.price * n;
        if (!it.price || this.state.cogs < cost) return { ok: false, msg: 'You can\'t afford that.' };
        this.state.cogs -= cost;
        this.give(id, n);
        return { ok: true, msg: `Bought ${n}× ${it.name}.` };
    }
    sellPrice(id) { const it = ITEMS[id]; return it.pocket === 'key' || it.pocket === 'card' ? 0 : Math.floor(it.price / 2); }
    sell(id, n = 1) {
        const p = this.sellPrice(id);
        if (!p || (this.state.bag[id] || 0) < n) return { ok: false, msg: 'You can\'t sell that.' };
        this.take(id, n);
        this.state.cogs += p * n;
        return { ok: true, msg: `Sold ${n}× ${ITEMS[id].name} for ⚙${p * n}.` };
    }

    swap(i, j) { const P = this.state.party; if (P[i] && P[j]) [P[i], P[j]] = [P[j], P[i]]; }
    deposit(i) {
        const P = this.state.party;
        if (P.length <= 1 || !P[i]) return { ok: false, msg: 'You need at least one bot with you.' };
        if (P.filter((u, k) => k !== i && u.hp > 0).length === 0) return { ok: false, msg: 'Keep at least one working bot with you.' };
        const [u] = P.splice(i, 1);
        healFull(u);
        this.state.locker.push(u);
        return { ok: true };
    }
    withdraw(j) {
        if (this.state.party.length >= PARTY_SIZE) return { ok: false, msg: 'Your team is full.' };
        const [u] = this.state.locker.splice(j, 1);
        if (!u) return { ok: false };
        this.state.party.push(u);
        return { ok: true };
    }
    release(j) { const L = this.state.locker; if (!L[j]) return { ok: false }; L.splice(j, 1); return { ok: true }; }
    rename(uid, nick) { const u = this.unitByUid(uid); if (u) u.nick = nick && nick.trim() ? nick.trim().slice(0, 12) : null; }

    // ------------------------------------------------------------------ save
    serialize() {
        const p = this.world.player;
        this.state.map = this.world.id; this.state.x = p.x; this.state.y = p.y; this.state.dir = p.dir;
        return JSON.stringify(this.state);
    }
}

// The 'repairStart' and 'battleNow' commands need the Game instance; patch them into exec.
const baseExec = Game.prototype.exec;
Game.prototype.exec = function (c, ctx) {
    if (c[0] === 'repairStart') {
        const e = this._repairEnt;
        if (!e) return;
        const sp = BY_NAME[e.def.sp.toLowerCase()].id;
        this.pending = { type: 'repair', ent: e, sp, lv: e.def.lv };
        return;
    }
    if (c[0] === 'battleNow') {
        const spec = ctx.spec || this.trainerSpec(c[1], this.world.ents.find((x) => x.key === c[1]));
        const team = this.teamFrom(spec.team, spec.cal ?? 10);
        this.startBattle('trainer', team, spec);
        return;
    }
    return baseExec.call(this, c, ctx);
};

export function loadGame(json) {
    const st = JSON.parse(json);
    if (!st || st.v !== 1 || !Array.isArray(st.party)) throw new Error('bad save');
    return new Game(st);
}

export { hashStr, sub, calcStats };
