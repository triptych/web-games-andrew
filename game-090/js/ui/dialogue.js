// The visual-novel layer: bust portraits of everyone in the scene along the bottom, the speaker
// lit, a typewriter text box, and choices. A tap finishes the line, then advances.

import { h, $, clear, portraitImg } from './dom.js';
import { CHARS, COND_HINT } from '../sim/data/story.js';
import { sceneNode, sceneDef, choicesOf } from '../sim/game.js';

export class Dialogue {
    constructor(ui) {
        this.ui = ui;
        this.key = '';
        this.typing = null;
        this.cast = new Map();
        this.castKey = '';
        const box = $('vn').querySelector('.vn-box');
        box.addEventListener('click', (e) => { if (e.target.closest('.vn-choices')) return; this.tap(); });
        $('vn-skip').addEventListener('click', () => this.skip());
    }

    get open() { return !$('vn').hidden; }

    hide() { $('vn').hidden = true; this.key = ''; this.node = null; this.typing = null; }

    name(id, G) { const c = CHARS[id]; if (!c) return ''; return c.name.replace('{name}', G.name); }
    fill(t, G) { return t.replace(/\{name\}/g, G.name); }

    person(id, mood) {
        const v = this.ui.view;
        return portraitImg(`vn:${id}:${mood}:${this.ui.G?.look || 0}`, () => v.portraits.person(id, mood, this.ui.G?.look || 0), 'bust');
    }

    /** Show the node the scene is on. Safe to call every frame; it only rebuilds on change. */
    show(G) {
        const sc = G.scene, node = sceneNode(G);
        if (!sc || !node) return;
        // a choice answered by a one-line reply keeps the same index and length, so compare the node itself
        const key = `${sc.id}:${sc.i}:${sc.nodes.length}`;
        if (key === this.key && node === this.node) return;
        this.key = key;
        this.node = node;
        $('vn').hidden = false;
        // the cast along the bottom
        const def = sceneDef(G);
        const cast = (def.cast || []).filter((c) => CHARS[c]?.look);
        const ck = sc.id + cast.join();
        if (ck !== this.castKey) {
            this.castKey = ck;
            const wrap = clear($('vn-cast'));
            this.cast.clear();
            for (const c of cast) { const po = h('div.po', h('div')); wrap.append(po); this.cast.set(c, po); }
        }
        const choices = $('vn-choices');
        clear(choices);
        $('vn-cast').classList.toggle('all', !!node.ch);
        if (node.ch) {
            this.setLine(null, '', false);
            $('vn-name').textContent = '';
            $('vn-next').hidden = true;
            for (const c of choicesOf(G)) {
                const b = h('button.btn' + (c.locked ? '.locked' : ''), { text: this.fill(c.t, G), onclick: () => { if (c.locked) { this.ui.toast(COND_HINT[c.need] || 'Locked.'); this.ui.audio.ui('error'); return; } this.ui.audio.ui('click'); this.ui.doAct({ type: 'choose', i: c.i }); } });
                if (c.locked) b.append(h('small', { text: COND_HINT[c.need] || 'Locked' }));
                choices.append(b);
            }
            choices.querySelector('button')?.focus({ preventScroll: true });
            return;
        }
        $('vn-next').hidden = false;
        const [who, text, mood] = node;
        const narr = who === '_';
        $('vn-name').textContent = narr ? '' : this.name(who, G);
        for (const [id, po] of this.cast) {
            const on = id === who;
            po.classList.toggle('on', on || (who === 'agent' || narr ? false : false));
            if (on || !po.firstChild.src) { clear(po).append(this.person(id, on ? (mood || 'neutral') : 'neutral')); }
        }
        // someone speaking who is not in the cast gets a portrait of their own at the end
        if (!narr && who !== 'agent' && !this.cast.has(who) && CHARS[who]?.look) {
            const po = h('div.po.on', this.person(who, mood || 'neutral'));
            $('vn-cast').append(po); this.cast.set(who, po);
        }
        this.ui.view.hub.speaker = who;
        this.setLine(this.fill(text, G), narr ? 'narr' : '', true);
    }

    setLine(text, cls, type) {
        const el = $('vn-text');
        el.className = 'vn-text ' + (cls || '');
        if (this.typing) { clearInterval(this.typing.timer); this.typing = null; }
        if (text == null) { el.textContent = ''; return; }
        if (!type || this.ui.settings.calm) { el.textContent = text; return; }
        el.textContent = '';
        let i = 0;
        const timer = setInterval(() => {
            i = Math.min(text.length, i + 2);
            el.textContent = text.slice(0, i);
            if (i % 6 === 0) this.ui.audio.ui('text');
            if (i >= text.length) { clearInterval(timer); this.typing = null; }
        }, 24);
        this.typing = { timer, text };
    }

    finish() {
        if (!this.typing) return false;
        clearInterval(this.typing.timer);
        $('vn-text').textContent = this.typing.text;
        this.typing = null;
        return true;
    }

    tap() {
        if (this.finish()) return;
        const G = this.ui.G;
        if (!G.scene || sceneNode(G)?.ch) return;
        this.ui.audio.ui('click');
        this.ui.doAct({ type: 'next' });
    }

    /** Fast-forward to the next choice or the end of the scene. */
    skip() {
        const G = this.ui.G;
        this.finish();
        let n = 0;
        while (G.phase === 'scene' && G.scene && !sceneNode(G)?.ch && n++ < 200) {
            const err = this.ui.doAct({ type: 'next' });
            if (err) break;
        }
    }
}
