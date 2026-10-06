// The overworld HUD: area banner, objective line, toasts and the "!" over trainers who spot you.

import { $, esc } from './dom.js';

export class HUD {
    constructor(app) {
        this.app = app;
        this.marks = new Map();
    }
    show(on) { $('hud').classList.toggle('hidden', !on); }
    banner(title, sub = '', secs = 2.6) {
        const b = $('banner');
        b.innerHTML = `<div class="b1">${esc(title)}</div>${sub ? `<div class="b2">${esc(sub)}</div>` : ''}`;
        b.classList.remove('hidden', 'out');
        void b.offsetWidth;
        b.classList.add('in');
        clearTimeout(this.bt);
        this.bt = setTimeout(() => { b.classList.add('out'); setTimeout(() => b.classList.add('hidden'), 600); }, secs * 1000);
    }
    objective(text) { $('objective').innerHTML = text ? `<span class="oi">⚙</span> ${esc(text)}` : ''; $('objective').classList.toggle('hidden', !text); }
    toast(text, kind = '') {
        const t = document.createElement('div');
        t.className = `toast ${kind}`;
        t.textContent = text;
        $('toasts').appendChild(t);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
        setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 3200);
    }
    mark(key) { this.marks.set(key, 1.2); }
    update(dt) {
        const layer = $('marks');
        const w = this.app.game && this.app.game.world;
        let html = '';
        for (const [k, t] of this.marks) {
            const nt = t - dt;
            if (nt <= 0) { this.marks.delete(k); continue; }
            this.marks.set(k, nt);
            const e = w && w.ents.find((x) => x.key === k);
            if (!e) continue;
            const p = this.app.view.project(e.px, e.py, 2.2);
            html += `<div class="mark" style="left:${p.x}px;top:${p.y}px">!</div>`;
        }
        layer.innerHTML = html;
    }
}
