/* TALEWRIGHT runtime — battle: front-view turn-based battles. Each round the
 * heroes choose Attack / Skill / Item / Guard / Escape, then everyone acts in
 * SPD order. Actions become a queue of timed steps (message, animation,
 * damage numbers), so the maths stays in plain functions the harness can call. */
(window.TW_MODULES = window.TW_MODULES || []).push(['battle', function (TW) {
    'use strict';
    const U = TW.util;
    const { win, text, cursor, bar, img, ListWin, inRect, F } = TW.ui;

    // ── maths (pure) ─────────────────────────────────────────────────────────
    function elemMult(target, element) {
        if (!element || element === 'none' || !target.db) return 1;
        if ((target.db.weak || []).includes(element)) return 1.5;
        if ((target.db.resist || []).includes(element)) return 0.5;
        return 1;
    }
    /** Physical damage. rnd() gives 0..1. Returns { dmg, crit, miss }. */
    function physical(atk, def, rnd, opts) {
        opts = opts || {};
        if (rnd() < 0.04) return { dmg: 0, miss: true };
        let d = (atk * 2 - def) * (0.9 + rnd() * 0.2);
        const crit = rnd() < 0.05;
        if (crit) d *= 2;
        if (opts.guard) d /= 2;
        return { dmg: Math.max(1, Math.round(d)), crit };
    }
    function magical(power, mag, def, rnd, mult, guard) {
        let d = (power + mag * 2 - def / 2) * (0.92 + rnd() * 0.16) * (mult || 1);
        if (guard) d /= 2;
        return Math.max(1, Math.round(d));
    }

    // ── the scene ────────────────────────────────────────────────────────────
    class BattleScene {
        constructor(game, troopId, opts, handle) {
            this.game = game;
            this.opts = opts || {};
            this.handle = handle;
            const st = game.state;
            this.troop = st.troopDb(troopId);
            this.t = 0;
            this.steps = [];
            this.msg = '';
            this.pops = [];
            this.parts = [];
            this.shake = 0;
            this.flash = 0;
            this.tries = 0;
            this.buffs = new Map();
            this.bg = (game.map && game.map.map.battleBg) || 'grass';
            const counts = {};
            const members = (this.troop.members || []).filter((m) => st.enemyDb(m.enemy)).slice(0, 6);
            members.forEach((m) => { counts[m.enemy] = (counts[m.enemy] || 0) + 1; });
            const seen = {};
            this.enemies = members.map((m, i) => {
                const db = st.enemyDb(m.enemy);
                const s = db.stats || {};
                let name = db.name;
                if (counts[m.enemy] > 1) { seen[m.enemy] = (seen[m.enemy] || 0) + 1; name += ' ' + 'ABCDEF'[seen[m.enemy] - 1]; }
                const sprite = TW.sprites.monster(db.look);
                const x = m.x || ((i + 1) * 320) / (members.length + 1);
                const y = Math.min(m.y || 150, 156);
                return { db, name, hp: s.hp || 10, mhp: s.hp || 10, mp: s.mp || 0, stats: s, sprite, x, y, alive: true, fade: 1, hit: 0, isEnemy: true };
            });
            this.party = st.party;
            this.phase = 'start';
            this.prevBgm = game.state.bgm;
            game.bgm(this.troop.music || (game.project.system && game.project.system.battleMusic) || 'battle');
            const names = [...new Set(this.enemies.map((e) => e.db.name))];
            this.say(names.length === 1 && this.enemies.length > 1 ? names[0] + 's appear!' : names.join(', ') + (names.length > 1 ? ' appear!' : ' appears!'), 1.1);
            this.queue(0, () => this.beginRound());
            game.hook('battleStart', { troop: troopId });
            this.intro = 0.6;
        }

        // ── helpers ──
        st() { return this.game.state; }
        rnd() { return this.game.random(); }
        aliveEnemies() { return this.enemies.filter((e) => e.alive); }
        aliveParty() { return this.party.filter((a) => a.hp > 0); }
        buff(u) { let b = this.buffs.get(u); if (!b) { b = { atk: 0, def: 0, guard: false }; this.buffs.set(u, b); } return b; }
        stat(u, k) {
            const base = u.isEnemy ? (u.stats[k] | 0) : this.st().stat(u, k);
            const b = this.buff(u);
            return Math.round(base * (1 + 0.25 * (b[k] || 0)));
        }
        name(u) { return u.name; }
        say(m, dur) { this.queue(dur === undefined ? 0.9 : dur, () => { this.msg = m; }); }
        queue(dur, fn) { this.steps.push({ dur, fn }); }

        // ── rounds ──
        beginRound() {
            for (const u of [...this.party, ...this.enemies]) this.buff(u).guard = false;
            this.actions = [];
            this.actorI = -1;
            this.msg = '';
            this.nextActor(1);
        }
        nextActor(d) {
            let i = this.actorI + d;
            while (i >= 0 && i < this.party.length && this.party[i].hp <= 0) i += d;
            if (i < 0) { i = this.actorI; }
            if (i >= this.party.length) { this.phase = 'exec'; this.commands = null; this.runRound(); return; }
            if (d < 0 && this.actions.length) this.actions.pop();
            this.actorI = i;
            this.phase = 'input';
            this.openCommands();
        }
        openCommands() {
            const a = this.party[this.actorI];
            const items = [{ label: 'Attack' }, { label: 'Skill', enabled: this.st().skillsOf(a).length > 0 }, { label: 'Item', enabled: this.battleItems().length > 0 }, { label: 'Guard' }];
            if (this.actorI === this.firstAlive()) items.push({ label: 'Escape', enabled: this.opts.escape !== false });
            const l = new ListWin(this.game.ui, { x: 8, y: 164, w: 80, h: 70, rows: items.length, rowH: 12, items, tapSelects: true });
            l.onChoose = (it, i) => this.command(i);
            l.onCancel = () => { if (this.actorI > this.firstAlive()) { this.nextActor(-1); } };
            this.commands = l;
            this.sub = null;
            this.target = null;
        }
        firstAlive() { return this.party.findIndex((a) => a.hp > 0); }
        battleItems() { return this.st().inventory().filter((it) => it.kind === 'consumable' && it.battle !== false); }
        command(i) {
            const a = this.party[this.actorI];
            if (i === 0) this.pickTarget('enemy', (t) => this.commit({ kind: 'attack', user: a, target: t }));
            if (i === 1) {
                const st = this.st();
                const skills = st.skillsOf(a).map((id) => st.skillDb(id)).filter(Boolean);
                const l = new ListWin(this.game.ui, { x: 90, y: 100, w: 222, rows: 4, cols: 1, items: skills.map((s) => ({ label: s.name, right: s.mp + ' MP', skill: s, enabled: a.mp >= s.mp })) });
                l.onCancel = () => { this.sub = null; };
                l.onMove = (r) => { this.msg = r ? TW.menus.describeSkill(r.skill) : ''; };
                l.onMove(l.items[0]);
                l.onChoose = (r) => {
                    const s = r.skill;
                    const go = (t) => this.commit({ kind: 'skill', user: a, skill: s, target: t });
                    if (s.scope === 'enemy') this.pickTarget('enemy', go);
                    else if (s.scope === 'ally') this.pickTarget(s.kind === 'revive' ? 'dead' : 'ally', go);
                    else go(null);
                };
                this.sub = l;
            }
            if (i === 2) {
                const st = this.st();
                const l = new ListWin(this.game.ui, { x: 90, y: 100, w: 222, rows: 4, items: this.battleItems().map((it) => ({ label: it.name, right: '×' + st.count(it.id), item: it, iconCanvas: TW.sprites.icon(it.icon || 'potion') })) });
                l.onCancel = () => { this.sub = null; };
                l.onMove = (r) => { this.msg = r ? r.item.desc || '' : ''; };
                l.onMove(l.items[0]);
                l.onChoose = (r) => {
                    const it = r.item;
                    const go = (t) => this.commit({ kind: 'item', user: a, item: it, target: t });
                    if (it.dmg) { if (it.scope === 'all') go(null); else this.pickTarget('enemy', go); }
                    else if (it.scope === 'all') go(null);
                    else this.pickTarget(it.revive ? 'dead' : 'ally', go);
                };
                this.sub = l;
            }
            if (i === 3) this.commit({ kind: 'guard', user: a });
            if (i === 4) { this.commands = null; this.sub = null; this.phase = 'exec'; this.escape(); }
        }
        pickTarget(kind, done) {
            const pool = kind === 'enemy' ? this.aliveEnemies() : kind === 'dead' ? this.party.filter((a) => a.hp <= 0) : this.aliveParty();
            if (!pool.length) { this.game.sfx('buzzer'); return; }
            this.target = { kind, pool, i: 0, done };
            if (kind !== 'enemy') { const me = pool.indexOf(this.party[this.actorI]); if (me >= 0) this.target.i = me; }
        }
        commit(action) {
            this.actions.push(action);
            this.target = null; this.sub = null;
            if (action.kind === 'item') action.reserved = true;
            this.nextActor(1);
        }

        runRound() {
            const st = this.st();
            // enemies choose
            for (const e of this.aliveEnemies()) {
                const skills = (e.db.skills || []).map((id) => st.skillDb(id)).filter((s) => s && e.mp >= s.mp);
                if (skills.length && this.rnd() < 0.4) {
                    const s = skills[(this.rnd() * skills.length) | 0];
                    this.actions.push({ kind: 'skill', user: e, skill: s, target: null });
                } else this.actions.push({ kind: 'attack', user: e, target: null });
            }
            for (const a of this.actions) a.order = this.stat(a.user, 'spd') * (0.85 + this.rnd() * 0.3) + (a.kind === 'guard' ? 999 : 0);
            this.actions.sort((x, y) => y.order - x.order);
            for (const a of this.actions) this.queue(0, () => this.perform(a));
            this.queue(0, () => this.endRound());
        }

        endRound() {
            if (this.checkEnd()) return;
            this.beginRound();
        }

        /** Insert steps for an action right after the current step. */
        insert(list) { this.steps.unshift(...list); }

        perform(a) {
            const st = this.st(), u = a.user;
            if (u.isEnemy ? !u.alive : u.hp <= 0) return;
            if (this.over || !this.aliveEnemies().length || !this.aliveParty().length) return;
            const out = [];
            const S = (dur, fn) => out.push({ dur, fn });
            const foes = (x) => (x.isEnemy ? this.aliveParty() : this.aliveEnemies());
            const friends = (x) => (x.isEnemy ? this.aliveEnemies() : this.aliveParty());
            const pick = (pool) => pool[(this.rnd() * pool.length) | 0];
            const valid = (t) => t && (t.isEnemy ? t.alive : t.hp > 0);

            if (a.kind === 'guard') {
                this.buff(u).guard = true;
                S(0.6, () => { this.msg = u.name + ' is guarding.'; });
            } else if (a.kind === 'attack') {
                let t = valid(a.target) ? a.target : pick(foes(u));
                if (!t) return;
                S(0.35, () => { this.msg = u.name + ' attacks!'; this.game.sfx('slash'); this.anim(t, 'slash'); });
                S(0.55, () => {
                    if (!valid(t)) t = pick(foes(u));
                    if (!t) return;
                    const r = physical(this.stat(u, 'atk'), this.stat(t, 'def'), () => this.rnd(), { guard: this.buff(t).guard });
                    if (r.miss) { this.pop(t, 'Miss', '#c8c8d8'); this.game.sfx('miss'); this.msg = u.name + ' misses!'; return; }
                    this.damage(t, r.dmg, r.crit);
                    if (r.crit) this.msg = 'A critical hit!';
                });
            } else if (a.kind === 'skill') {
                const s = a.skill;
                if (u.mp < s.mp) { S(0.6, () => { this.msg = u.name + ' has too little MP!'; }); this.insert(out); return; }
                const targets = () => {
                    if (s.scope === 'self') return [u];
                    if (s.scope === 'allEnemies') return foes(u);
                    if (s.scope === 'allAllies') return s.kind === 'revive' ? (u.isEnemy ? this.enemies.filter((e) => !e.alive) : this.party) : friends(u);
                    if (s.scope === 'ally') { if (valid(a.target) || (s.kind === 'revive' && a.target)) return [a.target]; return u.isEnemy ? [pick(friends(u))] : [u]; }
                    return [valid(a.target) ? a.target : pick(foes(u))];
                };
                S(0.5, () => {
                    u.mp -= s.mp;
                    this.msg = u.name + ' uses ' + s.name + '!';
                    const ts = targets().filter(Boolean);
                    for (const t of ts) this.anim(t, s.anim || animFor(s));
                    this.game.sfx(sfxFor(s));
                });
                S(0.6, () => {
                    const ts = targets().filter(Boolean);
                    for (const t of ts) this.applySkill(u, s, t);
                });
            } else if (a.kind === 'item') {
                const it = a.item;
                if (st.count(it.id) <= 0) { S(0.6, () => { this.msg = 'There are no ' + it.name + 's left!'; }); this.insert(out); return; }
                S(0.5, () => {
                    st.gainItem(it.id, -1);
                    this.msg = u.name + ' uses ' + it.name + '!';
                    this.game.hook('useItem', { id: it.id });
                });
                S(0.6, () => {
                    let ts;
                    if (it.dmg) ts = it.scope === 'all' ? this.aliveEnemies() : [valid(a.target) ? a.target : pick(this.aliveEnemies())];
                    else ts = it.scope === 'all' ? (it.revive ? this.party : this.aliveParty()) : [a.target || u];
                    for (const t of ts.filter(Boolean)) {
                        if (it.dmg) { this.anim(t, it.element && it.element !== 'none' ? it.element : 'hit'); this.damage(t, Math.max(1, Math.round((it.dmg | 0) * elemMult(t, it.element) * (0.92 + this.rnd() * 0.16))), false); }
                        else {
                            const before = t.hp;
                            if (st.useItemOn(it, t)) { this.anim(t, 'heal'); if (t.hp > before) this.pop(t, '+' + (t.hp - before), '#6ae07a'); else this.pop(t, 'MP', '#6ab0ff'); this.game.sfx('heal'); }
                            else this.pop(t, '—', '#c8c8d8');
                        }
                    }
                });
            }
            S(0.15, () => {});
            this.insert(out);
        }

        applySkill(u, s, t) {
            const st = this.st();
            if (s.kind === 'damage') {
                const mult = t.isEnemy ? elemMult(t, s.element) : 1;
                const d = magical(s.power | 0, this.stat(u, 'mag'), this.stat(t, 'def'), () => this.rnd(), mult, this.buff(t).guard);
                this.damage(t, d, false);
                if (mult > 1) this.msg = 'It\'s super effective!';
                if (mult < 1) this.msg = 'It\'s not very effective…';
            } else if (s.kind === 'heal') {
                if (t.isEnemy ? !t.alive : t.hp <= 0) return;
                const max = t.isEnemy ? t.mhp : st.maxHp(t);
                const amt = Math.max(0, Math.min(max - t.hp, Math.round((s.power | 0) + this.stat(u, 'mag') * 1.5)));
                t.hp += amt;
                this.pop(t, '+' + amt, '#6ae07a');
            } else if (s.kind === 'revive') {
                if (t.isEnemy) { if (!t.alive) { t.alive = true; t.fade = 1; t.hp = Math.ceil(t.mhp / 2); this.pop(t, 'Revived', '#6ae07a'); } }
                else if (t.hp <= 0) { t.hp = Math.max(1, Math.floor(st.maxHp(t) * 0.5)); this.pop(t, 'Revived', '#6ae07a'); }
            } else if (s.kind === 'buffAtk' || s.kind === 'buffDef') {
                const k = s.kind === 'buffAtk' ? 'atk' : 'def';
                const b = this.buff(t);
                b[k] = Math.min(2, (b[k] || 0) + 1);
                this.pop(t, k.toUpperCase() + ' up', '#ffe066');
            }
        }

        damage(t, n, crit) {
            t.hp = Math.max(0, t.hp - n);
            this.pop(t, String(n), crit ? '#ffe066' : t.isEnemy ? '#ffffff' : '#ff8a8a', crit);
            if (t.isEnemy) { t.hit = 0.25; this.game.sfx(crit ? 'critical' : 'hit'); }
            else { t.hurt = 0.4; this.shake = crit ? 0.4 : 0.25; this.game.sfx(crit ? 'critical' : 'hit'); }
            if (t.hp <= 0) {
                if (t.isEnemy) { t.alive = false; this.msg = t.name + ' is defeated!'; }
                else { this.msg = t.name + ' falls!'; }
            }
        }

        pop(t, s, col, big) {
            const p = this.posOf(t);
            this.pops.push({ x: p.x, y: p.y - 6, s, col, t: 0, big });
        }
        posOf(t) {
            if (t.isEnemy) return { x: t.x, y: t.y - t.sprite.height / 2 };
            const i = this.party.indexOf(t);
            const r = this.rowRect(i);
            return { x: r.x + 60, y: r.y + 6 };
        }
        rowRect(i) {
            const n = Math.max(1, this.party.length), h = Math.min(20, 62 / n);
            return { x: 96, y: 168 + i * h, w: 212, h };
        }
        anim(t, kind) {
            const p = this.posOf(t);
            const cols = { slash: ['#ffffff', '#c8d8ff'], fire: ['#ffd040', '#ff6a1a', '#c8301a'], ice: ['#ffffff', '#a8e0ff', '#5ab0ff'], bolt: ['#ffffa0', '#ffe040'], holy: ['#ffffff', '#fff2a0'], dark: ['#a05aff', '#40206a'], wind: ['#c8ffc8', '#6ae07a'], heal: ['#a8ffb0', '#ffffff'], hit: ['#ffffff', '#ffe066'] };
            const c = cols[kind] || cols.hit;
            const n = kind === 'slash' ? 14 : 22;
            for (let i = 0; i < n; i++) {
                const an = this.rnd() * Math.PI * 2, sp = 20 + this.rnd() * 60;
                let vx = Math.cos(an) * sp, vy = Math.sin(an) * sp;
                let x = p.x, y = p.y;
                if (kind === 'slash') { const k = i / n; x = p.x - 16 + k * 32; y = p.y - 16 + k * 32; vx = 10; vy = 10; }
                if (kind === 'fire') vy = -Math.abs(vy) - 20;
                if (kind === 'heal' || kind === 'holy') { vx *= 0.3; vy = -30 - this.rnd() * 30; x += (this.rnd() - 0.5) * 30; y += 10; }
                if (kind === 'bolt') { x = p.x + (this.rnd() - 0.5) * 10; y = p.y - 40 + i * 3; vx = (this.rnd() - 0.5) * 40; vy = 0; }
                if (kind === 'wind') { vx = 80 + this.rnd() * 40; vy = (this.rnd() - 0.5) * 20; x = p.x - 30; y = p.y + (this.rnd() - 0.5) * 30; }
                if (kind === 'dark') { vx = -Math.cos(an) * 30; vy = -Math.sin(an) * 30; x = p.x + Math.cos(an) * 26; y = p.y + Math.sin(an) * 26; }
                this.parts.push({ x, y, vx, vy, life: 0.5 + this.rnd() * 0.3, t: 0, c: c[i % c.length], s: kind === 'slash' ? 2 : 1 + (this.rnd() * 2 | 0) });
            }
            if (kind === 'bolt' || kind === 'holy') this.flash = 0.15;
        }

        escape() {
            const st = this.st();
            this.actions = [];
            if (this.opts.escape === false) {
                this.say('There is no escape!', 0.9);
                this.queue(0, () => { this.runRound(); });
                return;
            }
            this.tries++;
            const ps = this.aliveParty().reduce((n, a) => n + this.stat(a, 'spd'), 0) / Math.max(1, this.aliveParty().length);
            const es = this.aliveEnemies().reduce((n, e) => n + (e.stats.spd | 0), 0) / Math.max(1, this.aliveEnemies().length);
            const chance = U.clamp(0.5 + 0.12 * (this.tries - 1) + (ps - es) * 0.02, 0.15, 0.95);
            if (this.rnd() < chance || this.opts.alwaysEscape) {
                this.queue(0.8, () => { this.msg = 'The party escapes!'; this.game.sfx('escape'); });
                this.queue(0, () => this.finish('escape'));
            } else {
                this.say('Couldn\'t escape!', 0.8);
                this.queue(0, () => { this.runRound(); });
            }
            void st;
        }

        checkEnd() {
            if (this.over) return true;
            if (!this.aliveEnemies().length) { this.victory(); return true; }
            if (!this.aliveParty().length) { this.defeat(); return true; }
            return false;
        }

        victory() {
            this.over = true;
            const st = this.st(), g = this.game;
            let exp = 0, gold = 0;
            const drops = [];
            for (const e of this.enemies) {
                exp += e.db.exp | 0; gold += e.db.gold | 0;
                for (const d of e.db.drops || []) if (d.item && this.rnd() * 100 < (d.chance | 0)) drops.push(d.item);
            }
            this.queue(0.4, () => { this.msg = ''; g.bgm((g.project.system && g.project.system.victoryMusic) || 'victory'); });
            this.say('Victory!', 1.1);
            if (exp) this.say('The party gains ' + exp + ' EXP.', 1.1);
            if (gold) this.queue(1.1, () => { this.msg = 'Found ' + gold + ' ' + ((g.project.system && g.project.system.currency) || 'G') + '.'; st.gainGold(gold); g.sfx('coin'); });
            for (const id of drops) {
                const it = st.itemDb(id);
                if (it) this.queue(1.1, () => { st.gainItem(id, 1); this.msg = 'Found ' + it.name + '!'; g.sfx('item'); g.hook('item', { id, n: 1 }); });
            }
            this.queue(0, () => {
                const ups = [];
                for (const a of this.aliveParty()) for (const u of st.gainExp(a, exp)) ups.push(u);
                for (const u of ups) {
                    g.hook('levelUp', { actor: u.actor.id, level: u.level });
                    let m = u.actor.name + ' reached level ' + u.level + '!';
                    const learned = u.learned.map((id) => st.skillDb(id)).filter(Boolean).map((s) => s.name);
                    if (learned.length) m += ' Learned ' + learned.join(', ') + '!';
                    this.insert([{ dur: 1.4, fn: () => { this.msg = m; g.sfx('levelup'); } }]);
                }
            });
            this.queue(0.2, () => {});
            this.queue(0, () => { st.battles++; this.finish('win'); });
        }

        defeat() {
            this.over = true;
            const g = this.game;
            this.say('The party has fallen…', 1.6);
            this.queue(0, () => {
                if (this.opts.canLose) { for (const a of this.party) if (a.hp <= 0) a.hp = 1; this.finish('lose'); }
                else { this.finish('lose', true); }
            });
            void g;
        }

        finish(result, gameOver) {
            const g = this.game;
            this.done = true;
            g.hook(result === 'win' ? 'battleWin' : result === 'lose' ? 'battleLose' : 'escape', { troop: this.troop.id, random: !!this.opts.random });
            g.endBattle(this, result, gameOver);
        }

        // ── loop ──
        update(dt, inp) {
            this.t += dt;
            if (this.intro > 0) this.intro -= dt;
            for (const e of this.enemies) { if (e.hit > 0) e.hit -= dt; if (!e.alive && e.fade > 0) e.fade = Math.max(0, e.fade - dt * 2.5); }
            for (const a of this.party) if (a.hurt > 0) a.hurt -= dt;
            if (this.shake > 0) this.shake -= dt;
            if (this.flash > 0) this.flash -= dt;
            for (const p of this.pops) p.t += dt;
            this.pops = this.pops.filter((p) => p.t < 1.1);
            for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt; }
            this.parts = this.parts.filter((p) => p.t < p.life);

            // timed steps
            if (this.steps.length || this.wait > 0) {
                const fast = inp.held('ok') || inp.held('cancel');
                if (this.wait > 0) { this.wait -= dt * (fast ? 2.5 : 1); return; }
                const s = this.steps.shift();
                if (s) { s.fn(); this.wait = s.dur; }
                return;
            }
            if (this.phase !== 'input' || this.done) return;

            // input
            const tap = inp.tapNow;
            if (this.target) {
                const T = this.target;
                const nav = inp.nav();
                if (nav === 'left' || nav === 'up') { T.i = (T.i + T.pool.length - 1) % T.pool.length; this.game.sfx('cursor'); }
                if (nav === 'right' || nav === 'down') { T.i = (T.i + 1) % T.pool.length; this.game.sfx('cursor'); }
                if (tap) {
                    let hitI = -1;
                    T.pool.forEach((u, i) => {
                        const p = this.posOf(u);
                        if (u.isEnemy) { const w = u.sprite.width, h = u.sprite.height; if (inRect(tap, p.x - w / 2, p.y - h / 2, w, h)) hitI = i; }
                        else { const r = this.rowRect(this.party.indexOf(u)); if (inRect(tap, r.x, r.y, r.w, r.h)) hitI = i; }
                    });
                    if (hitI >= 0) { T.i = hitI; this.game.sfx('confirm'); T.done(T.pool[T.i]); }
                    else { this.game.sfx('cancel'); this.target = null; }
                    return;
                }
                if (inp.pressed('ok')) { inp.eat('ok'); this.game.sfx('confirm'); T.done(T.pool[T.i]); }
                else if (inp.pressed('cancel')) { inp.eat('cancel'); this.game.sfx('cancel'); this.target = null; }
                return;
            }
            if (this.sub) { this.sub.update(inp, dt); return; }
            if (this.commands) this.commands.update(inp, dt);
        }

        draw(g) {
            const bd = TW.tiles.BACKDROPS[this.bg] || TW.tiles.BACKDROPS.grass;
            const sx = this.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
            g.save();
            g.translate(Math.round(sx), 0);
            const sky = g.createLinearGradient(0, 0, 0, 110);
            sky.addColorStop(0, bd[0]); sky.addColorStop(1, bd[1]);
            g.fillStyle = sky; g.fillRect(-4, 0, 328, 110);
            backdropDetail(g, this.bg, this.t);
            const gr = g.createLinearGradient(0, 100, 0, 240);
            gr.addColorStop(0, bd[2]); gr.addColorStop(1, bd[3]);
            g.fillStyle = gr; g.fillRect(-4, 100, 328, 140);
            g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
            for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(160 + i * 14, 100); g.lineTo(160 + i * 60, 240); g.stroke(); }
            for (const y of [112, 128, 150, 180]) { g.beginPath(); g.moveTo(-4, y); g.lineTo(324, y); g.stroke(); }
            // enemies
            const intro = U.clamp(1 - (this.intro || 0) / 0.6, 0, 1);
            for (const e of this.enemies) {
                if (e.fade <= 0) continue;
                const bob = Math.sin(this.t * 2 + e.x) * 1.5;
                const w = e.sprite.width, h = e.sprite.height;
                g.save();
                g.globalAlpha = e.fade * intro;
                g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(e.x, e.y, w * 0.35, 4, 0, 0, Math.PI * 2); g.fill();
                const x = Math.round(e.x - w / 2 + (e.hit > 0 ? (Math.random() - 0.5) * 4 : 0)), y = Math.round(e.y - h + bob);
                g.drawImage(e.sprite, x, y);
                if (e.hit > 0 && Math.floor(e.hit * 20) % 2 === 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.7; g.drawImage(e.sprite, x, y); }
                if (!e.alive) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,80,120,0.5)'; g.fillRect(x, y, w, h); }
                g.restore();
            }
            for (const p of this.parts) { g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
            g.globalAlpha = 1;
            if (this.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + (this.flash * 4) + ')'; g.fillRect(-4, 0, 328, 240); }
            g.restore();
        }

        drawUI(g) {
            const s = this.game.ui.skin(), st = this.st();
            if (this.msg) { win(g, s, 8, 6, 304, 20); text(g, s, this.msg, 160, 11, { align: 'center', max: 292 }); }
            // party status: one row per hero, beside the command window
            win(g, s, 92, 164, 220, 70);
            this.party.forEach((a, i) => {
                const r = this.rowRect(i);
                const x = r.x + (a.hurt > 0 ? (Math.random() - 0.5) * 3 : 0), y = r.y;
                if (this.phase === 'input' && i === this.actorI && !this.steps.length) cursor(g, s, x, y, r.w, r.h - 1, this.t);
                if (this.target && this.target.kind !== 'enemy' && this.target.pool[this.target.i] === a) cursor(g, s, x, y, r.w, r.h - 1, this.t * 2);
                const hpm = st.maxHp(a), mpm = st.maxMp(a);
                text(g, s, a.name, x + 4, y + 2.5, { bold: true, max: 60, color: a.hp <= 0 ? '#ff6a6a' : s.text, size: 8.5 });
                text(g, s, 'HP', x + 68, y + 2.5, { size: 7.5, color: s.dim });
                text(g, s, a.hp + '/' + hpm, x + 138, y + 2.5, { size: 8, align: 'right', color: a.hp <= 0 ? '#ff6a6a' : a.hp < hpm / 4 ? '#ffe066' : s.text });
                bar(g, x + 68, y + r.h - 3.5, 70, a.hp / hpm, s.hp);
                if (mpm) { text(g, s, 'MP', x + 146, y + 2.5, { size: 7.5, color: s.dim }); text(g, s, String(a.mp), x + 206, y + 2.5, { size: 8, align: 'right' }); bar(g, x + 146, y + r.h - 3.5, 60, a.mp / mpm, s.mp); }
            });
            if (this.phase === 'input' && !this.steps.length) {
                if (this.commands) this.commands.draw(g, s);
                if (this.sub) this.sub.draw(g, s);
                if (this.target && this.target.kind === 'enemy') {
                    const e = this.target.pool[this.target.i];
                    const p = this.posOf(e), bob = Math.sin(this.t * 8) * 2;
                    g.fillStyle = s.cursor;
                    const ty = e.y - e.sprite.height - 6 + bob;
                    g.beginPath(); g.moveTo(e.x - 5, ty - 6); g.lineTo(e.x + 5, ty - 6); g.lineTo(e.x, ty); g.fill();
                    win(g, s, 8, 6, 304, 20);
                    text(g, s, e.name, 16, 11, { bold: true });
                    bar(g, 200, 15, 100, e.hp / e.mhp, s.hp);
                    void p;
                }
            }
            for (const p of this.pops) {
                const k = p.t;
                const y = p.y - Math.min(10, k * 40) + (k > 0.25 ? 0 : 0);
                g.save();
                g.globalAlpha = k > 0.8 ? (1.1 - k) / 0.3 : 1;
                text(g, s, p.s, p.x, y, { align: 'center', bold: true, size: p.big ? 14 : 11, color: p.col });
                g.restore();
            }
        }
    }

    function animFor(s) {
        if (s.kind === 'heal' || s.kind === 'revive') return 'heal';
        if (s.kind === 'buffAtk' || s.kind === 'buffDef') return 'holy';
        return s.element && s.element !== 'none' ? s.element : 'hit';
    }
    function sfxFor(s) {
        if (s.kind === 'heal' || s.kind === 'revive') return 'heal';
        if (s.kind === 'buffAtk' || s.kind === 'buffDef') return 'holy';
        const e = s.anim || s.element;
        return ['fire', 'ice', 'bolt', 'holy', 'dark', 'wind', 'slash'].includes(e) ? e : 'hit';
    }

    function backdropDetail(g, bg, t) {
        const r = U.rng(7);
        if (bg === 'space' || bg === 'spooky' || bg === 'cave' || bg === 'castle') {
            for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.2 + 0.5 * ((Math.sin(t * 2 + i) + 1) / 2) * (bg === 'cave' ? 0.3 : 1)) + ')'; g.fillRect((r() * 320) | 0, (r() * 95) | 0, 1, 1); }
        }
        if (bg === 'spooky' || bg === 'castle') { g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(250, 30, 12, 0, Math.PI * 2); g.fill(); }
        if (bg === 'grass' || bg === 'snow' || bg === 'town') {
            g.fillStyle = 'rgba(255,255,255,0.8)';
            for (let i = 0; i < 4; i++) { const x = ((r() * 400 + t * 4) % 400) - 40, y = 10 + r() * 40; g.beginPath(); g.ellipse(x, y, 18, 5, 0, 0, Math.PI * 2); g.fill(); }
            g.fillStyle = bg === 'snow' ? '#c8d8ea' : bg === 'town' ? '#9a8a78' : '#4a8a3a';
            for (let x = -4; x < 330; x += 6) { const h = 8 + Math.sin(x * 0.07) * 6 + Math.sin(x * 0.23) * 3; g.fillRect(x, 100 - h, 6, h); }
            if (bg === 'town') { g.fillStyle = '#7a6a5a'; for (let i = 0; i < 6; i++) { const x = 20 + i * 52; g.fillRect(x, 74, 30, 26); g.beginPath(); g.moveTo(x - 4, 74); g.lineTo(x + 15, 60); g.lineTo(x + 34, 74); g.fill(); } }
        }
        if (bg === 'desert') { g.fillStyle = '#ffe88a'; g.beginPath(); g.arc(60, 30, 14, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d8b068'; g.beginPath(); g.moveTo(180, 100); g.lineTo(230, 58); g.lineTo(280, 100); g.fill(); }
        if (bg === 'sky') { g.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(((r() * 360 + t * 6) % 380) - 30, 20 + r() * 70, 26, 8, 0, 0, Math.PI * 2); g.fill(); } }
        if (bg === 'cave') { g.fillStyle = '#1a1418'; for (let x = 0; x < 330; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 11, 18 + (x % 3) * 8); g.lineTo(x + 22, 0); g.fill(); } }
        if (bg === 'indoor') { g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 10; x < 320; x += 40) g.fillRect(x, 0, 4, 100); g.fillStyle = '#ffd890'; g.fillRect(150, 30, 20, 26); }
    }

    TW.BattleScene = BattleScene;
    TW.battleMath = { physical, magical, elemMult };
}]);
