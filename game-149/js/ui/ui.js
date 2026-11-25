// The DOM layer outside the story: screens, the campus HUD, place sheets, shop, gifts, party, journal, bag, settings,
// toasts and the ending. Reads the sim; changes it only through send(cmd).

import { VERSION } from '../config.js';
import { CAST, FRIENDS, ITEMS, SHOP, ICON, PLACES, CHARMS, MINIS, RESCUES, CHAPTERS } from '../sim/data.js';
import { placeActions } from '../sim/game.js';
import { hearts, giftable, party, best } from '../sim/rules.js';
import { GRADES } from '../sim/minis.js';
import { sprSrc } from './vn.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id) => `art/icons/${ICON[id] || id}.webp`;
const SLOT_NAME = ['Morning', 'Afternoon', 'Evening', 'Night'];
const GIFT_HINT = {
    hana: 'Hana loves spicy snacks and anything with a flame in it.',
    lys: 'Lys loves anything to do with stars and books.',
    pip: 'Pip loves gadgets, gears and anything bubbly.',
    ren: 'Ren loves things that sing in the wind, and sweet buns.',
};

export function heartsHtml(n) {
    let s = '';
    for (let i = 0; i < 10; i++) s += i < n ? '♥' : '<span class="off">♥</span>';
    return `<span class="hearts" aria-label="${n} of 10 hearts">${s}</span>`;
}

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, send }) {
        this.audio = audio;
        this.settings = settings;
        this.send = send;
        this.stack = [];
        this.touchOn = false;
        this.G = null;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen must not click inside it when it lifts (the finger that opened it).
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const ids = ['sfx', 'music', 'voice', 'text', 'touch'];
        for (const k of ids) { const el = $('set-' + k); el.value = settings[k]; el.addEventListener('change', () => { settings[k] = el.type === 'range' ? +el.value : el.value; onSettings(settings); }); }
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // the place sheet
        $('panel-body').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-id]');
            if (!b || b.disabled) return;
            audio.ui('click');
            const id = b.dataset.id;
            if (id === 'shop') return this.openShop();
            if (id === 'gift') return this.openGift(b.dataset.who);
            if (id === 'party') return this.openParty();
            // act first: closing the sheet tells the sim to close the place, and then the action would be refused
            const ok = send({ t: 'do', id, who: b.dataset.who || undefined, q: b.dataset.q || undefined });
            if (ok && !this.G.panel) this.closeScreen('panel');
            else if (ok) this.renderPanel();
            else audio.ui('bad');
        });
        $('shop-list').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-item]');
            if (!b) return;
            if (send({ t: 'buy', item: b.dataset.item })) { audio.sfx('charm'); this.renderShop(); } else audio.ui('bad');
        });
        $('gift-list').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-item]');
            if (!b) return;
            this.closeScreen('gift');
            if (send({ t: 'do', id: 'gift', who: this.giftWho, item: b.dataset.item })) this.renderPanel();
        });
        $('party-list').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-who]');
            if (!b) return;
            const G = this.G, who = b.dataset.who;
            let pick = party(G).slice(1);
            pick = pick.includes(who) ? pick.filter((x) => x !== who) : [...pick, who].slice(-2);
            send({ t: 'party', pick });
            this.renderParty();
        });
        // the panel closes through the sim too
        $('panel').querySelector('[data-close]').addEventListener('click', () => send({ t: 'close' }));
        // journal tabs
        for (const t of document.querySelectorAll('#journal .tab')) {
            t.addEventListener('click', () => this.journalTab(t.dataset.tab));
        }
        $('j-gallery').addEventListener('click', (e) => {
            const img = e.target.closest('img[data-cg]');
            if (img) window.open(img.src, '_blank', 'noopener');
        });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.stack.forEach((s, i) => { $(s).style.zIndex = String(50 + i); });
        this.focusFirst(id);
    }
    closeScreen(id) {
        if ($(id).hidden && !this.stack.includes(id)) return;
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (id === 'panel' && this.G?.panel) this.send({ t: 'close' });
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) { $(id).hidden = true; } this.stack = []; }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { const b = this.buttons(id).find((x) => x.tagName === 'BUTTON' && !x.closest('.tabs')) || this.buttons(id)[0]; b?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    toast(text, cls = '') {
        const el = document.createElement('div');
        el.className = 'toast ' + cls;
        el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 2900);
    }

    setTouch(on, walking) {
        this.touchOn = on;
        $('touch').hidden = !(on && walking);
        $('mini-ui').classList.toggle('notouch', !on);
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; }

    hud(G) {
        this.G = G;
        const C = G.climax;
        $('hud-day').textContent = C ? 'Night of the Hollow Moon' : `Day ${G.day} · ${SLOT_NAME[G.slot]}${G.festival ? ' · Festival!' : ''}`;
        $('hud-lumens').textContent = `✦ ${G.lumens}`;
        const moon = $('hud-moon');
        moon.hidden = !C;
        if (C) {
            const t = Math.max(0, Math.ceil(C.time));
            moon.textContent = C.late ? '🌑 The moon has risen' : `🌕 ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
            moon.classList.toggle('urgent', !C.late && C.time < 60);
        }
        $('hud-goal').textContent = objective(G);
        const p = $('hud-prompt');
        if (G.near && !G.panel) {
            const label = `Enter ${PLACES[G.near].name}`;
            if (p.textContent !== label) p.textContent = label;
            p.hidden = false;
        } else p.hidden = true;
    }

    // ------------------------------------------------------------------ the place sheet
    openPanel(G, place) {
        this.G = G;
        this.place = place;
        this.renderPanel();
        this.openScreen('panel');
    }

    renderPanel() {
        const G = this.G, place = this.place, P = PLACES[place];
        $('panel-img').src = `art/bg/${P.bg}.webp`;
        $('panel-title').textContent = P.name;
        $('panel-time').innerHTML = `<span class="chip">${G.climax ? '🌕 Hurry!' : SLOT_NAME[G.slot]}</span>`;
        const acts = placeActions(G, place);
        let html = '';
        if (P.friend && !G.climax && (G.day > 1 || G.flags['met' + P.friend[0].toUpperCase() + P.friend.slice(1)] || P.friend === 'ren')) {
            const f = P.friend;
            html += `<div class="friend"><img src="${sprSrc(f, 'normal')}" alt=""><div><b>${CAST[f].full}</b><br>${heartsHtml(hearts(G, f))}<br><small class="dim">${CAST[f].blurb}</small></div></div>`;
        }
        if (!acts.length) html += '<p class="dim">Nothing to do here right now.</p>';
        for (const a of acts) {
            const tag = a.time ? `<span class="tag">⏳ uses the ${G.slot === 1 ? 'afternoon' : 'evening'}</span>` : '';
            const why = !a.ok && a.why ? `<span class="why">${esc(a.why)}</span>` : (!a.ok && a.time && !G.climax ? '<span class="why">No free time left today</span>' : '');
            html += `<button class="act${a.heart ? ' heart' : ''}" data-id="${a.id}" ${a.who ? `data-who="${a.who}"` : ''} ${a.q ? `data-q="${a.q}"` : ''} ${a.ok ? '' : 'disabled'}><span>${esc(a.label)}${why ? '<br>' + why : ''}</span>${tag}</button>`;
        }
        $('panel-body').innerHTML = html;
    }

    openShop() {
        this.renderShop();
        this.openScreen('shop');
    }
    renderShop() {
        const G = this.G;
        $('shop-lumens').textContent = `✦ ${G.lumens}`;
        $('shop-list').innerHTML = SHOP.map((id) => {
            const I = ITEMS[id];
            return `<div class="item"><img src="${icon(id)}" alt=""><div class="grow"><b>${I.name}</b><small>${I.desc}${G.inv[id] ? ` · have ${G.inv[id]}` : ''}</small></div><button class="btn" data-item="${id}" ${G.lumens >= I.price ? '' : 'disabled'}>✦ ${I.price}</button></div>`;
        }).join('');
    }

    openGift(who) {
        const G = this.G;
        this.giftWho = who;
        $('gift-title').textContent = `A gift for ${CAST[who].name}`;
        const items = Object.keys(G.inv).filter(giftable);
        $('gift-list').innerHTML = `<p class="dim">${GIFT_HINT[who]} One gift a day.</p>` + (items.length ? items.map((id) => `<div class="item"><img src="${icon(id)}" alt=""><div class="grow"><b>${ITEMS[id].name}</b><small>${ITEMS[id].desc} · have ${G.inv[id]}</small></div><button class="btn primary" data-item="${id}">Give</button></div>`).join('') : '<p>You have nothing to give. The Academy Store in the courtyard sells gifts.</p>');
        this.openScreen('gift');
    }

    openParty() { this.renderParty(); this.openScreen('party'); }
    renderParty() {
        const G = this.G, now = party(G).slice(1);
        $('party-list').innerHTML = FRIENDS.filter((f) => G.joined[f]).map((f) => {
            const h = G.heroes[f];
            return `<div class="item"><img src="${sprSrc(f, 'normal')}" alt="" style="object-fit:cover;object-position:top;border-radius:10px"><div class="grow"><b>${CAST[f].name} · Lv ${h.lv}</b><small>${CAST[f].el} magic${G.captive === f ? ' · captured!' : ''}</small></div><button class="btn${now.includes(f) ? ' primary' : ''}" data-who="${f}" ${G.captive === f ? 'disabled' : ''}>${now.includes(f) ? 'In party' : 'Add'}</button></div>`;
        }).join('');
    }

    // ------------------------------------------------------------------ journal and bag
    openJournal(G) { this.G = G; this.renderJournal(); this.openScreen('journal'); }
    journalTab(id) {
        for (const t of document.querySelectorAll('#journal .tab')) t.setAttribute('aria-selected', String(t.dataset.tab === id));
        for (const p of document.querySelectorAll('#journal .tabpane')) p.hidden = p.id !== id;
    }
    renderJournal() {
        const G = this.G;
        const Q = quests(G);
        $('j-quests').innerHTML = `<p class="dim">Chapter ${G.chapter}: ${CHAPTERS.find((c) => c.n === G.chapter)?.name || ''}</p>` + Q.map((q) => `<div class="quest${q.done ? ' done' : ''}"><b>${q.done ? '✓ ' : ''}${esc(q.title)}</b><br><small>${esc(q.text)}</small></div>`).join('');
        $('j-friends').innerHTML = FRIENDS.map((f) => {
            const h = hearts(G, f), r = G.romance[f];
            return `<div class="friend"><img src="${sprSrc(f, h >= 5 ? 'happy' : 'normal')}" alt=""><div><b>${CAST[f].full}</b>${r ? ` <small>(${r === 'romance' ? '♥ sweetheart' : 'best friends'})</small>` : ''}<br>${heartsHtml(h)}<br><small class="dim">${CAST[f].blurb} ${GIFT_HINT[f]}</small>${G.joined[f] ? `<br><small>Party member · Lv ${G.heroes[f].lv}</small>` : ''}</div></div>`;
        }).join('') + `<p class="dim">Mini-game best grades: ${Object.keys(MINIS).map((m) => `${MINIS[m].name} ${G.grades[m] != null ? GRADES[G.grades[m]] : '–'}`).join(' · ')}</p>`;
        $('j-charms').innerHTML = `<p>${G.charms.length} of 12 Echo Charms found.${G.flags.grandEcho ? ' Kai\'s Echo now costs no MP!' : ' Find all twelve for a surprise.'}</p><div class="charms">` + CHARMS.map((c, i) => G.charms.includes(c.id) ? `<div class="charm">✦ ${esc(c.text)}</div>` : `<div class="charm lost">✧ Charm ${i + 1}: not found yet</div>`).join('') + '</div>';
        const cgs = ['hana', 'lys', 'pip', 'ren', 'reveal', 'ending'];
        $('j-gallery').innerHTML = '<div class="gallery">' + cgs.map((c) => G.cgSeen[c] ? `<img data-cg="${c}" src="art/cg/${c}.webp" alt="${c}">` : '<div class="locked">🔒</div>').join('') + '</div>';
    }

    openBag(G) {
        this.G = G;
        $('bag-lumens').textContent = `✦ ${G.lumens}`;
        const ids = Object.keys(G.inv);
        $('bag-list').innerHTML = ids.length ? ids.map((id) => `<div class="item"><img src="${icon(id)}" alt=""><div class="grow"><b>${ITEMS[id].name} ×${G.inv[id]}</b><small>${ITEMS[id].desc}</small></div></div>`).join('') : '<p class="dim">Empty.</p>';
        this.openScreen('bag');
    }

    showEnding(G) {
        const b = best(G), r = G.romance[b];
        $('ending-text').textContent = `${G.name} and ${CAST[b].name}: ${r === 'romance' ? 'sweethearts' : 'best friends'}. ${G.climax?.late ? 'A close call under the Hollow Moon, but every stolen song came home.' : 'Every student freed before the Hollow Moon peaked.'}`;
        const stats = [
            ['Hearts', FRIENDS.map((f) => `${CAST[f].name} ${hearts(G, f)}`).join(' · ')],
            ['Echo Charms', `${G.charms.length} / 12`],
            [`${G.name}'s level`, G.heroes.kai.lv],
            ['Battles won', G.stats.battles],
            ['Mini-games', G.stats.minis],
            ['Dance partner', G.partner ? CAST[G.partner].name : 'Mochi'],
        ];
        $('ending-stats').innerHTML = stats.map(([k, v]) => `<div><small class="dim">${k}</small><br><b>${esc(v)}</b></div>`).join('');
        this.openScreen('ending');
    }
}

