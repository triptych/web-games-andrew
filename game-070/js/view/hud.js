// The HUD and every menu screen, drawn as beams in a fixed 400 × 300 overlay (y up)
// with the stroke font, so the text glows and trails like everything else.
// Tappable things push a rectangle into `hits` (logical coordinates, y up).

import { VIEW_W, VIEW_H, FIELD, COL, WORLD_W, SCORE } from '../config.js';
import { drawText, textWidth } from '../art/font.js';
import { SHAPES, HIVE, rock, drawShape, drawWire } from '../art/shapes.js';
import { NEAR, STEP, SAMPLES } from '../sim/terrain.js';
import { wdx } from '../sim/util.js';

export const C = COL;
const CX = VIEW_W / 2;

const SCAN = { x0: 126, x1: 274, y0: 255, y1: 296 };
const SCAN_K = (SCAN.x1 - SCAN.x0) / WORLD_W;
const scanY = (y) => SCAN.y0 + 2 + (y / (FIELD.top + 4)) * (SCAN.y1 - SCAN.y0 - 4);

const DOT_COL = {
    snatcher: COL.snatcher, ravager: COL.ravager, minelayer: COL.minelayer, mine: null, hive: COL.hive,
    stinger: COL.stinger, hunter: COL.hunter, dart: COL.dart, meteor: COL.meteor,
};

export class Hud {
    constructor(beams) {
        this.b = beams;
        this.hits = [];
        this.banners = [];
        this.t = 0;
    }

    begin() { this.hits.length = 0; }
    end() {}
    clearEffects() { this.banners.length = 0; }

    text(str, x, y, col = C.text, size = 1, align = 'left', inten = 1, reveal = 1, jitter = 0) {
        this.b.pen(col, inten, 0.55 + size * 0.28);
        drawText(this.b, str, x, y, size, align, reveal, jitter, this.t);
    }

    hit(id, x, y, w, h) { this.hits.push({ id, x, y, w, h }); }

    banner(text, col, dur = 2.2, size = 2, sub = null, subCol = C.text) {
        this.banners.push({ text, col, dur, size, sub, subCol, t: 0 });
    }

    // ================================================================== events
    onEvent(e, w) {
        const S = w.session;
        switch (e.type) {
            case 'waveStart':
                if (e.boss) this.banner('WARNING!!', C.red, 2.4, 2.6, e.name, C.yellow);
                else this.banner(`ATTACK WAVE ${e.wave + 1}`, C.cyan, 2.0, 2.2, e.name, C.yellow);
                break;
            case 'planetDie': this.banner('PLANET LOST!', C.orange, 2.8, 2.6, 'NO COLONISTS LEFT', C.red); break;
            case 'extra': this.banner('EXTRA SHIP!', C.yellow, 1.6, 2, '+1 SMART BOMB', C.cyan); break;
            case 'squadronBonus': this.banner('SQUADRON BONUS 1000', C.orange, 1.4, 1.4); break;
            case 'bossPhase': this.banner('ENRAGED!', C.red, 1.2, 2); break;
            case 'bossDie': this.banner(`${e.name}`, C.yellow, 2.4, 1.6, 'DESTROYED!', C.green); break;
            case 'hunter': if (w.countKind('hunter') <= 1) this.banner('HUNTER INBOUND', C.hunter, 1.2, 1.2); break;
            case 'gameOver': break;
        }
        void S;
    }

    stepBanners(dt) {
        if (!this.banners.length) return;
        const b = this.banners[0];
        b.t += dt;
        if (b.t > b.dur) this.banners.shift();
    }

    drawEffects(t, dt) {
        this.t = t;
        this.stepBanners(dt);
        const bn = this.banners[0];
        if (!bn) return;
        const k = bn.t < 0.25 ? bn.t / 0.25 : bn.t > bn.dur - 0.3 ? Math.max(0, (bn.dur - bn.t) / 0.3) : 1;
        const blink = bn.col === C.red ? (0.6 + 0.4 * Math.sin(t * 18)) : 1;
        this.text(bn.text, CX, 168, bn.col, bn.size, 'center', k * 1.15 * blink, Math.min(1, bn.t * 3));
        if (bn.sub) this.text(bn.sub, CX, 150, bn.subCol, 1.2, 'center', k);
    }

