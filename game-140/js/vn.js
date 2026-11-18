// The dialogue box. It renders G.scene.cur (the sim's scene runner keeps it up to date), types each line out,
// plays its recorded voice, keeps the history log, and asks main.js to advance. It never interprets a script.
// The painted stage behind it is js/view/stage.js. Adapted from game-127's VN layer.

import { CAST } from './sim/data/cast.js';
import { HUES } from './sim/data/chapters.js';
import { TYPE_CPS } from './config.js';
import { voiceKey, voiceable } from './voicekey.js';

const $ = (id) => document.getElementById(id);

export function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export class VN {
    constructor({ audio, settings, fast = 1 }) {
        this.audio = audio;
        this.settings = settings;
        this.fast = fast;
        this.lineKey = null;
        this.full = '';
        this.shown = 0;
        this.typing = false;
        this.auto = false;
        this.skipping = false;
        this.wait = 0;
        this.log = [];
        this.name = 'Wren';
        this.hues = [0, 0, 0, 0, 0, 0, 0];
        this.onAdvance = null;           // set by main
        this.onChoose = null;
        $('dlg').querySelector('.box').addEventListener('click', (e) => {
            if (e.target.closest('.choices')) return;
            this.tap();
        });
        $('dlg-choices').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-i]');
            if (b && this.onChoose) { this.audio.ui('click'); this.onChoose(+b.dataset.i); }
        });
    }

    get open() { return !$('dlg').hidden; }

    fill(text) { return text.replace(/\{name\}/g, this.name); }

    speaker(who) {
        if (who === 'n') return '';
        if (who === 'you') return this.name;
        return CAST[who]?.name || who;
    }

    /** A name plate is grey until the speaker's colour has come back into the world. */
    plateColour(who) {
        if (who === 'you') return this.hues[2] ? HUES[2].css : '#d9dbe4';
        const c = CAST[who];
        if (!c) return '#d9dbe4';
        return this.hues[c.hue] ? c.color : '#c9ccd6';
    }

    hide() {
        $('dlg').hidden = true;
        this.lineKey = null;
        this.typing = false;
        this.skipping = false;
    }

    /** Show the current line or choice of G's scene. */
    render(G) {
        const S = G.scene;
        const dlg = $('dlg');
        this.hues = G.hues;
        if (!S || !S.cur) { this.hide(); return; }
        dlg.hidden = false;
        const cur = S.cur;
        const nameEl = $('dlg-name'), textEl = $('dlg-text'), choices = $('dlg-choices');
        const key = `${S.id}|${S.pc}|${cur.choice ? 'c' : cur.text}`;
        if (key === this.lineKey) return;
        this.lineKey = key;
        if (cur.choice) {
            this.skipping = false;
            choices.innerHTML = cur.choice.map((o, n) => `<button class="btn choice" data-i="${o.i}"><span class="k">${n + 1}</span> ${esc(this.fill(o.t))}</button>`).join('');
            // the line that led to the choice stays on screen above it
            this.complete();
            $('dlg-more').hidden = true;
            dlg.classList.add('choosing');
            return;
        }
        dlg.classList.remove('choosing');
        choices.innerHTML = '';
        nameEl.textContent = this.speaker(cur.who);
        nameEl.hidden = cur.who === 'n';
        nameEl.style.color = this.plateColour(cur.who);
        textEl.classList.toggle('narr', cur.who === 'n');
        this.full = this.fill(cur.text);
        this.shown = 0;
        this.typing = true;
        this.wait = 0;
        textEl.textContent = '';
        $('dlg-more').hidden = true;
        this.log.push({ who: this.speaker(cur.who), text: this.full, narr: cur.who === 'n' });
        if (this.log.length > 160) this.log.shift();
        const voiced = !this.skipping && voiceable(cur.who, cur.text) && (cur.who !== 'n' || this.settings.narr);
        if (voiced) this.audio.say(voiceKey(cur.who, cur.text)); else this.audio.stopVoice();
        if (this.skipping) this.complete();
    }

    complete() {
        this.typing = false;
        this.shown = this.full.length;
        $('dlg-text').textContent = this.full;
        $('dlg-more').hidden = false;
    }

    /** Click, tap or Enter on the box: finish the line, or go on to the next one. */
    tap() {
        if (!this.open) return;
        this.skipping = false;
        if (this.typing) { this.complete(); return; }
        if ($('dlg-choices').children.length) return;
        this.audio.ui('page');
        if (this.onAdvance) this.onAdvance();
    }

    choose(n) {
        const b = $('dlg-choices').children[n];
        if (b) b.click();
    }

    get choosing() { return $('dlg-choices').children.length > 0; }

    tick(dt) {
        if (!this.open) return;
        if (this.skipping) {
            if (this.choosing) { this.skipping = false; return; }
            this.complete();
            this.wait += dt;
            if (this.wait > 0.05 / this.fast) { this.wait = 0; if (this.onAdvance) this.onAdvance(); }
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
            const need = (0.9 + Math.min(4, this.full.length / 45)) * (+this.settings.auto || 1);
            if (this.wait >= need) { this.wait = 0; if (this.onAdvance) this.onAdvance(); }
        }
    }
}
