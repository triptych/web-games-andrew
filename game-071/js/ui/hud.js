/**
 * hud.js — the heads-up display: a compass ribbon with markers, three bars that fade when
 * full, the Storm Charge ring, the sneak eye, the use prompt, an enemy bar, notifications,
 * banners and subtitles. Reads the world each frame; reacts to world events.
 */
import { LOCATIONS, LOC } from '../sim/geography.js';
import { itemName, ITEMS, itemDef } from '../sim/items.js';
import { SKILLS } from '../sim/stats.js';
import { SIGILS } from '../sim/magic.js';
import { EFFECTS } from '../sim/effects.js';

const $ = (id) => document.getElementById(id);
const KIND_ICON = { city: '◆', village: '◇', fort: '♜', cave: '◖', barrow: '⊓', mine: '⛏', camp: '△', tower: '♖', temple: '⌂', ruin: '⚙', mound: '⌒', landmark: '✧', stone: '▲', totem: '▲', shrine: '✦', giant: '☗' };
const FOCUS_VERB = { item: 'Take', plant: 'Harvest', corpse: 'Search', container: 'Open', talk: 'Talk', pickpocket: 'Pickpocket', door: 'Open', station: 'Use', totem: 'Touch', sigilstone: 'Read', sign: 'Read', mount: 'Ride', lever: 'Pull', dial: 'Turn', mural: 'Examine', bed: 'Sleep', ore: 'Mine' };

export class Hud {
    constructor(app) {
        this.app = app;
        this.el = {
            strip: $('compass-strip'), marks: $('compass-marks'), notes: $('notes'), banner: $('banner'), bt: $('banner-title'), bs: $('banner-sub'),
            enemy: $('enemy'), en: $('enemy-name'), ef: $('enemy-fill'), cross: $('crosshair'), eye: $('sneak-eye'),
            prompt: $('prompt'), pk: $('prompt-key'), pv: $('prompt-verb'), pn: $('prompt-name'), ps: $('prompt-sub'), sub: $('subtitle'),
            hp: $('bar-hp'), mp: $('bar-mp'), sp: $('bar-sp'), sigil: $('sigil'), arc: $('sigil-arc'), icons: $('status-icons'),
        };
        this.bars = { hp: this.el.hp.parentElement, mp: this.el.mp.parentElement, sp: this.el.sp.parentElement };
        this.lastFull = { hp: 0, mp: 0, sp: 0 };
        this.enemy = null; this.enemyT = 0;
        this.subT = 0;
        this.bannerQ = [];
        this.bannerT = 0;
        this.buildStrip();
        this.markEls = [];
        this.prevHp = 0;
    }

    buildStrip() {
        // letters and ticks every 15°, placed each frame by bearing
        this.ticks = [];
        for (let d = 0; d < 360; d += 15) {
            const e = document.createElement('i');
            const L = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[d];
            e.className = L ? (L.length === 1 ? 'cl big' : 'cl') : 'ct';
            if (L) e.textContent = L;
            this.el.strip.appendChild(e);
            this.ticks.push({ e, d });
        }
    }

    /** Bearing in degrees (0 = north, 90 = east) from the player to a point. */
    static bearing(p, x, z) { return (Math.atan2(x - p.pos.x, -(z - p.pos.z)) * 180 / Math.PI + 360) % 360; }

    placeOnStrip(el, bearing, heading, width) {
        let d = ((bearing - heading + 540) % 360) - 180;
        const span = 110;   // visible degrees
        if (Math.abs(d) > span / 2) { el.style.display = 'none'; return false; }
        el.style.display = '';
        el.style.left = `${50 + d / span * 100}%`;
        el.style.opacity = String(1 - Math.pow(Math.abs(d) / (span / 2), 3) * 0.8);
        return true;
    }

