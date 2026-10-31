// The DOM layer: screens, the hand of cards, the battle HUD, the map, and every sheet between battles.
// It reads the game and renders it; buttons carry data attributes that main.js turns into commands.

import { VERSION, MAP, ARMY_MAX } from './config.js';
import { CREATURES, FOES, CARDS, RELICS, BOONS, ACT_INFO, EVENTS, NODES } from './sim/data.js';
import { cardDef, costOf, playable, orphaned, unitDef, totalHp, spdOf, atkOf, defOf, stackById } from './sim/battle.js';
import { heroStats, xpNeed, priceOf, armyMax, nextNodes, canUpgrade } from './sim/game.js';
import { glyph, glyphURL, CARD_GLYPH, NODE_GLYPH, INTENT_GLYPH, BOON_GLYPH } from './glyphs.js';
import { ST_NAME } from './view/view.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const KIND = { attack: 'Attack', spell: 'Spell', ward: 'Ward', buff: 'Tactic', move: 'Manoeuvre', heal: 'Healing', draw: 'Tactic', earthwork: 'Tactic', special: 'Signature', curse: 'Curse' };
const INTENT_TEXT = {
    attack: 'march up and attack', shoot: 'shoot', ward: 'raise its guard (Ward)', cry: 'rally its kin (+Might)', hex: 'lay a curse on a stack',
    curse: 'slip a Doubt into your discard', summon: 'call more of its kin', breath: 'breathe fire in a line', sweep: 'attack everything beside it', roar: 'roar at your whole legion', stunned: 'do nothing: it is stunned',
};

/** A card's rules text with its numbers filled in. */
export function cardText(d, lore = 1) {
    return d.text
        .replace('{m}', `${Math.round((d.mult ?? 1) * 100)}%`)
        .replace('{s}', `${Math.round((d.base || 0) + (d.per || 0) * lore)}`)
        .replace('{w}', `${Math.round((d.ward || 0) * 100)}%`)
        .replace('{h}', `${Math.round((d.frac || 0) * 100)}%`);
}

