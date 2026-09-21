/**
 * Screens: title, how-to-play, save slots, pause and game over.
 *
 * All of it is drawn into the same 160x192 buffer with the generated blocky
 * font, so the menus look like part of the cartridge rather than HTML on top
 * of it. Each screen is a small object with draw(dt) and a key/pointer handler.
 */

import { VIEW_W, VIEW_H, POS, NEG } from '../game/constants.js';
import { drawText, textWidth } from '../render/sprites.js';
import { polColor } from '../render/palette.js';
import { allSlots, describeSlot, getHiscore, hasAutosave } from '../game/save.js';

/** Centre a string horizontally at scale and draw it. */
export function centreText(g, str, y, color, scale = 1) {
    const w = textWidth(str, scale, 1);
    drawText(g, str, Math.round(VIEW_W / 2 - w / 2), y, color, scale, 1);
    return w;
}

/** A selectable menu row, with the 2600-style blinking selection block. */
function drawRow(g, pal, label, y, selected, time, color) {
    const w = textWidth(label, 1, 1);
    const x = Math.round(VIEW_W / 2 - w / 2);
    if (selected) {
        if (Math.floor(time * 4) % 2 === 0) {
            g.fillStyle = pal.hudDim;
            g.fillRect(x - 6, y - 2, w + 12, 9);
        }
        drawText(g, '+', x - 5, y, pal.white, 1, 1);
    }
    drawText(g, label, x, y, color || (selected ? pal.white : pal.hud), 1, 1);
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

export function makeTitleScreen(app) {
    let sel = 0;
    // CONTINUE only appears when there is an autosave to resume, so the menu
    // never offers a dead option.
    const canContinue = hasAutosave();
    const items = () => {
        const rows = canContinue ? ['CONTINUE'] : [];
        rows.push('NEW RUN', 'HOW TO PLAY', 'LOAD GAME');
        return rows;
    };

    return {
        name: 'title',
        onEnter() { sel = 0; },
        draw(g, pal, sprites, time) {
            g.fillStyle = pal.bg;
            g.fillRect(0, 0, VIEW_W, VIEW_H);
            g.drawImage(app.playfield, 0, 0);

            // Title, drawn large, with the two polarity colours split across it.
            centreText(g, 'WAKE', 26, polColor(pal, POS), 3);
            centreText(g, 'FORM', 48, polColor(pal, NEG), 3);
            centreText(g, 'LEAVE A FIELD BEHIND YOU', 70, pal.hudDim, 1);

            // A little animated demo of the mechanic: a probe tracing a wake.
            drawTitleDemo(g, pal, time);

            const rows = items();
            rows.forEach((r, i) => drawRow(g, pal, r, 126 + i * 13, i === sel, time));

            const hs = getHiscore();
            if (hs > 0) centreText(g, 'BEST ' + hs, VIEW_H - 24, pal.hudDim, 1);
            centreText(g, app.seed, VIEW_H - 14, pal.hudDim, 1);
        },
        move(d) {
            sel = (sel + d + items().length) % items().length;
            app.sfx.menu();
        },
        select() {
            app.sfx.confirm();
            switch (items()[sel]) {
                case 'CONTINUE': app.continueRun(); break;
                case 'NEW RUN': app.startNewRun(); break;
                case 'HOW TO PLAY': app.pushScreen('howto'); break;
                default: app.pushScreen('load'); break;
            }
        },
        back() { /* nothing above the title */ },
        pointer(bx, by) {
            const rows = items();
            for (let i = 0; i < rows.length; i++) {
                const y = 126 + i * 13;
                if (by >= y - 3 && by <= y + 8) { sel = i; this.select(); return; }
            }
        }
    };
}

/** Animated demonstration: a dot loops, laying a two-colour trail behind it. */
function drawTitleDemo(g, pal, time) {
    const cx = VIEW_W / 2;
    const cy = 98;
    const trailLen = 28;
    for (let i = trailLen; i >= 0; i--) {
        const t = time * 1.1 - i * 0.05;
        const x = cx + Math.cos(t) * 30;
        const y = cy + Math.sin(t * 2) * 10;
        // Polarity alternates every half-loop, mirroring what a player does.
        const pol = Math.floor(t / 1.6) % 2 === 0 ? POS : NEG;
        if (i === 0) {
            g.fillStyle = pal.white;
            g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        } else {
            g.fillStyle = i < 10 ? polColor(pal, pol) : polColor(pal, pol, 'dim');
            g.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
    }
}

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

export function makeHowToScreen(app) {
    let page = 0;
    const pages = [
        {
            title: 'THE WAKE',
            lines: [
                'YOU HAVE NO WEAPON.',
                'YOU HAVE ONE BUTTON:',
                'INVERT YOUR POLARITY.',
                '',
                'AS YOU FLY YOU LEAVE',
                'ECHOES BEHIND YOU.',
                'EACH ECHO KEEPS THE',
                'POLARITY YOU HAD AT',
                'THAT MOMENT.'
            ]
        },
        {
            title: 'THE FIELD',
            lines: [
                'ECHOES PUSH AND PULL',
                'MOTES JUST LIKE YOU DO.',
                '',
                'SAME POLARITY REPELS.',
                'OPPOSITE ATTRACTS.',
                '',
                'SO YOUR OLD PATH KEEPS',
                'WORKING AFTER YOU HAVE',
                'FLOWN AWAY FROM IT.'
            ]
        },
        {
            title: 'BUILD AND HARVEST',
            lines: [
                'A LINE OF ONE POLARITY',
                'IS A WALL THAT STEERS.',
                'TWO WALLS MAKE A FUNNEL.',
                '',
                'END A FUNNEL IN OPPOSITE',
                'ECHOES AND MOTES ARE',
                'HELD THERE ORBITING.',
                'FLY IN AND COLLECT THEM',
                'ALL FOR A BIG CHAIN.'
            ]
        },
        {
            title: 'FLUX',
            lines: [
                'EVERY ECHO COSTS FLUX.',
                'SO DOES EVERY FLIP.',
                '',
                'FLY BACK THROUGH YOUR',
                'OWN ECHOES TO RECLAIM',
                'THEM AND GET FLUX BACK.',
                '',
                'HOLD SHIFT TO RUN SILENT',
                'AND SHED NOTHING.'
            ]
        },
        {
            title: 'CONTROLS',
            lines: [
                'ARROWS OR WASD   MOVE',
                'SPACE            INVERT',
                'SHIFT            SILENT',
                'P OR ESC         PAUSE',
                '',
                'ON TOUCH:',
                'LEFT HALF IS A STICK.',
                'TAP RIGHT TO INVERT.',
                'HOLD RIGHT FOR SILENT.'
            ]
        }
    ];

    return {
        name: 'howto',
        onEnter() { page = 0; },
        draw(g, pal, sprites, time) {
            g.fillStyle = pal.bg;
            g.fillRect(0, 0, VIEW_W, VIEW_H);

            const p = pages[page];
            centreText(g, p.title, 12, polColor(pal, page % 2 === 0 ? POS : NEG), 2);

            p.lines.forEach((line, i) => {
                if (!line) return;
                drawText(g, line, 8, 34 + i * 11, pal.hud, 1, 1);
            });

            // Page dots.
            const dotY = VIEW_H - 26;
            pages.forEach((_, i) => {
                const x = Math.round(VIEW_W / 2 - (pages.length * 5) / 2 + i * 5);
                g.fillStyle = i === page ? pal.white : pal.hudDim;
                g.fillRect(x, dotY, 3, 3);
            });

            centreText(g,
                page === pages.length - 1 ? 'SPACE TO START' : 'SPACE FOR MORE',
                VIEW_H - 14, Math.floor(time * 3) % 2 ? pal.hud : pal.hudDim, 1);
        },
        move(d) {
            page = Math.max(0, Math.min(pages.length - 1, page + d));
            app.sfx.menu();
        },
        select() {
            app.sfx.confirm();
            if (page < pages.length - 1) page++;
            else app.startNewRun();
        },
        back() { app.popScreen(); },
        pointer(bx, by) {
            if (bx < VIEW_W * 0.25 && page > 0) { page--; app.sfx.menu(); }
            else this.select();
        }
    };
}

// ---------------------------------------------------------------------------
// Save / load slots
// ---------------------------------------------------------------------------

function slotLabel(i, info) {
    if (!info) return 'SLOT ' + i + '  EMPTY';
    return 'SLOT ' + i + '  W' + info.wave + '  ' + info.score;
}

export function makeSlotScreen(app, mode) {
    // mode is 'save' or 'load'
    let sel = 0;

    const rowCount = () => 4; // 3 slots + back

    return {
        name: mode,
        onEnter() { sel = 0; },
        draw(g, pal, sprites, time) {
            g.fillStyle = pal.bg;
            g.fillRect(0, 0, VIEW_W, VIEW_H);

            centreText(g, mode === 'save' ? 'SAVE GAME' : 'LOAD GAME', 16,
                polColor(pal, mode === 'save' ? POS : NEG), 2);

            const slots = allSlots();
            slots.forEach((s, i) => {
                const label = slotLabel(s.slot, s.info);
                const y = 48 + i * 22;
                const selected = i === sel;
                if (selected && Math.floor(time * 4) % 2 === 0) {
                    g.fillStyle = pal.hudDim;
                    g.fillRect(6, y - 3, VIEW_W - 12, 18);
                }
                drawText(g, label, 12, y, selected ? pal.white : pal.hud, 1, 1);
                if (s.info) {
                    drawText(g, s.info.seed, 12, y + 8, pal.hudDim, 1, 1);
                    const cont = 'CORE ' + s.info.containment;
                    drawText(g, cont, VIEW_W - 12 - textWidth(cont, 1, 1), y + 8,
                        s.info.containment > 2 ? pal.good : pal.warn, 1, 1);
                }
            });

            const backY = 48 + 3 * 22;
            drawRow(g, pal, 'BACK', backY, sel === 3, time);

            const hint = mode === 'save'
                ? 'SPACE SAVES   D DELETES'
                : 'SPACE LOADS   D DELETES';
            centreText(g, hint, VIEW_H - 14, pal.hudDim, 1);
        },
        move(d) {
            sel = (sel + d + rowCount()) % rowCount();
            app.sfx.menu();
        },
        select() {
            if (sel === 3) { app.sfx.menu(); app.popScreen(); return; }
            const slot = sel + 1;
            if (mode === 'save') {
                app.sfx.confirm();
                app.saveToSlot(slot);
                app.popScreen();
            } else {
                const info = describeSlot(slot);
                if (!info) { app.sfx.menu(); return; }
                app.sfx.confirm();
                app.loadFromSlot(slot);
            }
        },
        deleteSelected() {
            if (sel < 3) {
                app.deleteSlot(sel + 1);
                app.sfx.menu();
            }
        },
        back() { app.popScreen(); },
        pointer(bx, by) {
            for (let i = 0; i < 4; i++) {
                const y = 48 + i * 22;
                if (by >= y - 4 && by <= y + 14) { sel = i; this.select(); return; }
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

export function makePauseScreen(app) {
    let sel = 0;
    const rows = ['RESUME', 'SAVE GAME', 'LOAD GAME', 'SOUND', 'QUIT TO TITLE'];

    return {
        name: 'pause',
        transparent: true,
        onEnter() { sel = 0; },
        draw(g, pal, sprites, time) {
            // Dim the frozen board with a dither rather than alpha, which is
            // how a 2600-era game would have had to do it.
            g.fillStyle = pal.bg;
            for (let y = 0; y < VIEW_H; y++) {
                for (let x = (y % 2); x < VIEW_W; x += 2) g.fillRect(x, y, 1, 1);
            }

            centreText(g, 'PAUSED', 30, pal.white, 2);

            rows.forEach((r, i) => {
                const label = r === 'SOUND'
                    ? 'SOUND ' + (app.sfx.muted() ? 'OFF' : 'ON')
                    : r;
                drawRow(g, pal, label, 62 + i * 15, i === sel, time);
            });

            centreText(g, 'WAVE ' + app.rs.run.wave, VIEW_H - 30, pal.hudDim, 1);
            centreText(g, 'SCORE ' + app.rs.score.score, VIEW_H - 20, pal.hudDim, 1);
        },
        move(d) {
            sel = (sel + d + rows.length) % rows.length;
            app.sfx.menu();
        },
        select() {
            app.sfx.confirm();
            switch (sel) {
                case 0: app.popScreen(); break;
                case 1: app.pushScreen('save'); break;
                case 2: app.pushScreen('load'); break;
                case 3: app.sfx.toggleMute(); break;
                case 4: app.quitToTitle(); break;
            }
        },
        back() { app.popScreen(); },
        pointer(bx, by) {
            for (let i = 0; i < rows.length; i++) {
                const y = 62 + i * 15;
                if (by >= y - 4 && by <= y + 10) { sel = i; this.select(); return; }
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

export function makeGameOverScreen(app) {
    let sel = 0;
    let t = 0;
    const rows = ['NEW RUN', 'TITLE'];

    return {
        name: 'gameover',
        onEnter() { sel = 0; t = 0; },
        draw(g, pal, sprites, time) {
            t += 1 / 60;
            g.fillStyle = pal.bg;
            g.fillRect(0, 0, VIEW_W, VIEW_H);

            centreText(g, 'CONTAINMENT', 24, pal.warn, 2);
            centreText(g, 'LOST', 44, pal.warn, 2);

            const s = app.rs.score;
            centreText(g, 'SCORE', 76, pal.hudDim, 1);
            centreText(g, String(s.score), 88, pal.white, 2);

            centreText(g, 'WAVE ' + app.rs.run.wave, 112, pal.hud, 1);
            centreText(g, 'BEST CHAIN X' + s.best, 124, pal.hud, 1);
            centreText(g, 'MOTES ' + s.absorbed, 136, pal.hud, 1);

            if (app.newRecord) {
                const c = Math.floor(time * 5) % 2 ? pal.good : pal.white;
                centreText(g, 'NEW BEST!', 150, c, 1);
            }

            rows.forEach((r, i) => drawRow(g, pal, r, 164 + i * 12, i === sel, time));
        },
        move(d) {
            sel = (sel + d + rows.length) % rows.length;
            app.sfx.menu();
        },
        select() {
            app.sfx.confirm();
            if (sel === 0) app.startNewRun();
            else app.quitToTitle();
        },
        back() { app.quitToTitle(); },
        pointer(bx, by) {
            for (let i = 0; i < rows.length; i++) {
                const y = 164 + i * 12;
                if (by >= y - 4 && by <= y + 8) { sel = i; this.select(); return; }
            }
        }
    };
}