    // ================================================================== play HUD
    drawFrame(t, alarm = false) {
        const b = this.b;
        b.pen(C.hud, 0.55, 0.8);
        b.seg(0, 251, SCAN.x0 - 4, 251); b.seg(SCAN.x1 + 4, 251, VIEW_W, 251);
        b.pen(alarm && (t * 6) % 1 < 0.5 ? C.red : C.hud, alarm ? 1.2 : 0.75, 0.8);
        b.poly([SCAN.x0, SCAN.y0, SCAN.x1, SCAN.y0, SCAN.x1, SCAN.y1, SCAN.x0, SCAN.y1], true);
    }

    drawScanner(w, t) {
        const b = this.b;
        const cam = w.camX;
        const sx = (x) => CX + wdx(x, cam) * SCAN_K;
        // terrain
        if (w.planetAlive) {
            b.pen(C.mountain, 0.45, 0.6);
            const n = 48;
            let px = 0, py = 0;
            for (let i = 0; i <= n; i++) {
                const wx = cam - WORLD_W / 2 + (i / n) * WORLD_W;
                const idx = ((Math.round(wx / STEP) % SAMPLES) + SAMPLES) % SAMPLES;
                const x = SCAN.x0 + (i / n) * (SCAN.x1 - SCAN.x0), y = scanY(FIELD.ground + NEAR[idx] * 0.8);
                if (i) b.seg(px, py, x, y);
                px = x; py = y;
            }
        }
        // view brackets
        const half = (VIEW_W / 2) * SCAN_K;
        b.pen(C.text, 0.7, 0.6);
        for (const s of [-1, 1]) {
            const x = CX + s * half;
            b.seg(x, SCAN.y1 - 1, x, SCAN.y1 - 4); b.seg(x, SCAN.y1 - 1, x - s * 3, SCAN.y1 - 1);
            b.seg(x, SCAN.y0 + 1, x, SCAN.y0 + 4); b.seg(x, SCAN.y0 + 1, x - s * 3, SCAN.y0 + 1);
        }
        for (const c of w.colonists) {
            const lifted = c.state !== 'walk';
            b.pen(lifted && (t * 8) % 1 < 0.5 ? C.white : C.colonist, 1, lifted ? 1.4 : 1);
            b.dot(sx(c.x), scanY(c.y));
        }
        for (const e of w.enemies) {
            if (e.boss) continue;
            const col = DOT_COL[e.kind];
            if (!col || (e.kind === 'dart' && e.state === 'wait')) continue;
            const lift = e.kind === 'snatcher' && e.state === 'lift';
            b.pen(lift && (t * 8) % 1 < 0.5 ? C.white : col, e.warp > 0 ? 0.4 : 1, lift ? 1.6 : 1.1);
            b.dot(sx(e.x), scanY(e.y));
        }
        if (w.boss && !w.boss.dead) {
            b.pen(C.boss, 0.8 + 0.4 * Math.sin(t * 8), 2.6);
            b.dot(sx(w.boss.x), scanY(w.boss.y));
        }
        const s = w.ship;
        if (s.alive) {
            const x = sx(s.x), y = scanY(s.y);
            b.pen(C.white, 1.2, 0.7);
            b.seg(x - 2, y, x + 2, y); b.seg(x, y - 1.5, x, y + 1.5);
        }
    }

