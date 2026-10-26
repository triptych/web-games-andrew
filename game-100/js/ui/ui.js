// The whole interface, drawn into one small canvas that the stage lays over the 3D picture and
// sends through the CRT tube: the power screen, the boot pre-roll, the attract loop (logo, demo
// play, high scores, how to play), menus, the HUD, pause, game over and the arcade
// initials entry. There is no DOM UI: every control is a rectangle registered while drawing,
// and keys, pointers and the gamepad all reach it as "actions".
//
// The canvas is a whole number of CSS pixels per UI pixel (never less than 2 per pixel), so the
// text is a chunky retro size on a phone and still crisp on a big monitor.

import { Gfx, PAL, RAINBOW, STRIPES, commas } from './gfx.js';
import { MODES, ROOMS, VERSION, SP, HIGHSCORES, levelScore } from '../config.js';
import { loadScores, hasSave, bestScore } from '../save.js';

const ATTRACT = [
    { page: 'logo', secs: 6.5 }, { page: 'demo', secs: 13 }, { page: 'scores', mode: 'dance', secs: 7 },
    { page: 'how', secs: 8 }, { page: 'demo', secs: 13 }, { page: 'scores', mode: 'jam', secs: 7 },
];
const BOOT_LINES = [
    ['GLITTERBALL GROOVE ENTERTAINMENT SYSTEM', null],
    ['BIOS V' + VERSION + '  (C) 1977 G.G. SOFT', null],
    ['', null],
    ['CPU DISCO-6502 1.18MHZ', 'OK'],
    ['RAM 64K', 'OK'],
    ['ROM CHECKSUM', 'OK'],
    ['VIDEO 3 DIMENSIONS', 'OK'],
    ['SOUND FUNK CHIP 4-VOICE', 'OK'],
    ['MIRRORBALL', 'SPINNING'],
    ['', null],
    ['LOADING GROOVE', 'BAR'],
];
const KEYPAD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const CRT_NAMES = { full: 'FULL', lite: 'LITE', off: 'OFF' };
const CRT_CYCLE = ['full', 'lite', 'off'];

const wrap = (text, max) => {
    const out = [];
    let line = '';
    for (const word of text.split(' ')) {
        if ((line + ' ' + word).trim().length > max) { out.push(line.trim()); line = word; } else line += ' ' + word;
    }
    if (line.trim()) out.push(line.trim());
    return out;
};

export class UI {
    constructor({ settings, onSettings }) {
        this.canvas = document.createElement('canvas');
        this.gfx = new Gfx(this.canvas);
        this.settings = settings;
        this.onSettings = onSettings;
        this.VW = 240; this.VH = 135; this.f = 4;
        this.layout = null;
        this.screen = 'power';
        this.t = 0;
        this.sel = 0;
        this.data = {};
        this.back = 'menu';
        this.hits = [];
        this.downHit = null;
        this.popups = [];
        this.banners = [];
        this.timeFlash = null;
        this.dispScore = 0;
        this.attractI = 0;
        this.attractT = 0;
        this.entry = { name: ['A', 'A', 'A'], pos: 0 };
        this.howPage = 0;
        this.scoreMode = 'dance';
        this.idle = 0;
        this.lastDevice = 'keys';
    }

    // ------------------------------------------------------------------ size and layout
    /** vw, vh in CSS px. Returns the board rectangle in CSS px for the stage. */
    resize(vw, vh) {
        const S = Math.max(2, Math.round(Math.min(vw, vh) / 235));
        const VW = Math.max(120, Math.floor(vw / S)), VH = Math.max(120, Math.floor(vh / S));
        if (this.canvas.width !== VW || this.canvas.height !== VH) { this.canvas.width = VW; this.canvas.height = VH; this.gfx.icons.clear(); }
        this.VW = VW; this.VH = VH; this.f = vw / VW; this.fy = vh / VH; this.vw = vw; this.vh = vh;
        this.layout = this.computeLayout();
        return this.layout;
    }

    get minPx() { return Math.ceil(44 / Math.min(this.f, this.fy)); }

    computeLayout() {
        const { VW, VH } = this;
        const portrait = VH > VW;
        const mg = Math.max(5, Math.round(Math.min(VW, VH) * 0.045));
        const P = Math.max(18, this.minPx);
        const L = { portrait, mg, P };
        if (portrait) {
            const top = mg + P + 22, bottom = 42 + mg;
            const size = Math.min(VW - 2 * Math.max(4, mg - 2), VH - top - bottom);
            L.board = { cx: VW / 2, cy: top + (VH - top - bottom) / 2, size };
            L.pause = { x: VW - mg - P, y: mg, w: P, h: P };
            L.top = top; L.bottom = bottom;
        } else {
            const topSafe = Math.max(mg, Math.ceil(44 / this.fy));
            const size = Math.min(VH - 2 * mg, VW * 0.62);
            const side = (VW - size) / 2;
            L.board = { cx: VW / 2, cy: VH / 2 + 1, size };
            L.left = { x: mg, y: topSafe, w: Math.max(48, side - mg - 3), h: VH - topSafe - mg };
            L.right = { x: VW - mg - Math.max(48, side - mg - 3), y: mg, w: Math.max(48, side - mg - 3), h: VH - 2 * mg };
            L.pause = { x: L.right.x + L.right.w - P, y: mg, w: P, h: P };
        }
        return L;
    }

    /** The board rect in CSS px (for the stage). */
    boardCss() {
        const b = this.layout.board;
        return { cx: b.cx * this.f, cy: b.cy * this.fy, size: b.size * Math.min(this.f, this.fy) };
    }

    // ------------------------------------------------------------------ screens
    go(screen, data = {}) {
        if (screen === 'settings' || screen === 'howto' || screen === 'scores' || screen === 'confirm') {
            if (!['settings', 'howto', 'scores', 'confirm'].includes(this.screen)) this.back = this.screen;
        }
        this.screen = screen;
        this.t = 0;
        this.sel = 0;
        this.data = data;
        this.idle = 0;
        if (screen === 'entry') this.entry = { name: ['A', 'A', 'A'], pos: 0 };
        if (screen === 'howto') this.howPage = 0;
        if (screen === 'attract') { this.attractI = 0; this.attractT = 0; }
        if (screen === 'hud') { this.popups.length = 0; this.banners.length = 0; this.dispScore = 0; this.timeFlash = null; }
    }

    get attractPage() { return ATTRACT[this.attractI % ATTRACT.length]; }

    /** What the 3D side should show for the current screen. */
    scene() {
        const s = this.screen;
        if (s === 'power') return { board: false, dim: 0, demo: false };
        if (s === 'boot') return { board: false, dim: Math.min(1, Math.max(0, (this.t - 3.2) / 1.5)) * 0.6, demo: false };
        if (s === 'attract') { const p = this.attractPage.page; return { board: p === 'demo', dim: p === 'demo' ? 1 : 0.85, demo: p === 'demo' }; }
        if (s === 'hud' || s === 'ready' || s === 'pause' || s === 'over') return { board: true, dim: 1, demo: false };
        if (s === 'entry') return { board: false, dim: 0.9, demo: false };
        return { board: false, dim: 0.9, demo: false };
    }

