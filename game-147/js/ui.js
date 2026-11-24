// The DOM layer: the inn HUD and its panels, the expedition card, the battle HUD (timeline, party cards, commands,
// enemy labels, floating numbers), the dialogue box, toasts and settings. It reads G and sends commands through
// onAct; it never changes G itself.

import { VERSION, DAY_LEN, DAY_START, BATTLE, BOND_LEVELS } from './config.js';
import { HEROES, HERO_ORDER, SKILLS, CHAINS, MONSTERS, REGIONS, REGION_ORDER, ITEMS, CATEGORIES, MARKET, RECIPES, RECIPE_ORDER,
    CRAFTS, GUESTS, TIERS, ROOMS, FORAGE, RECRUITS, DAILIES, CHAPTERS, ELEMENTS, STAFF_ROLES, SCENES, VIGNETTES, SPEAKERS } from './sim/data.js';
import * as H from './sim/hotel.js';
import { bondLevel, bondPts, bondNext, synergy, pairKey } from './sim/bonds.js';
import { heroStats, expToNext, has } from './sim/util.js';
import { chainOptions, timeline, heroesOf, enemiesOf } from './sim/battle.js';
import { currentGoal, bossOpen } from './sim/quests.js';
import { expeditionBuffs, freshLinens } from './sim/game.js';
import { PRESETS } from './sim/ai.js';