    drawPlay(w, S, hi, t) {
        const b = this.b;
        let alarm = false;
        for (const e of w.enemies) if (e.kind === 'snatcher' && e.state === 'lift') { alarm = true; break; }
        if (w.boss && w.boss.beam && w.boss.beam.lift) alarm = true;
        this.drawFrame(t, alarm);
        this.drawScanner(w, t);
        // score and reserves (left)
        this.text(String(S.score).padStart(6, ' '), 10, 282, C.text, 1.7, 'left', 1.1);
        const reserve = Math.max(0, S.lives - 1);
        b.pen(C.ship, 0.9, 0.7);
        for (let i = 0; i < Math.min(6, reserve); i++) drawShape(b, SHAPES.ship, 16 + i * 17, 268, 0.62, 0.62);
        if (reserve > 6) this.text(`+${reserve - 6}`, 118, 265, C.ship, 0.9);
        b.pen(C.pink, 1, 0.7);
        for (let i = 0; i < Math.min(9, S.bombs); i++) {
            const x = 12 + i * 11, y = 258;
            b.poly([x - 3, y, x, y + 3, x + 3, y, x, y - 3], true);
        }
        // right: hi score, wave or boss bar
        this.text('HI', 304, 284, C.grey, 1, 'left', 0.9);
        this.text(String(hi), 390, 284, C.yellow, 1.2, 'right', 0.95);
        if (w.boss && !w.boss.dead && w.state !== 'intro') {
            const B = w.boss;
            this.text(B.name.replace('THE ', ''), 390, 269, C.boss, 0.9, 'right', 1);
            const f = Math.max(0, B.fraction());
            b.pen(C.dim, 0.8, 0.7);
            b.poly([290, 257, 390, 257, 390, 263, 290, 263], true);
            b.pen(B.phase === 2 ? C.red : C.boss, 1.1, 1.6);
            b.seg(292, 260, 292 + 96 * f, 260);
        } else {
            const label = `WAVE ${(S.wave % 15) + 1}` + (S.loop ? ` L${S.loop + 1}` : '');
            this.text(label, 390, 269, C.cyan, 1, 'right', 0.85);
            if (!w.planetAlive) this.text('NO PLANET', 390, 257, C.orange, 0.8, 'right', 0.6 + 0.4 * Math.sin(t * 5));
            else {
                b.pen(C.colonist, 0.9, 0.7);
                const n = w.colonists.length;
                for (let i = 0; i < n; i++) { const x = 388 - i * 6; b.seg(x, 255, x, 260); b.dot(x, 262); }
            }
        }
        if (w.state === 'intro' && !w.def.boss && w.stateT > 0.2) this.text('READY', CX, 120, C.white, 1.4, 'center', 0.5 + 0.5 * Math.sin(t * 10));
        if (w.demo) {
            if ((t * 1.2) % 1 < 0.7) this.text('DEMO PLAY', CX, 220, C.yellow, 1.6, 'center');
        }
    }

    drawTally(w, t) {
        const T = w.tally;
        if (!T) return;
        const k = w.stateT;
        this.text(T.boss ? 'BOSS DESTROYED' : `ATTACK WAVE ${(w.session.wave % 15) + 1}`, CX, 200, C.cyan, 1.8, 'center', 1, Math.min(1, k * 2));
        this.text('COMPLETED', CX, 182, C.cyan, 1.8, 'center', 1, Math.min(1, k * 2 - 0.3));
        if (k > 0.8) {
            if (!w.planetAlive) this.text('THE PLANET IS LOST', CX, 150, C.orange, 1.2, 'center');
            else {
                this.text(`BONUS x ${T.per}`, CX, 152, C.yellow, 1.3, 'center');
                const shown = Math.min(T.alive, Math.floor((k - 1.0) / 0.18) + 1);
                const b = this.b;
                for (let i = 0; i < shown; i++) {
                    const x = CX - (T.alive - 1) * 7 + i * 14, y = 124;
                    b.pen(C.colonist, 1, 0.8);
                    b.seg(x, y + 5.5, x, y + 2.2); b.seg(x, y + 2.2, x - 1.5, y); b.seg(x, y + 2.2, x + 1.5, y);
                    b.seg(x, y + 4.5, x - 2, y + 7); b.seg(x, y + 4.5, x + 2, y + 7);
                    b.dot(x, y + 8);
                }
                if (k > 1.2 + T.alive * 0.18) this.text(`${T.bonus}`, CX, 102, C.white, 1.6, 'center');
            }
        }
    }

