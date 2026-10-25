// The roost's panels: the Journey map, the Hatchery (incubators you tap to warm), the Stable, the
// Breeding nest, the Market, plus the party picker, a dragon's sheet and the mid-battle call menu.
// Every change goes through act(); this file only draws and routes taps.

import { SHOP, LIMITS, LEVEL, PARTY_MAX, xpNeed } from '../config.js';
import { SPECIES, SKILLS, TRAITS, ELEMENTS } from '../sim/data.js';
import { CHAPTERS, ACTS } from '../sim/story.js';
import { dragonStats, geneGrade, stageOf, STAGE_NAMES, canBreed, breedOdds, STATS } from '../sim/dragons.js';
import { price, wildLevel, unlocked, EGG_CAP } from '../sim/game.js';
import { callCost, reserve } from '../sim/battle.js';
import { $, esc, elTag, starsTxt } from './ui.js';
import { eggIcon } from './portraits.js';

const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : m ? `${m}m ${s % 60}s` : `${s}s`; };
const STAT_ICON = { hp: '❤️', atk: '⚔️', def: '🛡️', spd: '💨' };
const STAT_NAME = { hp: 'HP', atk: 'Attack', def: 'Defence', spd: 'Speed' };

export class RoostUI {
    constructor({ ui, audio, view, getG, act, onBattle }) {
        Object.assign(this, { ui, audio, view, getG, act, onBattle });
        this.tab = 'map';
        this.breedSel = [];
        this.partySel = [];
        this.partyFor = null;
        this.dragonRid = null;

        $('hub-tabs').addEventListener('click', (e) => {
            const b = e.target.closest('[data-tab]');
            if (!b) return;
            this.audio.ui('click');
            this.show(b.dataset.tab);
        });
        $('btn-hoard').addEventListener('click', () => {
            const r = this.act({ t: 'collect' });
            if (r.ok) { this.ui.toast(`Collected ${r.gold} gold from the hoard.`); } else this.ui.toast('The hoard is empty. Your dragons gather gold over time.');
        });
        $('hub-panel').addEventListener('click', (e) => this._panelClick(e));
        $('party-list').addEventListener('click', (e) => this._partyClick(e));
        $('btn-deploy').addEventListener('click', () => this._deploy());
        $('dragon-sheet').addEventListener('click', (e) => this._dragonClick(e));
    }

    get G() { return this.getG(); }
    thumb(d, size = 128) { return this.view.thumb({ sp: d.sp, hue: d.hue, gilded: d.gilded, lv: d.lv }, size); }

    // ------------------------------------------------------------------ the frame
    refreshTop() {
        const M = this.G.meta;
        $('hub-gold').textContent = `🪙 ${M.gold}`;
        $('btn-hoard').textContent = `💰 Hoard ${Math.floor(M.hoard)}`;
        $('hub-food').textContent = `🍖${M.food.meat} 🐟${M.food.fish} 🍑${M.food.fruit} 🥕${M.food.ironroot} 🪨${M.food.coal}`;
        const ready = M.incub.filter((eid) => { const e = M.eggs.find((x) => x.eid === eid); return e && e.prog >= e.need; }).length;
        const tabs = $('hub-tabs');
        tabs.querySelector('[data-tab="breed"]').hidden = !M.flags.breed;
        const hb = tabs.querySelector('[data-tab="hatchery"]');
        let badge = hb.querySelector('.badge');
        if (ready) { if (!badge) { badge = document.createElement('span'); badge.className = 'badge'; hb.appendChild(badge); } badge.textContent = ready; } else badge?.remove();
        for (const t of tabs.querySelectorAll('[data-tab]')) t.classList.toggle('on', t.dataset.tab === this.tab);
    }

    show(tab = this.tab) {
        this.tab = tab;
        this.refreshTop();
        const el = $('hub-panel');
        const keep = el.scrollTop;
        el.innerHTML = this['_' + tab]();
        el.scrollTop = keep;
        this._sig = this._liveSig();
    }

