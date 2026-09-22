/**
 * hud.js — the DOM heads-up display. Reads the world each frame and writes the
 * few elements that changed; it never writes back into the simulation.
 *
 * The headcount (SAVED / LOST) is deliberately the biggest thing after the
 * score, because it is the number the ending is based on.
 */

import { MAX_POWER, PLAYER, WEAPONS } from '../core/config.js';
import { TOTAL_CADETS } from '../sim/story.js';

const el = {};
let last = {};

export function initHud() {
    for (const id of ['score-val', 'chain-val', 'saved-val', 'lost-val', 'roll-val',
                      'lives-row', 'flares-row', 'weapon-name', 'power-pips',
                      'od-fill', 'od-label', 'boss-bar', 'boss-name', 'boss-title',
                      'boss-fill', 'boss-parts', 'level-name', 'level-fill',
                      'graze-val', 'hud']) {
        el[id] = document.getElementById(id);
    }
    last = {};
    if (el['roll-val']) el['roll-val'].textContent = String(TOTAL_CADETS);
}

function setText(key, value) {
    const node = el[key];
    if (!node) return;
    if (last[key] === value) return;
    last[key] = value;
    node.textContent = value;
}

/**
 * Draw up to `max` pips; beyond that, draw a few and a x N counter, so a lucky
 * run (or a debug session) cannot push the rest of the HUD off the screen.
 */
function icons(node, count, glyph, cls, max = 6) {
    if (!node) return;
    const key = `${count}|${cls}`;
    if (node.dataset.key === key) return;
    node.dataset.key = key;
    node.innerHTML = '';
    const shown = Math.min(count, max);
    for (let i = 0; i < shown; i++) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = glyph;
        node.appendChild(span);
    }
    if (count > max) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = `x${count}`;
        node.appendChild(span);
    }
}

export function updateHud(world, run) {
    if (!world || !el.hud) return;
    const p = world.player;

    setText('score-val', formatScore(run.score + world.stats.score));
    setText('saved-val', String(run.rescued + world.stats.cadets));
    setText('lost-val', String(run.lost + world.stats.cadetsLost));
    setText('graze-val', String(p.graze));
    setText('chain-val', world.chain > 1 ? `x${world.chain}` : '');

    icons(el['lives-row'], Math.max(0, p.lives), '▲', 'life-pip');
    icons(el['flares-row'], Math.max(0, p.flares), '✦', 'flare-pip');

    setText('weapon-name', (WEAPONS[p.weapon] ?? WEAPONS.vulcan).name);
    if (el['power-pips'] && el['power-pips'].dataset.key !== String(p.power)) {
        el['power-pips'].dataset.key = String(p.power);
        el['power-pips'].innerHTML = '';
        for (let i = 0; i < MAX_POWER; i++) {
            const pip = document.createElement('span');
            pip.className = 'power-pip' + (i < p.power ? ' on' : '');
            el['power-pips'].appendChild(pip);
        }
    }

    if (el['od-fill']) {
        const pct = p.odActive > 0 ? (p.odActive / PLAYER.odDuration) * 100 : p.od;
        el['od-fill'].style.width = `${pct.toFixed(1)}%`;
        el['od-fill'].classList.toggle('active', p.odActive > 0);
        el['od-fill'].classList.toggle('ready', p.od >= 100 && p.odActive <= 0);
    }
    setText('od-label', p.odActive > 0 ? 'OVERDRIVE' : (p.od >= 100 ? 'OVERDRIVE READY — C' : 'OVERDRIVE'));

    setText('level-name', `${world.level.id}. ${world.level.name}`);
    if (el['level-fill']) {
        const bossCue = world.level.cues.find((c) => c.kind === 'boss');
        const span = bossCue ? bossCue.t : 200;
        const pct = world.boss ? 100 : Math.min(100, (world.t / span) * 100);
        el['level-fill'].style.width = `${pct.toFixed(1)}%`;
    }

    updateBossBar(world);
}

function updateBossBar(world) {
    const bar = el['boss-bar'];
    if (!bar) return;
    const b = world.boss;
    if (!b || !b.alive) {
        bar.classList.add('hidden');
        last['boss-name'] = null;
        return;
    }
    bar.classList.remove('hidden');
    setText('boss-name', b.def.name);
    setText('boss-title', b.phase?.name ?? b.def.title);
    if (el['boss-fill']) el['boss-fill'].style.width = `${Math.max(0, (b.hp / b.maxHp) * 100).toFixed(1)}%`;

    if (el['boss-parts']) {
        const key = b.parts.map((p) => (p.alive ? '1' : '0')).join('');
        if (el['boss-parts'].dataset.key !== key) {
            el['boss-parts'].dataset.key = key;
            el['boss-parts'].innerHTML = '';
            for (const part of b.parts) {
                const pip = document.createElement('span');
                pip.className = 'part-pip' + (part.alive ? '' : ' dead');
                pip.title = part.name;
                el['boss-parts'].appendChild(pip);
            }
        }
    }

    // phase ticks along the bar so the player can see how far in they are
    const phases = b.def.phases.length;
    if (bar.dataset.phases !== String(phases)) {
        bar.dataset.phases = String(phases);
        const ticks = bar.querySelector('.boss-ticks');
        if (ticks) {
            ticks.innerHTML = '';
            for (let i = 1; i < phases; i++) {
                const tick = document.createElement('span');
                tick.style.left = `${b.def.phases[i].hpFrom * 100}%`;
                ticks.appendChild(tick);
            }
        }
    }
}

export function formatScore(n) {
    return String(Math.floor(n)).padStart(9, '0');
}

export function showHud(show) {
    el.hud?.classList.toggle('hidden', !show);
}

export function flashHud(cls) {
    if (!el.hud) return;
    el.hud.classList.add(cls);
    setTimeout(() => el.hud.classList.remove(cls), 360);
}