    update(dt) {
        const app = this.app, w = app.world, p = w.player;
        // ---- compass
        const heading = ((-p.camYaw * 180 / Math.PI) % 360 + 360) % 360;
        for (const t of this.ticks) this.placeOnStrip(t.e, t.d, heading);
        const marks = [];
        if (w.cellId === 'ext') {
            for (const L of LOCATIONS) {
                const d = Math.hypot(L.x - p.pos.x, L.z - p.pos.z);
                const known = w.discovered.has(L.id);
                if (d < 60 && !known && L.kind !== 'stone') continue;
                if ((known && d < 700) || d < 110) marks.push({ x: L.x, z: L.z, icon: KIND_ICON[L.kind] || '•', cls: known ? (w.cleared.has(L.id) ? 'loc cleared' : 'loc') : 'loc unknown', title: L.name });
            }
        }
        for (const q of w.quests?.markers() || []) if (q.cell === w.cellId || (!q.cell && w.cellId === 'ext') || q.cell === 'any') marks.push({ x: q.x, z: q.z, icon: '▼', cls: 'quest', title: q.title });
        if (p.customMarker && w.cellId === 'ext') marks.push({ x: p.customMarker.x, z: p.customMarker.z, icon: '✚', cls: 'custom' });
        for (const a of w.actors) if (a !== p && !a.dead && a.ai?.target === p.id && a.ai.state === 'combat') marks.push({ x: a.pos.x, z: a.pos.z, icon: '●', cls: 'foe' });
        while (this.markEls.length < marks.length) { const e = document.createElement('b'); this.el.marks.appendChild(e); this.markEls.push(e); }
        this.markEls.forEach((e, i) => {
            const m = marks[i];
            if (!m) { e.style.display = 'none'; return; }
            e.className = `cm ${m.cls}`;
            if (e.textContent !== m.icon) e.textContent = m.icon;
            this.placeOnStrip(e, Hud.bearing(p, m.x, m.z), heading);
        });
        // ---- bars (fade out when full for a while)
        const now = performance.now();
        for (const [k, v, max] of [['hp', p.hp, p.hpMax], ['mp', p.mp, p.mpMax], ['sp', p.sp, p.spMax]]) {
            const f = Math.max(0, Math.min(1, v / Math.max(1, max)));
            this.el[k].style.width = `${(f * 100).toFixed(1)}%`;
            if (f < 0.999) this.lastFull[k] = now;
            this.bars[k].classList.toggle('full', now - this.lastFull[k] > 2500 && !app.inCombat);
        }
        if (p.hp < this.prevHp - 0.5) this.bars.hp.classList.remove('full');
        this.prevHp = p.hp;
        // ---- storm charge ring
        const st = p.storm;
        const frac = st.chargeMax ? st.charge / st.chargeMax : 0;
        this.el.arc.style.strokeDashoffset = String(106.8 * (1 - frac));
        const equipped = st.equipped && SIGILS[st.equipped];
        this.el.sigil.style.display = Object.keys(st.rings).length ? '' : 'none';
        this.el.sigil.classList.toggle('ready', !!equipped && st.charge >= SIGILS[st.equipped].cost[0]);
        // ---- sneak eye and crosshair
        this.el.eye.classList.toggle('on', p.sneaking);
        if (p.sneaking) {
            const d = p.detectMax || 0;
            this.el.eye.classList.toggle('open', d >= 1);
            this.el.eye.classList.toggle('half', d >= 0.5 && d < 1);
            this.el.eye.classList.toggle('hidden-state', d < 0.5);
        }
        this.el.cross.style.display = p.sneaking ? 'none' : '';
        // ---- prompt
        const f = w.focus;
        const showPrompt = f && !app.ui?.open;
        this.el.prompt.classList.toggle('on', !!showPrompt);
        this.el.cross.classList.toggle('target', !!f);
        if (showPrompt) this.setPrompt(f);
        app.touchUse?.classList.toggle('lit', !!f);
        // ---- enemy bar
        this.enemyT -= dt;
        const en = this.enemy;
        if (en && (this.enemyT <= 0 || en.dead && this.enemyT < 1.2)) { if (this.enemyT <= 0) this.enemy = null; }
        this.el.enemy.classList.toggle('on', !!this.enemy);
        if (this.enemy) {
            this.el.ef.style.width = `${Math.max(0, this.enemy.hp / this.enemy.hpMax * 100)}%`;
            this.el.enemy.classList.toggle('boss', !!this.enemy.boss || this.enemy.rig === 'dragon');
        }
        // ---- subtitle
        if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.el.sub.classList.remove('on'); }
        // ---- banners queue
        if (this.bannerT > 0) this.bannerT -= dt;
        else if (this.bannerQ.length) { const b = this.bannerQ.shift(); this.showBanner(b.title, b.sub); }
        // ---- status icons
        const icons = [];
        if (p.sheet.rested > 0) icons.push('☾');
        if (p.effects.some((e) => e.id === 'burning')) icons.push('🔥');
        if (p.stats.slowed) icons.push('❄');
        if (p.stats.invisible) icons.push('◌');
        if (p.stats.ethereal) icons.push('☁');
        if (w.slowTime > 0) icons.push('⧗');
        if (p.stats.encumbered) icons.push('⚖');
        const s = icons.join(' ');
        if (this.el.icons.textContent !== s) this.el.icons.textContent = s;
    }

    setPrompt(f) {
        const w = this.app.world;
        let verb = FOCUS_VERB[f.kind] || 'Use', name = '', sub = '', steal = false;
        switch (f.kind) {
            case 'item': { const e = f.ref.entry; name = `${itemName(e)}${e.n > 1 ? ` (${e.n})` : ''}`; steal = f.ref.owner && !w.isOwnerOk(f.ref.owner); const d = itemDef(e); sub = d ? `${d.weight || 0} wt · ${d.value || 0} gold` : ''; break; }
            case 'corpse': name = f.ref.name; break;
            case 'container': name = f.name || 'Container'; steal = f.owner && !w.isOwnerOk(f.owner); if (f.locked) sub = `Locked (${['', 'Simple', 'Plain', 'Tricky', 'Stubborn', 'Master'][f.locked]})`; break;
            case 'talk': name = f.ref.name; break;
            case 'pickpocket': name = f.ref.name; steal = true; break;
            case 'door': name = f.door?.name || f.name || 'Door'; if (f.door?.locked && !w.flags[`unlocked:${f.door.id}`]) sub = 'Locked'; break;
            case 'station': name = ({ forge: 'Forge', grindstone: 'Whetstone', workbench: "Armourer's Bench", smelter: 'Smelter', tanning: 'Tanning Frame', alchemy: 'Alchemy Still', runetable: 'Rune Table', cookpot: 'Cooking Pot' })[f.station.type] || f.station.type; break;
            case 'totem': name = ({ bear: 'The Bear Totem', owl: 'The Owl Totem', fox: 'The Fox Totem', elk: 'The Elk Totem', raven: 'The Raven Totem', ox: 'The Ox Totem' })[f.totem]; break;
            case 'sigilstone': name = 'Sigil Stone'; sub = w.flags[`stone:${f.loc}`] ? 'Already read' : SIGILS[f.ring]?.name; break;
            case 'sign': name = (f.to || []).map((id) => LOC[id]?.name).filter(Boolean).join(' · ') || 'Signpost'; verb = ''; break;
            case 'plant': name = f.name; break;
            case 'bed': name = 'Bed'; steal = f.owner && !w.isOwnerOk(f.owner); break;
            default: name = f.name || '';
        }
        if (steal) verb = verb === 'Take' ? 'Steal' : verb === 'Open' ? 'Open (owned)' : verb;
        this.el.pk.textContent = this.app.input?.device === 'pad' ? 'A' : this.app.isTouch ? '✋' : 'E';
        this.el.pv.textContent = verb;
        this.el.pn.textContent = name;
        this.el.ps.textContent = sub;
        this.el.prompt.classList.toggle('steal', steal);
    }

    note(text, cls = '') {
        const e = document.createElement('div');
        e.className = `note ${cls}`;
        e.textContent = text;
        this.el.notes.appendChild(e);
        while (this.el.notes.children.length > 6) this.el.notes.firstChild.remove();
        setTimeout(() => e.remove(), 5200);
    }
    banner(title, sub) { this.bannerQ.push({ title, sub }); }
    showBanner(title, sub) {
        const b = this.el.banner;
        this.el.bt.textContent = title; this.el.bs.textContent = sub || '';
        this.el.bs.style.display = sub ? '' : 'none';
        b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
        this.bannerT = 4.6;
    }
    subtitle(who, text, secs = 3.5) {
        this.el.sub.innerHTML = '';
        if (who) { const b = document.createElement('b'); b.textContent = `${who}: `; this.el.sub.appendChild(b); }
        this.el.sub.appendChild(document.createTextNode(text));
        this.el.sub.classList.add('on');
        this.subT = secs;
    }

    onEvent(e) {
        const w = this.app.world, p = w.player;
        switch (e.type) {
            case 'hit':
                if (e.source === p && e.target !== p) { this.enemy = e.target; this.el.en.textContent = e.target.name; this.enemyT = 6; }
                else if (e.target === p && e.source && e.source.boss) { this.enemy = e.source; this.el.en.textContent = e.source.name; this.enemyT = 6; }
                if (e.target === p) this.bars.hp.classList.remove('full');
                break;
            case 'skillUp': this.note(`${SKILLS[e.skill].name} rises to ${e.level}`, 'skill'); break;
            case 'levelUp': this.banner(`Level ${e.level}`, 'You have grown stronger'); break;
            case 'pickup': if (e.entry.id !== 'gold') this.note(`${itemName(e.entry)}${e.n > 1 ? ` (${e.n})` : ''} added`); else this.note(`${e.n} gold added`); break;
            case 'note': this.note(e.text); break;
            case 'discovered': this.banner(LOC[e.loc]?.name || e.loc, 'Discovered'); break;
            case 'cleared': this.banner(LOC[e.loc]?.name || e.loc, 'Cleared'); break;
            case 'learnSpell': this.note(`Learned the spell ${e.name || e.spell}`, 'skill'); break;
            case 'ringLearned': this.banner(`${e.name}`, `${e.sigilName} — ring ${e.ring}`); break;
            case 'ember': this.banner('Dragon Ember Absorbed', 'Your storm grows'); break;
            case 'totem': this.banner(({ bear: 'The Bear Totem', owl: 'The Owl Totem', fox: 'The Fox Totem', elk: 'The Elk Totem', raven: 'The Raven Totem', ox: 'The Ox Totem' })[e.totem], 'Blessing received'); break;
            case 'nomagicka': case 'nomana': this.flashBar('mp'); break;
            case 'nocharge': this.el.sigil.classList.remove('flash'); void this.el.sigil.offsetWidth; this.el.sigil.classList.add('flash'); break;
            case 'tired': this.flashBar('sp'); break;
            case 'bark': if (e.text) this.subtitle(e.actor?.name, e.text, 2.5); break;
            case 'say': this.subtitle(e.who, e.text, e.secs || 4); break;
            case 'crime': break;
            case 'questStart': this.banner(e.title, 'Quest begun'); break;
            case 'questDone': this.banner(e.title, 'Quest completed'); break;
            case 'objective': this.note(e.text, 'quest'); break;
            case 'runeLearned': this.note(`Rune learned: ${e.name}`, 'skill'); break;
            case 'crafted': this.note(`Made ${itemName({ id: e.id })}${e.n > 1 ? ` ×${e.n}` : ''}`); break;
            case 'brewed': this.note(`Brewed ${e.name}`); break;
            case 'inscribed': this.note(`Inscribed ${e.name}`); break;
            case 'honed': this.note(`Honed to ${e.grade}`); break;
            case 'locked': this.note('It is locked.'); break;
            case 'mural': this.note(`The mural shows three constellations: ${e.solution.join(', ')}.`, 'quest'); break;
            case 'dial': this.note(`The dial clicks round to the ${e.symbol}.`); break;
            case 'lever': if (!e.solved) this.note(e.open ? 'Somewhere a gate grinds open.' : 'A gate rumbles shut.'); break;
            case 'trap': if (e.kind === 'plate') this.note('Click — darts hiss from the walls!'); break;
            case 'fined': this.note(`Fine in ${LOC[e.town]?.name || e.town}: ${e.amount} gold`, 'bad'); break;
            case 'trade': break;
        }
    }
    flashBar(k) { const b = this.bars[k]; b.classList.remove('full', 'flash'); void b.offsetWidth; b.classList.add('flash'); }
}
