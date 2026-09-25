// ============================================================
// The UI controller: owns the DOM layers and routes Game events.
// ============================================================

import { ITEM } from '../data/items.js';
import { SKIN, HAIR_COLORS, EYES, CLOTH, HAIR_STYLES, ACCESSORIES, ACC_NAMES } from '../data/look.js';
import { G, O } from '../data/tiles.js';
import { clockText, dateText } from '../sim/state.js';
import { writeSlot, latestSlot, readSlot, slotMeta, loadOpts, writeOpts } from '../sim/save.js';
import { seedFromText, RNG, hash32 } from '../core/rng.js';
import { personName } from '../gen/names.js';
import { moodForBiome } from '../audio.js';
import { $, h, clear, iconEl, canvasEl } from './dom.js';
import { Panels } from './panels.js';
import { BattleView } from './battle.js';

const WEATHER_ICON = { sun: '☀', rain: '🌧', storm: '⛈', snow: '❄' };

export class UI {
    constructor({ sprites, audio, input, makeGame, renderer }) {
        this.sprites = sprites; this.audio = audio; this.input = input; this.makeGame = makeGame; this.renderer = renderer;
        this.opts = loadOpts();
        this.panels = new Panels(this);
        this.battle = new BattleView(this);
        this.dlgQueue = []; this.dlg = null;
        this.mode = 'title';
        this.hud = $('#hud'); this.hotbar = $('#hotbar'); this.touch = $('#touch');
        this.bindHud();
        this.applyOpts();
    }
    applyOpts() { this.audio.setVolumes(this.opts.music, this.opts.sfx); writeOpts(this.opts); }

    // ------------------------------------------------------------ game wiring
    attach(game) {
        this.game = game;
        this.sprites.game = game;
        this.renderer.setGame(game);
        game.on('toast', ({ text }) => this.toast(text));
        game.on('sfx', n => this.audio.sfx(n));
        game.on('dialog', d => this.showDialog(d));
        game.on('menu', m => this.openMenu(m));
        game.on('inv', () => { this.renderHotbar(); this.panels.refresh(); });
        game.on('battle', B => this.startBattle(B));
        game.on('newday', d => this.newDay(d));
        game.on('autosave', () => this.autosave());
        game.on('region', rg => this.enterRegion(rg));
        game.on('mapchange', m => { this.updateMusic(); if (m.kind !== 'world') this.banner(this.game.world.siteById[m.site].name, `Floor ${m.floor}`); });
        game.on('fade', () => this.flash());
        game.on('chapter', c => this.chapterCard(c));
        game.on('objective', () => this.updateObjective());
        game.on('festival', f => this.cutscene(f.lines, () => { this.audio.play('festival', this.game.s.seed); }));
        game.on('levelup', () => this.shake(0.2));
        game.on('dusk', () => this.updateMusic());
        game.on('board', () => this.panels.refresh());
        this.renderHotbar();
        this.updateObjective();
    }

    // ------------------------------------------------------------ mode switching
    setMode(mode) {
        this.mode = mode;
        const play = mode === 'play';
        this.hud.hidden = !play; this.hotbar.hidden = !play;
        this.touch.hidden = !(play && this.useTouch());
        $('#back').classList.toggle('hide', play);
        if (mode !== 'play') { $('#battle-ui').hidden = true; }
    }
    useTouch() { return this.opts.touch === 'on' || (this.opts.touch !== 'off' && (matchMedia('(pointer: coarse)').matches || this.input.touchMode)); }
    modal() { return !!this.dlg || this.panels.isOpen() || !!this.game?.rt.battle || this.mode !== 'play' || this.cutsceneOn; }
    onPanel(open) { this.audio.sfx(open ? 'open' : 'close'); this.touch.hidden = open || !(this.mode === 'play' && this.useTouch()); if (!open) this.renderHotbar(); }

