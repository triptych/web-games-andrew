// HOLLOWDEEP — Brindlemoor: the square and its six places. Each place is a painted backdrop, a townsperson who
// talks (voiced), and the things you can do there. Everything goes out through send(); nothing here changes G.

import { $, el, porUrl, icon, itemName, gearLine, toast } from './common.js';
import { PLACES, NPCS, STORY } from '../sim/data/town.js';
import { CLASSES } from '../sim/data/classes.js';
import { itemDef, gearStats, sellPrice, CONSUMABLES } from '../sim/data/items.js';
import { STRATA, stratumOf } from '../sim/data/monsters.js';
import { heroStats, canEquip } from '../sim/stats.js';
import { shopStock, buyPrice, storyFor, isComplete } from '../sim/game.js';
import { progressText, MAX_ACTIVE } from '../sim/quests.js';
import { HIRE_COST, INN_COST, REVIVE_COST, CURE_COST, ROSTER_MAX, PARTY_MAX, FRONT } from '../config.js';
import { VOICES, NPC_THANKS } from '../voices.js';

const ORDER = ['inn', 'shop', 'guild', 'temple', 'tavern', 'gate'];
const ICONS = { inn: '🛏', shop: '⚖', guild: '⚔', temple: '☀', tavern: '🍺', gate: '⛩' };

export class TownUI {
    constructor({ audio, send, openCamp }) {
        this.audio = audio; this.send = send; this.openCamp = openCamp;
        this.place = 'square';
        this.tab = {};
        this.greeted = {};
    }

    show(G, on) {
        $('town').hidden = !on;
        if (on) this.go(G, this.place || 'square', true);
    }

    go(G, place, silent = false) {
        this.place = place;
        this.G = G;
        $('town-bg').style.backgroundImage = `url(art/bg/${place}.webp)`;
        $('town-title').textContent = PLACES[place].name;
        if (!silent) this.audio.ui('ok');
        // the townsperson greets you (voiced) the first time each day you walk in
        const npc = PLACES[place].npc;
        if (npc && this.greeted[npc] !== G.day) {
            this.greeted[npc] = G.day;
            const n = (G.day + Object.keys(this.greeted).length) % 3;
            this.audio.say(npc, n, { force: true });
            this.line = n;
        }
        this.render(G);
    }

    render(G) {
        this.G = G;
        if ($('town').hidden) return;
        $('town-gold').textContent = G.gold.toLocaleString();
        const body = $('town-body');
        const scroll = body.scrollTop;
        body.textContent = '';
        const npc = PLACES[this.place].npc;
        if (npc) {
            const n = NPCS[npc];
            body.append(el('div.npc', {}, [
                el('div.face', { style: `background-image:url(${porUrl(npc)})` }),
                el('div.say', {}, [el('b', { text: `${n.name} · ${n.role}` }), `“${n.lines[this.line ?? 0]}”`]),
            ]));
            this._storyOffer(G, body, npc);
        }
        this[`_${this.place}`](G, body);
        if (this.place !== 'square') body.append(el('div.menu', { style: 'margin-top:12px' }, el('button.btn', { text: '← Back to the square', onclick: () => this.go(G, 'square') })));
        body.scrollTop = scroll;
    }

    _btn(label, sub, fn, opts = {}) {
        const b = el('button.btn' + (opts.cls ? '.' + opts.cls : ''), { onclick: fn, title: opts.title }, [label, sub ? el('small', { text: sub }) : null]);
        if (opts.disabled) b.disabled = true;
        if (opts.act) b.dataset.act = opts.act;
        return b;
    }

    // ------------------------------------------------------------ the square
    _square(G, body) {
        body.append(el('p.dim', { text: `Day ${G.day}. The lamps of Brindlemoor burn against the dark of the Hollowdeep. Deepest floor reached: ${G.deepest ? 'B' + G.deepest + 'F' : 'none yet'}.` }));
        const m = el('div.menu');
        for (const p of ORDER) {
            const npc = PLACES[p].npc;
            const story = storyFor(G, npc);
            const ready = G.quests.active.filter((q) => isComplete(G, q) && (q.npc === npc)).length;
            const sub = ready ? `${ready} quest${ready > 1 ? 's' : ''} to report!` : story ? `${NPCS[npc].name} has a request` : `${NPCS[npc].name}, ${NPCS[npc].role.toLowerCase()}`;
            m.append(this._btn(`${ICONS[p]}  ${PLACES[p].name}`, sub, () => this.go(G, p), { act: p, cls: ready || story ? 'sel' : '' }));
        }
        m.append(this._btn('☰  Party & Items', 'equipment, items, quests, save', () => this.openCamp(), { act: 'camp' }));
        body.append(m);
    }