    // ================================================================== screens
    drawLogo(t, reveal = 1, y = 196) {
        const glow = 0.85 + 0.15 * Math.sin(t * 2);
        this.text('PHOSPHOR', CX, y, C.cyan, 4.2, 'center', 1.15 * glow, reveal, 0.15);
        this.text('PATROL', CX, y - 36, C.pink, 4.2, 'center', 1.15 * glow, Math.max(0, reveal * 1.6 - 0.6), 0.15);
        if (reveal >= 1) {
            const b = this.b;
            b.pen(C.yellow, 0.6, 0.7);
            b.seg(70, y - 44, 330, y - 44);
        }
    }

    drawPushStart(t, y = 70, touch = false) {
        if ((t * 1.4) % 1 < 0.7) this.text(touch ? 'TAP TO START' : 'PRESS START', CX, y, C.yellow, 1.5, 'center');
    }

    drawFooter(t) {
        this.text('(C) 1982 LUMEN DEFENCE GRID', CX, 18, C.grey, 0.9, 'center', 0.7);
        this.text('1 CREDIT  1 PLAY', CX, 6, C.dim, 0.8, 'center', 0.7);
    }

    drawReapers(t, pageT) {
        this.text('THE REAPERS', CX, 264, C.yellow, 2, 'center', 1, Math.min(1, pageT * 1.5));
        const rows = [
            ['snatcher', 'SNATCHER', SCORE.snatcher, 'TAKES COLONISTS'],
            ['ravager', 'RAVAGER', SCORE.ravager, 'A SNATCHER THAT WON'],
            ['minelayer', 'MINELAYER', SCORE.minelayer, 'SOWS MINES'],
            ['hive', 'HIVE', SCORE.hive, 'FULL OF STINGERS'],
            ['stinger', 'STINGER', SCORE.stinger, 'SWARMS'],
            ['hunter', 'HUNTER', SCORE.hunter, 'COMES IF YOU DAWDLE'],
            ['dart', 'DART', SCORE.dart, 'FLIES IN SQUADRONS'],
            ['meteor', 'METEOR', '20-100', 'SPLITS IN TWO'],
        ];
        const b = this.b;
        rows.forEach(([kind, name, pts, desc], i) => {
            const appear = pageT - 0.4 - i * 0.35;
            if (appear <= 0) return;
            const y = 232 - i * 27;
            const k = Math.min(1, appear * 3);
            b.pen(COL[kind], k, 0.9);
            const x = 70;
            if (kind === 'hive') drawWire(b, HIVE, x, y + 3, 0, 9, t * 0.9, t * 1.3, t * 0.5);
            else if (kind === 'meteor') drawWire(b, rock(7), x, y + 3, 0, 10, t * 0.7, t * 1.1, t * 0.3);
            else if (kind === 'dart') drawShape(b, SHAPES.dart, x, y + 3, 1, 1, -Math.PI / 2 + Math.sin(t * 3) * 0.2);
            else if (kind === 'ravager') drawShape(b, SHAPES.ravager, x, y + 3, 1, 1, t * 3);
            else drawShape(b, SHAPES[kind], x, y + 3, 1, 1);
            this.text(name, 96, y + 4, COL[kind], 1.1, 'left', k);
            this.text(String(pts), 206, y + 4, C.text, 1.1, 'left', k);
            this.text(desc, 96, y - 6, C.grey, 0.75, 'left', k * 0.85);
        });
        if (pageT > 3.6) this.text('SAVE THE COLONISTS!', CX, 14, C.green, 1.3, 'center', 0.7 + 0.3 * Math.sin(t * 4));
    }

    drawHowTo(t, pageT, touch) {
        this.text('HOW TO PLAY', CX, 264, C.yellow, 2, 'center', 1, Math.min(1, pageT * 1.5));
        const lines = [
            ['SNATCHERS CARRY COLONISTS', C.snatcher],
            ['UP TO THE TOP OF THE SKY.', C.snatcher],
            ['SHOOT ONE AND ITS COLONIST FALLS:', C.text],
            ['CATCH THEM  500', C.green],
            ['AND FLY THEM DOWN  500', C.green],
            ['', C.text],
            ['LOSE THEM ALL AND THE PLANET DIES.', C.orange],
            ['', C.text],
            [touch ? 'STICK: FLY   FIRE   BOMB   HYPER' : '{ } THRUST  ^ ~ CLIMB  SPACE FIRE', C.cyan],
            [touch ? 'BOMB CLEARS THE SCREEN' : 'X SMART BOMB   H HYPERSPACE', C.cyan],
        ];
        lines.forEach(([s, col], i) => {
            if (pageT > 0.3 + i * 0.25) this.text(s, CX, 232 - i * 20, col, 1.05, 'center');
        });
    }

