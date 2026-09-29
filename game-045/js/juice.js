/**
 * juice.js — the director. Every event the simulation pushes onto its fx
 * queue lands here and fans out into sound, particles, lights, camera shake,
 * post-processing spikes, HUD banners and time effects (hit-stop, slow-mo).
 *
 * Keeping all of this in one table makes the game's "feel" tunable in one
 * place, and keeps the simulation free of any presentation concerns.
 *
 * `quiet` mode (the attract-mode demo behind the title) keeps the visuals but
 * drops sounds, banners and most of the camera shake.
 */

import * as S from './sounds.js';
import { sparks, shards, ring, flare, popup } from './view/fx.js';
import { addLight } from './view/lights.js';
import { shake, punch, flash, aberrate } from './view/scene.js';
import { hitBrick, hitBumper, hitSling, flipperFlash, brickColor } from './view/tableView.js';
import { banner, bumpScore } from './ui.js';
import { PICKUPS, COLORS, BRICK_COLORS, TABLE } from './config.js';

const PINK = COLORS.pink, CYAN = COLORS.cyan, GOLD = COLORS.gold, ORANGE = COLORS.orange;
const hexCss = (h) => '#' + h.toString(16).padStart(6, '0');

let time = null;         // { hitstop(s), slowmo(scale, s), later(fn, s) } from main.js

export function initJuice(timeCtl) { time = timeCtl; }