    /** Called every so often: redraw only what moves on its own (egg warmth, timers, hoard). */
    tick() {
        if ($('hub').hidden) return;
        this.refreshTop();
        if (this.tab === 'hatchery') {
            const M = this.G.meta;
            M.incub.forEach((eid, i) => {
                const e = M.eggs.find((x) => x.eid === eid);
                const n = document.querySelector(`.nest[data-slot="${i}"]`);
                if (!e || !n) return;
                const bar = n.querySelector('.bar > div'), tl = n.querySelector('.tl');
                if (bar) bar.style.width = `${(e.prog / e.need) * 100}%`;
                if (tl) tl.textContent = e.prog >= e.need ? 'Ready to hatch!' : fmtTime(e.need - e.prog) + ' left';
            });
            if (this._liveSig() !== this._sig) this.show();
        } else if (this.tab === 'breed' || this.tab === 'stable') {
            if (this._liveSig() !== this._sig) this.show();
        }
    }
    _liveSig() {
        const M = this.G.meta;
        return [M.incub.map((eid) => { const e = M.eggs.find((x) => x.eid === eid); return e ? (e.prog >= e.need ? 'R' : 'w') : '-'; }).join(''), M.eggs.length, M.dragons.length, M.dragons.filter((d) => d.breedCd <= 0).length, M.dragons.map((d) => d.lv).join()].join('|');
    }

    // ------------------------------------------------------------------ the journey
    _map() {
        const G = this.G, M = G.meta;
        let s = `<div class="ptitle"><h2>The Journey</h2><span class="dim">Kestrel · Lv ${M.tamer.lv}</span></div>`;
        if (M.flags.wild) {
            s += `<button class="chapter wild" data-wild="1"><span class="cn">🌲 Wild Hunt · Lv ${wildLevel(G)}</span><span class="cr">🎲</span><span class="cs">A new map every time. Free chained strays, find lost eggs, train your flock.</span></button>`;
        }
        for (const A of ACTS) {
            const chs = CHAPTERS.map((C, i) => ({ C, i })).filter((x) => x.C.act === A.n);
            if (!chs.some((x) => unlocked(G, x.i))) { s += `<div class="actname">🔒 ${esc(A.name)}</div>`; continue; }
            s += `<div class="actname">${esc(A.name)}</div><div class="dim" style="margin:-4px 0 6px">${esc(A.blurb)}</div>`;
            for (const { C, i } of chs) {
                const open = unlocked(G, i), done = !!M.cleared[C.id];
                const next = open && !done;
                s += `<button class="chapter${open ? '' : ' locked'}${next ? ' next' : ''}" data-ch="${i}" ${open ? '' : 'aria-disabled="true"'}>
                    <span class="cn">${i + 1}. ${open ? esc(C.title) : '???'}</span>
                    <span class="cr">${done ? M.ranks[C.id] || '✓' : next ? '▶' : open ? '' : '🔒'}</span>
                    <span class="cs">${open ? `${esc(C.place)} · ${esc(C.objective.text)} · enemy Lv ${C.lvl} · ${C.slots} dragon${C.slots > 1 ? 's' : ''}` : 'Clear the chapter before it.'}</span>
                </button>`;
            }
        }
        if (M.cleared.ch12) s += '<p class="dim" style="text-align:center">🌅 The Great Chain is broken. Your roost is the heart of a free Isles.</p>';
        return s;
    }

