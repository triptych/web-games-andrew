// Everything on the monitor that isn't the game itself: the attract pages
// (title, story, how to play, the cast, high scores), the menus, the realm
// intro card, the tally, CONTINUE?, name entry and the ending. Drawn in native
// pixels with the pixel font; each menu screen reports the rows a finger or a
// mouse can tap.

import { W, H, PF_Y, DRAGONS } from '../config.js';
import { drawText, textWidth, glyph } from './font.js';
import { REALMS } from '../sim/realms.js';
import { SONGS, JUKEBOX } from '../music.js';

const PINK = '#ff2ece', CYAN = '#29e6ff', GOLD = '#ffd23a', WHITE = '#ffffff', GREY = '#8a80a0', ORANGE = '#ff8a1a';

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/** The chrome logo: the pixel font scaled up, filled with a chrome gradient, outlined and extruded. Baked at 3×. */
export function bakeLogo(text, px = 4) {
    const S = 3;
    const w = text.length * 6 * px + 8, h = 7 * px + 10;
    const c = mk(w * S, h * S), g = c.getContext('2d');
    g.scale(S, S);
    const cells = (fn) => [...text].forEach((ch, i) => glyph(ch).forEach((row, y) => row.forEach((on, x) => { if (on) fn(4 + (i * 6 + x) * px, 3 + y * px); })));
    // extrusion
    for (let d = 4; d >= 1; d--) { g.fillStyle = d > 2 ? '#2a0636' : '#7a0a5a'; cells((x, y) => g.fillRect(x + d * 0.6, y + d * 0.8, px, px)); }
    // outline
    g.fillStyle = PINK; cells((x, y) => g.fillRect(x - 1, y - 1, px + 2, px + 2));
    // chrome
    const gr = g.createLinearGradient(0, 3, 0, 3 + 7 * px);
    gr.addColorStop(0, '#2a6aff'); gr.addColorStop(0.3, '#bfe8ff'); gr.addColorStop(0.48, '#ffffff'); gr.addColorStop(0.52, '#1a1040');
    gr.addColorStop(0.62, '#6a3a8a'); gr.addColorStop(0.8, '#ff8a6a'); gr.addColorStop(1, '#ffe0a0');
    g.fillStyle = gr; cells((x, y) => g.fillRect(x, y, px, px));
    // a hard specular line
    g.fillStyle = 'rgba(255,255,255,0.8)'; cells((x, y) => { if (y < 3 + px) g.fillRect(x, y, px, 1); });
    c.nw = w; c.nh = h;
    return c;
}

export class Screens {
    constructor(renderer) {
        this.r = renderer;
        this.logo1 = bakeLogo('CHROME', 5);
        this.logo2 = bakeLogo('CHALICE', 5);
        this.small1 = bakeLogo('CHROME CHALICE', 2);
        this.taps = [];
        this.t = 0;
    }

    get ctx() { return this.r.ctx; }

    begin() {
        const ctx = this.ctx, S = this.r.S;
        ctx.setTransform(S, 0, 0, S, 0, 0);
        ctx.imageSmoothingEnabled = false;
        this.taps = [];
    }

    clear(color = '#05020a') { const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = color; ctx.fillRect(0, 0, this.r.c.width, this.r.c.height); this.begin(); }

    tap(x, y, w, h, act) { this.taps.push({ x, y, w, h, act }); }

