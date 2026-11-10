// EMBERSPIRE — the DOM layer: the town, its buildings, the battle commands, rewards and dialogue.
// Reads G and sends commands through `send(cmd)` (main.js runs act(), drains events, saves). Never writes G.

import { VERSION, PARTY_MAX, EVOLVE_LV, ASCEND_LV, AUTO_NEXT_SECONDS } from './config.js';
import { ART, setIcon, iconEl, img } from './assets.js';
import { HEROES, HERO, CLASSES, SKILLS, STATUS } from './sim/data/heroes.js';
import { BIOMES, MONSTERS, biomeOf } from './sim/data/biomes.js';
import { GEAR, GOODS, MATS, UNIQUES, RARITY, AFFIXES, UI_ICON, WEAPON_TYPES, MAX_PLUS } from './sim/data/items.js';
import { NPCS, GREETINGS, SCENES, BOND_RANKS, BOND_XP, RECRUIT_LINES, BLESSINGS, DAILY } from './sim/data/story.js';
import {
    joined, checkpoints, recruitable, recruitCost, skillList, upgradeCost, maxPlus, reforgeCost, gearPrice, salvageValue,
    equippedBy, canEquip, slotOf, boardQuests, questProgress, shardPrice, baseClass, partyHealth,
} from './sim/game.js';
import { heroStats, gearStats, gearName, xpNext, power, uniqueFx, rankOfFloor } from './sim/stats.js';
import { options, targetsFor, skillFor, unit as bunit } from './sim/battle.js';
import { MONSTER_ACTS } from './sim/data/acts.js';

const $ = (id) => document.getElementById(id);

