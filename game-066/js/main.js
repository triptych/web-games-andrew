// SCRAPWRIGHT — boot, the mode machine and the frame loop.
//   title (3D flyover) → new game → the world ⇄ battles, menus, prompts → the ending → the world
// The simulation (js/sim) is driven through Game; its events are routed to the view, the UI and
// the audio here. ?debug=1 exposes window.__rt for tests; ?fast=N speeds up animation and text;
// ?quick=1 skips the opening.

import { Game, newState, loadGame } from './sim/game.js';
import { MAPS } from './sim/data/maps.js';
import { BY_NAME, SPECIES } from './sim/dex.js';
import { makeUnit } from './sim/unit.js';
import { MOVES } from './sim/data/moves.js';
import { RNG } from './rng.js';
import { View } from './view/view.js';
import { audio } from './audio.js';
import { Input } from './input.js';
import { HUD } from './ui/hud.js';
import { Dialog } from './ui/dialog.js';
import { BattleUI } from './ui/battleui.js';
import { Menus } from './ui/menus.js';
import { Prompts } from './ui/prompts.js';
import { Screens } from './ui/screens.js';
import { $, navMove, setPortraits, fmtTime } from './ui/dom.js';
import * as store from './save.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = Math.max(1, Math.min(20, +(params.get('fast') || 1)));