    // ------------------------------------------------------------------ the hatchery
    _hatchery() {
        const M = this.G.meta;
        let s = `<div class="ptitle"><h2>Hatchery</h2><span class="dim">Tap an egg to warm it</span></div><div class="nests">`;
        M.incub.forEach((eid, i) => {
            const e = M.eggs.find((x) => x.eid === eid);
            if (!e) { s += `<div class="nest empty" data-slot="${i}">🔥 Empty incubator<br><small>Place an egg from the basket</small></div>`; return; }
            const ready = e.prog >= e.need;
            s += `<div class="nest" data-slot="${i}">
                <img class="egg${ready ? ' wobble' : ''}" data-warm="${i}" src="${eggIcon(e.sp, 96, { gilded: e.gilded })}" alt="${esc(SPECIES[e.sp].name)} egg">
                <b style="font-size:13px">${ready ? esc(SPECIES[e.sp].name) : '???'} <span class="stars">${starsTxt(SPECIES[e.sp].rarity)}</span></b>
                <div class="bar"><div style="width:${(e.prog / e.need) * 100}%"></div></div>
                <small class="tl">${ready ? 'Ready to hatch!' : fmtTime(e.need - e.prog) + ' left'}</small>
                ${ready ? `<button class="btn go small" data-hatch="${i}">🐣 Hatch!</button>` : `<button class="btn small" data-out="${i}">↩ Basket</button>`}
            </div>`;
        });
        s += '</div>';
        if (M.incub.length < LIMITS.incubators) s += `<p class="dim">More incubators can be bought at the Market (${M.incub.length}/${LIMITS.incubators}).</p>`;
        if (M.food.coal > 0) s += `<div class="actions"><button class="btn" data-coal="1">🪨 Burn Hearthcoal (+5 min to every egg) · ${M.food.coal} left</button></div>`;
        const waiting = M.eggs.filter((e) => !M.incub.includes(e.eid));
        s += `<div class="section">Egg basket (${M.eggs.length}/${EGG_CAP})</div>`;
        if (!waiting.length) s += '<p class="dim">No eggs waiting. Eggs come from the story, Wild Hunts, the Market, and breeding.</p>';
        else s += '<div class="eggs">' + waiting.map((e) => `<button class="eggbtn" data-place="${e.eid}"><img src="${eggIcon(e.sp, 64, { gilded: e.gilded })}" alt=""><span>${e.from === 'bred' ? 'Bred' : e.from === 'market' ? 'Market' : e.from === 'story' ? 'Gift' : 'Found'}</span><span class="stars">${starsTxt(SPECIES[e.sp].rarity).slice(0, SPECIES[e.sp].rarity)}</span></button>`).join('') + '</div>';
        s += `<p class="dim">Eggs warm in real time, even while you fight or are away (up to 8 hours). Each victory warms them too. Stable: ${M.dragons.length}/${M.stableN}.</p>`;
        return s;
    }

    // ------------------------------------------------------------------ the stable
    _stable() {
        const M = this.G.meta;
        const list = M.dragons.slice().sort((a, b) => (M.party.includes(b.rid) - M.party.includes(a.rid)) || b.lv - a.lv);
        let s = `<div class="ptitle"><h2>Stable</h2><span class="dim">${M.dragons.length}/${M.stableN} stalls</span></div>`;
        s += '<p class="dim">Tap a dragon to feed, train, rename or set its place in the flock. Blue = in your flock.</p>';
        s += '<div class="dragon-grid">' + list.map((d) => this._dcard(d, { on: M.party.includes(d.rid), tag: M.training.includes(d.rid) ? '🏟️' : null })).join('') + '</div>';
        s += `<div class="section">Training rings (${M.training.length}/${LIMITS.training})</div><p class="dim">A dragon in a ring gains experience over real time.</p><div class="eggs">`;
        M.training.forEach((rid, i) => {
            const d = M.dragons.find((x) => x.rid === rid);
            s += d ? `<button class="eggbtn" data-untrain="${i}"><img src="${this.thumb(d, 96)}" alt=""><span>${esc(d.name)}</span><span>✖ Stop</span></button>` : `<div class="eggbtn" style="cursor:default">🏟️<span>Empty</span></div>`;
        });
        return s + '</div>';
    }

    _dcard(d, { on = false, sel = false, off = false, tag = null, data = 'rid', extra = '' } = {}) {
        const S = SPECIES[d.sp];
        return `<button class="dcard${on ? ' on' : ''}${sel ? ' sel' : ''}${off ? ' off' : ''}" data-${data}="${d.rid}">
            <img src="${this.thumb(d, 104)}" alt="">
            <span><span class="nm">${esc(d.name)}${d.gilded ? ' ✨' : ''}</span><br><span class="sub">Lv ${d.lv} ${esc(S.name)}</span><br><span class="sub">${ELEMENTS[S.el].icon} ${STAGE_NAMES[stageOf(d.lv)]}${extra}</span></span>
            ${tag ? `<span class="tagx">${tag}</span>` : ''}
        </button>`;
    }

