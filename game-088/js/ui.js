// The DOM layer: screens, the museum and dig HUDs, the task list, the journal, the shop,
// results, dialogue, banners and floating numbers. Reads the sim; never changes it (buttons call
// back into main.js, which does).

import { VERSION, TILES, COINS } from './config.js';
import { goalIcon, itemIcon, portrait, warm, tileIcon } from './view/thumbs.js';
import { ITEMS, ITEM, DINOS, BONE_PARTS, PART_NAMES, PEOPLE, STAFF, HALLS, CHAPTERS, TASKS, DECOR } from './sim/data.js';
import * as Gm from './sim/game.js';
import { levelSpec, STORY_LEVELS, PER_CHAPTER } from './sim/levels.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICONS = { door: '🚪', sweep: '🧹', roof: '🏠', booth: '🎟️', cases: '🗄️', sign: '🪧', vines: '🌿', floor: '✨', permits: '📝', plinths: '🏛️', lanterns: '🏮', garden: '🌷', unboard: '🔨', skylight: '☀️', drawers: '🗃️', stand: '🪵', 'build-trike': '🦕', mural: '🎨', glass: '🐠', waves: '🌊', cabinet: '🐚', dock: '⚓', 'build-plesio': '🦕', rubble: '🪨', beams: '🪵', 'build-trex': '🦖', lights: '💡', banners: '🎏', grand: '🎆' };
const TASK_ICON = (t) => ICONS[t.id] || (t.staff ? '🤝' : t.end ? '🎉' : '⭐');
const GOAL_NAME = { soil: 'Dirt', fossil: 'Fossils', rock: 'Boulders', crust: 'Crust', relic: 'Relics' };
const PRAISE = ['', '', 'Nice!', 'Great dig!', 'Brilliant!', 'Fossiltastic!', 'Jurassic!', 'Legendary!', 'Prehistoric!'];