    // ------------------------------------------------------------------ menus
    menuItems() {
        const st = this.settings;
        switch (this.screen) {
            case 'menu':
                return [
                    ...(hasSave() ? [{ id: 'continue', label: 'CONTINUE' }] : []),
                    { id: 'play', label: 'PLAY' }, { id: 'scores', label: 'HIGH SCORES' }, { id: 'howto', label: 'HOW TO PLAY' }, { id: 'settings', label: 'SETTINGS' },
                ];
            case 'modes':
                return [
                    { id: 'start:dance', label: MODES.dance.name, sub: MODES.dance.blurb }, { id: 'start:jam', label: MODES.jam.name, sub: MODES.jam.blurb },
                    { id: 'back', label: 'BACK' },
                ];
            case 'pause':
                return [{ id: 'resume', label: 'RESUME' }, { id: 'restart', label: 'RESTART' }, { id: 'settings', label: 'SETTINGS' }, { id: 'savequit', label: 'SAVE & QUIT' }, { id: 'quit', label: 'QUIT' }];
            case 'settings':
                return [
                    { id: 'sfx', label: 'SOUND', kind: 'slider', value: st.sfx },
                    { id: 'music', label: 'MUSIC', kind: 'slider', value: st.music },
                    { id: 'crt', label: 'CRT TUBE', kind: 'choice', text: CRT_NAMES[st.crt] || 'FULL' },
                    { id: 'calm', label: 'CALM FX', kind: 'choice', text: st.calm ? 'ON' : 'OFF' },
                    { id: 'quality', label: 'QUALITY', kind: 'choice', text: { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }[st.quality] || 'HIGH' },
                    { id: 'hints', label: 'HINTS', kind: 'choice', text: st.hints ? 'ON' : 'OFF' },
                    { id: 'clear', label: 'CLEAR SCORES' },
                    { id: 'back', label: 'BACK' },
                ];
            case 'confirm':
                return [{ id: 'clear:yes', label: 'YES, WIPE THEM' }, { id: 'clear:no', label: 'NO' }];
            case 'over':
                return this.data.rank >= 0
                    ? [{ id: 'entry', label: 'ENTER INITIALS' }, { id: 'again', label: 'PLAY AGAIN' }, { id: 'menu', label: 'MENU' }]
                    : [{ id: 'again', label: 'PLAY AGAIN' }, { id: 'menu', label: 'MENU' }];
            default: return [];
        }
    }

    /** Apply a settings change from a menu row. dir: -1, +1, or null for "tap". x01: position along a slider. */
    change(item, dir, x01) {
        const st = this.settings;
        const clamp01 = (v) => Math.max(0, Math.min(1, Math.round(v * 20) / 20));
        if (item.id === 'sfx' || item.id === 'music') st[item.id] = clamp01(x01 != null ? x01 : st[item.id] + (dir || 1) * 0.1);
        else if (item.id === 'crt') st.crt = CRT_CYCLE[(CRT_CYCLE.indexOf(st.crt) + (dir || 1) + 3) % 3];
        else if (item.id === 'calm') st.calm = !st.calm;
        else if (item.id === 'quality') st.quality = { high: 'medium', medium: 'low', low: 'high' }[st.quality] || 'high';
        else if (item.id === 'hints') st.hints = !st.hints;
        this.onSettings(st, item.id);
        return null;
    }

    /** A key press (from the queue). Returns an action id or null. */
    key(press) {
        this.idle = 0;
        const k = press.key;
        const s = this.screen;
        if (press.pad) this.lastDevice = 'pad'; else this.lastDevice = 'keys';
        if (s === 'power') return 'poweron';
        if (s === 'boot') return k === 'Enter' || k === 'Escape' ? 'skipboot' : null;
        if (s === 'attract') return 'menu';
        if (s === 'entry') return this.entryKey(press);
        if (s === 'howto') {
            if (k === 'ArrowRight' || k === 'Enter') { if (this.howPage < 2) { this.howPage++; return 'blip'; } return 'back'; }
            if (k === 'ArrowLeft') { if (this.howPage > 0) { this.howPage--; return 'blip'; } return null; }
            if (k === 'Escape') return 'back';
            return null;
        }
        if (s === 'scores') {
            if (k === 'ArrowLeft' || k === 'ArrowRight') { this.scoreMode = this.scoreMode === 'dance' ? 'jam' : 'dance'; return 'blip'; }
            if (k === 'Enter' || k === 'Escape') return 'back';
            return null;
        }
        const items = this.menuItems();
        if (!items.length) return null;
        if (s === 'over' && this.t < 0.9) return null;
        if (k === 'ArrowUp') { this.sel = (this.sel + items.length - 1) % items.length; return 'blip'; }
        if (k === 'ArrowDown') { this.sel = (this.sel + 1) % items.length; return 'blip'; }
        const it = items[this.sel];
        if (s === 'settings' && (k === 'ArrowLeft' || k === 'ArrowRight') && it.kind) { this.change(it, k === 'ArrowLeft' ? -1 : 1); return 'blip'; }
        if (k === 'Escape') return s === 'pause' ? 'resume' : s === 'menu' ? null : s === 'over' ? 'menu' : 'back';
        if (k === 'Enter') return this.activate(it);
        return null;
    }

    activate(it) {
        if (it.kind === 'slider' || it.kind === 'choice') { this.change(it, 1); return 'blip'; }
        if (it.id === 'clear') return 'confirm';
        return it.id;
    }

    entryKey(press) {
        const e = this.entry, k = press.key;
        const letter = /^Key([A-Z])$/.exec(press.raw || '');
        if (letter) { e.name[e.pos] = letter[1]; if (e.pos < 2) e.pos++; return 'type'; }      // WASD are letters here, not arrows
        if (k === 'ArrowUp') e.name[e.pos] = String.fromCharCode(((e.name[e.pos].charCodeAt(0) - 65 + 1) % 26) + 65);
        else if (k === 'ArrowDown') e.name[e.pos] = String.fromCharCode(((e.name[e.pos].charCodeAt(0) - 65 + 25) % 26) + 65);
        else if (k === 'ArrowLeft') e.pos = Math.max(0, e.pos - 1);
        else if (k === 'ArrowRight') e.pos = Math.min(2, e.pos + 1);
        else if (press.raw === 'Backspace') { if (e.pos > 0 || e.name[0] !== 'A') { e.name[e.pos] = 'A'; e.pos = Math.max(0, e.pos - 1); } return 'type'; }
        else if (k === 'Enter') { if (e.pos < 2) { e.pos++; return 'type'; } return 'entrydone'; }
        else if (press.ch && /^[a-zA-Z]$/.test(press.ch)) { e.name[e.pos] = press.ch.toUpperCase(); if (e.pos < 2) e.pos++; return 'type'; }
        else return null;
        return 'blip';
    }

    // ------------------------------------------------------------------ pointer
    hitAt(x, y) {
        for (let i = this.hits.length - 1; i >= 0; i--) {
            const h = this.hits[i];
            if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h;
        }
        return null;
    }
    addHit(id, x, y, w, h, extra = {}) {
        // every control is at least a finger wide
        const mw = Math.max(w, this.minPx), mh = Math.max(h, this.minPx);
        this.hits.push({ id, x: x - (mw - w) / 2, y: y - (mh - h) / 2, w: mw, h: mh, ...extra });
    }

    /** A pointer event already mapped to UI px. Returns an action id or null. */
    pointer(type, x, y) {
        this.idle = 0;
        const s = this.screen;
        if (type === 'down') {
            this.downHit = this.hitAt(x, y);
            if (s === 'power') return 'poweron';
            if (s === 'boot') return 'skipboot';
            if (s === 'attract') return 'menu';
            const h = this.downHit;
            if (h && h.item !== undefined && this.screen !== 'hud') this.sel = h.item;
            if (h && h.slider) { const items = this.menuItems(); this.change(items[h.item], null, (x - h.bx) / h.bw); return 'blip'; }
            return null;
        }
        if (type === 'move') {
            const h = this.downHit;
            if (h && h.slider) { const items = this.menuItems(); this.change(items[h.item], null, (x - h.bx) / h.bw); }
            return null;
        }
        if (type === 'up') {
            const h = this.hitAt(x, y), d = this.downHit;
            this.downHit = null;
            if (!h || !d || h.id !== d.id) return null;
            if (h.slider) return null;
            return this.fromHit(h);
        }
        return null;
    }