// ------------------------------------------------------------------ objectives and quests (derived from G)
export function objective(G) {
    const C = G.climax;
    if (C) {
        if (C.late) return 'The moon has risen! Get to the Principal\'s Tower and storm the Undercroft!';
        const left = RESCUES.filter((r) => !C.freed.includes(r.id));
        if (!left.length) return 'Everyone is free! Storm the Undercroft under the Principal\'s Tower!';
        return `Free the students (${C.freed.length}/4): ` + left.map((r) => `${r.label.replace('{best}', CAST[G.captive || best(G)].name)} at the ${PLACES[r.place].name}`).join(' · ');
    }
    if (G.day === 1 && G.quests.meet === 1) {
        const n = ['metLys', 'metPip', 'metHana'].filter((f) => G.flags[f]).length;
        return `Meet your classmates (${n}/3): the Grand Library, the Alchemy Lab and the Dueling Grounds`;
    }
    if (G.day === 1) return 'Head back to the Dormitory to turn in for the night';
    const bits = [];
    if (G.quests.treats === 1) bits.push(`Mochi's marshmallows ${G.inv.mochitreat || 0}/3`);
    if (G.quests.petals === 1) bits.push(`Moonpetals ${G.inv.moonpetal || 0}/5`);
    if (G.inv.librarybook) bits.push('Return Theo\'s book to the library');
    const free = G.slot === 1 ? 'Free afternoon' : 'Free evening';
    return `${free}: visit a friend, play, train or explore${bits.length ? ' · ' + bits.join(' · ') : ''}`;
}