class App {
    constructor() {
        this.settings = store.loadSettings();
        this.audio = audio;
        this.fast = FAST;
        this.view = new View($('gl'));
        setPortraits(this.view.portraits);
        this.input = new Input();
        document.body.classList.toggle('touch', this.input.isTouch);
        this.hud = new HUD(this);
        this.dialog = new Dialog(this);
        this.battleUI = new BattleUI(this);
        this.menus = new Menus(this);
        this.prompts = new Prompts(this);
        this.screens = new Screens(this);
        this.game = null;
        this.mode = 'boot';
        this.shown = null;
        this.lastWorld = null;
        this.saveT = 0;
        this.relayout = () => this.view.resize(innerWidth, innerHeight);
        addEventListener('resize', this.relayout);
        window.visualViewport?.addEventListener('resize', this.relayout);
        this.relayout();
        this.applySettings();
        for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, () => { audio.init(); audio.applyVolume(); }, { capture: true });
        addEventListener('pagehide', () => this.saveNow());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveNow(); });
    }

    applySettings() {
        const s = this.settings;
        audio.setVolumes({ music: s.music, sfx: s.sfx, muted: s.muted });
        const r = this.view.r;
        if (s.quality === 'auto') { r.auto = true; r.setTier(this.input.isTouch ? 2 : 1); }
        else r.setTier(+s.quality, true);
        r.grade.uniforms.uGrain.value = s.grain ? 0.035 : 0;
        this.view.ow.fx.budget = this.view.bv.fx.budget = r.T.particles;
        store.saveSettings(s);
    }

    // ------------------------------------------------------------------ modes
    setMode(m) {
        this.mode = m;
        const world = m === 'world';
        this.hud.show(world);
        document.body.classList.toggle('playing', m !== 'title' && m !== 'new');
        document.body.classList.toggle('in-battle', m === 'battle' || m === 'battle-intro');
        $('touch').classList.toggle('hidden', !(this.input.isTouch && m === 'world'));
    }

    toTitle() {
        this.menus.close();
        this.prompts.hide();
        this.dialog.hide();
        this.battleUI.hide();
        this.screens.hide();
        const st = newState({ seed: 77, name: 'Demo' });
        st.story = 30;
        const demo = new Game(st);
        demo.frames.length = 0; demo.pending = null;
        demo.placeAt('gasket', 13, 9, 'down');
        demo.state.party.push(makeUnit(new RNG(5), BY_NAME.furnacle.id, 20, { uid: 1 }));
        this.game = null;
        this.demo = demo;
        this.view.endBattle();
        this.view.loadWorld(demo.world, demo);
        this.view.title = true;
        this.setMode('title');
        const meta = store.saveMeta();
        this.screens.title(store.hasSave(), meta ? `${meta.name} · ${meta.seals} seals · ${fmtTime(meta.playtime)}` : '');
        audio.music('title');
    }

    startNew(name, look) {
        const seed = params.get('seed') ? +params.get('seed') : (Math.random() * 2 ** 31) >>> 0;
        this.begin(new Game(newState({ name, look, seed })));
    }
    continueGame() {
        const json = store.loadJson();
        if (!json) return;
        try { this.begin(loadGame(json)); this.hud.toast(`Welcome back, ${this.game.state.name}.`); }
        catch (e) { console.warn('bad save', e); this.hud.toast('That save could not be read.', 'warn'); }
    }
    begin(game) {
        this.screens.hide();
        this.menus.close();
        this.game = game;
        this.demo = null;
        this.view.title = false;
        this.shown = null;
        this.worldChanged();
        this.setMode('world');
        this.hud.objective(game.objective().text);
    }
    quitToTitle() { this.saveNow(); this.toTitle(); }

    worldChanged() {
        const g = this.game;
        this.lastWorld = g.world;
        this.view.loadWorld(g.world, g);
        audio.music(this.musicFor());
    }
    musicFor() {
        const g = this.game;
        if (!g) return 'title';
        const m = g.world.map;
        return m.music || 'route';
    }

    // ------------------------------------------------------------------ saving
    saveNow(manual = false) {
        const g = this.game;
        if (!g || g.battle) return false;
        const ok = store.saveJson(g.serialize(), { name: g.state.name, seals: g.state.seals, playtime: g.state.playtime, map: MAPS[g.world.id].name });
        if (manual) { audio.sfx(ok ? 'save' : 'nope'); if (!ok) this.hud.toast('Saving is blocked in this browser.', 'warn'); }
        this.saveT = 0;
        return ok;
    }

    // ------------------------------------------------------------------ prompts from the simulation
    showPending() {
        const g = this.game, p = g.pending;
        if (!p || p === this.shown) return;
        this.shown = p;
        switch (p.type) {
            case 'say': this.dialog.show(p.text, { who: p.who, bot: p.bot, item: p.item, onDone: () => this.respond(null) }); if (p.item) audio.sfx('item'); break;
            case 'ask': this.dialog.show(p.text, { who: null, choices: p.opts, onChoice: (i) => this.respond(i) }); break;
            case 'learn': this.prompts.learn(p); break;
            case 'evolve': this.prompts.evolve(p); break;
            case 'evolved': this.prompts.evolved(p); this.view.ow.refreshFollower(g); break;
            case 'repair': this.prompts.repair(p); break;
            case 'ending': this.prompts.ending(); break;
            case 'shop': this.menus.show('shop', { stock: p.stock, cards: p.cards, pending: true }, false); break;
            case 'bench': this.menus.show('bench', { pending: true }, false); break;
            case 'locker': this.menus.show('locker', { pending: true }, false); break;
            default: this.respond(null);
        }
    }
    respond(v) {
        if (!this.game) return;
        this.shown = null;
        this.game.respond(v);
        this.hud.objective(this.game.objective().text);
    }
    onPanelClosed() { this.view.ow.refreshFollower && this.game && this.view.ow.refreshFollower(this.game); }

    // ------------------------------------------------------------------ battles
    enterBattle(spec) {
        const g = this.game;
        this.setMode('battle-intro');
        audio.sfx('encounter');
        const theme = spec.titan ? 'titan' : spec.cls === 'champion' ? 'champion' : spec.cls === 'four' ? 'elite' : spec.leader || spec.cls === 'baron' || spec.cls === 'exec' ? 'leader' : spec.cls ? 'trainer' : 'battle';
        audio.music(theme);
        const lead = g.world.map;
        const leader = spec.leader ? spec.leader : 0;
        const leaderType = leader && leader <= 8 ? ['gear', 'steam', 'volt', 'grit', 'hydro', 'toxic', 'frost', 'aero'][leader - 1] : leader === 9 ? 'iron' : leader === 10 ? 'signal' : leader === 11 ? 'rust' : leader === 12 ? 'void' : leader === 13 ? 'gear' : null;
        this.view.transition(() => {
            this.view.startBattle({ kind: spec.cls ? 'trainer' : 'wild', look: spec.look || (spec.cls ? null : null), name: spec.name, leader: !!leader || spec.cls === 'baron', leaderType, titan: spec.titan, playerLook: g.state.look }, g.world);
            this.battleUI.show(spec);
            this.setMode('battle');
            this.battleUI.play(g.takeBattleEvents()).then(() => this.nextBattleStep());
        }, 1.8);
        void lead;
    }
    nextBattleStep() {
        const g = this.game, b = g.battle;
        if (!b || this.mode !== 'battle') return;
        if (b.over) { this.finishBattle(b.result); return; }
        if (b.need === 'switch') this.battleUI.team(true);
        else this.battleUI.command();
    }
    battleChoose(action) {
        const g = this.game;
        if (!g.battle || this.battleUI.playing) return;
        this.battleUI.hideMenu();
        const evs = g.battleChoose(action);
        this.battleUI.play(evs).then(() => this.nextBattleStep());
    }
    finishBattle(result) {
        if (result === 'win' || result === 'caught') audio.music('victory');
        setTimeout(() => {
            this.view.transition(() => {
                this.battleUI.hide();
                this.view.endBattle();
                this.game.closeBattle();
                if (this.game.world !== this.lastWorld) this.worldChanged();
                else { this.view.ow.refreshFollower(this.game); audio.music(this.musicFor()); }
                this.setMode('world');
                this.hud.objective(this.game.objective().text);
                this.saveNow();
            }, 2.2);
        }, (result === 'win' ? 900 : 500) / this.fast);
    }

    /** Sounds for battle events. */
    sound(e) {
        const S = (n, o) => audio.sfx(n, o);
        switch (e.t) {
            case 'send': S('send'); break;
            case 'move': {
                const mt = MOVES[e.move].type;
                const k = { steam: 'steam', blaze: 'fire', hydro: 'water', frost: 'ice', volt: 'zap', grit: 'grind', aero: 'wind', iron: 'clang', gear: 'gear', toxic: 'acid', moss: 'leaf', piston: 'punch', signal: 'signal', rust: 'rust', void: 'void' }[mt];
                if (k && MOVES[e.move].cat !== 'U') S(k); else S('stat', { up: true });
                break;
            }
            case 'hit': if (!e.chip) S(e.eff >= 2 ? 'superhit' : e.eff < 1 ? 'weakhit' : 'hit'); else S('weakhit'); if (e.crit) S('crit'); break;
            case 'miss': S('miss'); break;
            case 'faint': S('faint'); break;
            case 'status': if (e.st) S('status'); break;
            case 'stat': S('stat', { up: e.n > 0 }); break;
            case 'heal': S('heal'); break;
            case 'level': S('levelup'); break;
            case 'item': S('item'); break;
            case 'spike': {
                S('throw');
                const n = Math.min(3, e.shakes);
                for (let i = 0; i < n; i++) setTimeout(() => S('shake'), (1300 + i * 550) / this.fast);
                setTimeout(() => S(e.caught ? 'caught' : 'breakout'), (1300 + n * 550 + 100) / this.fast);
                break;
            }
            case 'atm': if (e.k) S(e.k === 'static' ? 'zap' : e.k === 'rain' ? 'water' : e.k === 'heat' ? 'fire' : 'wind'); break;
        }
    }

    // ------------------------------------------------------------------ world events
    worldEvents() {
        const g = this.game;
        for (const e of g.events.splice(0)) {
            switch (e.t) {
                case 'step': if (g.state.steps % 2 === 0 || e.run) audio.sfx('step'); break;
                case 'bump': audio.sfx('bump'); break;
                case 'ledge': audio.sfx('ledge'); break;
                case 'tool': audio.sfx('tool'); break;
                case 'skiff': if (e.on) audio.sfx('skiff'); break;
                case 'toast': this.hud.toast(e.text); break;
                case 'objective': this.hud.objective(g.objective().text); break;
                case 'spotted': audio.sfx('spotted'); this.hud.mark(e.key); break;
                case 'item': audio.sfx('item'); break;
                case 'gotBot': audio.sfx('caught'); this.view.ow.refreshFollower(g); break;
                case 'healed': audio.sfx('heal'); break;
                case 'seal': audio.sfx('seal'); break;
                case 'dig': audio.sfx('dig'); break;
                case 'repaired': audio.sfx('build'); break;
                case 'fx': if (e.name === 'quake') this.view.ow.camera.position.y += 0.6; break;
                case 'battleStart': this.enterBattle(e.spec); break;
                case 'enterMap': {
                    audio.sfx('door');
                    const m = MAPS[e.id];
                    if (m.kind !== 'interior' || e.first) this.hud.banner(m.name, m.sub || (m.kind === 'route' ? 'Wild COM-bots lurk in the scrap drifts' : m.kind === 'dungeon' ? 'Stay close to the light' : ''));
                    this.view.transition(() => this.worldChanged(), 4);
                    this.lastWorld = g.world;
                    this.hud.objective(g.objective().text);
                    this.saveT = 1e9;     // save shortly after arriving
                    break;
                }
            }
        }
    }

    // ------------------------------------------------------------------ the loop
    frame(dt) {
        const inp = this.input;
        if (this.mode === 'title' || this.mode === 'new') {
            if (this.menus.open) this.menuKeys();
            else if (this.screens.open) {
                for (const d of ['up', 'down', 'left', 'right']) if (inp.hit(d)) navMove(this.screens.root, d);
                if (inp.hit('a') && !(document.activeElement && document.activeElement.tagName === 'INPUT')) this.screens.press();
                if (inp.hit('b') && this.screens.kind === 'new') this.toTitle();
            }
            if (this.demo) { this.demo.update(dt, {}); this.view.frame(dt, this.demo); }
            return;
        }
        const g = this.game;
        if (!g) { this.view.frame(dt, null); return; }
        if (this.mode === 'battle' || this.mode === 'battle-intro') {
            if (this.prompts.open) this.promptKeys();
            else {
                const menu = $('bmenu');
                for (const d of ['up', 'down', 'left', 'right']) if (inp.hit(d) && menu && !menu.classList.contains('hidden')) { navMove(menu, d); audio.sfx('blip'); }
                if (inp.hit('a')) { if (this.battleUI.playing) this.battleUI.press(); else { const f = document.activeElement; if (f && menu && menu.contains(f)) f.click(); } }
                if (inp.hit('b')) this.battleUI.back();
            }
        } else if (this.mode === 'world') {
            // Decide before the UI eats this frame's presses: the A that closes a line must not also talk again.
            const free = !this.menus.open && !this.dialog.open && !this.prompts.open && !g.pending && this.view.iris === 0;
            if (this.prompts.open) this.promptKeys();
            else if (this.menus.open) this.menuKeys();
            else if (this.dialog.open) {
                if (inp.hit('a')) this.dialog.press();
                else if (inp.hit('b')) this.dialog.back();
                const ch = $('dchoices');
                if (ch && !ch.classList.contains('hidden')) for (const d of ['up', 'down', 'left', 'right']) if (inp.hit(d)) navMove(ch, d);
                if (ch && !ch.classList.contains('hidden') && inp.hit('a') && document.activeElement && ch.contains(document.activeElement)) document.activeElement.click();
            } else if (free && !g.battle && inp.hit('menu')) { audio.sfx('select'); this.menus.show('menu', {}); }
            const sdt = dt * (DEBUG ? this.fast : 1);
            g.update(sdt, free && !this.menus.open ? { dir: inp.dir(), run: inp.run(), a: inp.hit('a') } : {});
            this.worldEvents();
            if (g.world !== this.lastWorld) { this.lastWorld = g.world; this.view.transition(() => this.worldChanged(), 4); }
            if (!g.battle) this.showPending();
            this.saveT += dt;
            if (this.saveT > 1e8 || this.saveT > 45) { if (!g.pending && !g.battle) this.saveNow(); }
        }
        this.dialog.tick(dt * this.fast);
        this.hud.update(dt);
        this.view.frame(dt, g);
    }
    menuKeys() {
        const inp = this.input;
        for (const d of ['up', 'down', 'left', 'right']) if (inp.hit(d) || inp.hit(d + 'R')) { navMove(this.menus.root, d); audio.sfx('blip'); }
        if (inp.hit('a')) { const f = document.activeElement; if (f && this.menus.root.contains(f) && f.tagName === 'BUTTON') f.click(); }
        if (inp.hit('b') || inp.hit('menu')) { audio.sfx('back'); this.menus.back(); }
    }
    promptKeys() {
        const inp = this.input;
        for (const d of ['up', 'down', 'left', 'right']) if (inp.hit(d)) navMove(this.prompts.root, d);
        if (inp.hit('a')) this.prompts.press();
        if (inp.hit('b')) this.prompts.back();
    }
}

