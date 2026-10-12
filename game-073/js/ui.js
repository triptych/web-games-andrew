// The DOM layer: HUD, dialogue, shops, journal and map, title and settings screens.
// It reads G and calls the simulation's shop/story functions; it never steps the sim.

import {
    ORES, RELICS, ARTIFACTS, UPGRADES, UPGRADE_ORDER, ITEMS, STRATA, BUILDINGS, WAYSTONES, W, H, T,
    FUEL_PRICE, REPAIR_PRICE, VERSION,
} from './config.js';
import {
    derived, cargoCount, cargoValue, depthOf, sellAll, buyFuel, fuelCost, repair, repairCost, buyUpgrade, buyItem,
    useItem, travel,
} from './sim/game.js';
import {
    CAST, SCENES, CHAPTERS, LORE, APPRAISAL, EPILOGUE, objectiveText, talk, hasBusiness, chatter, chooseInScene,
    availableContracts, canDeliver, deliverContract, CONTRACTS,
} from './sim/story.js';
import { drawPortrait } from './view/textures.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = (n) => Math.floor(n).toLocaleString('en-US');
const WHO_OF = { well: 'thimble', assay: 'sedge', forge: 'pell', spire: 'ansel', guild: 'orla', runes: 'mirabel' };
const BUILDING_OF_WHO = { orla: 'guild', ansel: 'spire', pell: 'forge', sedge: 'assay', mirabel: 'runes' };

export class UI {
    constructor({ audio, input, settings, onSettings }) {
        this.audio = audio;
        this.input = input;
        this.settings = settings;
        this.onSettings = onSettings;
        this.G = null;
        this.sceneQueue = [];
        this.scene = null;     // { id, lines, i, shown, full }
        this.onSceneDone = null;
        this.panelKey = null;
        this.toastN = 0;
        this.hudT = 0;
        this.barkT = 0;
        this.portraits = {};
        this.journalTab = 'quest';
        this.screenStack = [];
        this._buildStatic();
    }

    fmt(text) {
        const n = this.G ? this.G.name : 'Rook';
        return text.replaceAll('{name}', n).replaceAll('{NAME}', n.toUpperCase());
    }

