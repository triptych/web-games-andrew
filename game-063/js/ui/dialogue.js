// Story dialogue: typewriter text with a voice blip per character, a rendered portrait of the speaker,
// click/tap/Space/Enter to advance (first press finishes the line), Skip to jump to the end.

import { SCENES, SPEAKERS } from '../sim/story.js';
import { audio } from '../audio.js';

const $ = (id) => document.getElementById(id);

export class Dialogue {
    constructor(portraits) {
        this.portraits = portraits;
        this.el = $('dialogue');
        this.active = false;
        this.el.addEventListener('click', (e) => { if (e.target.closest('[data-act="dlg-skip"]')) return; this.advance(); });
    }

    play(sceneId, profile, { onLine, onDone, inline = false } = {}) {
        const sc = SCENES[sceneId];
        if (!sc) { onDone?.(); return; }
        this.scene = sc; this.profile = profile; this.i = -1; this.onLine = onLine; this.onDone = onDone;
        this.active = true;
        this.el.classList.remove('hidden');
        $('dlg-title').textContent = inline ? '' : sc.title;
        this.next();
    }

    sub(t) { return t.replaceAll('{name}', this.profile.name || 'Pip'); }

    next() {
        this.i++;
        const L = this.scene.lines[this.i];
        if (!L) { this.close(); return; }
        const [who, mood, text] = L;
        this.who = who;
        this.full = this.sub(text);
        this.shown = 0;
        this.acc = 0;
        $('dlg-name').textContent = this.sub(SPEAKERS[who]?.name ?? who);
        $('dlg-text').textContent = '';
        const url = this.portraits.get(who, mood === 'smug' ? 'smug' : mood ?? 'normal', this.profile);
        const img = $('dlg-portrait');
        if (url) { img.src = url; img.style.visibility = 'visible'; } else img.style.visibility = 'hidden';
        this.onLine?.(who, mood);
    }

    advance() {
        if (!this.active) return;
        if (this.shown < this.full.length) { this.shown = this.full.length; $('dlg-text').textContent = this.full; return; }
        audio.sfxPlay('click');
        this.next();
    }

    skip() { if (this.active) this.close(); }

    close() {
        this.active = false;
        this.el.classList.add('hidden');
        const f = this.onDone;
        this.onDone = null;
        f?.();
    }

    update(dt) {
        if (!this.active || this.shown >= this.full.length) return;
        this.acc += dt * 46;
        const n = Math.min(this.full.length, Math.floor(this.acc));
        if (n > this.shown) {
            const ch = this.full[n - 1];
            if (/[A-Za-z]/.test(ch) && n % 2 === 0) audio.sfxPlay('blip', { pitch: SPEAKERS[this.who]?.voice ?? 1, gap: 0.03 });
            this.shown = n;
            $('dlg-text').textContent = this.full.slice(0, n);
        }
    }
}
