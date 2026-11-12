// Panels: inventory (with Ember's pack), skills (the two mastery trees), character, the merchant, the chronicler,
// the waystone, the stash, the rift obelisk and the shrine of oaths. Every change goes through act() via `cmd`.

import { SLOTS, SLOT_NAMES, BASES, RARITIES, LEGENDARIES, SETS, GEMS, GEM_GRADES, AFFIXES } from '../sim/data/items.js';
import { SKILLS, SKILLS_BY_MASTERY, MASTERIES, TIER_RANK, HYBRIDS, hybridKey, skillText, CLASSES } from '../sim/data/masteries.js';
import { AREAS, CAMPAIGN, NPCS } from '../sim/data/world.js';
import { SECOND_MASTERY_AT } from '../config.js';
import { affixText, sellPrice, slotOf } from '../sim/loot.js';
import { recompute, canLearn } from '../sim/stats.js';
import { itemIcon, skillIcon, masteryIcon } from './icons.js';
import { questText } from './ui.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Panels {
    constructor({ ui, audio, cmd }) {
        this.ui = ui; this.audio = audio; this.cmd = cmd;
        this.kind = null; this.sel = null; this.skSel = null; this.G = null; this.tab = 'bag';
        ui.onPanelClosed = () => { this.kind = null; this.hideTip(); };
        $('panel-body').addEventListener('pointerleave', () => this.hideTip());
    }

    open(kind, G) {
        this.kind = kind; this.G = G; this.sel = null;
        this.render();
        this.ui.openScreen('panel');
        this.audio.ui('open');
    }
    toggle(kind, G) { if (this.kind === kind && this.ui.top() === 'panel') this.ui.closeScreen('panel'); else this.open(kind, G); }
    refresh(G) { this.G = G; if (this.kind && this.ui.top() === 'panel') this.render(); }

    do(c) { const r = this.cmd(c); this.render(); return r; }

    render() {
        const G = this.G;
        const title = { inventory: 'Inventory', skills: 'Skills', character: 'Character', merchant: 'Ysolde the Merchant', chronicler: 'Old Heron', waystone: 'Waystone', stash: 'Stash', obelisk: 'Rift Obelisk', shrine: 'Shrine of Oaths' }[this.kind];
        $('panel-title').textContent = title;
        const body = $('panel-body');
        body.innerHTML = this[this.kind](G);
        // wire up
        for (const el of body.querySelectorAll('[data-item]')) {
            const id = +el.dataset.item;
            el.addEventListener('pointerenter', () => this.showTip(G, id, el));
            el.addEventListener('click', () => { this.sel = this.sel === id ? null : id; this.audio.ui('click'); this.render(); });
        }
        for (const el of body.querySelectorAll('[data-eq]')) el.addEventListener('click', () => { this.do({ t: 'unequip', slot: el.dataset.eq }); });
        for (const el of body.querySelectorAll('[data-do]')) el.addEventListener('click', () => {
            const c = JSON.parse(el.dataset.do);
            this.audio.ui('click');
            this.do(c);
            if (c.t === 'equip' || c.t === 'sell' || c.t === 'drop' || c.t === 'toPet' || c.t === 'fromPet' || c.t === 'toStash' || c.t === 'fromStash') this.sel = null;
            this.render();
            if (['travel', 'riftOpen', 'pickMastery', 'petTown'].includes(c.t)) this.ui.closeScreen('panel');
        });
        for (const el of body.querySelectorAll('[data-tab]')) el.addEventListener('click', () => { this.tab = el.dataset.tab; this.render(); });
        for (const el of body.querySelectorAll('[data-sk]')) {
            el.addEventListener('click', () => { this.skSel = el.dataset.sk; this.audio.ui('click'); this.render(); });
        }
        for (const el of body.querySelectorAll('[data-slotto]')) el.addEventListener('click', () => { this.do({ t: 'slot', i: +el.dataset.slotto, id: this.skSel }); });
    }

    // ------------------------------------------------------------------ items
    cellHtml(G, id, extra = '') {
        const it = id && G.items[id];
        if (!it) return `<button class="cell" ${extra} aria-label="empty"></button>`;
        const socks = it.sockets?.length ? `<span class="sock">${it.sockets.map((s) => (s ? '◆' : '◇')).join('')}</span>` : '';
        return `<button class="cell r-${it.rarity} ${this.sel === id ? 'sel' : ''}" data-item="${id}" ${extra} aria-label="${esc(it.name)}"><span class="ic" style="${itemIcon(it)}"></span>${socks}</button>`;
    }

    tipHtml(G, it) {
        if (it.gem) {
            const g = GEMS[it.gem];
            return `<div class="n" style="color:${g.color}">${esc(it.name)}</div><div class="b">Socket it into an item.</div>
                <div>In a weapon: ${AFFIXES[g.weapon.k].text.replace('{v}', g.weapon.v[it.grade])}</div>
                <div>In armour or jewellery: ${AFFIXES[g.armor.k].text.replace('{v}', g.armor.v[it.grade])}</div>
                <div class="b">Three of a grade combine into the next at Ysolde's.</div>`;
        }
        const R = RARITIES[it.rarity];
        const B = BASES[it.base];
        let h = `<div class="n" style="color:${R.color}">${esc(it.name)}</div><div class="b">${R.name} ${B.name} · item level ${it.ilvl}</div>`;
        if (it.dmg) h += `<div>${it.dmg[0]}–${it.dmg[1]} damage · ${it.spd} attacks a second</div>`;
        if (it.armor) h += `<div>${it.armor} armour</div>`;
        if (B.implicit) h += `<div class="b">${AFFIXES[B.implicit.k].text.replace('{v}', B.implicit.v)}</div>`;
        for (const a of it.affixes) h += `<div>${esc(affixText(a))}<span class="q" title="roll quality"><i style="width:${Math.round((a.q ?? 0.5) * 100)}%"></i></span></div>`;
        for (const s of it.sockets || []) h += `<div class="b">${s ? '◆ ' + esc(G.items[s]?.name || '') : '◇ empty socket'}</div>`;
        if (it.uniq) h += `<div class="pw">${esc(LEGENDARIES[it.uniq].text)}</div>`;
        if (it.set) {
            const S = SETS[it.set], have = (G.player.stats.setCount || {})[it.set] || 0;
            h += `<div class="st">${esc(S.name)} (${have}/4)</div><div class="st">2: ${esc(S.text[2])}</div><div class="st">4: ${esc(S.text[4])}</div>`;
        }
        // compare with what is worn: the change in sheet damage and toughness
        const P = G.player;
        const slot = slotOf(it.base);
        if (!Object.values(P.equip).includes(it.id)) {
            // try it on a copy of the player, never the live one (the view must not change the sim)
            const s0 = P.stats;
            const target = slot === 'ring' ? (P.equip.ring1 ? (P.equip.ring2 ? 'ring1' : 'ring2') : 'ring1') : slot;
            const T = { player: structuredClone({ ...P, stats: undefined }), items: G.items };
            T.player.equip[target] = it.id;
            recompute(T);
            const s1 = { dps: T.player.stats.dps, t: T.player.stats.toughness, life: T.player.stats.maxLife };
            const d = (a, b, label) => { const x = Math.round(b - a); return x ? `<span class="${x > 0 ? 'up' : 'down'}">${x > 0 ? '▲' : '▼'} ${Math.abs(x)} ${label}</span> ` : ''; };
            h += `<div style="margin-top:4px">${d(s0.dps, s1.dps, 'damage') + d(s0.toughness, s1.t, 'toughness') + d(s0.maxLife, s1.life, 'life') || '<span class="b">no change</span>'}</div>`;
        }
        h += `<div class="b">Sells for ${sellPrice(it)} gold</div>`;
        return h;
    }

    showTip(G, id, el) {
        const it = G.items[id];
        if (!it) return;
        const tip = $('tip');
        tip.innerHTML = this.tipHtml(G, it);
        tip.hidden = false;
        const r = el.getBoundingClientRect();
        const w = tip.offsetWidth, h = tip.offsetHeight;
        let x = r.right + 8, y = r.top;
        if (x + w > innerWidth - 8) x = r.left - w - 8;
        if (x < 8) x = 8;
        if (y + h > innerHeight - 8) y = innerHeight - h - 8;
        tip.style.left = `${x}px`; tip.style.top = `${Math.max(8, y)}px`;
    }
    hideTip() { $('tip').hidden = true; }

    inventory(G) {
        const P = G.player, town = G.area.kind === 'town';
        let eq = '<div class="equip">';
        for (const s of SLOTS) eq += `<div>${this.cellHtml(G, P.equip[s], P.equip[s] ? '' : `data-eqempty="${s}"`)}<div class="slotname">${SLOT_NAMES[s]}</div></div>`;
        eq += '</div>';
        const bag = this.tab === 'pet' ? G.pet.bag : P.bag;
        let grid = `<div class="grid ${this.tab === 'pet' ? 'pet' : ''}">`;
        for (const id of bag) grid += this.cellHtml(G, id);
        grid += '</div>';
        const sel = this.sel && G.items[this.sel];
        let acts = '';
        if (sel) {
            const inBag = P.bag.includes(sel.id), inPet = G.pet.bag.includes(sel.id), worn = Object.values(P.equip).includes(sel.id);
            const A = (label, c, dis = false) => `<button class="btn small" ${dis ? 'disabled' : ''} data-do='${JSON.stringify(c)}'>${label}</button>`;
            if (!sel.gem && !worn) acts += A('Equip', { t: 'equip', id: sel.id });
            if (worn) acts += A('Take off', { t: 'unequip', slot: Object.entries(P.equip).find(([, v]) => v === sel.id)[0] });
            if (inBag) acts += A('To Ember', { t: 'toPet', id: sel.id }, G.pet.state === 'away');
            if (inPet) acts += A('To bag', { t: 'fromPet', id: sel.id });
            if (town && !worn) acts += A(`Sell (${sellPrice(sel)}g)`, { t: 'sell', id: sel.id });
            if (!worn) acts += A('Drop', { t: 'drop', id: sel.id });
            if (sel.gem) for (const s of SLOTS) { const w = P.equip[s] && G.items[P.equip[s]]; if (w?.sockets?.includes(null)) acts += A(`Socket into ${esc(w.name)}`, { t: 'socket', item: w.id, gem: sel.id }); }
        }
        return `<div class="inv"><div>${eq}
            <div class="sub">Gold: ${P.gold.toLocaleString()}</div>
            <div class="actions">
                <button class="btn small" data-do='{"t":"petTown"}' ${G.pet.state !== 'follow' && G.pet.state !== 'fight' ? 'disabled' : ''}>Send Ember to sell (${G.pet.bag.filter(Boolean).length})</button>
                ${town ? `<button class="btn small" data-do='{"t":"sellJunk"}'>Sell all junk</button>` : ''}
            </div>
            <div class="sub">Loot filter: ${{ all: 'everything', magic: 'magic+', rare: 'rare+', legendary: 'legendary only' }[P.filter]}</div>
            <div class="actions">${['all', 'magic', 'rare', 'legendary'].map((l) => `<button class="btn small" ${P.filter === l ? 'disabled' : ''} data-do='{"t":"filter","level":"${l}"}'>${l}</button>`).join('')}</div>
        </div><div>
            <div class="actions"><button class="btn small" data-tab="bag" ${this.tab === 'bag' ? 'disabled' : ''}>Your bag (${P.bag.filter(Boolean).length}/40)</button>
            <button class="btn small" data-tab="pet" ${this.tab === 'pet' ? 'disabled' : ''}>Ember's pack (${G.pet.bag.filter(Boolean).length}/16)</button></div>
            ${grid}
            <div class="actions">${acts || '<span class="dim">Select an item to equip, move, sell or socket it.</span>'}</div>
        </div></div>`;
    }

    // ------------------------------------------------------------------ skills
    skills(G) {
        const P = G.player;
        let h = `<div class="dim">${P.unspent.skill} skill point${P.unspent.skill === 1 ? '' : 's'} to spend. Mastery ranks unlock tiers at 1, 4, 7 and 10.</div><div class="trees">`;
        for (const m of P.masteries) {
            if (!m) continue;
            const M = MASTERIES[m], r = P.bar[m] || 0;
            h += `<div class="tree"><h3 style="color:${M.color}">${M.name}</h3><div class="dim">${M.blurb}</div>
                <div class="barrow"><span class="ic" style="width:32px;height:32px;flex:none;${masteryIcon(m)}"></span><div class="bar"><i style="width:${r * 10}%"></i></div><b>${r}/10</b>
                <button class="btn small" data-do='{"t":"learnBar","m":"${m}"}' ${!P.unspent.skill || r >= 10 ? 'disabled' : ''}>+</button></div>`;
            for (let t = 1; t <= 4; t++) {
                h += `<div class="tier"><span class="t">${['', 'I', 'II', 'III', 'IV'][t]}</span>`;
                for (const id of SKILLS_BY_MASTERY[m].filter((k) => SKILLS[k].tier === t)) {
                    const S = SKILLS[id], rk = P.ranks[id] || 0, locked = r < TIER_RANK[t];
                    h += `<button class="sk ${locked ? 'locked' : ''} ${rk ? '' : 'zero'} ${S.kind === 'passive' ? 'passive' : ''} ${this.skSel === id ? 'sel' : ''}" data-sk="${id}" aria-label="${S.name}" style="${this.skSel === id ? 'outline:2px solid var(--gold)' : ''}"><span class="ic" style="${skillIcon(id)}"></span><span class="r">${rk}/5</span></button>`;
                }
                h += '</div>';
            }
            h += '</div>';
        }
        h += '</div>';
        if (P.synergy) {
            const Hy = HYBRIDS[hybridKey(P.masteries[0], P.masteries[1])];
            h += `<div class="synergy"><b style="color:var(--set)">${Hy.name}</b>: ${esc(Hy.power)}</div>`;
        } else if (P.level < SECOND_MASTERY_AT) h += `<div class="synergy dim">At level ${SECOND_MASTERY_AT}, swear a second oath at the Shrine of Oaths in town.</div>`;
        else h += `<div class="synergy">Your second oath is waiting at the Shrine of Oaths in town.</div>`;
        if (this.skSel) {
            const S = SKILLS[this.skSel], rk = P.ranks[this.skSel] || 0, why = canLearn(G, this.skSel);
            h += `<div class="skinfo"><b>${S.name}</b> <span class="dim">${S.kind === 'passive' ? 'passive' : `${MASTERIES[S.mastery].res}${S.cost ? ' ' + S.cost : ''}${S.cd ? ` · ${S.cd} s cooldown` : ''}`}</span><br>${esc(skillText(this.skSel, Math.max(1, rk)))}
                ${rk && rk < 5 ? `<br><span class="dim">Next rank: ${esc(skillText(this.skSel, rk + 1))}</span>` : ''}
                <div class="actions"><button class="btn small" data-do='{"t":"learnSkill","id":"${this.skSel}"}' ${why ? 'disabled' : ''}>${rk ? 'Rank up' : 'Learn'}</button>${why ? `<span class="dim">${esc(why)}</span>` : ''}
                ${S.kind === 'active' && rk ? [0, 1, 2, 3, 4].map((i) => `<button class="btn small" data-slotto="${i}">Slot ${i + 1}${P.slots[i] === this.skSel ? ' ✓' : ''}</button>`).join('') : ''}</div></div>`;
        } else h += `<div class="skinfo dim">Pick a skill to read it, learn it or put it on a slot.</div>`;
        return h;
    }

    // ------------------------------------------------------------------ character
    character(G) {
        const P = G.player, s = P.stats, C = CLASSES[P.cls];
        const hy = P.synergy ? HYBRIDS[hybridKey(P.masteries[0], P.masteries[1])].name : C.name;
        const row = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
        let attrs = '';
        for (const k of ['might', 'cunning', 'spirit', 'vitality']) attrs += `<div class="row"><span>${k[0].toUpperCase() + k.slice(1)} <b>${s[k]}</b></span><button class="btn small" data-do='{"t":"attr","k":"${k}"}' ${P.unspent.attr ? '' : 'disabled'}>+</button></div>`;
        return `<div class="sub">${esc(hy)} · level ${P.level}${P.ascension ? ` · ascension ${P.ascension}` : ''}</div>
            <div class="dim">${P.unspent.attr} attribute point${P.unspent.attr === 1 ? '' : 's'}. Might: physical damage and armour. Cunning: crit and attack speed. Spirit: lightning, shadow and mana. Vitality: life.</div>
            <div class="attrs">${attrs}</div>
            <div class="stats">${row('Life', s.maxLife)}${row('Sheet damage', s.dps)}${row('Weapon', `${s.weapon.dmg[0]}–${s.weapon.dmg[1]}`)}${row('Attacks a second', s.atkRate.toFixed(2))}
            ${row('Critical chance', s.critPct.toFixed(1) + '%')}${row('Critical damage', '+' + s.critDmgPct + '%')}${row('Physical', '+' + s.physPct + '%')}${row('Lightning', '+' + s.lightningPct + '%')}
            ${row('Shadow', '+' + s.shadowPct + '%')}${row('Armour', s.armorTotal)}${row('Resist all', s.res + '%')}${row('Life per hit', s.lifeOnHit)}
            ${row('Cooldowns', '−' + s.cdrPct + '%')}${row('Move speed', '+' + s.movePct + '%')}${row('Magic find', '+' + s.magicFind + '%')}${row('Gold find', '+' + s.goldFind + '%')}
            ${row('Kills', G.stats.kills)}${row('Deaths', G.stats.deaths)}${row('Deepest rift', P.riftBest)}${row('Gold', P.gold)}</div>`;
    }

    // ------------------------------------------------------------------ town people and things
    merchant(G) {
        const P = G.player, n = NPCS.ysolde;
        const gems = {};
        for (const id of P.bag) { const it = id && G.items[id]; if (it?.gem) { const k = it.gem + it.grade; gems[k] = gems[k] || { gem: it.gem, grade: it.grade, n: 0 }; gems[k].n++; } }
        const combos = Object.values(gems).filter((g) => g.n >= 3 && g.grade < 3).map((g) => `<button class="btn small" data-do='{"t":"combine","gem":"${g.gem}","grade":${g.grade}}'>Combine 3 ${GEM_GRADES[g.grade]} ${GEMS[g.gem].name} (${50 * (g.grade + 1)}g)</button>`).join('');
        const sockets = SLOTS.map((s) => P.equip[s] && G.items[P.equip[s]]).filter((it) => it && ({ weapon: 2, helm: 1, chest: 2, amulet: 1 }[BASES[it.base].slot] || 0) > it.sockets.length)
            .map((it) => `<button class="btn small" data-do='{"t":"addSocket","item":${it.id}}'>Add a socket to ${esc(it.name)} (${Math.round(500 * it.ilvl / 10)}g)</button>`).join('');
        const price = 150 * P.level;
        return `<div class="npc"><img src="art/portrait-ysolde.webp" alt=""><div><p>"${esc(n.lines[(G.stats.kills + P.level) % n.lines.length])}"</p><div class="sub">Gold: ${P.gold.toLocaleString()}</div></div></div>
            <div class="actions"><button class="btn" data-do='{"t":"sellJunk"}'>Sell all junk (commons and magics)</button></div>
            <div class="sub">Gamble (${price}g): an unknown item of your choice of kind</div>
            <div class="actions">${['sword', 'axe', 'mace', 'staff', 'wand', 'helm', 'chest', 'gloves', 'boots', 'amulet', 'ring'].map((b) => `<button class="btn small" ${P.gold < price ? 'disabled' : ''} data-do='{"t":"gamble","base":"${b}"}'>${BASES[b].name}</button>`).join('')}</div>
            <div class="sub">Gems</div><div class="actions">${combos || '<span class="dim">Bring three gems of one kind and grade.</span>'}</div>
            <div class="sub">Sockets</div><div class="actions">${sockets || '<span class="dim">Nothing you wear can take another socket.</span>'}</div>
            <div class="dim" style="margin-top:8px">Open your inventory (I) to sell single items.</div>`;
    }

    chronicler(G) {
        const P = G.player, n = NPCS.heron;
        const price = P.level <= 10 ? 0 : 100 * P.level;
        return `<div class="npc"><img src="art/portrait-heron.webp" alt=""><div><p>"${esc(n.lines[P.level % n.lines.length])}"</p></div></div>
            <div class="sub">The chronicle</div><p>${esc(questText(G))}</p>
            <div class="sub">Reset your skills</div><p class="dim">Every skill point back, your oaths kept. ${price ? price + ' gold' : 'Free until level 10'}.</p>
            <div class="actions"><button class="btn small" data-do='{"t":"respec"}' ${P.gold < price ? 'disabled' : ''}>Reset skills</button></div>`;
    }

    waystone(G) {
        const P = G.player;
        const list = ['town', ...CAMPAIGN].filter((a) => a !== G.area.id && (a === 'town' || P.waystones.includes(a)));
        return `<p class="dim">Travel to any waystone you have touched.</p><div class="list">${list.map((a) => `<button class="btn" data-do='{"t":"travel","area":"${a}"}'>${AREAS[a].name}</button>`).join('') || '<span class="dim">No other waystones yet.</span>'}</div>`;
    }

    stash(G) {
        const P = G.player;
        const sel = this.sel && G.items[this.sel];
        let h = '<div class="sub">Stash</div><div class="grid">';
        for (const id of P.stash) h += this.cellHtml(G, id);
        h += '</div><div class="sub">Your bag</div><div class="grid">';
        for (const id of P.bag) h += this.cellHtml(G, id);
        h += '</div>';
        if (sel) h += `<div class="actions">${P.bag.includes(sel.id) ? `<button class="btn small" data-do='{"t":"toStash","id":${sel.id}}'>Put in the stash</button>` : `<button class="btn small" data-do='{"t":"fromStash","id":${sel.id}}'>Take</button>`}</div>`;
        return h;
    }

    obelisk(G) {
        const P = G.player;
        if (!P.bossesKilled.includes('kolossar')) return '<p>The obelisk is dark. It will wake when Kolossar is bound.</p>';
        const tiers = [];
        for (let t = 1; t <= P.riftBest + 1; t++) tiers.push(t);
        return `<img src="art/card-rifts.webp" alt="" style="width:100%;border-radius:8px"><p>Fill the rift's hunger by killing, slay its Guardian, and the next tier opens. There is no last tier.
            Deepest cleared: <b>${P.riftBest}</b>.</p><div class="actions">${tiers.slice(-8).map((t) => `<button class="btn ${t === P.riftBest + 1 ? 'primary' : ''}" data-do='{"t":"riftOpen","tier":${t}}'>Tier ${t}</button>`).join('')}</div>`;
    }

    shrine(G) {
        const P = G.player;
        if (P.masteries[1]) return `<p>You have sworn two oaths: ${MASTERIES[P.masteries[0]].name} and ${MASTERIES[P.masteries[1]].name}. You are a ${HYBRIDS[hybridKey(P.masteries[0], P.masteries[1])].name}.</p>`;
        if (P.level < SECOND_MASTERY_AT) return `<p>The shrine waits. Come back at level ${SECOND_MASTERY_AT} to swear a second oath.</p>`;
        return `<p>Swear a second oath. It can't be undone. Each pairing makes a hybrid with its own synergy.</p><div class="list">${Object.keys(MASTERIES).filter((m) => m !== P.masteries[0]).map((m) => {
            const Hy = HYBRIDS[hybridKey(P.masteries[0], m)];
            return `<button class="btn" data-do='{"t":"pickMastery","m":"${m}"}' style="text-align:left"><b style="color:${MASTERIES[m].color}">${MASTERIES[m].name}</b> → ${Hy.name}<br><span class="dim" style="font-family:var(--sans)">${esc(Hy.power)}</span></button>`;
        }).join('')}</div>`;
    }
}