    fromHit(h) {
        const id = h.id;
        if (id === 'pause') return 'pause';
        if (id.startsWith('k:')) return this.entryTap(id.slice(2));
        if (id === 'howprev') { this.howPage = Math.max(0, this.howPage - 1); return 'blip'; }
        if (id === 'hownext') { if (this.howPage < 2) { this.howPage++; return 'blip'; } return 'back'; }
        if (id === 'scoretab') { this.scoreMode = h.mode; return 'blip'; }
        if (id === 'scoreback') return 'back';
        if (this.screen === 'over' && this.t < 0.9) return null;
        const items = this.menuItems();
        const it = items.find((x) => x.id === id);
        if (it) return this.activate(it);
        return id;
    }

    entryTap(k) {
        const e = this.entry;
        if (k === 'DEL') { e.name[e.pos] = 'A'; e.pos = Math.max(0, e.pos - 1); return 'type'; }
        if (k === 'OK') return 'entrydone';
        if (k.startsWith('pos')) { e.pos = +k.slice(3); return 'blip'; }
        if (k === 'up' || k === 'down') { e.name[e.pos] = String.fromCharCode(((e.name[e.pos].charCodeAt(0) - 65 + (k === 'up' ? 1 : 25)) % 26) + 65); return 'blip'; }
        e.name[e.pos] = k;
        if (e.pos < 2) e.pos++;
        return 'type';
    }

    // ------------------------------------------------------------------ events from the game
    onEvents(G, events, ctx) {
        for (const e of events) {
            if (e.type === 'wave') {
                const p = ctx.project(e.r, e.c);
                const col = e.fever ? PAL.yellow : e.combo >= 6 ? PAL.magenta : e.combo >= 3 ? PAL.orange : PAL.white;
                this.popups.push({ text: '+' + commas(e.pts), x: p.x, y: p.y, t: 0, dur: 1.0, color: col, scale: e.pts >= 1000 ? 2 : 1 });
                if (e.combo >= 3 && e.shout) this.banner(e.shout + (e.combo >= 4 ? ' X' + e.combo : ''), e.combo >= 6 ? RAINBOW : [PAL.yellow], 0.9, e.combo >= 8 ? 3 : 2);
            } else if (e.type === 'make') {
                const p = ctx.project(e.r, e.c);
                const name = e.sp === SP.MIRROR ? 'GLITTERBALL!' : e.sp === SP.BOMB ? 'BOOM BOX!' : 'FUNK BEAM!';
                this.popups.push({ text: name, x: p.x, y: p.y - 8, t: 0, dur: 1.2, color: PAL.cyan, scale: 1 });
            } else if (e.type === 'bonus' && e.amount > 0) {
                this.timeFlash = { text: (e.time ? '+' + e.amount + 'S' : '+' + e.amount + ' MOVE' + (e.amount > 1 ? 'S' : '')), t: 0 };
            } else if (e.type === 'fever') this.banner('DISCO FEVER!', RAINBOW, 1.8, 3);
            else if (e.type === 'feverEnd') this.banner('COOL DOWN', [PAL.cyan], 0.8, 2);
            else if (e.type === 'level') this.banner('LEVEL ' + e.level + '  ' + ROOMS[(e.level - 1) % ROOMS.length].name, RAINBOW, 2.0, 2);
            else if (e.type === 'timeup') this.banner(G.time <= 0 && MODES[G.mode].time ? "TIME'S UP!" : 'LAST MOVE!', [PAL.red], 1.4, 3);
            else if (e.type === 'shuffle') this.banner('SHUFFLE!', [PAL.cyan], 0.9, 2);
            else if (e.type === 'combo') this.banner(e.kind === 'all' ? 'WHOLE FLOOR!' : e.kind === 'convert' ? 'DOUBLE GROOVE!' : 'MEGA MOVE!', RAINBOW, 1.4, 3);
        }
    }
    banner(text, colors, dur = 1, scale = 2) {
        this.banners.push({ text, colors, t: 0, dur, scale });
        if (this.banners.length > 3) this.banners.shift();
    }

    // ------------------------------------------------------------------ drawing
    /** ctx: { G, time, beat, fever, hi, countdown, project, hurry, calm, ranks } */
    draw(dt, time, c) {
        const g = this.gfx;
        g.clear();
        this.hits.length = 0;
        this.t += dt;
        this.idle += dt;
        this.time = time;
        this.c = c;
        this.calm = !!this.settings.calm;
        switch (this.screen) {
            case 'power': this.drawPower(); break;
            case 'boot': this.drawBoot(); break;
            case 'attract': this.drawAttract(dt, c); break;
            case 'menu': this.drawMenu(); break;
            case 'modes': this.drawModes(); break;
            case 'scores': this.drawScoresScreen(); break;
            case 'howto': this.drawHowTo(); break;
            case 'settings': this.drawSettings(); break;
            case 'confirm': this.drawConfirm(); break;
            case 'ready': this.drawHud(dt, c); this.drawReady(c); break;
            case 'hud': this.drawHud(dt, c); break;
            case 'pause': this.drawHud(dt, c); this.drawPause(); break;
            case 'over': this.drawOver(); break;
            case 'entry': this.drawEntry(); break;
            default: break;
        }
        // the fade in and out of the tube is the stage's job; this just flashes a hint when idle
    }

    // ---- the power screen: a console that is off
    drawPower() {
        const g = this.gfx, { VW, VH } = this;
        const on = this.calm || Math.floor(this.time * 1.6) % 2 === 0;
        g.rect(VW / 2 - 2, VH / 2 - 14, 4, 4, on ? PAL.red : '#4a0a14');
        const lines = this.lastDevice === 'touch' ? ['TAP TO POWER ON'] : ['PRESS ANY KEY', 'TO POWER ON'];
        const fit = this.fit('TAP TO POWER ON', VW - 20, 2);
        lines.forEach((l, i) => g.text(l, VW / 2, VH / 2 + i * (8 * fit + 2), on ? PAL.cream : PAL.dim, { align: 'center', scale: fit }));
        g.text('(C) 1977 G.G. SOFT', VW / 2, VH - 14, '#4a3a6a', { align: 'center' });
    }

    /** Text size for menu rows: about 30 CSS px tall, whatever the pixel scale. */
    get menuScale() { return Math.max(1, Math.min(2, Math.round(30 / (7 * Math.min(this.f, this.fy))))); }
    /** The biggest a title may be: about 55 CSS px tall. */
    get titleMax() { return Math.max(2, Math.min(4, Math.round(55 / (7 * Math.min(this.f, this.fy))))); }
    scrim(x, y, w, h, a = 0.62) { const g = this.gfx; g.alpha(a); g.rect(x, y, w, h, '#0a0418'); g.alpha(1); }

    fit(str, maxW, maxScale = 3) {
        for (let s = maxScale; s > 1; s--) if (this.gfx.width(str, s) <= maxW) return s;
        return 1;
    }