    // ------------------------------------------------------------------ breeding
    _breed() {
        const M = this.G.meta;
        const adults = M.dragons.filter((d) => d.lv >= LEVEL.adult).sort((a, b) => b.lv - a.lv);
        this.breedSel = this.breedSel.filter((r) => adults.some((d) => d.rid === r && canBreed(d)));
        let s = `<div class="ptitle"><h2>Breeding Nest</h2><span class="dim">Adults only (Lv ${LEVEL.adult}+)</span></div>`;
        s += '<p class="dim">Choose two dragons. Their egg inherits the better genes, may inherit their traits, and a few pairs of elements make rare hybrids. Parents rest 10 minutes after.</p>';
        const [a, b] = this.breedSel.map((r) => M.dragons.find((d) => d.rid === r));
        if (a && b) {
            const odds = breedOdds(a, b);
            s += `<div class="section">Possible eggs</div><div class="eggs">` + odds.map((o) => `<div class="eggbtn" style="cursor:default"><img src="${eggIcon(o.sp, 64)}" alt=""><span>${esc(SPECIES[o.sp].name)}${SPECIES[o.sp].hybrid ? ' ✨' : ''}</span><span>${Math.round(o.p * 100)}%</span></div>`).join('') + '</div>';
            s += `<div class="actions"><button class="btn primary" data-dobreed="1">💞 Breed ${esc(a.name)} &amp; ${esc(b.name)}</button></div>`;
        } else s += `<p><b>Pick ${this.breedSel.length ? 'one more' : 'two'} parent${this.breedSel.length ? '' : 's'}.</b></p>`;
        if (!adults.length) s += '<p class="dim">None of your dragons are grown yet. Feed them, train them, and take them into battle.</p>';
        s += '<div class="dragon-grid" style="margin-top:8px">' + adults.map((d) => {
            const ready = canBreed(d);
            return this._dcard(d, { sel: this.breedSel.includes(d.rid), off: !ready, data: 'bsel', extra: ready ? '' : ` · rests ${fmtTime(d.breedCd)}` });
        }).join('') + '</div>';
        s += `<p class="dim">Hybrids: 🔥+🪨 Obsidian Drake · 💧+⚡ Mistral Serpent · 🌿+💧 Lotus Wyrm · 🔥+⚡ Blazewing · ☀️+🌑 Aurelion.</p>`;
        return s;
    }

    // ------------------------------------------------------------------ the market
    _market() {
        const G = this.G, M = G.meta;
        let s = `<div class="ptitle"><h2>Market</h2><span class="dim">Tobble's travelling stall</span></div><div class="shop">`;
        for (const [k, S] of Object.entries(SHOP)) {
            const cost = price(G, k);
            const maxed = (k === 'nest' && M.incub.length >= LIMITS.incubators) || (k === 'ring' && M.training.length >= LIMITS.training) || (k === 'stall' && M.stableN >= LIMITS.stable);
            const have = M.food[k] != null ? ` · have ${M.food[k]}` : '';
            s += `<div class="item"><span class="ic">${S.icon}</span><span class="nm">${esc(S.name)}</span><span class="ds">${esc(S.desc)}${have}</span>
                <button class="btn${M.gold >= cost && !maxed ? ' primary' : ''}" data-buy="${k}" ${maxed ? 'disabled' : ''}>${maxed ? 'Sold out' : `🪙 ${cost}`}</button></div>`;
        }
        return s + '</div><p class="dim">Your stable gathers a hoard of gold over time: collect it with the 💰 button.</p>';
    }

