/* TALEWRIGHT runtime — schema: defaults for every record, new projects, and
 * validate(), which rebuilds an untrusted project field by field from defaults
 * (unknown fields dropped, numbers clamped, strings cut, lists capped). The
 * editor, exported games and the runtime player all load through it. */
(window.TW_MODULES = window.TW_MODULES || []).push(['schema', function (TW) {
    'use strict';
    const VERSION = 1;
    const LIM = { maps: 64, mapMin: 10, mapMax: 120, events: 500, pages: 20, cmds: 20000, depth: 24, db: 999, name: 48, text: 4000, switches: 100 };

    // ── primitives ──
    const str = (v, max, d) => (typeof v === 'string' ? v.slice(0, max || LIM.name) : typeof v === 'number' ? String(v).slice(0, max || LIM.name) : d === undefined ? '' : d);
    const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d === undefined ? lo : d; };
    const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
    const bool = (v, d) => (typeof v === 'boolean' ? v : d === undefined ? false : d);
    const one = (v, list, d) => (list.includes(v) ? v : d === undefined ? list[0] : d);
    const arr = (v) => (Array.isArray(v) ? v : []);
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const color = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : d);

    const DIRS = [2, 4, 6, 8];
    const TRIGGERS = ['action', 'touch', 'autorun', 'parallel'];
    const PRIORITIES = ['same', 'below', 'above'];
    const MOVES = ['fixed', 'random', 'approach'];
    const ELEMENTS = ['none', 'fire', 'ice', 'bolt', 'holy', 'dark', 'wind'];
    const ITEM_KINDS = ['consumable', 'key', 'weapon', 'armor', 'accessory'];
    const SKILL_KINDS = ['damage', 'heal', 'revive', 'buffAtk', 'buffDef'];
    const SCOPES = ['enemy', 'allEnemies', 'ally', 'allAllies', 'self'];
    const ANIMS = ['hit', 'slash', 'fire', 'ice', 'bolt', 'holy', 'dark', 'wind', 'heal'];
    const OPS = ['>=', '<=', '=', '!=', '>', '<'];
    const STATS = ['hp', 'mp', 'atk', 'def', 'mag', 'spd'];

    // ── defaults ──
    function command(t) {
        const D = {
            text: { speaker: '', face: '', text: '', pos: 'bottom' },
            choice: { options: ['Yes', 'No'], cancel: 1, branches: [[], []] },
            comment: { text: '' },
            if: { cond: { kind: 'switch', id: 1, value: true, op: '>=', src: 'const', key: 'A' }, then: [], else: null },
            wait: { sec: 0.5 },
            erase: {},
            switch: { id: 1, value: 'on' },
            var: { id: 1, op: 'set', src: 'const', value: 0, max: 0 },
            self: { key: 'A', value: true },
            gold: { amount: 10 },
            item: { item: 0, amount: 1 },
            party: { actor: 0, op: 'add' },
            exp: { actor: 0, amount: 10 },
            heal: {},
            transfer: { map: 0, x: 0, y: 0, dir: 0, fade: true },
            route: { target: 'player', steps: [], wait: true },
            battle: { troop: 0, escape: true, lose: 'gameover', win: [], loseList: [] },
            shop: { goods: [] },
            gameover: {},
            end: { text: 'Thanks for playing!' },
            fadeout: { sec: 0.5 }, fadein: { sec: 0.5 },
            flash: { color: '#ffffff', sec: 0.4 },
            shake: { power: 4, sec: 0.6 },
            tint: { color: '#00000000', sec: 1 },
            sfx: { name: 'confirm' },
            bgm: { name: 'village' },
        };
        return Object.assign({ t }, JSON.parse(JSON.stringify(D[t] || {})));
    }
    const CMD_TYPES = ['text', 'choice', 'comment', 'if', 'wait', 'erase', 'switch', 'var', 'self', 'gold', 'item', 'party', 'exp', 'heal', 'transfer', 'route', 'battle', 'shop', 'gameover', 'end', 'fadeout', 'fadein', 'flash', 'shake', 'tint', 'sfx', 'bgm'];

    function page() {
        return {
            cond: { sw1: 0, sw2: 0, var: 0, varOp: '>=', varVal: 0, item: 0, actor: 0, self: '' },
            gfx: { kind: 'none', id: '', dir: 2 },
            trigger: 'action', priority: 'same', move: 'fixed', speed: 3, walkAnim: true, stepAnim: false, dirFix: false, through: false,
            list: [],
        };
    }
    function event(id, x, y, name) { return { id, name: name || 'EV' + String(id).padStart(3, '0'), x, y, pages: [page()] }; }
    function map(id, name, w, h, tileset) {
        w = w || 20; h = h || 15;
        const ground = new Array(w * h).fill(1);
        return { id, name: name || 'Map ' + id, w, h, tileset: tileset || 'meadow', layers: [ground, new Array(w * h).fill(0), new Array(w * h).fill(0)], events: [], music: '', battleBg: '', encounters: [], encRate: 0, showName: true };
    }
    function actor(id, name, sprite) {
        return { id, name: name || 'Hero', cls: 'Adventurer', sprite: sprite || 'hero', level: 1,
            stats: { hp: 40, mp: 10, atk: 12, def: 8, mag: 8, spd: 10 }, gain: { hp: 9, mp: 3, atk: 2.4, def: 1.8, mag: 1.8, spd: 1.4 },
            skills: [], equip: { weapon: 0, armor: 0, acc: 0 } };
    }
    function item(id, name) {
        return { id, name: name || 'Potion', icon: 'potion', kind: 'consumable', price: 20, desc: 'Restores 50 HP.', hp: 50, mp: 0, pct: false, revive: false, dmg: 0, element: 'none', scope: 'one', battle: true, menu: true, atk: 0, def: 0, mag: 0, spd: 0 };
    }
    function skill(id, name) { return { id, name: name || 'Fire', mp: 4, kind: 'damage', power: 14, element: 'fire', scope: 'enemy', anim: 'fire' }; }
    function enemy(id, name) {
        return { id, name: name || 'Slime', look: { family: 'slime', palette: -1, size: 'M' }, stats: { hp: 24, mp: 0, atk: 10, def: 4, mag: 4, spd: 6 }, exp: 6, gold: 5, drops: [], skills: [], weak: [], resist: [] };
    }
    function troop(id, name, members) { return { id, name: name || 'Troop ' + id, members: members || [], music: '' }; }

    function newProject(o) {
        o = o || {};
        const p = {
            format: 'talewright', version: VERSION,
            id: 'p_' + Math.random().toString(36).slice(2, 9),
            meta: { title: o.title || 'Untitled Tale', author: o.author || '', created: Date.now(), modified: Date.now() },
            system: {
                title: o.title || 'Untitled Tale', subtitle: '', titleStyle: 'starfield', titleMusic: 'title',
                startMap: 1, startX: 9, startY: 7, startDir: 2, startSet: false,
                party: [1], gold: 50, currency: 'G', windowSkin: 'classic',
                battleMusic: 'battle', victoryMusic: 'victory', gameOverText: 'The tale ends here…',
            },
            maps: [map(1, o.mapName || 'First Steps', 20, 15, 'meadow')],
            actors: [actor(1, 'Aria', 'hero')],
            items: [], skills: [], enemies: [], troops: [],
            switches: new Array(21).fill(''), variables: new Array(21).fill(''),
            sprites: [],
        };
        return p;
    }

    // ── validation ──
    function validate(raw) {
        if (!raw || typeof raw !== 'object') throw new Error('Not a TALEWRIGHT project.');
        if (raw.format && raw.format !== 'talewright') throw new Error('Not a TALEWRIGHT project.');
        raw = migrate(raw);
        const P = newProject();
        P.id = /^[A-Za-z0-9_-]{1,40}$/.test(raw.id || '') ? raw.id : P.id;
        const m = obj(raw.meta);
        P.meta = { title: str(m.title, 80, 'Untitled Tale'), author: str(m.author, 80, ''), created: int(m.created, 0, 9e15, Date.now()), modified: int(m.modified, 0, 9e15, Date.now()), sample: bool(m.sample, false) };

        const tilesets = TW.tiles ? Object.keys(TW.tiles.TILESETS) : ['meadow'];
        const tileCount = (ts) => (TW.tiles && TW.tiles.TILESETS[ts] ? TW.tiles.TILESETS[ts].tiles.length : 255);
        const ids = (list, lim) => { const seen = new Set(); return arr(list).slice(0, lim || LIM.db).filter((x) => { const ok = x && typeof x === 'object' && Number.isInteger(x.id) && x.id > 0 && !seen.has(x.id); if (ok) seen.add(x.id); return ok; }); };

        // database
        P.actors = ids(raw.actors).map((a) => {
            const d = actor(a.id);
            const st = obj(a.stats), gn = obj(a.gain), eq = obj(a.equip);
            return {
                id: a.id, name: str(a.name, LIM.name, d.name), cls: str(a.cls, LIM.name, ''), sprite: str(a.sprite, 40, 'hero'), level: int(a.level, 1, 99, 1),
                stats: Object.fromEntries(STATS.map((k) => [k, int(st[k], 0, 9999, d.stats[k])])),
                gain: Object.fromEntries(STATS.map((k) => [k, num(gn[k], 0, 999, d.gain[k])])),
                skills: arr(a.skills).slice(0, 50).map((s) => ({ skill: int(obj(s).skill, 0, 99999, 0), level: int(obj(s).level, 1, 99, 1) })).filter((s) => s.skill),
                equip: { weapon: int(eq.weapon, 0, 99999, 0), armor: int(eq.armor, 0, 99999, 0), acc: int(eq.acc, 0, 99999, 0) },
            };
        });
        if (!P.actors.length) P.actors = [actor(1, 'Aria', 'hero')];
        P.items = ids(raw.items).map((x) => {
            const d = item(x.id);
            return {
                id: x.id, name: str(x.name, LIM.name, 'Item'), icon: str(x.icon, 20, 'potion'), kind: one(x.kind, ITEM_KINDS), price: int(x.price, 0, 999999, 0), desc: str(x.desc, 200, ''),
                hp: int(x.hp, 0, 99999, 0), mp: int(x.mp, 0, 99999, 0), pct: bool(x.pct), revive: bool(x.revive), dmg: int(x.dmg, 0, 99999, 0), element: one(x.element, ELEMENTS),
                scope: one(x.scope, ['one', 'all']), battle: bool(x.battle, d.battle), menu: bool(x.menu, d.menu),
                atk: int(x.atk, -999, 999, 0), def: int(x.def, -999, 999, 0), mag: int(x.mag, -999, 999, 0), spd: int(x.spd, -999, 999, 0),
            };
        });
        P.skills = ids(raw.skills).map((x) => ({ id: x.id, name: str(x.name, LIM.name, 'Skill'), mp: int(x.mp, 0, 999, 0), kind: one(x.kind, SKILL_KINDS), power: int(x.power, 0, 9999, 0), element: one(x.element, ELEMENTS), scope: one(x.scope, SCOPES), anim: one(x.anim, ANIMS) }));
        P.enemies = ids(raw.enemies).map((x) => {
            const d = enemy(x.id), st = obj(x.stats), lk = obj(x.look);
            return {
                id: x.id, name: str(x.name, LIM.name, 'Enemy'),
                look: { family: str(lk.family, 20, 'slime'), palette: int(lk.palette, -1, 7, -1), size: one(lk.size, ['M', 'S', 'L']) },
                stats: Object.fromEntries(STATS.map((k) => [k, int(st[k], k === 'hp' ? 1 : 0, 99999, d.stats[k])])),
                exp: int(x.exp, 0, 999999, 0), gold: int(x.gold, 0, 999999, 0),
                drops: arr(x.drops).slice(0, 3).map((r) => ({ item: int(obj(r).item, 0, 99999, 0), chance: int(obj(r).chance, 0, 100, 0) })).filter((r) => r.item),
                skills: arr(x.skills).slice(0, 12).map((s) => int(s, 0, 99999, 0)).filter(Boolean),
                weak: arr(x.weak).filter((e) => ELEMENTS.includes(e) && e !== 'none').slice(0, 6),
                resist: arr(x.resist).filter((e) => ELEMENTS.includes(e) && e !== 'none').slice(0, 6),
            };
        });
        P.troops = ids(raw.troops).map((x) => ({
            id: x.id, name: str(x.name, LIM.name, 'Troop'), music: str(x.music, 20, ''),
            members: arr(x.members).slice(0, 6).map((mm) => ({ enemy: int(obj(mm).enemy, 0, 99999, 0), x: int(obj(mm).x, 0, 320, 0), y: int(obj(mm).y, 0, 240, 0) })).filter((mm) => mm.enemy),
        }));
        P.switches = arr(raw.switches).slice(0, LIM.switches + 1).map((s) => str(s, LIM.name, ''));
        P.variables = arr(raw.variables).slice(0, LIM.switches + 1).map((s) => str(s, LIM.name, ''));
        while (P.switches.length < 21) P.switches.push('');
        while (P.variables.length < 21) P.variables.push('');
        P.sprites = arr(raw.sprites).slice(0, 200).filter((s) => s && typeof s === 'object' && /^[A-Za-z0-9_-]{1,24}$/.test(s.id || '')).map((s) => ({ id: s.id, name: str(s.name, LIM.name, 'Sprite'), parts: parts(s.parts) }));

        // maps
        const budget = { n: 0 };
        P.maps = ids(raw.maps, LIM.maps).map((mm) => {
            const w = int(mm.w, LIM.mapMin, LIM.mapMax, 20), h = int(mm.h, LIM.mapMin, LIM.mapMax, 15);
            const ts = one(mm.tileset, tilesets, 'meadow');
            const max = tileCount(ts);
            const layers = [0, 1, 2].map((li) => {
                const src = arr(arr(mm.layers)[li]);
                const out = new Array(w * h);
                for (let i = 0; i < w * h; i++) { const v = src[i] | 0; out[i] = v > 0 && v <= max ? v : li === 0 ? 1 : 0; }
                return out;
            });
            const evIds = new Set();
            const events = arr(mm.events).slice(0, LIM.events).filter((e) => e && Number.isInteger(e.id) && e.id > 0 && !evIds.has(e.id) && evIds.add(e.id)).map((e) => ({
                id: e.id, name: str(e.name, LIM.name, 'EV'), x: int(e.x, 0, w - 1, 0), y: int(e.y, 0, h - 1, 0),
                pages: (arr(e.pages).length ? arr(e.pages) : [page()]).slice(0, LIM.pages).map((pg) => cleanPage(pg, budget)),
            }));
            return {
                id: mm.id, name: str(mm.name, LIM.name, 'Map'), w, h, tileset: ts, layers, events,
                music: str(mm.music, 20, ''), battleBg: str(mm.battleBg, 20, ''),
                encounters: arr(mm.encounters).slice(0, 12).map((x) => ({ troop: int(obj(x).troop, 0, 99999, 0), weight: int(obj(x).weight, 0, 100, 5) })).filter((x) => x.troop),
                encRate: int(mm.encRate, 0, 999, 0), showName: bool(mm.showName, true),
            };
        });
        if (!P.maps.length) P.maps = [map(1)];

        const s = obj(raw.system);
        const d = P.system;
        P.system = {
            title: str(s.title, 80, d.title), subtitle: str(s.subtitle, 120, ''), titleStyle: str(s.titleStyle, 20, d.titleStyle), titleMusic: str(s.titleMusic, 20, d.titleMusic),
            startMap: P.maps.some((x) => x.id === s.startMap) ? s.startMap : P.maps[0].id, startX: int(s.startX, 0, 119, 0), startY: int(s.startY, 0, 119, 0), startDir: one(s.startDir, DIRS, 2), startSet: bool(s.startSet, false),
            party: arr(s.party).map((x) => int(x, 0, 99999, 0)).filter((x) => P.actors.some((a) => a.id === x)).slice(0, 4),
            gold: int(s.gold, 0, 9999999, 0), currency: str(s.currency, 8, 'G'), windowSkin: str(s.windowSkin, 20, 'classic'),
            battleMusic: str(s.battleMusic, 20, 'battle'), victoryMusic: str(s.victoryMusic, 20, 'victory'), gameOverText: str(s.gameOverText, 200, d.gameOverText),
        };
        const sm = P.maps.find((x) => x.id === P.system.startMap);
        P.system.startX = Math.min(P.system.startX, sm.w - 1); P.system.startY = Math.min(P.system.startY, sm.h - 1);
        if (!P.system.party.length) P.system.party = [P.actors[0].id];
        return P;
    }

    function parts(p) {
        p = obj(p);
        const S = TW.sprites ? TW.sprites.PARTS : null;
        const pick = (k, list, d) => (S && list ? one(p[k], list, d) : str(p[k], 20, d));
        return {
            body: pick('body', S && S.body, 'human'), skin: color(p.skin, '#f6d2b0'), hair: pick('hair', S && S.hair, 'short'), hairColor: color(p.hairColor, '#5a3a1a'),
            eyes: pick('eyes', S && S.eyes, 'dot'), outfit: pick('outfit', S && S.outfit, 'tunic'), c1: color(p.c1, '#3a64c8'), c2: color(p.c2, '#5a3a1a'),
            head: pick('head', S && S.head, 'none'), hc: color(p.hc, '#8a4ac8'), acc: pick('acc', S && S.acc, 'none'), ac: color(p.ac, '#c83a3a'),
        };
    }

    function cleanPage(pg, budget) {
        pg = obj(pg);
        const d = page(), c = obj(pg.cond), g = obj(pg.gfx);
        return {
            cond: { sw1: int(c.sw1, 0, LIM.switches, 0), sw2: int(c.sw2, 0, LIM.switches, 0), var: int(c.var, 0, LIM.switches, 0), varOp: one(c.varOp, OPS), varVal: int(c.varVal, -9999999, 9999999, 0), item: int(c.item, 0, 99999, 0), actor: int(c.actor, 0, 99999, 0), self: one(c.self, ['', 'A', 'B', 'C', 'D']) },
            gfx: { kind: one(g.kind, ['none', 'char', 'obj', 'tile']), id: typeof g.id === 'number' ? int(g.id, 0, 255, 0) : str(g.id, 40, ''), dir: one(g.dir, DIRS, 2) },
            trigger: one(pg.trigger, TRIGGERS), priority: one(pg.priority, PRIORITIES), move: one(pg.move, MOVES), speed: int(pg.speed, 1, 5, 3),
            walkAnim: bool(pg.walkAnim, d.walkAnim), stepAnim: bool(pg.stepAnim, false), dirFix: bool(pg.dirFix, false), through: bool(pg.through, false),
            list: cleanList(pg.list, budget, 0),
        };
    }

    function cleanList(list, budget, depth) {
        if (depth > LIM.depth) return [];
        const out = [];
        for (const c of arr(list)) {
            if (budget.n++ > LIM.cmds) break;
            const x = cleanCmd(c, budget, depth);
            if (x) out.push(x);
        }
        return out;
    }

    function cleanCmd(c, budget, depth) {
        c = obj(c);
        if (!CMD_TYPES.includes(c.t)) return null;
        const d = command(c.t), L = (l) => cleanList(l, budget, depth + 1);
        switch (c.t) {
            case 'text': return { t: 'text', speaker: str(c.speaker, LIM.name), face: str(c.face, 40), text: str(c.text, LIM.text), pos: one(c.pos, ['bottom', 'middle', 'top']) };
            case 'choice': {
                const options = arr(c.options).slice(0, 4).map((o) => str(o, 60, '…'));
                if (options.length < 2) return null;
                return { t: 'choice', options, cancel: int(c.cancel, -1, options.length - 1, -1), branches: options.map((o, i) => L(arr(c.branches)[i])) };
            }
            case 'comment': return { t: 'comment', text: str(c.text, LIM.text) };
            case 'if': {
                const k = obj(c.cond);
                return { t: 'if', cond: { kind: one(k.kind, ['switch', 'var', 'self', 'item', 'gold', 'actor']), id: int(k.id, 0, 99999, 0), value: typeof k.value === 'boolean' ? k.value : int(k.value, -9999999, 9999999, 0), op: one(k.op, OPS), src: one(k.src, ['const', 'var']), key: one(k.key, ['A', 'B', 'C', 'D']) }, then: L(c.then), else: c.else ? L(c.else) : null };
            }
            case 'wait': return { t: 'wait', sec: num(c.sec, 0, 60, 0.5) };
            case 'switch': return { t: 'switch', id: int(c.id, 1, LIM.switches, 1), value: one(c.value, ['on', 'off', 'toggle']) };
            case 'var': return { t: 'var', id: int(c.id, 1, LIM.switches, 1), op: one(c.op, ['set', 'add', 'sub', 'mul', 'div', 'mod']), src: one(c.src, ['const', 'var', 'rand']), value: int(c.value, -9999999, 9999999, 0), max: int(c.max, -9999999, 9999999, 0) };
            case 'self': return { t: 'self', key: one(c.key, ['A', 'B', 'C', 'D']), value: bool(c.value, true) };
            case 'gold': return { t: 'gold', amount: int(c.amount, -9999999, 9999999, 0) };
            case 'item': return { t: 'item', item: int(c.item, 0, 99999, 0), amount: int(c.amount, -99, 99, 1) };
            case 'party': return { t: 'party', actor: int(c.actor, 0, 99999, 0), op: one(c.op, ['add', 'remove']) };
            case 'exp': return { t: 'exp', actor: int(c.actor, 0, 99999, 0), amount: int(c.amount, -999999, 999999, 0) };
            case 'transfer': return { t: 'transfer', map: int(c.map, 0, 99999, 0), x: int(c.x, 0, 119, 0), y: int(c.y, 0, 119, 0), dir: one(c.dir, [0, 2, 4, 6, 8], 0), fade: bool(c.fade, true) };
            case 'route': {
                const STEPS = ['u', 'd', 'l', 'r', 'tu', 'td', 'tl', 'tr', 'tp', 'w', 'j', 'hide', 'show'];
                const target = c.target === 'player' || c.target === 'this' ? c.target : int(c.target, 1, 99999, 'player');
                return { t: 'route', target, steps: arr(c.steps).filter((s) => STEPS.includes(s)).slice(0, 200), wait: bool(c.wait, true) };
            }
            case 'battle': return { t: 'battle', troop: int(c.troop, 0, 99999, 0), escape: bool(c.escape, true), lose: one(c.lose, ['gameover', 'continue']), win: L(c.win), loseList: L(c.loseList) };
            case 'shop': return { t: 'shop', goods: arr(c.goods).slice(0, 40).map((g) => int(g, 0, 99999, 0)).filter(Boolean) };
            case 'end': return { t: 'end', text: str(c.text, LIM.text, d.text) };
            case 'fadeout': case 'fadein': return { t: c.t, sec: num(c.sec, 0, 10, 0.5) };
            case 'flash': return { t: 'flash', color: color(c.color, '#ffffff'), sec: num(c.sec, 0, 10, 0.4) };
            case 'shake': return { t: 'shake', power: int(c.power, 1, 12, 4), sec: num(c.sec, 0, 10, 0.6) };
            case 'tint': return { t: 'tint', color: color(c.color, '#00000000'), sec: num(c.sec, 0, 10, 1) };
            case 'sfx': return { t: 'sfx', name: str(c.name, 20, 'confirm') };
            case 'bgm': return { t: 'bgm', name: str(c.name, 20, 'none') };
            default: return { t: c.t };
        }
    }

    function migrate(raw) {
        // v1 is the first format; future versions convert here.
        return raw;
    }

    /** Walk every command in a project: fn(cmd, ctx) with ctx { map, event, page }. */
    function walk(p, fn) {
        const visit = (list, ctx) => {
            for (const c of list || []) {
                if (!c) continue;
                fn(c, ctx);
                if (c.branches) for (const b of c.branches) visit(b, ctx);
                if (c.then) visit(c.then, ctx);
                if (c.else) visit(c.else, ctx);
                if (c.win) visit(c.win, ctx);
                if (c.loseList) visit(c.loseList, ctx);
            }
        };
        for (const m of p.maps || []) for (const e of m.events || []) for (const pg of e.pages || []) visit(pg.list, { map: m, event: e, page: pg });
    }

    const nextId = (list) => (list || []).reduce((n, x) => Math.max(n, x.id | 0), 0) + 1;

    TW.schema = { VERSION, LIM, CMD_TYPES, ELEMENTS, ITEM_KINDS, SKILL_KINDS, SCOPES, ANIMS, OPS, STATS, TRIGGERS, PRIORITIES, MOVES, command, page, event, map, actor, item, skill, enemy, troop, newProject, validate, migrate, walk, nextId, parts };
}]);
