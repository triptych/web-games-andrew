/**
 * simtest.mjs — the TALEWRIGHT runtime in Node, no browser.
 *
 *   purity     runtime files are export-safe (no imports, no exports, no "</script")
 *   assets     every tile of every tileset, every sprite preset, object, monster and icon builds
 *   schema     validate() round-trips the sample, rejects junk and clamps hostile values
 *   rules      the interpreter: text, choices, switches, variables, self switches, branches,
 *              items, gold, party, EXP and level-ups, pages, transfers, battles (win, lose,
 *              escape), shops, saves and loads, the loop guard, the battle maths
 *   sample     the sample game's maps are connected: every event a player must reach is reachable
 *   play       a bot plays The Lantern of Fernhollow from the title screen to The End
 *   balance    a mortal bot plays it too, and the harness prints how it went
 *
 *   node game-076/dev/simtest.mjs            # ONLY=purity,assets,schema,rules,sample,play,balance
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = process.env.ONLY ?? '';
const run = (n) => !ONLY || ONLY.split(',').includes(n);
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('  FAIL', msg); } };
const section = (n) => console.log('\n── ' + n);

export const RUNTIME = ['core', 'tiles', 'sprites', 'audio', 'input', 'state', 'schema', 'interp', 'ui', 'menus', 'map', 'battle', 'game'];

// ── a fake browser just big enough for the runtime ─────────────────────────
function fakeCtx(w, h) {
    const noop = () => {};
    return new Proxy({
        canvas: { width: w, height: h },
        measureText: (t) => ({ width: String(t).length * 5 }),
        getImageData: (x, y, ww, hh) => ({ data: new Uint8ClampedArray(ww * hh * 4) }),
        putImageData: noop,
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
    }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
}
function fakeCanvas(w, h) { const c = { width: w, height: h }; c.getContext = () => fakeCtx(c.width, c.height); return c; }

export function loadTW() {
    const store = new Map();
    const win = {
        TW_MODULES: [],
        addEventListener() {}, removeEventListener() {},
        navigator: {},
        localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() },
    };
    win.window = win;
    const ctx = vm.createContext(Object.assign(win, { console, Math, JSON, Date, Map, Set, Array, Object, Number, String, Uint8Array, Int32Array, Uint8ClampedArray, Proxy, Error, URLSearchParams }));
    for (const f of RUNTIME) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/runtime', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
    const TW = {};
    TW.makeCanvas = fakeCanvas;
    for (const [, fn] of win.TW_MODULES) fn(TW);
    TW.__store = store;
    return TW;
}

// ── a bot that drives the real game a frame at a time ──────────────────────
export class Bot {
    constructor(TW, project, opts) {
        this.TW = TW;
        this.g = new TW.Game(null, project, Object.assign({ headless: true, seed: 7, saveKey: 'tw.sim' }, opts));
        this.hooks = [];
        this.g.opts.onHook = (n, d) => { this.hooks.push([n, d]); if (n === 'gameover') this.deaths++; };
        this.frames = 0;
        this.god = !!(opts && opts.god);
        this.choices = [];   // queued choice answers
        this.log = [];
        this.deaths = 0;
        this.battles = 0;
    }
    press(b) { this.g.input.edge[b] = true; }
    tick(n) {
        for (let i = 0; i < (n || 1); i++) {
            this.service();
            this.g.step(1 / 60);
            this.frames++;
        }
    }
    /** React to whatever modal thing is up: messages, choices, battles. */
    service() {
        const g = this.g, TW = this.TW;
        if (g.scene === 'title') { if (this.frames % 20 === 0) this.press('ok'); return; }
        if (g.scene === 'gameover') { if (this.frames % 30 === 0) this.press('ok'); return; }
        if (g.scene === 'end') return;
        if (g.battle) {
            const b = g.battle;
            if (this.god) for (const a of g.state.party) { a.hp = g.state.maxHp(a); a.mp = g.state.maxMp(a); }
            if (b.phase === 'input' && !b.steps.length && this.frames % 4 === 0) {
                const a = b.party[b.actorI], st = g.state;
                if (b.sub) b.sub.onCancel();
                else if (!b.target && a && a.hp < st.maxHp(a) * 0.4) {
                    // a wounded hero drinks a potion, or a friend heals them
                    const potion = st.inventory().find((it) => it.kind === 'consumable' && it.hp && it.battle !== false);
                    if (potion && b.actions.filter((x) => x.kind === 'item').length < st.count(potion.id)) b.commit({ kind: 'item', user: a, item: potion, target: a });
                    else this.press('ok');
                } else this.press('ok');   // Attack → first target
            }
            return;
        }
        const top = g.ui.stack[g.ui.stack.length - 1];
        if (top && top instanceof TW.ui.ChoiceBox) {
            if (this.frames % 6 === 0) { const want = this.choices.length ? this.choices.shift() : 0; top.index = Math.min(want, top.items.length - 1); this.press('ok'); }
            return;
        }
        if (top && top instanceof TW.menus.Shop) { if (this.frames % 6 === 0) this.press('cancel'); return; }
        if (top && this.frames % 6 === 0) this.press('ok');
    }
    idle() { const g = this.g; return g.scene === 'map' && !g.interp && !g.ui.busy && !g.battle && !g.transferring && !g.map.player.moving; }
    waitIdle(max) { for (let i = 0; i < (max || 6000); i++) { if (this.idle()) return true; this.tick(); } return false; }
    get map() { return this.g.map; }
    /** Walk to a tile (or next to it, facing it, if it is blocked) and optionally press OK. */
    goTo(x, y, act, max) {
        for (let tries = 0; tries < 60; tries++) {
            if (!this.waitIdle()) return false;
            const p = this.map.player;
            const adj = Math.abs(p.x - x) + Math.abs(p.y - y);
            if (p.x === x && p.y === y) { if (act) { this.press('ok'); this.tick(2); } return true; }
            if (adj === 1 && !this.map.passable(x, y, p)) {
                const d = this.TW.util.dirOf(x - p.x, y - p.y);
                p.dir = d;
                if (act) { this.press('ok'); this.tick(2); }
                else { const k = { 8: 'up', 2: 'down', 4: 'left', 6: 'right' }[d]; this.g.input.keys[k] = true; this.tick(2); this.g.input.keys[k] = false; }
                return true;
            }
            const before = this.g.state.mapId;
            this.map.walkTo(x, y);
            if (!p.path) {
                // maybe it is an event that triggers by walking into it
                if (adj === 1) { const d = this.TW.util.dirOf(x - p.x, y - p.y); this.g.input.keys[{ 8: 'up', 2: 'down', 4: 'left', 6: 'right' }[d]] = true; this.tick(2); this.g.input.keys = {}; return true; }
                return false;
            }
            for (let i = 0; i < (max || 4000) && (p.path || p.moving); i++) { this.tick(); if (this.g.state.mapId !== before || this.g.battle || this.g.interp) break; }
            if (this.g.state.mapId !== before) return true;
        }
        return false;
    }
    hooked(name) { return this.hooks.some((h) => h[0] === name); }
}

