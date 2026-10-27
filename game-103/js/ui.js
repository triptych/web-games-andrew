// The DOM layer: screens, the HUD (turn order, unit card, commands), dialogue, the chapter sheets and
// settings. Reads the sim; never changes it. Choices go back out through callbacks.

import { CHAPTERS, CLASSES, ENDING, ITEMS, SKILLS, SNACKS, STATUS } from './sim/data.js';
import { learnedAt, levelOf, turnOrder } from './sim/game.js';
import { stat } from './sim/core.js';
import { VERSION } from './config.js';
import { bust } from './view/sprites.js';

const $ = (id) => document.getElementById(id);
const NAMES = { narrator: '', hazel: 'Headmistress Hazel', basil: 'Dread Lord Basil' };
export const speakerName = (who) => (who in NAMES ? NAMES[who] : CLASSES[who]?.name || who);

function drawBust(cv, key, face) {
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(bust(key, cv.width, face), 0, 0);
}

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, onParty, onSnack }) {
        this.audio = audio;
        this.settings = settings;
        this.onParty = onParty;
        this.onSnack = onSnack;
        this.stack = [];                   // open screens, top last
        this.talkState = null;
        this.orderKey = '';
        this.focusKey = null;              // the chip whose blurb the intro sheet shows
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }

        const sfx = $('set-sfx'), music = $('set-music'), quick = $('set-quick'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; quick.checked = !!settings.quick; calm.checked = !!settings.calm;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, quick: quick.checked, calm: calm.checked });
            onSettings(settings);
        };
        for (const el of [sfx, music, quick, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // dialogue: a tap anywhere on the box advances; Skip jumps to the end
        $('talk-box').addEventListener('click', () => this.talkAdvance());
        $('talk-skip').addEventListener('click', () => this.talkSkip());
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // each screen opens above the ones under it, whatever the page order
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i * 2; });
        this._markUnder();
        if (id !== 'talk') this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        $(id).style.zIndex = '';
        this.stack = this.stack.filter((s) => s !== id);
        this._markUnder();
        if (this.top() && this.top() !== 'talk') this.focusFirst(this.top());
    }
    /** A sheet opened over another one must not show it through its own: hide the panels beneath the top screen. */
    _markUnder() {
        this.stack.forEach((s, i) => $(s).classList.toggle('under', i < this.stack.length - 1));
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length > 0); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) {
        $('hud').hidden = !on; $('bottom').hidden = !on;
        if (!on) $('prompt').hidden = true;
        this.bottomH();
    }
    /** Publish the height the bottom bar takes, so the prompt and toasts sit above it and the view leaves room. */
    bottomH() {
        const h = $('bottom').hidden ? 16 : $('bottom').offsetHeight;
        document.documentElement.style.setProperty('--bottom-h', h + 'px');
        return h;
    }
    topH() { return $('hud').hidden ? 56 : 66; }
    setChapterTag(text) { $('chapter-tag').textContent = text; }
    prompt(text) { const el = $('prompt'); el.hidden = !text; if (text) el.textContent = text; }

    /** The turn strip: who acts next, from the sim's own preview of the queue. */
    order(G) {
        const B = G.B;
        if (!B) return;
        const ids = turnOrder(B, 8);
        const key = ids.map((id) => { const u = B.units.find((o) => o.id === id); return `${id}${u.team}`; }).join();
        if (key === this.orderKey) return;
        this.orderKey = key;
        const el = $('order');
        el.textContent = '';
        ids.forEach((id, i) => {
            const u = B.units.find((o) => o.id === id);
            const d = document.createElement('div');
            d.className = 'ochip' + (u.team === 'e' ? ' foe' : '') + (i === 0 ? ' now' : '');
            d.title = CLASSES[u.key].name;
            const cv = document.createElement('canvas');
            cv.width = cv.height = 72;
            drawBust(cv, u.key);
            d.appendChild(cv);
            el.appendChild(d);
        });
    }

    /** The unit card; hp, mp and statuses come from what the view is showing, so they match the animation. */
    card(u, vis) {
        if (!u) return;
        const c = CLASSES[u.key];
        if (this.cardKey !== u.key) { drawBust($('card-face'), u.key); this.cardKey = u.key; }
        $('card-name').textContent = c.name;
        $('card-sub').textContent = `Lv ${u.lvl} · ${c.role || (c.boss ? 'Overlord' : 'Foe')}`;
        const hp = Math.round(vis?.hp ?? u.hp), mp = vis?.mp ?? u.mp;
        $('card-hp').style.width = `${(hp / u.maxhp) * 100}%`;
        $('card-hptext').textContent = `HP ${hp}/${u.maxhp}`;
        document.querySelector('.bar.mp').style.visibility = u.maxmp ? '' : 'hidden';   // keep its space: the card must never change height
        $('card-mp').style.width = u.maxmp ? `${Math.min(1, mp / u.maxmp) * 100}%` : '0%';
        $('card-mptext').textContent = u.maxmp ? `MP ${mp}/${u.maxmp}` : '';
        const st = Object.keys(vis?.st || u.st);
        const items = u.items || [];
        const key = st.join() + '|' + items.join();
        if (this.stKey !== key) {
            this.stKey = key;
            $('card-st').innerHTML = st.map((s) => `<span class="pill ${s}" title="${STATUS[s].desc}">${STATUS[s].name}</span>`).join('')
                + items.map((i) => `<span class="pill item" title="${ITEMS[i].desc}">${ITEMS[i].name.split(' ')[0]}</span>`).join('');
        }
    }

    /** Which command buttons are on, and which set is showing. */
    commands({ mode, attack, skills, items, wait, undo, go }) {
        const free = mode === 'free';
        for (const [id, on] of [['cmd-attack', free], ['cmd-skills', free], ['cmd-wait', free], ['cmd-undo', free], ['cmd-go', !free], ['cmd-cancel', !free]]) $(id).hidden = !on;
        $('cmd-items').hidden = !free; $('cmd-items').disabled = !items;
        $('cmd-attack').disabled = !attack; $('cmd-skills').disabled = !skills; $('cmd-wait').disabled = !wait; $('cmd-undo').disabled = !undo;
        $('cmd-go').disabled = !go;
    }

    // ------------------------------------------------------------------ skill list
    openSkills(u, list, onPick) {
        $('skills-mp').textContent = u.maxmp ? `MP ${u.mp}/${u.maxmp}` : '';
        const box = $('skills-list');
        box.textContent = '';
        for (const { id, ok, why } of list) {
            const sk = SKILLS[id];
            const b = document.createElement('button');
            b.className = 'skill';
            b.disabled = !ok;
            b.innerHTML = `<b>${sk.name}</b>${sk.cost ? `<span class="cost">${sk.cost} MP</span>` : '<span class="cost">free</span>'}<small>${sk.desc}${ok ? '' : ` (${why})`}</small>`;
            b.addEventListener('click', () => { this.audio.ui('click'); this.closeScreen('skills'); onPick(id); });
            box.appendChild(b);
        }
        this.openScreen('skills');
    }

    /** The items a student carries, each with Use and Give; rows say why one is unavailable. */
    openItems(u, rows, onPick) {
        $('items-who').textContent = `${CLASSES[u.key].name} carries ${u.items.length}`;
        const box = $('items-list');
        box.textContent = '';
        for (const r of rows) {
            const d = document.createElement('div');
            d.className = 'item-row';
            d.innerHTML = `<div class="item-info"><b>${r.name}</b><small>${r.desc}${r.why ? ` (${r.why})` : ''}</small></div>`;
            for (const [kind, label, ok] of [['use', 'Use', r.canUse], ['give', 'Give', r.canGive]]) {
                const b = document.createElement('button');
                b.className = 'btn small';
                b.textContent = label;
                b.disabled = !ok;
                b.addEventListener('click', () => { this.audio.ui('click'); this.closeScreen('items'); onPick(r.slot, kind); });
                d.appendChild(b);
            }
            box.appendChild(d);
        }
        if (!rows.length) box.innerHTML = '<p class="small">Nothing in your pockets.</p>';
        this.openScreen('items');
    }

    // ------------------------------------------------------------------ dialogue
    /** Show lines one at a time, typed out; calls done() when the last one is dismissed. */
    talk(lines, done) {
        this.talkState = { lines, i: 0, shown: 0, acc: 0, done, blip: 0 };
        this.openScreen('talk');
        this._talkLine();
    }
    _talkLine() {
        const s = this.talkState;
        const [who, text] = s.lines[s.i];
        s.shown = 0; s.acc = 0;
        $('talk-name').textContent = speakerName(who);
        $('talk-name').style.visibility = who === 'narrator' ? 'hidden' : 'visible';
        $('talk-line').textContent = '';
        $('talk-line').style.fontStyle = who === 'narrator' ? 'italic' : 'normal';
        drawBust($('talk-face'), who);
        s.text = text;
    }
    talkUpdate(dt, quick) {
        const s = this.talkState;
        if (!s || s.shown >= s.text.length) return;
        s.acc += dt * (quick ? 150 : 62);
        const n = Math.min(s.text.length, Math.floor(s.acc));
        if (n > s.shown) {
            for (let i = s.shown; i < n; i += 3) this.audio.blip(s.lines[s.i][0]);
            s.shown = n;
            $('talk-line').textContent = s.text.slice(0, n);
        }
    }
    talkAdvance() {
        const s = this.talkState;
        if (!s) return;
        if (s.shown < s.text.length) { s.shown = s.text.length; s.acc = s.shown; $('talk-line').textContent = s.text; return; }
        if (s.i + 1 < s.lines.length) { s.i++; this.audio.ui('tick'); this._talkLine(); return; }
        this._talkEnd();
    }
    talkSkip() { if (this.talkState) this._talkEnd(); }
    _talkEnd() {
        const s = this.talkState;
        this.talkState = null;
        this.closeScreen('talk');
        s.done?.();
    }
    get talking() { return !!this.talkState; }

    // ------------------------------------------------------------------ chapter sheets
    describe(key, lvl) {
        const c = CLASSES[key];
        const skills = c.skills.filter((id) => SKILLS[id].lvl <= lvl).map((id) => {
            const fresh = SKILLS[id].lvl === lvl && lvl > 1 ? ' <b>(new!)</b>' : '';
            return `${SKILLS[id].name}${fresh}`;
        }).join(' · ');
        return `<b>${c.full}</b>, ${c.role}. ${c.blurb}<br><small>HP ${stat(c, 'hp', lvl)} · ATK ${stat(c, 'atk', lvl)} · MAG ${stat(c, 'mag', lvl)} · DEF ${stat(c, 'def', lvl)} · RES ${stat(c, 'res', lvl)} · SPD ${c.spd} · Move ${c.move}</small><br><small>${skills}</small>`;
    }

    intro(G, onBegin) {
        const ch = CHAPTERS[G.chapter];
        const lvl = levelOf(G);
        $('intro-kicker').textContent = `Chapter ${G.chapter + 1} of ${CHAPTERS.length} · ${ch.place}`;
        $('intro-title').textContent = ch.title;
        $('intro-goal').textContent = ch.goal + (ch.guest ? ' Someone is stranded here: walk up to them to rescue them.' : '');
        const render = () => {
            $('intro-slots').textContent = `${G.party.length} of ${ch.slots}`;
            const box = $('intro-party');
            box.textContent = '';
            for (const key of G.roster) {
                const c = CLASSES[key];
                const b = document.createElement('button');
                const on = G.party.includes(key);
                b.className = 'chip' + (on ? ' on' : '') + (key === 'pip' ? ' locked' : '');
                b.setAttribute('aria-pressed', on);
                b.innerHTML = `<canvas width="80" height="80"></canvas><span><b>${c.name}${key === 'pip' ? ' ♛' : ''}</b><small>Lv ${lvl} · ${c.role}</small></span>`;
                drawBust(b.querySelector('canvas'), key);
                b.addEventListener('click', () => {
                    this.audio.ui('click');
                    this.focusKey = key;
                    if (key !== 'pip') {
                        const next = on ? G.party.filter((k) => k !== key) : [...G.party, key];
                        if (!on && next.length > ch.slots) this.toast('The party is full. Tap a friend to swap them out first.');
                        else this.onParty(next);
                    }
                    render();
                });
                box.appendChild(b);
            }
            $('intro-info').innerHTML = this.describe(this.focusKey && G.roster.includes(this.focusKey) ? this.focusKey : 'pip', lvl);
            const sn = $('intro-snacks');
            sn.textContent = '';
            for (const [id, s] of Object.entries(SNACKS)) {
                const b = document.createElement('button');
                b.className = 'snack' + (G.snack === id ? ' on' : '');
                b.setAttribute('aria-pressed', G.snack === id);
                b.innerHTML = `<span><b>${s.name}</b><small>${s.desc}</small></span>`;
                b.addEventListener('click', () => { this.audio.ui('click'); this.onSnack(id); render(); });
                sn.appendChild(b);
            }
        };
        this.focusKey = null;
        render();
        $('intro-begin').onclick = () => { this.audio.ui('click'); onBegin(); };
        this.openScreen('intro');
    }

    outro(G, onNext) {
        const ch = CHAPTERS[G.chapter];
        const r = G.result;
        const nextLvl = levelOf(G) + 1;
        let html = `<p>${r.yielded ? 'The Dread Lord Basil put down his oven glove and gave up.' : 'The last foe wandered off, looking sheepish.'} It took <b>${r.turns}</b> turns.</p>`;
        for (const key of r.rescued) html += `<div class="joined"><b>${CLASSES[key].full} joined the party!</b><br><small>${CLASSES[key].blurb}</small></div>`;
        if (r.fainted.length) html += `<p>${r.fainted.map((k) => CLASSES[k].name).join(' and ')} fainted at some point, but a cup of tea and a nap fixed that.</p>`;
        if (!ch.final) {
            const learned = G.roster.flatMap((k) => learnedAt(k, nextLvl).map((id) => `${CLASSES[k].name} learns <b>${SKILLS[id].name}</b>`));
            html += `<p>The whole school studies hard and reaches <b>Level ${nextLvl}</b>.${learned.length ? ' ' + learned.join('; ') + '.' : ''}</p>`;
        }
        $('outro-title').textContent = ch.title;
        $('outro-body').innerHTML = html;
        $('outro-next').onclick = () => { this.audio.ui('click'); onNext(); };
        this.openScreen('outro');
    }

    ending(G, onTitle) {
        const names = G.roster.map((k) => CLASSES[k].name).join(', ');
        $('ending-body').innerHTML = `<p>Thistlewick's first cooking class: ${names}, and one Dread Lord in an apron.</p><p class="small">Thank you for playing Crown &amp; Crumpet. Every picture, every note of music, and every word of this story was made in code.</p>`;
        $('ending-title').onclick = () => { this.audio.ui('click'); onTitle(); };
        this.openScreen('ending');
    }
}

export { ENDING };
