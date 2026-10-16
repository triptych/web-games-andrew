// Screens, toasts, the dialogue box with its pixel portraits, and the lab HUD. Reads progress;
// never changes it (main.js does, through the callbacks it passes in).

import { V } from '../runtime/index.js';
import { VERSION } from '../config.js';
import { SPEAKERS, fill } from '../meta/story.js';
import { el, $, spriteCanvas } from './dom.js';

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        $('version').textContent = 'v' + VERSION + ' · VESTA-8 BIOS 1.0';
        // The logo is gradient-clipped text, so anything that overflows its column simply vanishes.
        // Orbitron is far wider than the fallback font, so fit it once the real font has loaded.
        this.fitLogo = () => {
            const logo = document.querySelector('.logo');
            if (!logo || !logo.clientWidth) return;
            logo.style.fontSize = '';
            const k = logo.clientWidth / logo.scrollWidth;
            if (k < 1) logo.style.fontSize = Math.floor(parseFloat(getComputedStyle(logo).fontSize) * k * 0.98) + 'px';
        };
        document.fonts?.ready.then(this.fitLogo);
        window.addEventListener('resize', this.fitLogo);

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts (game-071). Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const s of document.querySelectorAll('.screen')) {
            s.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== s) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch'), q = $('set-quality'), crt = $('set-crt'), open = $('set-open'), fast = $('set-fasttext');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch; q.value = settings.quality; crt.value = settings.crt;
        open.checked = settings.openArchive; fast.checked = settings.fastText;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value, quality: +q.value, crt: +crt.value, openArchive: open.checked, fastText: fast.checked });
            onSettings(settings);
        };
        for (const e of [sfx, music, touch, q, crt, open, fast]) e.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => this.ask('Erase the expedition?', 'Your progress and VESTA\'s memory are wiped. Studio cartridges are kept.', [['Erase', () => onDeleteSave(), 'danger']]));

        // the dialogue box
        this.dlg = null;
        $('dialogue').addEventListener('click', (e) => { if (e.target.id !== 'dlg-skip') this.advance(); });
        $('dlg-skip').addEventListener('click', (e) => { e.stopPropagation(); this.endScene(); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        this.onClose?.(id);
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input, textarea')].filter((b) => !b.hidden && !b.disabled && b.offsetParent !== null); }
    focusFirst(id) {
        // on a phone, focusing a text field pops the keyboard up: only focus buttons
        const b = this.buttons(id).find((x) => x.tagName === 'BUTTON');
        b?.focus({ preventScroll: true });
    }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    toast(text, good) {
        const t = el('div', { class: 'toast' + (good ? ' good' : '') }, text);
        $('toasts').append(t);
        setTimeout(() => t.remove(), 3300);
    }

    /** A small question: buttons are [label, fn, kind]. body is text or an element. */
    ask(title, body, buttons) {
        $('ask-title').textContent = title;
        const p = $('ask-text');
        p.innerHTML = '';
        if (body instanceof Node) p.append(body); else p.textContent = body || '';
        const foot = $('ask-foot');
        foot.innerHTML = '';
        foot.append(el('button', { class: 'btn ghost', onclick: () => { this.audio.ui('close'); this.closeAsk(); } }, buttons.length ? 'Cancel' : 'Close'));
        for (const [label, fn, kind] of buttons) foot.append(el('button', { class: 'btn ' + (kind || 'primary'), onclick: () => { this.audio.ui('click'); this.closeAsk(); fn(); } }, label));
        this.openScreen('ask');
    }
    closeAsk() { if (!$('ask').hidden) this.closeScreen('ask'); }

    // ------------------------------------------------------------------ dialogue
    /** Play a scene; resolves when it ends. */
    playScene(lines, ctx) {
        this.endScene(true);
        return new Promise((resolve) => {
            this.dlg = { lines, i: -1, ctx, resolve, shown: 0, full: '' };
            $('dialogue').hidden = false;
            this.advance();
        });
    }
    sceneOpen() { return !!this.dlg; }
    advance() {
        const d = this.dlg;
        if (!d) return;
        if (d.shown < d.full.length) { d.shown = d.full.length; this.paintLine(); return; }
        d.i++;
        if (d.i >= d.lines.length) { this.endScene(); return; }
        const [who, text] = d.lines[d.i];
        d.who = who;
        d.full = fill(text, d.ctx);
        d.shown = this.settings.fastText ? d.full.length : 0;
        const sp = SPEAKERS[who] || SPEAKERS.sys;
        $('dlg-name').textContent = fill(sp.name, d.ctx);
        $('dlg-name').style.color = sp.color;
        $('dlg-text').className = who === 'vesta' ? 'vesta' : who === 'sys' ? 'sys' : '';
        drawFace($('dlg-face'), who);
        $('dlg-face').style.visibility = who === 'sys' ? 'hidden' : 'visible';
        this.paintLine();
    }
    /** Called every frame: the typewriter. */
    tickDialogue(dt) {
        const d = this.dlg;
        if (!d || d.shown >= d.full.length) return;
        const before = Math.floor(d.shown);
        d.shown = Math.min(d.full.length, d.shown + dt * (d.who === 'vesta' ? 46 : 60));
        if (Math.floor(d.shown) !== before) this.audio.voice(d.who, d.full[Math.floor(d.shown) - 1] || ' ');
        this.paintLine();
    }
    paintLine() { const d = this.dlg; $('dlg-text').textContent = d.full.slice(0, Math.floor(d.shown)); }
    endScene(silent) {
        const d = this.dlg;
        if (!d) return;
        this.dlg = null;
        $('dialogue').hidden = true;
        if (!silent) d.resolve();
    }

    // ------------------------------------------------------------------ the lab HUD
    hub(info) {
        $('hub-eyebrow').textContent = info.eyebrow;
        $('hub-title').textContent = info.title;
        $('hub-goal').textContent = info.goal;
        $('hub-mem').textContent = info.memory + '%';
        $('hub-membar').style.width = info.memory + '%';
        $('dock-bench').classList.toggle('pulse', !!info.pulse);
    }
    showHub(on) { $('hub').hidden = !on; }

    // ------------------------------------------------------------------ lists
    archive(missions, P, { onInsert, onPlay }) {
        const list = $('archive-list');
        list.innerHTML = '';
        for (const m of missions) {
            const s = P.missions[m.id];
            const locked = s.state === 'locked';
            const done = s.state === 'done';
            const head = el('div', { class: 'cc-head' }, [
                locked ? el('canvas', { width: 8, height: 8 }) : spriteCanvas(s.cart, s.cart.label, 48),
                el('div', {}, [
                    el('div', { class: 'cc-title' }, locked ? '▒▒▒▒▒▒▒' : m.final && s.cart.title !== 'UNTITLED' ? s.cart.title : m.title),
                    el('div', { class: 'cc-sub' }, m.final ? 'handwritten label' : `${m.year} · after ${m.after}`),
                    el('span', { class: 'pill ' + s.state }, done ? 'restored' : locked ? 'corrupted' : 'on the bench'),
                ]),
            ]);
            const card = el('div', { class: 'cart-card' + (locked ? ' locked' : '') }, [head]);
            if (!locked) {
                card.append(el('div', { class: 'cc-sub' }, m.teaches));
                card.append(el('div', { class: 'btnrow' }, [
                    el('button', { class: 'btn ' + (done ? '' : 'primary'), onclick: () => onInsert(m.id) }, done ? 'Open' : 'Insert'),
                    done ? el('button', { class: 'btn play', onclick: () => onPlay(m.id) }, '▶ Play') : null,
                ]));
            } else card.append(el('div', { class: 'cc-sub' }, 'Restore the cartridge before it to recover this one.'));
            list.append(card);
        }
    }
    studio(entries, { onOpen, onPlay, onDelete, note, templates }) {
        $('studio-note').textContent = note;
        const sel = $('studio-template');
        sel.innerHTML = '';
        for (const t of templates) sel.append(el('option', { value: t.id }, t.title));
        const list = $('studio-list');
        list.innerHTML = '';
        if (!entries.length) list.append(el('p', { class: 'dim' }, 'No cartridges yet. Make one above.'));
        for (const e of entries) {
            list.append(el('div', { class: 'cart-card' }, [
                el('div', { class: 'cc-head' }, [spriteCanvas(e.cart, e.cart.label, 48), el('div', {}, [el('div', { class: 'cc-title' }, e.cart.title), el('div', { class: 'cc-sub' }, e.cart.author ? 'by ' + e.cart.author : e.cart.desc.slice(0, 40))])]),
                el('div', { class: 'btnrow' }, [
                    el('button', { class: 'btn primary', onclick: () => onOpen(e.id) }, 'Open'),
                    el('button', { class: 'btn play', onclick: () => onPlay(e.id) }, '▶'),
                    el('button', { class: 'btn danger', 'aria-label': 'Delete', onclick: () => this.ask(`Delete “${e.cart.title}”?`, 'It can\'t be brought back, unless you saved a file of it.', [['Delete', () => onDelete(e.id), 'danger']]) }, '✖'),
                ]),
            ]));
        }
    }
    brief(m, state, { onInsert, onPlay }) {
        $('brief-eyebrow').textContent = m.final ? 'CARTRIDGE 9 · HANDWRITTEN' : `CARTRIDGE ${m.n} · ${m.year}`;
        $('brief-title').textContent = m.title;
        $('brief-after').textContent = m.final ? 'Your own game' : `After ${m.after} — ${m.maker}`;
        $('brief-history').textContent = state === 'locked' ? 'Corrupted beyond reading. Restore the cartridges before it and VESTA will recover it.' : m.history;
        $('brief-teaches').textContent = state === 'locked' ? '' : 'Teaches: ' + m.teaches;
        const foot = $('brief-foot');
        foot.innerHTML = '';
        foot.append(el('button', { class: 'btn ghost', onclick: () => this.closeTop() }, 'Close'));
        if (state !== 'locked') foot.append(el('button', { class: 'btn primary', onclick: () => { this.closeTop(); onInsert(m.id); } }, state === 'done' ? 'Open on the bench' : 'Insert cartridge'));
        if (state === 'done') foot.append(el('button', { class: 'btn play', onclick: () => { this.closeTop(); onPlay(m.id); } }, '▶ Play'));
        this.openScreen('brief');
    }
    restored(m, cart, memory, items) {
        $('restored-title').textContent = m.final ? cart.title : m.title;
        $('restored-mem').textContent = `VESTA MEMORY ${memory}%`;
        const ul = $('restored-list');
        ul.innerHTML = '';
        for (const it of items) ul.append(el('li', { class: it.ach ? 'ach' : '' }, it.text));
        this.openScreen('restored');
    }

    journal(P, missions, scenes, achievements, tab = 'log', onReplay) {
        $('journal-name').textContent = 'researcher ' + P.name;
        for (const b of $('journal-tabs').children) b.classList.toggle('on', b.dataset.jt === tab);
        const body = $('journal-body');
        body.innerHTML = '';
        if (tab === 'log') {
            body.append(el('p', { class: 'dim' }, 'Every cartridge you restore brings back one of VESTA\'s memories. Tap one to hear it again.'));
            body.append(el('button', { class: 'btn small', onclick: () => onReplay('prologue') }, '▸ Crate 77-B (the beginning)'));
            for (const m of missions) {
                const st = P.missions[m.id].state;
                body.append(el('h3', {}, (m.final ? 'THE LAST CARTRIDGE' : `${m.year} · ${m.title}`) + (st === 'done' ? ' ✓' : '')));
                if (st === 'locked') { body.append(el('p', { class: 'dim' }, '— corrupted —')); continue; }
                const row = el('div', { class: 'btnrow' });
                row.append(el('button', { class: 'btn small', onclick: () => onReplay('brief_' + m.id) }, '▸ Briefing'));
                if (st === 'done') {
                    row.append(el('button', { class: 'btn small', onclick: () => onReplay('done_' + m.id) }, '▸ VESTA remembers'));
                    body.append(el('p', {}, m.history));
                }
                body.append(row);
            }
            if (P.ended) body.append(el('button', { class: 'btn small', style: { marginTop: '12px' }, onclick: () => onReplay('ending') }, '▸ Centennial Day'));
        } else if (tab === 'ach') {
            const n = achievements.filter((a) => P.ach[a.id]).length;
            body.append(el('p', { class: 'dim' }, `${n} of ${achievements.length} commendations.`));
            const t = el('table');
            for (const a of achievements) t.append(el('tr', { style: { opacity: P.ach[a.id] ? 1 : 0.4 } }, [el('td', {}, (P.ach[a.id] ? a.icon : '·') + ' ' + a.name), el('td', {}, a.text)]));
            body.append(t);
        } else {
            const s = P.stats;
            const t = el('table');
            for (const [k, v] of [['Pixels drawn', s.pixels], ['Tiles painted', s.tiles], ['Notes placed', s.notes], ['Sounds shaped', s.sfx], ['Playtests', s.plays], ['Games won', s.wins], ['Games exported', s.exports], ['Repairs asked of VESTA', s.repairs], ['Studio cartridges', P.creative.length]]) t.append(el('tr', {}, [el('td', {}, k), el('td', {}, String(v || 0))]));
            body.append(t);
        }
    }

    codex(tab, { missions, P, features, hasFeature }) {
        for (const b of $('codex-tabs').children) b.classList.toggle('on', b.dataset.ct === tab);
        const body = $('codex-body');
        body.innerHTML = '';
        const pre = (s) => el('pre', { style: { background: '#02040b', border: '1px solid var(--line)', padding: '8px', overflowX: 'auto', fontSize: '13px', color: '#cfe6ff', userSelect: 'text' } }, s);
        if (tab === 'script') {
            body.append(
                el('p', {}, 'VESTA SCRIPT is a little language a bit like Lua. Every object type has a script, and so does the game. A script is made of handlers: blocks that run when something happens.'),
                pre('on hit coin          -- when I touch a "coin"\n  destroy(other)      -- other is the coin\n  score += 1          -- score is shared by everything\n  sfx(1)\nend'),
                el('h3', {}, 'Events'),
            );
            const t = el('table');
            for (const k in V.EVENTS) t.append(el('tr', {}, [el('td', {}, 'on ' + k), el('td', {}, V.EVENTS[k])]));
            body.append(t, el('h3', {}, 'Names'),
                el('p', {}, ['Inside an object\'s script, ', el('code', {}, V.PROPS.join(' ')), ' are that object\'s own. ', el('code', {}, 'me'), ' is the object itself and ', el('code', {}, 'me.anything'), ' keeps your own values on it. Every other name is shared by the whole game: ', el('code', {}, 'score'), ', ', el('code', {}, 'lives'), ' and ', el('code', {}, 'level'), ' are built in, and you can make more just by using them. A name nobody has set yet is 0.']),
                el('h3', {}, 'Statements'),
                pre('x = 10      x += 1      x -= 1      x *= 2      x /= 2\nlocal t = 0                      -- a value only this handler sees\nif a > 1 and not b then … elseif … else … end\nwhile n < 10 do … end\nfor i = 1, 10 do … end           -- also: for i = 10, 1, -1 do\nfor e in all("enemy") do … end  -- every enemy\nrepeat … until done\nfunction serve(speed) … return v end\n-- comments start with -- or //'),
                el('h3', {}, 'Values'),
                el('p', {}, ['Numbers, text in quotes ("joined" .. "like this"), ', el('code', {}, 'true'), ', ', el('code', {}, 'false'), ', ', el('code', {}, 'nil'), ' (nothing), and objects. ', el('code', {}, '== ~= < > <= >= and or not + - * / %'), '. Dividing by zero gives 0 rather than breaking. A loop that never ends stops the game with an error instead of freezing VESTA.']),
            );
        } else if (tab === 'funcs') {
            for (const [group, fns] of V.BUILTIN_DOCS) {
                body.append(el('h3', {}, group));
                const t = el('table');
                for (const [sig, doc] of fns) t.append(el('tr', {}, [el('td', {}, el('code', {}, sig)), el('td', {}, doc)]));
                body.append(t);
            }
        } else if (tab === 'objects') {
            body.append(el('h3', {}, 'Controls'));
            const t = el('table');
            for (const k in V.CONTROLS) t.append(el('tr', {}, [el('td', {}, k), el('td', {}, V.CONTROLS[k])]));
            body.append(t, el('h3', {}, 'Map edges'));
            const t2 = el('table');
            for (const k in V.EDGES) t2.append(el('tr', {}, [el('td', {}, k), el('td', {}, V.EDGES[k])]));
            body.append(t2, el('h3', {}, 'Tile flags'), el('p', {}, 'SOLID tiles stop anything that "stops at solid tiles". HAZARD tiles fire "on hazard". LADDER tiles let a run-&-jump object climb with ↑ and ↓. ONE-WAY tiles are platforms you jump up through and land on.'),
                el('h3', {}, 'The screen'), el('p', {}, 'The VESTA-8 draws 160 × 120 pixels in 16 colours, 60 frames a second. Sprites are 8 × 8; colour 0 is see-through. A map is a grid of sprites, up to 128 × 64 tiles, and the camera follows whoever the CART says.'));
        } else if (tab === 'hardware') {
            body.append(el('p', {}, 'What the VESTA-8 has remembered so far. Everything here also works in the Studio' + (this.settings.openArchive ? ' (Open Archive is on: the Studio has it all).' : '.')));
            const t = el('table');
            for (const [k, F] of Object.entries(features)) t.append(el('tr', { style: { opacity: hasFeature(k) ? 1 : 0.4 } }, [el('td', {}, hasFeature(k) ? '● online' : '○ offline'), el('td', {}, F.label)]));
            body.append(t);
        } else {
            for (const m of missions) {
                if (m.final) continue;
                const st = P ? P.missions[m.id].state : 'locked';
                body.append(el('h3', {}, `${m.year} · ${st === 'locked' ? '▒▒▒▒▒' : m.after}`));
                body.append(el('p', { class: st === 'locked' ? 'dim' : '' }, st === 'locked' ? 'Not yet recovered.' : `${m.maker}. ${m.history}`));
            }
        }
    }
}

// ---------------------------------------------------------------------- portraits
// 24 × 24 pixel faces drawn with the VESTA-8 palette, so they belong on its screen.
const FACES = {
    vesta: [
        '........................', '..1111111111111111111...', '.1fffffffffffffffffff1..', '.1f1111111111111111f1..',
        '.1f1222222222222221f1..', '.1f1222222222222221f1..', '.1f1223322222233221f1..', '.1f1223322222233221f1..',
        '.1f1222222222222221f1..', '.1f1222222222222221f1..', '.1f1222232222322221f1..', '.1f1222223333222221f1..',
        '.1f1222222222222221f1..', '.1f1111111111111111f1..', '.1ffffffffffffff4f6f1..', '.1fffffffffffffffffff1..',
        '..1111111111111111111...', '.....1ff1.....1ff1......', '....11111111111111......', '........................',
        '........................', '........................', '........................', '........................',
    ],
    vey: [
        '........................', '.......99999999.........', '.....999999999999.......', '....99999bbbbb9999......',
        '....999bbbbbbbbb99......', '....99bbbbbbbbbbb9......', '....9bb11bbbb11bb9......', '....9bb31bbbb31bb.......',
        '....9bbbbbbbbbbbb.......', '.....bbbbb5bbbbbb.......', '.....bbbbbbbbbbb........', '......bbb4444bbb........',
        '.......bbbbbbbb.........', '........bbbbbb..........', '......66666666666.......', '....666626666666666.....',
        '...6666662666666666.....', '...66666626666666666....', '...666666666666666666...', '...666666666666666666...',
        '........................', '........................', '........................', '........................',
    ],
    you: [
        '........................', '.......ccccccccc........', '.....ccccccccccccc......', '....cccbbbbbbbbbccc.....',
        '....ccbbbbbbbbbbbcc.....', '....cbbbbbbbbbbbbbc.....', '....bbb11bbbbb11bbb.....', '....bbbeebbbbbeebbb.....',
        '....bbbbbbbbbbbbbbb.....', '.....bbbbbbbbbbbbb......', '.....bbbbb444bbbbb......', '......bbbbbbbbbbb.......',
        '.......bbbbbbbbb........', '........bbbbbbb.........', '......eeeeeeeeeee.......', '....eeeeeeeeeeeeeee.....',
        '...eeee3eeeeeee3eeee....', '...eeeeeeeeeeeeeeeee....', '...eeeeeeeeeeeeeeeeee...', '...eeeeeeeeeeeeeeeeee...',
        '........................', '........................', '........................', '........................',
    ],
    audit: [
        '........................', '.........ffffff.........', '.......ffffffffff.......', '......ffffffffffff......',
        '......ff33ffff33ff......', '......ff33ffff33ff......', '......ffffffffffff......', '......ffffffffffff......',
        '.......ff111111ff.......', '.......ffffffffff.......', '........ffffffff........', '.........ffffff.........',
        '.......ffffffffff.......', '.....ffffffffffffff.....', '....ffff1fffffff1ffff...', '....ffffffffffffffffff..',
        '....fff.fff.fff.fff.f...', '...f.fff.fff.fff.fff....', '....fff.fff.fff.fff.f...', '...f.fff.fff.fff.fff....',
        '........................', '........................', '........................', '........................',
    ],
};
export function drawFace(cv, who) {
    const g = cv.getContext('2d');
    const rows = FACES[who] || FACES.vesta;
    g.fillStyle = '#05060c'; g.fillRect(0, 0, 24, 24);
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
        if (ch === '.') return;
        g.fillStyle = V.PALETTE[parseInt(ch, 16)];
        g.fillRect(x, y, 1, 1);
    }));
    if (who === 'vesta') { g.fillStyle = 'rgba(125,255,176,0.15)'; for (let y = 0; y < 24; y += 2) g.fillRect(0, y, 24, 1); }
}