export function quests(G) {
    const out = [];
    const M = G.quests.moonfade || 0;
    out.push({ title: 'First Day', text: 'Meet Lys, Pip and Hana around campus.', done: G.quests.meet === 2 || G.day > 1 });
    if (M) {
        const steps = ['', 'Theo has fallen into a sleep nobody can wake him from. His magic is gone.', 'Lys is searching the old books about Moonfade.', 'Masked wisps in the Whispering Wood. And Theo\'s library book.', 'Lys knows the way into the Restricted Archive.', 'The Hollow Choir: a cult that steals students\' magic under a Hollow Moon. The next one rises on Festival night.', 'Yuki is gone too. Someone is taking students.', 'The principal\'s cabinet is full of humming violet crystals. Those songs are people.', 'Professor Graves is on your side. Be ready on Festival night.'];
        out.push({ title: 'Moonfade', text: steps[Math.min(M, steps.length - 1)], done: !!G.climax && G.ended });
    }
    if (G.quests.treats) out.push({ title: 'A Hungry Cloud', text: G.quests.treats === 2 ? 'Mochi is fed, happy, and sniffing out charms for you.' : `Find three Cloud Marshmallows around campus (${G.inv.mochitreat || 0}/3).`, done: G.quests.treats === 2 });
    if (G.quests.book) out.push({ title: 'Overdue', text: G.quests.book === 2 ? 'Lys is keeping Theo\'s book safe.' : 'Return Theo\'s library book to Lys.', done: G.quests.book === 2 });
    if (G.quests.petals) out.push({ title: 'Moonpetal Alchemy', text: G.quests.petals === 2 ? 'Pip brewed two Phoenix Feathers.' : `Bring Pip five glowing moonpetals (${G.inv.moonpetal || 0}/5). They grow around the island.`, done: G.quests.petals === 2 });
    out.push({ title: 'Echo Charms', text: `${G.charms.length} of 12 charms found around the island.`, done: G.charms.length >= 12 });
    if (G.climax) out.push({ title: 'The Hollow Moon', text: objective(G), done: G.ended });
    return out;
}
