/* TALEWRIGHT runtime — game: the scene machine (title → map ⇄ battle → game
 * over / The End), screen effects, the loop, hooks, and TW.mount(), which
 * builds the player DOM (stage, canvases, touch controls) inside any element.
 * TW.player() is the standalone runtime player that opens a .talewright.json. */
(window.TW_MODULES = window.TW_MODULES || []).push(['game', function (TW) {
    'use strict';
    const U = TW.util;
    const { win, text, ListWin, F } = TW.ui;

    // ── screen effects ───────────────────────────────────────────────────────
    class Screen {
        constructor() { this.fadeA = 0; this.fadeTo = 0; this.fadeV = 0; this.fadeH = null; this.flashC = null; this.flashT = 0; this.flashD = 1; this.shakeP = 0; this.shakeT = 0; this.tintC = [0, 0, 0, 0]; this.tintFrom = [0, 0, 0, 0]; this.tintTo = [0, 0, 0, 0]; this.tintT = 0; this.tintD = 0; }
        fade(to, sec) {
            if (this.fadeH) this.fadeH.done = true;
            const h = { done: false };
            this.fadeTo = to;
            if (sec <= 0) { this.fadeA = to; h.done = true; return h; }
            this.fadeV = Math.abs(to - this.fadeA) / sec;
            this.fadeH = h;
            if (this.fadeA === to) h.done = true;
            return h;
        }
        flash(color, sec) { this.flashC = color; this.flashT = sec; this.flashD = Math.max(0.01, sec); }
        shake(power, sec) { this.shakeP = power; this.shakeT = sec; }
        tint(color, sec) {
            const c = U.hex2rgb(color);
            this.tintFrom = this.tintC.slice(); this.tintTo = c; this.tintT = 0; this.tintD = Math.max(0.0001, sec);
            if (sec <= 0) this.tintC = c.slice();
        }
        update(dt) {
            if (this.fadeA !== this.fadeTo) {
                const d = this.fadeTo - this.fadeA, s = this.fadeV * dt;
                this.fadeA = Math.abs(d) <= s ? this.fadeTo : this.fadeA + Math.sign(d) * s;
            }
            if (this.fadeH && this.fadeA === this.fadeTo) { this.fadeH.done = true; this.fadeH = null; }
            if (this.flashT > 0) this.flashT -= dt;
            if (this.shakeT > 0) this.shakeT -= dt;
            if (this.tintT < this.tintD) {
                this.tintT += dt;
                const k = U.clamp(this.tintT / this.tintD, 0, 1);
                this.tintC = this.tintFrom.map((v, i) => v + (this.tintTo[i] - v) * k);
            }
        }
        offset() { return this.shakeT > 0 ? { x: Math.round((Math.random() - 0.5) * this.shakeP * 2), y: Math.round((Math.random() - 0.5) * this.shakeP) } : { x: 0, y: 0 }; }
        draw(g) {
            const t = this.tintC;
            if (t[3] > 0.01) { g.fillStyle = `rgba(${t[0] | 0},${t[1] | 0},${t[2] | 0},${t[3]})`; g.fillRect(0, 0, TW.W, TW.H); }
            if (this.flashT > 0 && this.flashC) { g.fillStyle = U.rgba(this.flashC, U.clamp(this.flashT / this.flashD, 0, 1) * 0.85); g.fillRect(0, 0, TW.W, TW.H); }
            if (this.fadeA > 0) { g.fillStyle = 'rgba(0,0,0,' + this.fadeA + ')'; g.fillRect(0, 0, TW.W, TW.H); }
        }
    }

    // ── title backgrounds ────────────────────────────────────────────────────
    const TITLE_STYLES = { starfield: 'Starfield', sunrise: 'Sunrise', forest: 'Forest', castle: 'Castle at Night', ocean: 'Ocean', parchment: 'Parchment', map: 'Start Map' };
    function drawTitleBg(g, style, t, game) {
        const r = U.rng(5);
        const grad = (stops) => { const gr = g.createLinearGradient(0, 0, 0, TW.H); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); g.fillStyle = gr; g.fillRect(0, 0, TW.W, TW.H); };
        if (style === 'map' && game.project.maps.length) {
            const m = U.byId(game.project.maps, game.project.system.startMap) || game.project.maps[0];
            const mw = m.w * 16, mh = m.h * 16;
            const ox = mw > TW.W ? ((Math.sin(t * 0.05) + 1) / 2) * (mw - TW.W) : (mw - TW.W) / 2;
            const oy = mh > TW.H ? ((Math.cos(t * 0.04) + 1) / 2) * (mh - TW.H) : (mh - TW.H) / 2;
            g.fillStyle = '#000'; g.fillRect(0, 0, TW.W, TW.H);
            g.save(); g.translate(-Math.round(ox), -Math.round(oy));
            TW.tiles.drawLayers(g, m, Math.floor(t * 4) % 6, [0, 1, 2], Math.max(0, Math.floor(ox / 16)), Math.max(0, Math.floor(oy / 16)), Math.min(m.w, Math.ceil((ox + TW.W) / 16) + 1), Math.min(m.h, Math.ceil((oy + TW.H) / 16) + 1));
            g.restore();
            g.fillStyle = 'rgba(0,0,10,0.45)'; g.fillRect(0, 0, TW.W, TW.H);
            return;
        }
        if (style === 'sunrise') {
            grad(['#2a1a5a', '#c8508a', '#ffb060', '#ffe0a0']);
            g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(160, 150 - Math.min(20, t * 2), 30, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#3a2a5a'; for (let x = 0; x < 330; x += 4) { const h = 40 + Math.sin(x * 0.03) * 16 + Math.sin(x * 0.11) * 6; g.fillRect(x, TW.H - h, 4, h); }
            g.fillStyle = '#1a1030'; for (let x = 0; x < 330; x += 4) { const h = 20 + Math.sin(x * 0.05 + 2) * 10; g.fillRect(x, TW.H - h, 4, h); }
        } else if (style === 'forest') {
            grad(['#0a2a1a', '#1a5a3a', '#3a8a5a']);
            for (let layer = 0; layer < 3; layer++) {
                g.fillStyle = ['#1a4a2a', '#123a20', '#0a2414'][layer];
                for (let i = 0; i < 14; i++) { const x = ((r() * 360 + t * (2 + layer * 3)) % 380) - 30, h = 60 + r() * 50 + layer * 30; g.beginPath(); g.moveTo(x, TW.H); g.lineTo(x + 16, TW.H - h); g.lineTo(x + 32, TW.H); g.fill(); }
            }
            for (let i = 0; i < 20; i++) { const a = (Math.sin(t * 2 + i * 3) + 1) / 2; g.fillStyle = 'rgba(220,255,140,' + a + ')'; g.fillRect((r() * 320) | 0, 100 + ((r() * 120) | 0), 1, 1); }
        } else if (style === 'castle') {
            grad(['#05051a', '#1a1a4a', '#3a2a6a']);
            for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.7 * ((Math.sin(t * 1.5 + i) + 1) / 2)) + ')'; g.fillRect((r() * 320) | 0, (r() * 150) | 0, 1, 1); }
            g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(250, 50, 18, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#0a0818';
            g.fillRect(90, 120, 140, 120); g.fillRect(70, 90, 30, 150); g.fillRect(220, 90, 30, 150); g.fillRect(145, 70, 30, 170);
            for (const [x, w] of [[70, 30], [220, 30], [145, 30]]) { g.beginPath(); g.moveTo(x - 4, x === 145 ? 70 : 90); g.lineTo(x + w / 2, x === 145 ? 40 : 62); g.lineTo(x + w + 4, x === 145 ? 70 : 90); g.fill(); }
            g.fillStyle = '#ffd860'; for (const [x, y] of [[80, 110], [230, 112], [156, 90], [120, 150], [190, 150]]) g.fillRect(x, y, 3, 5);
        } else if (style === 'ocean') {
            grad(['#4a8ad8', '#a8d8ff', '#2a6ab0', '#123a70']);
            g.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(((r() * 360 + t * 5) % 380) - 30, 20 + r() * 40, 30, 8, 0, 0, Math.PI * 2); g.fill(); }
            for (let y = 125; y < TW.H; y += 6) { g.fillStyle = 'rgba(255,255,255,0.25)'; for (let x = 0; x < 320; x += 24) g.fillRect((x + Math.sin(t + y) * 6 + y) % 330, y, 10, 1); }
        } else if (style === 'parchment') {
            grad(['#f4e4c0', '#e0c898']);
            for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(120,80,30,' + r() * 0.08 + ')'; g.fillRect((r() * 320) | 0, (r() * 240) | 0, 2, 2); }
            g.strokeStyle = 'rgba(120,80,30,0.5)'; g.lineWidth = 2; g.strokeRect(10, 10, 300, 220); g.lineWidth = 1; g.strokeRect(15, 15, 290, 210);
        } else {
            grad(['#05031a', '#1a1050', '#3a2080']);
            for (let i = 0; i < 90; i++) { const z = r(); const x = (r() * 320 + t * 6 * z) % 320, y = r() * 240; g.fillStyle = 'rgba(255,255,255,' + (0.3 + z * 0.7) * ((Math.sin(t * 2 + i) + 3) / 4) + ')'; g.fillRect(x | 0, y | 0, z > 0.85 ? 2 : 1, z > 0.85 ? 2 : 1); }
        }
    }

    // ── the game ─────────────────────────────────────────────────────────────
    class Game {
        constructor(root, project, opts) {
            this.root = root;
            this.project = project;
            this.opts = opts || {};
            this.rand = this.opts.seed ? U.rng(this.opts.seed) : Math.random;
            TW.sprites.setCustom(project.sprites);
            this.state = new TW.State(project);
            this.ui = new TW.ui.UI(this);
            this.screen = new Screen();
            this.input = new TW.Input();
            this.timers = [];
            this.scene = 'title';
            this.t = 0;
            this.headless = !!this.opts.headless;
            if (!this.headless) this.buildDom();
            this.input.attach();
            if (this.opts.startOverride) this.newGame(this.opts.startOverride);
            else this.toTitle(true);
            if (!this.headless) this.startLoop();
        }

        // ── API used by the interpreter and scenes ──
        mapId() { return this.map ? this.map.mapId : this.state.mapId; }
        refresh() { if (this.map) this.map.refresh(); }
        random() { return this.rand(); }
        hook(name, data) { try { if (this.opts.onHook) this.opts.onHook(name, data || {}); } catch (e) { /* the host's problem */ } }
        warn(msg) { if (this.opts.onWarn) this.opts.onWarn(msg); else if (typeof console !== 'undefined') console.warn(msg); if (this.opts.playtest) this.ui.say([{ text: '\\c[2][Playtest]\\c[0] ' + msg }]); }
        sfx(name) { if (!this.headless) TW.audio.sfx(name); }
        bgm(name) {
            this.state.bgm = name || null;
            if (this.headless) return;
            if (!name || name === 'none') TW.audio.stopMusic(); else TW.audio.playMusic(name);
        }
        busy() { return this.scene !== 'map' || !!this.battle || !!this.transferring; }
        after(sec, fn) { this.timers.push({ t: sec, fn }); }
        canSave() { return true; }

        runEvent(e, list, trigger) {
            this.interp = new TW.Interpreter(this, e.def, list);
            this.interp.trigger = trigger;
            this.interpEvent = e;
        }

        transfer(mapId, x, y, dir, fade) {
            const h = { done: false };
            this.transferring = h;
            const go = () => {
                const m = U.byId(this.project.maps, mapId);
                if (m) {
                    this.map.load(m.id);
                    this.map.player.place(U.clamp(x, 0, m.w - 1), U.clamp(y, 0, m.h - 1));
                    if (dir) this.map.player.dir = dir;
                    this.state.x = this.map.player.x; this.state.y = this.map.player.y;
                    this.hook('transfer', { map: m.id });
                }
            };
            if (fade) {
                this.sfx('door');
                const f = this.screen.fade(1, 0.22);
                const wait = () => { if (!f.done) { this.after(0.02, wait); return; } go(); const f2 = this.screen.fade(0, 0.22); const w2 = () => { if (!f2.done) this.after(0.02, w2); else { h.done = true; this.transferring = null; } }; w2(); };
                wait();
            } else { go(); h.done = true; this.transferring = null; }
            return h;
        }

        startBattle(troopId, opts) {
            const h = { done: false, result: null };
            if (!this.state.troopDb(troopId) || !this.state.party.length || !this.state.troopDb(troopId).members.some((m) => this.state.enemyDb(m.enemy))) { h.done = true; h.result = 'win'; return h; }
            this.sfx('encounter');
            this.screen.flash('#ffffff', 0.35);
            this.battle = new TW.BattleScene(this, troopId, opts, h);
            this.battleHandle = h;
            return h;
        }
        endBattle(scene, result, gameOver) {
            this.battle = null;
            const h = scene.handle;
            h.result = result; h.done = true;
            if (gameOver) { this.gameOver(); return; }
            this.bgm(scene.prevBgm);
            this.screen.flash('#000000', 0.3);
        }
        shop(goods) { return this.ui.push(new TW.menus.Shop(this.ui, goods)); }
        openMenu() { this.ui.push(new TW.menus.MainMenu(this.ui)); }

        save(slot) {
            const d = this.state.serialize();
            d.when = Date.now();
            const ok = U.store.set(TW.menus.slotKey(this, slot), d);
            this.hook('save', { slot, ok });
            if (!ok) this.ui.say('The game could not be saved (browser storage is blocked or full).');
            return ok;
        }
        load(slot) {
            const d = TW.menus.readSlot(this, slot);
            if (!d || !this.state.load(d)) return false;
            this.enterMap(this.state.mapId, this.state.x, this.state.y, this.state.dir);
            if (this.state.bgm) this.bgm(this.state.bgm);
            this.hook('load', { slot });
            return true;
        }

        // ── scenes ──
        reset() {
            this.ui.clear();
            this.interp = null;
            this.battle = null;
            this.transferring = null;
            this.timers = [];
            this.screen = new Screen();
        }
        toTitle(first) {
            this.reset();
            this.scene = 'title';
            this.map = null;
            this.titleT = 0;
            this.bgm(this.project.system.titleMusic || 'title');
            const items = [{ label: 'New Game' }, { label: 'Continue', enabled: TW.menus.anySave(this) }];
            const l = new ListWin(this.ui, { x: 110, y: 160, w: 100, rows: items.length, items, tapSelects: true, index: items[1].enabled ? 1 : 0 });
            l.onChoose = (it, i) => {
                if (i === 0) { this.ui.remove(l); const f = this.screen.fade(1, 0.35); const w = () => (f.done ? this.newGame() : this.after(0.02, w)); w(); }
                else {
                    const sl = new TW.menus.SlotList(this.ui, 'load', (slot) => { if (this.load(slot)) this.sfx('save'); else this.sfx('buzzer'); });
                    sl.onCancel = () => this.ui.remove(sl);
                    this.ui.push(sl);
                }
            };
            this.ui.push(l);
            this.titleMenu = l;
            void first;
        }
        newGame(at) {
            this.reset();
            this.state.newGame();
            const s = this.project.system;
            let mapId = s.startMap, x = s.startX, y = s.startY;
            if (at) { mapId = at.map; x = at.x; y = at.y; }
            const m = U.byId(this.project.maps, mapId) || this.project.maps[0];
            if (!at && !s.startSet) { x = Math.floor(m.w / 2); y = Math.floor(m.h / 2); }
            this.enterMap(m.id, x, y, s.startDir || 2);
            this.screen.fadeA = 1; this.screen.fade(0, 0.4);
            this.hook('start', { playtestFrom: !!at });
        }
        enterMap(mapId, x, y, dir) {
            this.reset();
            this.scene = 'map';
            this.map = new TW.MapScene(this, mapId, x, y, dir);
            const m = this.map.map;
            this.map.player.place(U.clamp(x, 0, m.w - 1), U.clamp(y, 0, m.h - 1));
            this.state.x = this.map.player.x; this.state.y = this.map.player.y;
            if (!m.music && !this.state.bgm) this.bgm('none');
        }
        gameOver() {
            this.reset();
            this.scene = 'gameover';
            this.overT = 0;
            this.bgm('sorrow');
            this.hook('gameover', {});
        }
        theEnd(textStr) {
            this.reset();
            this.scene = 'end';
            this.endT = 0;
            this.endText = TW.ui.expand(this, textStr);
            this.bgm('title');
            this.hook('ending', {});
        }

        // ── loop ──
        step(dt) {
            const inp = this.input;
            inp.update(dt);
            this.t += dt;
            for (let i = 0; i < this.timers.length; i++) { const tm = this.timers[i]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(i--, 1); tm.fn(); } }
            this.screen.update(dt);
            if (this.scene === 'map' || this.scene === 'title') this.state.playtime += this.scene === 'map' ? dt : 0;
            // the topmost thing that takes taps gets them
            const modal = this.ui.busy || !!this.battle || this.scene !== 'map';
            inp.tapNow = modal ? inp.takeTap() : null;
            if (this.scene === 'title') { this.titleT += dt; this.ui.update(dt, inp); return; }
            if (this.scene === 'gameover') {
                this.overT += dt;
                if (this.overT > 1.2 && (inp.pressed('ok') || inp.pressed('cancel') || inp.tapNow)) { inp.eat('ok'); this.toTitle(); }
                return;
            }
            if (this.scene === 'end') {
                this.endT += dt;
                if (this.endT > 4 && (inp.pressed('ok') || inp.pressed('cancel') || inp.tapNow)) { inp.eat('ok'); this.toTitle(); }
                return;
            }
            if (this.battle) {
                if (this.ui.busy) this.ui.update(dt, inp);
                else this.battle.update(dt, inp);
                return;
            }
            this.ui.update(dt, inp);
            if (this.interp) {
                this.interp.update(dt);
                if (this.interp && this.interp.done) { this.interp = null; if (this.map) this.map.restoreDirs(); }
            }
            if (this.map && this.scene === 'map') this.map.update(dt, inp);
        }

        draw() {
            const g = this.gpx, u = this.gui;
            g.save();
            const off = this.screen.offset();
            g.translate(off.x, off.y);
            if (this.scene === 'title') drawTitleBg(g, this.project.system.titleStyle, this.titleT, this);
            else if (this.scene === 'gameover') { g.fillStyle = '#000'; g.fillRect(0, 0, TW.W, TW.H); }
            else if (this.scene === 'end') drawTitleBg(g, 'starfield', this.endT, this);
            else if (this.battle) this.battle.draw(g);
            else if (this.map) this.map.draw(g);
            g.restore();
            this.screen.draw(g);

            u.setTransform(1, 0, 0, 1, 0, 0);
            u.clearRect(0, 0, this.cvUi.width, this.cvUi.height);
            u.setTransform(this.uiScale, 0, 0, this.uiScale, 0, 0);
            const s = this.ui.skin();
            if (this.scene === 'title') this.drawTitle(u, s);
            if (this.scene === 'gameover') {
                const a = U.clamp(this.overT, 0, 1);
                u.globalAlpha = a;
                text(u, s, 'GAME OVER', 160, 90, { align: 'center', size: 26, bold: true, color: '#ff5a6a' });
                text(u, s, this.project.system.gameOverText || '', 160, 126, { align: 'center', color: '#c8c8d8', max: 290 });
                u.globalAlpha = 1;
            }
            if (this.scene === 'end') this.drawEnd(u, s);
            if (this.battle) this.battle.drawUI(u);
            this.ui.draw(u);
        }
        drawTitle(u, s) {
            const sys = this.project.system;
            const t = this.titleT;
            const a = U.clamp(t * 1.2, 0, 1);
            u.save();
            u.globalAlpha = a;
            u.font = 'bold 28px Georgia, "Times New Roman", serif';
            u.textAlign = 'center'; u.textBaseline = 'middle';
            const title = sys.title || 'Untitled';
            let size = 28;
            while (size > 12 && u.measureText(title).width > 296) { size -= 2; u.font = 'bold ' + size + 'px Georgia, "Times New Roman", serif'; }
            const y = 78 + Math.sin(t * 1.4) * 1.5;
            u.lineWidth = 4; u.strokeStyle = 'rgba(10,6,30,0.85)'; u.strokeText(title, 160, y);
            const gr = u.createLinearGradient(0, y - size / 2, 0, y + size / 2);
            gr.addColorStop(0, '#fff8d8'); gr.addColorStop(0.5, '#ffd860'); gr.addColorStop(1, '#e09030');
            u.fillStyle = gr; u.fillText(title, 160, y);
            if (sys.subtitle) { u.font = 'italic 10px Georgia, serif'; u.lineWidth = 3; u.strokeText(sys.subtitle, 160, y + size / 2 + 12); u.fillStyle = '#f0e8ff'; u.fillText(sys.subtitle, 160, y + size / 2 + 12); }
            u.restore();
            if (this.project.meta && this.project.meta.author) text(u, s, 'by ' + this.project.meta.author, 160, 222, { align: 'center', size: 8, color: 'rgba(255,255,255,0.7)' });
        }
        drawEnd(u, s) {
            const t = this.endT;
            const lines = ['THE END', '', ...String(this.endText || '').split('\n'), '', '', this.project.system.title || '', this.project.meta && this.project.meta.author ? 'by ' + this.project.meta.author : '', '', 'Made with TALEWRIGHT'];
            const y0 = Math.max(60, 240 - t * 22);
            lines.forEach((l, i) => {
                const y = y0 + i * 15;
                if (y < -20 || y > 250) return;
                text(u, s, l, 160, y, { align: 'center', size: i === 0 ? 22 : 10, bold: i === 0, color: i === 0 ? '#ffd860' : '#f0ecff', max: 290 });
            });
            if (t > 4) text(u, s, '— press to continue —', 160, 228, { align: 'center', size: 8, color: 'rgba(255,255,255,' + (0.4 + 0.3 * Math.sin(t * 3)) + ')' });
        }

        startLoop() {
            let last = performance.now(), acc = 0;
            const STEP = 1 / 60;
            const frame = (now) => {
                if (this.dead) return;
                this.raf = requestAnimationFrame(frame);
                if (this.paused) { last = now; return; }
                acc += Math.min(0.25, (now - last) / 1000);
                last = now;
                let n = 0;
                while (acc >= STEP && n < 5) { this.step(STEP); acc -= STEP; n++; }
                if (n === 5) acc = 0;
                try { this.draw(); } catch (e) { if (!this.drawErr) { this.drawErr = true; console.error(e); } }
            };
            this.raf = requestAnimationFrame(frame);
            this._vis = () => { if (document.hidden) { this.paused = true; TW.audio.suspend(); } else { this.paused = false; TW.audio.resume(); } };
            document.addEventListener('visibilitychange', this._vis);
        }

        // ── DOM ──
        buildDom() {
            const root = this.root;
            if (!document.getElementById('tw-style')) {
                const st = document.createElement('style');
                st.id = 'tw-style'; st.textContent = TW.css;
                document.head.appendChild(st);
            }
            if (root === document.body) document.body.classList.add('tw-body');
            const el = document.createElement('div');
            el.className = 'tw-player';
            el.innerHTML = '<div class="tw-stage"><canvas class="tw-px"></canvas><canvas class="tw-ui"></canvas></div>' +
                '<div class="tw-touch"><div class="tw-pad"><i class="u"></i><i class="l"></i><i class="r"></i><i class="d"></i></div>' +
                '<div class="tw-btn a">A</div><div class="tw-btn b">B</div></div>';
            root.appendChild(el);
            this.el = el;
            this.stage = el.querySelector('.tw-stage');
            this.cvPx = el.querySelector('.tw-px');
            this.cvUi = el.querySelector('.tw-ui');
            this.cvPx.width = TW.W; this.cvPx.height = TW.H;
            this.gpx = U.ctx(this.cvPx);
            this.gui = this.cvUi.getContext('2d');
            const touch = (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) || this.opts.touch;
            if (touch) el.classList.add('touch');
            this.touch = !!touch;

            // taps and clicks on the screen
            let down = null;
            this.stage.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; TW.audio.unlock(); });
            this.stage.addEventListener('pointerup', (e) => {
                if (!down) return;
                const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
                down = null;
                if (moved > 14) return;
                const r = this.stage.getBoundingClientRect();
                this.input.tap((e.clientX - r.left) / r.width * TW.W, (e.clientY - r.top) / r.height * TW.H);
            });
            this.stage.addEventListener('contextmenu', (e) => e.preventDefault());

            // d-pad: the direction follows the finger
            const pad = el.querySelector('.tw-pad');
            const arrows = { 8: pad.querySelector('.u'), 2: pad.querySelector('.d'), 4: pad.querySelector('.l'), 6: pad.querySelector('.r') };
            let padId = null;
            const setDir = (d) => {
                for (const b of ['up', 'down', 'left', 'right']) this.input.setSoft(b, false);
                for (const k of Object.keys(arrows)) arrows[k].classList.toggle('on', +k === d);
                if (d) this.input.setSoft({ 8: 'up', 2: 'down', 4: 'left', 6: 'right' }[d], true);
            };
            const padMove = (e) => {
                const r = pad.getBoundingClientRect();
                const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
                setDir(Math.hypot(dx, dy) < 12 ? 0 : U.dirOf(dx, dy));
            };
            pad.addEventListener('pointerdown', (e) => { padId = e.pointerId; pad.setPointerCapture(e.pointerId); padMove(e); e.preventDefault(); });
            pad.addEventListener('pointermove', (e) => { if (e.pointerId === padId) padMove(e); });
            const padUp = (e) => { if (e.pointerId === padId) { padId = null; setDir(0); } };
            pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp);
            for (const [cls, b] of [['a', 'ok'], ['b', 'cancel']]) {
                const btn = el.querySelector('.tw-btn.' + cls);
                btn.addEventListener('pointerdown', (e) => { btn.setPointerCapture(e.pointerId); btn.classList.add('on'); this.input.setSoft(b, true); e.preventDefault(); });
                const up = () => { btn.classList.remove('on'); this.input.setSoft(b, false); };
                btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
            }

            this._resize = () => this.layout();
            window.addEventListener('resize', this._resize);
            if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(this._resize); this._ro.observe(el); }
            this.layout();
        }

        layout() {
            const el = this.el;
            const W = el.clientWidth || window.innerWidth, H = el.clientHeight || window.innerHeight;
            const portrait = H > W;
            let aw = W, ah = H, top = 0;
            if (this.touch && portrait) ah = Math.max(240, H - 190);
            if (this.touch && !portrait) aw = Math.max(320, W - 2 * 150);
            let s = Math.min(aw / TW.W, ah / TW.H);
            if (s >= 2) s = Math.floor(s);
            s = Math.max(0.5, s);
            const sw = TW.W * s, sh = TW.H * s;
            const left = (W - sw) / 2;
            top = this.touch && portrait ? Math.max(0, Math.min((ah - sh) / 2, 24)) : (H - sh) / 2;
            this.stage.style.left = left + 'px'; this.stage.style.top = top + 'px';
            this.stage.style.width = sw + 'px'; this.stage.style.height = sh + 'px';
            for (const c of [this.cvPx, this.cvUi]) { c.style.width = sw + 'px'; c.style.height = sh + 'px'; }
            const dpr = Math.min(3, window.devicePixelRatio || 1);
            this.cvUi.width = Math.round(sw * dpr); this.cvUi.height = Math.round(sh * dpr);
            this.uiScale = s * dpr;
            // touch controls
            const pad = el.querySelector('.tw-pad'), a = el.querySelector('.tw-btn.a'), b = el.querySelector('.tw-btn.b');
            if (portrait) {
                const cy = Math.min(H - 95, top + sh + (H - top - sh) / 2);
                pad.style.left = '18px'; pad.style.top = (cy - 75) + 'px';
                a.style.left = (W - 86) + 'px'; a.style.top = (cy - 62) + 'px';
                b.style.left = (W - 156) + 'px'; b.style.top = (cy - 4) + 'px';
            } else {
                pad.style.left = '14px'; pad.style.top = (H - 170) + 'px';
                a.style.left = (W - 82) + 'px'; a.style.top = (H - 150) + 'px';
                b.style.left = (W - 148) + 'px'; b.style.top = (H - 92) + 'px';
            }
        }

        destroy() {
            this.dead = true;
            if (this.raf) cancelAnimationFrame(this.raf);
            this.input.detach();
            TW.audio.stopMusic();
            if (this._resize) window.removeEventListener('resize', this._resize);
            if (this._ro) this._ro.disconnect();
            if (this._vis) document.removeEventListener('visibilitychange', this._vis);
            if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
        }
    }

    /** Mount a game in an element. Returns the Game. */
    function mount(root, project, opts) {
        const p = TW.schema.validate(project);
        return new Game(root, p, opts);
    }

    /** The standalone runtime player: open a .talewright.json and play it. */
    function player(root) {
        if (!document.getElementById('tw-style')) { const st = document.createElement('style'); st.id = 'tw-style'; st.textContent = TW.css; document.head.appendChild(st); }
        if (root === document.body) document.body.classList.add('tw-body');
        const box = document.createElement('div');
        box.className = 'tw-player';
        box.innerHTML = '<div class="tw-loader"><h1>TALEWRIGHT Player</h1><div class="drop"><p>Drop a <b>.talewright.json</b> game here</p><label>Open a game<input type="file" accept=".json,application/json"></label></div><div class="err"></div><small>Made with TALEWRIGHT ' + TW.version + '</small></div>';
        root.appendChild(box);
        const err = box.querySelector('.err'), drop = box.querySelector('.drop');
        const start = (data) => {
            try {
                const p = TW.schema.validate(typeof data === 'string' ? JSON.parse(data) : data);
                box.remove();
                document.title = p.system.title || 'TALEWRIGHT';
                TW.game = mount(root, p, { saveKey: 'tw.' + p.id });
            } catch (e) { err.textContent = 'That file is not a TALEWRIGHT game: ' + e.message; }
        };
        const readFile = (f) => { if (!f) return; const r = new FileReader(); r.onload = () => start(r.result); r.readAsText(f); };
        box.querySelector('input').addEventListener('change', (e) => readFile(e.target.files[0]));
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('over'));
        drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); readFile(e.dataTransfer.files[0]); });
        const q = new URLSearchParams(location.search).get('game');
        if (q) fetch(q).then((r) => r.text()).then(start).catch((e) => { err.textContent = 'Could not load ' + q + ': ' + e.message; });
    }

    /** Boot an exported game (the data is in window.TW_GAME). */
    function boot(root, data) {
        try { TW.game = mount(root, data, { saveKey: 'tw.' + (data.id || 'game') }); }
        catch (e) { root.textContent = 'This game could not start: ' + e.message; }
    }

    TW.Game = Game;
    TW.mount = mount;
    TW.player = player;
    TW.boot = boot;
    TW.TITLE_STYLES = TITLE_STYLES;
    TW.drawTitleBg = drawTitleBg;
}]);
