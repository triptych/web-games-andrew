/**
 * dialog.js — the story player: a speaker portrait, a typewriter line, tap to go on.
 * playScene(lines, ctx) resolves when the scene ends (or is skipped).
 */

import { $ } from './dom.js';
import { SPEAKERS } from '../sim/story.js';
import { sfx } from '../audio.js';

let state = null;

export function dialogOpen() { return !!state; }

export function playScene(lines, ctx) {
    return new Promise((resolve) => {
        if (!lines || !lines.length) { resolve(); return; }
        state = { lines, i: 0, ctx, resolve, shown: 0, full: '', timer: 0 };
        $('dialog').hidden = false;
        show();
    });
}

function fill(text, ctx) {
    return text.replaceAll('{name}', ctx.name).replaceAll('{cls}', ctx.cls).replaceAll('{boss}', ctx.boss || 'The Foe').replaceAll('{icon}', ctx.icon);
}

function show() {
    const s = state;
    const line = s.lines[s.i];
    const sp = SPEAKERS[line.who] || SPEAKERS.narrator;
    $('dlg-icon').textContent = fill(sp.icon, s.ctx);
    $('dlg-icon').style.visibility = line.who === 'narrator' ? 'hidden' : 'visible';
    $('dlg-name').textContent = fill(sp.name, s.ctx);
    $('dlg-name').style.color = line.who === 'narrator' ? '#8a6a3a' : '';
    s.full = fill(line.text, s.ctx);
    s.shown = 0;
    $('dlg-text').textContent = '';
    $('dlg-text').style.fontStyle = line.who === 'narrator' ? 'italic' : 'normal';
    $('dlg-next').style.visibility = 'hidden';
    clearInterval(s.timer);
    s.timer = setInterval(() => {
        s.shown += 2;
        $('dlg-text').textContent = s.full.slice(0, s.shown);
        if (s.shown % 6 === 0) sfx.type();
        if (s.shown >= s.full.length) { clearInterval(s.timer); $('dlg-next').style.visibility = 'visible'; }
    }, 22);
}

export function advanceDialog() {
    const s = state;
    if (!s) return;
    if (s.shown < s.full.length) {
        s.shown = s.full.length;
        clearInterval(s.timer);
        $('dlg-text').textContent = s.full;
        $('dlg-next').style.visibility = 'visible';
        return;
    }
    s.i++;
    if (s.i >= s.lines.length) endScene();
    else show();
}

export function skipDialog() { if (state) endScene(); }

function endScene() {
    const s = state;
    clearInterval(s.timer);
    state = null;
    $('dialog').hidden = true;
    s.resolve();
}

export function initDialog() {
    $('dialog').addEventListener('click', (e) => { if (e.target.id !== 'dlg-skip') advanceDialog(); });
    $('dlg-skip').addEventListener('click', (e) => { e.stopPropagation(); skipDialog(); });
}
