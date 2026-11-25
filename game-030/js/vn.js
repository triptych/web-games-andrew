// The dialogue box. It shows the sim's current line (currentLine(G)): the speaker's portrait in the right mood,
// a name plate in their colour, the line typed out while its recorded voice plays, choices as buttons, and a
// chapter card when a node has one. It keeps the history log and asks main.js to advance; it never reads a tree.

import { CAST } from './sim/data/cast.js';
import { porUrl } from './view/assets.js';
import { TYPE_CPS } from './config.js';

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class VN {
    constructor({ audio, settings }) {
        this.audio = audio;
        this.settings = settings;
        this.key = null;
        this.full = ''; this.shown = 0; this.typing = false;
        this.auto = false; this.skipping = false; this.wait = 0;
        this.log = [];
        this.who = null;
        this.card = 0;
        this.fast = 1;
        this.onAdvance = null; this.onChoose = null;
        $('dlg').querySelector('.box').addEventListener('click', (e) => { if (!e.target.closest('.choices')) this.tap(); });
        $('dlg-choices').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-i]');
            if (b && this.onChoose) { this.audio.ui('click'); this.onChoose(+b.dataset.i); }
        });
        $('btn-auto').addEventListener('click', () => this.setAuto(!this.auto));
        $('btn-skip').addEventListener('click', () => this.setSkip(!this.skipping));
    }

    get open() { return !$('vn').hidden; }
    get choosing() { return $('dlg-choices').children.length > 0; }

    setAuto(on) { this.auto = on; $('btn-auto').classList.toggle('on', on); }
    setSkip(on) { this.skipping = on; $('btn-skip').classList.toggle('on', on); if (on && this.typing) this.complete(); }

    hide() {
        $('vn').hidden = true;
        $('vn-por').hidden = true;   // the narrator keeps a speaker on screen within a scene, never into the next one
        $('card').hidden = true; this.card = 0;
        this.key = null; this.typing = false; this.who = null;
        this.setSkip(false);
        this.audio.stopVoice();
    }

    name(who) { return who === 'n' ? '' : CAST[who]?.name || who; }

    /** Show the line (or choice) the sim is resting on. */
    render(line) {
        if (!line) { this.hide(); return; }
        $('vn').hidden = false;
        const key = `${line.tree}|${line.node}`;
        if (key === this.key) return;
        this.key = key;
        // the portrait
        const por = $('vn-por');
        const src = line.who && line.who !== 'n' ? porUrl(line.who, line.mood) : null;
        if (src) {
            if (!por.src.endsWith(src)) { por.src = src; if (this.who !== line.who) { por.classList.remove('enter'); void por.offsetWidth; por.classList.add('enter'); } }
            por.hidden = false;
        } else if (line.who === 'n' && !line.cg) { /* the narrator keeps whoever was on screen */ }
        else por.hidden = true;
        if (line.cg) por.hidden = true;
        this.who = line.who;
        // the chapter card
        if (line.card) { $('card-text').textContent = line.card; $('card').hidden = false; this.card = 2.6; }
        const nameEl = $('dlg-name'), textEl = $('dlg-text'), ch = $('dlg-choices');
        nameEl.textContent = this.name(line.who);
        nameEl.style.color = CAST[line.who]?.color || '';
        textEl.classList.toggle('narr', line.who === 'n');
        this.full = line.text;
        this.log.push({ who: this.name(line.who), text: line.text, narr: line.who === 'n' });
        if (this.log.length > 200) this.log.shift();
        if (line.choices) {
            this.complete();
            ch.innerHTML = line.choices.map((c, n) => `<button class="btn choice" data-i="${c.i}"><span class="k">${n + 1}</span> ${esc(c.t)}</button>`).join('');
            this.setSkip(false);
            $('dlg-more').hidden = true;
        } else {
            ch.innerHTML = '';
            this.shown = 0; this.typing = true; this.wait = 0;
            textEl.textContent = '';
            $('dlg-more').hidden = true;
            if (this.skipping) this.complete();
        }
        const voiced = !this.skipping && (line.who !== 'n' || this.settings.narr);
        if (voiced) this.audio.say(line.who, line.text); else this.audio.stopVoice();
    }

    complete() {
        this.typing = false;
        this.shown = this.full.length;
        $('dlg-text').textContent = this.full;
        $('dlg-more').hidden = this.choosing;
    }

    /** Click, tap or Space: finish the line, or go on. */
    tap() {
        if (!this.open) return;
        if (this.card > 0.6) { this.card = 0.6; return; }
        if (this.typing) { this.complete(); return; }
        if (this.choosing) return;
        this.audio.ui('page');
        this.onAdvance?.();
    }

    choose(n) { const b = $('dlg-choices').children[n]; if (b) b.click(); }

    tick(dt) {
        if (!this.open) return;
        if (this.card > 0) { this.card -= dt; if (this.card <= 0) $('card').hidden = true; }
        if (this.skipping) {
            if (this.choosing) { this.setSkip(false); return; }
            this.complete();
            this.wait += dt;
            if (this.wait > 0.08 / this.fast) { this.wait = 0; this.onAdvance?.(); }
            return;
        }
        const sp = +this.settings.speed || 1;
        if (this.typing) {
            this.shown += dt * TYPE_CPS * sp * this.fast;
            if (sp >= 50 || this.shown >= this.full.length) this.complete();
            else $('dlg-text').textContent = this.full.slice(0, Math.floor(this.shown));
            return;
        }
        if (this.auto && !this.choosing) {
            if (this.audio.speaking) { this.wait = 0; return; }
            this.wait += dt * this.fast;
            if (this.wait >= 0.8 + Math.min(3, this.full.length / 50)) { this.wait = 0; this.onAdvance?.(); }
        }
    }

    showLog() {
        $('log-body').innerHTML = this.log.map((l) => `<p class="logline ${l.narr ? 'narr' : ''}">${l.who ? `<b>${esc(l.who)}</b>` : ''}${esc(l.text)}</p>`).join('') || '<p class="note">Nothing yet.</p>';
        $('logsheet').hidden = false;
        const b = $('log-body'); b.scrollTop = b.scrollHeight;
    }
}
