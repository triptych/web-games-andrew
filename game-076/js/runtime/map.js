/* TALEWRIGHT runtime — map: the hero and events on a map. Grid movement with
 * tweening, collisions, triggers, autorun and parallel events, random and
 * approach movement, move routes, random encounters, tap-to-walk and drawing. */
(window.TW_MODULES = window.TW_MODULES || []).push(['map', function (TW) {
    'use strict';
    const U = TW.util, T = 16;
    const SPEEDS = [1.6, 2.6, 3.6, 4.6, 6.2];
    const WALK = [1, 0, 1, 2];

    class Char {
        constructor(x, y, dir) {
            this.x = x; this.y = y; this.dir = dir || 2;
            this.px = x * T; this.py = y * T;
            this.moving = false;
            this.speed = 4;
            this.animT = 0; this.pattern = 1;
            this.jump = 0;
            this.through = false;
            this.walkAnim = true;
            this.route = null;
        }
        place(x, y) { this.x = x; this.y = y; this.px = x * T; this.py = y * T; this.moving = false; }
        update(dt) {
            if (this.moving) {
                const tx = this.x * T, ty = this.y * T, sp = this.speed * T * dt;
                const dx = tx - this.px, dy = ty - this.py;
                const d = Math.abs(dx) + Math.abs(dy);
                if (d <= sp) { this.px = tx; this.py = ty; this.moving = false; if (this.onArrive) this.onArrive(); }
                else { this.px += Math.sign(dx) * Math.min(Math.abs(dx), sp); this.py += Math.sign(dy) * Math.min(Math.abs(dy), sp); }
            }
            if (this.jump > 0) this.jump = Math.max(0, this.jump - dt);
            if (this.moving || (this.stepAnim)) { this.animT += dt * this.speed * 1.6; this.pattern = WALK[Math.floor(this.animT) % 4]; }
            else { this.pattern = 1; this.animT = 0; }
        }
        get hop() { return this.jump > 0 ? Math.sin((1 - this.jump / 0.4) * Math.PI) * 8 : 0; }
    }

    // A page with no graphic and no commands is how an event "goes away" (an
    // empty last page, as in RPG Maker); it never blocks.
    const vanished = (pg) => (!pg.gfx || !pg.gfx.kind || pg.gfx.kind === 'none') && !(pg.list && pg.list.length);

    class MapScene {
        constructor(game, mapId, x, y, dir) {
            this.game = game;
            this.player = new Char(x, y, dir);
            this.player.isPlayer = true;
            this.player.onArrive = () => this.onPlayerStep();
            this.t = 0;
            this.load(mapId);
        }

        load(mapId) {
            const g = this.game;
            this.mapId = mapId;
            this.map = U.byId(g.project.maps, mapId) || g.project.maps[0];
            this.mapId = this.map.id;
            g.state.mapId = this.mapId;
            this.events = (this.map.events || []).map((def) => {
                const c = new Char(def.x, def.y, 2);
                return { def, id: def.id, c, page: null, erased: false, par: null, moveT: 1 + Math.random() * 2 };
            });
            this.player.path = null;
            this.encCount = this.nextEnc();
            this.refresh();
            const m = this.map;
            if (m.music) g.bgm(m.music);
            if (m.showName) g.ui.showBanner(m.name);
        }

        nextEnc() { const r = this.map.encRate | 0; return r > 0 ? Math.max(3, Math.round(r * (0.5 + this.game.random()))) : Infinity; }

        // ── pages ──
        refresh() {
            for (const e of this.events) {
                const page = e.erased ? null : TW.activePage(this.game, this.mapId, e.def);
                if (page === e.page) continue;
                e.page = page;
                e.par = null;
                if (page) {
                    const gf = page.gfx || {};
                    if (gf.dir) e.c.dir = gf.dir;
                    e.c.speed = SPEEDS[U.clamp((page.speed || 3) - 1, 0, 4)];
                    e.c.through = !!page.through;
                    e.c.walkAnim = page.walkAnim !== false;
                    e.c.stepAnim = gf.kind === 'obj' ? false : !!page.stepAnim;
                }
            }
        }
        eraseEvent(id) {
            const e = this.events.find((x) => x.id === id);
            if (e) { e.erased = true; e.page = null; e.par = null; }
        }
        eventAt(x, y, filter) {
            for (const e of this.events) {
                if (!e.page || e.erased) continue;
                if (e.c.x === x && e.c.y === y && (!filter || filter(e))) return e;
            }
            return null;
        }

        // ── collisions ──
        passable(x, y, who) {
            const m = this.map;
            if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
            if (who.through) return true;
            if (TW.tiles.isSolid(m, x, y)) return false;
            for (const e of this.events) {
                if (!e.page || e.erased || e.c === who || e.c.through) continue;
                if ((e.page.priority || 'same') !== 'same') continue;
                if (vanished(e.page)) continue;
                if (e.c.x === x && e.c.y === y) return false;
            }
            if (who !== this.player && this.player.x === x && this.player.y === y && !this.player.hidden) return false;
            return true;
        }
        tryMove(ch, dir) {
            ch.dir = dir;
            const [dx, dy] = U.DIRS[dir];
            const nx = ch.x + dx, ny = ch.y + dy;
            if (!this.passable(nx, ny, ch)) return false;
            ch.x = nx; ch.y = ny; ch.moving = true;
            return true;
        }

        // ── triggers ──
        start(e, trigger) {
            const g = this.game;
            if (g.interp || !e.page) return false;
            const gf = e.page.gfx || {};
            if ((trigger === 'action' || trigger === 'touch') && gf.kind === 'char' && !e.page.dirFix) {
                e.savedDir = e.c.dir;
                e.c.dir = U.dirOf(this.player.x - e.c.x, this.player.y - e.c.y);
            }
            this.player.path = null;
            g.runEvent(e, e.page.list, trigger);
            return true;
        }
        checkAction() {
            const p = this.player;
            const here = this.eventAt(p.x, p.y, (e) => e.page.priority !== 'same' && e.page.trigger === 'action');
            if (here) return this.start(here, 'action');
            const [dx, dy] = U.DIRS[p.dir];
            let fx = p.x + dx, fy = p.y + dy;
            let e = this.eventAt(fx, fy, (x) => (x.page.priority || 'same') === 'same' && (x.page.trigger === 'action' || x.page.trigger === 'touch'));
            if (!e && TW.tiles.isCounter(this.map, fx, fy)) {
                fx += dx; fy += dy;
                e = this.eventAt(fx, fy, (x) => (x.page.priority || 'same') === 'same' && (x.page.trigger === 'action' || x.page.trigger === 'touch'));
            }
            if (e) return this.start(e, 'action');
            return false;
        }
        onPlayerStep() {
            const g = this.game, p = this.player;
            g.state.steps++;
            g.state.x = p.x; g.state.y = p.y;
            const e = this.eventAt(p.x, p.y, (x) => x.page.priority !== 'same' && x.page.trigger === 'touch');
            if (e) { this.start(e, 'touch'); return; }
            if (this.encounter()) return;
        }
        encounter() {
            const m = this.map, g = this.game;
            const list = (m.encounters || []).filter((x) => x.weight > 0 && g.state.troopDb(x.troop));
            if (!list.length || !(m.encRate > 0) || g.opts.noEncounters) return false;
            if (--this.encCount > 0) return false;
            this.encCount = this.nextEnc();
            let total = 0;
            for (const x of list) total += x.weight;
            let r = g.random() * total, pick = list[0];
            for (const x of list) { r -= x.weight; if (r < 0) { pick = x; break; } }
            this.player.path = null;
            g.startBattle(pick.troop, { escape: true, random: true });
            return true;
        }

        // ── routes ──
        setRoute(target, steps) {
            const ch = target === 'player' ? this.player : (this.events.find((e) => e.id === target) || {}).c;
            if (!ch) return null;
            const handle = { done: !steps.length };
            ch.route = { steps: steps.slice(), i: 0, wait: 0, stuck: 0, handle };
            return handle;
        }
        runRoute(ch, dt) {
            const r = ch.route;
            if (!r || ch.moving) return;
            if (r.wait > 0) { r.wait -= dt; return; }
            if (r.i >= r.steps.length) { r.handle.done = true; ch.route = null; return; }
            const s = r.steps[r.i];
            const dirs = { u: 8, d: 2, l: 4, r: 6 };
            if (dirs[s]) {
                if (this.tryMove(ch, dirs[s])) { r.i++; r.stuck = 0; }
                else if ((r.stuck += dt) > 0.6) { r.i++; r.stuck = 0; }
                return;
            }
            if (s[0] === 't' && dirs[s[1]]) ch.dir = dirs[s[1]];
            else if (s === 'tp') ch.dir = U.dirOf(this.player.x - ch.x, this.player.y - ch.y);
            else if (s === 'w') r.wait = 0.4;
            else if (s === 'j') { ch.jump = 0.4; r.wait = 0.4; }
            else if (s === 'hide') ch.hidden = true;
            else if (s === 'show') ch.hidden = false;
            r.i++;
        }

        // ── tap to walk ──
        walkTo(tx, ty) {
            const p = this.player, m = this.map;
            if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return;
            const target = this.eventAt(tx, ty, (e) => e.page.trigger === 'action' || e.page.trigger === 'touch');
            const adj = Math.abs(tx - p.x) + Math.abs(ty - p.y);
            if (target && adj === 1 && (target.page.priority || 'same') === 'same') {
                p.dir = U.dirOf(tx - p.x, ty - p.y);
                this.checkAction();
                return;
            }
            if (tx === p.x && ty === p.y) { this.checkAction(); return; }
            // breadth-first search to the tile, or next to it when it is blocked
            const W = m.w, H = m.h, prev = new Int32Array(W * H).fill(-1);
            const start = p.y * W + p.x;
            prev[start] = start;
            const q = [start];
            const goalOk = this.passable(tx, ty, p);
            let found = -1;
            for (let qi = 0; qi < q.length && qi < 6000; qi++) {
                const cur = q[qi], cx = cur % W, cy = (cur / W) | 0;
                if ((goalOk && cx === tx && cy === ty) || (!goalOk && Math.abs(cx - tx) + Math.abs(cy - ty) === 1)) { found = cur; break; }
                for (const d of [2, 4, 6, 8]) {
                    const [dx, dy] = U.DIRS[d];
                    const nx = cx + dx, ny = cy + dy;
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    const ni = ny * W + nx;
                    if (prev[ni] !== -1) continue;
                    if (!this.passable(nx, ny, p)) continue;
                    prev[ni] = cur; q.push(ni);
                }
            }
            if (found < 0) return;
            const path = [];
            for (let c = found; c !== start; c = prev[c]) path.unshift(c);
            p.path = path.map((i) => ({ x: i % W, y: (i / W) | 0 }));
            p.pathTarget = goalOk ? null : { x: tx, y: ty };
        }

        // ── update ──
        update(dt, inp) {
            const g = this.game, p = this.player;
            this.t += dt;
            const free = !g.interp && !g.ui.busy && !g.busy();
            // the hero
            if (p.route) this.runRoute(p, dt);
            else if (free && !p.moving) {
                const tap = inp.takeTap();
                if (tap) { const cam = this.camera(); this.walkTo(Math.floor((tap.x + cam.x) / T), Math.floor((tap.y + cam.y) / T)); }
                const d = inp.dir();
                p.speed = inp.held('run') ? 6.4 : 4;
                if (d) {
                    p.path = null;
                    if (!this.tryMove(p, d)) {
                        const [dx, dy] = U.DIRS[d];
                        const e = this.eventAt(p.x + dx, p.y + dy, (x) => (x.page.priority || 'same') === 'same' && x.page.trigger === 'touch');
                        if (e) this.start(e, 'touch');
                    }
                } else if (p.path && p.path.length) {
                    const n = p.path.shift();
                    const dir = U.dirOf(n.x - p.x, n.y - p.y);
                    if (!this.tryMove(p, dir)) p.path = null;
                } else if (p.path) {
                    const t = p.pathTarget;
                    p.path = null;
                    if (t) { p.dir = U.dirOf(t.x - p.x, t.y - p.y); this.checkAction(); }
                } else if (inp.pressed('ok')) {
                    inp.eat('ok');
                    this.checkAction();
                } else if (inp.pressed('cancel')) {
                    inp.eat('cancel');
                    g.openMenu();
                }
            }
            p.update(dt);

            // events
            for (const e of this.events) {
                if (!e.page || e.erased) continue;
                const c = e.c, pg = e.page;
                if (c.route) this.runRoute(c, dt);
                else if (!c.moving && !g.interp && pg.move && pg.move !== 'fixed') {
                    e.moveT -= dt;
                    if (e.moveT <= 0) {
                        e.moveT = (pg.move === 'approach' ? 0.3 : 1 + g.random() * 2.5) * (3 / (pg.speed || 3));
                        let dir;
                        if (pg.move === 'approach') {
                            const dx = p.x - c.x, dy = p.y - c.y;
                            dir = Math.abs(dx) > Math.abs(dy) || (Math.abs(dx) === Math.abs(dy) && g.random() < 0.5) ? (dx < 0 ? 4 : 6) : (dy < 0 ? 8 : 2);
                            if (!dx && !dy) dir = 0;
                        } else dir = [2, 4, 6, 8][(g.random() * 4) | 0];
                        if (dir && !this.tryMove(c, dir)) {
                            const [dx, dy] = U.DIRS[dir];
                            if (p.x === c.x + dx && p.y === c.y + dy && pg.trigger === 'touch' && !g.interp && !g.ui.busy) this.start(e, 'touch');
                            else if (pg.move === 'approach') { const alt = dir === 2 || dir === 8 ? (p.x < c.x ? 4 : 6) : (p.y < c.y ? 8 : 2); this.tryMove(c, alt); }
                        }
                    }
                }
                c.update(dt);
                // parallel events run on their own
                if (pg.trigger === 'parallel') {
                    if (!e.par || e.par.done) e.par = new TW.Interpreter(g, e.def, pg.list, { parallel: true });
                    e.par.update(dt);
                }
            }
            // autorun
            if (!g.interp && !g.ui.busy && !g.busy()) {
                for (const e of this.events) {
                    if (e.page && !e.erased && e.page.trigger === 'autorun') { this.start(e, 'autorun'); break; }
                }
            }
            g.state.x = p.x; g.state.y = p.y; g.state.dir = p.dir;
        }

        restoreDirs() {
            for (const e of this.events) if (e.savedDir) { if (e.page && (!e.page.move || e.page.move === 'fixed')) e.c.dir = e.savedDir; e.savedDir = 0; }
        }

        // ── drawing ──
        camera() {
            const m = this.map, p = this.player;
            const mw = m.w * T, mh = m.h * T;
            let x = p.px + 8 - TW.W / 2, y = p.py + 8 - TW.H / 2;
            x = mw <= TW.W ? (mw - TW.W) / 2 : U.clamp(x, 0, mw - TW.W);
            y = mh <= TW.H ? (mh - TW.H) / 2 : U.clamp(y, 0, mh - TW.H);
            return { x: Math.round(x), y: Math.round(y) };
        }
        draw(g) {
            const m = this.map, cam = this.camera();
            g.fillStyle = '#000'; g.fillRect(0, 0, TW.W, TW.H);
            g.save();
            g.translate(-cam.x, -cam.y);
            const x0 = Math.max(0, Math.floor(cam.x / T)), y0 = Math.max(0, Math.floor(cam.y / T));
            const x1 = Math.min(m.w, Math.ceil((cam.x + TW.W) / T) + 1), y1 = Math.min(m.h, Math.ceil((cam.y + TW.H) / T) + 1);
            const frame = Math.floor(this.t * 4) % 6;
            TW.tiles.drawLayers(g, m, frame, [0, 1], x0, y0, x1, y1);
            // characters by priority, then by height on screen
            const list = [];
            for (const e of this.events) {
                if (!e.page || e.erased || e.c.hidden) continue;
                const gf = e.page.gfx || {};
                if (!gf.kind || gf.kind === 'none') continue;
                const pr = e.page.priority === 'below' ? 0 : e.page.priority === 'above' ? 2 : 1;
                list.push({ pr, y: e.c.py, draw: () => this.drawChar(g, e.c, gf, frame) });
            }
            const leader = this.game.state.leader();
            if (leader && !this.player.hidden) {
                const db = this.game.state.actorDb(leader.id);
                list.push({ pr: 1, y: this.player.py + 0.1, draw: () => this.drawChar(g, this.player, { kind: 'char', id: (db && db.sprite) || 'hero' }, frame) });
            }
            list.sort((a, b) => a.pr - b.pr || a.y - b.y);
            for (const it of list) it.draw();
            TW.tiles.drawLayers(g, m, frame, [2], x0, y0, x1, y1);
            g.restore();
        }
        drawChar(g, c, gf, frame) {
            const x = c.px, y = c.py - c.hop;
            if (gf.kind === 'char') {
                g.fillStyle = 'rgba(0,0,0,0.22)';
                g.beginPath(); g.ellipse(c.px + 8, c.py + 14.5, 5, 2, 0, 0, Math.PI * 2); g.fill();
                TW.sprites.drawChar(g, gf.id, c.dir, c.pattern, x, y - 6);
            } else if (gf.kind === 'obj') {
                const def = TW.sprites.OBJECTS[gf.id];
                const f = def && def.f > 1 ? Math.floor(this.t * 5) % def.f : 0;
                g.drawImage(TW.sprites.object(gf.id, f), Math.round(x), Math.round(y));
            } else if (gf.kind === 'tile') {
                const tc = TW.tiles.tileCanvas(this.map.tileset, gf.id, frame, 0);
                if (tc) g.drawImage(tc, Math.round(x), Math.round(y));
            }
        }
    }

    TW.MapScene = MapScene;
    TW.Char = Char;
}]);