    // ------------------------------------------------------------------
    // Static wiring
    // ------------------------------------------------------------------
    _buildStatic() {
        $('version').textContent = `v${VERSION} · three.js · no asset files`;
        // relic slots
        $('relic-row').innerHTML = RELICS.map((r) => `<div class="relic-slot" id="rs-${r.id}" style="--c:${r.col}" title="${esc(r.name)}">${r.icon}</div>`).join('');
        // item buttons: touch grid and desktop row
        const itemBtn = (it, i, keys) => `<button class="item-btn" data-item="${it.key}" aria-label="${esc(it.name)}" title="${esc(it.name)} (${i + 1})">${it.icon}<b>0</b>${keys ? `<i>${i + 1}</i>` : ''}</button>`;
        $('item-btns').innerHTML = ITEMS.map((it, i) => itemBtn(it, i, false)).join('');
        $('item-keys').innerHTML = ITEMS.map((it, i) => itemBtn(it, i, true)).join('');
        for (const b of document.querySelectorAll('.item-btn')) {
            b.addEventListener('click', (e) => { e.preventDefault(); this.useItem(b.dataset.item); });
        }
        // dialogue: tap anywhere on the box
        $('dialog').addEventListener('click', (e) => { if (e.target.closest('#dlg-choices')) return; this.advance(); });
        // generic close buttons
        for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { this.audio.ui('close'); this.closeTop(); });
        // journal tabs
        for (const b of document.querySelectorAll('#journal .tabs button')) {
            b.addEventListener('click', () => { this.audio.ui('page'); this.renderJournal(b.dataset.tab); });
        }
        $('journal-close').addEventListener('click', () => { this.audio.ui('close'); this.closeTop(); });
        $('panel-leave').addEventListener('click', () => this.closePanel());
        $('panel-talk').addEventListener('click', () => this.panelTalk());
        // settings
        const S = this.settings;
        const sfx = $('set-sfx'), mus = $('set-music'), q = $('set-quality'), sh = $('set-shake'), tc = $('set-touch');
        sfx.value = S.sfx; mus.value = S.music; q.value = S.quality; sh.checked = S.shake; tc.value = S.touch;
        const changed = () => {
            Object.assign(S, { sfx: +sfx.value, music: +mus.value, quality: q.value, shake: sh.checked, touch: tc.value });
            this.onSettings(S);
        };
        for (const el of [sfx, mus, q, sh, tc]) el.addEventListener('input', changed);
        for (const el of [q, sh, tc]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => {
            if (window.confirm('Delete your saved delve? This cannot be undone.')) { this.onSettings(S, { deleteSave: true }); this.toast('Saved delve deleted.'); }
        });
    }

    // ------------------------------------------------------------------
    // Screens
    // ------------------------------------------------------------------
    openScreen(id) {
        const el = $(id);
        el.hidden = false;
        el.classList.add('show');
        if (!this.screenStack.includes(id)) this.screenStack.push(id);
    }
    closeScreen(id) {
        const el = $(id);
        el.hidden = true;
        el.classList.remove('show');
        this.screenStack = this.screenStack.filter((s) => s !== id);
        if (this.onScreenClosed) this.onScreenClosed(id);
    }
    closeTop() {
        const top = this.screenStack[this.screenStack.length - 1];
        if (top === 'panel') this.closePanel();
        else if (top) this.closeScreen(top);
    }
    anyScreen() { return this.screenStack.length > 0; }
    topScreen() { return this.screenStack[this.screenStack.length - 1] || null; }

    setTouch(on) {
        $('touch').hidden = !on;
        $('item-keys').hidden = on;
        document.body.classList.toggle('touch', on);
        this.touchOn = on;
    }

    // ------------------------------------------------------------------
    // HUD
    // ------------------------------------------------------------------
    showHud(on) { $('hud').hidden = !on; if (!on) { $('touch').hidden = true; $('item-keys').hidden = true; $('btn-enter').hidden = true; } else this.setTouch(this.touchOn); }

    hud(G, dt, mode) {
        const rig = G.rig, S = derived(G);
        const f = rig.fuel / S.tank, h = rig.hull / S.hull;
        $('fuel-fill').style.width = `${Math.max(0, f * 100).toFixed(1)}%`;
        $('hull-fill').style.width = `${Math.max(0, h * 100).toFixed(1)}%`;
        this.hudT -= dt;
        if (this.hudT > 0) return;
        this.hudT = 0.1;
        $('fuel-v').textContent = `${rig.fuel.toFixed(1)}/${S.tank}`;
        $('hull-v').textContent = `${Math.ceil(rig.hull)}/${S.hull}`;
        $('g-fuel').classList.toggle('low', f < 0.2 && rig.y < 0);
        $('g-hull').classList.toggle('low', h < 0.25);
        const d = depthOf(G);
        const st = rig.y < 0 ? STRATA[Math.min(6, rig.lastStratum)].name : 'Emberwick';
        $('depth').textContent = rig.y < 0 ? `${d} fathoms · ${st}` : 'Emberwick';
        $('money').textContent = `⚜ ${fmtN(G.money)}`;
        const cc = cargoCount(G);
        $('cargo').textContent = `▣ ${cc}/${S.cargo}`;
        $('cargo').classList.toggle('full', cc >= S.cargo);
        for (let i = 0; i < 7; i++) $(`rs-${i}`).classList.toggle('on', !!G.relics[i]);
        const ch = CHAPTERS[G.story.ch];
        $('objective').querySelector('.obj-ch').textContent = ch ? ch.title : '';
        $('objective').querySelector('.obj-txt').textContent = objectiveText(G);
        $('heat').hidden = !(rig.heat > 0.25 && mode === 'play');
        for (const b of document.querySelectorAll('.item-btn')) {
            const n = G.items[b.dataset.item];
            b.querySelector('b').textContent = n;
            b.classList.toggle('empty', !n);
        }
        // enter prompt
        const enter = $('btn-enter');
        const at = mode === 'play' && !rig.drill ? G.at : null;
        if (at) {
            const name = at.startsWith('waystone') ? WAYSTONES[+at.split(':')[1]].name : BUILDINGS.find((b) => b.key === at).name;
            const business = !at.startsWith('waystone') && hasBusiness(G, WHO_OF[at]);
            enter.textContent = `${business ? '❗ ' : ''}Enter ${name}${this.touchOn ? '' : '  (E)'}`;
            enter.hidden = false;
        } else enter.hidden = true;
        // bark timeout
        if (this.barkT > 0) { this.barkT -= 0.1; if (this.barkT <= 0) $('bark').hidden = true; }
    }

    /** Which buildings have story business — the ❗ markers over the town. */
    business(G) {
        const out = {};
        for (const who of Object.keys(BUILDING_OF_WHO)) if (hasBusiness(G, who)) out[BUILDING_OF_WHO[who]] = true;
        return out;
    }

    toast(text, cls = '', ms = 3200) {
        const el = document.createElement('div');
        el.className = `toast ${cls}`;
        el.innerHTML = text;
        const box = $('toasts');
        box.appendChild(el);
        while (box.children.length > 4) box.firstChild.remove();
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 600); }, ms);
    }

    floater(view, x, y, text, color = '#fff') {
        const p = view.toScreen(x, y);
        if (!p.on) return;
        const el = document.createElement('div');
        el.className = 'floater';
        el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; el.style.color = color;
        el.textContent = text;
        $('floaters').appendChild(el);
        setTimeout(() => el.remove(), 1400);
    }

    bark(text, who = 'thimble') {
        const cv = $('bark-face');
        drawPortrait(cv, who, CAST);
        $('bark-txt').textContent = this.fmt(text);
        $('bark').hidden = false;
        $('bark').style.animation = 'none'; void $('bark').offsetWidth; $('bark').style.animation = '';
        this.barkT = Math.min(7, 2.5 + text.length * 0.045);
    }

    /** Turn simulation events into HUD feedback. */
    onEvents(G, events, view) {
        for (const e of events) {
            switch (e.type) {
                case 'ore':
                    if (e.lost) this.floater(view, G.rig.x, G.rig.y + 0.6, `${ORES[e.id].name} lost!`, '#ff8a6a');
                    else this.floater(view, G.rig.x, G.rig.y + 0.6, `+${ORES[e.id].name}`, ORES[e.id].col2);
                    break;
                case 'cache': this.floater(view, e.c + 0.5, -(e.r + 0.5), `+⚜${e.amount}`, '#ffd27a'); this.toast(`A dwarven coffer: <b>⚜ ${e.amount}</b>`, 'gold'); break;
                case 'artifact': this.toast(`Found: <b>${esc(ARTIFACTS[e.id].name)}</b>${ARTIFACTS[e.id].value ? ' — Sedge will appraise it.' : ''}`, 'gold', 4200); break;
                case 'hurt': if (e.amt >= 3) this.floater(view, G.rig.x, G.rig.y + 0.5, `-${Math.round(e.amt)}`, '#ff7a5a'); break;
                case 'msg': this.toast(esc(e.text)); break;
                case 'bark': this.bark(e.text, e.who || 'thimble'); break;
                case 'codex': this.toast(`Codex: <b>${esc(LORE[e.key].title)}</b>`, '', 2600); break;
                case 'reward': this.toast(`The Guild pays <b>⚜ ${fmtN(e.amount)}</b>`, 'gold'); break;
                case 'contract': this.toast(`Contract fulfilled: <b>${esc(CONTRACTS[e.id].title)}</b> · ⚜ ${fmtN(e.reward)}`, 'gold', 4000); break;
                case 'chapter': this.toast(`<div class="obj-ch">Chapter ${e.ch}</div>${esc(e.title)}`, 'big gold', 4500); $('objective').classList.remove('pulse'); void $('objective').offsetWidth; $('objective').classList.add('pulse'); break;
                case 'objective': this.toast(esc(e.text), 'gold', 4500); $('objective').classList.remove('pulse'); void $('objective').offsetWidth; $('objective').classList.add('pulse'); break;
                case 'stratum': if (e.s > 0 && e.s < 6) this.toast(`<b>${STRATA[e.s].name}</b>`, 'big', 2600); break;
                case 'relic': this.toast(`Relic: <b>${esc(RELICS[e.id].name)}</b>`, 'big gold', 5000); break;
                case 'rescued': this.toast(`The Guild crane hauled Thimble up. Fee: ⚜ ${fmtN(e.fee)}${e.lost ? `, ${e.lost} pieces of cargo lost` : ''}.`, '', 5500); break;
                case 'down': this.toast(e.reason === 'fuel' ? 'Out of aether! Signalling the Guild crane…' : e.reason === 'heat' ? 'The heat has cooked the hull! Signalling the crane…' : 'Hull breached! Signalling the Guild crane…', 'big', 2400); break;
                case 'upgrade': if (e.gift) this.toast(`Corvin's rime-runes: Frostward raised to <b>${UPGRADES.ward.tiers[e.tier].name}</b>`, 'gold', 4500); break;
                case 'gate-open': this.toast('<b>The Rune Gate is open.</b>', 'big gold', 4000); break;
                case 'shard': this.toast(`Heart-shard broken · ${e.n}/4`, 'big gold', 2500); break;
                case 'waystone': this.toast(`<b>${WAYSTONES[e.id].name}</b> awakens`, 'big gold', 3500); break;
                default: break;
            }
        }
    }

    // ------------------------------------------------------------------
    // Dialogue
    // ------------------------------------------------------------------
    queueScene(id) { if (SCENES[id]) this.sceneQueue.push(id); }
    inScene() { return !!this.scene || this.sceneQueue.length > 0; }

    /** Start the next queued scene if none is playing. Returns true while a scene is up. */
    pumpScenes() {
        if (this.scene) return true;
        const id = this.sceneQueue.shift();
        if (!id) return false;
        this.scene = { id, lines: SCENES[id], i: -1 };
        $('dialog').hidden = false;
        this.audio.ui('open');
        this._nextLine();
        return true;
    }

    _nextLine() {
        const S = this.scene;
        S.i++;
        const line = S.lines[S.i];
        if (!line) {
            const id = S.id;
            this.scene = null;
            if (!this.sceneQueue.length) $('dialog').hidden = true;
            if (this.onSceneDone) this.onSceneDone(id);
            this.pumpScenes();
            return;
        }
        $('dlg-choices').innerHTML = '';
        if (line.choice) {
            $('dlg-next').hidden = true;
            for (const c of line.choice) {
                const b = document.createElement('button');
                b.className = 'btn';
                b.textContent = this.fmt(c.label);
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.audio.ui('click');
                    chooseInScene(this.G, S.id, c.flag);
                    // the sim pushed a follow-up scene event; main routes it into the queue
                    this.onChoice?.();
                    this._nextLine();
                });
                $('dlg-choices').appendChild(b);
            }
            S.full = ''; S.shown = 0;
            return;
        }
        const who = line.who;
        const c = CAST[who] || {};
        $('dlg-name').textContent = who === 'narrator' ? '' : c.name;
        $('dlg-title').textContent = who === 'narrator' ? '' : c.title || '';
        const face = $('dlg-face');
        face.hidden = who === 'narrator';
        if (who !== 'narrator') drawPortrait(face, who, CAST);
        $('dlg-text').classList.toggle('narrator', who === 'narrator');
        S.full = this.fmt(line.text);
        S.shown = 0;
        S.who = who;
        $('dlg-text').textContent = '';
        $('dlg-next').hidden = true;
    }

    advance() {
        const S = this.scene;
        if (!S) return;
        const line = S.lines[S.i];
        if (line && line.choice) return;
        if (S.shown < S.full.length) { S.shown = S.full.length; $('dlg-text').textContent = S.full; $('dlg-next').hidden = false; return; }
        this.audio.ui('click');
        this._nextLine();
    }

    sceneUpdate(dt) {
        const S = this.scene;
        if (!S || !S.full || S.shown >= S.full.length) return;
        const before = Math.floor(S.shown);
        S.shown = Math.min(S.full.length, S.shown + dt * 52);
        const now = Math.floor(S.shown);
        if (now !== before) {
            $('dlg-text').textContent = S.full.slice(0, now);
            if (now % 3 === 0 && S.full[now] !== ' ') this.audio.blip(S.who);
        }
        if (S.shown >= S.full.length) $('dlg-next').hidden = false;
    }

    // ------------------------------------------------------------------
    // Story cards (epilogue)
    // ------------------------------------------------------------------
    cards(texts, done) {
        let i = 0;
        const el = $('cards');
        const show = () => {
            $('cards-text').textContent = this.fmt(texts[i]);
            $('cards-text').style.animation = 'none'; void $('cards-text').offsetWidth; $('cards-text').style.animation = '';
        };
        const next = () => {
            i++;
            if (i >= texts.length) { el.removeEventListener('click', next); this.closeScreen('cards'); this.cardsNext = null; done(); return; }
            this.audio.ui('page');
            show();
        };
        this.cardsNext = next;
        el.addEventListener('click', next);
        this.openScreen('cards');
        show();
    }

    endingSheet(G, done) {
        const st = G.stats;
        const mins = Math.floor(st.time / 60);
        $('ending-card').innerHTML = `
            <h2>The Spire Burns Bright</h2>
            <p style="text-align:center"><i>${esc(G.name)} Ashdown and ${G.story.flags.endingChoice === 'rest' ? 'old Thimble' : 'Maren, in old Thimble'}, delvers of Emberwick.</i></p>
            <table class="stats">
                <tr><td>Time in the deep</td><td>${Math.floor(mins / 60)}h ${mins % 60}m</td></tr>
                <tr><td>Deepest delve</td><td>${st.deepest} fathoms</td></tr>
                <tr><td>Tiles dug</td><td>${fmtN(st.dug)}</td></tr>
                <tr><td>Ore hauled</td><td>${fmtN(st.ore)} pieces</td></tr>
                <tr><td>Crowns earned</td><td>⚜ ${fmtN(st.earned)}</td></tr>
                <tr><td>Contracts fulfilled</td><td>${st.contracts}</td></tr>
                <tr><td>Finds &amp; journal pages</td><td>${G.found.length} of ${ARTIFACTS.length}</td></tr>
                <tr><td>Times the crane came</td><td>${st.rescues}</td></tr>
            </table>
            <p class="small" style="text-align:center">The deep is yours. Keep delving — there is ore left, contracts to fill, and finds you missed.</p>`;
        this.openScreen('ending');
        $('ending-next').onclick = () => { this.audio.ui('click'); this.closeScreen('ending'); done(); };
    }

    // ------------------------------------------------------------------
    // Shops and waystones
    // ------------------------------------------------------------------
    openPanel(G, key) {
        this.G = G;
        this.panelKey = key;
        this.panelLine = null;
        this.audio.ui('open');
        this.openScreen('panel');
        this.renderPanel();
    }

    closePanel() {
        if (!this.panelKey) return;
        this.audio.ui('close');
        this.panelKey = null;
        this.closeScreen('panel');
    }

    panelTalk() {
        const G = this.G;
        const who = WHO_OF[this.panelKey];
        if (!who || who === 'thimble') return;
        this.audio.ui('click');
        const res = talk(G, who);
        if (res.line) { this.panelLine = res.line; this.renderPanel(); }
        // a scene arrives as an event; main will queue it and re-render the panel when it ends
    }

    renderPanel() {
        const G = this.G, key = this.panelKey;
        if (!key) return;
        const S = derived(G);
        const isWay = key.startsWith('waystone');
        const b = isWay ? null : BUILDINGS.find((bb) => bb.key === key);
        const who = isWay ? (G.relics[5] ? 'maren' : 'thimble') : WHO_OF[key];
        $('panel-title').textContent = isWay ? WAYSTONES[+key.split(':')[1]].name : b.name;
        const c = CAST[who];
        $('panel-who').textContent = `${c.name}${c.title ? ' · ' + c.title : ''}`;
        drawPortrait($('panel-face'), who, CAST);
        const greet = this.panelLine || this._greeting(G, key, who);
        $('panel-line').textContent = this.fmt(greet);
        const talkBtn = $('panel-talk');
        const canTalk = !isWay && who !== 'thimble';
        talkBtn.hidden = !canTalk;
        if (canTalk) {
            talkBtn.textContent = `Talk to ${c.name.split(' ')[0]}`;
            talkBtn.classList.toggle('has-business', hasBusiness(G, who));
        }
        $('panel-money').textContent = `⚜ ${fmtN(G.money)}`;
        let html = '';
        const fuelRow = () => {
            const cost = fuelCost(G);
            const full = G.rig.fuel >= S.tank - 0.01;
            return `<div class="shop-row"><div class="nm">Aether ${G.rig.fuel.toFixed(1)} / ${S.tank}</div>
                <div class="ds">${isWay ? 'Dwarven aether, at a dwarven price.' : `${FUEL_PRICE} crowns a measure, straight from the well.`}</div>
                <button class="btn primary" data-act="fuel" ${full || G.money < 1 ? 'disabled' : ''}>${full ? 'Full' : `Fill <span class="price">⚜ ${fmtN(Math.min(cost, G.money))}</span>`}</button></div>`;
        };
        const repairRow = () => {
            const cost = repairCost(G);
            const full = G.rig.hull >= S.hull - 0.01;
            return `<div class="shop-row"><div class="nm">Hull ${Math.ceil(G.rig.hull)} / ${S.hull}</div>
                <div class="ds">${isWay ? 'Patch the dents with dwarf-iron.' : `Pell beats out the dents: ${REPAIR_PRICE} crowns a point.`}</div>
                <button class="btn" data-act="repair" ${full || G.money < 1 ? 'disabled' : ''}>${full ? 'Sound' : `Repair <span class="price">⚜ ${fmtN(Math.min(cost, G.money))}</span>`}</button></div>`;
        };
        switch (isWay ? 'waystone' : key) {
            case 'well':
                html = `<div class="shop-list">${fuelRow()}</div>
                    <p class="note">The well hums. Thimble's tank drinks deep. ${G.rig.fuel < S.tank * 0.5 ? 'You should fill it before you go down.' : ''}</p>`;
                break;
            case 'assay': {
                const lines = G.cargo.map((n, i) => (n ? `<div class="cargo-line"><span><span class="dot" style="background:${ORES[i].col}"></span>${n} × ${ORES[i].name}</span><span>⚜ ${fmtN(n * ORES[i].value)}</span></div>` : '')).join('');
                const arts = G.pendingArtifacts.map((a) => `<div class="cargo-line"><span>✦ ${esc(ARTIFACTS[a].name)}</span><span>${ARTIFACTS[a].value ? '⚜ ' + fmtN(ARTIFACTS[a].value) : 'kept'}</span></div>`).join('');
                const total = cargoValue(G) + G.pendingArtifacts.reduce((s, a) => s + ARTIFACTS[a].value, 0);
                html = `<h3>Your hold · ${cargoCount(G)}/${S.cargo}</h3>
                    ${lines || arts ? lines + arts : '<p class="small">The hold is empty. Sedge sighs, theatrically.</p>'}
                    <div class="big-action"><button class="btn primary" data-act="sell" ${total ? '' : 'disabled'}>Sell everything <span class="price">⚜ ${fmtN(total)}</span></button></div>
                    <h3>Today's prices</h3>
                    <div>${ORES.filter((o) => G.stats.deepest + 10 >= o.min).map((o) => `<div class="cargo-line"><span><span class="dot" style="background:${o.col}"></span>${o.name}</span><span>⚜ ${o.value}</span></div>`).join('')}</div>`;
                break;
            }
            case 'forge': {
                html = `<div class="shop-list">${repairRow()}`;
                for (const k of UPGRADE_ORDER) {
                    const line = UPGRADES[k];
                    const cur = line.tiers[G.up[k]], next = line.tiers[G.up[k] + 1];
                    const pips = line.tiers.slice(1).map((_, i) => `<i class="${i < G.up[k] ? 'on' : ''}"></i>`).join('');
                    const stat = (t) => (k === 'drill' ? `hardness ${t.power + 1}, speed ×${t.speed}` : k === 'ward' ? `${Math.round(t.value * 100)}% heat shield` : k === 'vanes' ? `lift ×${t.value}` : k === 'lantern' ? `${t.value} tiles of light` : `${t.value} ${line.stat.toLowerCase()}`);
                    html += `<div class="shop-row"><div class="nm">${line.label}: ${cur.name}<span class="pips">${pips}</span></div>
                        <div class="ds">${next ? `Next: <b>${next.name}</b> — ${stat(next)}` : 'The finest Pell can make.'}${k === 'drill' && G.relics[6] ? ' · the Starforged Lance adds +1 hardness.' : ''}</div>
                        <button class="btn" data-act="up:${k}" ${!next || G.money < next.price ? 'disabled' : ''}>${next ? `Buy <span class="price">⚜ ${fmtN(next.price)}</span>` : 'Max'}</button></div>`;
                }
                html += '</div>';
                break;
            }
            case 'runes':
                html = '<div class="shop-list">' + ITEMS.map((it, i) => `<div class="shop-row"><div class="nm">${it.icon} ${it.name} <small>(${G.items[it.key]}/${it.max})</small></div>
                    <div class="ds">${esc(it.desc)} ${this.touchOn ? '' : `Key ${i + 1}.`}</div>
                    <button class="btn" data-act="item:${it.key}" ${G.items[it.key] >= it.max || G.money < it.price ? 'disabled' : ''}>Buy <span class="price">⚜ ${it.price}</span></button></div>`).join('') + '</div>';
                break;
            case 'guild': {
                const list = availableContracts(G);
                html = '<h3>The Contract Board</h3>';
                if (!list.length) html += '<p class="small">No contracts posted. Check back as the story deepens.</p>';
                html += '<div class="shop-list">' + list.map((ct) => `<div class="shop-row"><div class="nm">${esc(ct.title)} <small>— ${esc(CAST[ct.from].name)}</small></div>
                    <div class="ds">${esc(ct.text)} Deliver <b>${ct.n} × ${ORES[ct.ore].name}</b> (in your hold: ${G.cargo[ct.ore]}).</div>
                    <button class="btn" data-act="contract:${ct.id}" ${canDeliver(G, ct.id) ? '' : 'disabled'}>Deliver <span class="price">⚜ ${fmtN(ct.reward)}</span></button></div>`).join('') + '</div>';
                html += `<p class="small">Contracts fulfilled: ${G.story.contractsDone.length} of ${CONTRACTS.length}. Ore you deliver doesn't go to Sedge — deliver before you sell.</p>`;
                break;
            }
            case 'spire': {
                const ws = G.world.waystonePos.filter((w) => G.waystones[w.id]);
                html = `<p class="note">At the Spire's foot stands an old waystone. ${ws.length ? 'It answers to the deep stones you have woken.' : 'It is cold. Somewhere far below, its kin are sleeping.'}</p>`;
                if (ws.length) html += '<div class="shop-list">' + ws.map((w) => `<div class="shop-row"><div class="nm">Travel to ${WAYSTONES[w.id].name}</div><div class="ds">${w.r} fathoms down. Free, and instant.</div><button class="btn primary" data-act="travel:${w.id}">Go</button></div>`).join('') + '</div>';
                break;
            }
            case 'waystone': {
                const id = +key.split(':')[1];
                const others = G.world.waystonePos.filter((w) => G.waystones[w.id] && w.id !== id);
                html = `<div class="shop-list">${fuelRow()}${repairRow()}
                    <div class="shop-row"><div class="nm">Travel to the Lumen Spire</div><div class="ds">Up to Emberwick in a breath, cargo and all.</div><button class="btn primary" data-act="travel:surface">Go up</button></div>
                    ${others.map((w) => `<div class="shop-row"><div class="nm">Travel to ${WAYSTONES[w.id].name}</div><div class="ds">${w.r} fathoms.</div><button class="btn" data-act="travel:${w.id}">Go</button></div>`).join('')}
                    </div>`;
                break;
            }
            default: break;
        }
        const body = $('panel-body');
        body.innerHTML = html;
        for (const btn of body.querySelectorAll('[data-act]')) btn.addEventListener('click', () => this.panelAction(btn.dataset.act));
    }

    _greeting(G, key, who) {
        if (key === 'well') return G.relics[5] ? 'The well-keeper waves. Maren hums an old pumping song.' : 'The Aether Well bubbles blue. A brass tap, a tin cup, a sign: "Two crowns the measure. Honesty box."';
        if (key.startsWith('waystone')) return G.relics[5] ? 'A dwarf-well, still pouring after nine hundred years. They built things to last, bless them.' : 'Runes glow in a ring around the plinth.';
        return chatter(G, who) || '…';
    }

    panelAction(act) {
        const G = this.G;
        let res = { ok: true };
        if (act === 'fuel') res = buyFuel(G);
        else if (act === 'repair') res = repair(G);
        else if (act === 'sell') {
            const r = sellAll(G);
            const ap = G.found.length ? null : null; void ap;
            res = { ok: r.total > 0 };
            const lastArt = r.arts.filter((a) => APPRAISAL[a.id]).pop();
            if (lastArt) this.panelLine = APPRAISAL[lastArt.id];
            else if (r.total) this.panelLine = r.total > 2000 ? 'Hm. Hmm! That will do very nicely.' : 'Weighed, tested, paid. Next.';
        }
        else if (act.startsWith('up:')) res = buyUpgrade(G, act.slice(3));
        else if (act.startsWith('item:')) res = buyItem(G, act.slice(5));
        else if (act.startsWith('contract:')) res = deliverContract(G, +act.slice(9));
        else if (act.startsWith('travel:')) {
            const dest = act.slice(7);
            this.closePanel();
            this.onTravel?.(dest === 'surface' ? 'surface' : +dest);
            return;
        }
        if (!res.ok) this.audio.ui('deny');
        this.renderPanel();
    }

    // ------------------------------------------------------------------
    // Journal
    // ------------------------------------------------------------------
    openJournal(G, tab) {
        this.G = G;
        this.openScreen('journal');
        this.renderJournal(tab || this.journalTab);
    }

    renderJournal(tab) {
        const G = this.G;
        this.journalTab = tab;
        for (const b of document.querySelectorAll('#journal .tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
        const body = $('journal-body');
        let html = '';
        if (tab === 'quest') {
            const ch = CHAPTERS[G.story.ch];
            html = `<h2>${ch ? esc(ch.title) : ''}</h2><p class="note">${esc(objectiveText(G))}</p><h3>The tale so far</h3><ul class="ch-list">` +
                CHAPTERS.map((c, i) => (i <= G.story.ch ? `<li class="${i < G.story.ch ? 'done' : 'now'}">${i}. ${esc(c.title)}</li>` : '')).join('') + '</ul>';
            html += '<h3>Contracts open</h3>' + (availableContracts(G).map((c) => `<div class="cargo-line"><span>${esc(c.title)}</span><span>${G.cargo[c.ore]}/${c.n} ${ORES[c.ore].name}</span></div>`).join('') || '<p class="small">None.</p>');
        } else if (tab === 'relics') {
            html = '<p class="small">Seven keys, scattered when Kharadun fell. Each wakes a power in Thimble\'s heartcore.</p>' + RELICS.map((r) => {
                const has = G.relics[r.id];
                return `<div class="relic-card ${has ? '' : 'off'}"><div class="ic" style="color:${has ? r.col : '#665'}">${has ? r.icon : '?'}</div>
                    <div><b>${has ? esc(r.name) : 'An unknown relic'}</b><br><span class="small">${has ? esc(r.power) : `Maren's notes place a vault near ${r.depth} fathoms.`}</span></div></div>`;
            }).join('');
        } else if (tab === 'codex') {
            const cats = ['Strata', 'Relics', 'Journal', 'Finds', 'People'];
            for (const cat of cats) {
                const keys = G.codex.filter((k) => LORE[k]?.cat === cat);
                if (!keys.length) continue;
                html += `<h3>${cat}</h3>` + keys.map((k) => `<div class="codex-entry"><b>${esc(LORE[k].title)}</b><br>${esc(this.fmt(LORE[k].text))}</div>`).join('');
            }
            if (!html) html = '<p>The codex is empty. Dig, and it will fill.</p>';
            html += `<p class="small">${G.codex.length} of ${Object.keys(LORE).length} entries.</p>`;
        } else if (tab === 'map') {
            html = '<div class="map-legend">Everything Thimble\'s lantern has seen. <span style="color:#fff">●</span> Thimble · <span style="color:#6fe0ff">◆</span> waystone · <span style="color:#ffd27a">✦</span> relic vaults (Maren\'s notes)</div><div id="map-wrap"><canvas id="map-canvas"></canvas></div>';
        } else if (tab === 'stats') {
            const st = G.stats;
            const mins = Math.floor(st.time / 60);
            html = `<table>
                <tr><td>Delver</td><td>${esc(G.name)} Ashdown</td></tr>
                <tr><td>Time delving</td><td>${Math.floor(mins / 60)}h ${mins % 60}m</td></tr>
                <tr><td>Deepest</td><td>${st.deepest} fathoms</td></tr>
                <tr><td>Tiles dug</td><td>${fmtN(st.dug)}</td></tr>
                <tr><td>Ore hauled</td><td>${fmtN(st.ore)}</td></tr>
                <tr><td>Crowns earned</td><td>⚜ ${fmtN(st.earned)}</td></tr>
                <tr><td>Relics</td><td>${G.relics.filter(Boolean).length} / 7</td></tr>
                <tr><td>Finds</td><td>${G.found.length} / ${ARTIFACTS.length}</td></tr>
                <tr><td>Contracts</td><td>${st.contracts}</td></tr>
                <tr><td>Blast runes set off</td><td>${st.blasts}</td></tr>
                <tr><td>Crane rescues</td><td>${st.rescues}</td></tr></table>`;
        }
        body.innerHTML = html;
        if (tab === 'map') this.drawMap(G);
    }

    drawMap(G) {
        const cv = $('map-canvas');
        const wrap = $('map-wrap');
        const sc = Math.max(4, Math.min(9, Math.floor((wrap.clientWidth - 8) / W)));
        cv.width = W * sc; cv.height = (H + 4) * sc;
        cv.style.width = `${W * sc}px`; cv.style.height = `${(H + 4) * sc}px`;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = '#3a6a2a'; ctx.fillRect(0, 3 * sc, cv.width, sc);
        ctx.fillStyle = '#4a6a9a'; ctx.fillRect(0, 0, cv.width, 3 * sc);
        const w = G.world;
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                const i = r * W + c;
                if (!w.seen[i]) continue;
                const t = w.tiles[i];
                const s = STRATA[w.strat[i]].tint;
                let col;
                if (t === T.EMPTY) col = `rgb(${s[0] * 70 | 0},${s[1] * 70 | 0},${s[2] * 70 | 0})`;
                else if (t === T.ORE) col = ORES[w.aux[i]].col;
                else if (t === T.GAS) col = '#6ad040';
                else if (t === T.LAVA) col = '#ff6020';
                else if (t === T.RELIC) col = '#ffffff';
                else if (t === T.WAYSTONE) col = '#6fe0ff';
                else if (t === T.BEDROCK || t === T.RUNESTONE) col = '#202028';
                else if (t === T.BRICK) col = '#8a7a6a';
                else if (t === T.GATE) col = '#ffd27a';
                else col = `rgb(${s[0] * 200 | 0},${s[1] * 200 | 0},${s[2] * 200 | 0})`;
                ctx.fillStyle = col;
                ctx.fillRect(c * sc, (r + 4) * sc, sc, sc);
            }
        }
        // strata labels and relic depth notes
        ctx.font = `${Math.max(9, sc + 3)}px Alegreya, serif`;
        ctx.textBaseline = 'middle';
        for (const s of STRATA) {
            ctx.fillStyle = 'rgba(255,240,210,0.35)';
            ctx.fillRect(0, (s.top + 4) * sc, cv.width, 1);
        }
        for (const rel of RELICS) {
            if (G.relics[rel.id]) continue;
            ctx.fillStyle = '#ffd27a';
            ctx.fillText('✦', 2, (rel.depth + 4.5) * sc);
        }
        for (const p of G.world.waystonePos) {
            if (!G.waystones[p.id]) continue;
            ctx.fillStyle = '#6fe0ff';
            ctx.fillRect(p.c * sc - sc * 0.5, (p.r + 4) * sc - sc * 0.5, sc * 2, sc * 2);
        }
        // Thimble
        const rx = G.rig.x * sc, ry = (-G.rig.y + 4) * sc;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(rx, ry, sc * 1.4, 0, 7); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rx, ry, sc * 0.6, 0, 7); ctx.fill();
        wrap.scrollTop = Math.max(0, ry - wrap.clientHeight / 2);
    }

    // ------------------------------------------------------------------
    // Items
    // ------------------------------------------------------------------
    useItem(key) {
        if (!this.G || !this.canUseItems?.()) return;
        const ok = useItem(this.G, key);
        if (!ok) this.audio.ui('deny');
    }

    // ------------------------------------------------------------------
    // Title
    // ------------------------------------------------------------------
    titleInfo(info) {
        const btn = $('btn-continue');
        btn.hidden = !info;
        $('continue-info').textContent = info ? `${info.name} · Chapter ${info.ch}: ${CHAPTERS[info.ch]?.title ?? ''} · ${info.deepest} fathoms · ${info.relics}/7 relics` : '';
        $('overwrite-warn').hidden = !info;
    }
}