    _storyOffer(G, body, npc) {
        const q = storyFor(G, npc);
        const ready = G.quests.active.filter((x) => x.npc === npc && isComplete(G, x));
        for (const r of ready) {
            body.append(el('div.quest', {}, [
                el('b', { text: r.title }), el('p', { text: 'Done! Report back for your reward.' }),
                el('div.meta', {}, [el('span', { text: `${r.gold} gold${r.item ? ' · ' + (itemDef(r.item)?.name || r.item) : ''}` }),
                    this._btn('Report', null, () => { this.send({ t: 'turnin', qid: r.id }); this.audio.say(npc, NPC_THANKS, { force: true }); }, { act: 'turnin' })]),
            ]));
        }
        if (!q) return;
        body.append(el('div.quest', {}, [
            el('b', { text: q.title }), el('p', { text: q.text }),
            el('div.meta', {}, [el('span', { text: `Reward: ${q.gold} gold${q.item ? ' · ' + itemDef(q.item).name + (q.count > 1 ? ' ×' + q.count : '') : ''}` }),
                this._btn('Accept', null, () => this.send({ t: 'take', qid: q.id }), { act: 'take', disabled: G.quests.active.length >= MAX_ACTIVE })]),
        ]));
    }

    // ------------------------------------------------------------ the inn
    _inn(G, body) {
        const living = G.roster.filter((c) => c.hp > 0);
        const cost = INN_COST(living.reduce((a, c) => a + c.lv, 0));
        const stable = G.gold < cost;
        body.append(el('div.menu', {}, [
            this._btn(stable ? 'Sleep in the stables (free)' : `Rest for the night — ${cost} gold`, stable ? 'half your strength back; you can\'t afford a room' : 'everyone recovers fully; poison is cured; a new day begins', () => this.send({ t: 'rest' }), { act: 'rest' }),
        ]));
        body.append(el('p.dim', { text: 'Resting also brings new faces to the guild and fresh work to Pell\'s board. Your progress is saved whenever you sleep.' }));
    }

    // ------------------------------------------------------------ the shop
    _shop(G, body) {
        const tab = this.tab.shop || 'buy';
        body.append(el('div.tabs', {}, ['buy', 'sell'].map((t) => el('button.tab' + (t === tab ? '.on' : ''), { text: t === 'buy' ? 'Buy' : 'Sell', onclick: () => { this.tab.shop = t; this.render(G); } }))));
        const list = el('div.list');
        if (tab === 'buy') {
            const party = G.party.map((id) => G.roster.find((c) => c.id === id)).filter(Boolean);
            for (const id of shopStock(G)) {
                const d = itemDef(id);
                const users = d.type === 'gear' ? party.filter((c) => canEquip(c, d)) : [];
                let tagline = gearLine({ id });
                if (d.type === 'gear' && users.length) {
                    const better = users.filter((c) => { const cur = c.eq[d.slot]; const a = gearStats({ id }); const b = cur ? gearStats(cur) : {}; return (a.atk || 0) + (a.def || 0) + (a.mag || 0) + (a.res || 0) > (b.atk || 0) + (b.def || 0) + (b.mag || 0) + (b.res || 0); });
                    tagline += ` · for ${users.map((c) => c.name).join(', ')}${better.length ? ' ▲' : ''}`;
                }
                const b = this._btn(d.name, tagline, () => { this.send({ t: 'buy', id }); }, { disabled: G.gold < buyPrice(id), act: 'buy' });
                b.dataset.id = id;
                b.prepend(icon(id));
                b.append(el('span.price', { text: buyPrice(id).toLocaleString() }));
                list.append(el('div.item', {}, b));
            }
        } else {
            if (!G.inv.length) list.append(el('p.dim', { text: 'Your pack is empty.' }));
            for (const [i, e] of G.inv.entries()) {
                const d = itemDef(e.id);
                if (!d || d.type === 'quest') continue;
                const b = this._btn(`${itemName(e)}${e.n > 1 ? ' ×' + e.n : ''}`, gearLine(e), () => this.send({ t: 'sell', inv: i }), { act: 'sell' });
                b.prepend(icon(e.id));
                b.append(el('span.price', { text: sellPrice(e).toLocaleString() }));
                list.append(el('div.item', {}, b));
            }
        }
        body.append(list);
    }