    // ---- the boot pre-roll
    drawBoot() {
        const g = this.gfx, { VW, VH } = this;
        const t = this.t;
        const lineH = 9;
        const charsPerLine = Math.floor((VW - 16) / 6);
        const x0 = 8, y0 = Math.max(10, Math.ceil(44 / this.fy));
        let y = y0;
        const n = Math.min(BOOT_LINES.length, Math.floor(t / 0.26) + 1);
        for (let i = 0; i < n; i++) {
            const [txt, status] = BOOT_LINES[i];
            const shown = i === n - 1 ? Math.min(txt.length, Math.floor((t - i * 0.26) / 0.26 * txt.length + 1)) : txt.length;
            const col = i < 2 ? PAL.cream : PAL.lime;
            const label = txt.slice(0, shown).slice(0, charsPerLine);
            if (status === 'BAR') {
                g.text(label, x0, y, col);
                const bw = Math.max(30, Math.min(120, VW - 16 - g.width(label) - 8));
                const frac = Math.min(1, Math.max(0, (t - i * 0.26) / 1.9));
                g.rect(x0 + g.width(label) + 8, y, bw, 7, '#241044');
                for (let k = 0; k < Math.floor(frac * bw / 4); k++) g.rect(x0 + g.width(label) + 8 + k * 4, y, 3, 7, RAINBOW[k % RAINBOW.length]);
            } else {
                g.text(label, x0, y, col);
                if (status && shown === txt.length && t - i * 0.26 > 0.3) {
                    const dots = Math.max(2, charsPerLine - txt.length - status.length - 1);
                    g.text('.'.repeat(Math.min(dots, 40)), x0 + g.width(txt) + 6, y, '#4a7a3a');
                    g.text(status, VW - 8, y, status === 'OK' ? PAL.lime : PAL.yellow, { align: 'right' });
                }
            }
            y += lineH;
        }
        if (Math.floor(t * 3) % 2 === 0 && t < 4) g.rect(x0, Math.min(y, VH - 12), 5, 7, PAL.lime);
        // the logo comes in over the last second
        const k = (t - 3.0) / 1.2;
        if (k > 0) {
            g.alpha(Math.min(1, k));
            this.drawLogo(VW / 2, VH / 2, Math.min(1, k), t, false, VH * 0.4);
            g.alpha(1);
        }
    }

    /** The title: GLITTERBALL GROOVE, wavy and rainbow, with a mirrorball's sparkle. Fits `maxH` tall. */
    drawLogo(cx, cy, k = 1, t = this.time, compact = false, maxH = Infinity) {
        const g = this.gfx, { VW } = this;
        const wide = VW > 300;
        const lines = wide ? ['GLITTERBALL GROOVE'] : ['GLITTERBALL', 'GROOVE'];
        const height = (sc) => lines.length * (7 * sc + 8) - 8 + 6;
        let scale = 2;
        for (let sc = 5; sc >= 2; sc--) if (g.width(lines[0], sc) <= VW - 14 && height(sc) <= maxH) { scale = sc; break; }
        const total = height(scale);
        let y = cy - total / 2;
        lines.forEach((line) => {
            g.wavy(line, cx, Math.round(y), scale, t, { amp: 2.2 * k, speed: 3.2, step: 0.45, calm: this.calm });
            y += 7 * scale + 8;
        });
        const w = Math.min(VW - 24, Math.max(60, g.width(lines[0], scale)));
        g.stripes(cx - w / 2, cy - total / 2 - 8, w, 1, RAINBOW);
        g.stripes(cx - w / 2, cy + total / 2 + 4, w, 1, RAINBOW);
        if (!compact) {
            for (let i = 0; i < 6; i++) {
                const a = t * 0.7 + i * 1.7, x = cx + Math.cos(a) * (w / 2 + 6) * 0.9, yy = cy + Math.sin(a * 1.3) * total * 0.7;
                if (Math.sin(t * 5 + i * 3) > 0.2) g.sparkle(x, yy, 1 + (i % 2), PAL.white);
            }
        }
    }

    // ---- attract
    drawAttract(dt, c) {
        const g = this.gfx, { VW, VH } = this;
        this.attractT += dt;
        const p = this.attractPage;
        if (this.attractT > p.secs) { this.attractI++; this.attractT = 0; }
        const page = this.attractPage;
        const blink = this.calm || Math.floor(this.time * 1.7) % 2 === 0;
        const hi = bestScore('dance');
        // the arcade header: it is always there, except where the board is
        const topY = Math.max(5, Math.ceil(44 / this.fy));
        const demoPage = page.page === 'demo' || page.page === 'how';
        if (!demoPage) {
            g.text('1UP', 8, topY, PAL.cyan);
            g.text('00000', 8, topY + 9, PAL.white);
            g.text('HI-SCORE', VW / 2, 5, PAL.magenta, { align: 'center' });
            g.text(commas(hi), VW / 2, 14, PAL.white, { align: 'center' });
        }
        g.text('CREDIT ' + String(this.c.credits ?? 1).padStart(2, '0'), VW - 8, VH - 11, PAL.dim, { align: 'right' });
        g.text('V' + VERSION, 8, VH - 11, '#4a3a6a');
        if (page.page === 'logo') {
            this.drawLogo(VW / 2, VH * 0.46, 1, this.time, false, VH * 0.36);
            g.text(this.lastDevice === 'touch' ? 'TAP TO START' : 'PRESS START', VW / 2, VH * 0.72, blink ? PAL.yellow : PAL.orange, { align: 'center', scale: this.fit('PRESS START', VW - 24, 2) });
            g.text('A 70S DISCO MATCH-3 EXTRAVAGANZA', VW / 2, VH * 0.84, PAL.dim, { align: 'center' });
        } else if (page.page === 'demo') {
            const L = this.layout, dg = c.demoG;
            const start = this.lastDevice === 'touch' ? 'TAP TO START' : 'PRESS START';
            if (L.portrait) {
                g.text('DEMO PLAY', VW / 2, L.mg + 2, blink ? PAL.white : PAL.magenta, { align: 'center', scale: 2, shadow: PAL.ink });
                if (dg) g.text('SCORE ' + commas(dg.score), VW / 2, VH - L.bottom + 6, PAL.cream, { align: 'center' });
                g.text(start, VW / 2, VH - L.bottom + 20, blink ? PAL.yellow : PAL.orange, { align: 'center', scale: this.fit(start, VW - 20, 2) });
            } else {
                const cx = (VW - L.board.size) / 4;
                g.text('DEMO', cx, VH * 0.3, blink ? PAL.white : PAL.magenta, { align: 'center', scale: 3, shadow: PAL.ink });
                g.text('PLAY', cx, VH * 0.3 + 26, blink ? PAL.white : PAL.magenta, { align: 'center', scale: 3, shadow: PAL.ink });
                if (dg) {
                    g.text('SCORE', cx, VH * 0.58, PAL.dim, { align: 'center' });
                    g.text(commas(dg.score), cx, VH * 0.58 + 9, PAL.white, { align: 'center', scale: this.fit(commas(dg.score), (VW - L.board.size) / 2 - 12, 2) });
                    if (dg.combo >= 2) g.text('COMBO X' + dg.combo, cx, VH * 0.58 + 30, PAL.yellow, { align: 'center' });
                }
                const rx = VW - cx;
                g.text(start.split(' ')[0], rx, VH * 0.42, blink ? PAL.yellow : PAL.orange, { align: 'center', scale: 2 });
                g.text(start.split(' ').slice(1).join(' '), rx, VH * 0.42 + 18, blink ? PAL.yellow : PAL.orange, { align: 'center', scale: 2 });
            }
        } else if (page.page === 'scores') {
            this.drawScoreTable(page.mode, this.attractT, -1, Math.max(30, Math.ceil(48 / this.fy)));
            g.text(this.lastDevice === 'touch' ? 'TAP TO START' : 'PRESS START', VW / 2, VH - 11, blink ? PAL.yellow : PAL.orange, { align: 'center' });
        } else if (page.page === 'how') {
            this.drawHowPage(0, true);
            g.text(this.lastDevice === 'touch' ? 'TAP TO START' : 'PRESS START', VW / 2, VH - 11, blink ? PAL.yellow : PAL.orange, { align: 'center' });
        }
    }

