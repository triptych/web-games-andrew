/**
 * app.js — the screen router. A screen is a module exporting
 *   { id, tab?, stage?, chrome? ('full'|'none'), enter(root, params), exit?(), update?(dt), refresh?(what) }
 * `stage` names a 3D stage (created lazily by stages.js) shown behind it.
 */

import { $, closeAllModals } from './dom.js';
import { setStage } from '../view/engine.js';
import { getStage3D } from './stages.js';
import { on } from '../core/bus.js';
import { updateHud, setTab, showChrome } from './hud.js';
import { sfx, playMusic } from '../audio.js';

const registry = new Map();
const history = [];
let current = null;
let currentParams = null;

export function register(screen) { registry.set(screen.id, screen); }

export function currentScreen() { return current; }

let navSeq = 0;
export async function go(id, params = {}, opts = {}) {
    const next = registry.get(id);
    if (!next) throw new Error('no screen ' + id);
    const my = ++navSeq; // the latest navigation wins if two overlap (double taps, fades)
    if (current && !opts.replace && !opts.noHistory) history.push({ id: current.id, params: currentParams });
    if (opts.fade) await fade(true);
    if (my !== navSeq) return;
    if (current && current.exit) current.exit();
    closeAllModals();
    const root = $('#screen');
    root.innerHTML = '';
    root.className = '';
    current = null; // nothing ticks while the next stage loads
    currentParams = params;
    if (next.stage) {
        const st = await getStage3D(next.stage);
        if (my !== navSeq) return;
        setStage(st);
    }
    current = next;
    showChrome(next.chrome || 'normal');
    if (next.tab) setTab(next.tab);
    // a default score per stage; screens (battle) may pick their own in enter()
    const score = { summon: 'summon', spire: 'summon', battle: null }[next.stage];
    if (score !== null && next.id !== 'title') playMusic(score || 'citadel');
    next.enter(root, params);
    updateHud();
    if (opts.fade || $('#fade').classList.contains('on')) await fade(false);
}

export function back(fallback = 'citadel') {
    const prev = history.pop();
    if (prev && registry.has(prev.id)) return go(prev.id, prev.params, { noHistory: true });
    return go(fallback, {}, { noHistory: true });
}

/** Jump to a tab root (clears history). */
export function goTab(tab) {
    history.length = 0;
    sfx('tab');
    return go(tab, {}, { noHistory: true });
}

export function fade(on) {
    const f = $('#fade');
    f.classList.toggle('on', on);
    return new Promise((r) => setTimeout(r, on ? 320 : 30));
}

export function updateScreen(dt, t) { if (current && current.update) current.update(dt, t); }

on('change', (what) => {
    updateHud();
    if (current && current.refresh) current.refresh(what);
});
on('tick', () => {
    updateHud();
    if (current && current.tick) current.tick();
});