function actorLabel(d) {
    if (!d.actor) return d.allFoes ? 'every foe' : d.all ? 'whole legion' : d.target === 'hex' ? 'any hex' : d.target === 'enemy' ? 'a foe' : '';
    if (CREATURES[d.actor]) return CREATURES[d.actor].name;
    return { any: 'any stack', melee: 'walkers', ranged: 'archers' }[d.actor];
}

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, portrait }) {
        this.audio = audio;
        this.settings = settings;
        this.portrait = portrait || (() => '');
        this.stack = [];
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen (the finger that opened it) must not click inside it
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), speed = $('set-speed'), calm = $('set-calm');
        sfx.value = settings.sfx; music.value = settings.music; speed.value = String(settings.speed); calm.checked = !!settings.calm;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, speed: +speed.value, calm: calm.checked }); onSettings(settings); };
        for (const el of [sfx, music, speed, calm]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('The saved campaign is gone.'); });
        document.querySelector('.gl.g-coin')?.insertAdjacentHTML('afterbegin', glyph('coin'));
        for (const el of document.querySelectorAll('.gl.g-coin')) if (!el.innerHTML) el.innerHTML = glyph('coin');
        for (const el of document.querySelectorAll('.gl.g-crown')) el.innerHTML = glyph('crown');
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i * 2; });
        this.focusFirst(id);
        this.on?.('screens');
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
        this.on?.('screens');
    }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    isOpen(id) { return this.stack.includes(id); }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input, [tabindex="0"]')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { if (id === 'map') return; this.buttons(id)[0]?.focus({ preventScroll: true }); }
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
        setTimeout(() => el.remove(), 2700);
        window.A11Y?.announce?.(text);
    }
    banner(text, cls = '') {
        const b = $('banner');
        b.className = '';
        b.textContent = text;
        void b.offsetWidth;
        b.className = 'show ' + cls;
    }

    // ------------------------------------------------------------------ cards
    cardHTML(card, { lore = 1, B = null, cls = '', tag = 'div', price = null, idx = null } = {}) {
        const d = cardDef(card);
        if (!d) return '';
        const cost = B ? costOf(B, card) : d.cost;
        const sig = CREATURES[d.actor];
        const art = sig ? `<img alt="" src="${this.portrait(d.actor, 'p')}">` : glyph(CARD_GLYPH[card.id] || 'star');
        const orph = B && orphaned(B, card) ? '<div class="orph">Its bearers<br>are gone</div>' : '';
        const no = B && !playable(B, card) ? ' no' : '';
        const attrs = idx != null ? ` data-i="${idx}"` : '';
        const role = tag === 'button' ? '' : ' role="listitem"';
        return `<${tag} class="card k-${d.kind} r-${d.rarity}${card.up ? ' up' : ''}${no} ${cls}" data-uid="${card.uid ?? ''}" data-id="${card.id}"${attrs}${role} ${tag === 'button' ? 'type="button"' : 'tabindex="-1"'} aria-label="${esc(d.name)}, costs ${d.unplayable ? 'nothing, unplayable' : cost}. ${esc(cardText(d, lore))}">
            ${d.unplayable ? '' : `<div class="cost">${cost}</div>`}
            <div class="band">${esc(CARDS[card.id].name)}</div>
            <div class="art">${art}</div>${orph}
            <div class="ctype">${KIND[d.kind]}${actorLabel(d) ? ' · ' + actorLabel(d) : ''}</div>
            <div class="ctext">${esc(cardText(d, lore))}</div>
            ${price != null ? `<div class="price">${price}g</div>` : ''}
        </${tag}>`;
    }

    // ------------------------------------------------------------------ battle HUD
    showBattleHud(on) {
        $('bhud').hidden = !on;
        if (!on) { $('handwrap').hidden = true; $('deploybar').hidden = true; this.hideInfo(); this.hideForecast(); }
        this.on?.('screens');
    }

    renderHud(G) {
        const B = G.battle;
        if (!B) return;
        $('bh-book').textContent = `${ACT_INFO[G.act].sub}: ${ACT_INFO[G.act].name}`;
        $('bh-turn').textContent = B.phase === 'deploy' ? 'Deployment' : `Turn ${B.turn}${B.kind === 'boss' ? ' · Boss' : B.kind === 'elite' ? ' · Lair' : ''}`;
        $('ink-n').textContent = B.phase === 'deploy' ? '–' : B.ink;
        $('bh-ink').classList.toggle('low', B.ink <= 0);
        $('n-draw').textContent = B.draw.length;
        $('n-disc').textContent = B.discard.length;
        $('deploybar').hidden = B.phase !== 'deploy';
        $('handwrap').hidden = B.phase === 'deploy' || !!B.over;
    }

    /** The hand. sel: the selected card's uid; busy: animations or the foe's turn. */
    renderHand(G, { sel = null, busy = false, enemy = false, fresh = new Set() } = {}) {
        const B = G.battle;
        if (!B) return;
        const lore = B.hero.lore;
        const n = B.hand.length;
        const html = B.hand.map((c, i) => {
            const mid = (n - 1) / 2;
            const rot = (i - mid) * (n > 6 ? 1.6 : 2.4);
            const lift = Math.min(10, Math.abs(i - mid) * Math.abs(i - mid) * 1.2);
            return this.cardHTML(c, { lore, B, cls: `${sel === c.uid ? 'sel' : ''} ${fresh.has(c.uid) ? 'enter' : ''}`, idx: i })
                .replace('class="card', `style="transform: translateY(${lift}px) rotate(${rot}deg)" class="card`);
        }).join('');
        const sig = `${html}|${busy}|${enemy}`;
        if (sig !== this.handSig) {
            this.handSig = sig;
            $('hand').innerHTML = html;
        }
        const end = $('btn-end');
        end.textContent = enemy ? 'Foe moving…' : 'End Turn';
        end.classList.toggle('waiting', enemy || busy);
        end.disabled = enemy;
        end.classList.toggle('nudge', !enemy && !busy && B.phase === 'player' && !B.hand.some((c) => playable(B, c)));
    }

    setHint(t) { $('hint').textContent = t || ''; }

    /** The stack card: who it is, its numbers, and for a foe what it means to do. */
    renderInfo(G, id) {
        const B = G.battle;
        const s = B ? stackById(B, id) : null;
        if (!s) { this.hideInfo(); return; }
        const d = unitDef(s);
        const st = Object.entries(s.st).filter(([k]) => ST_NAME[k]).map(([k, n]) => `${ST_NAME[k]} (${n})`).join(', ');
        let it = '';
        if (s.side === 'e' && s.intent) {
            const t = s.intent.target != null ? stackById(B, s.intent.target) : null;
            it = `<div class="it"><b>Intent:</b> ${INTENT_TEXT[s.intent.k] || s.intent.k}${t ? ` (${CREATURES[t.key]?.name || ''})` : ''}${s.intent.est && s.intent.k !== 'hex' ? `, about <b>${s.intent.est}</b> damage` : ''}${s.intent.reach === false ? ', if it can reach' : ''}.</div>`;
        }
        const traits = [d.rng ? 'Shoots' : 'Walks', d.fly ? 'Flies' : '', d.retalAll ? 'Answers every blow' : '', d.regen ? 'Regenerates' : '', d.drain ? 'Drains life' : '', d.boss ? 'Boss' : ''].filter(Boolean).join(' · ');
        const own = s.side === 'p' ? `<div class="dim">${s.moved ? 'Has moved' : 'May move'} · ${s.attacked ? 'has attacked' : 'may attack'}</div>` : '';
        $('info').innerHTML = `<button class="x" aria-label="Close">×</button>
            <div class="ih"><img alt="" src="${this.portrait(s.key, s.side)}"><div><h4>${esc(d.name)}</h4>
            <div><b>${s.count}</b> of ${s.start} · ${totalHp(s)} health${s.ward ? ` · Ward ${s.ward}` : ''}</div><div class="dim">${traits}</div></div></div>
            <div class="stats"><span>Atk <b>${atkOf(B, s)}</b></span><span>Def <b>${defOf(B, s)}</b></span><span>Dmg <b>${d.dmg}</b></span><span>Spd <b>${spdOf(B, s)}</b></span></div>
            ${st ? `<div>${st}</div>` : ''}${own}${it}`;
        $('info').hidden = false;
        $('info').querySelector('.x').onclick = () => { this.hideInfo(); this.onInfoClose?.(); };
    }
    hideInfo() { $('info').hidden = true; }

    showForecast(x, y, html) {
        const f = $('forecast');
        f.innerHTML = html;
        f.hidden = false;
        const w = f.offsetWidth;
        f.style.left = `${Math.max(w / 2 + 6, Math.min(innerWidth - w / 2 - 6, x))}px`;
        f.style.top = `${Math.max(f.offsetHeight + 60, y)}px`;
    }
    hideForecast() { $('forecast').hidden = true; }

    /** The space the HUD takes, so the camera can fit the field into what is left. */
    pads() {
        const short = innerHeight < 520;
        const top = $('bhud').hidden ? 52 : $('bhud').getBoundingClientRect().bottom + (short ? 8 : 30);
        let bottom = 0;
        if (!$('handwrap').hidden) bottom = (innerHeight - $('hand').getBoundingClientRect().top) * (short ? 0.62 : 0.85);
        else if (!$('deploybar').hidden) bottom = innerHeight - $('deploybar').getBoundingClientRect().top + 4;
        return { top, bottom: Math.max(0, bottom), left: 0, right: 0 };
    }

    // ------------------------------------------------------------------ the map
    renderMap(G) {
        const M = G.map;
        const info = ACT_INFO[G.act];
        $('map-book').textContent = info.sub;
        $('map-name').textContent = info.name;
        $('map-gold').textContent = G.gold;
        $('map-lvl').textContent = G.hero.lvl;
        $('map-deckn').textContent = G.deck.length;
        this.renderRelics(G, $('map-relics'));
        const W = 500, rowH = 84, top = 70, H = top + (MAP.floors + 1) * rowH + 30;
        const pos = (n) => {
            const x = n.type === 'boss' ? W / 2 : 50 + ((n.col + 0.5 + n.jx) / MAP.lanes) * (W - 100);
            const y = H - 50 - n.f * rowH - (n.type === 'boss' ? 30 : n.jy * rowH * 0.6);
            return [x, y];
        };
        const nexts = new Set(nextNodes(G).map((n) => n.id));
        const walked = new Set();
        const v = M.visited;
        for (let i = 1; i < v.length; i++) walked.add(`${v[i - 1]}>${v[i]}`);
        let edges = '', nodes = '';
        for (const n of M.nodes) {
            const [x1, y1] = pos(n);
            for (const id of n.next) {
                const m = M.nodes.find((q) => q.id === id);
                const [x2, y2] = pos(m);
                const mx = (x1 + x2) / 2 + ((n.col * 7 + m.col * 3) % 5 - 2) * 3, my = (y1 + y2) / 2;
                edges += `<path class="edge${walked.has(`${n.id}>${id}`) ? ' walked' : ''}" d="M${x1} ${y1 - 18} Q${mx} ${my} ${x2} ${y2 + 18}"/>`;
            }
        }
        for (const n of M.nodes) {
            const [x, y] = pos(n);
            const r = n.type === 'boss' ? 34 : 22;
            const cls = ['node', v.includes(n.id) ? 'visited' : '', M.cur === n.id ? 'cur' : '', nexts.has(n.id) ? 'next' : '', !nexts.has(n.id) && !v.includes(n.id) && n.f <= (M.cur ? M.nodes.find((q) => q.id === M.cur).f : -1) ? 'past' : ''].join(' ');
            const label = `${NODES[n.type].name}${n.type === 'boss' ? `: ${FOES[info.boss].name}` : ''}`;
            nodes += `<g class="${cls}" data-node="${n.id}" ${nexts.has(n.id) ? 'tabindex="0" role="button"' : ''} aria-label="${esc(label)}" transform="translate(${x} ${y})">
                ${nexts.has(n.id) ? `<circle class="ring" r="${r + 7}"/>` : ''}
                <circle class="disc" r="${r}" filter="url(#wobble)"/>
                <g class="icon" transform="translate(${-r * 0.72} ${-r * 0.72}) scale(${r * 1.44 / 48})">${glyph(NODE_GLYPH[n.type]).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
                <title>${esc(label)}</title>
            </g>`;
        }
        // the legion's banner on the current node
        let flag = '';
        if (M.cur) {
            const [x, y] = pos(M.nodes.find((q) => q.id === M.cur));
            flag = `<g class="flag" transform="translate(${x + 14} ${y - 44})">${glyph('banner').replace(/^<svg[^>]*>|<\/svg>$/g, '').replace('<g ', '<g transform="scale(0.8)" ')}</g>`;
        }
        // a compass rose, a title cartouche and a few hand-drawn hills and trees
        const deco = `<g opacity=".55" stroke="#231b14" fill="none" stroke-width="1.6" filter="url(#wobble2)">
            <path d="M30 ${H - 120} q10 -16 20 0 q10 -16 20 0"/><path d="M420 ${H - 300} q12 -18 24 0 q12 -18 24 0 q12 -18 24 0"/>
            <path d="M40 ${H * 0.45} l6 -14 l6 14 z M52 ${H * 0.45 + 6} l6 -14 l6 14 z"/><path d="M450 ${H * 0.62} l6 -14 l6 14 z M440 ${H * 0.62 + 8} l6 -14 l6 14 z"/>
            <path d="M30 ${H * 0.2} c20 -10 30 10 50 0 c20 -10 30 10 50 0" stroke-dasharray="3 5"/>
            </g>
            <g transform="translate(460 60)" stroke="#231b14" stroke-width="1.6" fill="none" filter="url(#wobble)"><circle r="18"/><path d="M0 -26 L5 0 L0 26 L-5 0 Z" fill="#b5532d"/><path d="M-26 0 L0 5 L26 0 L0 -5 Z" fill="#f0e4c4"/><text y="-30" text-anchor="middle" font-size="11" stroke="none" fill="#231b14">N</text></g>`;
        const svg = $('map-svg');
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.innerHTML = deco + edges + nodes + flag;
        const legend = ['battle', 'elite', 'dwelling', 'shop', 'camp', 'event', 'treasure'].map((k) => `<span class="lg"><i class="gl">${glyph(NODE_GLYPH[k])}</i>${NODES[k].name}</span>`).join('');
        $('map-hint').innerHTML = `<div>${G.map.cur ? 'Choose where the legion marches next.' : 'The road begins. Choose your first step.'}</div><div class="legend">${legend}</div>`;
        // keep the current floor in view
        requestAnimationFrame(() => {
            const sc = $('map-scroll');
            const cur = G.map.cur ? G.map.nodes.find((q) => q.id === G.map.cur) : null;
            const y = pos(cur || { f: 0, col: 2, jx: 0, jy: 0, type: 'battle' })[1];
            const k = sc.clientWidth ? Math.min(560, sc.clientWidth) / W : 1;
            sc.scrollTop = Math.max(0, y * k - sc.clientHeight * 0.65);
        });
    }

    renderRelics(G, el) {
        el.innerHTML = G.relics.map((k) => `<button class="relic" data-relic="${k}" title="${esc(RELICS[k].name)}: ${esc(RELICS[k].text)}" aria-label="${esc(RELICS[k].name)}">${glyph(RELICS[k].glyph)}</button>`).join('');
    }

    showRelic(k) {
        const r = RELICS[k];
        $('ri-name').textContent = r.name;
        $('ri-glyph').innerHTML = `<div style="width:80px;height:80px;margin:0 auto">${glyph(r.glyph)}</div>`;
        $('ri-text').textContent = r.text + (r.rarity === 'boss' ? ' (a boss relic)' : '');
        this.openScreen('relicinfo');
    }

    // ------------------------------------------------------------------ between battles
    renderReward(G) {
        const R = G.reward;
        const lore = heroStats(G).lore;
        let h = `<div class="spoil"><i class="gl">${glyph('coin')}</i> <b>${R.gold}</b> gold</div>`;
        h += `<div class="spoil"><i class="gl">${glyph('crown')}</i> ${R.xp} experience · General level ${G.hero.lvl} (${G.hero.xp}/${xpNeed(G)})</div>`;
        if (R.lost) h += `<div class="spoil dim">${R.lost} fell in the battle${R.recovered ? `; ${R.recovered} wounded rejoin the ranks` : ''}.</div>`;
        if (R.relic) h += `<button class="choice${R.relicTaken ? ' taken' : ''}" id="rw-relic" ${R.relicTaken ? 'disabled' : ''}><span class="cg">${glyph(RELICS[R.relic].glyph)}</span><span><b>${esc(RELICS[R.relic].name)}</b><small>${esc(RELICS[R.relic].text)}</small></span></button>`;
        if (!R.cardTaken) {
            h += '<h3>Choose an order for your deck</h3><div class="rewardcards">';
            h += R.cards.map((id, i) => this.cardHTML({ uid: null, id, up: false }, { lore, tag: 'button', idx: i })).join('');
            h += '</div><div style="text-align:center"><button class="btn small" id="rw-skip">Skip the card</button></div>';
        } else h += '<p class="dim" style="text-align:center">Your deck is set.</p>';
        $('reward-body').innerHTML = h;
    }

    renderBoon(G) {
        $('boon-lvl').textContent = `General level ${G.hero.lvl}. Choose a boon.`;
        $('boon-list').innerHTML = G.boon.opts.map((k, i) => `<button class="choice" data-i="${i}"><span class="cg">${glyph(BOON_GLYPH[k])}</span><span><b>${esc(BOONS[k].name)}</b><small>${esc(BOONS[k].text)}</small></span></button>`).join('');
    }

    renderBossRelic(G) {
        $('bossrelic-list').innerHTML = G.bossrelic.opts.map((k, i) => `<button class="choice" data-i="${i}"><span class="cg">${glyph(RELICS[k].glyph)}</span><span><b>${esc(RELICS[k].name)}</b><small>${esc(RELICS[k].text)}</small></span></button>`).join('');
    }

    renderDwelling(G) {
        const O = G.offer;
        $('dw-title').textContent = 'A Dwelling';
        $('dw-sub').textContent = `Creatures here will march for gold. Your legion has ${G.army.length} of ${armyMax(G)} stacks; recruits of a kind you already field join that stack.`;
        $('dw-gold').textContent = G.gold;
        $('dw-list').innerHTML = O.stock.map((s) => {
            const c = CREATURES[s.key];
            const p = priceOf(G, s.key);
            const own = G.army.find((a) => a.key === s.key);
            const max = Math.min(s.n, Math.floor(G.gold / p));
            const full = !own && G.army.length >= armyMax(G);
            const b = (n, label) => `<button class="btn" data-recruit="${s.key}" data-n="${n}" ${n < 1 || n > max || full ? 'disabled' : ''}>${label}</button>`;
            return `<div class="creature"><img alt="" src="${this.portrait(s.key, 'p')}"><div>
                <h4>${esc(c.name)} <span class="dim">· tier ${c.tier}</span></h4>
                <div class="meta">${esc(c.blurb)}</div>
                <div class="stats">Health ${c.hp} · Dmg ${c.dmg} · Atk ${c.atk} · Def ${c.def} · Spd ${c.spd}${c.rng ? ' · shoots' : ''}${c.fly ? ' · flies' : ''}</div>
                <div class="stats">Brings <b>${esc(CARDS[c.sig].name)}</b>. ${own ? `You field ${own.count}.` : ''}</div>
                <div class="buy"><span class="price">${p}g each</span> · <span>${s.n} here</span> ${b(1, '+1')} ${b(Math.min(5, max), '+5')} ${b(max, `All I can (${max})`)}</div>
                ${full ? '<div class="dim">Your legion is full: dismiss a stack to take a new kind.</div>' : ''}
            </div></div>`;
        }).join('');
    }

    renderShop(G) {
        const S = G.shop;
        const lore = heroStats(G).lore;
        $('shop-gold').textContent = G.gold;
        let h = '<h3>Orders</h3><div class="shopcards">';
        h += S.cards.map((c, i) => `<div class="shopitem${c.sold ? ' sold' : ''}">${this.cardHTML({ uid: null, id: c.id, up: false }, { lore, tag: 'button', idx: i, cls: G.gold < c.price ? 'no' : '' }).replace('class="card', 'data-buy="card" class="card')}<span class="price">${c.price}g</span></div>`).join('');
        h += '</div><h3>Oddments</h3><div class="choices">';
        h += S.relics.map((r, i) => `<button class="choice${r.sold ? ' taken' : ''}" data-buyrelic="${i}" ${r.sold || G.gold < r.price ? 'disabled' : ''}><span class="cg">${glyph(RELICS[r.id].glyph)}</span><span><b>${esc(RELICS[r.id].name)} · <span class="price">${r.price}g</span></b><small>${esc(RELICS[r.id].text)}</small></span></button>`).join('');
        h += `<button class="choice" id="shop-remove" ${S.removed || G.gold < G.removeCost ? 'disabled' : ''}><span class="cg">${glyph('quill')}</span><span><b>Erase a card · <span class="price">${G.removeCost}g</span></b><small>${S.removed ? 'The monks have done their one erasure here.' : 'Scrape one order out of your deck for good.'}</small></span></button>`;
        h += '</div>';
        $('shop-body').innerHTML = h;
    }

    renderCamp(G) {
        const C = G.camp;
        const missing = G.army.reduce((n, a) => n + (a.full - a.count), 0);
        const f = G.relics.includes('grail') ? 0.25 : 0.5;
        const raise = G.army.reduce((n, a) => n + Math.ceil((a.full - a.count) * f), 0);
        if (C.done) {
            $('camp-body').innerHTML = `<p>${C.done === 'rest' ? `The legion rests. ${C.raised} of the wounded are fit to fight again.` : 'By firelight you inscribe your orders anew.'}</p>`;
            $('btn-camp-leave').hidden = false;
            return;
        }
        $('btn-camp-leave').hidden = true;
        $('camp-body').innerHTML = `
            <button class="choice" id="camp-rest"><span class="cg">${glyph('fire')}</span><span><b>Rest</b><small>${missing ? `Half the missing return: about ${raise} of ${missing}.` : 'The legion is at full strength; resting does nothing.'}</small></span></button>
            <button class="choice" id="camp-inscribe" ${G.deck.some(canUpgrade) ? '' : 'disabled'}><span class="cg">${glyph('quill')}</span><span><b>Inscribe</b><small>Improve one card in your deck for good.</small></span></button>`;
    }

    renderEvent(G) {
        const E = G.event, ev = EVENTS[E.id];
        $('ev-title').textContent = ev.title;
        $('ev-text').textContent = ev.text;
        $('ev-opts').innerHTML = ev.opts.map((o, i) => `<button class="choice" data-i="${i}" ${E.result || (o.gold && G.gold < o.gold) ? 'disabled' : ''}${E.chose === i ? ' style="outline:3px solid #c8901e"' : ''}><span class="num">${i + 1}</span><span><b>${esc(o.label)}</b>${o.gold && G.gold < o.gold ? '<small>You cannot afford it.</small>' : ''}</span></button>`).join('');
        const r = $('ev-result');
        r.hidden = !E.result;
        r.textContent = E.result || '';
        $('btn-ev-go').hidden = !E.result;
        $('btn-ev-go').textContent = E.fight ? 'To arms!' : 'Continue';
    }

    renderTreasure(G) {
        const T = G.treasure;
        $('treasure-body').innerHTML = `<p>The chest opens with a groan.</p><div class="spoil"><i class="gl">${glyph('coin')}</i> <b>${T.gold}</b> gold</div>` +
            (T.relic ? `<div class="choice taken" style="opacity:1"><span class="cg">${glyph(RELICS[T.relic].glyph)}</span><span><b>${esc(RELICS[T.relic].name)}</b><small>${esc(RELICS[T.relic].text)}</small></span></div>` : '<p class="dim">Nothing else but cobwebs.</p>');
    }

    renderEnd(G, id, score) {
        const s = G.stats;
        $(id + '-body').innerHTML = `<p class="drop">${id === 'victory'
            ? 'Ashmaw the Red falls from the Cinder Throne with a sound like a collapsing mountain. The legion that marched from the Gloaming Marches stands in the ash, fewer than it was, and far stranger. The scribes will need a new book.'
            : `The legion broke in ${ACT_INFO[G.act].name}. Somewhere a scribe closes the book on it, and opens a fresh one.`}</p>
            <table><tr><td>Floors marched</td><td>${s.floors}</td></tr><tr><td>Battles won</td><td>${s.battles} (${s.elites} lairs, ${s.bosses} bosses)</td></tr>
            <tr><td>Foes slain</td><td>${s.slain}</td></tr><tr><td>Creatures recruited</td><td>${s.recruited}</td></tr><tr><td>Orders given</td><td>${s.cards}</td></tr>
            <tr><td>General's level</td><td>${G.hero.lvl}</td></tr><tr><td>Score</td><td><b>${score}</b></td></tr></table>`;
    }

    renderArmy(G, { dismiss = false } = {}) {
        const h = heroStats(G);
        $('army-hero').innerHTML = `<div class="herobox"><span><b>General</b> lv ${G.hero.lvl} (${G.hero.xp}/${xpNeed(G)} xp)</span><span>Attack +${h.atk}</span><span>Defence +${h.def}</span><span>Lore ${h.lore}</span><span>${G.army.length}/${armyMax(G)} stacks</span></div>`;
        $('army-list').innerHTML = G.army.map((a, i) => {
            const c = CREATURES[a.key];
            return `<div class="armyrow"><img alt="" src="${this.portrait(a.key, 'p')}"><div><b>${esc(c.name)}</b> · <b>${a.count}</b> / ${a.full}
                <div class="dim" style="font-size:13px">Health ${c.hp} · Dmg ${c.dmg} · Atk ${c.atk + h.atk} · Def ${c.def + h.def} · Spd ${c.spd}${c.rng ? ' · shoots' : ''}${c.fly ? ' · flies' : ''} · ${esc(CARDS[c.sig].name)}</div>
                <div class="bar"><i style="width:${Math.round(a.count / Math.max(1, a.full) * 100)}%"></i></div></div>
                ${dismiss && G.army.length > 1 ? `<button class="btn small danger" data-dismiss="${i}">Dismiss</button>` : '<span></span>'}</div>`;
        }).join('');
    }

    /** The deck, as a grid. mode: 'view' | 'remove' | 'upgrade' | 'dupe' | 'draw' | 'discard'. */
    renderDeck(G, mode = 'view', pile = null) {
        const lore = heroStats(G).lore;
        const titles = { view: 'Your Deck', remove: 'Erase a Card', upgrade: 'Inscribe a Card', dupe: 'Copy a Card', draw: 'Draw Pile', discard: 'Discard Pile' };
        const subs = { view: `${G.deck.length} orders.`, remove: 'Choose an order to scrape out of the deck for good. Signature cards leave only with their creatures.', upgrade: 'Choose an order to improve. Its inscribed text is shown.', dupe: 'Choose an order to copy.', draw: 'What is left to draw, in no particular order.', discard: 'Played and discarded this battle.' };
        $('dk-title').textContent = titles[mode];
        $('deck-sub').textContent = subs[mode];
        let cards = pile || G.deck;
        if (mode === 'draw') cards = cards.slice().sort((a, b) => a.id.localeCompare(b.id));
        const pickable = (c) => mode === 'remove' ? CARDS[c.id].rarity !== 'sig' : mode === 'upgrade' ? canUpgrade(c) : mode === 'dupe' ? CARDS[c.id].rarity !== 'sig' && CARDS[c.id].kind !== 'curse' : false;
        $('deck-grid').innerHTML = cards.map((c) => {
            const show = mode === 'upgrade' && canUpgrade(c) ? { ...c, up: true } : c;
            const can = pickable(c);
            return this.cardHTML(show, { lore, tag: can ? 'button' : 'div', cls: mode !== 'view' && !['draw', 'discard'].includes(mode) && !can ? 'no' : '' });
        }).join('');
        const p = G.pick;
        $('btn-deck-close').textContent = p ? (p.free ? 'Must choose' : 'Cancel') : 'Close';
        $('btn-deck-close').disabled = !!(p && p.free);
    }
}

export { glyphURL, INTENT_GLYPH };