    // ------------------------------------------------------------------ taps
    _panelClick(e) {
        const G = this.G, M = G.meta;
        const t = e.target.closest('[data-ch],[data-wild],[data-warm],[data-hatch],[data-out],[data-place],[data-coal],[data-rid],[data-untrain],[data-bsel],[data-dobreed],[data-buy]');
        if (!t) return;
        const d = t.dataset;
        if (d.ch != null) {
            const ci = +d.ch;
            if (!unlocked(G, ci)) { this.audio.ui('deny'); this.ui.toast('Clear the chapter before it first.'); return; }
            this.audio.ui('select');
            this.openParty({ ch: ci });
        } else if (d.wild) { this.audio.ui('select'); this.openParty({ wild: true }); }
        else if (d.warm != null) {
            const r = this.act({ t: 'warm', slot: +d.warm }, { quiet: true });
            if (r.ok) {
                this.audio.warm();
                t.style.transform = `rotate(${(Math.random() - 0.5) * 30}deg) scale(1.08)`;
                setTimeout(() => { t.style.transform = ''; }, 120);
                const egg = M.eggs.find((x) => x.eid === M.incub[+d.warm]);
                const n = t.closest('.nest');
                if (egg && n) { n.querySelector('.bar > div').style.width = `${(egg.prog / egg.need) * 100}%`; n.querySelector('.tl').textContent = egg.prog >= egg.need ? 'Ready to hatch!' : fmtTime(egg.need - egg.prog) + ' left'; }
                if (egg && egg.prog >= egg.need) this.show();
            } else if (r.err === 'ready') this.ui.toast('It\'s ready! Tap Hatch.');
        } else if (d.hatch != null) {
            const r = this.act({ t: 'hatch', slot: +d.hatch });
            if (r.ok) { const nd = M.dragons.find((x) => x.rid === r.rid); this.ui.toast(`🐣 ${nd.name} the ${SPECIES[nd.sp].name} hatched!${nd.gilded ? ' A gilded one!' : ''}`); this.show(); }
        } else if (d.out != null) { this.act({ t: 'uncubate', slot: +d.out }); this.show(); }
        else if (d.place != null) {
            const r = this.act({ t: 'incubate', eid: +d.place });
            if (!r.ok) this.ui.toast('Every incubator is full.');
            this.show();
        } else if (d.coal) { this.act({ t: 'coal' }); this.ui.toast('The hearths roar. Every egg grows warmer.'); this.show(); }
        else if (d.rid != null) { this.audio.ui('select'); this.openDragon(+d.rid); }
        else if (d.untrain != null) { this.act({ t: 'untrain', slot: +d.untrain }); this.show(); }
        else if (d.bsel != null) {
            const rid = +d.bsel, dr = M.dragons.find((x) => x.rid === rid);
            if (!canBreed(dr)) { this.audio.ui('deny'); this.ui.toast(`${dr.name} needs to rest.`); return; }
            this.audio.ui('select');
            if (this.breedSel.includes(rid)) this.breedSel = this.breedSel.filter((r) => r !== rid);
            else this.breedSel = this.breedSel.concat(rid).slice(-2);
            this.show();
        } else if (d.dobreed) {
            const [a, b] = this.breedSel;
            const r = this.act({ t: 'breed', a, b });
            if (r.ok) { const egg = M.eggs.find((x) => x.eid === r.eid); this.ui.toast(`💞 A new egg! It's waiting in the basket.${SPECIES[egg.sp].hybrid ? ' Something unusual about this one…' : ''}`); this.breedSel = []; }
            this.show();
        } else if (d.buy) {
            const r = this.act({ t: 'buy', item: d.buy });
            if (r.ok) this.ui.toast(r.got ? `You bought an egg. It's in the basket.` : `Bought: ${SHOP[d.buy].name}`);
            this.show();
        }
    }

    // ------------------------------------------------------------------ the party picker
    openParty(target) {
        const G = this.G, M = G.meta;
        this.partyFor = target;
        const slots = target.wild ? 6 : CHAPTERS[target.ch].slots;
        this.partySlots = slots;
        this.partySel = M.party.filter((r) => M.dragons.some((d) => d.rid === r)).slice(0, slots);
        for (const d of M.dragons.slice().sort((a, b) => b.lv - a.lv)) if (this.partySel.length < slots && !this.partySel.includes(d.rid)) this.partySel.push(d.rid);
        this._renderParty();
        this.ui.openScreen('party');
    }
    _renderParty() {
        const G = this.G, M = G.meta, t = this.partyFor;
        const C = t.wild ? null : CHAPTERS[t.ch];
        $('party-title').textContent = C ? `${C.title}` : 'Wild Hunt';
        $('party-info').textContent = C ? `${C.place}. ${C.objective.text} Take up to ${C.slots} dragon${C.slots > 1 ? 's' : ''}; the rest can be called from any roost you hold. Enemy level ${C.lvl}.` : `A random map near your flock's level (Lv ${wildLevel(G)}). Take up to 6.`;
        const list = M.dragons.slice().sort((a, b) => b.lv - a.lv);
        $('party-list').innerHTML = list.map((d) => this._dcard(d, { on: this.partySel.includes(d.rid), data: 'prid', tag: this.partySel.includes(d.rid) ? this.partySel.indexOf(d.rid) + 1 : null })).join('');
        $('btn-deploy').textContent = `Fly! (${this.partySel.length}/${this.partySlots})`;
    }
    _partyClick(e) {
        const b = e.target.closest('[data-prid]');
        if (!b) return;
        const rid = +b.dataset.prid;
        this.audio.ui('select');
        if (this.partySel.includes(rid)) this.partySel = this.partySel.filter((r) => r !== rid);
        else if (this.partySel.length < this.partySlots) this.partySel.push(rid);
        else { this.audio.ui('deny'); this.ui.toast(`Only ${this.partySlots} can fly here.`); return; }
        this._renderParty();
    }
    _deploy() {
        if (!this.partySel.length && this.G.meta.dragons.length) { this.ui.toast('Choose at least one dragon.'); return; }
        this.act({ t: 'party', rids: this.partySel.concat(this.G.meta.party.filter((r) => !this.partySel.includes(r))).slice(0, PARTY_MAX) }, { quiet: true });
        this.onBattle({ ...this.partyFor, rids: this.partySel.slice() });
    }

