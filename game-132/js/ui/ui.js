// The DOM layer: screens, the HUD, story cards, toasts, settings and the touch deck. Reads the sim; changes it only
// through act() commands handed to it by main.js.

import { VERSION, POTION, xpToNext, LEVEL_CAP } from '../config.js';
import { CLASSES, MASTERIES, SKILLS } from '../sim/data/masteries.js';
import { AREAS, CARDS, QUESTS, CAMPAIGN } from '../sim/data/world.js';
import { BOSSES } from '../sim/data/monsters.js';
import { skillBlocked } from '../sim/skills.js';
import { skillIcon, masteryIcon, EXTRA } from './icons.js';

const $ = (id) => document.getElementById(id);

/** What the Chronicler's book says is next. */
export function questText(G) {
    const P = G.player;
    if (G.won) return QUESTS[QUESTS.length - 1].text;
    if (!P.reached) return 'Take the north gate out of town, into the Drowned Wilds.';
    const def = AREAS[CAMPAIGN[P.reached - 1]];
    const i = P.reached - 1 + (def.boss && P.bossesKilled.includes(def.boss) ? 1 : 0);
    return QUESTS[Math.min(i, QUESTS.length - 2)].text;
}

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];
        this.touchOn = false;
        this.cardQueue = [];
        $('version').textContent = 'v' + VERSION;

        // a press that began outside a screen must not click inside it when it lifts
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => { if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });

        const sfx = $('set-sfx'), music = $('set-music'), voice = $('set-voice'), touch = $('set-touch'), filter = $('set-filter'), nums = $('set-numbers');
        sfx.value = settings.sfx; music.value = settings.music; voice.value = settings.voice; touch.value = settings.touch; filter.value = settings.filter; nums.checked = settings.numbers;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, voice: +voice.value, touch: touch.value, filter: filter.value, numbers: nums.checked });
            onSettings(settings);
        };
        for (const el of [sfx, music, voice, touch, filter, nums]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
        $('skills-ic').setAttribute('style', masteryIcon('warfare'));
        document.querySelector('#hud-btns .ic-items').setAttribute('style', EXTRA.bag);
        this.slotEls = [];
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        // stack order decides what is on top, not page order
        this.stack.forEach((s, i) => { $(s).style.zIndex = String(50 + i); });
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (id === 'panel') this.onPanelClosed?.();
        if (id === 'card') { this.audio.stopVoice(); this.nextCard(); }
        if (this.top()) this.focusFirst(this.top());
        else this.onResume?.();        // the last screen closed: main.js drops the press that closed it, right now
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }
    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.getClientRects().length); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ class select
    showClasses(onPick) {
        const box = $('class-cards');
        box.innerHTML = '';
        for (const [id, c] of Object.entries(CLASSES)) {
            const m = MASTERIES[c.mastery];
            const b = document.createElement('button');
            b.className = 'btn class-card';
            b.dataset.cls = id;
            b.innerHTML = `<img src="art/portrait-${id}.webp" alt=""><div><h3>${c.name}</h3><div class="m" style="color:${m.color}">${m.name} · ${m.res}</div><p>${c.pitch}</p></div>`;
            b.addEventListener('click', () => { this.audio.ui('click'); onPick(id); });
            box.appendChild(b);
        }
        this.openScreen('classes');
    }

    // ------------------------------------------------------------------ story cards
    card(id) { this.cardQueue.push(id); if (this.top() !== 'card') this.nextCard(); }
    nextCard() {
        const id = this.cardQueue.shift();
        if (!id) return;
        const c = CARDS[id];
        $('card-art').src = `art/card-${id}.webp`;
        $('card-title').textContent = c.title;
        $('card-text').textContent = c.text;
        this.openScreen('card');
        this.audio.voice(`vo-card-${id}`, { card: true });     // the narrator reads it (stops when the card closes)
    }
    lore(title, text) {
        $('card-art').removeAttribute('src');
        $('card-art').hidden = true;
        $('card-title').textContent = title;
        $('card-text').textContent = text;
        this.openScreen('card');
        setTimeout(() => { $('card-art').hidden = false; }, 0);
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); }
    setTouch(on, playing = !$('hud').hidden) { this.touchOn = on; $('touch').hidden = !(on && playing); }

    buildSlots(G, onSlot) {
        const box = $('slots'), tb = $('tbtns');
        box.innerHTML = ''; tb.innerHTML = '';
        this.slotEls = []; this.tSlotEls = [];
        const keys = ['1', '2', '3', '4', '5'];
        for (let i = 0; i < 5; i++) {
            const b = document.createElement('button');
            b.className = 'slot'; b.dataset.i = i;
            b.innerHTML = `<span class="ic"></span><span class="key">${keys[i]}</span><span class="cd"></span>`;
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); onSlot(i); });
            box.appendChild(b);
            this.slotEls.push(b);
        }
        for (const [k, style] of [['potion', EXTRA.potion], ['portal', EXTRA.portal]]) {
            const b = document.createElement('button');
            b.className = 'slot'; b.dataset.k = k;
            b.innerHTML = `<span class="ic" style="${style}"></span><span class="key">${k === 'potion' ? 'Q' : 'T'}</span><span class="cd"></span><span class="n"></span>`;
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); onSlot(k); });
            box.appendChild(b);
            this.slotEls.push(b);
        }
        // the touch deck: a big primary button and a ring of the others
        const pos = [[110, 110, true], [40, 120], [52, 50], [116, 30], [176, 54], [10, 180], [70, 186]];
        for (let i = 0; i < 7; i++) {
            const b = document.createElement('button');
            const [x, y, big] = pos[i];
            b.className = 'tbtn' + (big ? ' big' : '');
            b.style.left = `${x - (big ? 38 : 28)}px`; b.style.top = `${y - (big ? 38 : 28)}px`;
            b.dataset.i = i;
            b.setAttribute('aria-label', i < 5 ? `Skill ${i + 1}` : i === 5 ? 'Potion' : 'Town portal');
            b.innerHTML = `<span class="ic" style="${i === 5 ? EXTRA.potion : i === 6 ? EXTRA.portal : ''}"></span><span class="cd"></span>`;
            tb.appendChild(b);
            this.tSlotEls.push(b);
        }
        this.slotsFor = null;
    }

    hud(G, t) {
        const P = G.player, s = P.stats;
        $('area-name').textContent = G.rift ? `Vault Rift · Tier ${G.rift.tier} · ${G.rift.mods.map((m) => m[0].toUpperCase() + m.slice(1)).join(', ')}` : AREAS[G.area.id].name;
        $('quest').textContent = questText(G);
        // orbs
        $('life-fill').style.height = `${Math.max(0, (P.life / s.maxLife) * 100)}%`;
        $('life-text').textContent = `${Math.ceil(P.life)}`;
        P.masteries.forEach((m, i) => {
            const el = $('res' + i);
            if (!m) { el.hidden = true; return; }
            el.hidden = false;
            const r = MASTERIES[m].res;
            el.className = `orb res ${r}${i ? ' small' : ''}`;
            el.querySelector('i').style.height = `${(P.res[r] / s.resMax[r]) * 100}%`;
            el.querySelector('span').textContent = Math.floor(P.res[r]);
        });
        $('xp-fill').style.width = `${P.level >= LEVEL_CAP ? 100 : Math.min(100, (P.xp / xpToNext(P.level)) * 100)}%`;
        // skill slots
        const sig = P.slots.join(',');
        if (this.slotsFor !== sig) {
            this.slotsFor = sig;
            P.slots.forEach((id, i) => {
                for (const el of [this.slotEls[i], this.tSlotEls[i]]) el.querySelector('.ic').setAttribute('style', id ? skillIcon(id) : '');
                this.slotEls[i].title = id ? SKILLS[id].name : 'Empty: learn and slot skills in the Skills panel (K)';
            });
        }
        P.slots.forEach((id, i) => {
            const cdMax = id ? SKILLS[id].cd || 0 : 0;
            const frac = id && cdMax ? (P.cds[id] || 0) / cdMax : 0;
            const why = id ? skillBlocked(G, id) : '';
            for (const el of [this.slotEls[i], this.tSlotEls[i]]) {
                el.querySelector('.cd').style.height = `${Math.min(100, frac * 100)}%`;
                el.classList.toggle('nores', why.startsWith('not enough'));
                el.classList.toggle('on', P.channel === id);
            }
        });
        const pot = this.slotEls[5];
        pot.querySelector('.n').textContent = P.potion.charges;
        pot.querySelector('.cd').style.height = `${(P.potion.cd / POTION.cd) * 100}%`;
        this.tSlotEls[5].querySelector('.cd').style.height = `${(P.potion.cd / POTION.cd) * 100}%`;
        $('pts-badge').hidden = !P.unspent.skill; $('pts-badge').textContent = P.unspent.skill;
        $('attr-badge').hidden = !P.unspent.attr; $('attr-badge').textContent = P.unspent.attr;
        // boss bar
        const boss = G.mons.find((m) => m.boss && m.life > 0 && m.aggro);
        $('boss').hidden = !boss;
        if (boss) { $('boss-name').textContent = BOSSES[boss.boss].name + (boss.guardian ? ' (Rift Guardian)' : ''); $('boss-fill').style.width = `${(boss.life / boss.max) * 100}%`; }
        $('rift').hidden = !G.rift || !!boss || G.rift.done;
        if (G.rift && !G.rift.done) { $('rift-name').textContent = G.rift.guardian ? 'The Guardian comes' : `Rift ${Math.floor((G.rift.progress / G.rift.need) * 100)}%  ·  ${Math.floor(G.rift.t / 60)}:${String(Math.floor(G.rift.t % 60)).padStart(2, '0')}`; $('rift-fill').style.width = `${(G.rift.progress / G.rift.need) * 100}%`; }
        // pet chip
        const pet = G.pet;
        $('pet-fill').style.width = `${pet.state === 'away' ? 0 : Math.max(0, (pet.life / pet.max) * 114)}px`;
        $('pet-state').textContent = pet.state === 'away' ? `Ember: town (${Math.ceil(pet.t)}s)` : pet.state === 'down' ? 'Ember is down' : `Ember · ${pet.bag.filter(Boolean).length}/16`;
        // interaction prompt
        const near = G.near && G.features.find((f) => f.id === G.near);
        $('prompt').hidden = !near;
        if (near) $('prompt').textContent = `${this.touchOn ? 'Tap' : 'E'}: ${{ npc: 'talk', stash: 'open the stash', obelisk: 'the rift obelisk', shrine: 'the shrine of oaths', waystone: 'travel' }[near.kind] || 'use'}`;
        $('skills-ic').setAttribute('style', masteryIcon(P.masteries[0]));
    }

    toast(text, cls = '') {
        const el = document.createElement('div');
        el.className = 'toast ' + cls;
        el.textContent = text;
        $('toasts').appendChild(el);
        while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
        setTimeout(() => el.remove(), 3100);
    }

    onEvents(G, events) {
        for (const e of events) {
            switch (e.type) {
                case 'card': this.card(e.id); break;
                case 'lore': this.lore(e.title, e.text); break;
                case 'levelup': this.toast(`Level ${e.level}! Skill and attribute points to spend.`, 'big'); break;
                case 'ascend': this.toast(`Ascension ${e.n}: a free attribute point.`, 'big'); break;
                case 'waystone': this.toast(`Waystone found: ${AREAS[e.area].name}`); break;
                case 'area': if (e.id !== 'town') this.toast(AREAS[e.id].name + (e.tier ? ` · Tier ${e.tier}` : ''), 'big'); break;
                case 'aggro': if (e.boss) this.toast(`"${BOSSES[e.boss].taunt[0]}"`, 'legendary'); break;
                case 'bossDead': this.toast(`"${BOSSES[e.boss].death}"`, 'legendary'); this.toast(`${e.name} is slain!`, 'big'); break;
                case 'bossPhase': if (e.line) this.toast(`"${e.line}"`, 'legendary'); break;
                case 'guardian': this.toast(`The Rift Guardian: ${e.name}`, 'legendary'); break;
                case 'riftDone': this.toast(`Rift tier ${e.tier} cleared! Tier ${e.tier + 1} is open.`, 'big'); break;
                case 'drop': if (e.rarity === 'legendary' || e.rarity === 'mythic' || e.rarity === 'set') this.toast(`${G.items[e.id]?.name}`, 'legendary'); break;
                case 'mastery': this.toast(`Your second oath: ${MASTERIES[e.m].name}. You are a ${e.hybrid}.`, 'big'); break;
                case 'masteryReady': this.toast('Level 6: visit the Shrine of Oaths in town to swear a second oath.', 'big'); break;
                case 'petTrip': this.toast(`Ember heads to town with ${e.sold} things.`); break;
                case 'petBack': this.toast(`Ember is back: +${e.gold} gold, potions refilled.`); break;
                case 'potionCharge': break;
                case 'denied': if (!/cooldown|busy|no target/.test(e.reason)) this.toast(e.reason); break;
                case 'gamble': this.toast(`Ysolde hands you ${G.items[e.id].name}.`, e.rarity === 'legendary' ? 'legendary' : ''); break;
                case 'death': $('dead-text').textContent = e.lost ? `You lost ${e.lost} gold. You will wake by the last waystone you touched.` : 'The rift drags at you: the clock runs on.'; this.openScreen('dead'); break;
                case 'respawn': if (this.top() === 'dead') this.closeScreen('dead'); break;
            }
        }
    }
}