    // ------------------------------------------------------------ HUD
    bindHud() {
        $('#b-menu').onclick = () => { this.audio.init(); this.audio.resume(); if (this.mode === 'play' && !this.game.rt.battle) this.panels.open('menu'); };
        $('#b-map').onclick = () => { if (this.mode === 'play' && !this.game.rt.battle) this.panels.open('map'); };
        $('#objective').onclick = () => { if (this.mode === 'play') this.panels.open('menu', { tab: 'journal' }); };
    }
    updateHud() {
        const g = this.game, p = g.p;
        const key = `${g.day}|${Math.floor(g.s.time.min / 10)}|${g.s.weather}|${p.gold}|${p.hp}|${p.maxHp}|${p.energy}|${p.maxEnergy}`;
        if (key === this.hudKey) return;
        this.hudKey = key;
        $('#h-date').textContent = dateText(g.day).replace(/, Year \d+/, '');
        $('#h-time').textContent = clockText(g.s.time.min);
        $('#h-weather').textContent = WEATHER_ICON[g.s.weather];
        $('#h-gold').textContent = p.gold.toLocaleString();
        $('.bar.hp i').style.width = (p.hp / p.maxHp * 100) + '%';
        $('#h-hp').textContent = `HP ${p.hp}/${p.maxHp}`;
        $('.bar.en i').style.width = (p.energy / p.maxEnergy * 100) + '%';
        $('#h-en').textContent = `EN ${p.energy}/${p.maxEnergy}`;
    }
    updateObjective() { if (this.game) $('#objective').textContent = this.game.objective(); }
    renderHotbar() {
        const g = this.game; if (!g) return;
        clear(this.hotbar);
        for (let i = 0; i < 8; i++) {
            const s = g.s.inv[i];
            const el = h('button', { class: 'slot' + (i === g.s.sel ? ' sel' : ''), 'aria-label': s ? ITEM[s.id].name : 'empty slot' });
            if (s) {
                el.append(iconEl(this.sprites, s.id));
                if (s.n > 1) el.append(h('span', { class: 'n' }, s.n));
                if (s.id === 'can') el.append(h('span', { class: 'water', style: `width:${g.p.water / (20 + g.p.tools.can * 10) * 36}px` }));
            }
            el.onclick = () => { this.audio.init(); this.audio.resume(); if (g.s.sel === i && s) { this.panels.open('menu', { tab: 'bag' }); this.panels.sel = i; this.panels.refresh(); } else { g.s.sel = i; this.renderHotbar(); if (s) this.toast(ITEM[s.id].name, true); } };
            this.hotbar.append(el);
        }
    }
    toast(text, quick = false) {
        const box = $('#toasts');
        const el = h('div', { class: 'toast' }, text);
        if (quick) el.style.animationDuration = '1.2s';
        box.append(el);
        while (box.children.length > 4) box.firstChild.remove();
        setTimeout(() => el.remove(), quick ? 1300 : 3300);
    }
    banner(title, sub) {
        const w = $('#where');
        clear(w); w.append(title, sub ? h('small', {}, sub) : '');
        w.classList.add('on');
        clearTimeout(this.bannerT); this.bannerT = setTimeout(() => w.classList.remove('on'), 2200);
    }
    flash() { const f = $('#fade'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 180); }
    shake(t) { if (this.opts.shake) this.renderer.shake = Math.max(this.renderer.shake, t); }
    enterRegion(rg) {
        const g = this.game;
        if (rg === 0) this.banner(g.s.villageName, g.villageTitle());
        else this.banner(g.world.regions[rg - 1].name);
        this.updateMusic();
    }
    updateMusic() {
        const g = this.game; if (!g) return;
        let mood;
        if (g.rt.battle) mood = g.rt.battle.boss ? 'boss' : 'battle';
        else if (!g.inWorld) mood = g.map.kind === 'cave' ? 'cave' : 'dungeon';
        else { const rg = g.region; mood = rg === 0 || rg === 255 ? (g.s.time.min >= 19 * 60 ? 'night' : 'glen') : moodForBiome(g.world.regions[rg - 1].biome.id); }
        if (g.s.quests.flags.festival && g.s.quests.flags.festivalDay === g.day && g.region === 0) mood = 'festival';
        this.audio.play(mood, g.s.seed);
        this.audio.setRain(g.inWorld && ['rain', 'storm'].includes(g.s.weather), g.s.weather === 'storm');
    }

