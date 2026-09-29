/**
 * juice.js — maps every simulation event to its feedback: sound, particles,
 * debris, rings, flares, lightning, damage numbers, screen shake, FOV punch,
 * colour flashes, hit-stop, slow motion and HUD banners.
 *
 * main.js drains the sim's fxQueue into handleEvent() once per frame.
 * `quiet` (the title-screen attract demo) keeps the visuals, drops the audio
 * and the numbers.
 */

import { sfx } from './sounds.js';
import { burst, debris, ring, bolt, flare, number } from './view/fx.js';
import { shake, punch, flash } from './view/scene.js';
import { banner, popLevel } from './ui.js';
import { BULLET_COLORS } from './view/projectiles.js';
import { CHAPTERS } from './config.js';

let T = { hitstop() {}, slowmo() {} };
export function initJuice(timeControls) { T = timeControls; }

const ENEMY_COLOR = {
    slime: 0x6aff6a, slimelet: 0x6aff6a, bat: 0x8a5aba, archer: 0xe8e0cc, plant: 0xff7ab0, mage: 0x6a7aff,
    spider: 0x5a3a3a, boar: 0xb07a4a, bomber: 0x7ac85a, ghost: 0xb8d0ff, golem: 0x9a948a, worm: 0xd87a6a, eye: 0xc080ff,
    boss: 0xffd060,
};
const ELEM_COLOR = { fire: 0xff8a2a, poison: 0x8aff5a, bolt: 0xfff06a, frost: 0x8ae8ff, ice: 0x8ae8ff };

