/**
 * dialogue.js (ui) — the conversation overlay: the speaker's name and line over the scene, and a
 * short list of things to say. Works with keys, a pad, or a tap. Nodes come from sim/dialogue.js.
 */
import { h, Panel } from './ui.js';
import { greeting, optionsFor, arrestNode } from '../sim/dialogue.js';

export class DialoguePanel extends Panel {
    /** actor: who you're talking to; or arrest: { guard, town } for a guard stopping you */
    constructor(ui, actor, arrest = null) {
        super(ui, '', 'talk');
        this.a = actor; this.arrest = arrest;
        this.box.className = 'dlg';
        this.closeOnBackdrop = false;
        this.modal = !!arrest;
        this.who = h('div.who');
        this.line = h('div.line');
        this.opts = h('div.opts.scroll');
        this.box.append(this.who, this.line, this.opts);
        this.sel = 0;
        this.pending = null;   // a reply that ends the conversation: { after, fade }
        const w = ui.app.world;
        if (arrest) { const n = arrestNode(w, arrest.guard, arrest.town); this.who.textContent = n.who; this.say(n.line); this.options = n.options; this.renderOpts(); }
        else { this.who.textContent = actor.name; this.say(greeting(w, actor)); this.rebuild(); }
    }
    say(text) { this.line.textContent = text; this.ui.app.hud?.speak?.(this.a || this.arrest?.guard, text); }
    rebuild() {
        if (this.arrest) return;
        this.options = optionsFor(this.ui.app.world, this.a);
        this.renderOpts();
    }
    renderOpts() {
        this.opts.innerHTML = '';
        const list = this.pending ? [{ text: '(Continue)', run: () => ({ close: true }) }] : this.options;
        this.shown = list;
        this.sel = Math.min(this.sel, list.length - 1);
        list.forEach((o, i) => {
            const e = h('button.opt', { cls: `${o.cls || ''} ${o.disabled ? 'done' : ''} ${i === this.sel ? 'sel' : ''}`, text: o.text, on: { click: () => { this.sel = i; this.choose(); }, mouseenter: () => this.select(i) } });
            this.opts.appendChild(e);
        });
    }
    select(i) {
        this.sel = (i + this.shown.length) % this.shown.length;
        [...this.opts.children].forEach((c, k) => c.classList.toggle('sel', k === this.sel));
        this.opts.children[this.sel]?.scrollIntoView({ block: 'nearest' });
    }
    choose() {
        const o = this.shown[this.sel];
        if (!o || o.disabled) { this.ui.app.audio?.ui('deny'); return; }
        this.ui.app.audio?.ui('select');
        if (this.pending) { const p = this.pending; this.pending = null; this.finish(p); return; }
        const r = o.run() || {};
        if (r.panel) { const [name, ...args] = r.panel; this.ui.pop(); this.ui.show(name, ...args); return; }
        if (r.reply) this.say(r.reply);
        if (r.close) {
            if (r.reply) { this.pending = { after: r.after, fade: r.fade }; this.sel = 0; this.renderOpts(); return; }
            this.finish(r);
            return;
        }
        this.sel = 0;
        this.rebuild();
    }
    finish(r) {
        this.ui.pop();
        if (r.after) { if (r.fade) this.ui.app.fade(() => r.after()); else r.after(); }
    }
    action(a) {
        if (a === 'up') { this.select(this.sel - 1); return true; }
        if (a === 'down') { this.select(this.sel + 1); return true; }
        if (a === 'ok') { this.choose(); return true; }
        if (a === 'back') { if (this.modal) return true; if (this.pending) { const p = this.pending; this.pending = null; this.finish(p); return true; } this.ui.pop(); return true; }
        return true;
    }
}