    // ------------------------------------------------------------ dialog
    showDialog(d) { this.dlgQueue.push(d); if (!this.dlg) this.nextDialog(); }
    nextDialog() {
        const d = this.dlgQueue.shift();
        const box = $('#dialog');
        if (!d) { this.dlg = null; box.hidden = true; this.touch.hidden = !(this.mode === 'play' && this.useTouch()) || this.panels.isOpen(); return; }
        this.dlg = { ...d, line: 0 };
        box.hidden = false;
        this.touch.hidden = true;
        $('#dlg-name').textContent = d.name ?? '';
        const face = $('#dlg-face');
        const fg = face.getContext('2d'); fg.clearRect(0, 0, 16, 20);
        const g = this.game;
        const look = d.who === 'mayor' ? g.mayor.look : d.who && g.people[d.who] ? g.people[d.who].look : null;
        face.style.display = d.who ? '' : 'none';
        $('#dlg-box').style.paddingLeft = d.who ? '' : '14px';
        $('#dlg-name').style.left = d.who ? '' : '12px';
        if (look) fg.drawImage(this.sprites.person(look, 0, 0), 0, 0);
        else if (d.who === 'glim') fg.drawImage(this.sprites.glim(0), 2, 4);
        this.showLine();
    }
    showLine() {
        const d = this.dlg;
        const text = d.lines[d.line] ?? '';
        const el = $('#dlg-text');
        clear($('#dlg-choices'));
        $('#dlg-next').style.visibility = 'hidden';
        d.typing = true; d.shown = 0;
        clearInterval(this.typeT);
        this.typeT = setInterval(() => {
            d.shown += 2;
            el.textContent = text.slice(0, d.shown);
            if (d.shown % 6 === 0) this.audio.sfx('text');
            if (d.shown >= text.length) { clearInterval(this.typeT); this.lineDone(); }
        }, 16);
        el.textContent = '';
    }
    lineDone() {
        const d = this.dlg; d.typing = false;
        $('#dlg-text').textContent = d.lines[d.line] ?? '';
        const last = d.line >= d.lines.length - 1;
        if (last && d.choices?.length) {
            const box = $('#dlg-choices');
            for (const c of d.choices) {
                const b = h('button', {}, c.label);
                b.onclick = e => { e.stopPropagation(); this.audio.sfx('ui'); this.closeDialog(); c.act?.(); };
                box.append(b);
            }
        } else $('#dlg-next').style.visibility = 'visible';
    }
    advanceDialog() {
        const d = this.dlg; if (!d) return;
        if (d.typing) { clearInterval(this.typeT); this.lineDone(); return; }
        if (d.line < d.lines.length - 1) { d.line++; this.showLine(); return; }
        if (d.choices?.length) return;
        this.closeDialog();
        d.done?.();
    }
    closeDialog() { this.dlg = null; this.nextDialog(); }

    // ------------------------------------------------------------ menus from the game
    openMenu(m) {
        if (m.kind === 'station') this.panels.open('station', m);
        else this.panels.open(m.kind, m);
    }

    // ------------------------------------------------------------ battle
    startBattle(B) {
        this.flash();
        $('#battle-ui').hidden = false;
        this.hud.hidden = true; this.hotbar.hidden = true; this.touch.hidden = true;
        this.battle.start(this.game, B);
        this.updateMusic();
    }
    battleReserve() { const el = $('#battle-ui'); if (el.hidden) return 0; return el.getBoundingClientRect().height * (this.view?.dpr ?? 1) / (this.view?.scale ?? 1) + 4; }
    endBattle() {
        $('#battle-ui').hidden = true;
        this.battle.B = null;
        this.game.battleDone();
        if (this.mode === 'play' && this.game.rt.battle == null) { this.hud.hidden = false; this.hotbar.hidden = false; this.touch.hidden = !this.useTouch(); }
        this.renderHotbar();
        this.updateMusic();
    }

    // ------------------------------------------------------------ days and saving
    sleep() {
        const f = $('#fade'); f.classList.add('on');
        setTimeout(() => { this.game.sleep(); setTimeout(() => f.classList.remove('on'), 300); }, 400);
    }
    newDay({ report, fainted }) {
        const g = this.game;
        const lines = [`${dateText(g.day)} — ${WEATHER_ICON[g.s.weather]}`];
        const r = report.filter(Boolean);
        for (let k = 0; k < r.length; k += 3) lines.push(r.slice(k, k + 3).join('\n'));
        this.showDialog({ name: fainted ? 'Ouch…' : 'Good morning!', lines });
        this.renderHotbar(); this.updateObjective(); this.updateMusic();
    }
    autosave() { if (this.game) { if (writeSlot('auto', this.game)) this.toast('Game saved.', true); } }
    loadState(state) {
        this.panels.close();
        this.dlgQueue = []; this.dlg = null; $('#dialog').hidden = true;
        const game = this.makeGame(state);
        this.attach(game);
        this.setMode('play');
        this.updateMusic();
        this.toast(`Welcome back, ${game.p.name}.`);
        this.banner(game.s.villageName, dateText(game.day));
    }