    /** The synthwave backdrop: sky, sun with slits, mountains, a scrolling grid. */
    synth(t, sunY = 118, horizon = 150, tint = 0) {
        const ctx = this.ctx;
        const sky = ctx.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, '#05010e'); sky.addColorStop(0.55, tint ? '#2a0a3a' : '#1a0430'); sky.addColorStop(1, '#5a0a5a');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);
        // stars
        for (let i = 0; i < 60; i++) {
            const x = (i * 97.3) % W, y = (i * 53.7) % (horizon - 40);
            ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.3 + i));
            ctx.fillStyle = i % 7 ? '#ffffff' : CYAN; ctx.fillRect(x, y, 1, 1);
        }
        ctx.globalAlpha = 1;
        // sun
        const R = 46;
        const sg = ctx.createLinearGradient(0, sunY - R, 0, sunY + R);
        sg.addColorStop(0, '#fff27a'); sg.addColorStop(0.45, '#ff8a1a'); sg.addColorStop(1, '#ff2ece');
        ctx.save();
        ctx.beginPath(); ctx.arc(W / 2, sunY, R, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = sg; ctx.fillRect(W / 2 - R, sunY - R, R * 2, R * 2);
        ctx.fillStyle = '#1a0430';
        for (let k = 0; k < 7; k++) { const y = sunY + 4 + k * 6 + ((t * 6) % 6); const hgt = 0.6 + k * 0.5; ctx.fillRect(W / 2 - R, y, R * 2, hgt); }
        ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(W / 2, sunY, R * 0.8, W / 2, sunY, R * 2.2);
        glow.addColorStop(0, 'rgba(255,60,160,0.35)'); glow.addColorStop(1, 'rgba(255,60,160,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, horizon); ctx.restore();
        // mountains
        ctx.fillStyle = '#0c0218';
        ctx.beginPath(); ctx.moveTo(0, horizon);
        const peaks = [[0, 128], [30, 112], [52, 126], [80, 104], [108, 130], [128, 124], [190, 126], [214, 106], [240, 124], [262, 98], [292, 120], [320, 110], [320, horizon]];
        for (const [x, y] of peaks) ctx.lineTo(x, y + (horizon - 150));
        ctx.fill();
        ctx.strokeStyle = PINK; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.7;
        ctx.beginPath(); peaks.slice(0, -1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y + (horizon - 150)) : ctx.moveTo(x, y + (horizon - 150)))); ctx.stroke();
        ctx.globalAlpha = 1;
        // floor grid
        const fl = ctx.createLinearGradient(0, horizon, 0, H);
        fl.addColorStop(0, '#2a0440'); fl.addColorStop(1, '#05010a');
        ctx.fillStyle = fl; ctx.fillRect(0, horizon, W, H - horizon);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = PINK; ctx.lineWidth = 0.6;
        const vp = W / 2;
        for (let i = -12; i <= 12; i++) { ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(vp + i * 6, horizon); ctx.lineTo(vp + i * 60, H); ctx.stroke(); }
        const off = (t * 0.6) % 1;
        for (let k = 0; k < 14; k++) {
            const z = (k + 1 - off);
            const y = horizon + (H - horizon) * (1 / (14 - z + 1)) * 1.0;
            if (y < horizon) continue;
            ctx.globalAlpha = Math.min(1, (y - horizon) / 40);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = '#ff9af0'; ctx.fillRect(0, horizon, W, 0.6);
    }

    logo(y, t) {
        const ctx = this.ctx;
        const bob = Math.sin(t * 1.4) * 1.5;
        ctx.drawImage(this.logo1, W / 2 - this.logo1.nw / 2, y + bob, this.logo1.nw, this.logo1.nh);
        ctx.drawImage(this.logo2, W / 2 - this.logo2.nw / 2, y + 40 + bob, this.logo2.nw, this.logo2.nh);
        // a glint sweeping across
        const gx = ((t * 90) % 600) - 140;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + 6, y); ctx.lineTo(gx - 24, y + 80); ctx.lineTo(gx - 30, y + 80); ctx.fill(); ctx.restore();
    }

    footer(credits, hi, t, blinkMsg = true) {
        const ctx = this.ctx;
        drawText(ctx, `HI ${String(hi).padStart(7, '0')}`, W / 2, 3, GOLD, { align: 'center', shadow: '#000' });
        drawText(ctx, `CREDIT ${credits}`, W - 4, H - 10, WHITE, { align: 'right', shadow: '#000' });
        drawText(ctx, '© 1988 W.G.A.', 4, H - 10, GREY, { shadow: '#000' });
        if (blinkMsg && Math.floor(t * 2) % 2 === 0) {
            drawText(ctx, credits > 0 ? 'PRESS START' : 'INSERT COIN', W / 2, H - 22, credits > 0 ? CYAN : PINK, { align: 'center', shadow: '#000', glow: credits > 0 ? CYAN : PINK });
        }
    }

    // ------------------------------------------------------------------ attract pages
    title(t, credits, hi) {
        this.begin();
        this.synth(t);
        this.logo(26, t);
        drawText(this.ctx, 'QUEST OF THE NEON SQUARE', W / 2, 118, '#ffb03a', { align: 'center', shadow: '#000', glow: '#ff8a1a' });
        this.footer(credits, hi, t);
        this.tap(0, 0, W, H, 'start');
    }

    story(t, credits, hi) {
        this.begin();
        this.synth(t, 150, 190, 1);
        const lines = [
            ['THE CHROME CHALICE', GOLD], ['KEEPS THE SUN RISING', WHITE], ['OVER THE GRID.', WHITE], ['', WHITE],
            ['CHROMAGON, A DRAGON OF', WHITE], ['LIQUID METAL, HAS STOLEN IT', WHITE], ['AND HIDDEN IT IN HIS CITADEL.', WHITE], ['', WHITE],
            ['SIX REALMS. FIVE DRAGONS.', CYAN], ['ONE SQUARE OF LIGHT.', CYAN], ['', WHITE],
            ['YOU ARE SQUIRE.', PINK], ['BRING THE CHALICE HOME.', PINK],
        ];
        const shown = Math.floor(t * 28);
        let n = 0;
        lines.forEach(([s, c], i) => {
            const vis = s.slice(0, Math.max(0, shown - n));
            n += s.length + 4;
            drawText(this.ctx, vis, W / 2 - textWidth(s) / 2, 18 + i * 10, c, { shadow: '#000' });
        });
        this.footer(credits, hi, t);
        this.tap(0, 0, W, H, 'start');
    }

    howto(t, credits, hi, A) {
        this.begin();
        this.clear('#07020e');
        this.synth(t, 260, 230);
        const ctx = this.ctx;
        drawText(ctx, 'HOW TO PLAY', W / 2, 12, CYAN, { align: 'center', scale: 2, glow: CYAN });
        const rows = [
            [A.items.sword, 'THE SWORD SLAYS DRAGONS.  A: SLASH'],
            [A.keys.gold, 'A KEY OPENS ITS OWN KEEP'],
            [A.chalice[Math.floor(t * 10) % 8], 'CARRY THE CHALICE HOME'],
            [A.items.magnet, 'THE MAGNET PULLS THINGS TO IT'],
            [A.items.lamp, 'THE LAMP LIGHTS THE DARK'],
            [A.items.shield, 'THE SHIELD STOPS FIRE'],
            [A.items.charge, 'A: ARM THE CHARGE. RUN!'],
            [A.items.pixel, 'AND IF YOU FIND A GREY DOT...'],
        ];
        rows.forEach(([img, s], i) => {
            const y = 36 + i * 17;
            ctx.drawImage(img, 40 - img.width / 2, y + 4 - img.height / 2);
            drawText(ctx, s, 58, y, WHITE, { shadow: '#000' });
        });
        drawText(ctx, 'CARRY ONE THING AT A TIME.', W / 2, 176, GOLD, { align: 'center' });
        drawText(ctx, 'B: DROP    C: DASH', W / 2, 188, GOLD, { align: 'center' });
        this.footer(credits, hi, t);
        this.tap(0, 0, W, H, 'start');
    }

    cast(t, credits, hi, A) {
        this.begin();
        this.clear('#07020e');
        const ctx = this.ctx;
        drawText(ctx, 'MEET THE DRAGONS', W / 2, 12, PINK, { align: 'center', scale: 2, glow: PINK });
        const list = ['aurix', 'verdox', 'scarlax', 'cryovex', 'luma', 'nox'];
        const blurbs = { aurix: 'AFRAID OF THE CHALICE', verdox: 'GUARDS KEYS. SPITS FIRE', scarlax: 'FAST. HUNTS YOU DOWN', cryovex: 'BREATHES ICE', luma: 'TWIN. BLINKS TO YOU', nox: 'TWIN. SPITS FIRE' };
        const shown = Math.min(list.length, Math.floor(t / 0.7) + 1);
        list.slice(0, shown).forEach((k, i) => {
            const col = i % 2, row = Math.floor(i / 2);
            const x = 14 + col * 156, y = 38 + row * 44;
            const fr = A.dragons[k].frames[Math.floor(t * 5 + i) % 2];
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
            ctx.drawImage(fr.glow, x - fr.glow.pad, y - fr.glow.pad, fr.glow.width / 3, fr.glow.height / 3); ctx.restore();
            ctx.drawImage(fr.img, x, y);
            drawText(ctx, DRAGONS[k].name, x + 30, y + 2, A.dragons[k].pal.glow);
            drawText(ctx, `${DRAGONS[k].hp * 1000} PTS`, x + 30, y + 11, WHITE);
            drawText(ctx, blurbs[k], x + 30, y + 20, GREY);
        });
        if (t > 4.5) {
            const fr = A.bat[Math.floor(t * 9) % 2];
            ctx.drawImage(fr.img, 30, 172);
            drawText(ctx, 'BYTE STEALS WHAT YOU CARRY', 52, 174, '#5cf0b0');
            drawText(ctx, 'AND IF YOU DAWDLE... THE NULL', 52, 188, Math.floor(t * 4) % 2 ? PINK : CYAN);
        }
        this.footer(credits, hi, t);
        this.tap(0, 0, W, H, 'start');
    }

    scores(t, credits, hi, table) {
        this.begin();
        this.clear('#07020e');
        this.synth(t, 260, 230);
        const ctx = this.ctx;
        drawText(ctx, 'HALL OF FAME', W / 2, 16, GOLD, { align: 'center', scale: 2, glow: GOLD });
        const cols = [PINK, ORANGE, GOLD, '#3aff7a', CYAN, '#7a6aff'];
        for (let i = 0; i < 10; i++) {
            const e = table[i];
            const y = 44 + i * 15;
            const c = cols[(i + Math.floor(t * 4)) % cols.length];
            const rank = ['1ST', '2ND', '3RD'][i] || `${i + 1}TH`;
            drawText(ctx, rank.padStart(4, ' '), 56, y, c);
            drawText(ctx, e ? String(e.score).padStart(7, '0') : '-------', 100, y, WHITE);
            drawText(ctx, e ? e.name : '...', 156, y, c);
            drawText(ctx, e ? `R${e.realm}${e.mode === 'remix' ? ' MIX' : ''}` : '', 186, y, GREY);
        }
        this.footer(credits, hi, t);
        this.tap(0, 0, W, H, 'start');
    }

    demoOverlay(t, credits) {
        this.begin();
        const ctx = this.ctx;
        if (Math.floor(t * 1.5) % 2 === 0) drawText(ctx, 'DEMO PLAY', W / 2, PF_Y + 6, WHITE, { align: 'center', scale: 2, shadow: '#000', glow: PINK });
        if (Math.floor(t * 2) % 2 === 0) drawText(ctx, credits > 0 ? 'PRESS START' : 'INSERT COIN', W / 2, PF_Y + 180, CYAN, { align: 'center', shadow: '#000', glow: CYAN });
        this.tap(0, 0, W, H, 'start');
    }

    // ------------------------------------------------------------------ menus
    /** A list menu. rows: [{ label, value?, act }], sel index. */
    menu(title, rows, sel, t, opts = {}) {
        this.begin();
        const ctx = this.ctx;
        if (opts.backdrop !== false) { this.clear('#07020e'); this.synth(t, 260, 230); }
        else { ctx.fillStyle = 'rgba(4,0,10,0.78)'; ctx.fillRect(0, 0, W, H); }
        drawText(ctx, title, W / 2, opts.titleY ?? 26, opts.color || CYAN, { align: 'center', scale: 2, glow: opts.color || CYAN });
        const y0 = opts.y0 ?? 66, gap = opts.gap ?? 18;
        rows.forEach((r, i) => {
            const y = y0 + i * gap;
            const on = i === sel;
            if (on) {
                ctx.fillStyle = 'rgba(255,46,206,0.18)'; ctx.fillRect(40, y - 4, W - 80, 15);
                ctx.fillStyle = PINK; ctx.fillRect(40, y - 4, 2, 15); ctx.fillRect(W - 42, y - 4, 2, 15);
                if (Math.floor(t * 4) % 2) drawText(ctx, '►', 48, y, PINK);
            }
            const dim = r.disabled;
            drawText(ctx, r.label, 60, y, dim ? '#4a4258' : on ? WHITE : '#c8bcd8');
            if (r.value !== undefined) drawText(ctx, (r.arrows && on ? '◄ ' : '') + r.value + (r.arrows && on ? ' ►' : ''), W - 52, y, dim ? '#4a4258' : on ? GOLD : '#a89a70', { align: 'right' });
            this.tap(40, y - 5, W - 80, gap, { row: i });
        });
        if (opts.foot) drawText(ctx, opts.foot, W / 2, H - 14, GREY, { align: 'center' });
    }

    intro(realmIndex, loop, t, A, skill) {
        this.begin();
        const ctx = this.ctx;
        const R = REALMS[realmIndex];
        this.clear('#05010a');
        this.synth(t, 200, 190, 1);
        const k = Math.min(1, t * 2);
        drawText(ctx, `REALM ${realmIndex + 1}${loop > 1 ? '  LOOP ' + loop : ''}`, W / 2, 20, CYAN, { align: 'center', scale: 2, glow: CYAN });
        ctx.globalAlpha = k;
        drawText(ctx, R.name, W / 2, 46, GOLD, { align: 'center', scale: 2, glow: ORANGE });
        drawText(ctx, R.blurb[0], W / 2, 76, WHITE, { align: 'center', shadow: '#000' });
        drawText(ctx, R.blurb[1], W / 2, 87, WHITE, { align: 'center', shadow: '#000' });
        const kinds = [...new Set(R.dragons.map((d) => d.kind))];
        kinds.forEach((kd, i) => {
            const x = W / 2 - kinds.length * 22 + i * 44 + 10, y = 104;
            const fr = A.dragons[kd].frames[Math.floor(t * 5 + i) % 2];
            ctx.drawImage(fr.img, x, y);
            drawText(ctx, DRAGONS[kd].name, x + 12, y + 28, A.dragons[kd].pal.glow, { align: 'center' });
        });
        if (R.boss) drawText(ctx, 'CHROMAGON AWAITS', W / 2, 150, '#e8f0ff', { align: 'center', glow: '#c0e0ff' });
        drawText(ctx, `SKILL ${skill}`, W / 2, 166, GREY, { align: 'center' });
        ctx.globalAlpha = 1;
        if (t > 1.2 && Math.floor(t * 3) % 2) drawText(ctx, 'GET READY!', W / 2, 196, PINK, { align: 'center', scale: 2, glow: PINK });
        this.tap(0, 0, W, H, 'confirm');
    }

    tally(rows, total, t, done) {
        this.begin();
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(4,0,10,0.85)'; ctx.fillRect(0, PF_Y, W, H - PF_Y);
        drawText(ctx, 'REALM CLEAR!', W / 2, PF_Y + 14, GOLD, { align: 'center', scale: 2, glow: ORANGE });
        rows.forEach((r, i) => {
            const y = PF_Y + 48 + i * 16;
            drawText(ctx, r.label, 60, y, r.color || WHITE);
            drawText(ctx, r.shown, W - 60, y, WHITE, { align: 'right' });
        });
        drawText(ctx, 'TOTAL', 60, PF_Y + 150, CYAN);
        drawText(ctx, String(total).padStart(7, '0'), W - 60, PF_Y + 150, CYAN, { align: 'right', glow: CYAN });
        if (done && Math.floor(t * 2) % 2) drawText(ctx, 'PRESS START', W / 2, PF_Y + 180, PINK, { align: 'center', glow: PINK });
        this.tap(0, 0, W, H, 'confirm');
    }


    cont(n, credits, t) {
        this.begin();
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(4,0,10,0.8)'; ctx.fillRect(0, 0, W, H);
        drawText(ctx, 'CONTINUE?', W / 2, 60, PINK, { align: 'center', scale: 3, glow: PINK });
        drawText(ctx, String(n), W / 2, 104, GOLD, { align: 'center', scale: 5, glow: ORANGE });
        drawText(ctx, credits > 0 ? 'PRESS START' : 'INSERT COIN', W / 2, 160, Math.floor(t * 3) % 2 ? CYAN : WHITE, { align: 'center' });
        drawText(ctx, `CREDIT ${credits}`, W / 2, 174, GREY, { align: 'center' });
        drawText(ctx, 'B: GIVE UP', W / 2, 200, GREY, { align: 'center' });
        this.tap(0, 0, W, H * 0.75, 'confirm');
        this.tap(0, H * 0.75, W, H * 0.25, 'back');
    }

    gameover(t) {
        this.begin();
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(4,0,10,0.85)'; ctx.fillRect(0, 0, W, H);
        const k = Math.min(1, t);
        ctx.globalAlpha = k;
        drawText(ctx, 'GAME', W / 2, 80, PINK, { align: 'center', scale: 4, glow: PINK });
        drawText(ctx, 'OVER', W / 2, 116, PINK, { align: 'center', scale: 4, glow: PINK });
        ctx.globalAlpha = 1;
        this.tap(0, 0, W, H, 'confirm');
    }

    entry(score, letters, pos, t) {
        this.begin();
        this.clear('#05010a');
        this.synth(t, 260, 230);
        const ctx = this.ctx;
        drawText(ctx, 'NEW HIGH SCORE!', W / 2, 24, GOLD, { align: 'center', scale: 2, glow: ORANGE });
        drawText(ctx, String(score).padStart(7, '0'), W / 2, 54, WHITE, { align: 'center', scale: 2 });
        drawText(ctx, 'ENTER YOUR INITIALS', W / 2, 86, CYAN, { align: 'center' });
        for (let i = 0; i < 3; i++) {
            const x = W / 2 - 36 + i * 28;
            const on = i === pos;
            drawText(ctx, letters[i], x, 108, on ? (Math.floor(t * 6) % 2 ? PINK : WHITE) : WHITE, { scale: 3, glow: on ? PINK : null });
            ctx.fillStyle = on ? PINK : '#4a4258'; ctx.fillRect(x - 1, 132, 16, 2);
            this.tap(x - 6, 96, 26, 20, { up: i });
            this.tap(x - 6, 116, 26, 24, { down: i });
        }
        drawText(ctx, '▲▼ CHOOSE   A NEXT   B BACK', W / 2, 160, GREY, { align: 'center' });
        this.tap(W / 2 - 40, 176, 80, 18, 'confirm');
        drawText(ctx, pos >= 3 ? 'DONE' : 'OK', W / 2, 180, GOLD, { align: 'center' });
    }

    ending(t, score) {
        this.begin();
        const ctx = this.ctx;
        this.clear('#05010a');
        const rise = Math.min(1, t / 8);
        this.synth(t, 160 - rise * 60, 160, 0);
        // the chalice rises with the sun
        const cy = 140 - rise * 70;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(W / 2, cy, 2, W / 2, cy, 40);
        g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,200,255,0)');
        ctx.fillStyle = g; ctx.fillRect(W / 2 - 40, cy - 40, 80, 80); ctx.restore();
        ctx.drawImage(this.r.A.chromeChalice, W / 2 - 8, cy - 10, 16, 20);
        const lines = [
            [2, 'THE CHROME CHALICE IS HOME.', GOLD], [4, 'THE SUN RISES OVER THE GRID.', WHITE],
            [9, 'CHROME CHALICE', CYAN], [11, 'A TRIBUTE TO ADVENTURE (1979)', WHITE], [13, 'BY WARREN ROBINETT', WHITE],
            [16, 'EVERY PIXEL, EVERY NOTE AND', GREY], [17.2, 'EVERY SOUND MADE IN CODE', GREY],
            [20, `FINAL SCORE ${String(score).padStart(7, '0')}`, PINK], [23, 'THANK YOU FOR PLAYING', GOLD], [26, 'THE GRID IS NEVER SAFE FOR LONG...', CYAN],
        ];
        const scroll = Math.max(0, t - 8) * 9;
        for (const [at, s, c] of lines) {
            if (t < at) continue;
            const y = 180 + at * 12 - scroll - (t < 8 ? -1000 : 0);
            const yy = t < 8 ? 190 + (at - 2) * 6 : y - 60;
            if (yy < -10 || yy > H) continue;
            ctx.globalAlpha = Math.min(1, (t - at) * 2);
            drawText(ctx, s, W / 2, yy, c, { align: 'center', shadow: '#000' });
        }
        ctx.globalAlpha = 1;
        this.tap(0, 0, W, H, 'confirm');
    }

    jukebox(sel, unlocked, playing, t) {
        const rows = JUKEBOX.map((id) => ({ label: unlocked.includes(id) ? SONGS[id].name : '?????', value: playing === id ? '♥' : '', disabled: !unlocked.includes(id) }));
        rows.push({ label: 'BACK' });
        this.menu('SOUND TEST', rows, sel, t, { y0: 48, gap: 15, color: PINK, foot: 'FIND A CASSETTE IN EACH REALM' });
    }
}

