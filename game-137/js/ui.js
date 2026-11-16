// The DOM layer: screens, the HUD, the hangar (sorties, mech, crew), briefing, level-up cards,
// debrief, comms, banners and the Overdrive cut-in. Reads G; changes it only through act().

import { VERSION, GIFT_CAP, SHARD_BEAM, DANGER } from './config.js';
import { PARTS, SLOTS, SLOT_NAME, SLOT_KIND, partIds } from './sim/data/parts.js';
import { MISSIONS, SECTORS, missionById } from './sim/data/missions.js';
import { CREW, GIFTS, BOOSTS, CAST, crewById } from './sim/data/crew.js';
import { UPGRADES } from './sim/data/upgrades.js';
import { BOSSES } from './sim/data/enemies.js';
import { buildMech, nextCost, partLevel, giftsWaiting, nextGiftIn } from './sim/hangar.js';
import { ART } from './media.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const OBJ_TEXT = (o, R) => {
    if (o.kind === 'rescue') return `Free the hostages ${R ? R.cages.filter((c) => c.freed).length : 0}/${o.crew.length}`;
    if (o.kind === 'hives') return `Destroy hives ${R ? Math.min(o.count, R.hives.filter((h) => h.dead).length) : 0}/${o.count}`;
    if (o.kind === 'survive') return R ? `Hold out ${mmss(o.time - R.t)}` : `Hold out ${mmss(o.time)}`;
    if (o.kind === 'boss') return 'Defeat the kaiju';
    return o.kind;
};
export { OBJ_TEXT };

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave, act }) {
        this.audio = audio;
        this.settings = settings;
        this.act = act;
        this.stack = [];
        this.touchOn = false;
        this.tab = 'sortie';
        this.slot = 'armR';
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen must not click inside it when it lifts (game-071).
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el && el.id !== 'intro') { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('click'); this.closeTop(); });

        const ids = ['sfx', 'music', 'voice', 'touch', 'detail', 'calm'];
        const el = Object.fromEntries(ids.map((k) => [k, $('set-' + k)]));
        el.sfx.value = settings.sfx; el.music.value = settings.music; el.voice.value = settings.voice;
        el.touch.value = settings.touch; el.detail.value = settings.detail; el.calm.checked = !!settings.calm;
        const changed = () => {
            Object.assign(settings, { sfx: +el.sfx.value, music: +el.music.value, voice: +el.voice.value, touch: el.touch.value, detail: el.detail.value, calm: el.calm.checked });
            onSettings(settings);
        };
        for (const k of ids) el[k].addEventListener('change', changed);
        $('set-delete').addEventListener('click', async () => { if (await this.confirm('Delete the saved game? Your mech, credits and crew will be gone.')) { onDeleteSave(); this.toast('Saved game deleted.'); } });

        // hangar tabs
        for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => { audio.ui('click'); this.tab = t.dataset.tab; this.renderHangar(this.G); });
        $('tab-sortie').addEventListener('click', (e) => {
            const b = e.target.closest('[data-mission]');
            if (!b || b.disabled) return;
            audio.ui('open');
            this.openBriefing(this.G, +b.dataset.mission);
        });
        $('tab-mech').addEventListener('click', (e) => {
            const s = e.target.closest('[data-slot]');
            if (s) { audio.ui('click'); this.slot = s.dataset.slot; this.renderHangar(this.G); return; }
            const b = e.target.closest('[data-do]');
            if (!b) return;
            const id = b.dataset.part;
            if (b.dataset.do === 'buy') this.act({ t: 'buy', part: id });
            else if (b.dataset.do === 'fit') this.act({ t: 'equip', slot: this.slot, part: id });
            else if (b.dataset.do === 'remove') this.act({ t: 'equip', slot: this.slot, part: null });
            this.renderHangar(this.G);
        });
        $('tab-crew').addEventListener('click', (e) => {
            const all = e.target.closest('#collect-all');
            const card = e.target.closest('[data-crew]');
            if (all) { this.act({ t: 'collect', crew: 'all' }); this.renderHangar(this.G); return; }
            if (card) {
                const c = crewById(card.dataset.crew);
                const got = this.act({ t: 'collect', crew: c.id });
                this.comm(c.id, got ? c.line : `${c.role}. ${GIFTS[c.gift].desc || 'Leaves you credits.'}`, 4, 'crew');
                this.renderHangar(this.G);
            }
        });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // later screens on top of earlier ones (game-088)
        this.stack.forEach((s, i) => { $(s).style.zIndex = 50 + i; });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    closeAll() { for (const id of [...this.stack]) this.closeScreen(id); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    /** Any screen other than the hangar itself (which is the base while aboard). */
    modal() { return this.stack.some((s) => s !== 'hangar'); }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }
    confirm(text) {
        $('confirm-text').textContent = text;
        this.openScreen('confirm');
        return new Promise((res) => {
            const done = (v) => { $('confirm-yes').onclick = $('confirm-no').onclick = null; this.closeScreen('confirm'); res(v); };
            $('confirm-yes').onclick = () => done(true);
            $('confirm-no').onclick = () => done(false);
        });
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
        document.body.classList.toggle('touch', on);
    }
    hud(G, view = null) {
        const R = G.run;
        if (!R) return;
        const M = R.mech;
        const tot = M.maxHp;
        $('hud-hp').style.width = `${(M.hp / tot) * 100}%`;
        $('hud-hp').style.background = M.hp < tot * 0.3 ? 'var(--red)' : '';
        $('hud-shield').style.width = M.maxShield ? `${(M.shield / M.maxShield) * 100}%` : '0';
        $('hud-xp').style.width = `${(M.xp / M.xpNext) * 100}%`;
        $('hud-lvl').textContent = 'LV ' + M.lvl;
        $('hud-gold').textContent = `${R.gold} cr`;
        $('hud-time').textContent = R.evac > 0 ? `EVAC ${mmss(R.evac)}` : mmss(R.t);
        $('hud-od-fill').style.width = `${(M.odT > 0 ? M.odT / 5 : M.od) * 100}%`;
        $('hud-od').classList.toggle('ready', M.od >= 1);
        $('btn-od').style.opacity = M.od >= 1 ? 1 : 0.45;
        const objs = R.objectives.map((o) => `<li class="${o.done ? 'done' : ''}">${esc(OBJ_TEXT(o, R))}</li>`).join('') + (R.evac > 0 ? `<li>Hold out for the lift: ${mmss(R.evac)}</li>` : '');
        if (objs !== this._objs) { $('hud-obj').innerHTML = objs; this._objs = objs; }
        const boss = R.enemies.find((e) => e.boss);
        $('hud-boss').hidden = !boss;
        if (boss) { $('hud-boss-name').textContent = BOSSES[boss.kind].name; $('hud-boss-hp').style.width = `${(boss.hp / boss.max) * 100}%`; }
        // the Shard Beam gauge: charge from voxels, then the cooldown
        const ready = M.beam >= 1 && M.beamCd <= 0 && M.beamT <= 0;
        $('hud-beam-fill').style.width = `${(M.beamT > 0 ? M.beamT / SHARD_BEAM.time : M.beam) * 100}%`;
        $('hud-beam-text').textContent = M.beamT > 0 ? 'FIRE!!' : M.beamCd > 0 ? `COOLING ${Math.ceil(M.beamCd)}s` : ready ? 'BEAM READY' : 'SHARD BEAM';
        $('hud-beam').classList.toggle('cool', M.beamCd > 0 && M.beamT <= 0);
        $('hud-beam').classList.toggle('ready', ready);
        $('btn-beam').classList.toggle('ready', ready);
        $('btn-beam').style.opacity = ready ? 1 : 0.45;
        // about to go down: the screen edge burns red (the klaxon is in audio.js)
        $('danger').classList.toggle('on', M.hp > 0 && M.hp < M.maxHp * DANGER && !R.over);
        if (view) { this.arrows(R, view); this.reticle(R, view); }
    }

    /** Arrows to the objectives: bobbing over the ones on screen, pinned to the edge (with a distance) for the rest. */
    arrows(R, view) {
        const want = [];
        if (R.evac == null && !R.over) {
            for (const o of R.objectives) {
                if (o.done) continue;
                if (o.kind === 'rescue') for (const c of R.cages) { if (!c.freed) want.push({ x: c.x, y: c.y, h: 2.6, kind: 'cage', label: 'RESCUE' }); }
                if (o.kind === 'hives') for (const h of R.hives) { if (!h.dead) want.push({ x: h.x, y: h.y, h: 4.6, kind: 'hive', label: 'HIVE' }); }
                if (o.kind === 'boss') for (const e of R.enemies) { if (e.boss) want.push({ x: e.x, y: e.y, h: 4.5, kind: 'boss', label: 'BOSS' }); }
            }
        }
        const box = $('arrows');
        while (box.children.length < want.length) { const a = document.createElement('div'); a.className = 'arrow'; a.innerHTML = '<i></i><b></b>'; box.appendChild(a); }
        const W = innerWidth, H = innerHeight, top = 120, side = 34, bottom = this.touchOn ? 40 : 34;
        const M = R.mech;
        [...box.children].forEach((a, k) => {
            const t = want[k];
            a.hidden = !t;
            if (!t) return;
            const p = view.project(t.x, t.y, t.h);
            const on = p.inFront && p.x > side && p.x < W - side && p.y > top && p.y < H - bottom;
            a.className = `arrow ${t.kind}${on ? ' over' : ''}`;
            let x = p.x, y = p.y, rot = 0;
            if (!on) {
                // from the screen centre towards the target, clamped to the edge
                let dx = p.x - W / 2, dy = p.y - H / 2;
                if (!p.inFront) { dx = -dx; dy = -dy; }
                const kx = dx ? ((dx > 0 ? W - side : side) - W / 2) / dx : Infinity;
                const ky = dy ? ((dy > 0 ? H - bottom : top) - H / 2) / dy : Infinity;
                const k2 = Math.min(Math.abs(kx), Math.abs(ky));
                x = W / 2 + dx * k2; y = H / 2 + dy * k2;
                rot = Math.atan2(dy, dx) * 180 / Math.PI - 90;
            }
            a.style.transform = `translate(${x}px, ${y}px)`;
            a.firstChild.style.transform = `rotate(${rot}deg)`;
            a.lastChild.textContent = on ? t.label : `${t.label} ${Math.round(Math.hypot(t.x - M.x, t.y - M.y))}m`;
        });
    }

    /** The red reticle on whatever the player tapped to focus fire on. */
    reticle(R, view) {
        const el = $('reticle');
        const f = R.focus && (typeof R.focus.id === 'number' ? R.enemies.find((e) => e.id === R.focus.id) : R.hives.find((h) => h.id === R.focus.id && !h.dead));
        el.hidden = !f;
        if (!f) return;
        const p = view.project(f.x, f.y, f.boss ? 2.5 : f.cells ? 2 : 0.7);
        el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${f.boss || f.cells ? 1.6 : 1})`;
    }

    // ------------------------------------------------------------------ comms, banners, cut-ins
    comm(who, text, secs = 3.5, kind = 'cast') {
        const c = $('comm');
        $('comm-face').src = kind === 'crew' ? ART.crew(who) : ART.cast(who);
        $('comm-name').textContent = kind === 'crew' ? crewById(who).name : CAST[who].name;
        $('comm-text').textContent = text;
        c.hidden = false;
        c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
        clearTimeout(this._commT);
        this._commT = setTimeout(() => { c.hidden = true; }, secs * 1000);
    }
    banner(text, warn = false) {
        const b = $('banner');
        b.textContent = text;
        b.classList.toggle('warn', warn);
        b.hidden = false;
        b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
        clearTimeout(this._banT);
        this._banT = setTimeout(() => { b.hidden = true; }, 2300);
    }
    cutin() {
        if (this.settings.calm) return;
        const c = $('cutin');
        c.hidden = false;
        c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
        clearTimeout(this._cutT);
        this._cutT = setTimeout(() => { c.hidden = true; }, 1150);
    }
    flash(a) {
        if (this.settings.calm || window.A11Y?.reducedMotion) return;
        $('flash').style.opacity = Math.min(0.8, a);
    }
    speedlines(on) { $('speedlines').classList.toggle('on', !!on && !this.settings.calm); }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2700);
    }

    onEvents(G, events) {
        let gifts = null;
        for (const e of events) {
            switch (e.type) {
                case 'launch': this.banner('MISSION START'); this.comm('mirei', 'Shardframe Unit-07, you are cleared for launch. Good hunting, Kai.'); break;
                case 'rescue': if (e.crew !== 'civ') this.comm('mirei', `Hostage secured! Beaming ${crewById(e.crew).name} up now.`); else this.toast('Civilian rescued: +40 cr'); break;
                case 'hive_down': this.banner('HIVE DESTROYED'); break;
                case 'boss_in': this.banner('WARNING!!', true); this.comm('mirei', 'Warning! Massive Lattice signature closing in!'); break;
                case 'evac': this.banner('EVAC INBOUND'); this.comm('mirei', 'Objective complete! Evac is inbound. Hold on, Kai!'); break;
                case 'clear': this.banner('MISSION COMPLETE'); this.comm('mirei', 'Mission complete. Come home, Kai.'); break;
                case 'fail': this.banner('UNIT-07 DOWN', true); this.comm('mirei', 'Unit-07 is down! Pulling you out!'); break;
                case 'overdrive': this.cutin(); break;
                case 'shard_beam': this.banner('SHARD BEAM!!'); break;
                case 'gift_ready': if (G.mode !== 'mission') this.toast(`🎁 The crew left ${e.n} gift${e.n > 1 ? 's' : ''}`); break;
                case 'gift': (gifts ||= {})[e.crew] = { n: (gifts[e.crew]?.n || 0) + 1, gift: e.gift, amount: (gifts[e.crew]?.amount || 0) + e.amount }; break;
                case 'nope': this.toast(e.why === 'gold' ? 'Not enough credits.' : 'Already at the top level.'); break;
            }
        }
        // one line per crew member, however many gifts they left
        if (gifts) for (const [id, g] of Object.entries(gifts)) {
            this.toast(g.gift === 'gold' ? `💰 +${g.amount} cr from ${crewById(id).name}` : `${GIFTS[g.gift].icon} ${GIFTS[g.gift].name}${g.n > 1 ? ' ×' + g.n : ''} from ${crewById(id).name}`);
        }
    }
    /** Clear the battle's overlays (cut-in, banner, speed lines, flash). */
    clearOverlays() {
        for (const id of ['cutin', 'banner', 'reticle']) $(id).hidden = true;
        $('danger').classList.remove('on');
        for (const a of $('arrows').children) a.hidden = true;
        this.speedlines(false);
        $('flash').style.opacity = 0;
    }

    // ------------------------------------------------------------------ hangar
    renderHangar(G) {
        if (!G) return;
        this.G = G;
        const H = G.hangar;
        $('hg-gold').textContent = `${H.gold} cr`;
        const waiting = giftsWaiting(G);
        $('gift-badge').hidden = !waiting;
        $('gift-badge').textContent = waiting;
        for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t.dataset.tab === this.tab));
        for (const id of ['sortie', 'mech', 'crew']) $('tab-' + id).hidden = id !== this.tab;
        if (this.tab === 'sortie') this.renderSorties(G);
        else if (this.tab === 'mech') this.renderMech(G);
        else this.renderCrew(G);
    }

    renderSorties(G) {
        const next = !G.cleared[G.unlocked] ? G.unlocked : null;
        let html = '';
        for (const [sid, S] of Object.entries(SECTORS)) {
            html += `<div class="sector"><h3 style="background-image:url('${ART.sector(sid)}')">${esc(S.name)}</h3>`;
            for (const m of MISSIONS.filter((x) => x.sector === sid)) {
                const locked = m.id > G.unlocked, done = !!G.cleared[m.id];
                const kinds = m.objectives.map((o) => OBJ_TEXT(o, null)).join(' · ');
                html += `<button class="btn mission ${m.id === next ? 'next' : ''}" data-mission="${m.id}" ${locked ? 'disabled' : ''}>
                    <span class="n">${m.id}</span><span class="what">${esc(m.name)}${m.boss ? ' 👹' : ''}<small>${locked ? 'Locked' : esc(kinds)}</small></span>
                    <span class="tick">${done ? '✅' : locked ? '🔒' : '▶'}</span></button>`;
            }
            html += '</div>';
        }
        $('tab-sortie').innerHTML = html;
    }

    renderMech(G) {
        const H = G.hangar, L = H.loadout;
        const M = buildMech(G);
        let html = '<div class="slots">';
        for (const s of SLOTS) {
            const id = L[s];
            html += `<button class="btn slot" data-slot="${s}" aria-pressed="${s === this.slot}"><span class="ic">${id ? PARTS[id].icon : '➕'}</span>${esc(SLOT_NAME[s])}</button>`;
        }
        html += '</div>';
        const weapons = M.weapons.map((w) => PARTS[w.part].name + (w.lvl > 1 ? ` Lv${w.lvl}` : '')).join(', ') || 'none';
        html += `<div class="stats">HP <b>${Math.round(M.maxHp)}</b> · Shield <b>${Math.round(M.maxShield)}</b> · Speed <b>${M.speed.toFixed(1)}</b><br>Weapons: ${esc(weapons)}</div>`;
        const kind = SLOT_KIND[this.slot];
        for (const id of partIds(kind)) {
            const P = PARTS[id], lv = partLevel(G, id), cost = nextCost(G, id);
            const fitted = L[this.slot] === id;
            const elsewhere = !fitted && Object.entries(L).some(([s, p]) => p === id && s !== this.slot);
            let acts = '';
            if (cost != null) acts += `<button class="btn" data-do="buy" data-part="${id}" ${H.gold < cost ? 'disabled' : ''}>${lv ? 'Upgrade' : 'Buy'} ${cost} cr</button>`;
            if (lv && !fitted) acts += `<button class="btn" data-do="fit" data-part="${id}">${elsewhere ? 'Swap here' : 'Fit'}</button>`;
            if (fitted && (kind === 'arm' || kind === 'shoulder')) acts += `<button class="btn" data-do="remove" data-part="${id}">Remove</button>`;
            html += `<div class="part ${fitted ? 'fitted' : ''}"><span class="ic">${P.icon}</span>
                <div class="info"><b>${esc(P.name)}</b> <span class="lv">${lv ? `Lv ${lv}/3` : 'not owned'}${fitted ? ' · fitted' : ''}</span><br>${esc(P.desc)}</div>
                <div class="acts">${acts}</div></div>`;
        }
        $('tab-mech').innerHTML = html;
    }

    renderCrew(G) {
        const H = G.hangar;
        const waiting = giftsWaiting(G);
        let html = `<button id="collect-all" class="btn primary" ${waiting ? '' : 'disabled'}>Collect ${waiting || ''} gift${waiting === 1 ? '' : 's'}</button>`;
        const boosts = BOOSTS.filter((k) => H.boosts[k] > 0).map((k) => `${GIFTS[k].icon} ${GIFTS[k].name} ×${H.boosts[k]}`);
        html += `<p class="boosts">${boosts.length ? 'Ready for the next sortie (one of each is used): ' + boosts.join(' · ') : 'Gifts that boost a sortie wait here until you launch.'}</p><div class="crewgrid">`;
        for (const c of CREW) {
            const me = H.crew.find((x) => x.id === c.id);
            if (!me) {
                const m = MISSIONS.find((x) => x.objectives.some((o) => o.crew?.includes(c.id)));
                html += `<div class="crew missing"><img src="${ART.crew(c.id)}" alt=""><b>???</b>Rescue in sortie ${m.id}</div>`;
                continue;
            }
            const nxt = nextGiftIn(G, me);
            html += `<button class="crew btn ${me.stored ? 'ready' : ''}" data-crew="${c.id}"><img src="${ART.crew(c.id)}" alt="">
                <b>${esc(c.name)}</b>${esc(c.role)}<div class="gifts">${GIFTS[c.gift].icon.repeat(me.stored) || '…'}</div>
                <small>${me.stored >= GIFT_CAP ? 'Tray full' : 'Next ' + mmss(nxt)}</small></button>`;
        }
        $('tab-crew').innerHTML = html + '</div>';
    }

    // ------------------------------------------------------------------ briefing
    openBriefing(G, id) {
        const m = missionById(id);
        this.briefId = id;
        $('brief-art').style.backgroundImage = `url('${ART.sector(m.sector)}')`;
        $('brief-name').textContent = `Sortie ${m.id}: ${m.name}`;
        $('brief-text').textContent = m.brief;
        $('brief-obj').innerHTML = m.objectives.map((o) => `<li>${esc(OBJ_TEXT(o, null))}</li>`).join('') + (m.boss ? '' : '<li>Then hold out until the lift arrives</li>');
        const ready = BOOSTS.filter((k) => G.hangar.boosts[k] > 0).map((k) => `${GIFTS[k].icon} ${GIFTS[k].desc}`);
        $('brief-boosts').textContent = ready.length ? 'Crew gifts for this sortie: ' + ready.join(' · ') : (G.cleared[id] ? `Flown before: the reward is ${m.reward} cr again.` : `Reward: ${m.reward} cr.`);
        this.openScreen('briefing');
    }

    // ------------------------------------------------------------------ level-up
    openLevelUp(R) {
        $('cards').innerHTML = R.choice.map((k, i) => {
            const U = UPGRADES[k], n = (R.mods[k] || 0) + 1;
            return `<button class="btn card-btn" data-pick="${i}"><span class="ic">${U.icon}</span><b>${esc(U.name)}</b>${esc(U.desc)}<span class="k">${i + 1} · rank ${n}/${U.max}</span></button>`;
        }).join('');
        this.openScreen('levelup');
    }

    // ------------------------------------------------------------------ debrief
    openDebrief(G) {
        const D = G.debrief;
        if (!D) return;
        const m = missionById(D.mission);
        $('db-title').textContent = D.win ? `Mission complete: ${m.name}` : D.aborted ? 'Sortie aborted' : 'Unit-07 went down';
        const stats = [['Reward', `${D.reward} cr`], ['Salvage', `${D.salvage} cr${D.win ? '' : ' (half kept)'}`], ['Kills', D.kills], ['Time', mmss(D.time)], ['Level', D.lvl],
            ['Voxels', Object.values(D.collected).reduce((a, b) => a + b, 0)]];
        $('db-stats').innerHTML = stats.map(([k, v]) => `<div>${k}<br><span>${esc(v)}</span></div>`).join('');
        $('db-crew').innerHTML = D.joined.map((id) => {
            const c = crewById(id);
            return `<div class="joined"><img class="face" src="${ART.crew(id)}" alt=""><div><b>${esc(c.name)} joined the crew!</b><p>${esc(c.role)}. Leaves you ${GIFTS[c.gift].icon} ${esc(GIFTS[c.gift].name)}${c.gift === 'gold' ? '' : ` (${esc(GIFTS[c.gift].desc)})`} every ${Math.round(c.every / 60)} minutes.</p></div></div>`;
        }).join('') + (D.win && D.first && D.mission < 12 ? `<p>Sortie ${D.mission + 1} is open.</p>` : '');
        this.openScreen('debrief');
    }
}