/** h('div.cls#id', { attrs, on: { click } }, ...children) */
function h(sel, props = {}, ...kids) {
    const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement(m[1] || 'div');
    for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) {
        if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
    for (const [k, v] of Object.entries(props || {})) {
        if (v == null || v === false) continue;
        if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
        else if (k === 'style') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k in el && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
}

export function fmt(n) {
    n = Math.floor(n);
    if (n < 100000) return n.toLocaleString('en-US');
    const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
    let u = -1;
    while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
    return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + units[u];
}

const RES_ICON = { gold: ['misc', 12], ore: ['goods', 13], shard: ['goods', 14], core: ['goods', 15] };
const goodIcon = (id) => GOODS[id]?.icon || MATS[id]?.icon || RES_ICON[id];
const goodName = (id) => GOODS[id]?.name || MATS[id]?.name || (id === 'gold' ? 'Gold' : id);
const gearIcon = (it) => (it.u ? UNIQUES[it.u].icon : GEAR[it.type].icon);
const por = (id) => ART.por(id);
const heroSprite = (G, id) => ART.hero(id, G.heroes[id].tier >= 2);
const className = (G, id) => {
    const hh = G.heroes[id];
    return hh.tier >= 3 ? CLASSES[hh.cls].asc : CLASSES[hh.cls].name;
};
const PLACE_BG = { gate: 'title', tavern: 'tavern', forge: 'smithy', market: 'shop', guild: 'guild', temple: 'temple', party: 'tavern', treasury: 'guild', bestiary: 'library' };
// town greetings play by themselves this many times each, then only on the 🔊 by the portrait
const GREET_AUTO = 3;
const PLACE_NPC = { gate: 'watcher', tavern: 'bram', forge: 'hilde', market: 'zephyrine', guild: 'corwin', temple: 'amaya', treasury: 'corwin' };

export class UI {
    constructor({ audio, settings, send, onSettings, onDeleteSave, onQuit }) {
        this.audio = audio;
        this.settings = settings;
        this.onSettings = onSettings;
        this.send = send;
        this.stack = [];
        this.place = null;          // which building is open
        this.tab = {};
        this.sel = {};              // selected hero per place
        this.bmenu = 'root';        // battle command sub-menu
        this.pending = null;        // the command waiting for a target
        this.G = null;
        $('version').textContent = 'v' + VERSION;
        setIcon($('ico-gold'), RES_ICON.gold);
        for (const i of document.querySelectorAll('#topbar .ico[data-ico]')) {
            const [s, n] = i.dataset.ico.split(':');
            if (+n >= 0) setIcon(i, [s, +n]);
        }
        // a press that began outside a modal (the finger that opened it) must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen.modal')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('back'); this.closeTop(); });
        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), speed = $('set-speed'), greet = $('set-greet');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; speed.value = String(settings.speed); greet.value = settings.greet;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, speed: +speed.value, greet: greet.value }); onSettings(settings); };
        for (const el of [sfx, music, voice, speed, greet]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { if (confirm('Delete your saved game? This cannot be undone.')) { onDeleteSave(); this.toast('Saved game deleted.'); } });
        $('set-title').addEventListener('click', () => onQuit());
        $('btn-menu').addEventListener('click', () => { audio.ui('click'); this.openScreen('settings'); });
    }

    // ------------------------------------------------------------ screens
    openScreen(id) {
        const el = $(id);
        el.hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // a screen opened from another appears on top of it
        this.stack.forEach((s, i) => { $(s).style.zIndex = String(($(s).classList.contains('modal') ? 60 : 20) + i); });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { const t = this.top(); if (t && t !== 'town' && t !== 'title') this.closeScreen(t); }
    top() { return this.stack[this.stack.length - 1] || null; }
    modalOpen() { return this.stack.some((s) => $(s).classList.contains('modal')); }
    focusables(id) {
        const root = id === 'battle' ? $('cmds') : $(id);
        return root ? [...root.querySelectorAll('button:not(:disabled), select, input')].filter((b) => !b.hidden && b.getClientRects().length) : [];
    }
    focusFirst(id) {
        const list = this.focusables(id);
        const pref = list.find((b) => b.classList.contains('primary')) || list[0];
        pref?.focus({ preventScroll: true });
    }
    moveFocus(dir, id = this.top()) {
        const list = this.focusables(id);
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        const n = list[(i + dir + list.length) % list.length];
        n.focus();
        n.scrollIntoView({ block: 'nearest' });
        this.audio.ui('move');
    }

    toast(text) {
        const el = h('div.toast', { text });
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 3100);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    }

    setBg(name, evening = false) {
        const bg = $('bg');
        bg.style.backgroundImage = name ? `url(${ART.bg(name)})` : 'none';
        bg.classList.toggle('evening', evening);
        bg.classList.toggle('dim', true);
    }

    // ------------------------------------------------------------ top bar
    topbar(G) {
        $('r-gold').textContent = fmt(G.gold);
        $('r-ore').textContent = fmt(G.inv.ore || 0);
        $('r-shard').textContent = fmt(G.inv.shard || 0);
        $('r-core').textContent = fmt(G.inv.core || 0);
        $('r-day').textContent = G.mode === 'tower' ? `Floor ${G.battle?.floor ?? ''}` : `Day ${G.day} · ${G.phase === 'day' ? 'Morning' : 'Evening'}`;
    }
    showTopbar(on) { $('topbar').hidden = !on; }

    // ------------------------------------------------------------ the town
    renderTown(G) {
        this.G = G;
        const root = $('town');
        root.replaceChildren();
        const evening = G.phase === 'evening';
        const bl = BLESSINGS.find((b) => b.id === G.blessing);
        const claimable = boardQuests(G).filter((q) => questProgress(G, q).done).length;
        const temple = joined(G).filter((id) => skillList(G, id).some((s) => s.can) || (G.heroes[id].tier === 1 && G.heroes[id].lv >= EVOLVE_LV) || (G.heroes[id].tier === 2 && G.heroes[id].lv >= ASCEND_LV)).length;
        const hires = recruitable(G).length;
        const idleGold = Math.floor(G.idle.gold);
        const tip = evening
            ? (G.eveningDone ? 'The fire burns low. Rest when you\'re ready.' : 'Evening in Hearthmere. Spend it with a companion at the tavern, then rest.')
            : G.best === 0 ? 'The Emberspire looms over the square. Your first climb awaits at the Tower Gate.' : `Your best: floor ${G.best}. The tower waits.`;
        const msg = h('div.win.hub-msg', {},
            h('h3', { text: `Hearthmere — Day ${G.day}, ${evening ? 'evening' : 'morning'}` }),
            h('div', { text: tip }),
            bl ? h('div.gold', { style: { marginTop: '4px', fontSize: '14px' }, text: `✦ ${bl.name}: ${bl.desc}` }) : null,
        );
        const btn = (id, label, sub, icon, extra = {}) => h('button.btn.place-btn' + (extra.cls || ''), {
            'data-place': id, disabled: extra.disabled,
            on: { click: () => { this.audio.ui('click'); extra.onClick ? extra.onClick() : this.openPlace(G, id); } },
        }, iconEl(icon, 'big'), h('span', {}, label, h('span.sub', { text: sub })), extra.badge ? h('span.badge', { text: String(extra.badge) }) : null);
        const grid = h('div.hub-grid', {},
            btn('gate', 'Tower Gate', evening ? 'Closed until morning' : `Climb from floor ${checkpoints(G).slice(-1)[0]}`, UI_ICON.tower, { cls: '.gate', disabled: evening }),
            btn('tavern', 'Tavern', evening ? 'Spend the evening' : 'Recruit heroes', UI_ICON.tavern, { badge: evening && !G.eveningDone ? '♥' : hires || null }),
            btn('forge', 'Forge', 'Upgrade & reforge', UI_ICON.forge),
            btn('market', 'Market', 'Supplies & gear', ['goods', 0]),
            btn('guild', 'Guild', 'Quests & bounties', UI_ICON.quest, { badge: claimable || null }),
            btn('temple', 'Temple', 'Skills & evolution', UI_ICON.temple, { badge: temple || null }),
            btn('party', 'Party', `${G.party.length}/${PARTY_MAX} · equipment`, ['gear', 9]),
            btn('treasury', 'Treasury', idleGold > 0 ? `${fmt(idleGold)} gold waiting` : 'Idle income', UI_ICON.hourglass, { badge: idleGold > 0 ? '!' : null }),
            btn('bestiary', 'Bestiary', `${Object.keys(G.seen).length}/${Object.keys(MONSTERS).length} seen`, ['uniques', 2]),
            evening ? btn('rest', 'Rest', 'End the day', UI_ICON.hourglass, { cls: '.primary', onClick: () => this.send({ t: 'rest' }) }) : null,
        );
        root.append(h('div.hub', {}, h('div.hub-head', {}, msg), grid));
        this.setBg('town', evening);
    }

    /** The town greeting when you walk in: by itself for the first GREET_AUTO visits (or every visit, or never, per
     *  Settings), counted in the saved settings so it stays quiet after a reload. The 🔊 by the portrait replays it. */
    greet(npc) {
        const clip = npc === 'watcher' ? 'watcher-gate' : npc;
        const st = this.settings;
        st.greetPlays = st.greetPlays || {};
        const n = st.greetPlays[clip] || 0;
        if (st.greet === 'tap' || (st.greet !== 'every' && n >= GREET_AUTO)) return false;
        if (!this.audio.say(clip, { gap: 2 })) return false;     // not loaded yet, or someone is already talking
        st.greetPlays[clip] = n + 1;
        this.onSettings(st);
        return true;
    }

    /** Show the speaker as busy until the current voice line ends. */
    markSpeaking(btn) {
        btn.classList.add('playing');
        btn.setAttribute('aria-busy', 'true');
        clearTimeout(this._speakTimer);
        this._speakTimer = setTimeout(() => { btn.classList.remove('playing'); btn.removeAttribute('aria-busy'); }, this.audio.voiceLeft() * 1000 + 60);
    }

    openPlace(G, id) {
        this.place = id;
        const npc = PLACE_NPC[id];
        if (npc) this.greet(npc);
        this.renderPlace(G);
        $('town').style.visibility = 'hidden';
        this.openScreen('place');
    }

    renderPlace(G) {
        this.G = G;
        const id = this.place;
        if (!id) return;
        const root = $('place');
        const keepScroll = root.querySelector('.list')?.scrollTop || 0;
        const focusKey = document.activeElement?.dataset?.k;
        root.replaceChildren();
        const npc = PLACE_NPC[id];
        // the bubble shows the recorded line (what the 🔊 plays), and the day's own line under it when it differs
        const voiced = npc ? GREETINGS[npc][0] : null;
        const today = npc ? GREETINGS[npc][(G.day + id.length) % GREETINGS[npc].length] : null;
        const clip = npc === 'watcher' ? 'watcher-gate' : npc;
        // one line at a time: while anyone is talking the speaker dims and taps do nothing (they used to stack voices)
        const speaker = npc ? h('button.speak', { 'data-k': 'speak', 'aria-label': `Hear ${NPCS[npc].name}`, title: `Hear ${NPCS[npc].name}`, on: { click: (e) => { if (this.audio.say(clip, { force: true })) this.markSpeaking(e.currentTarget); } } }, '🔊') : null;
        if (speaker && this.audio.voiceLeft() > 0) this.markSpeaking(speaker);   // the greeting that just played on the way in
        const head = npc ? h('div.npc', {},
            h('div.por', { style: { backgroundImage: `url(${por(npc)})` } },
                speaker),
            h('div.win.say', {}, h('span.who', { text: NPCS[npc].name + ' · ' + NPCS[npc].role }), voiced, today !== voiced ? h('span.today', { text: today }) : null)) : null;
        const panel = h('div.win.panel');
        const back = h('button.btn', { 'data-k': 'back', on: { click: () => { this.audio.ui('back'); this.closePlace(G); } } }, '← Town');
        const titles = { gate: 'The Tower Gate', tavern: 'The Frothy Mug', forge: 'Hilde\'s Forge', market: 'Zephyrine\'s Wares', guild: 'Adventurers\' Guild', temple: 'Temple of the Dawn', party: 'Your Company', treasury: 'Treasury', bestiary: 'Bestiary' };
        panel.append(h('div.row', { style: { minHeight: '0', marginBottom: '6px' } }, h('h2', { style: { margin: 0 }, text: titles[id] }), back));
        this[`p_${id}`](G, panel);
        root.append(h('div.bld', {}, head, panel));
        this.setBg(PLACE_BG[id], G.phase === 'evening');
        const list = root.querySelector('.list');
        if (list) list.scrollTop = keepScroll;
        if (focusKey) root.querySelector(`[data-k="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
    }

    closePlace(G) {
        this.place = null;
        this.closeScreen('place');
        $('town').style.visibility = '';
        this.renderTown(G);
    }

    tabs(id, list) {
        const cur = this.tab[id] || list[0][0];
        return {
            cur,
            el: h('div.tabs', {}, list.map(([k, label, badge]) => h('button.btn.tab' + (k === cur ? '.on' : ''), {
                'data-k': 'tab-' + k,
                on: { click: () => { this.tab[id] = k; this.audio.ui('move'); this.renderPlace(this.G); } },
            }, label, badge ? h('span.badge', { text: String(badge) }) : null))),
        };
    }

    heroPicker(G, place, ids) {
        const cur = ids.includes(this.sel[place]) ? this.sel[place] : ids[0];
        this.sel[place] = cur;
        return {
            cur,
            el: h('div.tabs', {}, ids.map((id) => h('button.btn.tab' + (id === cur ? '.on' : ''), {
                'data-k': 'hero-' + id,
                on: { click: () => { this.sel[place] = id; this.audio.ui('move'); this.renderPlace(this.G); } },
            }, h('i.ico', { style: { backgroundImage: `url(${por(id)})`, backgroundSize: 'cover', borderRadius: '4px' } }), HERO[id].name))),
        };
    }

    // ---- the gate
    p_gate(G, panel) {
        const cps = checkpoints(G);
        const party = G.party.filter((id) => G.heroes[id].joined);
        panel.append(h('p', { text: 'Choose where to begin. Every boss you defeat opens a new starting floor.' }));
        const list = h('div.list');
        for (const f of cps.slice().reverse()) {
            const { biome, cycle } = biomeOf(f);
            list.append(h('div.item', {},
                h('div.grow', {}, h('div.nm', { text: `Floor ${f} — ${cycle ? 'Ascended ' : ''}${biome.name}` }), h('div.meta', { text: biome.intro })),
                h('button.btn' + (f === cps[cps.length - 1] ? '.primary' : ''), {
                    'data-k': 'floor-' + f, disabled: G.phase !== 'day' || !party.length,
                    on: { click: () => this.send({ t: 'enter', floor: f }) },
                }, 'Climb')));
        }
        panel.append(list);
        panel.append(h('div.chips', { style: { marginTop: '8px' } }, party.map((id) => h('span.chip', { text: `${HERO[id].name} Lv ${G.heroes[id].lv}` }))));
    }

    // ---- the tavern
    p_tavern(G, panel) {
        const evening = G.phase === 'evening';
        const t = this.tabs('tavern', [['hire', 'Heroes for Hire', recruitable(G).length || null], ['evening', 'Evening', evening && !G.eveningDone ? '♥' : null]]);
        if (!this.tab.tavern && evening) { this.tab.tavern = 'evening'; return this.p_tavern(G, panel); }
        panel.append(t.el);
        const list = h('div.list');
        if (t.cur === 'hire') {
            for (const hh of HEROES) {
                if (G.heroes[hh.id].joined) continue;
                const open = G.best >= hh.unlock;
                const cost = recruitCost(G, hh.id);
                const c = CLASSES[hh.cls];
                list.append(h('div.item', {},
                    h('div.por', { style: { backgroundImage: `url(${por(hh.id)})`, filter: open ? '' : 'brightness(0.15)' } }),
                    h('div.grow', {},
                        h('div.nm', { text: open ? `${hh.name} — ${c.name}` : '???' }),
                        h('div.meta', { text: open ? `${hh.title}. ${hh.bio}` : `A stranger who might come to the tavern once you reach floor ${hh.unlock}.` }),
                        open ? h('div.meta.gold', { text: `"${RECRUIT_LINES[hh.id]}"` }) : null),
                    open ? h('button.btn.primary', { 'data-k': 'hire-' + hh.id, disabled: G.gold < cost, on: { click: () => this.send({ t: 'recruit', id: hh.id }) } }, `Recruit · ${fmt(cost)}g`) : null));
            }
            if (!list.children.length) list.append(h('p', { text: 'Every hero in Hearthmere already walks with you.' }));
        } else {
            if (!evening) list.append(h('p', { text: 'Come back in the evening, after a climb. The tavern is quieter then, and people say the things they mean.' }));
            else if (G.eveningDone) list.append(h('p', { text: 'You\'ve spent this evening. Rest, and see who\'s by the fire tomorrow.' }));
            for (const id of joined(G).filter((x) => !HERO[x].hero)) {
                const hh = G.heroes[id];
                const next = (hh.bondLv + 1) * BOND_XP;
                const ready = hh.bondLv < 5 && hh.bond >= next;
                list.append(h('div.item', {},
                    h('div.por', { style: { backgroundImage: `url(${por(id)})` } }),
                    h('div.grow', {},
                        h('div.nm', {}, HERO[id].name, ' ', h('span.gold', { text: '♥'.repeat(hh.bondLv) + '♡'.repeat(5 - hh.bondLv) })),
                        h('div.meta', { text: `${BOND_RANKS[hh.bondLv]}${ready ? ' · something to tell you' : ''}` }),
                        hh.bondLv < 5 ? h('div.bar.xp', {}, h('i', { style: { width: `${Math.min(100, (hh.bond - hh.bondLv * BOND_XP))}%` } })) : null),
                    h('button.btn' + (ready ? '.primary' : ''), { 'data-k': 'eve-' + id, disabled: !evening || G.eveningDone, on: { click: () => this.send({ t: 'evening', id }) } }, 'Spend the evening')));
            }
        }
        panel.append(list);
        if (evening) panel.append(h('div.sheet-foot', {}, h('button.btn.primary', { 'data-k': 'rest', on: { click: () => this.send({ t: 'rest' }) } }, 'Rest until morning')));
    }

    // ---- items: a shared row
    gearRow(G, it, actions = []) {
        const gs = gearStats(it);
        const stat = Object.entries(gs.flat).map(([k, v]) => `${k.toUpperCase()} ${k === 'crit' ? '+' + v + '%' : '+' + fmt(v)}`).join(' · ');
        const aff = (it.aff || []).map((a) => AFFIXES.find((x) => x.id === a)).map((a) => `${a.stat.toUpperCase()} +${a.pct}%`).join(' · ');
        const eb = equippedBy(G, it.uid);
        return h('div.item', {},
            iconEl(gearIcon(it), 'big'),
            h('div.grow', {},
                h('div.nm.r' + it.rar, { text: `${gearName(it)}${it.plus ? ' +' + it.plus : ''}` }),
                h('div.meta', { text: `${RARITY[it.rar].name} ${GEAR[it.type].name} · item level ${it.lvl}${eb ? ' · worn by ' + HERO[eb.id].name : ''}${it.isNew ? ' · NEW' : ''}` }),
                h('div.meta', { text: stat + (aff ? ' · ' + aff : '') }),
                it.u ? h('div.meta.gold', { text: UNIQUES[it.u].desc }) : null),
            h('div.acts', {}, actions));
    }

    // ---- the forge
    p_forge(G, panel) {
        const t = this.tabs('forge', [['worn', 'Equipped'], ['bag', 'Bag']]);
        panel.append(t.el);
        const list = h('div.list');
        const items = Object.values(G.gear).filter((it) => !it.shop && (t.cur === 'worn' ? !!equippedBy(G, it.uid) : !equippedBy(G, it.uid)));
        items.sort((a, b) => (b.u ? 1 : 0) - (a.u ? 1 : 0) || b.rar - a.rar || b.lvl - a.lvl);
        for (const it of items) {
            const acts = [];
            if (it.plus < maxPlus(it)) {
                const c = upgradeCost(G, it);
                const can = G.gold >= c.gold && G.inv.ore >= c.ore && G.inv.shard >= c.shard;
                acts.push(h('button.btn.small' + (can ? '.good' : ''), { 'data-k': 'up-' + it.uid, disabled: !can, on: { click: () => this.send({ t: 'upgrade', uid: it.uid }) } },
                    `+${it.plus + 1}: ${fmt(c.gold)}g ${c.ore}⛏${c.shard ? ' ' + c.shard + '◆' : ''}`));
            } else acts.push(h('span.chip', { text: 'Max' }));
            const rc = reforgeCost(G, it);
            if (rc.to > it.lvl) {
                const can = G.gold >= rc.gold && G.inv.shard >= rc.shard;
                acts.push(h('button.btn.small', { 'data-k': 'rf-' + it.uid, disabled: !can, title: 'Raise the item level to your best floor, keeping its upgrades', on: { click: () => this.send({ t: 'reforge', uid: it.uid }) } }, `Reforge → ${rc.to}: ${fmt(rc.gold)}g ${rc.shard}◆`));
            }
            if (t.cur === 'bag' && !it.u) {
                const v = salvageValue(it);
                acts.push(h('button.btn.small.danger', { 'data-k': 'sv-' + it.uid, on: { click: () => this.send({ t: 'salvage', uid: it.uid }) } }, `Salvage (+${v.ore}⛏)`));
            }
            list.append(this.gearRow(G, it, acts));
        }
        if (!items.length) list.append(h('p.dim', { text: t.cur === 'bag' ? 'Your bag is empty. Loot from the tower and the market ends up here.' : 'Nothing equipped.' }));
        panel.append(h('p.hint', { text: '⛏ Iron Ore · ◆ Ember Shards. Upgrades from +5 need shards, which mini bosses and bosses drop.' }), list);
    }

    // ---- the market
    p_market(G, panel) {
        const t = this.tabs('market', [['goods', 'Supplies'], ['gear', 'Gear'], ['special', 'Specials'], ['sell', 'Sell']]);
        panel.append(t.el);
        const list = h('div.list');
        if (t.cur === 'goods') {
            for (const [id, g] of Object.entries(GOODS)) {
                const locked = g.minFloor && G.best < g.minFloor;
                list.append(h('div.item', {}, iconEl(g.icon, 'big'),
                    h('div.grow', {}, h('div.nm', { text: g.name }), h('div.meta', { text: locked ? `Sold once you reach floor ${g.minFloor}.` : `${g.desc} You have ${G.inv[id] || 0}.` })),
                    h('div.acts', {},
                        h('button.btn.small', { 'data-k': 'b1-' + id, disabled: locked || G.gold < g.price, on: { click: () => this.send({ t: 'buy', id, n: 1 }) } }, `Buy · ${fmt(g.price)}g`),
                        h('button.btn.small', { 'data-k': 'b5-' + id, disabled: locked || G.gold < g.price * 5, on: { click: () => this.send({ t: 'buy', id, n: 5 }) } }, `x5`))));
            }
        } else if (t.cur === 'gear') {
            for (const uid of G.shop.gear) {
                const it = G.gear[uid];
                const p = gearPrice(it);
                const who = G.party.filter((id) => canEquip(G, id, it)).map((id) => HERO[id].name).join(', ');
                list.append(this.gearRow(G, it, [h('span.meta', { text: who ? 'For ' + who : 'Nobody in the party' }), h('button.btn.small.primary', { 'data-k': 'bg-' + uid, disabled: G.gold < p, on: { click: () => this.send({ t: 'buyGear', uid }) } }, `Buy · ${fmt(p)}g`)]));
            }
            if (!G.shop.gear.length) list.append(h('p.dim', { text: 'Sold out. Fresh stock tomorrow.' }));
        } else if (t.cur === 'special') {
            const sp = shardPrice(G);
            list.append(h('div.item', {}, iconEl(MATS.shard.icon, 'big'), h('div.grow', {}, h('div.nm', { text: 'Ember Shard' }), h('div.meta', { text: `"Smuggled down from the upper floors. Three a day, no questions." (${3 - (G.shop.shards || 0)} left today)` })),
                h('button.btn.small', { 'data-k': 'shard', disabled: G.gold < sp || (G.shop.shards || 0) >= 3, on: { click: () => this.send({ t: 'buyShard' }) } }, `Buy · ${fmt(sp)}g`)));
            list.append(h('p', { text: `Trade 3 Monster Cores for an Epic piece at your best floor. You have ${G.inv.core || 0} cores.` }));
            const types = [...new Set(G.party.flatMap((id) => { const c = CLASSES[baseClass(G.heroes[id].cls)]; return [c.weapon, c.armor]; }).concat(['ring', 'amulet', 'charm']))];
            list.append(h('div.chips', {}, types.map((ty) => h('button.btn.small', { 'data-k': 'ct-' + ty, disabled: (G.inv.core || 0) < 3, on: { click: () => this.send({ t: 'coreTrade', type: ty }) } }, iconEl(GEAR[ty].icon), GEAR[ty].name))));
        } else {
            const items = Object.values(G.gear).filter((it) => !it.shop && !it.u && !equippedBy(G, it.uid));
            for (const it of items) list.append(this.gearRow(G, it, [h('button.btn.small', { 'data-k': 'sl-' + it.uid, on: { click: () => this.send({ t: 'sell', uid: it.uid }) } }, `Sell · ${fmt(Math.round(gearPrice(it) * 0.3))}g`)]));
            if (!items.length) list.append(h('p.dim', { text: 'Nothing to sell. Equipped gear and uniques stay with you.' }));
        }
        panel.append(list);
    }

    // ---- the guild
    p_guild(G, panel) {
        const list = h('div.list');
        for (const q of boardQuests(G)) {
            const p = questProgress(G, q);
            const rw = Object.entries(q.reward).map(([k, v]) => k === 'gold' ? (q.ms ? `${fmt(v)} gold` : 'gold') : k === 'gear' ? 'gear' : `${v} ${goodName(k)}`).join(', ');
            list.append(h('div.item' + (p.done ? '' : ''), {}, iconEl(q.ms ? ['misc', 15] : UI_ICON.quest, 'big'),
                h('div.grow', {}, h('div.nm', {}, q.ms ? h('span.gold', { text: 'Milestone · ' }) : null, q.name), h('div.meta', { text: q.text + ' Reward: ' + rw + '.' }),
                    h('div.bar.xp', {}, h('i', { style: { width: `${Math.round(100 * p.have / p.need)}%` } })), h('div.meta', { text: `${fmt(p.have)} / ${fmt(p.need)}` })),
                h('button.btn' + (p.done ? '.primary' : ''), { 'data-k': 'q-' + q.id, disabled: !p.done, on: { click: () => this.send({ t: 'claim', id: q.id }) } }, p.done ? 'Claim' : 'In progress')));
        }
        panel.append(h('p.hint', { text: 'New bounties are posted every morning.' }), list);
    }

    // ---- the temple
    p_temple(G, panel) {
        const ids = joined(G);
        const pk = this.heroPicker(G, 'temple', ids);
        panel.append(pk.el);
        const id = pk.cur, hh = G.heroes[id];
        const list = h('div.list');
        const c = CLASSES[hh.cls];
        list.append(h('div.item', {}, h('div.por', { style: { backgroundImage: `url(${por(id)})` } }),
            h('div.grow', {}, h('div.nm', { text: `${HERO[id].name} — ${className(G, id)} · Lv ${hh.lv}` }), h('div.meta', { text: `${hh.sp} skill point${hh.sp === 1 ? '' : 's'} · one per level` }))));
        // class change
        if (hh.tier === 1) {
            const evos = c.evo.map((e) => CLASSES[e]);
            list.append(h('h3', { text: hh.lv >= EVOLVE_LV ? 'Choose an evolution' : `Evolution at level ${EVOLVE_LV}` }));
            for (const e of evos) {
                const key = Object.keys(CLASSES).find((k) => CLASSES[k] === e);
                list.append(h('div.item', {}, h('div.grow', {}, h('div.nm', { text: e.name }), h('div.meta', { text: e.skills.map((s) => s.name).join(' · ') })),
                    h('button.btn' + (hh.lv >= EVOLVE_LV ? '.primary' : ''), { 'data-k': 'evo-' + key, disabled: hh.lv < EVOLVE_LV, on: { click: () => this.send({ t: 'evolve', id, cls: key }) } }, 'Become')));
            }
        } else if (hh.tier === 2) {
            list.append(h('div.item', {}, h('div.grow', {}, h('div.nm', { text: `Ascend to ${c.asc}` }), h('div.meta', { text: `At level ${ASCEND_LV}, for 5 Ember Shards: stronger in every way, and the class ultimate.` })),
                h('button.btn.primary', { 'data-k': 'asc', disabled: hh.lv < ASCEND_LV || G.inv.shard < 5, on: { click: () => this.send({ t: 'ascend', id }) } }, 'Ascend')));
        }
        list.append(h('h3', { text: 'Skills' }));
        for (const s of skillList(G, id)) {
            const tgt = { enemy: 'one foe', enemies: 'all foes', ally: 'one ally', allies: 'all allies', self: 'self', fallen: 'a fallen ally' }[s.tgt];
            list.append(h('div.item' + (s.locked ? '.done' : ''), {},
                h('div.grow', {}, h('div.nm', {}, s.name, ' ', h('span.gold', { text: s.rank ? '★'.repeat(s.rank) : '' })),
                    h('div.meta', { text: `${s.desc} ${s.mp} MP · ${tgt}${s.locked ? ` · needs level ${s.lv}${s.lv >= ASCEND_LV ? ' and ascension' : ''}` : ''}` })),
                s.rank >= 5 ? h('span.chip', { text: 'Mastered' }) : h('button.btn.small' + (s.can ? '.good' : ''), { 'data-k': 'sk-' + s.id, disabled: !s.can, on: { click: () => this.send({ t: 'learn', id, skill: s.id }) } }, s.rank ? `Rank up · ${s.cost} SP` : `Learn · ${s.cost} SP`)));
        }
        panel.append(list);
    }

    // ---- the party
    p_party(G, panel) {
        const list = h('div.list');
        for (const id of joined(G)) {
            const hh = G.heroes[id];
            const s = heroStats(G, id);
            const inParty = G.party.includes(id);
            const slots = ['weapon', 'armor', 'acc'].map((slot) => {
                const it = G.gear[hh.eq[slot]];
                return h('button.btn.small', { 'data-k': `eq-${id}-${slot}`, title: 'Change', on: { click: () => this.equipPicker(G, id, slot) } },
                    it ? iconEl(gearIcon(it)) : h('i.ico'), it ? h('span.r' + it.rar, { text: `${gearName(it)}${it.plus ? ' +' + it.plus : ''}` }) : `(${slot === 'acc' ? 'accessory' : slot})`);
            });
            const toggle = inParty
                ? h('button.btn.small', { 'data-k': 'bench-' + id, disabled: G.party.length <= 1, on: { click: () => this.send({ t: 'party', ids: G.party.filter((x) => x !== id) }) } }, 'To bench')
                : h('button.btn.small.good', { 'data-k': 'join-' + id, disabled: G.party.length >= PARTY_MAX, on: { click: () => this.send({ t: 'party', ids: [...G.party, id] }) } }, 'To party');
            const errand = !inParty ? h('button.btn.small' + (hh.errand ? '.toggle.on' : ''), { 'data-k': 'err-' + id, on: { click: () => this.send({ t: 'errand', id, on: !hh.errand }) } }, hh.errand ? 'On errands ✓' : 'Send on errands') : null;
            list.append(h('div.item', { style: { alignItems: 'flex-start' } },
                h('div.sprite', { style: { width: '64px', height: '76px', backgroundImage: `url(${heroSprite(G, id)})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center bottom', flex: 'none' } }),
                h('div.grow', {},
                    h('div.nm', {}, `${HERO[id].name} — ${className(G, id)} · Lv ${hh.lv} `, inParty ? h('span.chip', { text: 'In party' }) : h('span.chip', { text: 'Bench' })),
                    h('div.bar.xp', { title: 'Experience' }, h('i', { style: { width: `${Math.round(100 * hh.xp / xpNext(hh.lv))}%` } })),
                    h('div.stats', {}, ...['hp', 'mp', 'atk', 'mag', 'def', 'res', 'spd'].map((k) => h('span', {}, h('b', { text: k.toUpperCase() + ' ' }), fmt(s[k]))), h('span', {}, h('b', { text: 'CRIT ' }), s.crit + '%')),
                    h('div.chips', { style: { marginTop: '4px' } }, slots),
                    h('div.chips', { style: { marginTop: '4px' } }, toggle, errand))));
        }
        const tools = h('div.chips', { style: { marginBottom: '8px' } },
            h('button.btn.primary', { 'data-k': 'equip-best', title: 'Put the best gear you own on every hero: the party first, then the bench', on: { click: () => this.send({ t: 'equipBest' }) } }, '⚔ Equip best'),
            h('button.btn.toggle' + (G.flags.autoEquip ? '.on' : ''), { 'data-k': 'auto-equip', 'aria-pressed': String(!!G.flags.autoEquip), title: 'Equip best by itself every time you come home from the tower', on: { click: () => this.send({ t: 'autoEquip', on: !G.flags.autoEquip }) } }, `Auto-equip on coming home: ${G.flags.autoEquip ? 'ON' : 'off'}`));
        panel.append(h('p.hint', { text: `Up to ${PARTY_MAX} heroes climb. The bench still learns a share of every battle, and heroes on errands earn while you're away.` }), tools, list);
    }

    equipPicker(G, id, slot) {
        const opts = Object.values(G.gear).filter((it) => !it.shop && slotOf(it) === slot && canEquip(G, id, it));
        const cur = G.heroes[id].eq[slot];
        const body = h('div.list', { style: { maxHeight: '60vh' } });
        for (const it of opts.sort((a, b) => b.lvl * (1 + 0.1 * b.plus) * RARITY[b.rar].mult - a.lvl * (1 + 0.1 * a.plus) * RARITY[a.rar].mult)) {
            body.append(this.gearRow(G, it, [it.uid === cur ? h('span.chip', { text: 'Worn' }) : h('button.btn.small.primary', { 'data-k': 'pick-' + it.uid, on: { click: () => { this.closeScreen('popup'); this.send({ t: 'equip', id, uid: it.uid }); } } }, 'Equip')]));
        }
        if (!opts.length) body.append(h('p.dim', { text: 'Nothing in your bag fits this slot.' }));
        const foot = [h('button.btn.primary', { on: { click: () => this.closeScreen('popup') } }, 'Close')];
        if (slot !== 'weapon' && cur) foot.unshift(h('button.btn', { on: { click: () => { this.closeScreen('popup'); this.send({ t: 'unequip', id, slot }); } } }, 'Take off'));
        this.popup(`${HERO[id].name}: ${slot === 'acc' ? 'accessory' : slot}`, body, foot);
    }

    // ---- the treasury
    p_treasury(G, panel) {
        const list = h('div.list');
        const gold = Math.floor(G.idle.gold), ore = Math.floor(G.idle.ore);
        const xp = Object.entries(G.idle.xp).filter(([, v]) => v >= 1);
        list.append(h('div.item', {}, iconEl(UI_ICON.hourglass, 'big'),
            h('div.grow', {}, h('div.nm', { text: 'While you were away' }),
                h('div.meta', { text: G.best >= 1 ? `Hearthmere pays a tithe for every floor you've cleared, up to ${8} hours at a time.` : 'Clear a floor of the tower and the town will start paying you a tithe.' }),
                h('div', { text: `${fmt(gold)} gold · ${ore} ore${xp.length ? ' · ' + xp.map(([id, v]) => `${HERO[id].name} +${fmt(v)} xp`).join(', ') : ''}` })),
            h('button.btn.primary', { 'data-k': 'collect', disabled: gold <= 0 && ore <= 0 && !xp.length, on: { click: () => this.send({ t: 'collect' }) } }, 'Collect')));
        const streak = G.daily.streak || 0;
        list.append(h('h3', { text: `Daily bonus · ${streak}-day streak` }));
        list.append(h('p.hint', { text: 'Visit on consecutive days to climb the ladder. Day 7 brings an Epic piece.' }));
        DAILY.forEach((r, i) => {
            const got = Object.entries(r).map(([k, v]) => k === 'gold' ? 'gold' : k === 'gear' ? 'Epic gear' : `${v} ${goodName(k)}`).join(', ');
            const today = Math.min(DAILY.length, streak) - 1 === i;
            list.append(h('div.item' + (today ? '' : '.done'), {}, h('div.grow', {}, h('div.nm', { text: `Day ${i + 1}${today ? ' (today)' : ''}` }), h('div.meta', { text: got }))));
        });
        panel.append(list);
    }

    // ---- the bestiary
    p_bestiary(G, panel) {
        const list = h('div.list');
        for (const b of BIOMES) {
            list.append(h('h3', { text: `${b.name} · floors ${b.floors[0]}–${b.floors[1]}` }));
            const row = h('div.hub-grid', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' } });
            for (const m of [...b.monsters, b.mini, b.boss]) {
                const seen = G.seen[m.id];
                const kills = G.stats.killsBy[m.id] || 0;
                const mm = MONSTERS[m.id];
                row.append(h('div.item', { style: { flexDirection: 'column', alignItems: 'center', textAlign: 'center' }, title: seen ? `${mm.name}: weak to ${mm.weak.join(', ') || 'nothing'}; resists ${mm.resist.join(', ') || 'nothing'}` : '' },
                    h('div', { style: { width: '96px', height: '80px', background: `url(${ART.mon(m.id)}) center bottom / contain no-repeat`, imageRendering: 'pixelated', filter: seen ? '' : 'brightness(0) opacity(0.6)' } }),
                    h('div.nm', { text: seen ? mm.name : '???', style: { fontSize: '14px' } }),
                    h('div.meta', { text: seen ? `${mm.rank === 'boss' ? 'Boss · ' : mm.rank === 'mini' ? 'Mini boss · ' : ''}Defeated ${kills}` + (mm.weak.length ? ` · weak: ${mm.weak.join(', ')}` : '') : 'Not yet seen' })));
            }
            list.append(row);
        }
        panel.append(h('p.hint', { text: 'Monsters past floor 100 return Ascended: recoloured, and far stronger.' }), list);
    }

    // ------------------------------------------------------------ popups
    popup(title, body, foot) {
        const root = $('popup');
        root.replaceChildren(h('div.win.sheet', {}, h('h2', { text: title }), body, h('div.sheet-foot', {}, foot || [h('button.btn.primary', { on: { click: () => this.closeScreen('popup') } }, 'OK')])));
        this.openScreen('popup');
    }

    para(text, ...more) {
        const cls = typeof more[more.length - 1] === 'string' ? more.pop() : '';
        return h('div', {}, h('p' + (cls ? '.' + cls : ''), { text }), ...more.filter(Boolean));
    }

    rewardChips(G, got) {
        const out = [];
        for (const [k, v] of Object.entries(got || {})) {
            if (k === 'gear') { const it = G.gear[v]; if (it) out.push(h('span.reward', {}, iconEl(gearIcon(it)), h('span.r' + it.rar, { text: gearName(it) }))); }
            else if (k === 'xp') continue;
            else out.push(h('span.reward', {}, iconEl(goodIcon(k)), `${k === 'gold' ? fmt(v) : v} ${goodName(k)}`));
        }
        return h('div.reward-grid', {}, out);
    }

    /** A story page sequence (portrait, speaker, text), shown in the scene modal. */
    story(pages, done) {
        let i = 0;
        const show = () => {
            const p = pages[i];
            if (p.voice) this.audio.say(p.voice, { gap: 0 });
            const root = $('scene');
            const next = h('button.btn.primary', { on: { click: () => { this.audio.ui('click'); i++; if (i < pages.length) show(); else { this.closeScreen('scene'); done?.(); } } } }, i < pages.length - 1 ? 'Next ▸' : (p.end || 'Continue'));
            root.replaceChildren(h('div.win.dlg', {}, p.por ? h('div.por', { style: { backgroundImage: `url(${por(p.por)})` } }) : null,
                h('div.body', {}, h('div.who', { text: p.who || '' }), ...(p.lines || [p.text]).map((t) => h('p.line', { text: t })), h('div.choices', {}, next))));
            this.openScreen('scene');
        };
        show();
    }

    /** The evening scene in G.scene. */
    renderScene(G) {
        const sc = G.scene;
        const root = $('scene');
        if (!sc) { if (!$('scene').hidden && this.stack.includes('scene') && root.dataset.kind === 'eve') this.closeScreen('scene'); return; }
        root.dataset.kind = 'eve';
        const id = sc.id;
        const hh = G.heroes[id];
        const body = h('div.body', {}, h('div.who', {}, HERO[id].name, ' ', h('span.gold', { text: '♥'.repeat(hh.bondLv) + '♡'.repeat(5 - hh.bondLv) })));
        const choices = h('div.choices');
        if (sc.kind === 'talk') {
            body.append(h('p.line', { text: sc.line }));
            if (sc.ready) body.append(h('p.line.gold', { text: `${HERO[id].name} seems to have something on their mind. Spend another evening together soon.` }));
            choices.append(h('button.btn.primary', { on: { click: () => this.send({ t: 'choose', i: 0 }) } }, 'Goodnight'));
        } else if (sc.kind === 'rank') {
            const scene = SCENES[id][sc.idx];
            for (const [who, text] of scene.lines) body.append(h('p.line' + (who === 'arin' ? '.me' : ''), { text: (who === 'arin' ? 'Arin: ' : '') + text }));
            scene.choices.forEach((c, i) => choices.append(h('button.btn', { on: { click: () => this.send({ t: 'choose', i }) } }, c[0])));
        } else if (sc.kind === 'reply') {
            body.append(h('p.line', { text: sc.reply }));
            body.append(h('p.line.' + (sc.good ? 'gold' : 'dim'), { text: sc.good ? `Your bond with ${HERO[id].name} deepens: ${BOND_RANKS[hh.bondLv]}.` : 'Not quite the right words. Maybe another evening.' }));
            choices.append(h('button.btn.primary', { on: { click: () => this.send({ t: 'choose', i: 0 }) } }, 'Goodnight'));
        }
        body.append(choices);
        root.replaceChildren(h('div.win.dlg', {}, h('div.por', { style: { backgroundImage: `url(${por(id)})` } }), body));
        this.setBg('tavern-night', false);
        if (!this.stack.includes('scene')) this.openScreen('scene'); else this.focusFirst('scene');
    }

    // ------------------------------------------------------------ the battle HUD
    renderBattle(G, stage) {
        this.G = G;
        const B = G.battle;
        const cmds = $('cmds');
        $('floor-tag').textContent = B ? `Floor ${B.floor} · ${biomeOf(B.floor).cycle ? 'Ascended ' : ''}${biomeOf(B.floor).biome.name} · ${fmt(G.gold)}g` : '';
        if (!B) { cmds.replaceChildren(); return; }
        const busy = stage.busy || G.events.length > 0;
        const u = B.turn ? bunit(B, B.turn) : null;
        // The toggle row is built once and only relabelled. The panel re-renders every time a turn starts or an
        // animation ends (many times a second at 3x); rebuilding these buttons then swallowed clicks that landed
        // between press and release, so Auto, Climb and the speed seemed not to respond.
        const t = this.toggleRow();
        const set = (btn, on, label) => { btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on)); if (btn.textContent !== label) btn.textContent = label; };
        set(t.auto, G.auto, `Auto ${G.auto ? 'ON' : 'off'}`);
        set(t.climb, G.autoClimb, `Climb ${G.autoClimb ? 'ON' : 'off'}`);
        if (t.speed.textContent !== `${this.settings.speed}x`) t.speed.textContent = `${this.settings.speed}x`;
        let body;
        if (B.phase === 'input' && !busy && u && u.side === 'p') {
            stage.turn = u.uid;
            body = this.commandMenu(G, u, stage);
        } else {
            stage.setPick(null);
            let msg = 'The battle is over.';
            if (B.phase === 'ai') msg = u && u.side === 'e' ? `${u.name} acts…` : `${u?.name ?? ''} acts on their own (auto)…`;
            else if (busy) msg = '…';
            body = h('div.cmd-who', { text: msg });
        }
        // swap only the part above the toggles; the toggle row stays the same element
        for (const el of [...cmds.children]) if (el !== t.row) el.remove();
        cmds.prepend(body);
        if (t.row.parentNode !== cmds) cmds.append(t.row);
        if (this.top() === null || this.top() === 'battle') {
            // keep keyboard focus inside the command window
            if (!cmds.contains(document.activeElement)) cmds.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
        }
    }

    /** Auto / Climb / speed / menu: one set of buttons for the whole session (see renderBattle). */
    toggleRow() {
        if (this._toggles) return this._toggles;
        const auto = h('button.btn.toggle', { 'data-k': 'auto', on: { click: () => this.send({ t: 'auto', on: !this.G.auto }) } });
        const climb = h('button.btn.toggle', { 'data-k': 'climb', title: 'Keep climbing after each victory while the party is healthy', on: { click: () => this.send({ t: 'autoClimb', on: !this.G.autoClimb }) } });
        const speed = h('button.btn', { 'data-k': 'speed', title: 'Battle speed', on: { click: () => this.cycleSpeed() } });
        const menu = h('button.btn', { 'data-k': 'menu', 'aria-label': 'Menu', on: { click: () => { this.audio.ui('click'); this.openScreen('settings'); } } }, '☰');
        this._toggles = { row: h('div.cmd-row', {}, auto, climb, speed, menu), auto, climb, speed };
        return this._toggles;
    }

    cycleSpeed() {
        this.settings.speed = this.settings.speed >= 3 ? 1 : this.settings.speed + 1;
        $('set-speed').value = String(this.settings.speed);
        this.onSpeed?.(this.settings.speed);
        this.renderBattle(this.G, this.stage);
    }

    commandMenu(G, u, stage) {
        const B = G.battle;
        const wrap = h('div');
        const head = h('div.cmd-who', {}, h('span', { text: `${u.name}'s turn` }), h('span.hint', { text: `MP ${u.mp}/${u.mmp}` }));
        wrap.append(head);
        const grid = h('div.cmd-grid');
        const go = (cmd) => { this.bmenu = 'root'; this.pending = null; stage.setPick(null); this.send({ t: 'cmd', ...cmd }); };
        const needTarget = (cmd, tgt, pool) => {
            if (tgt === 'enemies' || tgt === 'allies' || tgt === 'self') return go(cmd);
            if (pool.length === 1 && tgt === 'enemy') return go({ ...cmd, target: pool[0].uid });
            this.pending = { cmd, pool: pool.map((p) => p.uid) };
            this.bmenu = 'target';
            this.renderBattle(G, stage);
        };
        if (this.bmenu === 'root') {
            const foes = B.units.filter((x) => x.side === 'e' && x.alive);
            const skills = options(G, u);
            const items = Object.keys(GOODS).filter((k) => G.inv[k] > 0);
            const b = (n, label, on, dis, extra) => h('button.btn', { 'data-k': 'c-' + n, disabled: dis, on: { click: () => { this.audio.ui('click'); on(); } } }, h('span.k', { text: n }), label, extra || null);
            grid.append(
                b(1, 'Attack', () => needTarget({ kind: 'attack' }, 'enemy', foes)),
                b(2, 'Skills', () => { this.bmenu = 'skills'; this.renderBattle(G, stage); }, !skills.length && !Object.keys(G.heroes[u.ref].skills).length),
                b(3, 'Items', () => { this.bmenu = 'items'; this.renderBattle(G, stage); }, !items.length),
                b(4, 'Defend', () => go({ kind: 'defend' })),
                b(5, 'Flee', () => go({ kind: 'flee' }), B.rank !== 'normal'),
            );
            wrap.append(grid);
        } else if (this.bmenu === 'skills') {
            const hero = G.heroes[u.ref];
            for (const sid of Object.keys(hero.skills)) {
                const sk = skillFor(G, u, sid);
                const pool = targetsFor(B, u, sk);
                const can = u.mp >= sk.mp && pool.length > 0;
                grid.append(h('button.btn', { 'data-k': 's-' + sid, title: sk.desc, disabled: !can, on: { click: () => { this.audio.ui('click'); needTarget({ kind: 'skill', id: sid }, sk.tgt, pool); } } },
                    sk.name, h('span.c', { text: sk.mp + ' MP' })));
            }
            grid.append(h('button.btn', { 'data-k': 'back', on: { click: () => { this.audio.ui('back'); this.bmenu = 'root'; this.renderBattle(G, stage); } } }, '← Back'));
            wrap.append(grid);
        } else if (this.bmenu === 'items') {
            for (const [id, g] of Object.entries(GOODS)) {
                if (!(G.inv[id] > 0)) continue;
                const pool = g.tgt === 'fallen' ? B.units.filter((x) => x.side === 'p' && !x.alive) : g.tgt === 'ally' ? B.units.filter((x) => x.side === 'p' && x.alive) : [];
                const dis = (g.tgt === 'fallen' && !pool.length) || (g.use.flee && B.rank === 'boss');
                grid.append(h('button.btn', { 'data-k': 'i-' + id, title: g.desc, disabled: dis, on: { click: () => { this.audio.ui('click'); needTarget({ kind: 'item', id }, g.tgt === 'ally' || g.tgt === 'fallen' ? 'ally' : g.tgt, pool); } } },
                    iconEl(g.icon), g.name, h('span.c', { text: 'x' + G.inv[id] })));
            }
            grid.append(h('button.btn', { 'data-k': 'back', on: { click: () => { this.audio.ui('back'); this.bmenu = 'root'; this.renderBattle(G, stage); } } }, '← Back'));
            wrap.append(grid);
        } else if (this.bmenu === 'target') {
            const p = this.pending;
            wrap.append(h('div.hint', { text: 'Choose a target (or tap one in the battle).' }));
            for (const uid of p.pool) {
                const t = bunit(B, uid);
                grid.append(h('button.btn', { 'data-k': 't-' + uid, on: { click: () => go({ ...p.cmd, target: uid }), focus: () => { stage.hover = uid; } } },
                    t.name, h('span.c', { text: t.alive ? `${Math.round(100 * t.hp / t.mhp)}%` : 'fallen' })));
            }
            grid.append(h('button.btn', { 'data-k': 'back', on: { click: () => { this.audio.ui('back'); this.bmenu = 'root'; this.pending = null; stage.setPick(null); this.renderBattle(G, stage); } } }, '← Back'));
            stage.setPick(p.pool, (uid) => go({ ...p.cmd, target: uid }));
            wrap.append(grid);
        }
        return wrap;
    }

    /** Count the auto-climb button down; at zero, climb. Stops if auto battle is switched off or the screen closes. */
    tickAutoNext(dt) {
        const a = this.autoNext;
        if (!a) return;
        if ($('victory').hidden || !this.G?.auto || this.G.battle?.phase !== 'won') { this.cancelAutoNext(); return; }
        a.left -= dt;
        const n = Math.max(0, Math.ceil(a.left));
        a.btn.textContent = `${a.label} (${n})`;
        a.btn.style.setProperty('--p', `${Math.max(0, Math.min(1, a.left / AUTO_NEXT_SECONDS)) * 100}%`);
        if (a.left <= 0) { this.autoNext = null; this.send({ t: 'next' }); }
    }

    cancelAutoNext() {
        const a = this.autoNext;
        if (!a) return;
        this.autoNext = null;
        a.btn.textContent = a.label;
        a.btn.style.removeProperty('--p');
        $('victory').querySelector('[data-k="wait"]')?.remove();
    }

    battleBack() {
        if (this.bmenu !== 'root') { this.bmenu = 'root'; this.pending = null; this.stage?.setPick(null); this.renderBattle(this.G, this.stage); return true; }
        return false;
    }

    /** Party rows, from the stage's display values so bars move with the animation. */
    renderPartyStatus(G, stage) {
        const root = $('pstatus');
        const B = G.battle;
        if (!B) return;
        const rows = B.units.filter((u) => u.side === 'p');
        if (root.children.length !== rows.length || root.dataset.b !== String(B.floor)) {
            root.dataset.b = String(B.floor);
            root.replaceChildren(...rows.map((u) => h('div.prow', { 'data-uid': u.uid },
                h('div.mini', { style: { backgroundImage: `url(${por(u.ref)})` } }),
                h('div', {}, h('div.nm', {}, u.name, h('small', { text: ' Lv ' + G.heroes[u.ref].lv })), h('div.sts')),
                h('div', {}, h('div.bar.hp', {}, h('i')), h('div.nums', {}, h('span.hpn'), h('span.mpn'))),
                h('div', {}, h('div.bar.mp', {}, h('i'))))));
        }
        for (const el of root.children) {
            const uid = el.dataset.uid;
            const v = stage.units.get(uid);
            const u = bunit(B, uid);
            if (!v || !u) continue;
            const hp = Math.max(0, v.hp), mp = v.mp ?? u.mp;
            el.querySelector('.bar.hp i').style.width = `${Math.round(100 * hp / u.mhp)}%`;
            el.querySelector('.bar.mp i').style.width = `${u.mmp ? Math.round(100 * mp / u.mmp) : 0}%`;
            el.querySelector('.hpn').textContent = `${fmt(hp)}/${fmt(u.mhp)}`;
            el.querySelector('.mpn').textContent = `${fmt(mp)} MP`;
            el.querySelector('.sts').textContent = Object.keys(v.st).map((s) => STATUS[s].icon).join(' ');
            el.classList.toggle('turn', stage.turn === uid && v.alive);
            el.classList.toggle('down', !v.alive);
        }
    }

    /** After a fight: the rewards, and the way forward (or home). */
    renderAfter(G) {
        const B = G.battle;
        const root = $('victory');
        const body = [];
        const foot = [];
        if (B.phase === 'won') {
            const r = B.rewards;
            body.push(h('h2', { text: `${B.rank === 'boss' ? 'Boss defeated!' : B.rank === 'mini' ? 'Mini boss defeated!' : 'Victory!'} Floor ${B.floor} cleared` }));
            body.push(h('p', {}, h('span.gold', { text: `+${fmt(r.gold)} gold` }), ` · +${fmt(r.xp)} experience each`));
            const chips = [];
            for (const d of r.drops) {
                if (d.kind === 'gear') { const it = G.gear[d.uid]; if (it) chips.push(h('span.reward', {}, iconEl(gearIcon(it)), h('span.r' + it.rar, { text: gearName(it) + (it.u ? ' (Unique!)' : '') }))); }
                else chips.push(h('span.reward', {}, iconEl(goodIcon(d.id)), `${d.n} ${goodName(d.id)}`));
            }
            if (chips.length) body.push(h('div.reward-grid', {}, chips));
            const ups = G.party.filter((id) => this.levelled?.[id]);
            if (ups.length) body.push(h('p.good', { text: ups.map((id) => `${HERO[id].name} reached level ${G.heroes[id].lv}!`).join(' ') }));
            const ph = partyHealth(G);
            body.push(h('p.dim', { text: `Party health ${Math.round(ph.ratio * 100)}%. The next floor's rest restores a little.${G.auto ? '' : (B.floor + 1) % 10 === 0 ? ' A boss waits on the next floor.' : (B.floor + 1) % 5 === 0 ? ' A mini boss waits on the next floor.' : ''}` }));
            foot.push(h('button.btn', { 'data-k': 'home', on: { click: () => this.send({ t: 'leave' }) } }, 'Return to town'));
            const nextBtn = h('button.btn.primary.countdown', { 'data-k': 'next', on: { click: () => { this.autoNext = null; this.send({ t: 'next' }); } } }, `Climb to floor ${B.floor + 1} ▸`);
            foot.push(nextBtn);
            // auto battle climbs on by itself after a countdown, but never walks into a mini boss or a boss
            const nextRank = rankOfFloor(B.floor + 1);
            if (G.auto && nextRank === 'normal') {
                this.autoNext = { left: AUTO_NEXT_SECONDS, btn: nextBtn, label: nextBtn.textContent };
                foot.unshift(h('button.btn', { 'data-k': 'wait', title: 'Stop the countdown', on: { click: () => this.cancelAutoNext() } }, 'Wait'));
            } else if (G.auto || G.autoClimb) {
                body.push(h('p.gold', { text: `A ${nextRank === 'boss' ? 'boss' : 'mini boss'} waits on floor ${B.floor + 1}. Auto won't climb into it for you: get ready, then climb when you choose.` }));
            }
        } else if (B.phase === 'lost') {
            body.push(h('h2.bad', { text: `Your party has fallen on floor ${B.floor}` }));
            body.push(h('p', { text: 'Townsfolk carry you home. Some of the gold you found this climb is lost on the way.' }));
            foot.push(h('button.btn.primary', { 'data-k': 'home', on: { click: () => this.send({ t: 'leave' }) } }, 'Back to Hearthmere'));
        } else if (B.phase === 'fled') {
            body.push(h('h2', { text: 'You got away!' }));
            foot.push(h('button.btn', { 'data-k': 'home', on: { click: () => this.send({ t: 'leave' }) } }, 'Return to town'));
            foot.push(h('button.btn.primary', { 'data-k': 'next', on: { click: () => this.send({ t: 'next' }) } }, `Try floor ${B.floor} again`));
        }
        root.replaceChildren(h('div.win.sheet', {}, ...body, h('div.sheet-foot', {}, foot)));
        if (!this.stack.includes('victory')) this.openScreen('victory'); else this.focusFirst('victory');
        this.tickAutoNext(0);   // show the count at once, now the screen is open
    }
}

export { h };