    // ------------------------------------------------------------ chapter cards and cutscenes
    chapterCard(c) {
        this.banner(c.title, '');
        this.updateObjective();
        if (c.ch === 6) return;
        const g = this.game;
        const st = g.currentStep();
        if (st) setTimeout(() => this.toast('New goal: ' + g.objective()), 600);
    }
    cutscene(lines, after) {
        this.cutsceneOn = true;
        const L = $('#screen-layer'); clear(L); L.hidden = false;
        L.style.background = 'radial-gradient(ellipse at 50% 30%, #3a2a4a, #0d0a14)';
        const box = h('div', { class: 'cutscene' });
        L.append(box);
        after?.();
        let k = 0;
        const step = () => {
            if (k < lines.length) { box.append(h('p', {}, lines[k++])); L.scrollTop = L.scrollHeight; this.audio.sfx('sparkle'); this.cutT = setTimeout(step, 2600); }
            else {
                const b = h('button', { class: 'btn primary' }, 'The End… and a new beginning');
                b.onclick = () => { L.hidden = true; this.cutsceneOn = false; this.game.s.quests.flags.festivalDay = this.game.day; this.showDialog({ name: this.game.glim, who: 'glim', lines: ['Thank you, ' + this.game.p.name + '. The Glen is awake — and it is yours.', 'Every hidden thing in the land is shining now. Go and see! And there is always more to grow.'] }); this.updateMusic(); };
                box.append(h('p', { style: 'margin-top:20px' }, b));
            }
        };
        L.onclick = () => { if (k < lines.length) { clearTimeout(this.cutT); step(); } };
        step();
    }

