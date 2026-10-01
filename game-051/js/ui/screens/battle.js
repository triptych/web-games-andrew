/**
 * battle.js — the battle director. Runs the simulation one turn at a time and
 * turns its events into 3D animation, effects, floating numbers and HUD state.
 * Auto mode lets the AI play; manual mode waits for skill + target taps.
 */

import * as THREE from 'three';
import { h, app, btn, icon, elIcon, modal, rewardGrid, heroCard, stars, num, toast, $ } from '../dom.js';
import { G, changed } from '../../game.js';
import { go, back } from '../app.js';
import { peekStage } from '../stages.js';
import { toScreen, raycast } from '../../view/engine.js';
import { gestures, canvasEl } from '../input.js';
import { createBattle, nextTurn, act, aiChoose, drainEvents, autoSpell, castSpell, canCast, usableSkills, living, unitById } from '../../sim/battle.js';
import { buildBattle, finishBattle, staminaCost, stageInfo, spireInfo, riftInfo } from '../../sim/content.js';
import { heroById, rngOf } from '../../sim/state.js';
import { STATUS, ELEMENT } from '../../data/core.js';
import { REGIONS, SPELLS, TOTAL_STAGES } from '../../data/world.js';
import { requestPortrait, portraitSrc } from '../portraits.js';
import { sfx, playMusic } from '../../audio.js';
import { skillDescription } from '../skilltext.js';

const BIOME_BY_REGION = Object.fromEntries(REGIONS.map((r) => [r.id, { ...r.biome, leaf: r.id === 'frost' ? '#2f7a4a' : undefined, snow: r.id === 'frost', dark: ['gloom', 'crystal', 'throne'].includes(r.id), stone: r.id === 'sunspire' ? '#e8d8b0' : '#5a4a58', rock: r.id === 'ember' ? '#5a4848' : r.id === 'frost' ? '#a8b8d0' : undefined, crystal: r.id === 'crystal' ? '#c87aff' : '#bfefff', skyLight: r.id === 'gloom' ? '#8a7aff' : undefined }]));
const ARENA_BIOME = { ground: '#d8c08a', ground2: '#b89a64', sky: ['#ffb070', '#ffe8c0'], fog: '#ffe0b0', props: ['pillar', 'pillar', 'brazier', 'ruin', 'rock'], particles: 'motes', stone: '#e8dcc0' };
const SPIRE_BIOME = { ground: '#4a3a7a', ground2: '#2a2050', sky: ['#2a1a5a', '#9a7aff'], fog: '#3a2a6a', props: ['crystal', 'pillar', 'crystal', 'brazier'], particles: 'sparkles', dark: true, stone: '#8a80b0', crystal: '#c8a0ff' };

function biomeFor(mode, p) {
    if (mode === 'campaign') return BIOME_BY_REGION[REGIONS[Math.floor(p.idx / 8)].id];
    if (mode === 'arena') return ARENA_BIOME;
    if (mode === 'spire') return SPIRE_BIOME;
    if (mode === 'rift') {
        const map = { fire: 'ember', water: 'tide', wind: 'verdant', light: 'sunspire', dark: 'gloom', gold: 'sunspire', gear: 'throne' };
        return BIOME_BY_REGION[map[p.id]];
    }
    return BIOME_BY_REGION.verdant;
}