    // ---- menus
    /** A title with a rule under it. `itemsH` is the height of what goes below, to centre the block on a tall screen. */
    drawMenuFrame(title, sub, itemsH = 0) {
        const g = this.gfx, { VW, VH } = this;
        const ts = this.fit(title, VW - 16, this.titleMax);
        const top0 = Math.max(10, Math.ceil(44 / this.fy));
        const top = Math.max(top0, Math.floor((VH - (7 * ts + (sub ? 22 : 14) + itemsH)) / 2 - 8));
        g.text(title, VW / 2, top, PAL.yellow, { align: 'center', scale: ts, shadow: PAL.magenta });
        const th = 7 * ts;
        g.stripes(Math.round(VW / 2 - Math.min(VW - 24, 120) / 2), top + th + 4, Math.min(VW - 24, 120), 1, STRIPES);
        if (sub) g.text(sub, VW / 2, top + th + 11, PAL.dim, { align: 'center' });
        void VH;
        return top + th + (sub ? 22 : 14);
    }

    rowHeight(base = 18) { return Math.max(base, this.minPx + 2, 7 * Math.min(this.menuScale, 2) + 8); }

    drawItems(items, y0, opts = {}) {
        const g = this.gfx, { VW, VH } = this;
        const rowH = this.rowHeight(opts.rowH || 18);
        const scale = Math.min(this.menuScale, this.fit('HIGH SCORES', Math.min(VW - 30, 170), 2));
        // short screens (a phone on its side) lay the rows out in two columns rather than running off the bottom
        const avail = VH - y0 - 6;
        const perCol1 = Math.max(1, Math.floor(avail / rowH));
        const cols = items.length > perCol1 && VW >= 280 ? 2 : 1;
        const perCol = cols === 2 ? Math.ceil(items.length / 2) : Math.min(items.length, perCol1);
        const gap = 10;
        const pw = Math.min(cols === 2 ? Math.floor((VW - 24 - gap) / 2) : VW - 16, opts.w || 190);
        const x0 = Math.round((VW - (cols * pw + (cols - 1) * gap)) / 2);
        items.slice(0, perCol * cols).forEach((it, i) => {
            const col = Math.floor(i / perCol), row = i % perCol;
            const x = x0 + col * (pw + gap), y = y0 + row * rowH;
            const sel = i === this.sel;
            const bob = sel && !this.calm ? Math.round(Math.sin(this.time * 8)) : 0;
            g.panel(x, y, pw, rowH - 3, sel ? PAL.yellow : '#5a3a8a', sel ? 'rgba(60,20,90,0.9)' : 'rgba(14,6,30,0.78)');
            const ty = y + Math.floor((rowH - 3 - 7 * scale) / 2);
            const ls = Math.min(scale, cols === 2 ? 1 : (pw > 150 ? 2 : 1));
            const lty = y + Math.floor((rowH - 3 - 7 * ls) / 2);
            if (it.kind === 'slider') {
                g.text(it.label, x + 6, lty, sel ? PAL.white : PAL.cream, { scale: ls });
                const bw = Math.floor(pw * (cols === 2 ? 0.4 : 0.42)), bx = x + pw - bw - 8, by = y + Math.floor((rowH - 3) / 2) - 2;
                g.rect(bx, by, bw, 5, '#241044');
                g.segs(bx, by, bw, 5, it.value, 10);
                this.addHit(it.id, x, y, pw, rowH - 3, { item: i, slider: true, bx, bw });
            } else if (it.kind === 'choice') {
                g.text(it.label, x + 6, lty, sel ? PAL.white : PAL.cream, { scale: ls });
                g.text(it.text, x + pw - 8, lty, PAL.cyan, { align: 'right', scale: ls });
                this.addHit(it.id, x, y, pw, rowH - 3, { item: i });
            } else {
                const s2 = Math.min(scale, cols === 2 ? 1 : 2, this.fit(it.label, pw - 24, 2));
                g.text(it.label, x + pw / 2, y + Math.floor((rowH - 3 - 7 * s2 - (it.sub ? 9 : 0)) / 2), sel ? PAL.white : PAL.cream, { align: 'center', scale: s2 });
                if (it.sub && rowH >= 24) g.text(it.sub, x + pw / 2, y + Math.floor((rowH - 3 - 7 * s2 - 9) / 2) + 7 * s2 + 3, PAL.dim, { align: 'center' });
                this.addHit(it.id, x, y, pw, rowH - 3, { item: i });
            }
            if (sel && cols === 1) {
                g.text('►', Math.max(2, x - 9 + bob), ty, PAL.yellow, { scale });
                g.text('◄', x + pw + 3 - bob, ty, PAL.yellow, { scale });
            }
        });
    }

    drawMenu() {
        const g = this.gfx, { VW, VH } = this;
        const items = this.menuItems();
        const logoH = Math.min(VH * 0.28, 76);
        const block = logoH + 18 + items.length * this.rowHeight(20);
        const top = Math.max(10, Math.min(Math.floor((VH - block) / 2) - 6, VH * 0.2));
        this.drawLogo(VW / 2, top + logoH / 2 + 6, 0.6, this.time, true, logoH);
        this.drawItems(items, top + logoH + 18, { rowH: 20 });
        g.text('V' + VERSION, VW / 2, VH - 9, '#5a4a7a', { align: 'center' });
    }

    drawModes() {
        this.scrim(0, 0, this.VW, this.VH, 0.4);
        const items = this.menuItems();
        const y0 = this.drawMenuFrame('CHOOSE YOUR FLOOR', 'PICK A MODE AND HIT THE FLOOR', items.length * this.rowHeight(26));
        this.drawItems(items, y0, { rowH: 26, w: 200 });
        void y0;
    }

    drawSettings() {
        this.scrim(0, 0, this.VW, this.VH, 0.5);
        const y0 = this.drawMenuFrame('SETTINGS');
        this.drawItems(this.menuItems(), y0, { rowH: 16, w: 210 });
    }

    drawConfirm() {
        const g = this.gfx, { VW, VH } = this;
        this.scrim(0, 0, VW, VH, 0.5);
        const y0 = this.drawMenuFrame('WIPE THE HALL OF FAME?');
        g.text('THE HOUSE BAND WILL RETURN', VW / 2, y0 - 6, PAL.dim, { align: 'center' });
        this.drawItems(this.menuItems(), Math.max(y0 + 8, VH * 0.4), { rowH: 22 });
    }

