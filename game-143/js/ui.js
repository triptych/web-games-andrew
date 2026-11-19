// The DOM layer: screens, the town HUD and its panels, dialogue, the siege HUD, toasts and the gossip ticker.
// Reads the sim; changes it only through this.send(cmd), which main.js routes to act().

import { VERSION, DAY_LEN, PLOTS_OPEN, WALL_COST, HALL_COST, PHASE_DAYS } from './config.js';
import {
    BUILDINGS, BUILD_ORDER, STAFF, STAFF_ORDER, ADVENTURERS, ADV_ORDER, ADV_MAX, ABILITIES, ABILITY_ORDER, INGREDIENTS, ING_ORDER,
    QUESTS, CAST, SCENES, GOSSIP, RES, RES_ICON, WAVES, DAY_EVENTS,
} from './sim/data.js';
import {
    costOf, canAfford, canBuild, rates, buildingRate, housing, workersNeeded, staffing, advSlots, advsHired, trainCost, wallArmor,
    countOf, bakeCap, hasAny, plotsOpen, daysUntil,
} from './sim/town.js';
import { questDef, needsDeliver, deliverCost, objectiveMet } from './sim/game.js';
import { readiness } from './sim/battle.js';
import { artUrl } from './view/assets.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n)));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const costHtml = (G, cost) => Object.entries(cost).filter(([, v]) => v).map(([r, v]) => `<span class="${(G.res[r] || 0) < v ? 'short' : ''}">${RES_ICON[r]}${fmt(v)}</span>`).join(' ');
const por = (id) => artUrl('por/' + (CAST[id]?.por || id));
const PANEL_TITLES = { quests: 'Quests', staff: 'The Household', heroes: 'Adventurers', defence: 'The Siege', bake: 'The Grand Bake' };

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, send }) {
        this.audio = audio;
        this.settings = settings;
        this.send = send;
        this.stack = [];
        this.touchOn = false;
        this.panel = null;          // which panel is open: 'quests', 'plot:3', ...
        this.talkQ = [];
        this.talkCur = null;
        this.onTalkDone = null;
        this.gossipT = 0;
        this.renderT = 0;
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), touch = $('set-touch');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; touch.value = settings.touch;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, touch: touch.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, voice, touch]) el.addEventListener('input', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });

        // dock and panels
        for (const b of document.querySelectorAll('[data-sheet]')) b.addEventListener('click', () => { audio.ui('open'); this.openPanel(b.dataset.sheet); });
        $('panel-body').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-cmd]');
            if (!b || b.disabled) return;
            const cmd = JSON.parse(b.dataset.cmd);
            audio.ui('click');
            if (cmd.t === 'openPlot') { this.openPanel('plot:' + cmd.plot); return; }
            const ok = this.send(cmd);
            if (ok && (cmd.t === 'build' || cmd.t === 'demolish')) { this.closeScreen('panel'); this.panel = null; return; }
            this.renderPanel(true);
        });
        $('panel-body').addEventListener('change', (e) => {
            const p = e.target.closest('select[data-plot]');
            if (p) {
                const plot = +p.dataset.plot;
                if (p.value) this.send({ t: 'assign', staff: p.value, plot });
                else { const here = STAFF_ORDER.find((id) => this.G.staff[id].at === plot); if (here) this.send({ t: 'assign', staff: here, plot: null }); }
                this.renderPanel(true);
                return;
            }
            const s = e.target.closest('select[data-staff]');
            if (!s) return;
            this.send({ t: 'assign', staff: s.dataset.staff, plot: s.value === '' ? null : +s.value });
            this.renderPanel(true);
        });

        // dialogue
        const advance = () => this.nextLine();
        $('talkbox').addEventListener('click', (e) => { if (!e.target.closest('#talk-skip')) advance(); });
        $('talk-skip').addEventListener('click', () => { this.talkQ.length = 0; this.nextLine(); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // stack order is the paint order
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (id === 'panel') this.panel = null;
        if (id === 'talk') this.audio.hush();
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() {
        const t = this.top();
        if (!t) return;
        if (t === 'talk') { this.talkQ.length = 0; this.nextLine(); return; }
        if (t === 'result' || t === 'ending') return;
        this.closeScreen(t);
    }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { if (id === 'talk') { $('talk-next').focus({ preventScroll: true }); return; } this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ modes
    showTown(on) { $('topbar').hidden = !on; $('dock').hidden = !on; $('ticker').hidden = !on; }
    showBattle(on, G) {
        $('bhud').hidden = !on;
        if (on) this.buildAbilities(G);
    }

    // ------------------------------------------------------------------ toasts and the ticker
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 3300);
    }
    gossip(G, dt) {
        this.gossipT -= dt;
        if (this.gossipT > 0) return;
        this.gossipT = 14;
        const band = G.hope < 25 ? 0 : G.hope < 50 ? 1 : G.hope < 75 ? 2 : 3;
        const lines = GOSSIP[band];
        $('ticker-text').textContent = '📰 ' + lines[Math.floor(Math.random() * lines.length)];
    }

    // ------------------------------------------------------------------ the town HUD
    hud(G, dt) {
        const r = rates(G);
        for (const k of RES) {
            const el = $('r-' + k);
            el.querySelector('b').textContent = fmt(G.res[k]);
            const v = r[k] * DAY_LEN;
            const i = el.querySelector('i');
            i.textContent = Math.abs(v) < 0.5 ? '' : (v > 0 ? '+' : '') + Math.round(v);
            i.className = v < 0 ? 'neg' : '';
        }
        $('r-pop').querySelector('b').textContent = `${Math.floor(G.pop)}/${housing(G)}`;
        $('r-pop').title = `Villagers ${Math.floor(G.pop)}, homes for ${housing(G)}, jobs ${Math.round(workersNeeded(G))}`;
        $('r-hope').querySelector('.bar > div').style.width = `${G.hope}%`;
        $('r-hope').querySelector('.face').textContent = G.hope < 25 ? '😨' : G.hope < 50 ? '😟' : G.hope < 75 ? '🙂' : '😄';
        const day = $('r-day');
        if (G.phase >= 4) day.textContent = `Day ${G.day} · stragglers in ${Math.ceil(daysUntil(G))}d · held ${G.epi.waves}`;
        else day.textContent = `Day ${G.day} · Siege ${G.phase + 1}/4 in ${Math.ceil(daysUntil(G))}d`;
        day.classList.toggle('warn', daysUntil(G) <= 1.5);
        for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('on', +b.dataset.speed === G.speed);
        const ready = G.quests.active.filter((id) => { const q = questDef(id); return needsDeliver(q) && objectiveMet(G, q) && !G.quests.paid[id]; }).length;
        const badge = $('badge-quests');
        badge.hidden = !G.quests.active.length;
        badge.textContent = ready ? '!' : G.quests.active.length;
        this.gossip(G, dt);
        this.renderT -= dt;
        if (this.panel && this.renderT <= 0) this.renderPanel();
    }

    // ------------------------------------------------------------------ panels
    openPanel(which) {
        this.panel = which;
        this.renderPanel(true);
        this.openScreen('panel');
    }
    renderPanel(force = false) {
        if (!this.panel || !this.G) return;
        this.renderT = 0.6;
        const G = this.G, body = $('panel-body');
        const focusIdx = this.buttons('panel').indexOf(document.activeElement);
        const scroll = body.parentElement.scrollTop;
        let title = PANEL_TITLES[this.panel] || '', html = '';
        if (this.panel.startsWith('plot:')) [title, html] = this.plotHtml(G, +this.panel.slice(5));
        else if (this.panel === 'hall') [title, html] = this.hallHtml(G);
        else html = this[this.panel + 'Html'](G);
        if (!force && html === this.lastHtml) return;
        this.lastHtml = html;
        $('panel-title').textContent = title;
        body.innerHTML = html;
        body.parentElement.scrollTop = scroll;
        if (focusIdx >= 0) this.buttons('panel')[Math.min(focusIdx, this.buttons('panel').length - 1)]?.focus({ preventScroll: true });
    }
    cmdBtn(label, cmd, { disabled = false, primary = false } = {}) {
        return `<button class="btn small${primary ? ' primary' : ''}" data-cmd='${esc(JSON.stringify(cmd))}'${disabled ? ' disabled' : ''}>${label}</button>`;
    }

    plotHtml(G, i) {
        const p = G.plots[i];
        if (i >= plotsOpen(G)) return ['Locked plot', `<p>Upgrade the Town Hall to build here.</p>`];
        if (!p.b) {
            let html = '<p>What should we build here?</p>';
            for (const k of BUILD_ORDER) {
                const def = BUILDINGS[k], why = canBuild(G, i, k);
                if (why === 'locked' || why === 'only one') continue;
                const cost = costOf(k);
                html += `<div class="card${why ? ' off' : ''}"><img src="${artUrl('bld/' + k)}" alt=""><div class="body"><h3>${def.icon} ${def.name}</h3><p>${esc(def.desc)}</p>
                    <div class="acts"><span class="cost">${costHtml(G, cost)}</span>${def.workers ? `<span class="tag2">👷 ${def.workers}</span>` : ''}${this.cmdBtn('Build', { t: 'build', plot: i, kind: k }, { disabled: !!why, primary: true })}</div></div></div>`;
            }
            return ['An empty plot', html];
        }
        const b = p.b, def = BUILDINGS[b.kind], r = buildingRate(G, i);
        let html = `<div class="card"><img src="${artUrl('bld/' + b.kind)}" alt=""><div class="body"><h3>${def.icon} ${def.name} ${'★'.repeat(b.lvl)}</h3><p>${esc(def.desc)}</p>`;
        if (b.build > 0) html += `<p class="obj">${b.up ? 'Upgrading' : 'Under construction'}… ${Math.ceil(b.build)} s</p>`;
        const lines = [];
        for (const k in r.make) lines.push(`makes ${RES_ICON[k]} ${(r.make[k] * DAY_LEN).toFixed(0)}/day`);
        for (const k in r.use) lines.push(`uses ${RES_ICON[k]} ${(r.use[k] * DAY_LEN).toFixed(0)}/day`);
        if (def.housing) lines.push(`homes for ${def.housing * b.lvl}`);
        if (def.hope) lines.push(`hope +${Math.round(def.hope * [1, 1.8, 2.8][b.lvl - 1])}`);
        if (def.armor) lines.push(`wall cozies −${Math.round(def.armor * b.lvl * 100)}% damage`);
        if (b.kind === 'tower') lines.push('one crossbow on the wall in a siege');
        if (b.kind === 'tavern') lines.push(`rooms for ${def.slots[b.lvl - 1]} adventurers`);
        if (b.kind === 'witch') lines.push(`doilies +${30 * b.lvl}% damage`);
        if (b.kind === 'bell') lines.push(`siege morale +${6 * b.lvl}%`);
        if (b.kind === 'oven') lines.push(`bakes ${(r.bake * DAY_LEN).toFixed(1)}% a day while lit`);
        if (def.workers) lines.push(`staffed ${Math.round(staffing(G) * 100)}%`);
        html += `<p class="obj">${lines.join(' · ')}</p>`;
        html += `<div class="acts">`;
        if (b.lvl < 3 && !(b.build > 0)) {
            const cost = costOf(b.kind, b.lvl + 1);
            html += `<span class="cost">${costHtml(G, cost)}</span>${this.cmdBtn('Upgrade ★' + (b.lvl + 1), { t: 'upgrade', plot: i }, { disabled: !canAfford(G, cost), primary: true })}`;
        }
        if (b.kind === 'oven') html += this.cmdBtn(G.oven.lit ? 'Let the fire die' : '🔥 Light the oven', { t: 'oven', on: !G.oven.lit });
        if (b.kind !== 'oven') html += this.cmdBtn('Knock down', { t: 'demolish', plot: i });
        html += `</div></div></div>`;
        // who works here
        const opts = ['<option value="">— nobody —</option>'];
        for (const id of STAFF_ORDER) if (G.staff[id].joined) opts.push(`<option value="${id}"${G.staff[id].at === i ? ' selected' : ''}>${STAFF[id].name}${STAFF[id].aff === b.kind ? ' ★' : ''}</option>`);
        html += `<label class="row">Staff working here <select class="sel" data-plot="${i}">${opts.join('')}</select></label>`;
        return [def.name, html];
    }

    hallHtml(G) {
        let html = `<div class="card"><img src="${artUrl('bld/hall')}" alt=""><div class="body"><h3>Town Hall ${'★'.repeat(G.hall.lvl)}</h3>
            <p>The Mayor's office. Lord Vellum keeps the paperwork here, and the paperwork keeps Lord Vellum. Each level opens more plots and houses more villagers.</p>
            <p class="obj">${plotsOpen(G)} plots open · homes for ${6 * G.hall.lvl}</p><div class="acts">`;
        if (G.hall.build > 0) html += `<span class="obj">Building… ${Math.ceil(G.hall.build)} s</span>`;
        else if (G.hall.lvl < 3) html += `<span class="cost">${costHtml(G, HALL_COST[G.hall.lvl])}</span>${this.cmdBtn(`Upgrade to ★${G.hall.lvl + 1} (${PLOTS_OPEN[G.hall.lvl]} plots)`, { t: 'hall' }, { disabled: !canAfford(G, HALL_COST[G.hall.lvl]), primary: true })}`;
        html += `</div></div></div>`;
        return ['Town Hall', html + this.defenceHtml(G)];
    }

    questsHtml(G) {
        if (!G.quests.active.length) return '<p>No requests right now. Thistlegloom is, for once, content.</p>';
        let html = '';
        for (const id of G.quests.active) {
            const q = questDef(id), met = objectiveMet(G, q);
            html += `<div class="card"><img src="${por(q.giver)}" alt=""><div class="body"><h3>${esc(q.title)}</h3><p>${esc(q.intro[1])}</p>
                <div class="obj ${met ? '' : 'no'}">${met ? '✅' : '⬜'} ${esc(this.objText(G, q))}</div>`;
            if (needsDeliver(q)) {
                const cost = deliverCost(q);
                html += `<div class="acts"><span class="cost">${costHtml(G, cost)}</span>${this.cmdBtn('Deliver', { t: 'deliver', id }, { disabled: !met || !canAfford(G, cost), primary: true })}</div>`;
            }
            html += `<p>Reward: ${esc(this.rewardText(q.reward))}</p></div></div>`;
        }
        const done = QUESTS.filter((q) => G.quests.done[q.id]).length;
        return html + `<p class="version">${done} of ${QUESTS.length} quests done</p>`;
    }
    objText(G, q) {
        const o = q.obj, B = (k) => BUILDINGS[k].name;
        switch (o.kind) {
            case 'build': return o.and ? `Build a ${B(o.what)} and a ${B(o.and)}` : o.n ? `Have ${o.n} ${B(o.what)}s (${countOf(G, o.what)})` : `Build a ${B(o.what)}`;
            case 'lvl': return `Upgrade a ${B(o.what)} to ★${o.lvl}`;
            case 'wall': return `Raise the wall to level ${o.lvl}`;
            case 'hope': return `Hope at ${o.v} or more (now ${Math.floor(G.hope)})`;
            case 'advs': return `Hire ${o.n} adventurers (${advsHired(G)})`;
            case 'bake': return `The Grand Bake at ${o.pct}% (now ${Math.floor(G.bake.pct)}%), then deliver`;
            case 'pay': return 'Deliver the goods';
        }
        return '';
    }
    rewardText(r) {
        const out = [];
        for (const k of RES) if (r[k]) out.push(`${RES_ICON[k]}${r[k]}`);
        if (r.staff) out.push(`${STAFF[r.staff].name} joins`);
        if (r.adv) out.push(`${ADVENTURERS[r.adv].name} joins`);
        if (r.hopeBonus) out.push(`hope +${r.hopeBonus}`);
        if (r.ing) out.push(`${INGREDIENTS[r.ing].icon} ${INGREDIENTS[r.ing].name}`);
        if (r.honey) out.push('🍯 honey for the oven');
        return out.join(', ');
    }

    staffHtml(G) {
        let html = '<p>Lady Noxia\'s household came with her from the castle. Put each to work in a building: they speed it up, and most in the building they love best (★).</p>';
        for (const id of STAFF_ORDER) {
            const s = G.staff[id], d = STAFF[id];
            if (!s.joined) { html += `<div class="card off"><img src="${por(d.por)}" alt=""><div class="body"><h3>${d.name}</h3><p>Not here yet. Someone in town may know where they are.</p></div></div>`; continue; }
            const opts = ['<option value="">— taking it easy —</option>'];
            G.plots.forEach((p, i) => { if (p.b && !(p.b.build > 0 && !p.b.up)) opts.push(`<option value="${i}"${s.at === i ? ' selected' : ''}>${BUILDINGS[p.b.kind].icon} ${BUILDINGS[p.b.kind].name} (plot ${i + 1})${d.aff === p.b.kind ? ' ★' : ''}</option>`); });
            const ab = d.ability ? ABILITIES[d.ability] : null;
            html += `<div class="card"><img src="${por(d.por)}" alt=""><div class="body"><h3>${d.name} <span class="tag2">${d.role}</span></h3><p>${esc(d.bio)}</p>
                ${ab ? `<p class="obj">${ab.icon} ${ab.name}: ${esc(ab.desc)}</p>` : ''}
                <div class="acts"><select class="sel" data-staff="${id}">${opts.join('')}</select></div></div></div>`;
        }
        return html;
    }

    heroesHtml(G) {
        const slots = advSlots(G);
        let html = slots ? `<p>The Grinning Gourd has rooms for <b>${slots}</b> adventurers (${advsHired(G)} hired). Upgrade the tavern for more.</p>` : '<p>Build <b>The Grinning Gourd</b> tavern and adventurers will come to stay.</p>';
        for (const id of ADV_ORDER) {
            const a = G.advs[id], d = ADVENTURERS[id];
            const locked = (d.phase > G.phase && G.phase < 4) || (d.needs && !G.quests.done[d.needs]);
            html += `<div class="card${locked && !a.hired ? ' off' : ''}"><img src="${por(d.por)}" alt=""><div class="body"><h3>${d.name} <span class="tag2">${d.role}</span>${a.hired ? ` <span class="tag2">level ${a.lvl}</span>` : ''}</h3><p>${esc(d.bio)}</p><div class="acts">`;
            if (a.hired) {
                if (a.lvl < ADV_MAX) html += `<span class="cost">🪙${trainCost(a.lvl)}</span>${this.cmdBtn('Train', { t: 'train', adv: id }, { disabled: G.res.gold < trainCost(a.lvl) })}`;
                else html += '<span class="obj">Fully trained</span>';
            } else if (id === 'tobias') html += '<span class="obj">Will come once there is a tavern.</span>';
            else if (locked) html += '<span class="obj">Not in town yet.</span>';
            else html += `<span class="cost">🪙${d.cost}</span>${this.cmdBtn('Hire', { t: 'hire', adv: id }, { disabled: G.res.gold < d.cost || advsHired(G) >= slots, primary: true })}`;
            html += '</div></div></div>';
        }
        return html;
    }

    defenceHtml(G) {
        let html = '';
        if (G.phase < 4) {
            const W = WAVES[G.phase];
            html += `<h3>Siege ${G.phase + 1} of 4: ${W.name}</h3><p>In ${Math.ceil(daysUntil(G))} day(s). Be ready with:</p><ul class="checklist">`;
            for (const r of readiness(G)) {
                const label = { wall: `Wall at level ${r.v}`, towers: `${r.v} watchtower${r.v > 1 ? 's' : ''}`, advs: `${r.v} adventurer${r.v > 1 ? 's' : ''} on the wall`, bake: `The Grand Bake at ${r.v}%`, build: `A ${BUILDINGS[r.v]?.name}` }[r.k];
                const have = r.k === 'build' ? '' : ` (${r.have ?? 0})`;
                html += `<li class="${r.ok ? 'ok' : 'no'}">${label}${have}</li>`;
            }
            html += `</ul><p class="obj">All ready: the wall gets +15% strength.</p>`;
        } else html += `<h3>The epilogue</h3><p>Leftover gingerfolk who never heard the news wander in every few days, a little tougher each time. Held so far: ${G.epi.waves} (best ${G.epi.best}).</p>`;
        const wl = G.wall.lvl;
        html += `<div class="card"><img src="${artUrl(wl >= 4 ? 'wall/5' : wl === 3 ? 'wall/3' : 'wall/1')}" alt=""><div class="body"><h3>The Wall ${'★'.repeat(wl)}</h3>
            <p>${Math.round(G.wall.max)} strength${G.wall.hp < G.wall.max ? ` (repairing: ${Math.round(G.wall.hp)})` : ''} · cozies −${Math.round(wallArmor(G) * 100)}% damage · ${countOf(G, 'tower')} watchtower(s)</p><div class="acts">`;
        if (G.wall.build > 0) html += `<span class="obj">Building… ${Math.ceil(G.wall.build)} s</span>`;
        else if (wl < 5) html += `<span class="cost">${costHtml(G, WALL_COST[wl])}</span>${this.cmdBtn(`Raise to ★${wl + 1}`, { t: 'wall' }, { disabled: !canAfford(G, WALL_COST[wl]), primary: true })}`;
        else html += '<span class="obj">As tall as it gets.</span>';
        html += '</div></div></div>';
        const abil = ABILITY_ORDER.filter((id) => G.staff[ABILITIES[id].staff].joined);
        html += `<p>Staff abilities ready for the siege: ${abil.length ? abil.map((id) => ABILITIES[id].icon + ' ' + ABILITIES[id].name).join(', ') : 'none yet'}.</p>`;
        return html;
    }

    bakeHtml(G) {
        const cap = bakeCap(G);
        let html = `<p>The Mayor's secret project. Lord Vellum has asked eleven times what it is. "Trust me."</p>
            <div class="bar bigbar"><div style="width:${G.bake.pct}%"></div></div>
            <p class="obj">${G.bake.pct.toFixed(1)}% baked · can reach ${cap}% with the ingredients you have${G.bake.honey ? ' · 🍯 honey: bakes faster' : ''}</p><ul class="checklist">`;
        for (const id of ING_ORDER) html += `<li class="${G.bake.ings.includes(id) ? 'ok' : 'no'}">${INGREDIENTS[id].icon} ${INGREDIENTS[id].name} (lets it bake to ${25 * (ING_ORDER.indexOf(id) + 1)}%)</li>`;
        html += '</ul>';
        const ovenPlot = G.plots.findIndex((p) => p.b?.kind === 'oven');
        if (ovenPlot < 0) html += `<p>${G.unlocks.oven ? 'Build <b>The Great Oven</b> on an empty plot.' : 'First things first: the town needs a bakery before anyone will help with an oven that size.'}</p>`;
        else {
            const r = buildingRate(G, ovenPlot);
            html += `<p>${G.oven.lit ? '🔥 The oven is lit' : 'The oven is cold'}${G.oven.starved ? ' — <b>out of flour or sugar!</b>' : ''}. It burns 🌾 and 🍬 while it bakes${r.bake ? `, about ${(r.bake * DAY_LEN).toFixed(1)}% a day` : ''}.</p>
                <div class="acts">${this.cmdBtn(G.oven.lit ? 'Let the fire die' : '🔥 Light the oven', { t: 'oven', on: !G.oven.lit }, { primary: !G.oven.lit })}${this.cmdBtn('Go to the oven', { t: 'openPlot', plot: ovenPlot })}</div>`;
        }
        if (G.bake.pct >= 100) html += '<p class="obj">It is ready. When the King comes, she will be waiting.</p>';
        return html;
    }

    // ------------------------------------------------------------------ dialogue
    /** Queue lines: [speaker, text, voice?]. */
    talk(lines, onDone) {
        for (const l of lines) this.talkQ.push(l);
        if (onDone) this.onTalkDone = onDone;
        if (!this.talkCur) this.nextLine();
    }
    talkScene(id, onDone) { if (SCENES[id]) this.talk(SCENES[id], onDone); else onDone?.(); }
    nextLine() {
        const l = this.talkQ.shift();
        if (!l) {
            this.talkCur = null;
            if (!$('talk').hidden) this.closeScreen('talk');
            const cb = this.onTalkDone; this.onTalkDone = null; cb?.();
            return;
        }
        this.talkCur = l;
        const who = CAST[l[0]] || { name: l[0], por: l[0] };
        $('talk-name').textContent = who.name;
        $('talk-line').textContent = l[1];
        $('talk-por').src = artUrl('por/' + who.por);
        $('talkbox').classList.toggle('right', who.side !== 'left' && l[0] !== 'noxia');
        if ($('talk').hidden) this.openScreen('talk');
        if (l[2]) this.audio.say(l[2][0], l[2][1]); else this.audio.hush();
    }
    talking() { return !!this.talkCur; }

    // ------------------------------------------------------------------ the siege HUD
    buildAbilities(G) {
        const box = $('b-abil');
        box.innerHTML = '';
        const B = G.battle;
        if (!B) return;
        ABILITY_ORDER.forEach((id, i) => {
            if (!B.abil[id]) return;
            const b = document.createElement('button');
            b.className = 'abtn'; b.dataset.ab = id;
            b.setAttribute('aria-label', ABILITIES[id].name);
            b.innerHTML = `${ABILITIES[id].icon}<div class="cd"></div><div class="k">${i + 1}</div>`;
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.send({ t: 'ability', id }); });
            b.addEventListener('click', (e) => { if (e.detail === 0) this.send({ t: 'ability', id }); });
            box.appendChild(b);
        });
    }
    battleHud(G) {
        const B = G.battle;
        if (!B) return;
        $('b-wall').style.width = `${(B.wall.hp / B.wall.max) * 100}%`;
        $('b-wall-n').textContent = Math.ceil(B.wall.hp);
        $('b-name').textContent = B.name;
        $('b-wave').style.width = `${Math.min(1, B.si / Math.max(1, B.sched.length)) * 100}%`;
        for (const b of document.querySelectorAll('.abtn')) {
            const a = B.abil[b.dataset.ab], def = ABILITIES[b.dataset.ab];
            b.querySelector('.cd').style.height = `${(a.cd / def.cd) * 100}%`;
            b.classList.toggle('ready', a.cd <= 0);
        }
        $('btn-queen').hidden = !B.canQueen;
        $('b-hint').style.opacity = B.t < 8 ? 1 : 0;
    }

    // ------------------------------------------------------------------ result and ending
    showResult(e) {
        const titles = { win: 'The Wall Held!', lose: 'The Wall Fell…', retreat: 'The King Withdraws' };
        const imgs = { win: 'spr/noxia-cheer', lose: 'en/zombie', retreat: 'en/king' };
        let text = '';
        if (e.result === 'win') text = `${e.calmed} gingerfolk curled up for a nap and wandered home sleepy. The town gathered 🪙${e.gold} and 🍬${e.sugar} from the field.` + (e.epi ? '' : ' The horde falls back to regroup. Get ready for the next one.');
        else if (e.result === 'lose') text = 'The horde reached the edge of town, nibbled a building and wandered off with the snacks. Some stores were lost, and hope took a knock. The same wave comes back in three days, a little smaller. Check the 🛡️ Siege panel for what the town needs.';
        else text = 'King Crumbleton waited, and nothing came out to meet him. He has gone back to rebake his army. Three more days: finish the Grand Bake.';
        $('result-h').textContent = titles[e.result];
        $('result-img').src = artUrl(imgs[e.result]);
        $('result-text').textContent = text;
        this.openScreen('result');
    }
    showEnding(G) {
        $('ending-text').textContent = `Queen Honeysnap crossed the battlefield, and King Crumbleton stopped crumbling. ${G.stats.calmed} gingerfolk napped through the war, ${G.stats.quests} favours were done for the village, and nobody was ever eaten. The Mayor of Thistlegloom is, it turns out, a terrible overlord and a wonderful neighbour.`;
        this.openScreen('ending');
    }
}