    drawHiscores(list, t, highlight = -1) {
        this.text('HALL OF DEFENDERS', CX, 262, C.yellow, 1.8, 'center');
        list.slice(0, 10).forEach((e, i) => {
            const y = 232 - i * 19;
            const hl = i === highlight;
            const col = hl ? ((t * 4) % 1 < 0.5 ? C.white : C.yellow) : i === 0 ? C.pink : C.cyan;
            this.text(`${String(i + 1).padStart(2)}.`, 80, y, C.grey, 1.2, 'left');
            this.text(e.name, 124, y, col, 1.3, 'left');
            this.text(String(e.score).padStart(7), 186, y, col, 1.3, 'left');
            this.text(e.wave || '', 318, y, C.grey, 1, 'left', 0.8);
        });
    }

    drawMenu(title, items, sel, t, y0 = 140) {
        if (title) this.text(title, CX, y0 + 16, C.grey, 1.1, 'center');
        items.forEach((it, i) => {
            const y = y0 - i * 17;
            const on = i === sel;
            const col = on ? C.yellow : C.cyan;
            this.text(it.label, CX, y, col, 1.3, 'center', on ? 1.2 : 0.8);
            if (on) {
                const w = textWidth(it.label, 1.3) / 2;
                const k = Math.sin(t * 8) * 2;
                this.text('}', CX - w - 16 + k, y, C.yellow, 1.3, 'left');
                this.text('{', CX + w + 8 - k, y, C.yellow, 1.3, 'left');
            }
            const w = Math.max(120, textWidth(it.label, 1.3) + 30);
            this.hit(i, CX - w / 2, y - 4, w, 15);
        });
    }

    drawEntry(e, t, touch) {
        this.text('GREAT SCORE!', CX, 236, C.yellow, 2.2, 'center', 1, 1, 0.2);
        this.text('ENTER YOUR INITIALS', CX, 212, C.cyan, 1.2, 'center');
        this.text(String(e.score), CX, 194, C.white, 1.4, 'center');
        const b = this.b;
        for (let i = 0; i < 3; i++) {
            const x = CX - 36 + i * 36;
            const ch = e.name[i] || '';
            const cur = i === e.pos;
            if (ch) this.text(ch, x, 140, cur ? ((t * 4) % 1 < 0.6 ? C.yellow : C.white) : C.green, 4, 'center');
            b.pen(cur ? C.yellow : C.dim, 1, 1);
            b.seg(x - 12, 132, x + 12, 132);
        }
        // tap targets
        this.text('^', CX - 70, 150, C.cyan, 2.4, 'center'); this.hit('up', CX - 90, 140, 40, 30);
        this.text('~', CX - 70, 110, C.cyan, 2.4, 'center'); this.hit('down', CX - 90, 100, 40, 30);
        this.text('OK', CX + 78, 140, C.green, 2, 'center'); this.hit('ok', CX + 56, 126, 46, 36);
        this.text(touch ? 'TAP ^ ~ TO PICK, OK TO ENTER' : 'TYPE, OR ^ ~ AND FIRE', CX, 70, C.grey, 1, 'center');
    }

    drawContinue(n, t) {
        this.text('CONTINUE?', CX, 190, C.yellow, 3, 'center', 1, 1, 0.2);
        this.text(String(Math.max(0, n)), CX, 130, C.pink, 6, 'center', 0.8 + 0.4 * Math.sin(t * 10));
        this.hit('cont', 60, 100, 280, 120);
    }

    drawPaused(t) {
        this.text('PAUSED', CX, 220, C.yellow, 2.6, 'center', 0.8 + 0.2 * Math.sin(t * 4));
    }

    drawGameOver(t) {
        this.text('GAME OVER', CX, 170, C.red, 3.2, 'center', 1, 1, 0.3);
    }
}

export { VIEW_H };