    // ------------------------------------------------------------ the guild
    _guild(G, body) {
        const tab = this.tab.guild || 'recruit';
        body.append(el('div.tabs', {}, [['recruit', 'Recruit'], ['party', 'Party']].map(([t, l]) => el('button.tab' + (t === tab ? '.on' : ''), { text: l, onclick: () => { this.tab.guild = t; this.render(G); } }))));
        const list = el('div.list');
        if (tab === 'recruit') {
            if (!G.recruits.length) list.append(el('p.dim', { text: 'Nobody is looking for work today. New faces come in after a night at the inn.' }));
            for (const [i, c] of G.recruits.entries()) {
                const s = heroStats(c), cost = HIRE_COST(c.lv), cl = CLASSES[c.cls];
                list.append(el('div.card', {}, [
                    el('div.face', { style: `background-image:url(${porUrl(c.por)})` }),
                    el('div.info', {}, [el('b', { text: c.name }), el('small', { text: `${cl.name} · level ${c.lv} · HP ${s.hp} · prefers the ${cl.row} row` }), el('small', { text: cl.blurb })]),
                    el('div.acts', {}, this._btn(`Hire ${cost}`, null, () => this.send({ t: 'hire', i }), { act: 'hire', disabled: G.gold < cost || G.roster.length >= ROSTER_MAX })),
                ]));
            }
            body.append(el('p.dim', { text: `Guild members: ${G.roster.length} / ${ROSTER_MAX}. Up to ${PARTY_MAX} go down together: the first ${FRONT} fight in front.` }));
        } else {
            const order = [...G.party, ...G.roster.filter((c) => !G.party.includes(c.id)).map((c) => c.id)];
            for (const id of order) {
                const c = G.roster.find((x) => x.id === id);
                const inParty = G.party.includes(id);
                const pi = G.party.indexOf(id);
                const s = heroStats(c);
                const acts = [];
                if (inParty) {
                    acts.push(this._btn('▲', null, () => this._move(G, pi, -1), { disabled: pi === 0, title: 'Move up' }));
                    acts.push(this._btn('▼', null, () => this._move(G, pi, 1), { disabled: pi === G.party.length - 1, title: 'Move down' }));
                    acts.push(this._btn('Rest', null, () => this.send({ t: 'party', ids: G.party.filter((x) => x !== id) }), { title: 'Leave in the guild hall' }));
                } else {
                    acts.push(this._btn('Join', null, () => this.send({ t: 'party', ids: [...G.party, id] }), { disabled: G.party.length >= PARTY_MAX }));
                    acts.push(this._btn('Dismiss', null, () => { if (confirm(`Dismiss ${c.name}? Their gear goes to your pack.`)) this.send({ t: 'dismiss', cid: id }); }, { cls: 'danger' }));
                }
                list.append(el('div.card' + (inParty ? '.inparty' : ''), {}, [
                    el('div.face', { style: `background-image:url(${porUrl(c.por)})` }),
                    el('div.info', {}, [el('b', { text: c.name }), el('small', { text: `${CLASSES[c.cls].name} ${c.lv} · HP ${c.hp}/${s.hp}${c.hp <= 0 ? ' · fallen' : ''}` }),
                        el('small', { text: inParty ? (pi < FRONT ? 'front row' : 'back row') : 'in the guild hall' })]),
                    el('div.acts', {}, acts),
                ]));
            }
        }
        body.append(list);
    }