const MELEE = new Set(['slash', 'slam', 'punch', 'multi']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const battleScreen = {
    id: 'battle',
    stage: 'battle',
    chrome: 'none',
    enter(root, params) {
        const S = G.S;
        this.params = params;
        this.root = root;
        this.alive = true;
        this.paused = false;
        this.speed = S.settings.speed || 1;
        this.auto = S.settings.auto !== false;
        this.plates = new Map();
        this.pendingSpell = null;
        this.choice = null;
        this.st = peekStage('battle');
        const st = this.st;
        st.clear();
        st.timeScale = this.speed;
        st.setBiome(biomeFor(params.mode, params), 7 + (params.idx || params.floor || 3));
        if (params.mode === 'campaign' || params.mode === 'rift') {
            S.res.stamina -= staminaCost(params.mode, params);
            if (S.res.stamina < 0) S.res.stamina = 0;
        }
        if (params.mode === 'arena') S.arena.tickets--;
        changed('stamina');
        const cfg = buildBattle(S, params.mode, params, params.team);
        this.B = createBattle(cfg);
        this.boss = cfg.waves.some((w) => w.some((u) => u.boss));
        playMusic('battle');
        this.buildHud();
        // allies + first wave
        const allies = this.B.allies.map((u) => ({ uid: u.uid, side: 'A', view: u.view, boss: false }));
        st.addUnits(allies);
        for (const u of this.B.allies) this.makePlate(u);
        const first = drainEvents(this.B).find((e) => e.t === 'wave');
        this.spawnWave(first, true);
        this.detach = gestures(canvasEl(), { onTap: (x, y) => this.tapWorld(x, y) });
        this.run();
    },
    exit() {
        this.alive = false;
        if (this.detach) this.detach();
        for (const p of this.plates.values()) p.el.remove();
        this.plates.clear();
        $('#labels').innerHTML = '';
        this.st.focus(null);
        this.st.timeScale = 1;
    },

    // ------------------------------------------------------------ HUD
    buildHud() {
        const root = this.root;
        const S = G.S;
        const hud = h('div.battle-hud');
        this.waveEl = h('div.bh-wave', 'Wave 1');
        this.turnbar = h('div.bh-turnbar');
        this.autoBtn = h('button.bh-btn', { type: 'button', 'aria-label': 'Auto battle', html: `${icon('auto')}<span class="lbl">AUTO</span>`, onclick: () => this.toggleAuto() });
        this.speedBtn = h('button.bh-btn', { type: 'button', 'aria-label': 'Battle speed', onclick: () => this.cycleSpeed() });
        const pause = h('button.bh-btn', { type: 'button', 'aria-label': 'Pause', html: icon('pause'), onclick: () => this.pauseMenu() });
        this.topEl = h('div.bh-top', this.waveEl, this.turnbar, h('div.bh-btns', this.autoBtn, this.speedBtn, pause));
        app(hud, this.topEl);
        this.mana = h('div.bar.tall.mana-bar', h('div.bar-fill'), h('span.bar-text', 'Mana'));
        this.spellRow = h('div.bh-spells');
        this.skillRow = h('div.bh-skills');
        app(hud, this.mana, h('div.bh-bottom', this.spellRow, this.skillRow));
        this.hintEl = h('div.manual-hint', { hidden: true });
        app(hud, this.hintEl);
        app(root, hud);
        this.hud = hud;
        this.spellBtns = [];
        for (const id of this.B.spells) {
            const sp = SPELLS[id];
            const b = h('button.spell-btn', { type: 'button', style: { '--sp': sp.color }, 'aria-label': sp.name, onclick: () => this.trySpell(id) }, h('div.sp-fill'), h('span', sp.name), h('span.sp-cost', `${sp.cost}`));
            this.spellRow.append(b);
            this.spellBtns.push({ id, b });
        }
        this.refreshButtons();
    },
    refreshButtons() {
        this.autoBtn.classList.toggle('on', this.auto);
        this.speedBtn.innerHTML = `${icon('speed')}<span class="lbl">${this.speed}×</span>`;
        this.speedBtn.classList.toggle('on', this.speed > 1);
    },
    toggleAuto() {
        this.auto = !this.auto;
        G.S.settings.auto = this.auto;
        this.refreshButtons();
        if (this.auto && this.choice) { const c = this.choice; this.choice = null; this.clearSkillUi(); c.resolve(null); }
        sfx('click');
    },
    cycleSpeed() {
        this.speed = this.speed >= 3 ? 1 : this.speed + 1;
        G.S.settings.speed = this.speed;
        this.st.timeScale = this.speed;
        this.refreshButtons();
        sfx('click');
    },
    pauseMenu() {
        this.paused = true;
        modal({
            title: 'Paused', body: h('p.muted', 'Retreating ends the battle as a loss. Stamina spent is not returned.'),
            buttons: [{ label: 'Retreat', cls: 'red', onClick: () => { this.alive = false; this.finish(false, true); } }, { label: 'Resume', cls: 'gold' }],
            onClose: () => { this.paused = false; },
        });
    },

    makePlate(u) {
        const el = h('div.uplate', { class: `${u.side}${u.boss ? ' boss' : ''}`, onclick: () => this.tapUnit(u.uid) },
            h('div.up-name', { html: `${elIcon(u.el)}${u.name}` }),
            h('div.up-hp', h('div.lag'), h('div.fill'), h('div.shield')),
            h('div.up-atb', h('div.fill')),
            h('div.up-st'));
        $('#labels').append(el);
        const p = { el, hp: el.querySelector('.up-hp .fill'), lag: el.querySelector('.up-hp .lag'), shield: el.querySelector('.up-hp .shield'), atb: el.querySelector('.up-atb .fill'), st: el.querySelector('.up-st'), u, shown: u.hp, max: u.maxHp, statuses: new Map() };
        this.plates.set(u.uid, p);
        this.setHp(u.uid, u.hp);
        // turn-bar portrait
        const tb = h('div.tb-unit', { class: u.side }, h('img', { alt: '' }));
        const who = u.view.kind === 'hero' ? { seed: u.view.seed || u.uid, look: u.view.look } : { seed: u.view.seed || u.uid, view: u.view };
        const img = tb.querySelector('img');
        const src = portraitSrc(who);
        if (src) img.src = src; else requestPortrait(who, (s) => { img.src = s; });
        this.turnbar.append(tb);
        p.tb = tb;
        return p;
    },
    setHp(uid, hp) {
        const p = this.plates.get(uid);
        if (!p) return;
        p.shown = hp;
        const f = Math.max(0, hp / p.max) * 100;
        p.hp.style.width = f + '%';
        p.lag.style.width = f + '%';
    },
    renderStatuses(uid) {
        const p = this.plates.get(uid);
        if (!p) return;
        p.st.innerHTML = '';
        p.w = 0;
        for (const [id, n] of p.statuses) {
            const S = STATUS[id];
            const arrow = ['atkUp', 'defUp', 'spdUp', 'critUp'].includes(id) ? '▲' : ['atkDown', 'defDown', 'slow'].includes(id) ? '▼' : '';
            p.st.append(h('span.st-ico', { class: S.buff ? 'buff' : 'debuff', style: { '--c': S.color }, title: `${S.name}: ${S.desc}` }, S.short + arrow + (n > 1 ? '×' + n : '')));
        }
        const sh = p.statuses.has('shield');
        const u = unitById(this.B, uid);
        p.shield.style.width = sh && u ? Math.min(100, ((u.statuses.find((s) => s.id === 'shield') || { value: 0 }).value / p.max) * 100) + '%' : '0';
    },

    update(dt) {
        if (!this.B) return;
        const st = this.st;
        const v = new THREE.Vector3();
        const top = this.topEl ? this.topEl.getBoundingClientRect().bottom + 4 : 0;
        const W = this.root.clientWidth || innerWidth;
        const placed = [];
        for (const [uid, p] of this.plates) {
            const e = st.get(uid);
            if (!e || !e.actor.root.visible) { p.el.style.display = 'none'; if (p.tb) p.tb.style.display = 'none'; continue; }
            st.anchor(uid, 'head', v);
            const s = toScreen(v, st.camera);
            if (!s) { p.el.style.display = 'none'; continue; }
            p.el.style.display = '';
            // keep the whole plate on screen and below the top HUD (wide names and bosses near the edges)
            if (!p.w) { p.w = Math.max(p.el.offsetWidth, p.el.querySelector('.up-name').offsetWidth); p.h = p.el.offsetHeight; }
            placed.push({ p, x: Math.min(W - 4 - p.w / 2, Math.max(4 + p.w / 2, s.x)), y: Math.max(top + p.h, s.y) });
            const u = unitById(this.B, uid);
            if (u) {
                p.atb.style.width = Math.min(100, u.atb * 100) + '%';
                if (p.tb) { p.tb.style.display = u.alive ? '' : 'none'; p.tb.style.left = `calc(18px + ${Math.min(1, u.atb)} * (100% - 36px))`; }
            }
        }
        // plates are anchored by their bottom edge; top-most first, push any plate that collides below the one it hits
        placed.sort((a, b) => a.y - a.p.h - (b.y - b.p.h));
        for (let i = 0; i < placed.length; i++) {
            const a = placed[i];
            for (let j = 0; j < i; j++) {
                const b = placed[j];
                if (Math.abs(a.x - b.x) < (a.p.w + b.p.w) / 2 && a.y - a.p.h < b.y && a.y > b.y - b.p.h) { a.y = b.y + a.p.h + 2; j = -1; }
            }
            a.p.el.style.left = a.x + 'px';
            a.p.el.style.top = a.y + 'px';
        }
        const m = this.B.mana / this.B.manaMax;
        this.mana.querySelector('.bar-fill').style.width = m * 100 + '%';
        this.mana.querySelector('.bar-text').textContent = `Mana ${Math.floor(this.B.mana)}`;
        for (const { id, b } of this.spellBtns) {
            const ok = canCast(this.B, id);
            b.classList.toggle('ready', ok);
            b.querySelector('.sp-fill').style.height = Math.min(100, (this.B.mana / SPELLS[id].cost) * 100) + '%';
        }
    },

    // ------------------------------------------------------------ flow
    async wait(ms) {
        const end = performance.now() + ms / this.speed;
        while (performance.now() < end || this.paused) { if (!this.alive) return; await sleep(16); }
    },

    async run() {
        const B = this.B;
        await this.wait(700);
        while (this.alive && !B.over) {
            while (this.paused) { await sleep(50); if (!this.alive) return; }
            // player-queued spell
            if (this.pendingSpell) { const s = this.pendingSpell; this.pendingSpell = null; await this.doSpell(s.id, s.target); continue; }
            if (this.auto) {
                const id = autoSpell(B);
                if (id) { G.S.counters.spellsCast = (G.S.counters.spellsCast || 0) + 1; await this.play(drainEvents(B)); continue; }
            }
            const { unit, skip } = nextTurn(B);
            await this.play(drainEvents(B));
            if (!this.alive || B.over) break;
            if (skip || !unit) continue;
            let choice;
            if (unit.side === 'A' && !this.auto) choice = await this.askPlayer(unit);
            if (!this.alive) return;
            if (!choice) choice = aiChoose(B, unit);
            act(B, unit, choice[0], choice[1]);
            await this.play(drainEvents(B));
        }
        if (this.alive) this.finish(B.win);
    },

    // ------------------------------------------------------------ manual play
    askPlayer(unit) {
        return new Promise((resolve) => {
            this.choice = { unit, resolve, skill: null };
            const e = this.st.get(unit.uid);
            this.plates.get(unit.uid)?.el.classList.add('turn');
            this.skillRow.innerHTML = '';
            for (const { s, i, ok } of usableSkills(unit)) {
                const kind = s.kind === 'ult' ? 'Ultimate' : s.kind === 'active' ? 'Skill' : 'Attack';
                const b = h('button.skill-btn', { type: 'button', class: s.kind === 'ult' ? 'ult' : '', disabled: ok ? null : true, title: skillDescription(s.tpl, s.lvl) },
                    h('span.sk-kind', kind), h('span', s.name), s.cdLeft > 0 ? h('span.sk-cd', String(s.cdLeft)) : null);
                b.addEventListener('click', () => this.pickSkill(i, b));
                this.skillRow.append(b);
            }
            this.hint(`${unit.name}'s turn — choose a skill`);
            if (e) e.actor.flash('#ffe08a', 0.4);
        });
    },
    pickSkill(i, b) {
        const c = this.choice;
        if (!c) return;
        sfx('click');
        const s = c.unit.skills[i];
        if (s.tpl.tgt === 'enemy') {
            if (c.skill === i) { this.resolveChoice([i, 0]); return; } // second tap: auto-target
            c.skill = i;
            for (const x of this.skillRow.children) x.classList.remove('sel');
            b.classList.add('sel');
            this.markTargets(true);
            this.hint('Tap an enemy (or tap the skill again to auto-target)');
        } else this.resolveChoice([i, 0]);
    },
    markTargets(on) {
        for (const [uid, p] of this.plates) {
            const u = unitById(this.B, uid);
            p.el.classList.toggle('targetable', on && u && u.side === 'E' && u.alive);
        }
    },
    tapUnit(uid) {
        const u = unitById(this.B, uid);
        if (this.spellTarget) { if (u && u.side === 'E' && u.alive) { const id = this.spellTarget; this.spellTarget = null; this.markTargets(false); this.hint(null); this.pendingSpell = { id, target: uid }; } return; }
        const c = this.choice;
        if (!c || c.skill === null || !u || u.side !== 'E' || !u.alive) return;
        this.resolveChoice([c.skill, uid]);
    },
    tapWorld(x, y) {
        const hits = raycast(x, y, [...this.st.actors.values()].map((e) => e.rig.root), this.st.camera);
        if (!hits.length) return;
        for (const e of this.st.actors.values()) {
            let o = hits[0].object;
            while (o) { if (o === e.rig.root) { this.tapUnit(e.uid); return; } o = o.parent; }
        }
    },
    resolveChoice(choice) {
        const c = this.choice;
        if (!c) return;
        this.choice = null;
        this.clearSkillUi();
        c.resolve(choice);
    },
    clearSkillUi() {
        this.skillRow.innerHTML = '';
        this.markTargets(false);
        this.hint(null);
        for (const p of this.plates.values()) p.el.classList.remove('turn');
    },
    hint(text) {
        this.hintEl.hidden = !text;
        if (text) this.hintEl.textContent = text;
    },
    trySpell(id) {
        if (!canCast(this.B, id)) { sfx('error'); toast(`Not enough mana for ${SPELLS[id].name}.`); return; }
        if (SPELLS[id].tgt === 'enemy') {
            this.spellTarget = id;
            this.markTargets(true);
            this.hint(`${SPELLS[id].name}: tap an enemy`);
            return;
        }
        this.pendingSpell = { id };
        // if waiting on the player, cast now and keep waiting
        if (this.choice) { const s = this.pendingSpell; this.pendingSpell = null; this.doSpell(s.id); }
    },
    async doSpell(id, target) {
        if (!castSpell(this.B, id, target)) return;
        G.S.counters.spellsCast = (G.S.counters.spellsCast || 0) + 1;
        await this.play(drainEvents(this.B));
    },

    // ------------------------------------------------------------ waves
    spawnWave(ev, first = false) {
        const B = this.B;
        if (!first) this.st.removeSide('E');
        for (const [uid, p] of [...this.plates]) if (p.u.side === 'E') { p.el.remove(); p.tb && p.tb.remove(); this.plates.delete(uid); }
        const units = ev.enemies.map((uid) => unitById(B, uid));
        const entries = this.st.addUnits(units.map((u) => ({ uid: u.uid, side: 'E', view: u.view, boss: u.boss })));
        entries.forEach((e, i) => e.actor.spawn(0.1 + i * 0.12));
        for (const u of units) this.makePlate(u);
        this.waveEl.textContent = `Wave ${ev.n}/${ev.of}`;
        // allies: fresh wave clears statuses
        for (const u of B.allies) { const p = this.plates.get(u.uid); if (p) { p.statuses.clear(); this.renderStatuses(u.uid); } }
        if (!first || ev.of > 1) this.banner(units.some((u) => u.boss) ? `Boss: ${units.find((u) => u.boss).name}` : `Wave ${ev.n}`, units.some((u) => u.boss));
        const boss = units.find((u) => u.boss);
        if (boss) {
            const e = this.st.get(boss.uid);
            if (e) { this.st.focus(e.actor.root.position.clone().setY(1), 0.35); this.st.shake(0.25, 0.6); sfx('boom'); setTimeout(() => this.st.focus(null), 1500 / this.speed); }
            playMusic('boss');
        }
    },
    banner(text, big = false) {
        const b = h('div.turn-banner', { class: big ? 'ult' : '' }, text);
        this.hud.append(b);
        setTimeout(() => b.remove(), 1400);
    },
    number(uid, text, cls) {
        const v = this.st.anchor(uid, 'chest', new THREE.Vector3());
        const s = toScreen(v, this.st.camera);
        if (!s) return;
        const el = h('div.dmg', { class: cls }, text);
        el.style.left = s.x + (Math.random() - 0.5) * 30 + 'px';
        el.style.top = s.y + (Math.random() - 0.5) * 16 + 'px';
        $('#labels').append(el);
        setTimeout(() => el.remove(), 1000);
    },

    // ------------------------------------------------------------ event playback
    async play(events) {
        let i = 0;
        while (i < events.length && this.alive) {
            const e = events[i];
            if (e.t === 'skill') {
                const j = events.findIndex((x, k) => k > i && (x.t === 'counter' || x.t === 'wave' || x.t === 'end' || x.t === 'skill' || x.t === 'spell'));
                const end = j < 0 ? events.length : j;
                await this.playSkill(e, events.slice(i + 1, end));
                i = end;
                continue;
            }
            if (e.t === 'spell') {
                const j = events.findIndex((x, k) => k > i && (x.t === 'wave' || x.t === 'end' || x.t === 'skill'));
                const end = j < 0 ? events.length : j;
                await this.playSpell(e, events.slice(i + 1, end));
                i = end;
                continue;
            }
            if (e.t === 'counter') {
                const j = events.findIndex((x, k) => k > i && (x.t === 'counter' || x.t === 'wave' || x.t === 'end' || x.t === 'skill'));
                const end = j < 0 ? events.length : j;
                await this.playCounter(e, events.slice(i + 1, end));
                i = end;
                continue;
            }
            await this.apply(e);
            i++;
        }
    },

    /** Applies one "result" event to the view (numbers, bars, statuses, deaths). */
    async apply(e, fxOpts = {}) {
        const st = this.st;
        const ent = e.u ? st.get(e.u) : null;
        switch (e.t) {
            case 'turn': {
                for (const p of this.plates.values()) p.el.classList.remove('turn');
                const p = this.plates.get(e.u);
                if (p) p.el.classList.add('turn');
                break;
            }
            case 'dmg': {
                this.setHp(e.u, e.hp);
                if (e.dot) { this.number(e.u, num(e.v), 'dot'); st.fx.burst(st.anchor(e.u, 'chest', new THREE.Vector3()), e.dot === 'burn' ? '#ff7a2a' : '#8ad64a', 8, { speed: 1 }); if (ent) ent.actor.hit(false); await this.wait(260); break; }
                const cls = e.crit ? 'crit' : e.glance ? 'dis glance' : e.adv > 0 ? 'adv' : e.adv < 0 ? 'dis' : '';
                this.number(e.u, num(e.v), cls);
                if (ent) ent.actor.hit(e.crit);
                sfx(e.crit ? 'crit' : e.glance ? 'glance' : 'hit');
                if (e.crit) st.shake(0.35, 0.25);
                const at = st.anchor(e.u, 'chest', new THREE.Vector3());
                st.fx.burst(at, fxOpts.color || '#ffffff', e.crit ? 22 : 10, { speed: e.crit ? 4 : 2.5, size: 0.16 });
                if (e.absorbed) this.number(e.u, `-${num(e.absorbed)}`, 'txt');
                break;
            }
            case 'heal':
                this.setHp(e.u, e.hp);
                if (!e.quiet || e.v > 0) this.number(e.u, '+' + num(e.v), 'heal');
                st.fx.rise(st.anchor(e.u, 'feet', new THREE.Vector3()), '#8af08a', 8);
                break;
            case 'status': {
                const p = this.plates.get(e.u);
                if (!p) break;
                if (e.add) {
                    p.statuses.set(e.s, e.stacks || 1);
                    const S = STATUS[e.s];
                    if (!S.buff) this.number(e.u, S.name, 'txt bad');
                    if (e.s === 'stun' && ent) ent.actor.setStunned(true);
                    if (e.s === 'shield') st.fx.shield(st.anchor(e.u, 'chest', new THREE.Vector3()), '#9fe7ff', { radius: 0.6 });
                } else {
                    p.statuses.delete(e.s);
                    if (e.s === 'stun' && ent) ent.actor.setStunned(false);
                }
                this.renderStatuses(e.u);
                break;
            }
            case 'resist': this.number(e.u, e.immune ? 'Immune' : 'Resisted', 'txt'); break;
            case 'atb': if (e.v < 0) this.number(e.u, 'ATB ▼', 'txt bad'); else if (e.v >= 0.2) this.number(e.u, 'ATB ▲', 'txt good'); break;
            case 'stunned': this.number(e.u, 'Stunned', 'txt bad'); if (ent) { ent.actor.flash('#ffe14a', 0.3); } await this.wait(420); break;
            case 'death':
                if (ent) { ent.actor.die(); sfx('death'); st.fx.burst(st.anchor(e.u, 'chest', new THREE.Vector3()), '#c8b8ff', 26, { speed: 2, gravity: 1.5 }); }
                this.setHp(e.u, 0);
                { const p = this.plates.get(e.u); if (p) { p.statuses.clear(); this.renderStatuses(e.u); } }
                await this.wait(260);
                break;
            case 'revive':
                if (ent) { ent.actor.revive(); st.fx.pillar(ent.actor.root.position, '#fff4b0', { radius: 0.5, height: 3 }); sfx('heal'); }
                this.setHp(e.u, e.hp);
                this.number(e.u, 'Revived!', 'txt good');
                await this.wait(400);
                break;
            case 'endure': this.number(e.u, 'Endure!', 'txt good'); break;
            case 'angel': this.number(e.u, 'Guardian Angel!', 'txt good'); if (ent) st.fx.pillar(ent.actor.root.position, '#fff4b0', { radius: 0.4, height: 2.5, dur: 0.6 }); break;
            case 'enrage': this.number(e.u, 'ENRAGED', 'crit'); if (ent) { ent.actor.flash('#ff3a3a', 0.6); st.fx.burst(st.anchor(e.u, 'chest', new THREE.Vector3()), '#ff3a3a', 40, { speed: 4 }); } st.shake(0.5, 0.5); sfx('boom'); await this.wait(500); break;
            case 'extra': this.number(e.u, 'Extra Turn!', 'txt good'); break;
            case 'wave': await this.wait(600); this.spawnWave(e); await this.wait(900); break;
            case 'mana': break;
            case 'end': break;
            default: break;
        }
    },

    async playSkill(e, results) {
        const st = this.st;
        const att = st.get(e.u);
        if (!att) { for (const r of results) await this.apply(r); return; }
        const el = ELEMENT[e.el] || ELEMENT.fire;
        const color = el.color;
        const isUlt = e.kind === 'ult';
        const targets = e.targets.map((uid) => st.get(uid)).filter(Boolean);
        const first = targets[0];
        if (isUlt) {
            this.banner(e.s, true);
            st.focus(att.actor.root.position, 0.3);
            st.fx.pillar(att.actor.root.position, color, { radius: 0.5, height: 2.6, dur: 0.6 });
            sfx('spell');
            await this.wait(450);
            st.focus(null);
        } else if (e.kind === 'active') this.number(e.u, e.s, 'txt');
        const dmgs = results.filter((r) => r.t === 'dmg' && !r.dot && !r.reflect);
        const others = results.filter((r) => !(r.t === 'dmg' && !r.dot && !r.reflect));
        const applyFor = async (uid, list) => { for (const r of list.filter((x) => x.u === uid)) await this.apply(r, { color }); };
        if (e.support) {
            att.actor.cast(0.6);
            sfx(e.fx === 'heal' ? 'heal' : e.fx === 'shield' ? 'shield' : 'buff');
            await this.wait(300);
            const friends = [...st.actors.values()].filter((x) => x.side === att.side && !x.actor.dead);
            for (const f of friends) {
                const p = f.actor.root.position;
                if (e.fx === 'heal') st.fx.rise(p, '#8af08a', 14);
                else if (e.fx === 'shield') st.fx.shield(st.anchor(f.uid, 'chest', new THREE.Vector3()), '#9fe7ff', { radius: 0.6 });
                else st.fx.rise(p, el.glow, 12, { speed: 2 });
            }
            if (e.fx === 'heal') st.fx.ring(att.actor.root.position, '#8af08a', { to: 3 });
            for (const r of others) await this.apply(r);
            await this.wait(250);
            return;
        }
        if (MELEE.has(e.fx) && first && !e.targets.every((t) => unitById(this.B, t)?.side === att.side)) {
            sfx('swing');
            const ret = await att.actor.lunge(first.actor.root.position, e.fx === 'slam' ? 0.85 : 0.75, 0.5 / Math.sqrt(this.speed));
            const hitsPer = new Map();
            for (const d of dmgs) {
                const tgt = st.get(d.u);
                const at = st.anchor(d.u, 'chest', new THREE.Vector3());
                if (e.fx === 'slam') { st.fx.ring(tgt ? tgt.actor.root.position : at, color, { to: 1.6, dur: 0.4 }); st.shake(0.2, 0.2); }
                else if (e.fx === 'punch') st.fx.burst(at, '#ffffff', 10, { speed: 3 });
                else st.fx.slash(at, color, { scale: 1.1 });
                await this.apply(d, { color });
                hitsPer.set(d.u, (hitsPer.get(d.u) || 0) + 1);
                await this.wait(dmgs.length > 1 ? 120 : 160);
            }
            for (const r of others) await this.apply(r, { color });
            await ret();
            return;
        }
        // ranged / magic
        if (e.fx === 'arrow' || e.fx === 'rain') att.actor.shoot(0.4); else att.actor.cast(0.55);
        sfx(e.fx === 'arrow' || e.fx === 'rain' ? 'arrow' : 'magic');
        await this.wait(220);
        const from = st.anchor(e.u, 'chest', new THREE.Vector3());
        if (e.fx === 'meteor') {
            for (const t of targets) st.fx.meteor(t.actor.root.position.clone(), color);
            await this.wait(700);
            sfx('boom');
            st.shake(0.45, 0.4);
        } else if (e.fx === 'nova') {
            const c = new THREE.Vector3();
            targets.forEach((t) => c.add(t.actor.root.position));
            c.divideScalar(Math.max(1, targets.length));
            st.fx.ring(c, color, { to: 3.2, dur: 0.5 });
            st.fx.burst(c.clone().setY(0.6), color, 40, { speed: 4 });
            sfx('boom');
            st.shake(0.25, 0.25);
            await this.wait(150);
        } else if (e.fx === 'beam') {
            if (first) { st.fx.beam(from, st.anchor(first.uid, 'chest', new THREE.Vector3()), color, { width: isUlt ? 0.22 : 0.12, dur: 0.5 }); await this.wait(220); }
        } else if (e.fx === 'vine') {
            for (const t of targets) st.fx.vine(t.actor.root.position, '#5ad04a');
            await this.wait(300);
        } else if (e.fx === 'rain') {
            for (const t of targets) for (let k = 0; k < 3; k++) st.fx.projectile(t.actor.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 5, (Math.random() - 0.5) * 0.6)), st.anchor(t.uid, 'chest', new THREE.Vector3()), { color, arrow: true, arc: 0, speed: 18 });
            await this.wait(350);
        } else if (e.fx === 'note') {
            st.fx.notes(from, color, 3);
            await Promise.all(targets.map((t) => st.fx.projectile(from, st.anchor(t.uid, 'chest', new THREE.Vector3()), { color, glyph: 'note', size: 0.14, speed: 9 })));
        } else {
            // bolt / arrow: one projectile per hit, staggered
            const seq = dmgs.length ? dmgs : targets.map((t) => ({ u: t.uid }));
            for (let k = 0; k < seq.length; k++) {
                const t = st.get(seq[k].u);
                if (!t) continue;
                const to = st.anchor(t.uid, 'chest', new THREE.Vector3());
                const p = st.fx.projectile(from, to, { color: e.fx === 'arrow' ? '#ffffff' : color, arrow: e.fx === 'arrow', size: isUlt ? 0.2 : 0.12, speed: e.fx === 'arrow' ? 20 : 13 });
                if (k === seq.length - 1 || seq.length <= 1) await p; else await this.wait(110);
                if (seq.length > 1 && k < seq.length - 1) p.then(() => {});
            }
        }
        for (const d of dmgs) { await this.apply(d, { color }); if (dmgs.length > 1) await this.wait(70); }
        for (const r of others) await this.apply(r, { color });
        await this.wait(200);
    },

    async playSpell(e, results) {
        const st = this.st;
        const sp = SPELLS[e.id];
        this.banner(sp.name, true);
        sfx('spell');
        st.fx.ring(new THREE.Vector3(0, 0, 0.5), sp.color, { to: 6, dur: 0.7 });
        await this.wait(350);
        if (e.id === 'meteor') { for (const uid of e.targets) { const t = st.get(uid); if (t) st.fx.meteor(t.actor.root.position.clone(), '#ff7a3a', { size: 0.4 }); } await this.wait(650); st.shake(0.5, 0.5); sfx('boom'); }
        else if (e.id === 'smite') { const t = st.get(e.targets[0]); if (t) { st.fx.pillar(t.actor.root.position, '#ffe27a', { radius: 0.45, height: 6, dur: 0.6 }); st.shake(0.35, 0.3); } await this.wait(250); }
        else for (const uid of e.targets) { const t = st.get(uid); if (t) st.fx.rise(t.actor.root.position, sp.color, 16, { speed: 2.4 }); }
        for (const r of results) await this.apply(r, { color: sp.color });
        await this.wait(300);
    },

    async playCounter(e, results) {
        const st = this.st;
        const c = st.get(e.u), t = st.get(e.target);
        this.number(e.u, 'Counter!', 'txt good');
        if (c && t) {
            const ret = await c.actor.lunge(t.actor.root.position, 0.8, 0.4 / Math.sqrt(this.speed));
            for (const r of results) { if (r.t === 'dmg') st.fx.slash(st.anchor(r.u, 'chest', new THREE.Vector3()), '#ffffff'); await this.apply(r); }
            await ret();
        } else for (const r of results) await this.apply(r);
    },

    // ------------------------------------------------------------ results
    async finish(win, retreat = false) {
        const S = G.S, B = this.B, p = this.params;
        this.alive = false;
        this.clearSkillUi();
        const allies = B.allies;
        const deaths = allies.filter((u) => !u.alive).length;
        const hpFrac = allies.reduce((s, u) => s + (u.alive ? u.hp / u.maxHp : 0), 0) / allies.length;
        if (win) {
            sfx('victory');
            for (const e of this.st.actors.values()) if (e.side === 'A') e.actor.victory();
            this.st.fx.burst(new THREE.Vector3(-2, 2, 0.5), '#ffe08a', 60, { speed: 5 });
        } else if (!retreat) { sfx('defeat'); for (const e of this.st.actors.values()) if (e.side === 'E') e.actor.victory(); }
        const before = new Map(p.team.map((id) => { const hh = heroById(S, id); return [id, hh ? hh.level : 0]; }));
        const res = finishBattle(S, p.mode, p, p.team, { win, deaths, hpFrac });
        changed('battle');
        await sleep(win ? 1300 : 900);
        this.showResult(res, before, B);
    },

    showResult(res, before, B) {
        const S = G.S, p = this.params;
        const win = res.win;
        const body = h('div.result');
        app(body, h('div.result-title', { class: win ? 'win' : 'lose' }, win ? 'VICTORY' : 'DEFEAT'));
        if (p.mode === 'campaign' && win) app(body, h('div.result-stars', { html: [1, 2, 3].map((i) => `<span class="star${i <= res.stars ? '' : ' off'}">★</span>`).join('') }), h('div.muted.small', '★ Win · ★ No hero fell · ★ Team above half health'));
        if (res.first) app(body, h('div.notice.good', { style: { margin: '8px 0' } }, 'First clear bonus!'));
        if (p.mode === 'arena' && win) app(body, h('p', `+${res.points} Arena points`));
        // MVP & XP
        const mvp = h('div.mvp');
        for (const id of p.team) {
            const hero = heroById(S, id);
            if (!hero) continue;
            const x = res.heroXp.find((q) => q.id === id);
            const col = h('div', { style: { textAlign: 'center' } }, heroCard(hero, { compact: true }), x ? h('div.xp-gain', x.levels ? `Lv +${x.levels}!` : `+${num(x.xp)} XP`) : null);
            app(mvp, col);
        }
        app(body, mvp);
        if (res.items.length) app(body, rewardGrid(res.items));
        if (!win) app(body, h('p.muted.small', 'Tips: level heroes with XP Elixirs, equip Sigilstones, evolve at max level, and bring element advantage. Fire › Wind › Water › Fire; Light and Dark beat each other.'));
        const btns = [];
        const again = (params) => go('battle', { ...params, team: p.team }, { replace: true, fade: true });
        if (p.mode === 'campaign') {
            if (win && p.idx + 1 < TOTAL_STAGES && p.idx + 1 <= S.campaign.cleared) btns.push({ label: 'Next Stage', cls: 'gold', onClick: () => { this.stopRepeat = true; go('team', { mode: 'campaign', idx: p.idx + 1 }, { replace: true }); } });
            btns.push({ label: 'Replay', cls: win ? '' : 'gold', onClick: () => { this.stopRepeat = true; if (S.res.stamina < staminaCost('campaign', p)) { toast('Not enough stamina'); return false; } again({ ...p, repeat: 1 }); } });
        }
        if (p.mode === 'spire' && win) btns.push({ label: `Floor ${S.spire.floor}`, cls: 'gold', onClick: () => go('spire', {}, { replace: true }) });
        if (p.mode === 'rift' && win && p.tier < 10) btns.push({ label: 'Replay', cls: '', onClick: () => { if (S.res.stamina < staminaCost('rift', p)) { toast('Not enough stamina'); return false; } again(p); } });
        btns.push({ label: 'Leave', cls: 'ghost', onClick: () => { this.stopRepeat = true; this.leave(); } });
        const left = (p.repeat || 1) - 1;
        const cost = staminaCost(p.mode, p);
        let m;
        if (win && left > 0 && S.res.stamina >= cost) {
            const note = h('div.notice', { style: { marginTop: '8px' } }, `Repeating… ${left} more`);
            body.append(note);
            this.stopRepeat = false;
            btns.unshift({ label: 'Stop Repeat', cls: 'red', onClick: () => { this.stopRepeat = true; note.textContent = 'Repeat stopped.'; return false; } });
            setTimeout(() => {
                if (this.stopRepeat || G.S !== S) return;
                if (m) m.close();
                go('battle', { ...p, repeat: left }, { replace: true, fade: true });
            }, 2600);
        } else if (win && left > 0) body.append(h('div.notice', { style: { marginTop: '8px' } }, 'Out of stamina — repeat stopped.'));
        m = modal({ title: win ? 'Battle Won' : 'Battle Lost', body, buttons: btns, dismiss: false, cls: 'wide' });
    },

    leave() {
        const p = this.params;
        const dest = p.mode === 'spire' ? 'spire' : p.mode === 'arena' ? 'arena' : 'adventure';
        go(dest, p.mode === 'rift' ? { tab: 'rifts' } : {}, { replace: true, fade: true });
    },
};