export function handleEvent(ev, w, quiet) {
    const loud = !quiet;
    switch (ev.type) {
        case 'shoot':
            if (loud) sfx.shoot(ev.n);
            flare(w.player.x + Math.cos(ev.ang) * 0.5, w.player.y + Math.sin(ev.ang) * 0.5, { h: 0.6, color: 0xffe0a0, size: 0.9, life: 0.08 });
            break;
        case 'hit': {
            const col = ev.elem ? ELEM_COLOR[ev.elem] : ev.crit ? 0xffd060 : 0xfff4e0;
            burst(ev.x, ev.y, { n: ev.crit ? 10 : 5, color: col, speed: ev.crit ? 5 : 3, size: 0.28, life: 0.3, up: 2 });
            if (loud) {
                number(ev.x, ev.y, ev.boss ? 2.4 : 1.4, ev.headshot ? 'HEADSHOT' : String(ev.dmg), ev.headshot ? 'head' : ev.crit ? 'crit' : ev.elem ?? '');
                sfx.hit(ev.crit);
            }
            if (ev.crit) { shake(ev.boss ? 0.04 : 0.07); flare(ev.x, ev.y, { color: 0xffd060, size: 1.4, life: 0.12 }); }
            if (ev.headshot) { T.hitstop(0.06); shake(0.15); }
            break;
        }
        case 'dot':
            burst(ev.x, ev.y, { n: 2, color: ELEM_COLOR[ev.elem] ?? 0xffffff, speed: 1, up: 2.5, size: 0.25, life: 0.5, gravity: -1 });
            if (loud) { number(ev.x, ev.y, 1.2, String(ev.dmg), ev.elem === 'poison' ? 'poison' : 'dot'); sfx.dot(); }
            break;
        case 'kill': {
            const col = ENEMY_COLOR[ev.type] ?? 0xffffff;
            const big = ev.boss || ev.elite;
            burst(ev.x, ev.y, { n: big ? 60 : 18, color: col, speed: big ? 7 : 4.5, size: big ? 0.6 : 0.4, life: big ? 0.9 : 0.5, up: 3 });
            burst(ev.x, ev.y, { n: big ? 20 : 6, color: 0xffffff, speed: 2, size: 0.5, life: 0.25 });
            debris(ev.x, ev.y, { n: big ? 20 : 7, color: col, speed: big ? 5 : 3, size: big ? 0.2 : 0.12, h: 0.5 });
            ring(ev.x, ev.y, { color: col, from: 0.2, to: big ? 5 : 1.6, life: big ? 0.6 : 0.3 });
            flare(ev.x, ev.y, { color: col, size: big ? 6 : 2.2, life: big ? 0.4 : 0.15 });
            shake(ev.boss ? 0.6 : ev.elite ? 0.35 : 0.1);
            if (loud) sfx.kill(big);
            if (ev.boss) {
                T.slowmo(0.25, 1.4);
                flash(0.4, 0xfff0c0);
                punch(4);
                if (loud) { banner('VICTORY', 'The guardian falls'); sfx.victory(); }
            } else if (ev.elite) {
                T.hitstop(0.1);
                punch(2);
            }
            break;
        }
        case 'playerHurt':
            burst(ev.x, ev.y, { n: 14, color: 0xff3040, speed: 4, size: 0.35, life: 0.4 });
            shake(0.32);
            flash(0.22, 0xff2030);
            T.hitstop(0.05);
            if (loud) { number(ev.x, ev.y, 1.6, '-' + ev.dmg, 'hurt'); sfx.hurt(); }
            break;
        case 'dodge':
            if (loud) { number(ev.x, ev.y, 1.6, 'DODGE', 'info'); sfx.dodge(); }
            burst(ev.x, ev.y, { n: 8, color: 0xc0e8ff, speed: 3, size: 0.3, life: 0.3 });
            break;
        case 'block':
            ring(ev.x, ev.y, { color: 0x60c0ff, from: 0.5, to: 1.8, life: 0.35, h: 0.6 });
            if (loud) { number(ev.x, ev.y, 1.6, 'BLOCKED', 'info'); sfx.block(); }
            break;
        case 'heal':
            burst(ev.x, ev.y, { n: 12, color: 0x5aff8a, speed: 1.5, up: 3, size: 0.3, life: 0.7, gravity: -2 });
            if (loud) number(ev.x, ev.y, 1.8, '+' + ev.amt, 'heal');
            break;
        case 'xp': if (loud) sfx.xp(); break;
        case 'coin': if (loud) sfx.coin(); break;
        case 'heart': if (loud) sfx.heart(); break;
        case 'levelUp':
            ring(w.player.x, w.player.y, { color: 0x60ffb0, from: 0.3, to: 2.6, life: 0.6 });
            burst(w.player.x, w.player.y, { n: 30, color: 0x9affd0, speed: 1.2, up: 6, size: 0.3, life: 0.9, gravity: 1, spread: 0.8 });
            if (loud) { sfx.levelUp(); popLevel(); number(w.player.x, w.player.y, 2.2, 'LEVEL UP', 'big'); }
            break;
        case 'roomClear':
            if (loud) sfx.clear();
            break;
        case 'doorOpen':
            flare(0, w.grid.rows, { h: 1.2, color: 0x7affd8, size: 5, life: 0.6 });
            if (loud) sfx.door();
            break;
        case 'roomExit': if (loud) sfx.exit(); break;
        case 'spawn':
            burst(ev.x, ev.y, { n: 8, color: 0xb070ff, speed: 1.5, up: 2, size: 0.35, life: 0.5, spread: 0.6 });
            ring(ev.x, ev.y, { color: 0xb070ff, from: 0.8, to: 0.1, life: 0.5 });
            break;
        case 'eliteSpawn':
            if (loud) { banner('ELITE', 'A champion guards this room', 'red small'); sfx.roar(); }
            break;
        case 'bossSpawn':
            shake(0.4);
            if (loud) sfx.bossSpawn();
            break;
        case 'bossPhase':
            shake(0.5); flash(0.25, 0xff2020); punch(2);
            ring(ev.x, ev.y, { color: 0xff3030, from: 0.5, to: 6, life: 0.6 });
            if (loud) { banner('ENRAGED', '', 'red small'); sfx.roar(); }
            break;
        case 'enemyFire': if (loud) sfx.enemyFire(ev.kind); break;
        case 'enemyWind': if (loud) sfx.wind(); break;
        case 'boom': {
            const col = ev.style === 'meteor' ? 0xff7a1a : ev.style === 'rain' ? 0xffe0a0 : ev.style === 'land' ? 0xb0ff90 : 0xff8a3a;
            burst(ev.x, ev.y, { n: 24, color: col, speed: 5, size: 0.5, life: 0.5, up: 3 });
            debris(ev.x, ev.y, { n: 6, color: 0x5a4a3a, speed: 3 });
            ring(ev.x, ev.y, { color: col, from: 0.2, to: ev.r * 1.3, life: 0.3 });
            flare(ev.x, ev.y, { color: col, size: ev.r * 3, life: 0.2 });
            const d = Math.hypot(ev.x - w.player.x, ev.y - w.player.y);
            shake(d < 5 ? 0.2 : 0.06);
            if (loud) sfx.boom(ev.style === 'meteor');
            break;
        }
        case 'slam':
            ring(ev.x, ev.y, { color: 0xffb060, from: 0.4, to: ev.big ? 4 : 2.5, life: 0.45 });
            debris(ev.x, ev.y, { n: ev.big ? 14 : 8, color: 0x6a5a4a, speed: 4 });
            burst(ev.x, ev.y, { n: 16, color: 0xd8c0a0, speed: 4, size: 0.5, life: 0.5, up: 1 });
            shake(ev.big ? 0.45 : 0.25);
            if (loud) sfx.slam();
            break;
        case 'beam': shake(0.12); if (loud) sfx.beam(); break;
        case 'charge': if (loud) sfx.charge(); break;
        case 'crash':
            debris(ev.x, ev.y, { n: ev.big ? 14 : 6, color: 0x7a6a5a, speed: 4 });
            burst(ev.x, ev.y, { n: 12, color: 0xd8c8b0, speed: 3, size: 0.45, life: 0.4 });
            shake(ev.big ? 0.5 : 0.18);
            if (loud) sfx.slam();
            break;
        case 'land':
            burst(ev.x, ev.y, { n: ev.heavy ? 10 : 4, color: 0xd8c8b0, speed: 2.5, size: 0.35, life: 0.35, up: 0.5, h: 0.1 });
            if (loud) sfx.land();
            break;
        case 'emerge': case 'burrow':
            debris(ev.x, ev.y, { n: ev.big ? 16 : 7, color: 0x6a4a2a, speed: 3 });
            burst(ev.x, ev.y, { n: 10, color: ev.big ? 0x7ae8ff : 0xb09070, speed: 3, size: 0.4, life: 0.4 });
            if (ev.big) shake(0.3);
            if (loud) sfx.land();
            break;
        case 'submerge':
            burst(ev.x, ev.y, { n: 24, color: 0x7ae8ff, speed: 4, size: 0.4, life: 0.5, up: 4 });
            break;
        case 'freeze':
            burst(ev.x, ev.y, { n: 12, color: 0xbff4ff, speed: 3, size: 0.3, life: 0.4 });
            if (loud) sfx.freeze();
            break;
        case 'bolt':
            bolt(ev.pts);
            for (const [x, y] of ev.pts) flare(x, y, { color: 0xfff27a, size: 1.2, life: 0.12 });
            if (loud) sfx.bolt();
            break;
        case 'ricochet': case 'arrowBounce':
            burst(ev.x, ev.y, { n: 3, color: 0xfff0c0, speed: 2, size: 0.2, life: 0.2 });
            break;
        case 'arrowWall':
            burst(ev.x, ev.y, { n: 3, color: 0xd8c8b0, speed: 1.5, size: 0.22, life: 0.25, up: 1 });
            break;
        case 'bulletPop':
            burst(ev.x, ev.y, { n: 4, color: BULLET_COLORS[ev.kind] ?? 0xff4040, speed: 2, size: 0.3, life: 0.25 });
            break;
        case 'teleport':
            burst(ev.x, ev.y, { n: 24, color: 0xc060ff, speed: 3, size: 0.45, life: 0.5, up: 3 });
            ring(ev.x, ev.y, { color: 0xc060ff, from: ev.arrive ? 2 : 0.2, to: ev.arrive ? 0.2 : 2, life: 0.35 });
            if (loud) sfx.teleport();
            break;
        case 'summon':
            burst(ev.x, ev.y, { n: 20, color: 0x7a3aaa, speed: 3, size: 0.5, life: 0.6 });
            break;
        case 'bossSplit':
            burst(ev.x, ev.y, { n: 30, color: 0x6aff6a, speed: 5, size: 0.5, life: 0.6 });
            shake(0.3);
            break;
        case 'devilAppears':
            flash(0.2, 0x600010);
            if (loud) banner('A DEAL…', 'The Devil waits by the door', 'red small');
            break;
        case 'chosen':
            ring(w.player.x, w.player.y, { color: 0xffd060, from: 0.3, to: 2, life: 0.5 });
            if (loud) sfx.pick();
            break;
        case 'star':
            flare(w.player.x, w.player.y, { color: 0xffe060, size: 3, life: 0.4 });
            break;
        case 'aegisReady':
            ring(w.player.x, w.player.y, { color: 0x60c0ff, from: 1.4, to: 0.6, life: 0.3, h: 0.6 });
            break;
        case 'spikes': if (loud) sfx.spikes(); break;
        case 'revive':
            flash(0.4, 0xffffff);
            ring(ev.x, ev.y, { color: 0xff7aa0, from: 0.3, to: 4, life: 0.7 });
            burst(ev.x, ev.y, { n: 40, color: 0xff9ac0, speed: 4, size: 0.5, life: 0.8, up: 5 });
            T.slowmo(0.35, 0.8);
            if (loud) { banner('REVIVED', 'Extra Life spent'); sfx.revive(); }
            break;
        case 'death':
            T.slowmo(0.25, 1.2);
            flash(0.35, 0xff1020);
            burst(ev.x, ev.y, { n: 40, color: 0xff3040, speed: 5, size: 0.5, life: 0.9 });
            if (loud) sfx.death();
            break;
        case 'floorUp':
            if (loud) banner(`FLOOR ${ev.cycle + 1}`, CHAPTERS[ev.chapter - 1].name);
            break;
    }
}