    // ------------------------------------------------------------ map
    mapView(b) {
        const g = this.game, w = g.world;
        const wrap = h('div', { class: 'map-wrap' });
        const c = document.createElement('canvas');
        c.width = w.W; c.height = w.H;
        wrap.append(c); b.append(wrap);
        const x = c.getContext('2d');
        const img = x.createImageData(w.W, w.H), d = img.data;
        const col = (gr, o, rg) => {
            if (o === O.OLDTREE) return [36, 64, 40];
            if (o === O.TREE || o === O.PINE) return [58, 110, 58];
            if (o === O.THORN) return [120, 60, 120]; if (o === O.BOULDER) return [150, 140, 130]; if (o === O.DARK) return [20, 10, 30];
            switch (gr) {
                case G.WATER: return [70, 130, 200]; case G.SHALLOW: return [110, 180, 200]; case G.CLIFF: return [110, 96, 86];
                case G.PATH: case G.BRIDGE: return [200, 170, 120]; case G.PLAZA: return [210, 200, 180]; case G.FARM: return [140, 100, 60];
                case G.SAND: return [230, 215, 160]; case G.SNOW: case G.ICE: return [230, 238, 250]; case G.LAVA: return [240, 110, 40];
                case G.ROCKY: return [150, 130, 115]; case G.ASH: return [90, 80, 80]; case G.MARSH: return [80, 130, 110];
            }
            return rg === 2 ? [140, 190, 100] : [100, 160, 80];
        };
        for (let i = 0; i < w.W * w.H; i++) {
            const k = i * 4;
            if (!g.rt.explored[i] && !g.s.blessings.includes('lore')) { d[k] = 22; d[k + 1] = 26; d[k + 2] = 22; d[k + 3] = 255; continue; }
            const cc = col(w.ground[i], w.obj[i], w.region[i]);
            d[k] = cc[0]; d[k + 1] = cc[1]; d[k + 2] = cc[2]; d[k + 3] = 255;
        }
        for (const bd of g.buildings) for (let yy = bd.y; yy < bd.y + bd.h; yy++) for (let xx = bd.x; xx < bd.x + bd.w; xx++) { const k = (yy * w.W + xx) * 4; d[k] = 200; d[k + 1] = 80; d[k + 2] = 70; }
        x.putImageData(img, 0, 0);
        const dot = (px, py, color, r = 2) => { x.fillStyle = color; x.fillRect(px - r, py - r, r * 2 + 1, r * 2 + 1); };
        for (const s of w.sites) if (g.rt.explored[s.y * w.W + s.x] || g.s.dungeons[s.id]) dot(s.x, s.y, s.kind === 'dungeon' ? '#ff5a5a' : '#c080ff', 2);
        const lore = g.s.blessings.includes('lore');
        for (const gl of w.glimmers) {
            const awake = g.glimmerAwake(gl), used = g.s.world.glimmers[gl.id] === 'got';
            if (used) continue;
            if ((awake || g.s.world.glimmers['r' + gl.id] || lore) && (g.rt.explored[gl.y * w.W + gl.x] || g.s.world.glimmers['r' + gl.id] || lore)) dot(gl.x, gl.y, gl.kind === 'ring' ? '#7fffd4' : awake ? '#fff27a' : '#8a8a60', 1);
        }
        const p = g.inWorld ? g.p : (() => { const s = w.siteById[g.map.site]; return { x: s.x, y: s.y + 1 }; })();
        x.strokeStyle = '#fff'; x.lineWidth = 1; x.strokeRect(Math.floor(p.x) - 2.5, Math.floor(p.y) - 2.5, 5, 5);
        dot(Math.floor(p.x), Math.floor(p.y), '#ff3060', 1);
        b.append(h('div', { class: 'legend' }, h('span', { style: '--c:#ff3060' }, 'You'), h('span', { style: '--c:#ff5a5a' }, 'Dungeon'), h('span', { style: '--c:#c080ff' }, 'Cave'), h('span', { style: '--c:#fff27a' }, 'Glimmer'), h('span', { style: '--c:#7fffd4' }, 'Fairy ring'), h('span', { style: '--c:#c85046' }, 'Building')));
        b.append(h('h3', {}, 'Regions'));
        for (const R of w.regions) {
            const open = g.openRegions().includes(R.idx);
            const ds = w.sites.filter(s => s.region === R.idx).map(s => `${s.name}${g.s.dungeons[s.id]?.cleared ? ' ✔' : g.s.dungeons[s.id]?.deepest ? ` (floor ${g.s.dungeons[s.id].deepest})` : ''}`).join(', ');
            b.append(h('p', { class: open ? '' : 'muted' }, `${open ? '◆' : '◇'} ${R.name} — ${ds}`));
        }
        const rings = g.p.fastTravel.map(id => w.glimmers[id]).filter(Boolean);
        if (rings.length > 1 && g.inWorld) {
            b.append(h('h3', {}, 'Fairy rings'));
            for (const r of rings) { const bt = h('button', { class: 'btn' }, `Travel: ${r.region === 0 ? g.s.villageName : w.regions[r.region - 1].name}`); bt.onclick = () => { this.panels.close(); g.fastTravel(r.id); }; b.append(bt, ' '); }
        }
    }