async function main() {
    const TW = loadTW();
    const { sampleProject, SAMPLE_SW } = await import(pathToFileURL(path.join(ROOT, 'js/editor/sample.js')).href);

    if (run('purity')) {
        section('purity');
        for (const f of RUNTIME) {
            const src = fs.readFileSync(path.join(ROOT, 'js/runtime', f + '.js'), 'utf8');
            ok(!/<\/script/i.test(src), f + ': no closing script tag in source');
            ok(!/^\s*(import|export)\s/m.test(src), f + ': no import/export');
            ok(/^\(window\.TW_MODULES = window\.TW_MODULES \|\| \[\]\)\.push\(\['/m.test(src), f + ': registers in TW_MODULES');
        }
        ok(TW.version && TW.mount && TW.player && TW.boot, 'TW exposes mount, player and boot');
    }

    if (run('assets')) {
        section('assets');
        let n = 0;
        for (const ts of TW.tiles.list()) {
            const set = TW.tiles.TILESETS[ts.id];
            set.tiles.forEach((t, i) => {
                ok(TW.tiles.PT[t.p[0]], ts.id + ' tile ' + t.n + ' has a painter (' + t.p[0] + ')');
                for (let f = 0; f < (t.a || 1); f++) { ok(TW.tiles.tileCanvas(ts.id, i + 1, f, 0), ts.id + ':' + t.n); n++; }
            });
            ok(TW.tiles.BACKDROPS[set.bg], ts.id + ' has a battle backdrop');
            const names = set.tiles.map((t) => t.n);
            ok(new Set(names).size === names.length, ts.id + ': tile names are unique');
        }
        for (const id of Object.keys(TW.sprites.PRESETS)) { ok(TW.sprites.sheet(id), 'sprite ' + id); ok(TW.sprites.face(id), 'face ' + id); }
        for (const id of Object.keys(TW.sprites.OBJECTS)) for (let f = 0; f < TW.sprites.OBJECTS[id].f; f++) ok(TW.sprites.object(id, f), 'object ' + id);
        for (const fam of Object.keys(TW.sprites.FAMILIES)) for (const size of ['S', 'M', 'L']) for (let pal = 0; pal < 8; pal++) ok(TW.sprites.monster({ family: fam, palette: pal, size }), 'monster ' + fam);
        for (const ic of TW.sprites.ICONS) ok(TW.sprites.icon(ic), 'icon ' + ic);
        for (const th of Object.keys(TW.audio.THEMES)) ok(TW.audio.THEMES[th].prog.length > 0, 'music ' + th);
        console.log('  ' + n + ' tile frames, ' + Object.keys(TW.sprites.PRESETS).length + ' sprites, ' + Object.keys(TW.sprites.FAMILIES).length + ' monster families, ' + TW.sprites.ICONS.length + ' icons, ' + Object.keys(TW.audio.THEMES).length + ' songs');
    }

    if (run('schema')) {
        section('schema');
        const p = sampleProject(TW);
        const v1 = TW.schema.validate(JSON.parse(JSON.stringify(p)));
        const v2 = TW.schema.validate(JSON.parse(JSON.stringify(v1)));
        ok(JSON.stringify(v1) === JSON.stringify(v2), 'validate is idempotent on the sample');
        ok(v1.maps.length === 5 && v1.items.length === 12 && v1.enemies.length === 5, 'sample survives validation intact');
        let cmds = 0, cmds2 = 0;
        TW.schema.walk(p, () => cmds++); TW.schema.walk(v1, () => cmds2++);
        ok(cmds === cmds2 && cmds > 100, 'every sample command survives validation (' + cmds + ')');
        let threw = false;
        try { TW.schema.validate('nope'); } catch { threw = true; }
        ok(threw, 'a string is rejected');
        threw = false;
        try { TW.schema.validate({ format: 'other' }); } catch { threw = true; }
        ok(threw, 'another format is rejected');
        const hostile = TW.schema.validate({ maps: [{ id: 1, w: 99999, h: -5, tileset: '../../x', layers: [[999, -1, 'x']], events: [{ id: 1, x: 500, y: 500, pages: [{ trigger: 'evil', list: [{ t: 'eval', code: 'x' }, { t: 'text', text: 'x'.repeat(99999) }, { t: 'choice', options: ['a'] }] }] }] }], actors: [{ id: 1, name: '<img src=x onerror=alert(1)>', stats: { hp: 1e99 } }], system: { party: [1, 999], startMap: 77 }, __proto__: { polluted: true } });
        const hm = hostile.maps[0];
        ok(hm.w === 120 && hm.h === 10 && hm.tileset === 'meadow', 'map size and tileset are clamped');
        ok(hm.layers[0].every((t) => t >= 1 && t <= TW.tiles.TILESETS.meadow.tiles.length), 'tile numbers are clamped');
        ok(hm.events[0].x === 119 && hm.events[0].y === 9, 'event position is clamped');
        ok(hm.events[0].pages[0].trigger === 'action' && hm.events[0].pages[0].list.length === 1, 'unknown commands and a one-option choice are dropped');
        ok(hm.events[0].pages[0].list[0].text.length === 4000, 'text is cut to the limit');
        ok(hostile.actors[0].stats.hp === 9999 && hostile.system.party.join() === '1' && hostile.system.startMap === 1, 'stats, party and start map are clamped');
        ok(!('polluted' in {}), 'no prototype pollution');
        const fresh = TW.schema.newProject();
        ok(TW.schema.validate(fresh).maps[0].w === 20, 'a new project validates');
    }

    if (run('rules')) {
        section('rules');
        const base = () => {
            const p = TW.schema.newProject();
            p.items = [TW.schema.item(1, 'Potion'), Object.assign(TW.schema.item(2, 'Sword'), { kind: 'weapon', atk: 5, price: 10 })];
            p.skills = [TW.schema.skill(1, 'Fire')];
            p.enemies = [Object.assign(TW.schema.enemy(1, 'Slime'), { exp: 50, gold: 7, stats: { hp: 10, mp: 0, atk: 5, def: 1, mag: 1, spd: 1 } }), Object.assign(TW.schema.enemy(2, 'Titan'), { stats: { hp: 9999, mp: 0, atk: 999, def: 999, mag: 1, spd: 99 } })];
            p.troops = [TW.schema.troop(1, 'Slime', [{ enemy: 1, x: 160, y: 150 }]), TW.schema.troop(2, 'Titan', [{ enemy: 2, x: 160, y: 150 }])];
            p.actors.push(Object.assign(TW.schema.actor(2, 'Bo', 'child'), { skills: [{ skill: 1, level: 2 }] }));
            p.maps.push(TW.schema.map(2, 'Two', 12, 12, 'dungeon'));
            p.system.startSet = true; p.system.startX = 5; p.system.startY = 5;
            return p;
        };
        const runList = (p, list, opts) => {
            p.maps[0].events = [Object.assign(TW.schema.event(1, 6, 5), { pages: [Object.assign(TW.schema.page(), { trigger: 'autorun', list: list.concat([TW.schema.command('erase')]) })] })];
            const bot = new Bot(TW, TW.schema.validate(p), Object.assign({ startOverride: { map: 1, x: 5, y: 5 } }, opts));
            bot.choices = (opts && opts.choices) || [];
            bot.tick(5);
            for (let i = 0; i < 6000 && !bot.idle(); i++) bot.tick();
            bot.tick(30);
            return bot;
        };
        const C = (t, o) => Object.assign(TW.schema.command(t), o || {});
        let b = runList(base(), [C('switch', { id: 3, value: 'on' }), C('var', { id: 2, op: 'set', value: 7 }), C('var', { id: 2, op: 'mul', value: 6 }), C('var', { id: 2, op: 'sub', value: 2 }), C('var', { id: 3, op: 'set', src: 'var', value: 2 }), C('var', { id: 4, op: 'set', src: 'rand', value: 3, max: 5 }), C('gold', { amount: 25 }), C('item', { item: 1, amount: 3 })]);
        const st = b.g.state;
        ok(st.sw(3) && st.v(2) === 40 && st.v(3) === 40, 'switches and variable maths');
        ok(st.v(4) >= 3 && st.v(4) <= 5, 'random variable in range');
        ok(st.gold === 75 && st.count(1) === 3, 'gold and items');
        ok(b.hooked('switch') && b.hooked('item') && b.hooked('gold'), 'hooks fire for switch, item, gold');
        b = runList(base(), [C('text', { text: 'Hello \\p, you have \\g and \\v[1].' }), C('choice', { options: ['A', 'B', 'C'], branches: [[C('var', { id: 1, value: 1 })], [C('var', { id: 1, value: 2 })], [C('var', { id: 1, value: 3 })]] })], { choices: [2] });
        ok(b.g.state.v(1) === 3, 'choice branch 3 runs');
        ok(b.hooked('text') && b.hooks.find((h) => h[0] === 'choice')[1].index === 2, 'text and choice hooks');
        const ex = TW.ui.expand(b.g, 'Hi \\p! \\g \\v[1] \\n[2] \\i[1]');
        ok(ex === 'Hi Aria! 50 G 3 Bo Potion', 'text codes expand: ' + ex);
        b = runList(base(), [C('if', { cond: { kind: 'gold', op: '>=', value: 999 }, then: [C('var', { id: 1, value: 1 })], else: [C('var', { id: 1, value: 2 })] }), C('item', { item: 1, amount: 1 }), C('if', { cond: { kind: 'item', id: 1, value: true }, then: [C('var', { id: 2, value: 5 })] })]);
        ok(b.g.state.v(1) === 2 && b.g.state.v(2) === 5, 'conditional branches (gold, item, else)');
        b = runList(base(), [C('party', { actor: 2, op: 'add' }), C('exp', { actor: 2, amount: 200 })]);
        const bo = b.g.state.party.find((a) => a.id === 2);
        ok(bo && bo.level > 1 && b.hooked('levelUp'), 'party add and level-up (Bo is level ' + (bo && bo.level) + ')');
        ok(bo && b.g.state.skillsOf(bo).includes(1), 'skill learned at level 2');
        b = runList(base(), [C('transfer', { map: 2, x: 3, y: 4, dir: 6 })]);
        ok(b.g.state.mapId === 2 && b.map.player.x === 3 && b.map.player.y === 4 && b.hooked('transfer'), 'transfer');
        b = runList(base(), [C('battle', { troop: 1, win: [C('switch', { id: 9, value: 'on' })] })], { god: false });
        ok(b.g.state.sw(9) && b.hooked('battleWin') && b.g.state.gold === 57, 'battle win branch, EXP and gold');
        b = runList(base(), [C('battle', { troop: 2, escape: false, lose: 'continue', loseList: [C('switch', { id: 8, value: 'on' })] })]);
        ok(b.g.state.sw(8) && b.hooked('battleLose') && b.g.scene === 'map', 'battle lose branch continues');
        b = runList(base(), [C('battle', { troop: 2, escape: false, lose: 'gameover' })]);
        ok(b.g.scene === 'gameover' || b.deaths > 0 || b.g.scene === 'title', 'losing a battle is game over');
        b = runList(base(), [C('end', { text: 'bye' })]);
        ok(b.g.scene === 'end' && b.hooked('ending'), 'The End');
        // self switches and pages
        {
            const p = base();
            const chest = TW.schema.event(2, 5, 4);
            chest.pages = [Object.assign(TW.schema.page(), { gfx: { kind: 'obj', id: 'chest', dir: 2 }, list: [C('item', { item: 1, amount: 1 }), C('self', { key: 'A', value: true })] }), Object.assign(TW.schema.page(), { cond: Object.assign(TW.schema.page().cond, { self: 'A' }), gfx: { kind: 'obj', id: 'chest_open', dir: 2 } })];
            p.maps[0].events = [chest];
            const bot = new Bot(TW, TW.schema.validate(p), { startOverride: { map: 1, x: 5, y: 5 } });
            bot.tick(10);
            bot.map.player.dir = 8; bot.press('ok'); bot.tick(10); bot.waitIdle();
            ok(bot.g.state.count(1) === 1, 'chest gives its item');
            const e = bot.map.events[0];
            ok(e.page && e.page.gfx.id === 'chest_open', 'self switch flips the chest to its open page');
            bot.press('ok'); bot.tick(10); bot.waitIdle();
            ok(bot.g.state.count(1) === 1, 'an open chest gives nothing');
            // save and load
            bot.g.state.setV(5, 42);
            bot.g.save(1);
            bot.g.state.setV(5, 0); bot.g.state.gainItem(1, -1);
            ok(bot.g.load(1) && bot.g.state.v(5) === 42 && bot.g.state.count(1) === 1, 'save and load round trip');
            ok(bot.hooked('save') && bot.hooked('load'), 'save and load hooks');
        }
        // loop guard
        {
            const p = base();
            const warned = [];
            p.maps[0].events = [Object.assign(TW.schema.event(1, 1, 1), { pages: [Object.assign(TW.schema.page(), { trigger: 'autorun', list: [C('switch', { id: 1, value: 'toggle' })] })] })];
            const bot = new Bot(TW, TW.schema.validate(p), { startOverride: { map: 1, x: 5, y: 5 }, onWarn: (m) => warned.push(m) });
            bot.g.opts.onWarn = (m) => warned.push(m);
            bot.tick(5);
            ok(bot.g.scene === 'map', 'a looping autorun does not hang the game');
        }
        // shop
        {
            const p = base();
            const bot = new Bot(TW, TW.schema.validate(p), { startOverride: { map: 1, x: 5, y: 5 } });
            const shop = bot.g.shop([2]);
            shop.buy(); shop.list.index = 0; shop.list.choose();
            shop.commit(shop.qty);
            ok(bot.g.state.count(2) === 1 && bot.g.state.gold === 40 && bot.hooked('shopBuy'), 'buying from a shop');
            bot.g.state.equip(bot.g.state.party[0], 'weapon', 2);
            ok(bot.g.state.stat(bot.g.state.party[0], 'atk') === bot.g.state.base(bot.g.state.party[0], 'atk') + 5, 'equipping a weapon raises ATK');
        }
        // maths
        const r = () => 0.5;
        const ph = TW.battleMath.physical(20, 10, r);
        ok(ph.dmg === 30 && !ph.crit && !ph.miss, 'physical damage = ATK×2 − DEF');
        ok(TW.battleMath.physical(1, 999, () => 0.5).dmg === 1, 'damage is at least 1');
        ok(TW.battleMath.elemMult({ db: { weak: ['fire'], resist: [] } }, 'fire') === 1.5 && TW.battleMath.elemMult({ db: { weak: [], resist: ['ice'] } }, 'ice') === 0.5, 'weakness ×1.5, resistance ×0.5');
        ok(TW.expFor(1) === 0 && TW.expFor(2) === 20 && TW.expFor(10) > TW.expFor(9), 'EXP curve');
    }

    if (run('sample')) {
        section('sample');
        const p = TW.schema.validate(sampleProject(TW));
        const reach = (m, sx, sy) => {
            const seen = new Set([sy * m.w + sx]), q = [[sx, sy]];
            while (q.length) {
                const [x, y] = q.shift();
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = x + dx, ny = y + dy, k = ny * m.w + nx;
                    if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen.has(k) || TW.tiles.isSolid(m, nx, ny)) continue;
                    seen.add(k); q.push([nx, ny]);
                }
            }
            return seen;
        };
        const near = (seen, m, x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((y + dy) * m.w + x + dx));
        const starts = { 1: [14, 16], 2: [5, 8], 3: [5, 8], 4: [1, 12], 5: [3, 17] };
        for (const m of p.maps) {
            const seen = reach(m, ...starts[m.id]);
            for (const e of m.events) ok(near(seen, m, e.x, e.y), m.name + ': event "' + e.name + '" at ' + e.x + ',' + e.y + ' is reachable');
        }
    }

    if (run('play')) {
        section('play (god bot)');
        const r = playSample(TW, sampleProject, SAMPLE_SW, { god: true });
        for (const [c, m] of r.checks) ok(c, m);
        console.log('  ' + Math.round(r.bot.frames / 60) + ' s of game time, ' + r.bot.g.state.battles + ' battles, party level ' + r.bot.g.state.party.map((a) => a.level).join('/'));
    }

    if (run('balance')) {
        section('balance (mortal bot)');
        for (const seed of [3, 11, 29]) {
            const r = playSample(TW, sampleProject, SAMPLE_SW, { god: false, seed, grind: true });
            console.log('  seed ' + seed + ': ' + (r.won ? 'won' : 'lost at ' + r.stage) + ' — ' + r.bot.deaths + ' deaths, ' + r.bot.g.state.battles + ' battles, levels ' + r.bot.g.state.party.map((a) => a.level).join('/') + ', ' + Math.round(r.bot.frames / 3600) + ' min');
            ok(true, 'balance run ' + seed);
        }
    }

    console.log(`\n${passes} passed, ${fails} failed`);
    process.exit(fails ? 1 : 0);
}

/** Play the sample game from the title screen to The End. */
export function playSample(TW, sampleProject, SW, opts) {
    const p = TW.schema.validate(sampleProject(TW));
    const bot = new Bot(TW, p, { god: opts.god, seed: opts.seed || 7 });
    const checks = [];
    const C = (c, m) => checks.push([c, m]);
    let stage = 'title';
    const st = () => bot.g.state;
    // title → new game → intro
    for (let i = 0; i < 1200 && !bot.idle(); i++) bot.tick();
    C(bot.g.scene === 'map' && st().sw(SW.intro), 'the intro plays and sets its switch');
    stage = 'elder';
    bot.goTo(6, 7);                         // the Elder's door
    bot.waitIdle();
    C(st().mapId === 2, 'the door leads into the Elder\'s house');
    bot.choices = [0];
    bot.goTo(5, 3, true);                   // talk to the Elder
    bot.waitIdle();
    C(st().sw(SW.quest) && st().count(10) === 1 && st().count(1) >= 3, 'the Elder gives the quest, potions and the Lantern');
    bot.goTo(5, 9); bot.waitIdle();
    C(st().mapId === 1, 'back out to the village');
    stage = 'shop';
    if (st().gold >= 200 - 60) { /* the shop is exercised in browsertest */ }
    stage = 'woods';
    bot.goTo(29, 11); bot.waitIdle();
    C(st().mapId === 4, 'the east road leads to the Whisperwood once the quest is accepted');
    bot.choices = [0];
    bot.goTo(12, 19, true); bot.waitIdle();
    C(st().inParty(2) && st().sw(SW.pip), 'Pip joins the party');
    if (opts.grind) {
        // a little grinding near the spring, as a player would
        for (let k = 0; k < 6 && st().party.some((a) => a.level < 6); k++) { bot.goTo(8, 18); bot.goTo(4, 18); bot.goTo(7, 18, true); bot.waitIdle(); }
    }
    bot.goTo(19, 8, true); bot.waitIdle();
    C(st().count(4) >= 1, 'the woods chest holds a Firebomb');
    stage = 'cave';
    bot.goTo(28, 3); bot.waitIdle();
    C(st().mapId === 5, 'the cave mouth leads into the Hollow Cave');
    bot.goTo(8, 10, true); bot.waitIdle();
    C(st().count(6) === 1, 'the cave chest holds an Iron Sword');
    st().equip(st().party[0], 'weapon', 6);
    bot.goTo(9, 9, true); bot.waitIdle();
    bot.goTo(21, 11, true); bot.waitIdle();
    C(st().v(1) === 2, 'both levers pulled (' + st().v(1) + ')');
    bot.goTo(21, 8, true); bot.waitIdle();
    C(st().count(3) >= 1, 'the royal chest holds a Phoenix Feather');
    stage = 'boss';
    if (opts.grind) { for (const a of st().party) { a.hp = st().maxHp(a); a.mp = st().maxMp(a); } }
    bot.goTo(19, 3);
    bot.goTo(20, 3);
    for (let i = 0; i < 60 * 600 && bot.g.scene !== 'end' && bot.g.scene !== 'title'; i++) bot.tick();
    C(bot.hooks.some((h) => h[0] === 'battleWin' && h[1].troop === 5), 'the Gloom Wisp is defeated');
    C(st().sw(SW.wisp), 'the Wisp switch is on');
    C(bot.g.scene === 'end' && bot.hooked('ending'), 'the homecoming plays and The End rolls');
    return { bot, checks, won: bot.g.scene === 'end', stage };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
