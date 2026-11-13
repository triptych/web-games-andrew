// Lanternhall's visual novel layer: the painted stage (backdrop, CG, portraits) and the dialogue box. It renders
// G.scene, which the sim's scene runner keeps up to date, types each line out, plays its recorded voice, and
// asks main.js to advance. It never interprets a script itself.

import { ART, CG_FILES, img } from './assets.js';
import { CAST } from './sim/data/cast.js';
import { voiceKey, VOICED } from './voices.js';

const $ = (id) => document.getElementById(id);

export class VN {
    constructor({ audio, settings, fast = 1 }) {
        this.audio = audio;
        this.settings = settings;
        this.fast = fast;
        this.bgA = $('bg').querySelector('.pic.a');
        this.bgB = $('bg').querySelector('.pic.b');
        this.bgFront = this.bgA;
        this.bgSrc = null;
        this.cgSrc = null;
        this.actors = new Map();         // id -> element
        this.lineKey = null;
        this.full = '';
        this.shown = 0;
        this.typing = false;
        this.auto = false;
        this.wait = 0;
        this.log = [];
        this.onAdvance = null;           // set by main: advance the scene
        this.onChoose = null;
        this.onSkip = null;
        this.who = { name: 'Robin', gender: 'n', partner: '' };
        $('dlg').querySelector('.box').addEventListener('click', (e) => {
            if (e.target.closest('.choices')) return;
            this.tap();
        });
        // a tap on the painted stage itself (not on a panel) also moves the story on
        for (const id of ['actors', 'cg']) $(id).addEventListener('click', () => this.tap());
        $('dlg-choices').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-i]');
            if (b && this.onChoose) { this.audio.ui('click'); this.onChoose(+b.dataset.i); }
        });
    }

    /** Put the player's name, pronouns and beloved into a line. */
    fill(text) {
        const w = this.who, g = w.gender;
        const P = { they: { f: 'she', m: 'he', n: 'they' }, them: { f: 'her', m: 'him', n: 'them' }, their: { f: 'her', m: 'his', n: 'their' },
            lass: { f: 'lass', m: 'lad', n: 'young one' }, miss: { f: 'Miss', m: 'Master', n: 'Clerk' } };
        return text.replace(/\{(\w+)\}/g, (m, k) => (k === 'name' ? w.name : k === 'partner' ? w.partner : P[k] ? P[k][g] : m));
    }

    speaker(who) {
        if (who === 'n') return '';
        if (who === 'you') return this.who.name;
        return CAST[who]?.name || who;
    }

    // ------------------------------------------------------------ backdrop
    /** Show a backdrop (a bg id, a full url, or null for none). Cross-fades between two layers. */
    setBg(src) {
        if (src && !src.includes('/')) src = ART.bg(src);
        if (src === this.bgSrc) return;
        this.bgSrc = src;
        const back = this.bgFront === this.bgA ? this.bgB : this.bgA;
        if (!src) { this.bgA.classList.remove('on'); this.bgB.classList.remove('on'); return; }
        const im = img(src);
        const show = () => {
            if (this.bgSrc !== src) return;
            back.style.backgroundImage = `url("${src}")`;
            back.classList.add('on');
            this.bgFront.classList.remove('on');
            this.bgFront = back;
        };
        if (im.complete) show(); else { im.addEventListener('load', show, { once: true }); im.addEventListener('error', show, { once: true }); }
    }
    dim(on) { $('bg').classList.toggle('dim', !!on); }

    setCg(id) {
        const src = id && CG_FILES.has(id) ? ART.cg(id) : null;
        if (src === this.cgSrc) return;
        this.cgSrc = src;
        const el = $('cg');
        if (src) { el.querySelector('.pic').style.backgroundImage = `url("${src}")`; el.classList.add('on'); }
        else el.classList.remove('on');
    }

    setActors(list, speaking) {
        const host = $('actors');
        const want = new Set(list.map((a) => a.id));
        for (const [id, el] of this.actors) if (!want.has(id)) { el.remove(); this.actors.delete(id); }
        for (const a of list) {
            if (!CAST[a.id]) continue;
            let el = this.actors.get(a.id);
            if (!el) {
                el = document.createElement('div');
                el.className = 'actor enter';
                el.innerHTML = '<img alt="">';
                host.appendChild(el);
                this.actors.set(a.id, el);
                requestAnimationFrame(() => el.classList.remove('enter'));
            }
            const src = ART.por(a.id, a.expr);
            const im = el.querySelector('img');
            if (im.getAttribute('src') !== src) { im.setAttribute('src', src); im.alt = CAST[a.id].name; }
            el.className = `actor p-${a.pos}` + (a.id === speaking ? ' speaking' : '') + (CAST[a.id].look?.kind === 'brownie' ? ' small' : CAST[a.id].look?.extra?.includes('small') ? ' short' : '');
        }
    }

    clearStage() {
        this.setActors([], null);
        this.setCg(null);
        this.lineKey = null;
    }

    // ------------------------------------------------------------ the scene
    /** Render the scene of any G (the live game or an album replay). */
    render(G) {
        const S = G.scene;
        const dlg = $('dlg');
        if (!S) { dlg.hidden = true; this.lineKey = null; return; }
        dlg.hidden = false;
        const st = S.stage;
        if (st.bg) this.setBg(st.bg);
        this.dim(false);
        this.setCg(st.cg);
        const cur = S.cur;
        this.setActors(st.actors, cur?.who);
        const nameEl = $('dlg-name'), textEl = $('dlg-text'), choices = $('dlg-choices');
        if (!cur) return;
        const key = `${S.id}|${S.pc}|${cur.choice ? 'c' : cur.text}`;
        if (key === this.lineKey) return;
        this.lineKey = key;
        if (cur.choice) {
            this.typing = false;
            choices.innerHTML = cur.choice.map((o, n) => `<button class="btn" data-i="${o.i}"><span class="k">${n + 1}</span> ${esc(this.fill(o.t))}</button>`).join('');
            $('dlg-more').hidden = true;
            // the line that led to the choice stays on screen above it
            this.complete();
            $('dlg-more').hidden = true;
            return;
        }
        choices.innerHTML = '';
        textEl.hidden = false;
        nameEl.textContent = this.speaker(cur.who);
        textEl.classList.toggle('narr', cur.who === 'n');
        this.full = this.fill(cur.text);
        this.shown = 0;
        this.typing = true;
        this.wait = 0;
        textEl.textContent = '';
        $('dlg-more').hidden = true;
        this.log.push({ who: this.speaker(cur.who), text: this.full, narr: cur.who === 'n' });
        if (this.log.length > 120) this.log.shift();
        // the recorded line, if there is one
        const vk = voiceKey(cur.who, cur.text);
        if (VOICED.has(vk)) this.audio.say(vk); else this.audio.stopVoice();
        if (this.skipping) this.complete();
    }

    complete() {
        this.typing = false;
        this.shown = this.full.length;
        $('dlg-text').textContent = this.full;
        $('dlg-more').hidden = false;
    }

    /** Click or Enter on the box: finish the line, or go on to the next one. */
    tap() {
        if ($('dlg').hidden) return;
        if (this.typing) { this.complete(); return; }
        if ($('dlg-choices').children.length) return;
        this.audio.ui('page');
        if (this.onAdvance) this.onAdvance();
    }

    choose(n) {
        const b = $('dlg-choices').children[n];
        if (b) b.click();
    }

    tick(dt) {
        if ($('dlg').hidden) return;
        const sp = +this.settings.speed || 1;
        if (this.typing) {
            this.shown += dt * 42 * sp * this.fast;
            if (sp >= 50 || this.shown >= this.full.length) this.complete();
            else $('dlg-text').textContent = this.full.slice(0, Math.floor(this.shown));
            return;
        }
        if (this.auto && !$('dlg-choices').children.length) {
            if (this.audio.speaking) { this.wait = 0; return; }
            this.wait += dt * this.fast;
            const need = 0.9 + Math.min(4, this.full.length / 45);
            if (this.wait >= need) { this.wait = 0; if (this.onAdvance) this.onAdvance(); }
        }
    }
}

export function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