export class UI {
    constructor({ audio, settings, cb }) {
        this.audio = audio;
        this.settings = settings;
        this.cb = cb;
        this.stack = [];
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
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        // settings
        const sfx = $('set-sfx'), music = $('set-music'), q = $('set-quality'), shake = $('set-shake');
        sfx.value = settings.sfx; music.value = settings.music; q.value = settings.quality; shake.checked = settings.shake;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, quality: q.value, shake: shake.checked }); cb.onSettings(settings); };
        for (const el of [sfx, music, q, shake]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { if (confirm('Delete your museum and start over?')) cb.onDeleteSave(); });

        // museum HUD
        $('m-dig').addEventListener('click', () => cb.onDig());
        $('m-tasks').addEventListener('click', () => { audio.ui('open'); this.openTasks(); });
        $('m-journal').addEventListener('click', () => { audio.ui('page'); this.openJournal('finds'); });
        $('m-shop').addEventListener('click', () => { audio.ui('open'); this.openShop(); });
        $('m-menu').addEventListener('click', () => cb.onMenu());
        $('till').addEventListener('click', () => cb.onTill());
        for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => { audio.ui('page'); this.openJournal(t.dataset.tab); });

        // dig HUD
        $('d-hammer').addEventListener('click', () => cb.onHammer());
        $('d-shuffle').addEventListener('click', () => cb.onShuffle());
        $('d-pause').addEventListener('click', () => cb.onMenu());
        $('hammer-hint').addEventListener('click', () => cb.onHammer(false));
        $('win-go').addEventListener('click', () => cb.onWinContinue());
        $('lose-more').addEventListener('click', () => cb.onMoreMoves());
        $('lose-retry').addEventListener('click', () => cb.onRetry());
        $('lose-quit').addEventListener('click', () => cb.onQuitDig());

        // dialogue
        this.dlg = null;
        $('dialogue').addEventListener('click', (e) => { if (e.target.id !== 'dlg-skip') this.advance(); });
        $('dlg-skip').addEventListener('click', () => this.endScene());
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
        this.cb.onScreensChanged?.();
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0 || !!this.dlg; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.offsetParent !== null); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
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
        setTimeout(() => el.remove(), 3100);
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    }

    // ------------------------------------------------------------------ museum HUD
    showMuseum(on) { $('mhud').hidden = !on; }
    museum(G) {
        this.G = G;
        const set = (id, v) => { const b = $(id).querySelector('b'); if (b.textContent !== String(v)) { b.textContent = v; $(id).classList.remove('bump'); void $(id).offsetWidth; $(id).classList.add('bump'); } };
        set('m-stars', G.stars);
        set('m-coins', G.coins);
        set('m-appeal', Gm.appeal(G));
        const n = Gm.nextLevel(G);
        const dig = $('m-dig');
        dig.classList.toggle('locked', !n);
        dig.querySelector('.dig-lv').textContent = n ? (n > STORY_LEVELS ? `Night ${n - STORY_LEVELS}` : `Level ${n}`) : 'Finish tasks';
        dig.querySelector('.dig-sub').textContent = n ? (n > STORY_LEVELS ? 'Night dig' : 'Dig site') : 'Next dig site';
        const can = Gm.openTasks(G).filter((t) => !Gm.taskBlock(G, t.id)).length;
        const badge = $('m-tasks').querySelector('.badge');
        badge.hidden = !can; badge.textContent = can;
        const ch = Gm.currentChapter(G);
        $('chapter-chip').textContent = G.finished ? 'The museum is complete ✨ Night digs are open' : `Chapter ${ch + 1} · ${CHAPTERS[ch].title}`;
        $('m-journal').querySelector('.badge').hidden = !this.newFinds;
    }
    /** Keep the till bubble over the booth. pos is client px or null. */
    till(G, pos) {
        const t = $('till');
        const n = Math.floor(G.till);
        const show = Gm.museumOpen(G) && pos && n >= 1;
        t.hidden = !show;
        if (!show) return;
        t.style.left = pos.x + 'px';
        t.style.top = pos.y + 'px';
        t.querySelector('b').textContent = n;
        t.classList.toggle('full', G.till >= Gm.tillCap(G) - 0.5);
    }
    museumInsets() {
        const h = innerHeight;
        const bottom = $('mhud').querySelector('.bar.bottom').getBoundingClientRect();
        return { top: 60, bottom: Math.max(0, h - bottom.top) * 0.6, left: 0, right: 0 };
    }

    // ------------------------------------------------------------------ tasks
    openTasks() {
        const G = this.G;
        const ch = Gm.currentChapter(G);
        const all = TASKS.filter((t) => t.ch === ch);
        const doneN = all.filter((t) => Gm.done(G, t.id)).length;
        $('tasks-title').textContent = G.finished ? 'All done!' : `Chapter ${ch + 1}: ${CHAPTERS[ch].title}`;
        $('cp-fill').style.width = `${(doneN / all.length) * 100}%`;
        $('cp-text').textContent = `${doneN} / ${all.length} tasks`;
        const list = $('task-list');
        list.innerHTML = '';
        const open = Gm.openTasks(G);
        if (!open.length) {
            list.innerHTML = `<div class="task done-all">${G.finished ? 'Every hall is open, every dinosaur stands tall. Night digs and the shop await!' : 'Nothing to do right now.'}</div>`;
        }
        for (const t of open) {
            const why = Gm.taskBlock(G, t.id);
            const row = document.createElement('div');
            row.className = 'task' + (why ? ' blocked' : '');
            row.innerHTML = `<div class="t-ic">${TASK_ICON(t)}</div><div class="t-main"><b>${esc(t.title)}</b><small>${why ? esc(why) : t.staff ? `${esc(PEOPLE[t.staff].name)}, ${esc(PEOPLE[t.staff].role.toLowerCase())}` : esc(HALLS[t.ch].name)}</small></div>`;
            const b = document.createElement('button');
            b.className = 'btn primary';
            b.innerHTML = `${t.cost} <span class="ic">★</span>`;
            b.disabled = !!why;
            b.addEventListener('click', () => { this.closeScreen('tasks'); this.cb.onTask(t.id); });
            row.appendChild(b);
            list.appendChild(row);
        }
        if (!Gm.nextLevel(G) && !G.finished) {
            const p = document.createElement('p');
            p.className = 'hint-line';
            p.textContent = 'Finish this chapter to open the next dig site. Short of stars? Replay any dig from the Journal.';
            list.appendChild(p);
        }
        this.openScreen('tasks');
    }

    // ------------------------------------------------------------------ journal
    openJournal(tab) {
        const G = this.G;
        this.newFinds = false;
        for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.dataset.tab === tab);
        const body = $('journal-body');
        body.innerHTML = '';
        if (tab === 'finds') {
            const grid = document.createElement('div');
            grid.className = 'grid';
            for (const h of HALLS) {
                const its = ITEMS.filter((it) => it.hall === h.id && it.kind !== 'bone');
                const got = its.filter((it) => Gm.owns(G, it.id)).length;
                grid.insertAdjacentHTML('beforeend', `<h4 class="hall-h"><span>${esc(h.name)}</span><span>${got}/${its.length}</span></h4>`);
                for (const it of its) {
                    const own = Gm.owns(G, it.id);
                    const c = document.createElement('button');
                    c.className = 'card' + (own ? '' : ' missing');
                    c.innerHTML = `<img alt="" data-item="${it.id}"><span>${own ? esc(it.name) : '???'}</span>`;
                    c.addEventListener('click', () => this.toast(own ? `${it.name}: ${it.blurb}` : 'Still buried somewhere on the island…'));
                    grid.appendChild(c);
                }
            }
            body.appendChild(grid);
        } else if (tab === 'dinos') {
            for (const d of DINOS) {
                const row = document.createElement('div');
                row.className = 'dino-row';
                const n = Gm.dinoBones(G, d.id).length;
                row.innerHTML = `<h3>${esc(d.name)} ${Gm.dinoBuilt(G, d.id) ? '✅' : `<small>${n}/6</small>`}</h3><p>${esc(d.blurb)}</p><div class="bones">${BONE_PARTS.map((p) => `<div class="bone ${Gm.owns(G, `${d.id}-${p}`) ? '' : 'missing'}"><img alt="" data-item="${d.id}-${p}">${PART_NAMES[p]}</div>`).join('')}</div>`;
                body.appendChild(row);
            }
        } else if (tab === 'staff') {
            for (const id of STAFF) {
                const P = PEOPLE[id], has = Gm.hasStaff(G, id);
                const row = document.createElement('div');
                row.className = 'staff-card' + (has ? '' : ' missing');
                row.innerHTML = `<img alt="" data-face="${id}"><div><b>${has ? esc(P.name) : '???'}</b><small>${esc(P.role)}</small><p>${has ? esc(P.perk) : 'Not hired yet. Keep restoring the museum!'}</p></div>`;
                body.appendChild(row);
            }
        } else {
            const s = G.stats;
            body.innerHTML = `<div class="statgrid">
                <div class="stat"><b>${G.level}</b><small>digs cleared</small></div>
                <div class="stat"><b>${Object.values(G.best).reduce((a, b) => a + b, 0)}</b><small>star rating</small></div>
                <div class="stat"><b>${G.items.length}/${ITEMS.length}</b><small>finds</small></div>
                <div class="stat"><b>${s.bestChain}</b><small>longest cascade</small></div>
                <div class="stat"><b>${s.fossils}</b><small>fossils uncovered</small></div>
                <div class="stat"><b>${s.coinsEarned}</b><small>coins earned</small></div></div>
                <h4 class="hall-h">Replay a dig (every win earns at least one ★)</h4>`;
            const lv = document.createElement('div');
            lv.className = 'levels';
            const max = Gm.maxLevel(G);
            for (let n = 1; n <= Math.max(max, Math.min(G.level + 1, 999)); n++) {
                const b = document.createElement('button');
                b.className = 'lv';
                b.innerHTML = `${n > STORY_LEVELS ? 'N' + (n - STORY_LEVELS) : n}<small>${'★'.repeat(G.best[n] || 0)}</small>`;
                b.disabled = n > max;
                b.addEventListener('click', () => { this.closeScreen('journal'); this.cb.onReplay(n); });
                lv.appendChild(b);
            }
            body.appendChild(lv);
        }
        this.openScreen('journal');
        // pictures arrive a few at a time
        const imgs = [...body.querySelectorAll('img[data-item], img[data-face]')];
        warm(imgs.map((im) => (im.dataset.item ? ['item', im.dataset.item] : ['face', im.dataset.face])), () => {
            for (const im of imgs) im.src = im.dataset.item ? itemIcon(im.dataset.item) : portrait(im.dataset.face);
        });
    }

    // ------------------------------------------------------------------ shop
    openShop() {
        const G = this.G;
        const body = $('shop-body');
        body.innerHTML = `<p>Spend coins on dig tools and things that make visitors happy. You have <b>${G.coins}</b> <span class="ic coin"></span>.</p><h3>Dig tools</h3>`;
        const item = (ic, name, sub, cost, can, fn) => {
            const row = document.createElement('div');
            row.className = 'shop-item';
            row.innerHTML = `<div class="s-ic">${ic}</div><div class="s-main"><b>${esc(name)}</b><small>${esc(sub)}</small></div>`;
            const b = document.createElement('button');
            b.className = 'btn primary';
            b.innerHTML = cost === null ? 'Owned' : `${cost} <span class="ic coin"></span>`;
            b.disabled = !can;
            b.addEventListener('click', () => { fn(); this.openShop(); });
            row.appendChild(b);
            body.appendChild(row);
        };
        item('🔨', 'Rock Hammer', `Smash any one square. You have ${G.boosters.hammer}.`, COINS.booster.hammer, G.coins >= COINS.booster.hammer, () => this.cb.onBuyBooster('hammer'));
        item('🔀', 'Sieve Shake', `Shuffle the finds. You have ${G.boosters.shuffle}.`, COINS.booster.shuffle, G.coins >= COINS.booster.shuffle, () => this.cb.onBuyBooster('shuffle'));
        body.insertAdjacentHTML('beforeend', '<h3>Decorations</h3>');
        if (!Gm.done(G, 'open-entrance')) body.insertAdjacentHTML('beforeend', '<p class="hint-line">Open the Entrance Hall to start decorating the island.</p>');
        const icons = { bench: '🪑', flowers: '🌷', lamps: '🏮', fountain: '⛲', icecream: '🍦', lighthouse: '🗼', bandstand: '🎺', balloon: '🎈' };
        for (const d of DECOR) {
            const own = G.decor.includes(d.id);
            item(icons[d.id], d.name, `+${d.appeal} appeal`, own ? null : d.cost, !own && G.coins >= d.cost && Gm.done(G, 'open-entrance'), () => this.cb.onBuyDecor(d.id));
        }
        this.openScreen('shop');
    }

    // ------------------------------------------------------------------ dig HUD
    showDig(on) { $('dhud').hidden = !on; if (!on) this.hammer(false); }
    setupDig(G) {
        const D = G.dig, B = D.B, spec = levelSpec(D.n);
        this.spec = spec;
        $('d-level').textContent = D.n > STORY_LEVELS ? 'N' + (D.n - STORY_LEVELS) : D.n;
        const goals = $('d-goals');
        goals.innerHTML = '';
        this.goalEls = B.goals.map((g) => {
            const el = document.createElement('div');
            el.className = 'goal';
            el.innerHTML = `<img alt="${g.kind === 'color' ? TILES[g.c].name : GOAL_NAME[g.kind]}" src="${goalIcon(g)}"><b>${g.n - g.got}</b>`;
            goals.appendChild(el);
            return el;
        });
        this.shownGoals = B.goals.map((g) => g.got);
        this.moves(B.moves);
        this.score(B.score, spec);
        this.boosters(G);
        const pct = (s) => Math.min(100, (s / (spec.stars[2] * 1.08)) * 100);
        document.querySelector('.scorebar .s1').style.left = pct(Math.round(spec.stars[1] * 0.45)) + '%';
        document.querySelector('.scorebar .s2').style.left = pct(spec.stars[1]) + '%';
        document.querySelector('.scorebar .s3').style.left = pct(spec.stars[2]) + '%';
    }
    boosters(G) {
        for (const [id, k] of [['d-hammer', 'hammer'], ['d-shuffle', 'shuffle']]) {
            const n = G.boosters[k];
            const b = $(id);
            b.querySelector('i').textContent = n > 0 ? n : '+';
            b.classList.toggle('empty', n <= 0);
        }
    }
    hammer(on) { $('d-hammer').classList.toggle('on', on); $('hammer-hint').hidden = !on; }
    moves(left, added) {
        $('d-moves').textContent = left;
        $('d-moves-card').classList.toggle('low', left <= 5);
        if (added) { $('d-moves-card').classList.remove('add'); void $('d-moves-card').offsetWidth; $('d-moves-card').classList.add('add'); }
    }
    score(s, spec = this.spec) {
        $('d-score').textContent = s.toLocaleString();
        const max = spec.stars[2] * 1.08;
        $('d-fill').style.width = Math.min(100, (s / max) * 100) + '%';
        const stars = document.querySelectorAll('.scorebar .star');
        stars[0].classList.add('on');
        stars[1].classList.toggle('on', s >= spec.stars[1]);
        stars[2].classList.toggle('on', s >= spec.stars[2]);
    }
    digInsets() {
        const top = document.querySelector('.scorebar').getBoundingClientRect();
        const bot = document.querySelector('.dbottom').getBoundingClientRect();
        const land = innerHeight < 520;
        if (land) return { top: top.bottom + 4, bottom: 6, left: bot.right + 6, right: 0 };
        return { top: top.bottom + 14, bottom: Math.max(0, innerHeight - bot.top) + 6, left: 0, right: 0 };
    }

    /** A goal counter changes. The icon flies from the board to it first. */
    goal(e, from) {
        const el = this.goalEls?.[e.idx];
        if (!el) return;
        const img = el.querySelector('img');
        const apply = () => {
            el.querySelector('b').textContent = Math.max(0, e.n - e.got);
            el.classList.toggle('done', e.got >= e.n);
            el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
            if (e.got >= e.n) this.audio.ui('star');
        };
        if (!from || this.flying > 24) { apply(); return; }
        const to = img.getBoundingClientRect();
        const f = document.createElement('img');
        f.className = 'flyer';
        f.src = img.src;
        $('fxlayer').appendChild(f);
        this.flying = (this.flying || 0) + 1;
        const mx = (from.x + to.left + to.width / 2) / 2 + (Math.random() - 0.5) * 120, my = Math.min(from.y, to.top) - 60;
        const anim = f.animate([
            { transform: `translate(${from.x}px, ${from.y}px) scale(0.6)` },
            { transform: `translate(${mx}px, ${my}px) scale(1.3)`, offset: 0.45 },
            { transform: `translate(${to.left + to.width / 2}px, ${to.top + to.height / 2}px) scale(0.7)` },
        ], { duration: 520 + Math.random() * 160, easing: 'cubic-bezier(.5,0,.5,1)' });
        f.style.left = '0'; f.style.top = '0';
        anim.onfinish = () => { f.remove(); this.flying--; apply(); };
    }

    popup(text, pos, color = '#fff', big = false) {
        if (!pos) return;
        const el = document.createElement('div');
        el.className = 'popup' + (big ? ' big' : '');
        el.textContent = text;
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
        el.style.color = color;
        $('fxlayer').appendChild(el);
        setTimeout(() => el.remove(), 950);
    }
    praise(chain) {
        const t = PRAISE[Math.min(PRAISE.length - 1, chain)];
        if (t) this.praiseText(t, chain >= 5 ? 'big' : '');
    }
    praiseText(text, kind = '') {
        const p = $('praise');
        p.innerHTML = '';
        const el = document.createElement('div');
        el.className = 'praise ' + kind;
        el.textContent = text;
        p.appendChild(el);
        clearTimeout(this.praiseT);
        this.praiseT = setTimeout(() => el.remove(), 1150);
    }
    banner(text, kind = '') {
        const b = $('banner');
        const el = document.createElement('div');
        el.className = 'banner ' + kind;
        el.textContent = text;
        b.innerHTML = '';
        b.appendChild(el);
        setTimeout(() => el.remove(), 1850);
    }
    specialMade(tile, pos) {
        const name = tile.k === 'sun' ? 'Sunstone!' : tile.s === 'bomb' ? 'Pickaxe!' : tile.s === 'scarab' ? 'Scarab!' : 'Trowel!';
        this.popup(name, pos, '#fff3c0', true);
    }

    // ------------------------------------------------------------------ results
    showWin(r, G) {
        $('win-score').textContent = r.score.toLocaleString();
        const stars = document.querySelectorAll('.bigstars i');
        stars.forEach((s) => s.classList.remove('on'));
        stars.forEach((s, i) => { if (i < r.stars) setTimeout(() => s.classList.add('on'), 400 + i * 320); });
        this.audio.stars(r.stars);
        $('win-rewards').innerHTML = `<span>+${r.gained} <span class="ic">★</span></span><span>+${r.coins} <span class="ic coin"></span></span>`;
        const f = $('win-found');
        f.hidden = !r.item;
        if (r.item) {
            const it = ITEM[r.item];
            $('win-img').src = itemIcon(r.item);
            $('win-kind').textContent = it.kind === 'bone' ? 'Dinosaur bone!' : 'New find!';
            $('win-name').textContent = it.name;
            $('win-blurb').textContent = it.kind === 'bone' ? `Part ${Gm.dinoBones(G, it.dino).length} of 6 for the ${DINOS.find((d) => d.id === it.dino).name}.` : it.blurb;
            this.newFinds = true;
        }
        this.openScreen('win');
    }
    showLose(G, goals) {
        const el = $('lose-goals');
        el.innerHTML = '';
        for (const g of goals) {
            if (g.got >= g.n) continue;
            el.insertAdjacentHTML('beforeend', `<div class="goal"><img alt="" src="${goalIcon(g)}"><b>${g.n - g.got}</b></div>`);
        }
        const cost = Gm.extraMovesCost(G);
        $('lose-cost').textContent = cost;
        $('lose-more').disabled = G.coins < cost;
        this.openScreen('lose');
    }

    // ------------------------------------------------------------------ dialogue
    /** Play a scene: [[speaker, line]...]. Calls done() at the end or on skip. */
    scene(lines, name, done) {
        this.dlg = { lines, i: 0, name, done, typed: 0, full: '' };
        $('dialogue').hidden = false;
        this.showLine();
    }
    showLine() {
        const d = this.dlg;
        const [who, text] = d.lines[d.i];
        const P = PEOPLE[who];
        d.full = text.replaceAll('{name}', d.name);
        d.typed = 0;
        d.who = who;
        $('dlg-name').textContent = who === 'you' ? d.name : P.name;
        $('dlg-name').style.background = P.color;
        $('dlg-text').classList.toggle('letter', who === 'marigold' && /^(My|Dear|Darling)/.test(text));
        $('dlg-text').textContent = '';
        $('dlg-img').src = portrait(who);
        $('dialogue').querySelector('.dlg-portrait').classList.add('talk');
        this.audio.ui('page');
    }
    /** Type a few letters a frame. */
    tick(dt) {
        const d = this.dlg;
        if (!d || d.typed >= d.full.length) return;
        const before = Math.floor(d.typed);
        d.typed = Math.min(d.full.length, d.typed + dt * 55);
        const n = Math.floor(d.typed);
        if (n !== before) {
            $('dlg-text').textContent = d.full.slice(0, n);
            if (n % 3 === 0 && /\w/.test(d.full[n - 1] || '')) this.audio.voice(d.who);
        }
        if (n >= d.full.length) $('dialogue').querySelector('.dlg-portrait').classList.remove('talk');
    }
    advance() {
        const d = this.dlg;
        if (!d) return;
        if (d.typed < d.full.length) { d.typed = d.full.length; $('dlg-text').textContent = d.full; $('dialogue').querySelector('.dlg-portrait').classList.remove('talk'); return; }
        d.i++;
        if (d.i >= d.lines.length) this.endScene();
        else this.showLine();
    }
    endScene() {
        const d = this.dlg;
        if (!d) return;
        this.dlg = null;
        $('dialogue').hidden = true;
        d.done?.();
        this.cb.onScreensChanged?.();
    }
    inScene() { return !!this.dlg; }

    chapterCard(ch, title) {
        $('cc-small').textContent = ch === 'end' ? 'The End' : `Chapter ${ch + 1}`;
        $('cc-title').textContent = title;
        const c = $('chapter-card');
        c.hidden = true; void c.offsetWidth; c.hidden = false;
        clearTimeout(this.ccT);
        this.ccT = setTimeout(() => { c.hidden = true; }, 3400);
    }
}

export { tileIcon };