    // ------------------------------------------------------------ title
    title() {
        this.setMode('title');
        const L = $('#screen-layer'); clear(L); L.hidden = false; L.style.background = 'linear-gradient(rgba(10,14,20,0.15), rgba(10,14,20,0.55))';
        const last = latestSlot();
        const m = last ? slotMeta(last) : null;
        const card = h('div', { class: 'title-card' },
            h('h1', {}, 'GLIMMERGLEN'),
            h('div', { class: 'sub' }, 'a cozy village in a forest that remembers magic'),
        );
        const start = () => { this.audio.init(); this.audio.resume(); this.audio.play('title', 7); };
        if (m) { const b = h('button', { class: 'btn primary' }, 'Continue', h('small', { style: 'display:block;font-size:12px;font-weight:normal' }, `${m.name} of ${m.village} · ${m.date}`)); b.onclick = () => { start(); const st = readSlot(last); if (st) this.loadState(st); else this.toast('That save could not be read.'); }; card.append(b); }
        const nb = h('button', { class: 'btn ' + (m ? '' : 'primary') }, 'New Game'); nb.onclick = () => { start(); this.creator(); }; card.append(nb);
        const lb = h('button', { class: 'btn' }, 'Load…'); lb.onclick = () => { start(); this.loadScreen(); }; card.append(lb);
        card.append(h('div', { class: 'foot' }, 'Everything — the land, its people, its songs — grows from one seed. Best with sound on.'));
        L.append(card);
        L.onpointerdown = () => { this.audio.init(); this.audio.resume(); this.audio.play('title', 7); };
    }
    loadScreen() {
        const L = $('#screen-layer'); clear(L);
        const sheet = h('div', { class: 'sheet slots' }, h('h2', {}, 'Load a game'));
        for (const sl of ['auto', '1', '2', '3']) {
            const m = slotMeta(sl);
            const row = h('div', { class: 'row' + (m ? '' : ' no') }, h('div', { class: 'main' }, h('b', {}, sl === 'auto' ? 'Autosave' : `Slot ${sl}`), h('small', {}, m ? `${m.name} of ${m.village} · ${m.date} · Lv ${m.level} · seed ${m.seed}` : 'Empty')));
            if (m) { const b = h('button', { class: 'btn primary' }, 'Load'); b.onclick = () => { const st = readSlot(sl); if (st) { L.hidden = true; this.loadState(st); } }; row.append(b); }
            sheet.append(row);
        }
        const file = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
        file.onchange = async () => { const f = file.files[0]; if (!f) return; const { parseSave } = await import('../sim/save.js'); const st = parseSave(await f.text()); if (st) { L.hidden = true; this.loadState(st); } else this.toast("That file isn't a Glimmerglen save."); };
        const imp = h('button', { class: 'btn' }, '⬆ Import a save file'); imp.onclick = () => file.click();
        const back = h('button', { class: 'btn' }, '↩ Back'); back.onclick = () => this.title();
        sheet.append(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px' }, imp, back, file));
        L.append(sheet);
    }
    toTitle() { this.panels.close(); this.dlgQueue = []; this.dlg = null; $('#dialog').hidden = true; this.onTitle?.(); this.title(); }

    // ------------------------------------------------------------ character creator
    creator() {
        const L = $('#screen-layer'); clear(L); L.hidden = false;
        const r = new RNG((Date.now() ^ (performance.now() * 1000)) >>> 0);
        const look = { skin: r.int(0, 7), hair: r.int(0, 7), hairColor: r.int(0, 9), eyes: r.int(0, 5), top: r.int(0, 9), bottom: r.int(0, 9), acc: 0 };
        const st = { name: personName(r), pronoun: 'they', village: '', seed: String(r.int(1, 999999)) };
        const sheet = h('div', { class: 'sheet' }, h('h2', {}, 'Who are you?'));
        const prev = document.createElement('canvas'); prev.width = 16; prev.height = 20;
        const nameIn = h('input', { type: 'text', maxlength: 14, value: st.name, 'aria-label': 'Name' });
        nameIn.oninput = () => { st.name = nameIn.value; };
        const seedIn = h('input', { type: 'text', maxlength: 24, value: st.seed, 'aria-label': 'World seed' });
        const villIn = h('input', { type: 'text', maxlength: 18, placeholder: '(named by the seed)', 'aria-label': 'Village name' });
        villIn.oninput = () => { st.village = villIn.value; };
        const villHint = h('small', { class: 'muted' });
        const updateSeedHint = () => { st.seed = seedIn.value; const n = seedFromText(seedIn.value); const nm = this.previewGlenName?.(n); villHint.textContent = nm ? `This seed's glen is called "${nm}".` : ''; };
        seedIn.oninput = updateSeedHint;
        const dice = h('button', { class: 'btn' }, '🎲'); dice.onclick = () => { seedIn.value = String(r.int(1, 999999999)); updateSeedHint(); };
        const swatches = (list, key) => { const box = h('div', { class: 'swatches' }); list.forEach((c, i) => { const s = h('button', { class: 'swatch' + (look[key] === i ? ' on' : ''), style: `background:${c}`, 'aria-label': `${key} ${i + 1}` }); s.onclick = () => { look[key] = i; [...box.children].forEach((x, j) => x.classList.toggle('on', j === i)); }; box.append(s); }); return box; };
        const chooser = (list, key, names) => { const val = h('div', { class: 'val' }, names ? names[list[look[key]]] : list[look[key]]); const set = d => { look[key] = (look[key] + d + list.length) % list.length; val.textContent = names ? names[list[look[key]]] : list[look[key]]; }; const a = h('button', { class: 'btn' }, '◀'); a.onclick = () => set(-1); const b = h('button', { class: 'btn' }, '▶'); b.onclick = () => set(1); return h('div', { class: 'chooser' }, a, val, b); };
        const seg = h('div', { class: 'seg' });
        for (const [k, label] of [['they', 'they/them'], ['she', 'she/her'], ['he', 'he/him']]) { const b = h('button', { class: 'btn' + (st.pronoun === k ? ' on' : '') }, label); b.onclick = () => { st.pronoun = k; [...seg.children].forEach(x => x.classList.toggle('on', x === b)); }; seg.append(b); }
        const field = (label, ...kids) => h('div', { class: 'field' }, h('label', {}, label), ...kids);
        const hairNames = Object.fromEntries(HAIR_STYLES.map(s => [s, s[0].toUpperCase() + s.slice(1)]));
        const surprise = h('button', { class: 'btn' }, '🎲 Surprise me');
        surprise.onclick = () => this.creator();
        const left = h('div', { class: 'preview' }, prev, h('small', { class: 'muted' }, 'Your look'), surprise);
        const right = h('div', {},
            field('Name', nameIn),
            field('Pronouns', seg),
            field('Skin', swatches(SKIN, 'skin')),
            field('Hair', chooser(HAIR_STYLES, 'hair', hairNames)),
            field('Hair colour', swatches(HAIR_COLORS, 'hairColor')),
            field('Eyes', swatches(EYES, 'eyes')),
            field('Top', swatches(CLOTH, 'top')),
            field('Trousers', swatches(CLOTH, 'bottom')),
            field('Accessory', chooser(ACCESSORIES, 'acc', ACC_NAMES)),
            field('World seed', h('div', { class: 'chooser' }, seedIn, dice), villHint),
            field('Village name', villIn),
        );
        const go = h('button', { class: 'btn primary', style: 'width:100%;min-height:54px;font-size:18px;margin-top:6px' }, 'Begin your story');
        go.onclick = () => {
            const name = (st.name || '').trim().slice(0, 14) || 'Farmer';
            const seed = seedFromText(seedIn.value || '1');
            this.intro({ seed, name, pronoun: st.pronoun, look: { ...look }, villageName: (st.village || '').trim() || null });
        };
        const back = h('button', { class: 'btn', style: 'width:100%;margin-top:6px' }, '↩ Back'); back.onclick = () => this.title();
        sheet.append(h('div', { class: 'creator' }, left, right), go, back);
        L.append(sheet);
        updateSeedHint();
        let t = 0;
        clearInterval(this.prevT);
        this.prevT = setInterval(() => {
            if (!prev.isConnected) { clearInterval(this.prevT); return; }
            t++;
            const dir = [0, 3, 1, 2][Math.floor(t / 8) % 4];
            const g = prev.getContext('2d'); g.clearRect(0, 0, 16, 20);
            g.drawImage(this.sprites.person(look, dir, [1, 0, 2, 0][t % 4]), 0, 0);
        }, 150);
    }
    intro(opts) {
        const L = $('#screen-layer'); clear(L);
        const game = this.makeGame(null, opts);
        const letter = h('div', { class: 'letter' },
            h('p', {}, `Dear ${opts.name},`),
            h('p', {}, `If this reaches you, I am gone, and the Glen is yours. Don't be sad — I had a long, muddy, wonderful life.`),
            h('p', {}, `${game.s.villageName} was a village once. The happiest place I ever knew. Then the old Heartwood broke its heart, and the magic went to sleep, and one by one we all drifted off. All but ${game.mayor.name}, who never could leave that tree.`),
            h('p', {}, `I think a place remembers being loved. Plant something. Build something. Let people in. See what wakes up.`),
            h('p', { class: 'sig' }, `With all my love,\nyour great-aunt ${game.mayor.aunt}`),
        );
        const b = h('button', { class: 'btn primary', style: 'width:100%;margin-top:10px;min-height:52px' }, `Travel to ${game.s.villageName}`);
        b.onclick = () => {
            L.hidden = true;
            this.attach(game);
            this.setMode('play');
            this.updateMusic();
            this.banner(game.s.villageName, 'Spring 1');
            writeSlot('auto', game);
            setTimeout(() => this.showDialog({ name: game.s.villageName, lines: [`You arrive at ${game.s.villageName}. Birdsong, long grass, and a great split tree in the middle of it all.`, this.useTouch() ? 'Drag on the left side of the screen to walk. Press A to do things — talk, chop, pick, open. Hold B to run.' : 'Move with WASD or the arrow keys. Space or E does things — talk, chop, pick, open. Hold Shift to run. 1–8 pick hotbar items.', 'An old-timer is waiting by the tree. Go and say hello!'] }), 500);
        };
        letter.append(b);
        L.append(letter);
    }
}
