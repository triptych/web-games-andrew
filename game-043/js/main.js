// ============================================================
// GLIMMERGLEN — boot, the canvas, the loop, and input routing.
// ============================================================

import { Game } from './sim/index.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Sprites } from './render/sprites.js';
import { WorldRenderer } from './render/world.js';
import { UI } from './ui/ui.js';
import { generateWorld } from './gen/world.js';
import { $ } from './ui/dom.js';
import { Overlay } from './render/overlay.js';

function fail(msg) { const f = $('#fail'); f.hidden = false; f.textContent = msg; }

try { boot(); } catch (e) { console.error(e); fail('Something went wrong starting GLIMMERGLEN: ' + e.message); }

function boot() {
    const canvas = $('#screen');
    if (!canvas.getContext) return fail('Your browser cannot draw the game (no canvas).');
    const input = new Input();
    const audio = new Audio();
    const sprites = new Sprites(null);
    const overlay = new Overlay($('#overlay'));
    const renderer = new WorldRenderer(canvas, sprites);
    renderer.ov = overlay;
    const makeGame = (state, opts) => state ? new Game(state) : Game.create(opts);
    const ui = new UI({ sprites, audio, input, makeGame, renderer });
    const glenNames = new Map();
    ui.previewGlenName = seed => { if (!glenNames.has(seed)) glenNames.set(seed, generateWorld(seed).glen.name); return glenNames.get(seed); };
    input.bindTouch($('#stick-zone'), $('#stick'), $('#knob'), $('#b-a'), $('#b-b'));
    window.__glim = { ui, get game() { return ui.game; }, input, audio, renderer };

    // ------------------------------------------------------------ sizing: a whole number of device pixels per game pixel
    const view = ui.view = { scale: 3, dpr: 1, W: 320, H: 200 };
    function resize() {
        const dpr = window.devicePixelRatio || 1;
        const cw = window.innerWidth, ch = window.innerHeight;
        const devW = Math.round(cw * dpr), devH = Math.round(ch * dpr);
        const short = Math.min(cw, ch);
        const tiles = short < 520 ? 12.5 : short < 800 ? 15 : 17;
        const scale = Math.max(1, Math.round(Math.min(devW, devH) / (tiles * 16)));
        const W = Math.ceil(devW / scale), H = Math.ceil(devH / scale);
        canvas.width = W; canvas.height = H;
        canvas.style.width = (W * scale / dpr) + 'px'; canvas.style.height = (H * scale / dpr) + 'px';
        Object.assign(view, { scale, dpr, W, H });
        renderer.resize(W, H);
        overlay.resize(W * scale, H * scale, W * scale / dpr, H * scale / dpr, scale, dpr);
        const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
        document.body.classList.toggle('portrait', ch >= cw);
        document.body.classList.toggle('landscape', ch < cw);
    }
    addEventListener('resize', resize);
    resize();

    // ------------------------------------------------------------ title backdrop: a real world, gently panning
    let titleGame = null;
    const titleBackdrop = () => {
        titleGame = Game.create({ seed: 20260925, name: 'Guest', look: { skin: 2, hair: 1, hairColor: 3, eyes: 0, top: 3, bottom: 9, acc: 1 } });
        titleGame.s.time.min = 17 * 60 + 40;
        sprites.game = titleGame;
        renderer.setGame(titleGame);
    };
    ui.onTitle = () => { titleBackdrop(); };
    titleBackdrop();
    ui.title();

    // ------------------------------------------------------------ keyboard shortcuts
    input.on('key', k => {
        audio.init(); audio.resume();
        const g = ui.game;
        if (ui.dlg) { if ([' ', 'e', 'enter', 'j', 'escape', 'x'].includes(k)) ui.advanceDialog(); return; }
        if (ui.panels.isOpen()) { if (k === 'escape' || k === 'x' || k === 'i' || k === 'tab' || (k === 'm' && ui.panels.kind === 'map')) ui.panels.close(); return; }
        if (!g || ui.mode !== 'play' || g.rt.battle || ui.cutsceneOn) return;
        if (k >= '1' && k <= '8') { g.s.sel = +k - 1; ui.renderHotbar(); }
        else if (k === 'q' || k === 'r') { g.s.sel = (g.s.sel + (k === 'r' ? 1 : 7)) % 8; ui.renderHotbar(); }
        else if (k === 'escape' || k === 'i' || k === 'tab') ui.panels.open('menu');
        else if (k === 'm') ui.panels.open('map');
        else if (k === 'l') ui.panels.open('menu', { tab: 'journal' });
    });
    $('#dialog').addEventListener('pointerdown', e => { if (e.target.closest('#dlg-choices button')) return; ui.advanceDialog(); });
    canvas.addEventListener('pointerdown', () => { audio.init(); audio.resume(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else audio.resume(); });

    // ------------------------------------------------------------ the loop
    let last = performance.now(), titleT = 0;
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const g = ui.game;
        const gctx = canvas.getContext('2d');
        overlay.clear();
        if (ui.mode !== 'play' || !g) {
            // title/creator: pan across the title world at dusk
            titleT += dt;
            if (titleGame) {
                const w = titleGame.world;
                titleGame.p.x = w.cx + Math.cos(titleT * 0.05) * 14; titleGame.p.y = w.cy + 4 + Math.sin(titleT * 0.07) * 9;
                titleGame.rt.t += dt; titleGame.updateNpcs(dt);
                renderer.draw(dt);
            }
        } else {
            const inp = input.read();
            if (g.rt.battle) ui.battle.draw(gctx, view.W, view.H, dt, overlay);
            else {
                if (ui.dlg && inp.act) ui.advanceDialog();
                else if (!ui.modal()) {
                    g.update(dt, { mx: inp.mx, my: inp.my, run: inp.run || ui.opts.run });
                    if (inp.act) g.action();
                } else g.rt.moving = false;
                if (g.rt.battle) ui.battle.draw(gctx, view.W, view.H, dt, overlay); else renderer.draw(dt);
            }
            ui.updateHud();
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