    // ---- the high score tables
    drawScoreTable(mode, t, highlight, y0) {
        const g = this.gfx, { VW, VH } = this;
        const title = 'HALL OF FAME';
        const sc = this.fit(title, VW - 16, 3);
        g.text(title, VW / 2, y0, RAINBOW, { align: 'center', scale: sc, shadow: PAL.ink });
        g.text(MODES[mode].name, VW / 2, y0 + 7 * sc + 4, PAL.cyan, { align: 'center', scale: Math.min(2, this.fit(MODES[mode].name, VW - 16, 2)) });
        const rows = loadScores()[mode];
        const rowY = y0 + 7 * sc + 24;
        const rowH = Math.max(9, Math.min(13, Math.floor((VH - rowY - 22) / HIGHSCORES.size)));
        const w = Math.min(VW - 14, 220), x = Math.round((VW - w) / 2);
        rows.slice(0, HIGHSCORES.size).forEach((r, i) => {
            const k = (t - i * 0.18) / 0.25;
            if (k <= 0) return;
            const y = rowY + i * rowH;
            const col = i === highlight && (this.calm || Math.floor(this.time * 3) % 2) ? PAL.white : [PAL.yellow, PAL.orange, PAL.magenta][i] || PAL.cream;
            const slide = Math.round((1 - Math.min(1, k)) * 20);
            g.text((i + 1) + '.', x + slide, y, col);
            g.text(r.name, x + 20 + slide, y, col);
            g.text(commas(r.score), x + w - 36 + slide, y, col, { align: 'right' });
            g.text('LV' + (r.level || 1), x + w + slide, y, PAL.dim, { align: 'right' });
        });
    }

    drawScoresScreen() {
        const g = this.gfx, { VW, VH } = this;
        this.scrim(0, 0, VW, VH, 0.55);
        const top = Math.max(10, Math.ceil(44 / this.fy));
        this.drawScoreTable(this.scoreMode, 99, this.data.highlight ?? -1, top);
        // tabs and back
        const tabs = ['dance', 'jam'];
        const tw = Math.min(90, (VW - 20) / 2);
        const y = VH - Math.max(22, this.minPx + 4);
        tabs.forEach((m, i) => {
            const x = VW / 2 - tw - 2 + i * (tw + 4);
            const on = m === this.scoreMode;
            g.panel(x, y, tw, Math.max(16, this.minPx), on ? PAL.yellow : '#5a3a8a', on ? 'rgba(60,20,90,0.9)' : 'rgba(14,6,30,0.78)');
            g.text(MODES[m].name, x + tw / 2, y + Math.floor((Math.max(16, this.minPx) - 7) / 2), on ? PAL.white : PAL.dim, { align: 'center' });
            this.addHit('scoretab', x, y, tw, Math.max(16, this.minPx), { mode: m });
        });
        g.text('◄ ► SWITCH   ENTER BACK', VW / 2, y - 10, PAL.dim, { align: 'center' });
        const bs = Math.max(this.minPx, 18);
        g.panel(VW - bs - 4, 4 + Math.ceil(0 / this.fy), bs, bs, PAL.magenta);
        g.text('X', VW - bs - 4 + bs / 2, 4 + (bs - 7) / 2, PAL.white, { align: 'center' });
        this.addHit('scoreback', VW - bs - 4, 4, bs, bs);
    }

    // ---- how to play
    drawHowTo() {
        const g = this.gfx, { VW, VH } = this;
        this.scrim(0, 0, VW, VH, 0.6);
        const top = Math.max(10, Math.ceil(44 / this.fy));
        g.text('HOW TO PLAY', VW / 2, top, PAL.yellow, { align: 'center', scale: this.fit('HOW TO PLAY', VW - 16, 3), shadow: PAL.magenta });
        this.drawHowPage(this.howPage, false, top + 7 * this.fit('HOW TO PLAY', VW - 16, 3) + 8);
        // page dots and arrows
        const y = VH - Math.max(this.minPx + 2, 22);
        const bw = Math.max(this.minPx, 20);
        g.panel(8, y, bw, bw, '#5a3a8a'); g.text('◄', 8 + bw / 2, y + (bw - 7) / 2, this.howPage ? PAL.white : '#4a3a6a', { align: 'center' });
        this.addHit('howprev', 8, y, bw, bw);
        g.panel(VW - 8 - bw, y, bw, bw, PAL.yellow); g.text(this.howPage < 2 ? '►' : 'OK', VW - 8 - bw / 2, y + (bw - 7) / 2, PAL.white, { align: 'center' });
        this.addHit('hownext', VW - 8 - bw, y, bw, bw);
        for (let i = 0; i < 3; i++) g.rect(VW / 2 - 10 + i * 8, y + bw / 2 - 1, 4, 4, i === this.howPage ? PAL.yellow : '#4a3a6a');
    }

    drawHowPage(page, attract = false, y0 = null) {
        const g = this.gfx, { VW, VH } = this;
        const maxChars = Math.min(46, Math.floor((VW - 28) / 6));
        let y = y0 ?? Math.max(30, Math.ceil(48 / this.fy));
        const px0 = Math.round((VW - maxChars * 6) / 2);
        if (attract) this.scrim(px0 - 8, y - 22, maxChars * 6 + 16, VH - y - 10, 0.6);
        const para = (text, col = PAL.cream) => { for (const l of wrap(text, maxChars)) { g.text(l, px0, y, col); y += 9; } y += 3; };
        const row = (icon, text, col = PAL.cream) => {
            g.icon(icon, px0 + 8, y + 4, 12);
            const lines = wrap(text, maxChars - 5);
            lines.forEach((l, i) => g.text(l, px0 + 22, y + i * 9, col));
            y += Math.max(1, lines.length) * 9 + 4;
        };
        const p = attract ? Math.floor(this.attractT / 2.6) % 3 : page;
        if (attract) g.text('HOW TO PLAY', VW / 2, y - 14 + (y0 ? 0 : 0), PAL.yellow, { align: 'center', scale: 2, shadow: PAL.magenta });
        if (p === 0) {
            para('SWAP TWO NEIGHBOURING TOKENS TO LINE UP THREE OR MORE OF A KIND.', PAL.white);
            para(this.lastDevice === 'touch' || attract ? 'DRAG A TOKEN TOWARDS A NEIGHBOUR, OR TAP TWO IN TURN.' : 'DRAG OR CLICK TWO TOKENS. KEYS: ARROWS MOVE, SPACE GRABS, AN ARROW SWAPS.');
            para('YOU CAN SWAP WHILE THINGS ARE STILL FALLING. FAST HANDS MAKE BIG COMBOS.', PAL.yellow);
            for (let i = 0; i < 6; i++) g.icon(i, VW / 2 - 45 + i * 18, Math.min(VH - 36, y + 8), 14);
        } else if (p === 1) {
            row('beamh', 'FOUR IN A LINE: A FUNK BEAM. IT CLEARS ITS WHOLE ROW OR COLUMN.', PAL.white);
            row('bomb', 'AN L, T OR PLUS: A BOOM BOX. IT BLASTS A 3 BY 3 AREA.', PAL.white);
            row('mirror', 'FIVE IN A LINE: A GLITTERBALL. SWAP IT WITH ANY TOKEN TO CLEAR THAT COLOUR.', PAL.white);
            if (!attract || VH > 220) para('SWAP TWO SPECIALS TOGETHER FOR A HUGE COMBO.', PAL.yellow);
        } else {
            para('KEEP MATCHING FAST TO BUILD A COMBO. FILL THE GROOVE METER FOR DISCO FEVER: DOUBLE POINTS AND SPECIALS RAIN DOWN.', PAL.white);
            para('DANCE-OFF: BEAT THE CLOCK. SPECIALS, FEVER AND LEVEL-UPS ADD TIME.', PAL.cyan);
            para('SLOW JAM: 30 MOVES, NO RUSH.', PAL.lime);
        }
    }