export function handleEvent(ev, w, quiet) {
    const snd = !quiet;
    const k = quiet ? 0.25 : 1;        // camera/post intensity
    switch (ev.type) {
    case 'flip':
        flipperFlash(ev.side);
        if (snd) S.playFlip();
        break;

    case 'flipHit':
        sparks(ev.x, ev.y, PINK, 6, 6, { size: 0.16, life: 0.3 });
        if (snd) S.playFlipperHit(ev.power);
        shake(0.04 * k);
        break;

    case 'bumper': {
        hitBumper(ev.id);
        const hx = ev.hx ?? ev.x, hy = ev.hy ?? ev.y;
        sparks(hx, hy, CYAN, ev.laser ? 6 : 16, 9, { size: 0.2, life: 0.45 });
        ring(ev.x, ev.y, PINK, 0.9, 2.8, 0.35);
        addLight(ev.x, ev.y, PINK, 1.8, 2.6, 5);
        if (!ev.laser) {
            shake(0.12 * k);
            aberrate(0.18 * k);
        }
        if (snd) S.playBumper(ev.id);
        break;
    }

    case 'sling':
        hitSling(ev.side);
        sparks(ev.x, ev.y, PINK, 12, 8, { size: 0.18, life: 0.4 });
        addLight(ev.x, ev.y, PINK, 1.4, 2.2, 6);
        shake(0.08 * k);
        if (snd) S.playSling();
        break;

    case 'wall':
        if (ev.speed > 14) sparks(ev.x, ev.y, CYAN, 3, 4, { size: 0.12, life: 0.25 });
        if (snd) S.playWall(ev.speed);
        break;

    case 'ballClack':
        sparks(ev.x, ev.y, 0xffffff, 5, 5, { size: 0.12, life: 0.2 });
        if (snd) S.playClack();
        break;

    case 'brickHit': {
        hitBrick(ev.id);
        const br = w.bricks.find((b) => b.id === ev.id);
        const col = br ? brickColor(br) : CYAN;
        sparks(ev.x, ev.y, col, 10, 6, { size: 0.18, life: 0.35 });
        addLight(ev.x, ev.y, col, 1.0, 1.8, 7);
        shake(0.05 * k);
        if (snd) S.playBrickHit();
        break;
    }

    case 'brickBreak': {
        const col = ev.kind === 'x' ? BRICK_COLORS.x : ev.kind === 'p' ? BRICK_COLORS.p : BRICK_COLORS[Math.min(4, ev.maxHp)];
        const big = Math.min(1, ev.combo / 20);
        sparks(ev.x, ev.y, col, 22 + Math.min(30, ev.combo), 10 + big * 6, { size: 0.24, life: 0.8 });
        shards(ev.x, ev.y, col, 9, 7 + big * 4);
        ring(ev.x, ev.y, col, 0.3, 2.2 + big * 1.5, 0.4);
        flare(ev.x, ev.y, col, 2 + big * 1.2, 0.2);
        addLight(ev.x, ev.y, col, 2.2, 3, 4);
        shake((0.13 + big * 0.2) * k);
        aberrate((0.22 + big * 0.3) * k);
        punch(0.25 * k);
        if (!quiet && ev.combo > 0 && ev.combo % 10 === 0) time.hitstop(0.06);
        if (snd) S.playBrickBreak(ev.combo);
        break;
    }

    case 'blast':
        sparks(ev.x, ev.y, ORANGE, 55, 17, { size: 0.3, life: 0.9, up: 0.8 });
        sparks(ev.x, ev.y, 0xffe07a, 25, 9, { size: 0.4, life: 0.5 });
        shards(ev.x, ev.y, 0xff3b3b, 16, 12);
        ring(ev.x, ev.y, ORANGE, 0.5, 5.5, 0.55);
        ring(ev.x, ev.y, 0xffffff, 0.2, 3.2, 0.3);
        flare(ev.x, ev.y, ORANGE, 4.5, 0.3, 1);
        addLight(ev.x, ev.y, ORANGE, 3.5, 4.5, 3);
        shake(0.42 * k);
        aberrate(0.8 * k);
        punch(1.4 * k);
        flash(0.22 * k, ORANGE);
        if (!quiet) time.hitstop(0.07);
        if (snd) S.playBlast();
        break;

    case 'score': {
        const pts = ev.pts;
        const color = pts >= 1000 ? '#ffd23d' : pts >= 300 ? '#ff5fc4' : '#7ff8ff';
        const scale = pts >= 1000 ? 1.35 : pts >= 300 ? 1.1 : 0.8;
        popup(pts.toLocaleString('en-US'), ev.x, ev.y + 0.5, color, scale);
        if (!quiet && pts >= 300) bumpScore();
        break;
    }

    case 'pickupSpawn': {
        const c = PICKUPS[ev.kind].color;
        ring(ev.x, ev.y, c, 0.2, 1.8, 0.35);
        sparks(ev.x, ev.y, c, 14, 5, { size: 0.2 });
        break;
    }

    case 'pickup': {
        const def = PICKUPS[ev.kind];
        ring(ev.x, ev.y, def.color, 0.4, 4.5, 0.55);
        ring(ev.x, ev.y, 0xffffff, 0.2, 2.5, 0.3);
        sparks(ev.x, ev.y, def.color, 45, 12, { size: 0.26, life: 0.9, up: 1 });
        flare(ev.x, ev.y, def.color, 3.5, 0.35, 1);
        addLight(ev.x, ev.y, def.color, 3, 4, 3);
        flash(0.12 * k, def.color);
        punch(0.8 * k);
        if (!quiet) {
            if (ev.kind === 'multi') {
                banner('MULTIBALL!', { color: def.color, glitch: true, life: 1.8 });
                time.slowmo(0.35, 0.6);
            } else {
                banner(def.label, { color: def.color, small: true, life: 1.3 });
            }
        }
        if (snd) S.playPickup();
        break;
    }

    case 'pickupLost':
        sparks(ev.x, ev.y, 0x6a4a8a, 10, 3, { size: 0.16 });
        break;

    case 'ballSpawn':
        flare(ev.x, ev.y, CYAN, 4, 0.4, 1);
        ring(ev.x, ev.y, CYAN, 0.3, 2.5, 0.4);
        sparks(ev.x, ev.y, 0xffffff, 20, 8);
        break;

    case 'laser':
        flare(ev.x, ev.y, 0xff2d55, 1.6, 0.12);
        sparks(ev.x, ev.y, 0xff2d55, 5, 5, { dir: Math.PI / 2, spread: 0.8, size: 0.14, life: 0.25 });
        if (snd) S.playLaser();
        break;

    case 'laserHit':
        sparks(ev.x, ev.y, 0xff2d55, 9, 7, { dir: -Math.PI / 2, spread: 2.2, size: 0.16, life: 0.35 });
        addLight(ev.x, ev.y, 0xff2d55, 1.2, 1.6, 8);
        break;

    case 'shieldHit':
        sparks(ev.x, ev.y, 0x3dff8a, 20, 10, { dir: Math.PI / 2, spread: 1.6, size: 0.2 });
        ring(ev.x, ev.y, 0x3dff8a, 0.3, 2.4, 0.3);
        addLight(ev.x, ev.y, 0x3dff8a, 2, 3, 5);
        shake(0.12 * k);
        if (snd) S.playShield();
        break;

    case 'launch':
        sparks(TABLE.laneX, 1.2, CYAN, 18, 7, { dir: Math.PI / 2, spread: 1.2, size: 0.22 });
        flare(TABLE.laneX, 1, CYAN, 3, 0.3);
        shake((0.1 + ev.power * 0.15) * k);
        punch(ev.power * 0.8 * k);
        if (snd) S.playLaunch(ev.power);
        break;

    case 'plungerPull':
        if (snd) S.playPlungerPull();
        break;

    case 'enterField':
        ring(TABLE.right - 0.5, TABLE.laneTop + 1.5, GOLD, 0.2, 1.6, 0.3);
        break;

    case 'ballSaved':
        if (!quiet) banner('BALL SAVED', { color: '#3dff8a', small: true, life: 1.4 });
        if (snd) S.playBallSaved();
        break;

    case 'drain':
        if (ev.last) {
            shake(0.55 * k);
            aberrate(1.1 * k);
            flash(0.3 * k, 0xff2040);
            if (!quiet) {
                banner(w.tilted ? 'TILTED' : 'BALL LOST', {
                    color: '#ff3b3b', glitch: true, life: 1.7,
                    sub: ev.lives > 0 ? `${ev.lives} LEFT` : undefined,
                });
                time.slowmo(0.3, 0.5);
            }
        }
        sparks(ev.x, 0.2, 0xff3b3b, ev.last ? 30 : 12, 9, { dir: Math.PI / 2, spread: 1.4, size: 0.24 });
        if (snd) S.playDrain(ev.last);
        break;

    case 'gameOver':
        if (snd) S.playGameOver();
        break;

    case 'waveClear':
        if (!quiet) {
            banner('WAVE CLEAR', { color: '#ffd23d', sub: `+${ev.bonus.toLocaleString('en-US')}`, life: 2.4, glitch: true });
            time.slowmo(0.3, 1.0);
        }
        flash(0.35 * k, GOLD);
        shake(0.4 * k);
        punch(2 * k);
        aberrate(1 * k);
        // Fireworks over the empty brick field.
        for (let i = 0; i < 14; i++) {
            time.later(() => {
                const x = (Math.random() - 0.5) * 9, y = 18 + Math.random() * 6;
                const c = [PINK, CYAN, GOLD, COLORS.purple][i % 4];
                sparks(x, y, c, 40, 12, { size: 0.28, life: 1, up: 1.2 });
                ring(x, y, c, 0.2, 3, 0.5);
                flare(x, y, c, 2.5, 0.3, 1);
                addLight(x, y, c, 2.5, 3.5, 3);
            }, i * 0.11);
        }
        if (snd) S.playWaveClear();
        break;

    case 'waveStart':
        if (!quiet && ev.wave > 1) {
            banner(`WAVE ${ev.wave}`, { color: '#35f2ff', sub: ev.name, life: 2 });
        }
        if (snd && ev.wave > 1) S.playWaveStart();
        break;

    case 'comboUp':
        if (!quiet && ev.mult >= 2) {
            banner(`COMBO ×${ev.mult}`, { color: hexCss(ev.mult >= 5 ? GOLD : PINK), small: ev.mult < 5, glitch: ev.mult >= 5, life: 1.1 });
        }
        aberrate(0.3 * k);
        if (snd) S.playComboUp(ev.mult);
        break;

    case 'extraBall':
        if (!quiet) banner('EXTRA BALL!', { color: '#35f2ff', glitch: true, life: 2 });
        flash(0.2 * k, CYAN);
        if (snd) S.playExtraBall();
        break;

    case 'nudge':
        shake(0.35 * k);
        if (snd) S.playNudge();
        if (!quiet && ev.heat > 2) banner('DANGER', { color: '#ff3b3b', small: true, life: 0.8 });
        break;

    case 'tilt':
        if (!quiet) banner('TILT', { color: '#ff3b3b', glitch: true, life: 2.5 });
        flash(0.3 * k, 0xff2040);
        aberrate(1.2 * k);
        if (snd) S.playTilt();
        break;

    case 'unstick':
        sparks(ev.x, ev.y, CYAN, 12, 6);
        if (snd) S.playUnstick();
        break;
    }
}

/** Continuous per-frame effects (fireball embers). */
export function frameJuice(w, dt) {
    if (w.power.fire > 0) {
        for (const b of w.balls) {
            if (b.held) continue;
            sparks(b.x, b.y, Math.random() < 0.5 ? ORANGE : 0xffd23d, 2, 2.5, { size: 0.3, life: 0.35, grav: -0.15, up: 1.5, drag: 3 });
        }
    }
}