const app = new App();
let last = performance.now(), fpsN = 0, fpsT = 0;
function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, DEBUG ? 0.2 : 0.1);
    fpsN++; fpsT += dt;
    if (fpsT >= 1) { app.view.r.sampleFps(fpsN / fpsT); fpsN = 0; fpsT = 0; }
    try { app.frame(dt); } catch (err) { console.error(err); }
    app.input.clear();
    window.__frames = app.view.frameNo;
}

// ------------------------------------------------------------------ boot
if (params.get('quick')) {
    const g = new Game(newState({ name: 'Tester', seed: +(params.get('seed') || 7) }));
    g.frames.length = 0; g.pending = null;
    g.state.story = 2;
    g.state.flags.starter = 'Embrit'; g.state.flags.maTalked = true;
    const u = makeUnit(new RNG(3), BY_NAME[(params.get('starter') || 'embrit').toLowerCase()].id, +(params.get('lv') || 8));
    g.addUnit(u);
    Object.assign(g.state.bag, { registry: 1, 'reboot-spike': 10, 'patch-kit': 5, 'steam-boots': 1 });
    g.placeAt(params.get('map') || 'cinderwick', +(params.get('x') || 11), +(params.get('y') || 7), 'down');
    app.begin(g);
} else app.toTitle();
requestAnimationFrame(loop);

// ------------------------------------------------------------------ debug hooks
if (DEBUG) {
    window.__rt = {
        app, view: app.view, audio,
        get game() { return app.game; }, get mode() { return app.mode; }, get world() { return app.game && app.game.world; },
        tp(map, x, y, dir = 'down') { app.game.placeAt(map, x, y, dir); },
        give(id, n = 1) { app.game.give(id, n); },
        bot(name, lv = 10) { const u = makeUnit(app.game.rng, BY_NAME[name.toLowerCase()].id, lv); return app.game.addUnit(u); },
        wild(name, lv = 5) { const g = app.game; g.startBattle('wild', [makeUnit(g.rng, BY_NAME[name.toLowerCase()].id, lv, { uid: -g.nextUid() })], { kind: 'wild' }); },
        heal() { app.game.healAll(); },
        story(n) { app.game.state.story = n; },
        species: SPECIES,
        frames() { return app.view.frameNo; },
    };
}