    // ---- ready, pause, over, entry
    drawReady(c) {
        const g = this.gfx, b = this.layout.board;
        const n = c.countdown;
        const text = n > 0 ? String(n) : 'GO!';
        const k = (this.t % 1);
        const sc = Math.max(4, Math.min(10, Math.floor(b.size / 24)));
        g.text(text, b.cx, b.cy - 3.5 * sc, n > 0 ? [PAL.yellow, PAL.orange, PAL.magenta] : RAINBOW, { align: 'center', scale: Math.round(sc * (1.2 - k * 0.3)), outline: PAL.ink });
        g.text(MODES[c.G.mode].name, b.cx, b.cy + 4 * sc + 4, PAL.cyan, { align: 'center', scale: 2, shadow: PAL.ink });
    }

    drawPause() {
        const g = this.gfx, { VW, VH } = this;
        g.alpha(0.6); g.rect(0, 0, VW, VH, '#0a0418'); g.alpha(1);
        const items = this.menuItems();
        const y0 = this.drawMenuFrame('PAUSED', null, items.length * this.rowHeight(20));
        this.drawItems(items, y0, { rowH: 20, w: 170 });
    }

    drawOver() {
        const g = this.gfx, { VW, VH } = this;
        const G = this.c.G, d = this.data;
        const short = VH < 240;
        g.alpha(0.72); g.rect(0, 0, VW, VH, '#0a0418'); g.alpha(1);
        const top = Math.max(8, short && VW > VH ? 8 : Math.ceil(44 / this.fy));
        const title = d.title || "THAT'S ALL, FOLKS!";
        const sc = this.fit(title, VW - 14, short ? 2 : this.titleMax);
        g.text(title, VW / 2, top, RAINBOW, { align: 'center', scale: sc, shadow: PAL.ink });
        let y = top + 7 * sc + (short ? 5 : 8);
        if (!short) g.text('FINAL SCORE', VW / 2, y, PAL.dim, { align: 'center' });
        const num = commas(G.score);
        const ns = this.fit(num, VW - 20, short ? 3 : 4);
        g.text(num, VW / 2, y + (short ? 0 : 10), PAL.white, { align: 'center', scale: ns, shadow: PAL.magenta });
        y += (short ? 4 : 14) + 7 * ns;
        const st = G.stats;
        if (short) {
            g.text('LV ' + G.level + '   COMBO X' + st.bestCombo + '   FEVERS ' + st.fevers, VW / 2, y, PAL.cream, { align: 'center' });
            y += 11;
        } else {
            const rows = [['LEVEL', G.level], ['BEST COMBO', 'X' + st.bestCombo], ['FEVERS', st.fevers], ['SPECIALS MADE', st.specialsMade]];
            const w = Math.min(150, VW - 24), x = Math.round((VW - w) / 2);
            rows.forEach(([k, v], i) => { if (this.t > 0.3 + i * 0.15) { g.text(k, x, y + i * 10, PAL.cream); g.text(String(v), x + w, y + i * 10, PAL.yellow, { align: 'right' }); } });
            y += rows.length * 10 + 6;
        }
        if (d.rank >= 0) {
            if (Math.floor(this.time * 3) % 2 === 0 || this.calm) g.text('NEW HIGH SCORE! RANK ' + (d.rank + 1), VW / 2, y, PAL.yellow, { align: 'center' });
            y += 12;
        }
        if (this.t > 0.9) this.drawItems(this.menuItems(), Math.min(y + 2, VH - 30), { rowH: 20, w: 190 });
    }

    drawEntry() {
        const g = this.gfx, { VW, VH } = this;
        const d = this.data, e = this.entry;
        const land = VW > VH * 1.3;
        const top = Math.max(8, land ? 8 : Math.ceil(44 / this.fy));
        g.alpha(0.78); g.rect(0, 0, VW, VH, '#0a0418'); g.alpha(1);
        const title = 'NEW HIGH SCORE!';
        const sc = this.fit(title, VW - 14, land ? 2 : this.titleMax);
        g.text(title, VW / 2, top, RAINBOW, { align: 'center', scale: sc, shadow: PAL.ink });
        g.text('RANK ' + ((d.rank ?? 0) + 1) + '   ' + commas(d.score ?? 0), VW / 2, top + 7 * sc + 5, PAL.white, { align: 'center' });
        const headBottom = top + 7 * sc + 18;
        // the three letters (left half when the screen is wide, otherwise on top)
        const lcx = land ? VW * 0.26 : VW / 2;
        const ls = this.fit('AAA', land ? VW * 0.34 : VW * 0.5, land ? 4 : 5);
        const lw = 5 * ls, gap = 6 + ls * 2;
        const x0 = lcx - (3 * lw + 2 * gap) / 2;
        const ly = land ? headBottom + Math.max(6, (VH - headBottom - 7 * ls) / 3) : headBottom + 8;
        e.name.forEach((ch, i) => {
            const x = x0 + i * (lw + gap);
            const on = i === e.pos;
            g.text(ch, x, ly, on ? PAL.yellow : PAL.white, { scale: ls, shadow: PAL.magenta });
            g.rect(x, ly + 7 * ls + 3, lw, 2, on && (Math.floor(this.time * 3) % 2 === 0 || this.calm) ? PAL.yellow : '#5a3a8a');
            this.addHit('k:pos' + i, x, ly, lw, 7 * ls + 6);
        });
        // the letter pad
        const cols = 7, cell = Math.max(this.minPx, 15), gapp = 2;
        const gw = cols * cell + (cols - 1) * gapp;
        const rows = Math.ceil(KEYPAD.length / cols) + 1;
        const gx = land ? Math.round(VW * 0.74 - gw / 2) : Math.round((VW - gw) / 2);
        const gy = land ? Math.max(headBottom, Math.min(VH - rows * (cell + gapp) - 6, headBottom)) : Math.min(VH - rows * (cell + gapp) - 14, ly + 7 * ls + 14);
        KEYPAD.forEach((ch, i) => {
            const cx = gx + (i % cols) * (cell + gapp), cy = gy + Math.floor(i / cols) * (cell + gapp);
            g.panel(cx, cy, cell, cell, '#5a3a8a');
            g.text(ch, cx + cell / 2, cy + (cell - 7) / 2, e.name[e.pos] === ch ? PAL.yellow : PAL.cream, { align: 'center' });
            this.addHit('k:' + ch, cx, cy, cell, cell);
        });
        const ry = gy + Math.ceil(KEYPAD.length / cols) * (cell + gapp);
        const dw = cell * 3 + gapp * 2, ow = cell * 4 + gapp * 3;
        g.panel(gx, ry, dw, cell, PAL.orange); g.text('DEL', gx + dw / 2, ry + (cell - 7) / 2, PAL.white, { align: 'center' });
        this.addHit('k:DEL', gx, ry, dw, cell);
        const okx = gx + dw + gapp;
        g.panel(okx, ry, ow, cell, PAL.lime); g.text('OK', okx + ow / 2, ry + (cell - 7) / 2, PAL.white, { align: 'center' });
        this.addHit('k:OK', okx, ry, ow, cell);
        if (!land || VH > 260) g.text('TYPE OR TAP LETTERS', VW / 2, VH - 8, PAL.dim, { align: 'center' });
    }