    _move(G, i, d) {
        const ids = G.party.slice();
        [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
        this.send({ t: 'party', ids });
    }

    // ------------------------------------------------------------ the temple
    _temple(G, body) {
        const list = el('div.list');
        const fallen = G.roster.filter((c) => c.hp <= 0);
        const poisoned = G.roster.filter((c) => c.hp > 0 && c.st.poison);
        const free = !G.roster.some((c) => c.hp > 0);
        if (!fallen.length && !poisoned.length) list.append(el('p.dim', { text: 'Everyone is whole. The Dawn keeps you.' }));
        for (const c of fallen) {
            const cost = free ? 0 : REVIVE_COST(c.lv);
            list.append(el('div.card', {}, [
                el('div.face', { style: `background-image:url(${porUrl(c.por)});filter:grayscale(1)` }),
                el('div.info', {}, [el('b', { text: c.name }), el('small', { text: `${CLASSES[c.cls].name} ${c.lv} · fallen` })]),
                el('div.acts', {}, this._btn(free ? 'Raise (free)' : `Raise ${cost}`, null, () => this.send({ t: 'revive', cid: c.id }), { act: 'revive', disabled: G.gold < cost })),
            ]));
        }
        for (const c of poisoned) {
            list.append(el('div.card', {}, [
                el('div.face', { style: `background-image:url(${porUrl(c.por)})` }),
                el('div.info', {}, [el('b', { text: c.name }), el('small', { text: 'poisoned' })]),
                el('div.acts', {}, this._btn(`Cure ${CURE_COST}`, null, () => this.send({ t: 'cure', cid: c.id }), { disabled: G.gold < CURE_COST })),
            ]));
        }
        body.append(list);
        if (free && fallen.length) body.append(el('p.dim', { text: 'When no one is left standing, the Dawn raises the first of you for nothing.' }));
    }

    // ------------------------------------------------------------ the tavern
    _tavern(G, body) {
        body.append(el('h3', { text: 'Pell\'s board' }));
        if (!G.quests.board.length) body.append(el('p.dim', { text: 'The board is bare. New notes go up every morning.' }));
        for (const q of G.quests.board) {
            body.append(el('div.quest', {}, [el('b', { text: q.title }), el('p', { text: q.text }),
                el('div.meta', {}, [el('span', { text: `${q.gold} gold · ${q.xp} XP` }), this._btn('Accept', null, () => this.send({ t: 'take', qid: q.id }), { act: 'take', disabled: G.quests.active.length >= MAX_ACTIVE })])]));
        }
        body.append(el('h3', { text: `Your work (${G.quests.active.length}/${MAX_ACTIVE})` }));
        if (!G.quests.active.length) body.append(el('p.dim', { text: 'Nothing in hand.' }));
        for (const q of G.quests.active) {
            const done = isComplete(G, q);
            const giver = NPCS[q.npc]?.name || 'Pell';
            body.append(el('div.quest', {}, [el('b', { text: q.title }), el('p', { text: q.text }),
                el('div.meta', {}, [el('span', {}, done ? el('span.done-tag', { text: `Done — report to ${giver}` }) : `${progressText(G, q)} · from ${giver}`)])]));
        }
    }

    // ------------------------------------------------------------ the gate
    _gate(G, body) {
        const alive = G.party.map((id) => G.roster.find((c) => c.id === id)).filter((c) => c && c.hp > 0).length;
        if (!alive) body.append(el('p', { text: 'Your party can\'t stand. Visit the Temple, or the Guild for fresh blood.' }));
        const m = el('div.menu');
        for (const f of G.warps.slice().sort((a, b) => b - a)) {
            const { stratum, cycle } = stratumOf(f);
            m.append(this._btn(f === 1 ? 'Enter the Hollowdeep — B1F' : `Warp to B${f}F`, `${cycle ? 'Echoing ' : ''}${stratum.name}`, () => this.send({ t: 'enter', floor: f }), { act: 'enter', disabled: !alive }));
        }
        body.append(m);
        body.append(el('p.dim', { text: 'Every guardian you fell lights a warp stone to the floor beneath it.' }));
    }
}

export { STORY, STRATA, CONSUMABLES, VOICES, toast };