    // ------------------------------------------------------------------ a dragon's sheet
    openDragon(rid) { this.dragonRid = rid; this._renderDragon(); this.ui.openScreen('dragon'); }
    _renderDragon() {
        const G = this.G, M = G.meta;
        const d = M.dragons.find((x) => x.rid === this.dragonRid);
        if (!d) { this.ui.closeScreen('dragon'); return; }
        const S = SPECIES[d.sp], st = dragonStats(d), sk = SKILLS[S.skill];
        const inParty = M.party.includes(d.rid), training = M.training.includes(d.rid);
        const need = xpNeed(d.lv);
        let s = `<div class="dhead"><img src="${this.thumb(d, 240)}" alt="">
            <div><h2 style="margin:0">${esc(d.name)}${d.gilded ? ' ✨' : ''}</h2>
            <div>${esc(S.name)} ${elTag(S.el)} <span class="stars">${starsTxt(S.rarity).slice(0, S.rarity)}</span></div>
            <div class="dim">Lv ${d.lv} ${STAGE_NAMES[stageOf(d.lv)]} · ${esc(S.cls[0].toUpperCase() + S.cls.slice(1))} · moves ${S.mv}${d.traits.includes('swift') ? '+1' : ''} ${S.mt === 'fly' ? '(flies)' : S.mt === 'swim' ? '(swims)' : ''} · reach ${S.rng.join('–')}</div>
            <div class="bar xp" title="experience"><div style="width:${d.lv >= LEVEL.max ? 100 : (d.xp / need) * 100}%"></div></div>
            <small class="dim">${d.lv >= LEVEL.max ? 'Max level' : `${d.xp}/${need} XP`} · Gen ${d.gen}${d.parents ? ` · child of ${esc(d.parents.join(' & '))}` : ''}</small>
            <div class="bar bond" title="bond"><div style="width:${d.bond * 10}%"></div></div><small class="dim">Bond ${d.bond}/10 (+${d.bond}% crit) · ${d.wins} wins in ${d.battles} battles</small></div></div>`;
        s += `<p class="dim">${esc(S.desc)}</p><div class="stats">` + STATS.map((k) => `<div class="stat"><small>${STAT_ICON[k]} ${STAT_NAME[k]}</small><b>${st[k]}</b><span class="g">Gene ${geneGrade(d.genes[k])}${d.train[k] ? ` · +${d.train[k]}` : ''}</span></div>`).join('') + '</div>';
        s += `<div class="traits"><span class="trait" title="${esc(sk.desc)}">${sk.icon} <b>${sk.name}</b>: ${esc(sk.desc)}</span></div>`;
        s += '<div class="traits">' + d.traits.map((t) => `<span class="trait">${TRAITS[t].icon} <b>${TRAITS[t].name}</b>: ${esc(TRAITS[t].desc)}</span>`).join('') + '</div>';
        s += `<div class="section">Care</div><div class="actions">
            <button class="btn" data-feed="meat" ${M.food.meat ? '' : 'disabled'}>🍖 Feed (${M.food.meat})</button>
            <button class="btn" data-feed="fish" ${M.food.fish ? '' : 'disabled'}>🐟 Feed (${M.food.fish})</button>
            <button class="btn" data-feed="fruit" ${M.food.fruit && d.bond < 10 ? '' : 'disabled'}>🍑 Treat (${M.food.fruit})</button>
        </div>`;
        if (M.food.ironroot) s += '<div class="actions">' + STATS.map((k) => `<button class="btn small" data-iron="${k}" ${d.train[k] >= LIMITS.trainBonus ? 'disabled' : ''}>🥕 +${STAT_NAME[k]} (${d.train[k]}/${LIMITS.trainBonus})</button>`).join('') + '</div>';
        s += `<div class="section">Roost</div><div class="actions">
            <button class="btn${inParty ? '' : ' primary'}" data-party="1">${inParty ? '➖ Leave the flock' : '➕ Join the flock'}</button>
            <button class="btn" data-train="1">${training ? '🏟️ Stop training' : '🏟️ Train'}</button>
            <button class="btn" data-rename="1">✏️ Rename</button>
            <button class="btn danger" data-release="1">🕊️ Release</button>
        </div><div class="sheet-foot"><button class="btn primary" data-closed="1">Done</button></div>`;
        $('dragon-sheet').innerHTML = s;
    }
    _dragonClick(e) {
        const G = this.G, M = G.meta;
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        const d = M.dragons.find((x) => x.rid === this.dragonRid);
        if (!d) return;
        const x = b.dataset;
        if (x.closed) { this.audio.ui('close'); this.ui.closeScreen('dragon'); this.show(); return; }
        if (x.feed) {
            const before = d.lv;
            const r = this.act({ t: 'feed', rid: d.rid, food: x.feed });
            if (r.ok) this.ui.toast(x.feed === 'fruit' ? `${d.name} purrs. Bond +1.` : d.lv > before ? `${d.name} grew to level ${d.lv}!` : `${d.name} gobbles it up.`);
        } else if (x.iron) {
            const r = this.act({ t: 'feed', rid: d.rid, food: 'ironroot', stat: x.iron });
            if (r.ok) this.ui.toast(`${d.name}'s ${STAT_NAME[x.iron]} training improves.`);
        } else if (x.party) {
            const inParty = M.party.includes(d.rid);
            if (!inParty && M.party.length >= PARTY_MAX) { this.ui.toast(`Your flock holds ${PARTY_MAX}. Remove one first.`); return; }
            this.act({ t: 'party', rids: inParty ? M.party.filter((r) => r !== d.rid) : M.party.concat(d.rid) });
        } else if (x.train) {
            const slot = M.training.indexOf(d.rid);
            const r = slot >= 0 ? this.act({ t: 'untrain', slot }) : this.act({ t: 'train', rid: d.rid });
            if (!r.ok) this.ui.toast('Every training ring is in use. Buy another at the Market, or free one.');
        } else if (x.rename) {
            const n = prompt('A new name for ' + d.name + '?', d.name);
            if (n) this.act({ t: 'rename', rid: d.rid, name: n });
        } else if (x.release) {
            if (!confirm(`Release ${d.name} back to the wild? You'll get ${20 * d.lv} gold of thanks from the villages.`)) return;
            const r = this.act({ t: 'release', rid: d.rid });
            if (r.ok) { this.ui.toast(`${d.name} flies free.`); this.ui.closeScreen('dragon'); this.show(); return; }
        }
        this._renderDragon();
    }

    // ------------------------------------------------------------------ calling a dragon mid-battle
    openCall(at, onPick) {
        const G = this.G, B = G.battle;
        const res = reserve(G, B).sort((a, b) => b.lv - a.lv);
        $('call-info').textContent = `You have 🪙 ${B.funds.p}. A called dragon can act next turn.`;
        $('call-list').innerHTML = res.length ? res.map((d) => {
            const cost = callCost(G, d.rid);
            const can = cost <= B.funds.p && (SPECIES[d.sp].mt !== 'swim' || true);
            return this._dcard(d, { off: !can, data: 'call', extra: ` · 🪙${cost}` });
        }).join('') : '<p class="dim">Every dragon in your stable is already here (or resting).</p>';
        $('call-list').onclick = (e) => {
            const b = e.target.closest('[data-call]');
            if (!b) return;
            onPick(+b.dataset.call, at);
        };
        this.ui.openScreen('callmenu');
    }
}