    // ------------------------------------------------------------------ the HUD
    drawHud(dt, c) {
        const g = this.gfx, L = this.layout, G = c.G;
        if (!G) return;
        const mode = MODES[G.mode];
        // popups and banners
        this.dispScore += (G.score - this.dispScore) * Math.min(1, dt * 9);
        if (Math.abs(G.score - this.dispScore) < 1) this.dispScore = G.score;
        const score = commas(this.dispScore);
        const fever = G.fever > 0;
        const danger = mode.time && G.time <= 10 && G.state === 'play';
        const timeStr = mode.time ? this.clock(G.time) : String(G.moves);
        const pulse = !this.calm && danger && Math.floor(this.time * 2) % 2 === 0;
        const room = ROOMS[(G.level - 1) % ROOMS.length];
        const best = Math.max(c.hi || 0, G.score);
        const accent = fever ? RAINBOW[Math.floor(this.time * (this.calm ? 1 : 3)) % RAINBOW.length] : PAL.magenta;

        if (L.portrait) {
            const { VW, VH } = this, mg = L.mg;
            this.scrim(0, 0, VW, L.top - 2, 0.66);
            this.scrim(0, VH - L.bottom, VW, L.bottom, 0.66);
            g.rect(0, L.top - 2, VW, 1, accent);
            g.rect(0, VH - L.bottom, VW, 1, accent);
            const backW = Math.ceil(92 / this.f);
            // row 1: score, pause
            const maxW = L.pause.x - 4 - (backW + mg);
            const sc = this.fit(score, maxW, 2);
            g.text(score, L.pause.x - 4, mg + 2, PAL.white, { align: 'right', scale: sc, shadow: accent });
            this.pauseButton(L.pause, accent);
            // row 2: level and time or moves
            const y2 = mg + L.P + 3;
            g.text('LV' + G.level + ' ' + room.name, mg, y2 + 1, PAL.cream);
            const tcol = pulse ? PAL.red : danger ? PAL.orange : PAL.white;
            g.text(mode.time ? timeStr : 'MOVES ' + timeStr, VW - mg, y2, tcol, { align: 'right', scale: 2, shadow: PAL.ink });
            // level progress bar under it
            const lv0 = levelScore(G.level), lv1 = levelScore(G.level + 1);
            g.bar(mg, y2 + 17, VW - 2 * mg, 3, (G.score - lv0) / (lv1 - lv0), PAL.cyan);
            if (mode.time) g.bar(mg, y2 + 22, VW - 2 * mg, 3, Math.min(1, G.time / 60), danger ? PAL.red : PAL.lime);
            this.timeBonus(VW - mg - 40, y2 + 28);
            // bottom: groove meter and combo
            const by = this.vh / this.fy - L.bottom + 4;
            g.text('GROOVE', mg, by, fever ? PAL.yellow : PAL.magenta);
            g.text(G.combo >= 2 ? 'COMBO X' + G.combo : 'BEST ' + commas(best), VW - mg, by, G.combo >= 2 ? PAL.yellow : PAL.dim, { align: 'right' });
            g.segs(mg, by + 10, VW - 2 * mg, 8, G.meter / 100, 28, false, fever && Math.floor(this.time * 4) % 2 === 0 && !this.calm);
            if (fever) g.text('DISCO FEVER ' + Math.ceil(G.fever), VW / 2, by + 21, RAINBOW, { align: 'center' });
        } else {
            const A = L.left, B = L.right;
            g.panel(A.x, A.y, A.w, A.h, accent);
            let y = A.y + 5;
            g.text('SCORE', A.x + 5, y, PAL.dim); y += 9;
            const sc = this.fit(score, A.w - 10, 2);
            g.text(score, A.x + 5, y, PAL.white, { scale: sc, shadow: accent }); y += 7 * sc + 6;
            g.text('BEST', A.x + 5, y, PAL.dim); y += 9;
            g.text(commas(best), A.x + 5, y, PAL.cream); y += 14;
            g.text('LEVEL ' + G.level, A.x + 5, y, PAL.yellow); y += 9;
            for (const l of wrap(room.name, Math.floor((A.w - 8) / 6))) { g.text(l, A.x + 5, y, PAL.dim); y += 8; }
            const lv0 = levelScore(G.level), lv1 = levelScore(G.level + 1);
            y += 2; g.bar(A.x + 5, y, A.w - 10, 3, (G.score - lv0) / (lv1 - lv0), PAL.cyan);
            // the clock
            const ty = A.y + A.h - 34;
            g.text(mode.time ? 'TIME' : 'MOVES', A.x + 5, ty, PAL.dim);
            const tsz = this.fit(timeStr, A.w - 10, 3);
            g.text(timeStr, A.x + 5, ty + 9, pulse ? PAL.red : danger ? PAL.orange : PAL.white, { scale: tsz, shadow: PAL.ink });
            this.timeBonus(A.x + A.w - 4, ty - 8, true);
            // right: groove meter
            g.panel(B.x, B.y, B.w, B.h, accent);
            this.pauseButton(L.pause, accent);
            const gy = B.y + L.P + 8;
            g.text('GROOVE', B.x + 5, gy, fever ? PAL.yellow : PAL.magenta);
            const mh = B.h - (gy - B.y) - 46;
            g.segs(B.x + 6, gy + 10, 12, mh, G.meter / 100, 20, true, fever && Math.floor(this.time * 4) % 2 === 0 && !this.calm);
            const cx = B.x + 24;
            if (fever) { g.text('DISCO', cx, gy + 12, RAINBOW); g.text('FEVER', cx, gy + 21, RAINBOW); g.text(String(Math.ceil(G.fever)), cx, gy + 32, PAL.white, { scale: 2 }); }
            g.text(G.combo >= 2 ? 'X' + G.combo : '', B.x + B.w - 6, B.y + B.h - 36, PAL.yellow, { align: 'right', scale: 3, shadow: PAL.ink });
            g.text(G.combo >= 2 ? 'COMBO' : '', B.x + B.w - 6, B.y + B.h - 12, PAL.cream, { align: 'right' });
        }

        // popups
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.t += dt;
            if (p.t >= p.dur) { this.popups.splice(i, 1); continue; }
            const k = p.t / p.dur;
            g.alpha(k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1);
            g.text(p.text, p.x, p.y - k * 16, p.color, { align: 'center', scale: p.scale, outline: PAL.ink });
        }
        g.alpha(1);
        // banners: one big word over the board, then the next
        const bn = this.banners[0];
        if (bn) {
            bn.t += dt;
            if (bn.t >= bn.dur) this.banners.shift();
            else {
                const b = L.board, k = bn.t / bn.dur;
                const sc = this.fit(bn.text, b.size - 6, bn.scale);
                const y = b.cy - b.size * 0.34 - (k < 0.15 && !this.calm ? (1 - k / 0.15) * 8 : 0);
                g.alpha(k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1);
                g.text(bn.text, b.cx, y, bn.colors, { align: 'center', scale: sc, outline: PAL.ink });
                g.alpha(1);
            }
        }
    }

    pauseButton(r, accent) {
        const g = this.gfx;
        g.panel(r.x, r.y, r.w, r.h, accent);
        const mx = r.x + r.w / 2, my = r.y + r.h / 2;
        g.rect(mx - 4, my - 4, 3, 8, PAL.white); g.rect(mx + 1, my - 4, 3, 8, PAL.white);
        this.addHit('pause', r.x, r.y, r.w, r.h);
    }

    timeBonus(x, y, left = false) {
        const f = this.timeFlash;
        if (!f) return;
        f.t += 1 / 60;
        if (f.t > 1.2) { this.timeFlash = null; return; }
        this.gfx.alpha(f.t > 0.8 ? 1 - (f.t - 0.8) / 0.4 : 1);
        this.gfx.text(f.text, x, y - f.t * 6, PAL.lime, { align: left ? 'right' : 'center', scale: 2, outline: PAL.ink });
        this.gfx.alpha(1);
    }

    clock(sec) {
        const s = Math.max(0, Math.ceil(sec));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }
}
