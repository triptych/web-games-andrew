// The dialogue box: a brass-framed plate with a rendered portrait, a name tag, typewriter text and
// Yes/No choices. A (or a tap) finishes the line, then advances.

import { $, esc, personImg, botImg, focusFirst } from './dom.js';
import { LOOKS } from '../sim/data/story.js';
import { BY_NAME } from '../sim/dex.js';
import { ITEMS } from '../sim/data/items.js';

const SPEAKER_LOOK = {
    'Ma Bellows': 'ma', Vex: 'vex', 'Vex Coppervane': 'vex', 'Rival Vex': 'vex', 'Champion Vex Coppervane': 'vex',
    'Forgemaster Cassia Gearwright': 'cassia', 'Forgemaster Smokestack Sal': 'sal', 'Forgemaster Volta Ferris': 'volta', 'Forgemaster Bramwell Thorne': 'bramwell',
    'Forgemaster Captain Ondine Brack': 'ondine', 'Forgemaster Dr. Lysander Mire': 'mire', 'Forgemaster Ivarra Frostwhistle': 'ivarra', 'Forgemaster Admiral Hexa Vane': 'vane',
    'Furnace Four Rook Ironside': 'rook', 'Furnace Four Seraphine Static': 'seraphine', 'Furnace Four Morrow Hollowell': 'morrow', 'Furnace Four Ashka Nyx': 'ashka',
    'Syndicate Sgt. Slag': 'slag', 'Sgt. Slag': 'slag', 'Madame Verdigris': 'verdigris', 'Syndicate Executive Madame Verdigris': 'verdigris', 'Baron Oxide': 'oxide', 'Syndicate Boss Baron Oxide': 'oxide',
    'Syndicate Grunt': 'grunt', 'Boilerkeeper': 'keeper', 'Exchange Clerk': 'clerk', 'Foundry Guide': 'guide', 'Engineer Pell': 'engineer',
};

export class Dialog {
    constructor(app) {
        this.app = app;
        this.box = $('dialog');
        this.full = '';
        this.shown = 0;
        this.typing = false;
        this.onDone = null;
        this.speed = 55;
        this.box.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; e.preventDefault(); this.press(); });
    }
    get open() { return !this.box.classList.contains('hidden'); }

    /** Show a line. opts: { who, choices: [labels], onChoice(i), onDone(), bot, item } */
    show(text, opts = {}) {
        this.full = String(text);
        this.shown = 0;
        this.typing = true;
        this.opts = opts;
        this.onDone = opts.onDone || null;
        const who = opts.who || '';
        const look = SPEAKER_LOOK[who] || (opts.look ?? null);
        let pic = '';
        if (opts.bot) pic = botImg(opts.bot, false, 'dpic');
        else if (opts.item && ITEMS[opts.item]) pic = `<div class="dpic item">${ITEMS[opts.item].icon}</div>`;
        else if (look) pic = personImg(LOOKS[look] ? look : look, who, 'dpic');
        else if (who) pic = personImg('rand', who, 'dpic');
        this.box.innerHTML = `${pic}<div class="dbody">${who ? `<div class="dname">${esc(who)}</div>` : ''}<div class="dtext" id="dtext"></div><div class="dchoices hidden" id="dchoices"></div><div class="dmore" id="dmore">▼</div></div>`;
        this.box.classList.remove('hidden');
        this.box.classList.toggle('narration', !who);
        this.app.audio.speak && who && this.app.audio.speak(text, who.length % 5 * 0.12 + 0.8);
        this.tick(0);
    }

    tick(dt) {
        if (!this.typing) return;
        const sp = this.app.settings.textSpeed === 'instant' ? 9999 : this.app.settings.textSpeed === 'slow' ? 30 : 70;
        this.shown = Math.min(this.full.length, this.shown + Math.max(1, dt * sp));
        const t = $('dtext');
        if (t) t.textContent = this.full.slice(0, Math.floor(this.shown));
        if (this.shown >= this.full.length) this.finishTyping();
    }
    finishTyping() {
        this.typing = false;
        const t = $('dtext');
        if (t) t.textContent = this.full;
        const ch = this.opts && this.opts.choices;
        if (ch) {
            const c = $('dchoices');
            c.innerHTML = ch.map((l, i) => `<button class="dchoice${i === 0 ? ' default' : ''}" data-i="${i}">${esc(l)}</button>`).join('');
            c.classList.remove('hidden');
            $('dmore').classList.add('hidden');
            c.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.choose(+b.dataset.i); }));
            focusFirst(c);
        }
    }
    choose(i) {
        const f = this.opts.onChoice;
        this.hide();
        this.app.audio.sfx('select');
        if (f) f(i);
    }
    /** A pressed (keyboard, button or tap). */
    press() {
        if (!this.open) return false;
        if (this.typing) { this.finishTyping(); return true; }
        if (this.opts && this.opts.choices) return false;     // choices take their own input
        const f = this.onDone;
        this.hide();
        this.app.audio.sfx('blip');
        if (f) f();
        return true;
    }
    back() {
        if (this.opts && this.opts.choices && !this.typing) { this.choose(this.opts.choices.length - 1); return true; }
        return this.press();
    }
    hide() { this.box.classList.add('hidden'); this.box.innerHTML = ''; this.opts = null; }
}

export function botLook(name) { return BY_NAME[name.toLowerCase()]; }