const $ = (id) => document.getElementById(id);
// the inn's places, for the room card (names of guest rooms come from ROOMS)
const HOTEL_ROOMS = {
    lobby: { name: 'Lobby & Front Desk', icon: '🛎️', panel: 'desk', open: 'Front Desk' },
    kitchen: { name: 'Kitchen', icon: '🍳', panel: 'kitchen', open: 'Cook' },
    garden: { name: 'Courtyard Garden', icon: '🌻', panel: 'garden', open: 'Garden' },
    ...Object.fromEntries(ROOMS.map((r) => [r.id, { name: r.name, icon: '🛏️', panel: 'rooms', open: 'Rooms' }])),
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const g$ = (n) => Math.floor(n).toLocaleString('en-US');
const por = (who) => `art/por-${who}.webp`;
const DLG_PEOPLE = new Set(['maple', 'ember', 'kit', 'fern', 'bru', 'goldmaw', 'guest-merchant', 'guest-noble', 'guest-adventurer']);
const EMOJI = { honey: '🍯', pepper: '🌶️', puffcap: '🍄', glowmoss: '🌿', sugar: '💎', fluff: '☁️', herbs: '🌱', flour: '🌾', honeyDrop: '🍬', mintTea: '🧪',
    smellingSalts: '⚗️', pepperBomb: '💥', luckyBell: '🔔', silkScarf: '🧣', copperRing: '💍', dragonflyPin: '🪲', copperPot: '🍲', goldenWhisk: '🥄', featherDuster: '🪶',
    turboBroom: '🧹', sparkleSpray: '✨', suitcase: '🧳', diary: '📔', sunflowerVase: '🌻', copperKettle: '🫖', luggageCart: '🛒', pottedFern: '🪴', armorStand: '🛡️',
    honeyTart: '🥧', herbSalad: '🥗', emberStew: '🍲', puffcapPie: '🥧', glowTea: '🍵', crystalParfait: '🍨', cloudSouffle: '🍮' };
// item icons are renders of the Meshy models (dev/icons.mjs); an emoji stands in if one is missing
const icon = (id, cls = 'icon') => `<img class="${cls}" src="art/icons/${id}.webp" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls}',textContent:'${EMOJI[id] || '📦'}',style:'display:inline-grid;place-items:center;font-size:24px'}))">`;
/**
 * Where an item can be found, from the game's own data: the peddler's catalogue (at the Front Desk), the courtyard,
 * monsters' drops by region (with the chance), the gardener's foraging, the workshop. v1.0.1 listed the ingredients a
 * recipe needed with no hint of where to get them.
 */
function whereFrom(id) {
    const out = [];
    if (MARKET.includes(id)) out.push(`🛒 the peddler's catalogue at the Front Desk (${ITEMS[id].price} G)`);
    if (id === 'herbs') out.push('🌱 the courtyard garden (Harvest)');
    for (const r of REGION_ORDER) {
        const R = REGIONS[r], mons = [];
        for (const m of new Set([...R.pool, R.boss])) {
            const d = MONSTERS[m].drops?.find(([it]) => it === id);
            if (d) mons.push(`${MONSTERS[m].name}${d[1] < 1 ? ` ${Math.round(d[1] * 100)}%` : ''}`);
        }
        if (mons.length) out.push(`⚔️ ${R.name}: ${mons.join(', ')}`);
    }
    const forage = Object.entries(FORAGE).find(([, l]) => l.includes(id));
    if (forage) out.push(`🌻 a Gardener on staff forages it${forage[0] === 'home' ? '' : ` (once the ${REGIONS[forage[0]].name} is open)`}`);
    if (CRAFTS[id]) out.push('🔨 the Workshop (Kitchen)');
    return out;
}
/** A "where to find it" note for each ingredient a recipe or craft is short of. */
function whereNeeded(G, need) {
    const lines = Object.entries(need).filter(([k, n]) => !has(G, k, n)).map(([k]) => {
        const w = whereFrom(k);
        return `<div>${EMOJI[k] || ''} <b>${esc(ITEMS[k].name)}</b>: ${w.length ? w.map(esc).join(' · ') : 'not found anywhere yet'}</div>`;
    });
    return lines.length ? `<div class="where">${lines.join('')}</div>` : '';
}
const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const clockText = (G) => {
    const h = (DAY_START + (G.clock / DAY_LEN) * 0.75) * 24;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
    return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
};
const SCENE_VO = {
    intro: ['goldmaw:intro', 'goldmaw:debt', 'maple:shock', 'goldmaw:keepup'], tier1: ['goldmaw:paid'], tier2: ['goldmaw:coin'], tier3: ['goldmaw:paid'], tier4: ['goldmaw:paid'],
    tier5: ['goldmaw:deed', 'maple:deed', null, null, 'goldmaw:friend'], late: ['goldmaw:late', 'maple:pay'],
    recruit_ember: ['ember:hello'], recruit_kit: ['kit:hello'], recruit_fern: ['fern:hello'], recruit_bru: ['bru:hello'],
};
const ROLE_TEXT = { party: '⚔️ Party', staff: '🛎️ Staff', both: '🔁 Both' };

export class UI {
    constructor({ audio, settings, onAct, onSettings, onDeleteSave }) {
        this.audio = audio; this.settings = settings; this.onAct = onAct;
        this.stack = [];
        this.panel = null; this.panelTab = {};
        this.bmenu = 'root'; this.pending = null; this.target = null;
        this.dlg = null;
        this.labels = {};
        this.hideDaily = window.innerWidth < 560;      // on a phone the errands start folded away, so the rooms show
        $('version').textContent = 'v' + VERSION + ' · art, music & voices by ElevenLabs · 3D models by Meshy';

        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => { if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
        }
        document.body.addEventListener('click', (e) => {
            const c = e.target.closest('[data-close]');
            if (c) { audio.ui('close'); this.closeScreen(c.closest('.screen, #dialog')?.id || this.top()); }
        });
        // every [data-cmd] button anywhere sends its JSON command
        document.body.addEventListener('click', (e) => {
            const b = e.target.closest('[data-cmd]');
            if (!b || b.disabled) return;
            audio.ui('click');
            this.onAct(JSON.parse(b.dataset.cmd));
            this.dirty = true;
        });
        $('dock').addEventListener('click', (e) => { const b = e.target.closest('[data-panel]'); if (b) this.openPanel(b.dataset.panel); });
        // [data-open] shortcut buttons live in the quest tracker as well as inside panels, so listen on the whole page
        // (v1.0.0 listened on the panel body only, and the tracker's Desk / Kitchen / Ledger / Adventure did nothing)
        document.body.addEventListener('click', (e) => {
            const p = e.target.closest('[data-open]');
            if (p && !p.disabled) { this.audio.ui('click'); if (p.dataset.opentab) this.panelTab[p.dataset.open] = p.dataset.opentab; this.openPanel(p.dataset.open); }
        });
        // a portrait in the Team panel opens the 3D model viewer; its buttons play the hero's animations
        document.body.addEventListener('click', (e) => {
            const m = e.target.closest('[data-model]');
            if (m) { this.audio.ui('open'); this.openModel(m.dataset.model); return; }
            const c = e.target.closest('[data-mvclip]');
            if (c) { this.audio.ui('click'); for (const b of $('mv-clips').children) b.classList.toggle('on', b === c); this.onModelClip?.(c.dataset.mvclip); }
        });
        // the room card's "whole inn" button (main sets onShowAll to the camera's way home)
        document.body.addEventListener('click', (e) => { if (e.target.closest('[data-inn="all"]')) { this.audio.ui('click'); this.onShowAll?.(); } });
        $('panel-body').addEventListener('click', (e) => {
            const t = e.target.closest('[data-tab]');
            if (t) { this.panelTab[this.panel] = t.dataset.tab; this.dirty = true; }
        });
        $('panel-body').addEventListener('change', (e) => {
            const s = e.target.closest('select[data-cmdsel]');
            if (s && s.value) { const cmd = JSON.parse(s.dataset.cmdsel); cmd[s.dataset.key] = isNaN(+s.value) ? s.value : +s.value; this.onAct(cmd); this.dirty = true; }
        });
        $('hud-debt').addEventListener('click', () => this.openPanel('ledger'));

        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), speed = $('set-speed');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; speed.value = settings.speed;
        // a save from before v1.1.1 may hold 1.5 (Brisk): round it to the nearest of 1×, 2×, 3×
        settings.speed = Math.max(1, Math.min(3, Math.round(settings.speed || 1)));
        speed.value = settings.speed;
        const changed = () => { Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, speed: +speed.value }); onSettings(settings); this.showSpeed(); };
        for (const el of [sfx, music, voice, speed]) el.addEventListener('change', changed);
        // battle speed, right in the battle HUD (1×, 2×, 3×; X cycles), kept in the settings
        this.settings = settings;
        this.setSpeed = (n) => { settings.speed = n; speed.value = n; onSettings(settings); this.showSpeed(); };
        $('speed-seg').addEventListener('click', (e) => { const b = e.target.closest('[data-speed]'); if (b) { audio.ui('click'); this.setSpeed(+b.dataset.speed); } });
        this.showSpeed();
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
        $('dlg-next').addEventListener('click', () => this.dlgNext());
        // battle HUD
        $('commands').addEventListener('click', (e) => this.onCommand(e));
        $('btn-auto').addEventListener('click', () => { this.onAct({ t: 'auto', on: !this.G?.battle?.auto, preset: $('sel-preset').value }); });
        $('sel-preset').addEventListener('change', () => this.onAct({ t: 'auto', on: !!this.G?.battle?.auto, preset: $('sel-preset').value }));
        $('labels').addEventListener('click', (e) => { const b = e.target.closest('[data-unit]'); if (b) this.pickTarget(b.dataset.unit); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        $(id).style.zIndex = 50 + this.stack.length;
        this.focusFirst(id);
    }
    closeScreen(id) {
        if (!id) return;
        if (id === 'dialog') return;
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (id === 'panel') this.panel = null;
        if (id === 'modelview') this.onModel?.(null);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && !b.disabled && b.getClientRects().length); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top() || (this.dlg ? 'dialog' : 'commands'));
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    showSpeed() {
        for (const b of $('speed-seg').children) { const on = +b.dataset.speed === this.settings.speed; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
    }

    /** A notice above the dock. With an item icon and a second line it is a bigger card that stays up longer. */
    toast(text, cls = '', { item = null, sub = '', ms = 3200 } = {}) {
        const el = document.createElement('div');
        el.className = 'toast ' + cls + (item || sub ? ' card-toast' : '');
        if (item || sub) el.innerHTML = `${item ? icon(item, 'ticon') : ''}<div><div>${esc(text)}</div>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
        else el.textContent = text;
        el.style.animationDuration = `${ms / 1000}s`;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), ms + 100);
    }

    // ------------------------------------------------------------------ dialogue (story scenes and bond vignettes)
    get talking() { return !!this.dlg; }
    showScene(key, lines, title = null) {
        this.dlg = { key, lines, i: 0, title };
        $('dialog').hidden = false;
        this.dlgShow();
    }
    dlgShow() {
        const d = this.dlg, [who, text] = d.lines[d.i];
        // people get the taller head-and-shoulders portrait (v1.1.0's square head crop stopped at the chin); creatures
        // keep their whole-body picture
        $('dlg-img').src = DLG_PEOPLE.has(who) ? `art/dlg-${who}.webp` : por(who);
        $('dlg-name').textContent = (d.title && d.i === 0 ? `💞 ${d.title} · ` : '') + (SPEAKERS[who] || who);
        $('dlg-text').textContent = text;
        $('dlg-next').textContent = d.i < d.lines.length - 1 ? 'Next ▸' : 'Close';
        $('dlg-next').focus({ preventScroll: true });
        const vo = SCENE_VO[d.key]?.[d.i];
        if (vo) { const [w, l] = vo.split(':'); this.audio.voice(w, l, 1, true); }
    }
    dlgNext() {
        const d = this.dlg;
        if (!d) return;
        this.audio.ui('click');
        if (d.i < d.lines.length - 1) { d.i++; this.dlgShow(); return; }
        $('dialog').hidden = true;
        this.dlg = null;
        this.onAct({ t: d.title ? 'vignetteDone' : 'sceneDone' });
    }

    /** A stranger is ready to join: pick a role. */
    showRecruit(hero) {
        const H0 = HEROES[hero], R = STAFF_ROLES[H0.staff];
        $('choice-body').innerHTML = `
            <div class="sheet-head"><h2>${esc(H0.short)} wants to stay!</h2></div>
            <div class="top" style="display:flex;gap:10px;align-items:center"><img src="${por(hero)}" alt="" style="width:84px;height:84px;border-radius:16px;background:#fbeed7">
            <div><b>${esc(H0.name)}</b><div class="note">${esc(H0.cls)} · ${ELEMENTS[H0.el].icon} ${ELEMENTS[H0.el].name} · ${R.icon} ${R.name}</div><div class="note">${esc(H0.bio)}</div></div></div>
            <p class="note">How should ${esc(H0.short)} help?</p>
            <div class="menu">
                <button class="btn primary" data-cmd='{"t":"recruit","hero":"${hero}","role":"both"}'>🔁 Both: adventure with you, work at the inn when home</button>
                <button class="btn" data-cmd='{"t":"recruit","hero":"${hero}","role":"party"}'>⚔️ Party only</button>
                <button class="btn" data-cmd='{"t":"recruit","hero":"${hero}","role":"staff"}'>🛎️ Full-time ${R.name}: ${esc(R.perk)}, even while you're away</button>
            </div>
            <p class="note">You can change this any time in the Team panel.</p>`;
        this.openScreen('choice');
    }

    // ------------------------------------------------------------------ the inn HUD
    showMode(mode) {
        $('hud').hidden = mode !== 'hotel';
        $('exped').hidden = mode !== 'expedition';
        $('bhud').hidden = mode !== 'battle';
        if (mode !== 'battle') { $('labels').innerHTML = ''; this.labels = {}; }
        this._labelHtml = null;
    }

    hud(G, time) {
        this.G = G;
        const sp = H.sparkle(G);
        $('hud-day').textContent = `☀️ Day ${G.day} · ${clockText(G)}`;
        const tipRate = G.rooms.reduce((a, r) => { const g = r.guest && G.guests[r.guest]; return a + (g && !g.recruit ? g.rate * 0.004 * (sp / 5) * 60 : 0); }, 0);
        $('hud-gold').textContent = `🪙 ${g$(G.gold)}${tipRate > 0 ? ` (+${Math.round(tipRate)}/min)` : ''}`;
        $('hud-rep').textContent = `⭐ ${G.rep}`;
        $('hud-sparkle').textContent = `✨ ${sp.toFixed(1)}`;
        const T = TIERS[G.debt.tier];
        const debt = $('hud-debt');
        if (T) {
            const owe = H.owed(G), tot = T.amount + G.debt.fees, late = G.day > T.due;
            debt.innerHTML = `<span>📒 Owe ${g$(owe)} · due day ${G.debt.due}</span><span class="bar"><i style="width:${(100 * G.debt.paid / tot).toFixed(1)}%"></i></span>`;
            debt.classList.toggle('late', G.day >= G.debt.due - 1);
        } else debt.innerHTML = '<span>📜 Debt free!</span>';
        // tracker: the story goal, the pot on the stove, dailies
        const goal = currentGoal(G);
        let html = '';
        if (G.cook) {
            const n = H.needle(G);
            html += `<div class="card cook"><b>🍳 ${esc(RECIPES[G.cook.r].name)}: stir now!</b>${this.stirBar(n)}<button class="btn small primary" data-cmd='{"t":"stir"}'>Stir! (Space)</button></div>`;
        }
        if (goal) html += `<div class="card"><b>${esc(goal.title)}</b>${esc(goal.text)}${this.goalHint(G, goal)}</div>`;
        const ready = Object.keys(G.recruits).filter((h) => G.recruits[h].stage === 'staying' || G.recruits[h].stage === 'arrived');
        for (const h of ready) html += `<div class="card">${this.recruitStatus(G, h)}</div>`;
        if (!this.hideDaily) html += `<div class="card daily"><b>Today's errands</b>${G.daily.tasks.map((t) => `<div class="${t.done ? 'done' : ''}">${DAILIES.find((d) => d.id === t.id).text.replace('{n}', t.n)} (${Math.min(t.n, G.daily.prog[t.id] || 0)}/${t.n}) · ${t.gold} G</div>`).join('')}</div>`;
        html += `<button class="toggle" id="tg-daily">${this.hideDaily ? 'Show errands' : 'Hide errands'}</button>`;
        if (html !== this._trackerHtml) {
            this._trackerHtml = html;
            $('tracker').innerHTML = html;
            $('tg-daily').onclick = () => { this.hideDaily = !this.hideDaily; this._trackerHtml = null; };
        }
        // dock badges
        const badge = (p, n) => { const b = $('dock').querySelector(`[data-panel="${p}"]`); let d = b.querySelector('.dot'); if (n) { if (!d) { d = document.createElement('i'); d.className = 'dot'; b.appendChild(d); } d.textContent = n; } else d?.remove(); };
        badge('desk', G.queue.length);
        badge('rooms', G.rooms.filter((r) => r.open && H.bunnies(r) >= 3).length);
        badge('garden', G.garden.herbs >= 3 ? Math.floor(G.garden.herbs) : 0);
        badge('kitchen', G.cook ? '!' : 0);
        badge('ledger', T && G.gold >= H.owed(G) ? '✓' : 0);
        if (this.panel && (this.dirty || time - (this.lastPanel || 0) > 0.3)) { this.renderPanel(G); this.lastPanel = time; this.dirty = false; }
        this.needleTick(G);
    }

    /**
     * Move every stir needle on screen to where the pot is now, every frame. The needle's position is not part of the
     * panel's HTML (v1.0.1 baked it in, and the panel re-renders only every 0.3 s, so the needle jumped between about
     * three spots per sweep and the gold zone was nearly impossible to hit).
     */
    needleTick(G) {
        const n = G.cook && H.needle(G);
        if (!n) return;
        for (const el of document.querySelectorAll('.stir .needle')) el.style.left = `${(n.p * 100).toFixed(2)}%`;
    }

    goalHint(G, goal) {
        if (goal.check === 'tierPaid') return `<div class="note">Owe ${g$(H.owed(G))} G by day ${G.debt.due}. <button class="btn small" data-open="ledger">Ledger</button></div>`;
        if (goal.check === 'sweptRoom') return '<div class="note">Click the dust bunnies hopping in the rooms!</div>';
        if (goal.check === 'checkedIn') return G.queue.length ? '<div class="note">A guest is waiting. <button class="btn small" data-open="desk">Desk</button></div>' : '<div class="note">Guests will arrive at the desk soon.</div>';
        if (goal.check === 'cooked') return '<div class="note"><button class="btn small" data-open="kitchen">Kitchen</button></div>';
        if (goal.check === 'bossBeaten') return `<div class="note"><button class="btn small go" data-open="expedition">Adventure</button></div>`;
        return '';
    }

    recruitStatus(G, h) {
        const s = G.recruits[h], R = RECRUITS[h], g = Object.values(G.guests).find((x) => x.recruit === h);
        const ok = (b) => (b ? '✅' : '⬜');
        // say where the meal they want comes from, and what became of a quest item (Ember turns the pepper into her stew)
        const inPantry = G.pantry.some((m) => m.r === R.meal);
        const mealHint = s.meal ? '' : inPantry ? ` <span class="hint">(it's in your pantry: serve it to ${esc(HEROES[h].short)})</span> <button class="btn small" data-open="kitchen" data-opentab="pantry">Pantry</button>`
            : h === 'ember' ? ` <span class="hint">(${s.task ? 'she\'s cooking it' : 'she\'ll cook it with the pepper'})</span>` : '';
        const taskText = h === 'ember' && s.task ? 'Brought a Fire Pepper (she cooked her stew with it)' : esc(R.task.text);
        return `<b>${esc(HEROES[h].short)} (stranger)</b>
            <div>${ok(g?.room)} A room${R.room === 'clean' ? ' (clean: 1 bunny at most)' : ''}</div>
            <div>${ok(s.task)} ${taskText}${R.task.kind === 'harvest' ? ` (${s.count || 0}/${R.task.n})` : ''}</div>
            <div>${ok(s.meal)} Serve ${esc(RECIPES[R.meal].name)}${mealHint}</div>`;
    }

    stirBar(n) {
        if (!n) return '';
        return `<div class="stir"><div class="good" style="left:${(50 - n.good * 100).toFixed(1)}%;width:${(n.good * 200).toFixed(1)}%"></div><div class="perfect" style="left:${(50 - n.perfect * 100).toFixed(1)}%;width:${(n.perfect * 200).toFixed(1)}%"></div><div class="needle"></div></div>`;
    }

    roomLabels(G, hotel3d) {
        // small labels over each open room with its guest and dust (so it reads on a phone)
        let html = '';
        for (const r of G.rooms) {
            if (!r.open || hotel3d.focused === r.id) continue;
            const s = hotel3d.roomScreen(r.id), b = H.bunnies(r), g = r.guest && G.guests[r.guest];
            if (s.x < -60 || s.x > innerWidth + 60 || s.y < 0 || s.y > innerHeight) continue;
            html += `<div class="rlabel ${b >= 3 ? 'dirty' : ''}" style="left:${s.x.toFixed(0)}px;top:${s.y.toFixed(0)}px">${g ? '🛌 ' + esc(g.name) : 'Free'}${b ? ' · 🐰' + b : ' · ✨'}</div>`;
        }
        if (html !== this._labelHtml) { this._labelHtml = html; $('labels').innerHTML = html; }
        this.roomCard(G, hotel3d);
    }

    /** The card for the room the camera is zoomed to: what's going on there, a way in, a way back. */
    roomCard(G, hotel3d) {
        const id = hotel3d.focused;
        let html = '';
        if (id) {
            const L = HOTEL_ROOMS[id];
            let sub = '';
            const room = G.rooms.find((r) => r.id === id);
            if (room) {
                const def = ROOMS.find((x) => x.id === id), g = room.guest && G.guests[room.guest], b = H.bunnies(room);
                sub = !room.open ? `🔒 Closed until installment ${def.tier} (“${esc(TIERS[def.tier - 1].name)}”)`
                    : `${g ? `🛌 ${esc(g.name)}${g.recruit ? '' : ` · ${g.nights} night${g.nights > 1 ? 's' : ''} left`}` : 'Free'} · ${b ? `🐰 ${b} dust bunn${b > 1 ? 'ies' : 'y'}: tap them!` : '✨ spotless'}`;
            } else if (id === 'lobby') sub = G.queue.length ? `🛎️ ${G.queue.length} guest${G.queue.length > 1 ? 's' : ''} waiting at the desk` : '🛎️ Nobody waiting at the desk';
            else if (id === 'kitchen') sub = G.cook ? '🍳 Something is cooking…' : `🍽️ ${G.pantry.length} meal${G.pantry.length === 1 ? '' : 's'} in the pantry`;
            else if (id === 'garden') sub = `🌱 ${Math.floor(G.garden.herbs)} / 10 herbs ready`;
            html = `<div class="rc-name">${L.icon} ${esc(L.name)}</div><div class="rc-sub">${sub}</div>
                <div class="rc-acts"><button class="btn small primary" data-open="${L.panel}">${L.open}</button><button class="btn small" data-inn="all">⤢ Whole inn</button></div>`;
        } else if (hotel3d.zoomed) html = '<div class="rc-acts"><button class="btn small" data-inn="all">⤢ Whole inn</button></div>';
        if (html !== this._cardHtml) {
            this._cardHtml = html;
            $('roomcard').innerHTML = html;
            $('roomcard').hidden = !html;
            $('roomcard').classList.toggle('mini', !id);
        }
    }

    /** The 3D model viewer for a hero (main sets onModel to start or stop the viewer, which resolves to its clips). */
    async openModel(id) {
        const D = HEROES[id];
        $('mv-title').textContent = `${D.short}`;
        $('mv-sub').textContent = `${D.cls} · ${ELEMENTS[D.el].icon} ${ELEMENTS[D.el].name || ''} · ${STAFF_ROLES[D.staff].icon} ${STAFF_ROLES[D.staff].name}`.replace(/ +·/g, ' ·');
        $('mv-clips').innerHTML = '';
        this.openScreen('modelview');
        const clips = (await this.onModel?.(id)) || [];
        if (this.top() !== 'modelview') return;
        const NAMES = { idle: 'Idle', battleIdle: 'Ready', walk: 'Walk', run: 'Run', attack: 'Attack', skill: 'Skill', chain: 'Chain leap', hit: 'Ouch', victory: 'Victory', faint: 'Faint', wave: 'Wave' };
        $('mv-clips').innerHTML = clips.map((c) => `<button class="opt ${c === 'idle' ? 'on' : ''}" data-mvclip="${c}">${NAMES[c] || c}</button>`).join('');
    }

    /** Open the panel for a room of the inn. */
    openRoom(id) { this.openPanel(HOTEL_ROOMS[id]?.panel || 'rooms'); }

    // ------------------------------------------------------------------ panels
    openPanel(id) {
        this.panel = id;
        this.audio.ui('open');
        this.openScreen('panel');
        this.dirty = true;
        this.renderPanel(this.G);
        this.focusFirst('panel');
    }

    renderPanel(G) {
        const id = this.panel;
        if (!id || !G) return;
        const T = { desk: '🛎️ Front Desk', kitchen: '🍳 Kitchen & Workshop', rooms: '🛏️ Guest Rooms', garden: '🌻 Courtyard Garden', staff: '🧑‍🤝‍🧑 Team', bonds: '💞 Bonds',
            bag: '🎒 Inventory', ledger: '📒 Goldmaw\'s Ledger', expedition: '⚔️ Adventure', quests: '📜 Story & Errands', shop: '🛒 Peddler\'s Catalogue' };
        $('panel-title').textContent = T[id] || id;
        const body = this['p_' + id](G);
        // keep scroll and focus across re-renders
        const sheet = $('panel').querySelector('.sheet');
        const sc = sheet.scrollTop;
        const fk = document.activeElement?.dataset?.cmd || document.activeElement?.dataset?.tab;
        if (body !== this._panelHtml) {
            this._panelHtml = body;
            $('panel-body').innerHTML = body;
            sheet.scrollTop = sc;
            if (fk) [...$('panel-body').querySelectorAll('[data-cmd], [data-tab]')].find((x) => x.dataset.cmd === fk || x.dataset.tab === fk)?.focus({ preventScroll: true });
        }
    }

    tabs(id, list) {
        const cur = this.panelTab[id] || list[0][0];
        return [cur, `<div class="tabs">${list.map(([k, t]) => `<button data-tab="${k}" class="${k === cur ? 'on' : ''}">${t}</button>`).join('')}</div>`];
    }

    p_desk(G) {
        const free = H.openRooms(G).filter((r) => !r.guest);
        let h = '<h3>Waiting at the desk</h3>';
        if (!G.queue.length) h += '<p class="note">No one is waiting. Walk-ins arrive every minute or so; a higher ⭐ reputation brings them faster, and richer.</p>';
        for (const id of G.queue) {
            const g = G.guests[id];
            const img = g.recruit ? por(g.recruit) : por(GUESTS[g.arch].model);
            const rooms = free.map((r) => {
                const why = H.checkinBlock(G, id, r.id);
                return `<button class="btn small" ${why ? 'disabled title="' + esc(why) + '"' : ''} data-cmd='{"t":"checkin","guest":"${id}","room":"${r.id}"}'>${esc(ROOMS.find((x) => x.id === r.id).name.split(' · ')[0])} ${H.bunnies(r) ? '🐰' + H.bunnies(r) : '✨'}</button>`;
            }).join('');
            h += `<div class="card"><div class="top"><img src="${img}" alt=""><div><div class="nm">${esc(g.name)}</div><div class="sub">${g.recruit ? 'A stranger with a story' : `${esc(GUESTS[g.arch].name)} · ${g.nights} night${g.nights > 1 ? 's' : ''} · ${g.rate} G/night`}</div><div class="sub">${esc(H.requestText(g))}</div></div></div>
                <div class="acts">${rooms || '<span class="note">No free room. Rooms free up as guests check out each morning.</span>'}</div></div>`;
        }
        const ready = Object.keys(G.recruits).filter((r) => G.recruits[r].stage === 'ready');
        for (const r of ready) h += `<div class="card hl"><div class="top"><img src="${por(r)}" alt=""><div><div class="nm">${esc(HEROES[r].short)} has something to say!</div></div></div><button class="btn primary small" data-recruit="${r}">Talk</button></div>`;
        h += '<h3>Guests staying</h3>';
        const staying = Object.values(G.guests).filter((g) => g.room);
        h += staying.length ? `<div class="grid">${staying.map((g) => `<div class="card"><div class="top"><img src="${g.recruit ? por(g.recruit) : por(GUESTS[g.arch].model)}" alt=""><div><div class="nm">${esc(g.name)}</div><div class="sub">${esc(ROOMS.find((r) => r.id === g.room).name)}${g.recruit ? '' : ` · ${g.nights} night${g.nights > 1 ? 's' : ''} left`}</div>${g.recruit ? '' : `<div class="meter good"><i style="width:${g.sat}%"></i></div>`}</div></div></div>`).join('')}</div>` : '<p class="note">No one yet.</p>';
        h += '<h3>🛒 Peddler\'s catalogue</h3><div class="grid">';
        for (const it of MARKET) {
            const I = ITEMS[it], owned = I.cat === 'tools' && has(G, it);
            h += `<div class="card"><div class="top">${icon(it)}<div><div class="nm">${esc(I.name)}</div><div class="sub">${esc(I.desc)}</div></div></div><button class="btn small" ${owned || G.gold < I.price ? 'disabled' : ''} data-cmd='{"t":"buy","item":"${it}"}'>${owned ? 'Owned' : `Buy · ${I.price} G`}</button></div>`;
        }
        return h + '</div>';
    }

    p_kitchen(G) {
        const chef = H.staffOn(G, 'cook');
        let h = `<p class="note">${chef ? `👩‍🍳 ${esc(HEROES[chef].short)} is cooking with you: +quality, a wider stir zone, and your bond grows.` : 'No cook on staff yet. Meals turn out plainer.'} Kitchen level ${G.kitchen.level}.</p>`;
        if (G.cook) h += `<div class="card hl"><div class="nm">🍳 ${esc(RECIPES[G.cook.r].name)} is on the stove</div>${this.stirBar(H.needle(G))}<div class="acts"><button class="btn primary" data-cmd='{"t":"stir"}'>Stir! (Space)</button><button class="btn small" data-cmd='{"t":"cookCancel"}'>Take it off the heat</button></div><div class="note">Gold zone: perfect (+0.2 quality). Green: good (+0.1).</div></div>`;
        const [tab, tabs] = this.tabs('kitchen', [['cook', 'Recipes'], ['pantry', `Pantry (${G.pantry.length})`], ['craft', 'Workshop']]);
        h += tabs;
        if (tab === 'cook') {
            h += '<div class="grid">';
            for (const r of RECIPE_ORDER) {
                const R = RECIPES[r], un = H.recipeUnlocked(G, r);
                const need = Object.entries(R.need).map(([k, n]) => `<span class="pill ${has(G, k, n) ? '' : 'warn'}">${EMOJI[k] || ''} ${esc(ITEMS[k].name)} ${G.inv[k] || 0}/${n}</span>`).join(' ');
                h += `<div class="card"><div class="top">${icon(r)}<div><div class="nm">${un ? esc(R.name) : '???'}</div><div class="sub">${un ? `Sells ~${R.price} G · Party: ${esc(R.buffText)}` : 'Not learned yet'}</div></div></div>${un ? `<div>${need}</div>${whereNeeded(G, R.need)}<button class="btn small primary" ${G.cook || !H.hasAll(G, R.need) ? 'disabled' : ''} data-cmd='{"t":"cook","r":"${r}"}'>Cook</button>` : ''}</div>`;
            }
            h += '</div>';
        } else if (tab === 'pantry') {
            if (!G.pantry.length) h += '<p class="note">Nothing cooked yet.</p>';
            const guests = Object.values(G.guests).filter((g) => g.room);
            h += '<div class="grid">' + G.pantry.map((m, i) => {
                // a stranger only takes their own dish (any day); others eat once a day
                const opts = guests.map((g) => {
                    const own = g.recruit && RECRUITS[g.recruit].meal === m.r, picky = g.recruit && !own && !G.recruits[g.recruit].meal;
                    const off = picky || (g.served === G.day && !own);
                    return `<option value="${g.id}" ${off ? 'disabled' : ''}>${esc(g.name)}${(g.recruit ? own : g.reqMeal === m.r) ? ' ★ wants this' : ''}${picky ? ` (only wants ${esc(RECIPES[RECRUITS[g.recruit].meal].name)})` : off ? ' (ate today)' : ''}</option>`;
                }).join('');
                const keep = H.mealReserved(G, i);
                return `<div class="card"><div class="top">${icon(m.r)}<div><div class="nm">${esc(RECIPES[m.r].name)}</div><div class="sub">${stars(H.mealStars(m.q))} · quality ${m.q.toFixed(2)}</div></div></div>
                    <select data-cmdsel='{"t":"serve","meal":${i}}' data-key="guest" style="min-height:44px"><option value="">Serve to…</option>${opts}</select>
                    ${keep ? `<button class="btn small" disabled>Saved for ${esc(HEROES[keep].short)}</button>` : `<button class="btn small" data-cmd='{"t":"sellMeal","meal":${i}}'>Sell to the village · ${Math.round(RECIPES[m.r].price * m.q * 0.5)} G</button>`}</div>`;
            }).join('') + '</div><p class="note">Or eat one before an adventure for its party buff (Adventure panel).</p>';
        } else {
            h += '<div class="grid">' + Object.entries(CRAFTS).map(([it, need]) => `<div class="card"><div class="top">${icon(it)}<div><div class="nm">${esc(ITEMS[it].name)} ×${G.inv[it] || 0}</div><div class="sub">${esc(ITEMS[it].desc)}</div></div></div><div>${Object.entries(need).map(([k, n]) => `<span class="pill ${has(G, k, n) ? '' : 'warn'}">${esc(ITEMS[k].name)} ${G.inv[k] || 0}/${n}</span>`).join(' ')}</div>${whereNeeded(G, need)}<button class="btn small" ${H.hasAll(G, need) ? '' : 'disabled'} data-cmd='{"t":"craft","item":"${it}"}'>Craft</button></div>`).join('') + '</div>';
        }
        return h;
    }

    p_rooms(G) {
        const hk = H.staffOn(G, 'housekeeper');
        let h = `<p class="note">✨ Sparkle ${H.sparkle(G).toFixed(1)} / 5 · ${freshLinens(G) ? '🛏️ <b>Fresh Linens</b> ready: +10% Speed & Evasion on the next adventure.' : 'Get every room down to one dust bunny for Fresh Linens (+10% Speed & Evasion).'} ${hk ? `🧹 ${esc(HEROES[hk].short)} is tidying.` : ''}</p><div class="grid">`;
        for (const r of G.rooms) {
            const def = ROOMS.find((x) => x.id === r.id), g = r.guest && G.guests[r.guest], b = H.bunnies(r);
            if (!r.open) { h += `<div class="card"><div class="nm">${esc(def.name)}</div><div class="sub">🔒 Boarded up. Opens with installment ${def.tier}.</div></div>`; continue; }
            h += `<div class="card"><div class="nm">${esc(def.name)}</div><div class="sub">${g ? `🛌 ${esc(g.name)}${g.recruit ? '' : ` · ${g.nights} night${g.nights > 1 ? 's' : ''} left · ${esc(H.requestText(g))}`}` : 'Free'}</div>
                <div class="meter"><i style="width:${r.dust.toFixed(0)}%"></i></div><div class="sub">🐰 ${b} dust bunn${b === 1 ? 'y' : 'ies'}</div>
                <div class="acts"><button class="btn small" ${b ? '' : 'disabled'} data-cmd='{"t":"sweep","room":"${r.id}"}'>🪶 Shoo a bunny</button></div></div>`;
        }
        return h + '</div><p class="note">Tip: click the bunnies hopping in the rooms directly.</p>';
    }

    p_garden(G) {
        const gd = H.staffOn(G, 'gardener');
        return `<div class="card"><div class="nm">🌱 Herbs ready: ${Math.floor(G.garden.herbs)} / 10</div><div class="meter good"><i style="width:${G.garden.herbs * 10}%"></i></div>
            <button class="btn primary" ${G.garden.herbs >= 1 ? '' : 'disabled'} data-cmd='{"t":"harvest"}'>Harvest</button></div>
            <p class="note">${gd ? `🌻 ${esc(HEROES[gd].short)} tends the garden: herbs grow twice as fast, get picked by themselves, and wild ingredients turn up while you're away.` : 'A gardener would grow herbs twice as fast and forage wild ingredients.'}</p>`;
    }

    p_staff(G) {
        let h = `<p class="note">Party: ${G.party.map((p) => HEROES[p].short).join(', ')} (Maple + up to 3). <b>Both</b> heroes adventure with you and work at the inn while you're home; <b>Staff</b> work all the time, even during adventures.</p>
            <button class="btn small" data-cmd='{"t":"autoEquip"}'>⚙️ Auto-equip everyone</button><div class="grid" style="margin-top:8px">`;
        for (const id of HERO_ORDER) {
            const hh = G.heroes[id], D = HEROES[id];
            if (!hh.joined) { h += `<div class="card"><div class="nm">???</div><div class="sub">${G.recruits[id]?.stage !== 'none' ? 'A stranger is staying at the inn…' : 'Not met yet'}</div></div>`; continue; }
            const s = heroStats(G, id), syn = synergy(G, id, G.party);
            const gear = (slot) => {
                const items = Object.keys(G.inv).filter((it) => ITEMS[it]?.cat === 'gear' && ITEMS[it].slot === slot && (!ITEMS[it].hero || ITEMS[it].hero === id) && (H.freeCount(G, it, id) > 0 || hh[slot] === it));
                return `<select data-cmdsel='{"t":"equip","hero":"${id}"}' data-key="item" style="min-height:40px;max-width:100%"><option value="">${slot === 'weapon' ? 'Weapon' : 'Accessory'}: ${hh[slot] ? esc(ITEMS[hh[slot]].name) : '—'}</option>${items.filter((i) => i !== hh[slot]).map((i) => `<option value="${i}">${esc(ITEMS[i].name)} (${Object.entries(ITEMS[i].stats).map(([k, v]) => k.toUpperCase() + '+' + v).join(' ')})</option>`).join('')}</select>`;
            };
            const roles = id === 'maple' ? '<span class="pill">🛎️ Innkeeper · always in the party</span>' : ['party', 'both', 'staff'].map((r) => `<button class="opt ${hh.role === r ? 'on' : ''}" data-cmd='{"t":"role","hero":"${id}","role":"${r}"}'>${ROLE_TEXT[r]}</button>`).join('');
            const inParty = G.party.includes(id);
            h += `<div class="card ${inParty ? 'hl' : ''}"><div class="top"><button class="por-btn" data-model="${id}" title="See ${esc(D.short)} in 3D" aria-label="See ${esc(D.short)} in 3D"><img src="${por(id)}" alt=""><span class="por-3d">3D</span></button><div><div class="nm">${esc(D.short)} · Lv ${hh.lv}</div><div class="sub">${esc(D.cls)} · ${ELEMENTS[D.el].icon} · ${STAFF_ROLES[D.staff].icon} ${STAFF_ROLES[D.staff].name}</div><div class="meter good"><i style="width:${(100 * hh.exp / expToNext(hh.lv)).toFixed(0)}%"></i></div></div></div>
                <div class="sub">HP ${s.hp} · MP ${s.mp} · ATK ${Math.round(s.atk)} · DEF ${Math.round(s.def)} · MAG ${Math.round(s.mag)} · SPD ${Math.round(s.spd)}${syn ? ` · 💞 +${Math.round(syn * 100)}%` : ''}</div>
                <div class="acts">${roles}</div>
                ${id !== 'maple' && hh.role !== 'staff' ? `<button class="btn small" data-cmd='{"t":"party","hero":"${id}"}'>${inParty ? 'Leave the party' : 'Join the party'}</button>` : ''}
                ${gear('weapon')}${gear('acc')}
                <div class="sub">Skills: ${D.skills.map((k) => `${ELEMENTS[SKILLS[k].el || 'none']?.icon || ''} ${SKILLS[k].name}`).join(' · ')}</div></div>`;
        }
        return h + '</div>';
    }

    p_bonds(G) {
        const joined = HERO_ORDER.filter((id) => G.heroes[id].joined);
        let h = '<p class="note">Bonds grow from living under one roof, cooking and cleaning together, fighting side by side, combos and chains. Level 3 between two heroes gives them +3% stats each when they fight together, and unlocks Duo Chains. Level 4 with Maple unlocks Trio Chains.</p><div class="grid">';
        for (let i = 0; i < joined.length; i++) for (let j = i + 1; j < joined.length; j++) {
            const a = joined[i], b = joined[j], lv = bondLevel(G, a, b), nx = bondNext(G, a, b);
            const duo = Object.values(CHAINS).find((c) => c.members.length === 2 && c.members.includes(a) && c.members.includes(b));
            const vig = [2, 3, 4].map((l) => VIGNETTES[`${pairKey(a, b)}:${l}`] ? `<span class="pill">${G.seenVignettes.includes(`${pairKey(a, b)}:${l}`) ? '📖' : '🔒'} Lv${l}</span>` : '').join(' ');
            const decor = a === 'maple' && lv >= 3 ? `<div class="sub">💡 ${esc(HEROES[b].short)} loves the ${esc(ITEMS[HEROES[b].favDecor].name)} (+5% stats when it's on display)</div>` : '';
            h += `<div class="card"><div class="top"><img src="${por(a)}" alt="" style="width:36px;height:36px"><img src="${por(b)}" alt="" style="width:36px;height:36px"><div><div class="nm">${esc(HEROES[a].short)} & ${esc(HEROES[b].short)}</div><div class="sub">${'❤️'.repeat(lv)}${'🤍'.repeat(5 - lv)} ${nx == null ? 'max' : `${nx} to next`}</div></div></div>
                <div class="meter good"><i style="width:${lv >= 5 ? 100 : (100 * (bondPts(G, a, b) - BOND_LEVELS[lv - 1]) / (BOND_LEVELS[lv] - BOND_LEVELS[lv - 1])).toFixed(0)}%"></i></div>
                ${duo ? `<div class="sub">${lv >= 3 ? '⚡' : '🔒'} Duo Chain: ${esc(duo.name)}</div>` : ''}${decor}<div>${vig}</div></div>`;
        }
        if (joined.length < 2) h += '<p class="note">Win over a stranger to start a bond.</p>';
        return h + '</div>';
    }

    p_bag(G) {
        const [tab, tabs] = this.tabs('bag', CATEGORIES.map(([k, n, e]) => [k, `${e} ${n}`]));
        const sort = this.bagSort || 'name';
        let h = tabs + `<div class="acts" style="margin-bottom:8px"><span class="note">Sort:</span>${['name', 'qty', 'value'].map((s) => `<button class="opt ${sort === s ? 'on' : ''}" data-sort="${s}">${s}</button>`).join('')}<button class="btn small" data-cmd='{"t":"autoEquip"}'>⚙️ Auto-equip</button></div>`;
        if (tab === 'meal') {
            h += G.pantry.length ? '<div class="grid">' + G.pantry.map((m) => `<div class="card"><div class="top">${icon(m.r)}<div><div class="nm">${esc(RECIPES[m.r].name)}</div><div class="sub">${stars(H.mealStars(m.q))} · ${esc(RECIPES[m.r].buffText)}</div></div></div></div>`).join('') + '</div>' : '<p class="note">No meals cooked.</p>';
            return h;
        }
        let items = Object.entries(G.inv).filter(([k, n]) => n > 0 && ITEMS[k]?.cat === tab);
        items.sort(sort === 'qty' ? (a, b) => b[1] - a[1] : sort === 'value' ? (a, b) => ITEMS[b[0]].price - ITEMS[a[0]].price : (a, b) => ITEMS[a[0]].name.localeCompare(ITEMS[b[0]].name));
        if (!items.length) return h + '<p class="note">Nothing here yet.</p>';
        h += '<div class="grid">';
        for (const [k, n] of items) {
            const I = ITEMS[k];
            const worn = Object.entries(G.heroes).filter(([, hh]) => hh.weapon === k || hh.acc === k).map(([id]) => HEROES[id].short);
            let acts = '';
            if (I.cat === 'decor') acts += `<button class="btn small" data-cmd='{"t":"decor","item":"${k}"}'>${G.decor.includes(k) ? 'Take down' : `Display (${G.decor.length}/${G.decorSlots})`}</button>`;
            if (I.price && I.cat !== 'quest' && I.cat !== 'tools') acts += `<button class="btn small" ${H.freeCount(G, k) <= 0 && I.cat === 'gear' ? 'disabled' : ''} data-cmd='{"t":"sell","item":"${k}"}'>Sell · ${Math.floor(I.price / 2)} G</button>`;
            h += `<div class="card"><div class="top">${icon(k)}<div><div class="nm">${esc(I.name)} ×${n}</div><div class="sub">${esc(I.desc)}${I.cat === 'ingredient' && whereFrom(k).length ? '<br><small>Found: ' + whereFrom(k).map(esc).join(' · ') + '</small>' : ''}${I.stats ? ' · ' + Object.entries(I.stats).map(([s, v]) => s.toUpperCase() + '+' + v).join(' ') : ''}${worn.length ? ' · worn by ' + worn.join(', ') : ''}</div></div></div><div class="acts">${acts}</div></div>`;
        }
        return h + '</div>';
    }

    p_ledger(G) {
        let h = '';
        TIERS.forEach((T, i) => {
            const done = G.debt.tier > i, cur = G.debt.tier === i;
            h += `<div class="card ${cur ? 'hl' : ''}"><div class="nm">${done ? '✅' : cur ? '📌' : '🔒'} ${i + 1}. ${esc(T.name)} · ${g$(T.amount)} G${cur && G.debt.fees ? ` + ${g$(G.debt.fees)} late fees` : ''}</div>
                <div class="sub">${cur ? `Paid ${g$(G.debt.paid)} · due by day ${G.debt.due}` : done ? 'Paid' : `Due day ${T.due}`} · Unlocks: ${esc(T.unlock)}</div>
                ${cur ? `<div class="meter good"><i style="width:${(100 * G.debt.paid / (T.amount + G.debt.fees)).toFixed(1)}%"></i></div><div class="acts">${[100, 500].map((n) => `<button class="btn small" ${G.gold >= 1 ? '' : 'disabled'} data-cmd='{"t":"pay","amount":${n}}'>Pay ${n}</button>`).join('')}<button class="btn small primary" ${G.gold >= 1 ? '' : 'disabled'} data-cmd='{"t":"pay","amount":999999}'>Pay ${g$(Math.min(G.gold, H.owed(G)))}</button></div>` : ''}</div>`;
        });
        return `<p class="note">Total still owed: <b>${g$(H.totalOwed(G))} G</b>. Late installments add a 10% fee and five more days. Madame Goldmaw is fussy, never cruel.</p>` + h;
    }

    p_expedition(G) {
        const [tab] = [this.expRegion && H.regionUnlocked(G, this.expRegion) ? this.expRegion : REGION_ORDER.filter((r) => H.regionUnlocked(G, r)).pop()];
        this.expRegion = tab;
        let h = '<h3>Where to?</h3><div class="grid">';
        for (const r of REGION_ORDER) {
            const R = REGIONS[r], un = H.regionUnlocked(G, r);
            const wk = [...new Set(R.pool.flatMap((m) => MONSTERS[m].weak))].map((e) => ELEMENTS[e].icon).join('');
            h += `<button class="card opt ${r === tab ? 'on' : ''}" ${un ? '' : 'disabled'} data-region="${r}" style="text-align:left"><div class="nm">${esc(R.name)} · Lv ${R.lv[0]}–${R.lv[1]}</div><div class="sub">${un ? esc(R.blurb) : `🔒 Opens with installment ${R.unlock}`}</div>${un ? `<div class="sub">Weak to: ${wk} · Boss: ${G.bossesBeaten.includes(R.boss) ? '✅' : bossOpen(G, r) ? '⚔️ ' : '🔒 '}${esc(MONSTERS[R.boss].name)}</div>` : ''}</button>`;
        }
        h += '</div><h3>Eat before you go</h3>';
        const opts = G.pantry.map((m, i) => { const keep = H.mealReserved(G, i); return `<option value="${i}" ${keep ? 'disabled' : this.expMeal === i ? 'selected' : ''}>${esc(RECIPES[m.r].name)} ${stars(H.mealStars(m.q))}: ${keep ? `saved for ${esc(HEROES[keep].short)}` : esc(RECIPES[m.r].buffText)}</option>`; }).join('');
        if (this.expMeal != null && (!G.pantry[this.expMeal] || H.mealReserved(G, this.expMeal))) this.expMeal = null;
        h += G.pantry.length ? `<select id="exp-meal" style="min-height:44px;width:100%"><option value="">No meal</option>${opts}</select>` : '<p class="note">The pantry is empty. Cook something in the kitchen for a party buff.</p>';
        const b = expeditionBuffs(G, this.expMeal != null ? G.pantry[this.expMeal] : null);
        h += `<p class="note">${freshLinens(G) ? '🛏️ Fresh Linens: +10% Speed & Evasion. ' : '🛏️ No Fresh Linens (rooms too dusty). '}${Object.keys(b).length ? 'Buffs: ' + Object.entries(b).map(([k, v]) => `${k} ${v < 1 && v > 0 ? '+' + Math.round(v * 100) + '%' : '+' + v}`).join(', ') : ''}</p>`;
        h += `<h3>Party</h3><div class="acts">${G.party.map((p) => `<span class="pill">${esc(HEROES[p].short)} Lv ${G.heroes[p].lv}</span>`).join(' ')} <button class="btn small" data-open="staff">Change</button></div>`;
        h += `<p class="note">The inn keeps running while you're out: ${['cook', 'concierge', 'gardener', 'housekeeper'].map((r) => H.staffOn({ ...G, exp: { region: tab } }, r)).filter(Boolean).map((id) => HEROES[id].short).join(', ') || 'nobody'} will mind it.</p>`;
        h += `<div class="sheet-foot" style="position:static;margin:10px 0 0;padding:0;border:0"><button class="btn go" id="exp-go" data-region-go="${tab}">⚔️ Set off for the ${esc(REGIONS[tab].name)}</button></div>`;
        return h;
    }

    p_quests(G) {
        let h = '';
        CHAPTERS.forEach((ch, i) => {
            if (i > G.quest.chapter) { h += `<div class="card"><div class="nm">🔒 ${esc(ch.title)}</div></div>`; return; }
            h += `<div class="card ${i === G.quest.chapter ? 'hl' : ''}"><div class="nm">${esc(ch.title)}</div>${ch.goals.map((g, j) => `<div class="sub">${i < G.quest.chapter || j < G.quest.goal ? '✅' : j === G.quest.goal ? '📌' : '⬜'} ${esc(g[2])}</div>`).join('')}</div>`;
        });
        h += '<h3>Today\'s errands</h3>' + G.daily.tasks.map((t) => `<div class="sub">${t.done ? '✅' : '⬜'} ${DAILIES.find((d) => d.id === t.id).text.replace('{n}', t.n)} (${Math.min(t.n, G.daily.prog[t.id] || 0)}/${t.n}) · ${t.gold} G</div>`).join('');
        return h;
    }

    bindPanelExtras() {
        $('panel-body').addEventListener('click', (e) => {
            const r = e.target.closest('[data-region]'); if (r) { this.expRegion = r.dataset.region; this.dirty = true; }
            const go = e.target.closest('[data-region-go]'); if (go) { const sel = $('exp-meal'); this.onAct({ t: 'depart', region: go.dataset.regionGo, meal: sel && sel.value !== '' ? +sel.value : -1 }); this.expMeal = null; this.closeScreen('panel'); }
            const s = e.target.closest('[data-sort]'); if (s) { this.bagSort = s.dataset.sort; this.dirty = true; }
            const rc = e.target.closest('[data-recruit]'); if (rc) { this.closeScreen('panel'); this.showRecruit(rc.dataset.recruit); }
        });
        $('panel-body').addEventListener('change', (e) => { if (e.target.id === 'exp-meal') { this.expMeal = e.target.value === '' ? null : +e.target.value; this.dirty = true; } });
    }

    // ------------------------------------------------------------------ expedition card
    expedCard(G, busy) {
        const ex = G.exp, R = REGIONS[ex.region];
        const B = G.battle;
        let h;
        if (B && ['won', 'lost', 'fled'].includes(B.phase)) {
            if (busy) { $('exped').hidden = true; return; }
            $('exped').hidden = false;
            if (B.phase === 'won') {
                const d = B.rewards.drops;
                h = `<div class="sheet-head"><h2>${B.boss ? '🏆 Boss defeated!' : '✨ Victory!'}</h2></div><p>+${B.rewards.exp} EXP · +${B.rewards.gold} G</p>${Object.keys(d).length ? `<div class="acts">${Object.entries(d).map(([k, n]) => `<span class="pill">${icon(k, 'icon')} ${esc(ITEMS[k].name)} ×${n}</span>`).join('')}</div>` : ''}<div class="sheet-foot"><button class="btn primary" data-cmd='{"t":"battleDone"}'>Continue</button></div>`;
            } else if (B.phase === 'lost') {
                h = '<div class="sheet-head"><h2>💤 The party is worn out…</h2></div><p>You wake up back at the inn, tucked into bed with a hot water bottle. Nothing is lost but the day\'s adventure.</p><div class="sheet-foot"><button class="btn primary" data-cmd=\'{"t":"battleDone"}\'>Back to the inn</button></div>';
            } else {
                h = '<div class="sheet-head"><h2>💨 Got away!</h2></div><p>That was a tactical retreat. Definitely tactical.</p><div class="sheet-foot"><button class="btn primary" data-cmd=\'{"t":"battleDone"}\'>Phew</button></div>';
            }
        } else {
            const party = G.party.map((id) => { const s = heroStats(G, id), hh = G.heroes[id]; const hp = hh.hp ?? s.hp; return `<div class="pcard" style="width:auto"><img src="${por(id)}" alt=""><div class="st">${esc(HEROES[id].short)} Lv ${hh.lv}<div class="bar hp"><i style="width:${(100 * hp / s.hp).toFixed(0)}%"></i></div></div></div>`; }).join('');
            const open = bossOpen(G, ex.region), beaten = G.bossesBeaten.includes(R.boss);
            h = `<div class="sheet-head"><h2>${esc(R.name)}</h2></div><p class="note">${esc(R.blurb)} Battles won here: ${ex.wins}.${ex.meal ? ` Fed on ${esc(RECIPES[ex.meal].name)}.` : ''}${ex.linens ? ' 🛏️ Fresh Linens.' : ''}</p>
                <div style="display:grid;gap:4px">${party}</div>
                <div class="menu" style="margin-top:10px"><button class="btn primary" data-cmd='{"t":"fight","boss":false}'>⚔️ Explore (a battle)</button>
                ${open ? `<button class="btn" data-cmd='{"t":"fight","boss":true}'>👑 Challenge ${esc(MONSTERS[R.boss].name)}${beaten ? ' (again)' : ''}</button>` : `<button class="btn" disabled>🔒 ${esc(MONSTERS[R.boss].name)} isn't here yet</button>`}
                <button class="btn go" data-cmd='{"t":"return"}'>🏡 Head home to the inn</button></div>`;
        }
        if (h !== this._expHtml) { this._expHtml = h; $('exped-card').innerHTML = h; this.focusFirstIn($('exped-card')); }
    }
    focusFirstIn(el) { el.querySelector('button:not([disabled])')?.focus({ preventScroll: true }); }

    // ------------------------------------------------------------------ battle HUD
    battleHud(G, view, busy) {
        const B = G.battle;
        if (!B) return;
        const bv = view.battle;
        // timeline
        const tl = timeline(B, 8).map((id, i) => {
            const u = B.units.find((x) => x.id === id);
            return `<div class="t ${u.side} ${i === 0 ? 'now' : ''}" title="${esc(u.name)}" style="background-image:url(${por(u.key)})"></div>`;
        }).join('');
        if (tl !== this._tl) { this._tl = tl; $('timeline').innerHTML = tl; }
        $('chain-fill').style.width = B.chain + '%';
        const co = chainOptions(G);
        $('chain-gauge').classList.toggle('ready', co.ready && co.list.length > 0);
        $('btn-auto').textContent = B.auto ? `Auto: ${PRESETS[B.preset].icon} On` : 'Auto: Off';
        $('btn-auto').classList.toggle('on', B.auto);
        $('sel-preset').value = B.preset;
        // party cards (HP shown follows the animation)
        let pc = '';
        for (const u of heroesOf(B)) {
            const hp = Math.max(0, Math.round(bv.shownHp[u.id] ?? u.hp));
            const buffs = u.buffs.map((b) => `${b.stat.toUpperCase()}${b.v > 0 ? '↑' : '↓'}`).join(' ') + (u.guard ? ' 🛡️' : '') + (u.taunt ? ' 🎯' : '');
            pc += `<div class="pcard ${B.actor === u.id && B.phase === 'command' ? 'now' : ''} ${u.alive ? '' : 'down'}"><img src="${por(u.key)}" alt=""><div class="st">${esc(u.name)} <span class="buffs">${buffs}</span><div class="bar hp"><i style="width:${(100 * hp / u.mhp).toFixed(0)}%"></i></div><div style="display:flex;justify-content:space-between"><span>${hp}/${u.mhp}</span><span>MP ${u.mp}</span></div><div class="bar mp"><i style="width:${(100 * u.mp / Math.max(1, u.mmp)).toFixed(0)}%"></i></div></div></div>`;
        }
        if (pc !== this._pc) { this._pc = pc; $('party-cards').innerHTML = pc; }
        // enemy labels over the arena
        let lab = '';
        const myTurn = B.phase === 'command' && !busy && G.events.length === 0;
        for (const u of enemiesOf(B)) {
            if (!u.alive || bv.units[u.id]?.alive === false) continue;
            const s = bv.unitScreen(u.id);
            if (!s) continue;
            const hp = Math.max(0, bv.shownHp[u.id] ?? u.hp);
            const poise = Array.from({ length: u.mpoise }, (_, i) => `<i class="${i < u.poise ? '' : 'off'}"></i>`).join('');
            lab += `<div class="elabel ${u.stagger ? 'stag' : ''} ${this.target === u.id && this.pending ? 'target' : ''}" style="left:${Math.min(innerWidth - 58, Math.max(58, s.x)).toFixed(0)}px;top:${s.y.toFixed(0)}px"><button data-unit="${u.id}" ${myTurn ? '' : 'tabindex="-1"'} aria-label="${esc(u.name)}"><div class="nm">${esc(u.name)} Lv${u.lv}${u.stagger ? ' 💫' : ''}</div><div class="hp"><i style="width:${(100 * hp / u.mhp).toFixed(0)}%"></i></div><div class="poise">${poise}</div><div class="wk">${u.weak.map((e) => ELEMENTS[e].icon).join('')}</div></button></div>`;
        }
        $('labels').innerHTML = lab;
        this.renderCommands(G, myTurn);
    }

    renderCommands(G, myTurn) {
        const B = G.battle;
        const a = B.units.find((u) => u.id === B.actor);
        let h = '';
        if (!myTurn || !a || a.side !== 'hero' || B.auto) {
            h = B.auto ? `<div class="cmd-hint">${PRESETS[B.preset].icon} Auto-battle (${PRESETS[B.preset].name}). Tap Auto to take over.</div>` : `<div class="cmd-hint">${a?.side === 'enemy' ? `${esc(a.name)} is acting…` : '…'}</div>`;
        } else if (this.pending) {
            h = `<div class="cmd-hint">🎯 Choose a target for ${esc(this.pending.label)} (tap an enemy, or ← → and Enter)</div><button class="cmd" data-b="confirm">Confirm: ${esc(B.units.find((u) => u.id === this.target)?.name || '')}</button><button class="cmd" data-b="back">◂ Back</button>`;
        } else if (this.bmenu === 'skills') {
            h = HEROES[a.id].skills.map((k) => { const S = SKILLS[k]; return `<button class="cmd" data-b="skill:${k}" ${a.mp < S.mp ? 'disabled' : ''} title="${esc(S.desc || '')}"><span><span class="el">${ELEMENTS[S.el || 'none']?.icon || ''}</span> ${esc(S.name)}</span><small>${S.mp} MP</small></button>`; }).join('') + '<button class="cmd" data-b="back">◂ Back</button>';
        } else if (this.bmenu === 'items') {
            const items = Object.entries(G.inv).filter(([k, n]) => n > 0 && ITEMS[k]?.cat === 'battle');
            h = (items.length ? items.map(([k, n]) => `<button class="cmd" data-b="item:${k}" title="${esc(ITEMS[k].desc)}"><span>${EMOJI[k] || ''} ${esc(ITEMS[k].name)}</span><small>×${n}</small></button>`).join('') : '<div class="cmd-hint">No battle items. Craft some in the kitchen workshop.</div>') + '<button class="cmd" data-b="back">◂ Back</button>';
        } else if (this.bmenu === 'chain') {
            const co = chainOptions(G);
            h = co.list.map((c) => `<button class="cmd chain ${co.ready ? 'ready' : ''}" data-b="chain:${c}" ${co.ready ? '' : 'disabled'}><span>⚡ ${esc(CHAINS[c].name)}</span><small>${CHAINS[c].members.map((m) => HEROES[m].short).join(' + ')}</small></button>`).join('') + `<div class="cmd-hint">${co.free ? 'A staggered enemy: this one\'s free!' : co.ready ? 'Uses the full Chain gauge.' : 'Fill the gauge or stagger an enemy.'}</div><button class="cmd" data-b="back">◂ Back</button>`;
        } else {
            const co = chainOptions(G);
            h = `<div class="cmd-hint">${esc(a.name)}'s turn · HP ${a.hp}/${a.mhp} · MP ${a.mp}</div>
                <div class="cmd-grid"><button class="cmd" data-b="attack">🗡️ Attack</button><button class="cmd" data-b="skills">✨ Skills</button>
                <button class="cmd chain ${co.ready && co.list.length ? 'ready' : ''}" data-b="chainmenu" ${co.list.length ? '' : 'disabled'}>⚡ Chain</button><button class="cmd" data-b="items">🧪 Items</button>
                <button class="cmd" data-b="defend">🛡️ Defend</button><button class="cmd" data-b="flee">💨 Flee</button></div>`;
        }
        if (h !== this._cmd) { this._cmd = h; $('commands').innerHTML = h; if (myTurn) this.focusFirstIn($('commands')); }
    }

    onCommand(e) {
        const b = e.target.closest('[data-b]');
        if (!b || b.disabled) return;
        this.audio.ui('click');
        const G = this.G, B = G.battle;
        const a = B.units.find((u) => u.id === B.actor);
        const v = b.dataset.b;
        const firstFoe = () => (B.units.find((u) => u.id === this.target && u.alive && u.side === 'enemy') || enemiesOf(B).find((u) => u.alive))?.id;
        if (v === 'back') { this.bmenu = 'root'; this.pending = null; }
        else if (v === 'skills' || v === 'items') this.bmenu = v;
        else if (v === 'chainmenu') this.bmenu = 'chain';
        else if (v === 'attack') { this.pending = { t: 'attack', label: 'Attack' }; this.target = firstFoe(); }
        else if (v.startsWith('skill:')) {
            const k = v.slice(6), S = SKILLS[k];
            if (S.target === 'one') { this.pending = { t: 'skill', skill: k, label: S.name }; this.target = firstFoe(); }
            else if (S.target === 'ally') { this.send({ t: 'skill', skill: k, target: heroesOf(B).filter((u) => u.alive).sort((x, y) => x.hp / x.mhp - y.hp / y.mhp)[0].id }); }
            else this.send({ t: 'skill', skill: k });
        } else if (v.startsWith('item:')) {
            const k = v.slice(5), I = ITEMS[k];
            let target;
            if (I.target === 'down') target = heroesOf(B).find((u) => !u.alive)?.id;
            else if (I.target === 'ally') target = heroesOf(B).filter((u) => u.alive).sort((x, y) => (x.hp / x.mhp) - (y.hp / y.mhp))[0]?.id;
            this.send({ t: 'item', item: k, target });
        } else if (v.startsWith('chain:')) this.send({ t: 'chain', chain: v.slice(6), target: firstFoe() });
        else if (v === 'defend') this.send({ t: 'defend' });
        else if (v === 'flee') this.send({ t: 'flee' });
        else if (v === 'confirm') this.send({ ...this.pending, target: this.target });
        this._cmd = null;
        void a;
    }

    send(cmd) {
        delete cmd.label;
        this.onAct(cmd);
        this.bmenu = 'root'; this.pending = null; this._cmd = null;
    }

    pickTarget(id) {
        const B = this.G?.battle;
        if (!B || B.phase !== 'command') return;
        const u = B.units.find((x) => x.id === id);
        if (!u || u.side !== 'enemy' || !u.alive) return;
        if (this.pending && this.target === id) { this.send({ ...this.pending, target: id }); return; }
        if (!this.pending) { this.pending = { t: 'attack', label: 'Attack' }; }
        this.target = id; this._cmd = null;
    }

    cycleTarget(dir) {
        const B = this.G?.battle;
        if (!B || !this.pending) return false;
        const foes = enemiesOf(B).filter((u) => u.alive);
        const i = foes.findIndex((u) => u.id === this.target);
        this.target = foes[(i + dir + foes.length) % foes.length]?.id;
        this._cmd = null;
        return true;
    }

    /** Battle hotkeys: A S C I D F, Enter confirms a target. */
    battleKey(key) {
        const map = { KeyA: 'attack', KeyS: 'skills', KeyC: 'chainmenu', KeyI: 'items', KeyD: 'defend', KeyF: 'flee' };
        if (key === 'KeyT') { this.onAct({ t: 'auto', on: !this.G.battle.auto, preset: $('sel-preset').value }); return true; }
        if (key === 'KeyX') { this.setSpeed((this.settings.speed % 3) + 1); this.toast(`Battle speed ${this.settings.speed}×`); return true; }
        if (this.pending && (key === 'ArrowLeft' || key === 'ArrowUp')) return this.cycleTarget(-1);
        if (this.pending && (key === 'ArrowRight' || key === 'ArrowDown')) return this.cycleTarget(1);
        if (this.pending && (key === 'Enter' || key === 'Space')) { this.send({ ...this.pending, target: this.target }); return true; }
        if ((key === 'Escape' || key === 'Backspace') && (this.pending || this.bmenu !== 'root')) { this.bmenu = 'root'; this.pending = null; this._cmd = null; return true; }
        if (map[key] && this.bmenu === 'root' && !this.pending) { const b = $('commands').querySelector(`[data-b="${map[key]}"]`); if (b && !b.disabled) b.click(); return true; }
        return false;
    }

    // ------------------------------------------------------------------ floating numbers and banners
    pop(x, y, text, cls) {
        const el = document.createElement('div');
        el.className = 'pop ' + cls; el.textContent = text;
        el.style.left = x + 'px'; el.style.top = y + 'px';
        $('pops').appendChild(el);
        setTimeout(() => el.remove(), 1150);
    }
    banner(text, kind) {
        const b = $('chain-banner');
        b.hidden = false;
        b.innerHTML = `<small>${kind === 'trio' ? 'TRIO CHAIN' : kind === 'duo' ? 'DUO CHAIN' : 'CHAIN ATTACK'}</small>${esc(text)}`;
        b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
        clearTimeout(this._bt); this._bt = setTimeout(() => { b.hidden = true; }, 1700);
    }

    /** Something came off the stove (yours, a cook's, or Ember's gift): what, how good, where it is, who wants it. */
    cookedToast(G, e) {
        const R = RECIPES[e.r];
        if (e.grade === 'gift') {
            this.toast(`🍲 ${HEROES[e.chef].short} cooked her ${R.name} ${stars(e.stars)}`, 'love', { item: e.r, sub: 'With the Fire Pepper you brought. It\'s in the pantry: serve it to her!', ms: 6000 });
            return;
        }
        const wants = Object.values(G.guests).filter((g) => g.room && g.served !== G.day && (g.recruit ? RECRUITS[g.recruit].meal === e.r : g.reqMeal === e.r)).map((g) => g.name);
        const sub = [e.grade === 'perfect' ? '✨ Perfect stir!' : e.grade === 'good' ? 'Good stir!' : '', e.chef ? `with ${HEROES[e.chef].short}` : '',
            wants.length ? `${wants.join(', ')} ${wants.length > 1 ? 'want' : 'wants'} this!` : `In the pantry (${G.pantry.length})`].filter(Boolean).join(' · ');
        this.toast(`🍳 ${R.name} ${stars(e.stars)}`, 'good', { item: e.r, sub, ms: 4500 });
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'nope': this.toast(e.text, 'bad'); break;
                case 'checkout': this.toast(`${e.name} checked out: ${'★'.repeat(e.stars)} · +${e.pay + e.tip} G${e.tip ? ` (${e.tip} tip)` : ''}`, 'good'); break;
                case 'served': this.toast(e.recruit ? `${HEROES[e.recruit].short} loved the ${RECIPES[e.r].name}!` : `${e.name} enjoyed the ${RECIPES[e.r].name}${e.fav ? ' (just what they wanted!)' : ''} · +${e.gold} G`, 'good'); break;
                case 'cooked': this.cookedToast(G, e); break;
                case 'levelUp': this.toast(`${HEROES[e.hero].short} reached level ${e.lv}!`, 'good'); break;
                case 'bondUp': this.toast(`💞 ${HEROES[e.a].short} & ${HEROES[e.b].short}: bond level ${e.lv}!`, 'love'); break;
                case 'goalDone': this.toast(`✅ ${e.text}`, 'good'); break;
                case 'chapterDone': this.toast(`📜 Chapter complete! +${e.gold} G${e.next ? ` · ${e.next}` : ''}`, 'good'); break;
                case 'dailyDone': this.toast(`Errand done! +${e.gold} G`, 'good'); break;
                case 'tierUp': this.toast(`📒 Installment ${e.tier} paid!`, 'good'); break;
                case 'late': this.toast(`⏰ Late! Fee of ${e.fee} G added.`, 'bad'); break;
                case 'newDay': this.toast(`☀️ Day ${e.day}`); break;
                case 'forage': this.toast(`🌻 ${HEROES[e.hero].short} found ${ITEMS[e.item].name}`); break;
                case 'recruitTask': if (e.hero !== 'ember') this.toast(`${HEROES[e.hero].short}'s task is done!`, 'love'); break;    // Ember's shows as her stew
                case 'recruitReady': this.toast(`${HEROES[e.hero].short} wants a word at the desk!`, 'love'); break;
                case 'stranger': this.toast('🚪 A stranger has come to the desk…', 'love'); break;
                case 'bought': this.toast(`Bought ${ITEMS[e.item].name}`); break;
                case 'crafted': this.toast(`Crafted ${ITEMS[e.item].name}`); break;
                case 'wokeUp': this.toast('Back home, a little sore.', 'bad'); break;
                default: break;
            }
        }
    }
}
